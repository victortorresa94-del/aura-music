/**
 * El motor de la nube: pone al día este dispositivo y la cuenta, en segundo plano.
 *
 * Tres movimientos:
 *   · TIRAR (al entrar, al volver a la app, al volver la red y cada minuto):
 *     lee de la nube lo que ha cambiado, lo compara con lo de aquí y decide
 *     idea por idea (`reconciliar.decidir`). Lo que hay que bajar se baja ya
 *     (solo el documento: el audio, al abrir la idea); lo que hay que subir va
 *     a la cola.
 *   · SUBIR (la cola): para cada idea pendiente vuelve a mirar la nube, sube
 *     los audios que falten en su carpeta y DESPUÉS el documento. En ese
 *     orden: otro dispositivo nunca ve una idea cuyo audio no ha llegado.
 *   · BAJAR AUDIO (al abrir una idea): lo que no esté aquí, de la nube a
 *     IndexedDB, y de ahí al motor de audio como siempre.
 *
 * La idea que tienes abierta no se cambia por debajo mientras trabajas: si
 * llega una versión nueva y ya la habías tocado, se avisa y decides tú.
 *
 * No sabe de Firebase ni de IndexedDB (ver `tipos.ts`), y por eso se prueba
 * entero con los dos simulados (`motor.test.ts`).
 */

import { newId, type Project } from '@/lib/daw/types';
import { cerebroVacio } from '@/lib/productor/cerebro';
import { fusionarCerebros, mismoCerebro } from './cerebro';
import {
  CLAVE_CEREBRO,
  AGRUPAR_MS,
  claveDeProyecto,
  encolar,
  fallida,
  hecha,
  idDeClave,
  proximaEspera,
  reintentarYa,
  siguiente,
} from './cola';
import { clasificarError, textoDelError, type TipoDeError } from './errores';
import { codificarFlac, decodificarFlac, type Pcm16 } from './flac';
import {
  buffersDe,
  copiaDeLaPerdedora,
  decidir,
  decidirLimpieza,
  sePuedeVaciar,
  tieneAudiosPropios,
  type Accion,
  type Version,
  type VersionRemota,
} from './reconciliar';
import {
  ESTADO_INICIAL,
  type Dispositivo,
  type EstadoGuardado,
  type EstadoNube,
  type Local,
  type ProyectoRemoto,
  type Remoto,
} from './tipos';

const DIA = 24 * 60 * 60 * 1000;
/** Cuántos audios se bajan a la vez al abrir una idea. */
const BAJADAS_EN_PARALELO = 3;
/** Mientras grabas no se codifica nada: se vuelve a mirar pasado este rato. */
const ESPERA_SI_OCUPADO_MS = 4000;

export interface IdeaAbierta {
  id: string;
  /** Nadie la ha tocado desde que se cargó: se puede cambiar por la de la nube sin perder nada. */
  intacta: boolean;
  /** Está sonando o grabando. */
  ocupado: boolean;
}

export interface OpcionesMotor {
  local: Local;
  remoto: Remoto;
  dispositivo: Dispositivo;
  leerEstado: () => EstadoGuardado;
  guardarEstado: (estado: EstadoGuardado) => void;
  reloj?: () => number;
  enLinea?: () => boolean;
  nuevoId?: () => string;
  /** La idea abierta en el estudio. */
  abierta?: () => IdeaAbierta | null;
  /** Grabando: no se codifica ni se sube nada hasta que pare. */
  grabando?: () => boolean;
  /** La idea abierta se ha cambiado por la de la nube: el estudio la vuelve a cargar. */
  alRecargarAbierta?: (id: string) => Promise<void> | void;
  /** Han cambiado las ideas de este dispositivo (para refrescar la lista). */
  alCambiarIdeas?: () => void;
  alCambiarEstado?: (estado: EstadoNube) => void;
  temporizador?: { poner: (fn: () => void, ms: number) => unknown; quitar: (id: unknown) => void };
  codificar?: (audio: Pcm16) => Promise<Uint8Array>;
  decodificar?: (flac: Uint8Array) => Promise<Pcm16>;
}

const versionLocal = (p: Project): Version => ({ updatedAt: p.updatedAt, buffers: buffersDe(p) });
const versionRemota = (r: ProyectoRemoto): VersionRemota => ({ updatedAt: r.updatedAt, buffers: r.buffers, borrado: r.borrado });

