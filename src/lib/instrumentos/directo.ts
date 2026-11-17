/**
 * El atril: los instrumentos enchufados al contexto de audio del estudio,
 * listos para sonar en cuanto apoyas el dedo.
 *
 * Nada de lo que pasa aquí toca el estado de React. Los pads, el teclado y
 * las tiras llaman a `tocar` desde su propio `pointerdown` nativo: entre el
 * dedo y el sonido solo hay un `start()` del Web Audio. Lo que se toca se
 * apunta siempre (la captura, para «Recuperar lo último») y, si se está
 * grabando, también en la toma.
 */

import type { EventoTocado } from './grabacion';
import { cargarPaquete, muestrasListas, type Progreso } from './muestras';
import { getPaquete, type PaqueteId } from './packs';
import { getInstrumento, type DefInstrumento } from './registro';
import type { NotaRasgueada, PasoAuto } from './acordes';
import { instanteDelToque } from './toque';
import type { InstrumentoId } from './tipos';
import { crearVoz, precalentar, type Voz } from './voz';

export type EstadoCarga = Progreso | 'lista' | 'error';

/** Cuánto se guarda en la captura: lo de los últimos diez minutos. */
const CAPTURA_SEGUNDOS = 600;
const CAPTURA_MAX = 4000;

export class Atril {
  private ctx: AudioContext | null = null;
  private bus: GainNode | null = null;
  private voces = new Map<InstrumentoId, Voz>();
  private enfriar = new Map<InstrumentoId, () => void>();
  private toma: EventoTocado[] | null = null;
  private auto: AutoAcordes | null = null;

  /** Todo lo tocado desde la última toma grabada (o recuperada). */
  captura: EventoTocado[] = [];
  /** Estado de la descarga de muestras de cada paquete. */
  cargas = new Map<PaqueteId, EstadoCarga>();
  /**
   * Convierte un instante del reloj de audio en posición de la línea de
   * tiempo mientras suena el transporte; null si está parado.
   */
  posicion: ((t: number) => number) | null = null;
  /** La calibración del toque, en ms (se resta a cada golpe). */
  toqueMs = 0;
  /** Avisa a la pantalla de cambios que sí se ven: cargas, captura. */
  alCambiar: (() => void) | null = null;

  constructor(private readonly obtenerContexto: () => AudioContext) {}

  /* ------------------------------------------------------------------ */
  /* Contexto y voces                                                    */
  /* ------------------------------------------------------------------ */

  /**
   * El contexto del estudio, desbloqueado. Si iOS lo ha rehecho (una
   * llamada, otra app), se rehacen el bus y las voces con él.
   */
  private asegurar(): { ctx: AudioContext; bus: GainNode } {
    const ctx = this.obtenerContexto();
    if (ctx !== this.ctx || !this.bus) {
      for (const voz of this.voces.values()) voz.dispose();
      this.voces.clear();
      // Un limitador suave: diez dedos en un piano suman más de 1.
      const bus = ctx.createGain();
      bus.gain.value = 0.9;
      const limitador = ctx.createDynamicsCompressor();
      limitador.threshold.value = -4;
      limitador.knee.value = 6;
      limitador.ratio.value = 10;
      limitador.attack.value = 0.002;
      limitador.release.value = 0.15;
      bus.connect(limitador);
      limitador.connect(ctx.destination);
      this.ctx = ctx;
      this.bus = bus;
    }
    return { ctx, bus: this.bus };
  }

  private voz(id: InstrumentoId): Voz {
    const { ctx, bus } = this.asegurar();
    const existente = this.voces.get(id);
    if (existente) return existente;
    const def = getInstrumento(id);
    const voz = crearVoz(def, ctx, bus, muestrasListas(def.paquete));
    this.voces.set(id, voz);
    if (!voz.conMuestras) this.cargarMuestras(def);
    return voz;
  }

  /**
   * Deja un instrumento listo antes del primer toque: se crea la voz, se
   * empiezan a bajar sus muestras y se calculan las notas sintetizadas de su
   * registro para que nada tenga que esperar al primer dedo.
   */
  preparar(id: InstrumentoId) {
    const voz = this.voz(id);
    const def = voz.def;
    if (!def.pads && !voz.conMuestras && !this.enfriar.has(id) && this.ctx) {
      const notas: number[] = [];
      for (let n = def.rango[0]; n <= def.rango[1]; n++) notas.push(n);
      // Primero las de alrededor de la base, que son las que se ven.
      notas.sort((a, b) => Math.abs(a - def.base - 6) - Math.abs(b - def.base - 6));
      this.enfriar.set(id, precalentar(def.sintesis, notas, this.ctx));
    }
  }