export class MotorNube {
  private estado: EstadoGuardado;
  private publico: EstadoNube = { ...ESTADO_INICIAL, fase: 'al-dia' };
  private readonly reloj: () => number;
  private readonly enLinea: () => boolean;
  private readonly nuevoId: () => string;
  private readonly codificar: (audio: Pcm16) => Promise<Uint8Array>;
  private readonly decodificar: (flac: Uint8Array) => Promise<Pcm16>;
  private cadena: Promise<unknown> = Promise.resolve();
  private tirando: Promise<void> | null = null;
  private bombeando = false;
  private timer: unknown = null;
  private parado = false;
  private trabajos = 0;
  private bajadas = 0;
  private ultimoError: { tipo: TipoDeError; texto: string } | null = null;
  /** La versión de la nube de la idea abierta, esperando a que digas qué hacer. */
  private cambioAbierta: ProyectoRemoto | null = null;

  constructor(private readonly o: OpcionesMotor) {
    this.estado = o.leerEstado();
    this.reloj = o.reloj ?? Date.now;
    this.enLinea = o.enLinea ?? (() => typeof navigator === 'undefined' || navigator.onLine !== false);
    this.nuevoId = o.nuevoId ?? (() => newId('prj'));
    this.codificar = o.codificar ?? ((a) => codificarFlac(a));
    this.decodificar = o.decodificar ?? ((f) => decodificarFlac(f));
  }

  /* ---------------------------------------------------------------- */
  /* Lo que se ve                                                      */
  /* ---------------------------------------------------------------- */

  get estadoPublico(): EstadoNube {
    return this.publico;
  }

  /** Para los tests y para depurar. */
  get guardado(): EstadoGuardado {
    return this.estado;
  }

  private emitir(cambio: Partial<EstadoNube> = {}): void {
    const pendientes = this.estado.cola.length;
    let fase: EstadoNube['fase'];
    if (this.trabajos > 0 || this.bajadas > 0 || this.publico.subiendo) fase = 'trabajando';
    else if (!this.enLinea()) fase = 'sin-conexion';
    else if (this.ultimoError && this.ultimoError.tipo !== 'red') fase = 'error';
    else if (this.ultimoError && pendientes > 0) fase = 'sin-conexion';
    else if (pendientes > 0) fase = 'trabajando';
    else fase = 'al-dia';
    const siguienteEstado: EstadoNube = {
      ...this.publico,
      ...cambio,
      fase,
      pendientes,
      bajando: this.bajadas > 0,
      error: this.ultimoError && this.ultimoError.tipo !== 'red' ? this.ultimoError.texto : null,
      cambioEnLaAbierta: this.cambioAbierta
        ? { id: this.cambioAbierta.id, dispositivo: this.cambioAbierta.dispositivo?.nombre || 'otro dispositivo' }
        : null,
    };
    const antes = this.publico;
    this.publico = siguienteEstado;
    if (JSON.stringify(antes) !== JSON.stringify(siguienteEstado)) this.o.alCambiarEstado?.(siguienteEstado);
  }

  private guardar(): void {
    this.o.guardarEstado(this.estado);
  }

  private fallo(error: unknown, bajando = false): TipoDeError {
    const tipo = clasificarError(error, { enLinea: this.enLinea(), bajando });
    this.ultimoError = { tipo, texto: textoDelError(tipo) };
    if (tipo !== 'red' && typeof console !== 'undefined') console.warn('[nube]', error);
    return tipo;
  }

  /** De una en una: dos vueltas a la vez sobre la misma idea se pisarían. */
  private enSerie<T>(fn: () => Promise<T>): Promise<T> {
    const vuelta = this.cadena.then(fn, fn);
    this.cadena = vuelta.catch(() => undefined);
    return vuelta;
  }

  private async conTrabajo<T>(fn: () => Promise<T>): Promise<T> {
    this.trabajos++;
    this.emitir();
    try {
      return await fn();
    } finally {
      this.trabajos--;
      this.emitir();
    }
  }

  /* ---------------------------------------------------------------- */
  /* Avisos del estudio                                                */
  /* ---------------------------------------------------------------- */

  /** Se ha guardado una idea aquí. Se agrupan los cambios seguidos. */
  avisarGuardado(id: string): void {
    if (this.parado) return;
    this.estado.cola = encolar(this.estado.cola, claveDeProyecto(id), this.reloj(), AGRUPAR_MS);
    this.guardar();
    this.emitir();
    this.programar();
  }

  /** Se ha borrado una idea aquí. El borrado viaja a la nube como una lápida. */
  avisarBorrado(id: string): void {
    if (this.parado) return;
    this.estado.borrados[id] = this.reloj();
    this.estado.cola = encolar(this.estado.cola, claveDeProyecto(id), this.reloj());
    if (this.cambioAbierta?.id === id) this.cambioAbierta = null;
    this.guardar();
    this.emitir();
    void this.bombear();
  }

  avisarCerebro(): void {
    if (this.parado) return;
    this.estado.cola = encolar(this.estado.cola, CLAVE_CEREBRO, this.reloj(), 5000);
    this.guardar();
    this.emitir();
    this.programar();
  }

  /** Ha vuelto la red o has tocado «Reintentar». */
  reintentar(): void {
    if (this.parado) return;
    this.ultimoError = null;
    this.estado.cola = reintentarYa(this.estado.cola, this.reloj());
    this.guardar();
    this.emitir();
    void this.tirar().then(() => this.bombear());
  }

  parar(): void {
    this.parado = true;
    if (this.timer !== null) this.quitarTimer();
  }

  /** Ha cambiado algo de fuera (la red se ha ido): vuelve a calcular lo que se enseña. */
  refrescar(): void {
    this.emitir();
  }

  /** Espera a que no quede nada en marcha (los tests, y salir de la cuenta sin cortar una subida). */
  async enCalma(): Promise<void> {
    for (let i = 0; i < 200; i++) {
      await this.cadena;
      await new Promise((resolver) => setTimeout(resolver, 0));
      if (!this.bombeando && !this.tirando && this.trabajos === 0) return;
    }
  }

  /* ---------------------------------------------------------------- */
  /* Tirar: lo nuevo de la nube                                        */
  /* ---------------------------------------------------------------- */

  /** @param completo todas las ideas, no solo lo cambiado desde la última vez. */
  tirar(completo = false): Promise<void> {
    if (this.parado) return Promise.resolve();
    if (this.tirando) return this.tirando;
    this.tirando = this.enSerie(() => this.conTrabajo(() => this.hacerTirar(completo))).finally(() => {
      this.tirando = null;
    });
    return this.tirando;
  }

  private async hacerTirar(completo: boolean): Promise<void> {
    if (!this.enLinea()) return;
    let cambiaronIdeas = false;
    let algunFallo: unknown = null;
    try {
      const desde = completo || !this.estado.marca ? null : this.estado.marca;
      const remotos = await this.o.remoto.listarProyectos(desde);
      const locales = await this.o.local.listarProyectos();
      const deAqui = new Map(locales.map((p) => [p.id, p]));
      const deLaNube = new Map(remotos.map((r) => [r.id, r]));
      const ids = new Set([...deAqui.keys(), ...deLaNube.keys(), ...Object.keys(this.estado.borrados)]);

      for (const id of ids) {
        try {
          const local = deAqui.get(id) ?? null;
          const base = this.estado.base[id];
          let remoto: ProyectoRemoto | VersionRemota | null = deLaNube.get(id) ?? null;
          // Si ya la conocíamos y no ha venido en el lote, en la nube sigue como quedó.
          if (!remoto && desde !== null && base !== undefined) remoto = { updatedAt: base, buffers: [], borrado: false };
          const accion = decidir(
            local && versionLocal(local),
            this.estado.borrados[id] ?? null,
            remoto && ('proyecto' in remoto ? versionRemota(remoto) : remoto),
            base,
          );
          const real = deLaNube.get(id) ?? null;
          if (await this.aplicar(id, accion, local, real, 'tirar')) cambiaronIdeas = true;
        } catch (error) {
          algunFallo = error;
        }
      }

      for (const r of remotos) this.estado.marca = Math.max(this.estado.marca, r.servidorEn);
      this.estado.cola = encolar(this.estado.cola, CLAVE_CEREBRO, this.reloj());
      this.guardar();
      if (algunFallo) this.fallo(algunFallo);
      else this.ultimoError = null;
      this.publico = { ...this.publico, ultimaVez: this.reloj() };
    } catch (error) {
      this.fallo(error);
    } finally {
      if (cambiaronIdeas) this.o.alCambiarIdeas?.();
    }
    void this.bombear();
    if (this.reloj() - this.estado.ultimaLimpieza > DIA) void this.limpiar();
  }