  private cargarMuestras(def: DefInstrumento) {
    const id = def.paquete;
    if (!id || !getPaquete(id) || !this.ctx) return;
    const estado = this.cargas.get(id);
    if (estado === 'lista' || (estado && estado !== 'error')) return;
    this.cargas.set(id, { cargadas: 0, total: getPaquete(id)?.archivos.length ?? 0 });
    this.alCambiar?.();
    cargarPaquete(id, this.ctx, (p) => {
      this.cargas.set(id, p);
      this.alCambiar?.();
    })
      .then(() => {
        this.cargas.set(id, 'lista');
        // Las voces sintéticas de ese paquete se cambian por las de verdad.
        // Lo que esté sonando se deja acabar: no se corta nada a medias.
        const cambiadas: InstrumentoId[] = [];
        for (const [instrumento, voz] of this.voces) {
          if (voz.def.paquete === id && !voz.conMuestras) {
            this.voces.delete(instrumento);
            cambiadas.push(instrumento);
          }
        }
        // La voz nueva se crea ya, no en el primer toque: crearla cuesta unos
        // milisegundos que no pueden caer entre el dedo y el sonido.
        for (const instrumento of cambiadas) this.voz(instrumento);
        this.alCambiar?.();
      })
      .catch(() => {
        this.cargas.set(id, 'error');
        this.alCambiar?.();
      });
  }

  /* ------------------------------------------------------------------ */
  /* Tocar                                                               */
  /* ------------------------------------------------------------------ */

  private apuntar(id: InstrumentoId, nota: number, vel: number, t: number): EventoTocado {
    const evento: EventoTocado = {
      instrumento: id,
      nota,
      vel,
      t,
      dur: null,
      pos: this.posicion ? this.posicion(t) : null,
    };
    const vacia = this.captura.length === 0;
    this.captura.push(evento);
    if (this.captura.length > CAPTURA_MAX || t - this.captura[0].t > CAPTURA_SEGUNDOS) {
      this.captura = this.captura.filter((e) => t - e.t <= CAPTURA_SEGUNDOS).slice(-CAPTURA_MAX);
    }
    this.toma?.push(evento);
    if (vacia) this.alCambiar?.();
    return evento;
  }

  /** El instante del toque en el reloj de audio, ya restada la calibración. */
  private instante(horaEvento?: number): number {
    const { ctx } = this.asegurar();
    return instanteDelToque(ctx, horaEvento) - this.toqueMs / 1000;
  }

  /**
   * Suena YA. `horaEvento` es el `timeStamp` del evento táctil: con él se
   * sabe qué estabas oyendo al tocar. Devuelve cómo soltar la nota.
   */
  tocar(id: InstrumentoId, nota: number, vel: number, horaEvento?: number): (horaSoltar?: number) => void {
    const voz = this.voz(id);
    const ctx = this.ctx as AudioContext;
    const soltar = voz.tocar(nota, vel, ctx.currentTime);
    const t = this.instante(horaEvento);
    const evento = this.apuntar(id, nota, vel, t);
    return (horaSoltar) => {
      soltar(ctx.currentTime);
      evento.dur = Math.max(0.03, this.instante(horaSoltar) - t);
    };
  }

  /** Un rasgueo entero: la primera cuerda ya, las demás según su desfase. */
  rasguear(id: InstrumentoId, notas: NotaRasgueada[], horaEvento?: number) {
    const voz = this.voz(id);
    const ctx = this.ctx as AudioContext;
    const ahora = ctx.currentTime;
    voz.ahogar(ahora);
    const t = this.instante(horaEvento);
    for (const n of notas) {
      voz.tocar(n.nota, n.vel, ahora + n.desfase);
      this.apuntar(id, n.nota, n.vel, t + n.desfase).dur = 0.5;
    }
  }

  /** Apaga lo que suene de un instrumento (soltar el acorde automático). */
  ahogar(id: InstrumentoId) {
    const voz = this.voces.get(id);
    if (voz && this.ctx) voz.ahogar(this.ctx.currentTime);
  }

  /* ------------------------------------------------------------------ */
  /* Toma y captura                                                      */
  /* ------------------------------------------------------------------ */

  empezarToma() {
    this.toma = [];
  }

  /** Cierra la toma y devuelve lo tocado. La captura empieza de cero. */
  terminarToma(): EventoTocado[] {
    const toma = this.toma ?? [];
    this.toma = null;
    this.vaciarCaptura();
    return toma;
  }

  get grabando(): boolean {
    return this.toma !== null;
  }

  vaciarCaptura() {
    const habia = this.captura.length > 0;
    this.captura = [];
    if (habia) this.alCambiar?.();
  }

  /* ------------------------------------------------------------------ */
  /* Acordes automáticos                                                 */
  /* ------------------------------------------------------------------ */

  /**
   * Arranca (o cambia de acorde) el modo automático: el patrón suena solo a
   * tu tempo hasta que lo paras. Si el transporte suena, va pegado a su
   * rejilla; si no, cuenta desde ya.
   */
  autoAcorde(o: {
    id: InstrumentoId;
    patron: PasoAuto[];
    pulsosPorCompas: number;
    bpm: number;
    notas: (paso: PasoAuto) => NotaRasgueada[];
  }) {
    const { ctx } = this.asegurar();
    if (this.auto && this.auto.id === o.id) {
      this.auto.cambiar(o.notas, o.patron, o.bpm);
      return;
    }
    this.pararAuto();
    this.auto = new AutoAcordes(this, ctx, o);
  }

  pararAuto() {
    if (!this.auto) return;
    this.auto.parar();
    this.ahogar(this.auto.id);
    this.auto = null;
  }

  get autoActivo(): InstrumentoId | null {
    return this.auto?.id ?? null;
  }

  /** Para el modo automático: suena en `cuando` y se apunta en ese instante exacto. */
  programar(id: InstrumentoId, notas: NotaRasgueada[], cuando: number, dur: number | undefined, ahogarAntes: boolean) {
    const voz = this.voz(id);
    if (ahogarAntes) voz.ahogar(cuando);
    for (const n of notas) {
      voz.tocar(n.nota, n.vel, cuando + n.desfase, dur);
      this.apuntar(id, n.nota, n.vel, cuando + n.desfase).dur = dur ?? 0.5;
    }
  }

  dispose() {
    this.pararAuto();
    for (const cancelar of this.enfriar.values()) cancelar();
    this.enfriar.clear();
    for (const voz of this.voces.values()) voz.dispose();
    this.voces.clear();
    try {
      this.bus?.disconnect();
    } catch {
      /* ya desconectado */
    }
    this.bus = null;
    this.ctx = null;
  }
}

/** El programador del modo automático: mira el reloj cada 25 ms y encola 120 ms. */
class AutoAcordes {
  readonly id: InstrumentoId;
  private timer: number;
  private origen: number;
  private hasta: number;
  private bpm: number;
  private pulsos: number;
  private patron: PasoAuto[];
  private notas: (paso: PasoAuto) => NotaRasgueada[];
  private readonly esGuitarra: boolean;

  constructor(
    private readonly atril: Atril,
    private readonly ctx: AudioContext,
    o: { id: InstrumentoId; patron: PasoAuto[]; pulsosPorCompas: number; bpm: number; notas: (paso: PasoAuto) => NotaRasgueada[] },
  ) {
    this.id = o.id;
    this.esGuitarra = getInstrumento(o.id).familia === 'guitarra';
    this.bpm = o.bpm;
    this.pulsos = o.pulsosPorCompas;
    this.patron = o.patron;
    this.notas = o.notas;
    const pulso = 60 / this.bpm;
    const ahora = ctx.currentTime;
    if (atril.posicion) {
      // Pegado a la rejilla del proyecto: el pulso 0 del proyecto cae en
      // t = -posicion(0) en el reloj de audio.
      this.origen = -atril.posicion(0);
      // Se empieza en el pulso siguiente, no a mitad de uno.
      const beatAhora = (ahora - this.origen) / pulso;
      this.hasta = Math.ceil(beatAhora - 0.05) * pulso + this.origen;
    } else {
      this.origen = ahora + 0.03;
      this.hasta = this.origen;
    }
    this.timer = window.setInterval(() => this.programar(), 25);
    this.programar();
  }

  cambiar(notas: (paso: PasoAuto) => NotaRasgueada[], patron: PasoAuto[], bpm: number) {
    this.notas = notas;
    this.patron = patron;
    this.bpm = bpm;
  }

  private programar() {
    const pulso = 60 / this.bpm;
    const horizonte = this.ctx.currentTime + 0.12;
    if (horizonte <= this.hasta) return;
    const compas = this.pulsos * pulso;
    const primerCompas = Math.floor((this.hasta - this.origen) / compas);
    const ultimoCompas = Math.floor((horizonte - this.origen) / compas);
    for (let c = primerCompas; c <= ultimoCompas; c++) {
      for (const paso of this.patron) {
        const cuando = this.origen + c * compas + paso.beat * pulso;
        if (cuando < this.hasta || cuando >= horizonte) continue;
        const dur = paso.dur !== undefined ? paso.dur * pulso : undefined;
        // Solo la guitarra apaga lo anterior: el piano y las cuerdas ya
        // traen la duración de cada nota.
        this.atril.programar(this.id, this.notas(paso), cuando, dur, this.esGuitarra);
      }
    }
    this.hasta = horizonte;
  }

  parar() {
    window.clearInterval(this.timer);
  }
}