  /**
   * Hace lo decidido para una idea. Devuelve si ha cambiado algo de este
   * dispositivo. `desde` dice quién pregunta: al tirar, lo que hay que subir
   * va a la cola; al atender la cola, se sube aquí mismo.
   */
  private async aplicar(
    id: string,
    accion: Accion,
    local: Project | null,
    remoto: ProyectoRemoto | null,
    desde: 'tirar' | 'cola',
  ): Promise<boolean> {
    switch (accion.tipo) {
      case 'nada': {
        if (local && remoto && !remoto.borrado && local.updatedAt === remoto.updatedAt) this.estado.base[id] = local.updatedAt;
        if (!local && (remoto?.borrado || !remoto)) {
          delete this.estado.borrados[id];
          delete this.estado.base[id];
        }
        if (this.cambioAbierta?.id === id && local && remoto && local.updatedAt === remoto.updatedAt) this.cambioAbierta = null;
        return false;
      }
      case 'subir':
      case 'subir-borrado': {
        if (desde === 'tirar') {
          this.estado.cola = encolar(this.estado.cola, claveDeProyecto(id), this.reloj());
          return false;
        }
        if (accion.tipo === 'subir' && local) await this.subir(local);
        else if (accion.tipo === 'subir-borrado') await this.subirBorrado(id);
        return false;
      }
      case 'bajar': {
        if (!remoto?.proyecto) return false;
        if (this.debeEsperar(id)) {
          this.cambioAbierta = remoto;
          return false;
        }
        await this.bajarDocumento(remoto);
        await this.recargarSiEsLaAbierta(id);
        return true;
      }
      case 'borrar-local': {
        // La abierta no se borra por debajo: si sigues con ella, vuelve a la nube.
        if (!local || this.o.abierta?.()?.id === id) return false;
        await this.o.local.borrarProyecto(local);
        delete this.estado.base[id];
        delete this.estado.borrados[id];
        return true;
      }
      case 'choque': {
        if (!local || !remoto) return false;
        if (accion.gana === 'remoto') {
          if (this.debeEsperar(id)) {
            this.cambioAbierta = remoto;
            return false;
          }
          await this.ganaLaDeLaNube(local, remoto, accion.copia);
          await this.recargarSiEsLaAbierta(id);
          return true;
        }
        await this.ganaLaDeAqui(local, remoto, accion.copia);
        if (desde === 'cola') await this.subir(local);
        else this.estado.cola = encolar(this.estado.cola, claveDeProyecto(id), this.reloj());
        return accion.copia;
      }
    }
  }

  /** ¿Es la idea abierta y ya la has tocado (o está sonando)? Entonces no se cambia por debajo. */
  private debeEsperar(id: string): boolean {
    const abierta = this.o.abierta?.();
    return !!abierta && abierta.id === id && (!abierta.intacta || abierta.ocupado);
  }

  private async recargarSiEsLaAbierta(id: string): Promise<void> {
    if (this.o.abierta?.()?.id !== id) return;
    if (this.cambioAbierta?.id === id) this.cambioAbierta = null;
    // Sin esperar: volver a cargarla baja su audio, y eso no puede quedarse en la cola detrás de esta vuelta.
    void Promise.resolve(this.o.alRecargarAbierta?.(id)).catch(() => undefined);
  }

  private async bajarDocumento(remoto: ProyectoRemoto): Promise<void> {
    if (!remoto.proyecto) return;
    await this.o.local.guardarProyecto({ ...remoto.proyecto, updatedAt: remoto.updatedAt });
    this.estado.base[remoto.id] = remoto.updatedAt;
    delete this.estado.borrados[remoto.id];
  }

  /** Gana la de la nube. La de aquí, si tenía tomas que la otra no, se queda como copia. */
  private async ganaLaDeLaNube(local: Project, remoto: ProyectoRemoto, copia: boolean): Promise<void> {
    if (copia) {
      const otra = copiaDeLaPerdedora(local, this.o.dispositivo.nombre, this.reloj(), this.nuevoId);
      await this.o.local.guardarProyecto(otra);
      this.estado.cola = encolar(this.estado.cola, claveDeProyecto(otra.id), this.reloj());
    }
    await this.bajarDocumento(remoto);
  }

  /**
   * Gana la de aquí. La de la nube, si tenía tomas que esta no, se guarda
   * aquí como copia; sus audios se bajan antes, porque al subir la copia irán
   * a su propia carpeta.
   */
  private async ganaLaDeAqui(local: Project, remoto: ProyectoRemoto, copia: boolean): Promise<void> {
    if (copia && remoto.proyecto) {
      const deAqui = new Set(buffersDe(local));
      for (const bufferId of remoto.buffers) {
        if (deAqui.has(bufferId) || (await this.o.local.tieneAudio(bufferId))) continue;
        const flac = await this.o.remoto.bajarAudio(remoto.id, bufferId);
        if (flac) await this.o.local.guardarAudio(bufferId, await this.decodificar(flac));
      }
      const nombre = remoto.dispositivo?.nombre || 'otro dispositivo';
      const otra = copiaDeLaPerdedora(remoto.proyecto, nombre, this.reloj(), this.nuevoId);
      await this.o.local.guardarProyecto(otra);
      this.estado.cola = encolar(this.estado.cola, claveDeProyecto(otra.id), this.reloj());
    }
    // A partir de aquí la de la nube cuenta como base: lo que queda es una subida normal.
    this.estado.base[local.id] = remoto.updatedAt;
    if (this.cambioAbierta?.id === local.id) this.cambioAbierta = null;
  }

  /* ---------------------------------------------------------------- */
  /* Subir: la cola                                                    */
  /* ---------------------------------------------------------------- */

  private quitarTimer(): void {
    if (this.o.temporizador) this.o.temporizador.quitar(this.timer);
    else clearTimeout(this.timer as ReturnType<typeof setTimeout>);
    this.timer = null;
  }

  private programar(ms?: number): void {
    if (this.parado) return;
    if (this.timer !== null) this.quitarTimer();
    const espera = ms ?? proximaEspera(this.estado.cola, this.reloj());
    if (espera === null) return;
    const fn = () => {
      this.timer = null;
      void this.bombear();
    };
    this.timer = this.o.temporizador ? this.o.temporizador.poner(fn, espera + 20) : setTimeout(fn, espera + 20);
  }

  /** Atiende la cola hasta vaciarla o hasta que falte la red. */
  async bombear(): Promise<void> {
    if (this.bombeando || this.parado) return;
    this.bombeando = true;
    let esperarOcupado = false;
    try {
      while (!this.parado && this.enLinea()) {
        if (this.o.grabando?.()) {
          esperarOcupado = true;
          break;
        }
        const entrada = siguiente(this.estado.cola, this.reloj());
        if (!entrada) break;
        try {
          await this.enSerie(() => this.conTrabajo(() => this.atender(entrada.clave)));
          this.estado.cola = hecha(this.estado.cola, entrada.clave, entrada.version);
          this.ultimoError = null;
        } catch (error) {
          const tipo = this.fallo(error);
          this.estado.cola = fallida(this.estado.cola, entrada.clave, this.reloj(), this.ultimoError?.texto ?? '');
          if (tipo === 'red') break;
        } finally {
          this.guardar();
          this.emitir();
        }
      }
    } finally {
      this.bombeando = false;
      this.emitir();
      this.programar(esperarOcupado ? ESPERA_SI_OCUPADO_MS : undefined);
    }
  }

  private async atender(clave: string): Promise<void> {
    if (clave === CLAVE_CEREBRO) return this.ponerAlDiaElCerebro();
    const id = idDeClave(clave);
    if (!id) return;
    const local = await this.o.local.leerProyecto(id);
    const remoto = await this.o.remoto.leerProyecto(id);
    const accion = decidir(
      local && versionLocal(local),
      this.estado.borrados[id] ?? null,
      remoto && versionRemota(remoto),
      this.estado.base[id],
    );
    const cambio = await this.aplicar(id, accion, local, remoto, 'cola');
    if (cambio) this.o.alCambiarIdeas?.();
  }

  /** Primero los audios que falten en su carpeta, después el documento. */
  private async subir(proyecto: Project): Promise<void> {
    const buffers = buffersDe(proyecto);
    const yaEstan = new Set(buffers.length ? await this.o.remoto.listarAudios(proyecto.id) : []);
    const faltan = buffers.filter((b) => !yaEstan.has(b));
    if (faltan.length) this.emitir({ subiendo: { hechos: 0, total: faltan.length } });
    try {
      for (const [i, bufferId] of faltan.entries()) {
        const audio = await this.o.local.leerAudio(bufferId);
        // Si no está aquí no hay nada que subir: se perdió antes de que existiera la nube.
        if (audio) {
          const flac = await this.codificar(audio);
          await this.o.remoto.subirAudio(proyecto.id, bufferId, flac, {
            sampleRate: audio.sampleRate,
            canales: audio.canales,
            muestras: audio.muestras,
          });
        }
        this.emitir({ subiendo: { hechos: i + 1, total: faltan.length } });
      }
    } finally {
      this.emitir({ subiendo: null });
    }
    await this.o.remoto.escribirProyecto(proyecto, buffers, this.o.dispositivo);
    this.estado.base[proyecto.id] = proyecto.updatedAt;
    delete this.estado.borrados[proyecto.id];
  }

  private async subirBorrado(id: string): Promise<void> {
    const en = this.estado.borrados[id] ?? this.reloj();
    await this.o.remoto.escribirBorrado(id, en, this.o.dispositivo);
    delete this.estado.borrados[id];
    delete this.estado.base[id];
  }

  /* ---------------------------------------------------------------- */
  /* El cerebro                                                        */
  /* ---------------------------------------------------------------- */

  private async ponerAlDiaElCerebro(): Promise<void> {
    const remoto = await this.o.remoto.leerCerebro();
    const local = this.o.local.leerCerebro();
    const deLaNube = remoto?.cerebro ?? cerebroVacio();
    const juntos = fusionarCerebros(this.estado.cerebroBase, local, deLaNube);
    if (!mismoCerebro(juntos, local)) this.o.local.guardarCerebro(juntos);
    const vacio = mismoCerebro(juntos, cerebroVacio());
    if ((remoto || !vacio) && !mismoCerebro(juntos, deLaNube)) {
      await this.o.remoto.escribirCerebro(juntos, this.o.dispositivo);
    }
    this.estado.cerebroBase = juntos;
  }

  /* ---------------------------------------------------------------- */
  /* La idea abierta cambió en otro dispositivo                        */
  /* ---------------------------------------------------------------- */

  /** «Cargar»: la de la nube pasa a ser la abierta. Lo tuyo, si tenía tomas nuevas, queda como copia. */
  cargarLaDeLaNube(): Promise<void> {
    const pendiente = this.cambioAbierta;
    if (!pendiente) return Promise.resolve();
    return this.enSerie(() =>
      this.conTrabajo(async () => {
        const remoto = (await this.o.remoto.leerProyecto(pendiente.id)) ?? pendiente;
        const local = await this.o.local.leerProyecto(pendiente.id);
        this.cambioAbierta = null;
        if (!remoto.proyecto) return;
        const copia = !!local && tieneAudiosPropios(versionLocal(local), versionRemota(remoto));
        if (local) await this.ganaLaDeLaNube(local, remoto, copia);
        else await this.bajarDocumento(remoto);
        this.guardar();
        this.o.alCambiarIdeas?.();
        void Promise.resolve(this.o.alRecargarAbierta?.(remoto.id)).catch(() => undefined);
      }),
    ).finally(() => void this.bombear());
  }

  /** «Seguir con la mía»: la de aquí gana; la de la nube, si tenía tomas nuevas, queda como copia. */
  quedarmeConLaMia(): Promise<void> {
    const pendiente = this.cambioAbierta;
    if (!pendiente) return Promise.resolve();
    return this.enSerie(() =>
      this.conTrabajo(async () => {
        const remoto = (await this.o.remoto.leerProyecto(pendiente.id)) ?? pendiente;
        const local = await this.o.local.leerProyecto(pendiente.id);
        this.cambioAbierta = null;
        if (!local) return;
        const copia = !!remoto.proyecto && tieneAudiosPropios(versionRemota(remoto), versionLocal(local));
        await this.ganaLaDeAqui(local, remoto, copia);
        // Aunque no la hayas tocado: la tuya tiene que llegar a la nube para ganar.
        await this.o.local.guardarProyecto({ ...local, updatedAt: Math.max(this.reloj(), remoto.updatedAt + 1) });
        this.estado.cola = encolar(this.estado.cola, claveDeProyecto(local.id), this.reloj());
        this.guardar();
        if (copia) this.o.alCambiarIdeas?.();
      }),
    ).finally(() => void this.bombear());
  }

  /* ---------------------------------------------------------------- */
  /* Bajar audio al abrir una idea                                     */
  /* ---------------------------------------------------------------- */

  /**
   * Baja lo que falte del audio de una idea. Devuelve cuántos audios faltaban
   * (0: no había nada que bajar). Nunca lanza: si no se puede, la idea se
   * abre igual y esas pistas suenan cuando llegue.
   */
  async asegurarAudio(proyecto: Project, alEmpezar?: () => void): Promise<number> {
    if (this.parado) return 0;
    const faltan: string[] = [];
    for (const bufferId of buffersDe(proyecto)) {
      if (!(await this.o.local.tieneAudio(bufferId))) faltan.push(bufferId);
    }
    if (!faltan.length) return 0;
    if (!this.enLinea()) {
      this.emitir();
      return faltan.length;
    }
    alEmpezar?.();
    this.bajadas++;
    this.emitir();
    try {
      const pendientes = [...faltan];
      const trabajador = async () => {
        for (let bufferId = pendientes.shift(); bufferId; bufferId = pendientes.shift()) {
          const flac = await this.o.remoto.bajarAudio(proyecto.id, bufferId);
          if (flac) await this.o.local.guardarAudio(bufferId, await this.decodificar(flac));
        }
      };
      await Promise.all(Array.from({ length: Math.min(BAJADAS_EN_PARALELO, faltan.length) }, trabajador));
      if (this.ultimoError?.tipo === 'cors') this.ultimoError = null;
    } catch (error) {
      this.fallo(error, true);
    } finally {
      this.bajadas--;
      this.emitir();
    }
    return faltan.length;
  }

  /* ---------------------------------------------------------------- */
  /* Limpieza del audio viejo en la nube                               */
  /* ---------------------------------------------------------------- */

  /**
   * Una vez al día: los audios que no usa ninguna idea (de aquí ni de la nube)
   * se apuntan y, si siguen sin uso a los 30 días, se borran. Las ideas
   * borradas pierden su audio también a los 30 días.
   */
  limpiar(): Promise<void> {
    return this.enSerie(async () => {
      // Con subidas pendientes se deja para otra vuelta: una carpeta a medio subir parece llena de huérfanos.
      if (this.parado || !this.enLinea() || this.estado.cola.some((e) => e.clave !== CLAVE_CEREBRO)) return;
      const ahora = this.reloj();
      try {
        const remotos = await this.o.remoto.listarProyectos(null);
        const locales = await this.o.local.listarProyectos();
        const enUso = new Set<string>();
        for (const p of locales) for (const b of buffersDe(p)) enUso.add(b);
        for (const r of remotos) if (!r.borrado) for (const b of r.buffers) enUso.add(b);
        for (const r of remotos) {
          if (r.borrado) {
            if (!sePuedeVaciar(r, ahora)) continue;
            for (const b of await this.o.remoto.listarAudios(r.id)) await this.o.remoto.borrarAudio(r.id, b);
            await this.o.remoto.marcarLimpieza(r.id, {}, true);
            continue;
          }
          const carpeta = await this.o.remoto.listarAudios(r.id);
          const limpieza = decidirLimpieza(carpeta, enUso, r.huerfanos, ahora);
          for (const b of limpieza.borrar) await this.o.remoto.borrarAudio(r.id, b);
          if (limpieza.cambia) await this.o.remoto.marcarLimpieza(r.id, limpieza.huerfanos);
        }
        this.estado.ultimaLimpieza = ahora;
        this.guardar();
      } catch (error) {
        // La limpieza no corre prisa: sin avisar, se intenta otro día.
        if (typeof console !== 'undefined') console.warn('[nube] limpieza', error);
      }
    });
  }
}
