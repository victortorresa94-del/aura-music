/**
 * El grafo de mezcla: una sola función que monta lo mismo para escuchar
 * (AudioContext) y para exportar (OfflineAudioContext). Así el WAV suena
 * exactamente como lo que se oye: no hay una segunda copia de la mezcla que
 * se pueda quedar atrás, como le pasaba al limitador de `renderMix`.
 *
 * Por pista:
 *   recorte → graves (lowshelf) → medios (peaking) → agudos (highshelf)
 *   → compresor → compensación → saturación (tanh, ×2) → panorama → fader
 * y, después del fader, dos envíos a buses compartidos por todas las pistas:
 *   reverb: un ConvolverNode con una sala generada por código (sala.ts)
 *   eco:    retardo a tempo con realimentación y paso bajo
 * Todo acaba en el master: volumen → limitador → salida.
 *
 * Los cambios mientras suena van con `setTargetAtTime`, que llega al valor
 * en curva y no da clics. La reverb no es un parámetro: al cambiar de sala
 * se monta otra y se funden las dos en 80 ms.
 */

import type { Project, Track } from '../types';
import {
  BANDAS,
  curvaSaturacion,
  ECO_MAX_SEGUNDOS,
  gananciaDeEnvio,
  indiceDelPico,
  MARGEN_SATURACION,
  parametrosCompresor,
  segundosDeEco,
} from './efectos';
import { respuestaGuardada, RETORNO_DB } from './sala';
import { masterDe, mezclaDe, type AjustesMaster, type MezclaPista } from './tipos';

export interface PistaEnMezcla {
  id: string;
  /** 1 si la toma es mono (casi todas), 2 si es un fichero estéreo importado. */
  canales: number;
  volumen: number;
  /** Ya resueltos el mute y el solo. */
  suena: boolean;
  mezcla: MezclaPista;
}

export interface EstadoMezcla {
  pistas: PistaEnMezcla[];
  master: AjustesMaster;
  bpm: number;
}

/** Con algún solo puesto suenan solo esas; si no, todas menos las silenciadas. */
export function pistasQueSuenan(tracks: readonly Track[]): Set<string> {
  const haySolo = tracks.some((t) => t.soloed);
  return new Set(tracks.filter((t) => (haySolo ? t.soloed : !t.muted)).map((t) => t.id));
}

/**
 * Lo que el grafo necesita saber del proyecto. `soloEstas` deja fuera el
 * resto (exportar pistas sueltas): una pista suelta suena con su cadena y
 * sus envíos, como en la mezcla, pero sin las demás.
 */
export function estadoDeMezcla(
  project: Project,
  canalesDe: (track: Track) => number,
  soloEstas?: readonly Track[],
): EstadoMezcla {
  const suenan = soloEstas ? new Set(soloEstas.map((t) => t.id)) : pistasQueSuenan(project.tracks);
  const pistas = (soloEstas ?? project.tracks).map((t) => ({
    id: t.id,
    canales: canalesDe(t),
    volumen: t.volume,
    suena: suenan.has(t.id),
    mezcla: mezclaDe(t),
  }));
  return { pistas, master: masterDe(project), bpm: project.bpm };
}

/** El limitador de siempre (antes vivía copiado en `buildContext` y en `renderMix`). */
const LIMITADOR = { umbral: -3, rodilla: 6, ratio: 12, ataque: 0.003, relajacion: 0.2 } as const;

/** Lo que se tarda en llegar a un valor nuevo: rápido, pero sin clic. */
const TAU = 0.015;
const TAU_FILTRO = 0.03;
const FUNDIDO_REVERB = 0.08;

interface Cadena {
  entrada: GainNode;
  graves: BiquadFilterNode;
  medios: BiquadFilterNode;
  agudos: BiquadFilterNode;
  compresor: DynamicsCompressorNode;
  compensacion: GainNode;
  pre: GainNode;
  saturacion: WaveShaperNode;
  panorama: StereoPannerNode;
  fader: GainNode;
  envioReverb: GainNode;
  envioEco: GainNode;
  medidor: AnalyserNode | null;
  /** Lo último que se le ha mandado a cada parámetro, para no repetirlo. */
  hecho: Map<string, number>;
  canales: number;
}

interface Reverb {
  convolver: ConvolverNode;
  nivel: GainNode;
  clave: string;
}

export interface OpcionesGrafo {
  /** Dónde acaba el master: `ctx.destination`. */
  salida: AudioNode;
  /** Analizadores para los medidores. En la exportación sobran. */
  medidores?: boolean;
}

export class GrafoMezcla {
  /** El bus del master: aquí entran las pistas, los retornos y el ritmo. */
  readonly entrada: GainNode;
  /** Segundos que tarda una pista en atravesar su cadena (ver `medirLatenciaDeCadena`). */
  latencia = LATENCIA_SUPUESTA;

  private readonly volumenMaster: GainNode;
  private readonly limitador: DynamicsCompressorNode;
  private readonly medidoresMaster: [AnalyserNode, AnalyserNode] | null = null;
  private readonly hechoMaster = new Map<string, number>();
  private readonly cadenas = new Map<string, Cadena>();

  private readonly reverbEntrada: GainNode;
  private readonly reverbSalida: GainNode;
  private reverb: Reverb | null = null;
  private reverbPendiente: number | null = null;

  private readonly ecoEntrada: GainNode;
  private readonly ecoRetardo: DelayNode;
  private readonly ecoRealimentacion: GainNode;

  private readonly curvas = new Map<number, Float32Array<ArrayBuffer>>();

  constructor(
    private readonly ctx: BaseAudioContext,
    private readonly opciones: OpcionesGrafo,
  ) {
    const c = ctx;
    this.entrada = c.createGain();
    this.volumenMaster = c.createGain();
    this.limitador = c.createDynamicsCompressor();
    this.entrada.connect(this.volumenMaster);
    this.volumenMaster.connect(this.limitador);
    this.limitador.connect(opciones.salida);
    this.ajustarLimitador(true, true);

    if (opciones.medidores) {
      const separa = c.createChannelSplitter(2);
      const izq = c.createAnalyser();
      const der = c.createAnalyser();
      izq.fftSize = der.fftSize = 2048;
      this.limitador.connect(separa);
      separa.connect(izq, 0);
      separa.connect(der, 1);
      this.medidoresMaster = [izq, der];
    }

    // Bus de reverb: la sala se pone en el primer `sincronizar`.
    this.reverbEntrada = c.createGain();
    this.reverbSalida = c.createGain();
    this.reverbSalida.connect(this.entrada);

    // Bus de eco: retardo → paso alto → paso bajo, y de ahí vuelve al retardo.
    // Cada repetición sale más oscura y más fina, como una cinta.
    this.ecoEntrada = c.createGain();
    this.ecoRetardo = c.createDelay(ECO_MAX_SEGUNDOS + 0.1);
    const pasoAlto = c.createBiquadFilter();
    pasoAlto.type = 'highpass';
    pasoAlto.frequency.value = 180;
    const pasoBajo = c.createBiquadFilter();
    pasoBajo.type = 'lowpass';
    pasoBajo.frequency.value = 3400;
    pasoBajo.Q.value = 0.5;
    this.ecoRealimentacion = c.createGain();
    this.ecoEntrada.connect(this.ecoRetardo);
    this.ecoRetardo.connect(pasoAlto);
    pasoAlto.connect(pasoBajo);
    pasoBajo.connect(this.ecoRealimentacion);
    this.ecoRealimentacion.connect(this.ecoRetardo);
    pasoBajo.connect(this.entrada);
  }

  /* ---------------------------------------------------------------- */
  /* Consultas                                                         */
  /* ---------------------------------------------------------------- */

  /** Dónde se enchufan las fuentes de una pista. */
  entradaDe(id: string): AudioNode | null {
    return this.cadenas.get(id)?.entrada ?? null;
  }

  medidorDe(id: string): AnalyserNode | null {
    return this.cadenas.get(id)?.medidor ?? null;
  }

  get medidorMaster(): [AnalyserNode, AnalyserNode] | null {
    return this.medidoresMaster;
  }

  /* ---------------------------------------------------------------- */
  /* Aplicar el estado                                                 */
  /* ---------------------------------------------------------------- */

  /**
   * Pone el grafo como dice el estado: crea las cadenas que falten, quita
   * las de pistas borradas y mueve los parámetros que hayan cambiado. Con
   * `inmediato` los valores entran de golpe (para exportar, y para una
   * cadena recién creada, que no tiene que subir desde cero).
   */
  sincronizar(estado: EstadoMezcla, inmediato = false) {
    const vivas = new Set<string>();
    for (const pista of estado.pistas) {
      vivas.add(pista.id);
      let cadena = this.cadenas.get(pista.id);
      let nueva = false;
      if (!cadena || cadena.canales !== pista.canales) {
        if (cadena) this.quitarCadena(pista.id);
        cadena = this.crearCadena(pista.canales);
        this.cadenas.set(pista.id, cadena);
        nueva = true;
      }
      this.aplicarPista(cadena, pista, inmediato || nueva);
    }
    for (const id of [...this.cadenas.keys()]) if (!vivas.has(id)) this.quitarCadena(id);
    this.aplicarMaster(estado, inmediato);
  }

  /** Solo el fader de una pista, para arrastrar sin pasar por todo lo demás. */
  volumenEnVivo(id: string, volumen: number, suena = true) {
    const cadena = this.cadenas.get(id);
    if (cadena) this.poner(cadena.hecho, 'fader', cadena.fader.gain, suena ? volumen : 0, TAU, false);
  }

  desmontar() {
    if (this.reverbPendiente != null) clearTimeout(this.reverbPendiente);
    for (const id of [...this.cadenas.keys()]) this.quitarCadena(id, true);
    for (const nodo of [this.entrada, this.volumenMaster, this.limitador, this.reverbSalida, this.ecoEntrada]) {
      try {
        nodo.disconnect();
      } catch {
        /* ya desconectado */
      }
    }
  }

  /* ---------------------------------------------------------------- */
  /* Por dentro                                                        */
  /* ---------------------------------------------------------------- */

  private poner(hecho: Map<string, number>, clave: string, param: AudioParam, valor: number, tau: number, inmediato: boolean) {
    if (hecho.get(clave) === valor) return;
    hecho.set(clave, valor);
    const ahora = this.ctx.currentTime;
    if (inmediato) {
      param.cancelScheduledValues(ahora);
      param.setValueAtTime(valor, ahora);
    } else {
      param.setTargetAtTime(valor, ahora, tau);
    }
  }

  private curva(cantidad: number): Float32Array<ArrayBuffer> {
    // Se redondea al 1 %: más finura no se oye y así la curva se reutiliza.
    const clave = Math.round(cantidad * 100);
    let curva = this.curvas.get(clave);
    if (!curva) {
      curva = curvaSaturacion(clave / 100);
      this.curvas.set(clave, curva);
    }
    return curva;
  }

  private crearCadena(canales: number): Cadena {
    const c = this.ctx;
    const entrada = c.createGain();
    /* Una toma mono que entra en un StereoPannerNode sale a −3 dB por canal
       en el centro (ley de igual potencia). Antes del mezclador una pista
       mono sonaba igual en los dos lados, a 0 dB: los √2 de aquí la dejan
       como estaba, y al panear la potencia total no cambia. */
    entrada.gain.value = canales === 1 ? Math.SQRT2 : 1;

    const banda = (tipo: BiquadFilterType, frecuencia: number, q?: number) => {
      const f = c.createBiquadFilter();
      f.type = tipo;
      f.frequency.value = frecuencia;
      if (q) f.Q.value = q;
      f.gain.value = 0;
      return f;
    };
    const graves = banda('lowshelf', BANDAS.graves.frecuencia);
    const medios = banda('peaking', BANDAS.medios.frecuencia, BANDAS.medios.q);
    const agudos = banda('highshelf', BANDAS.agudos.frecuencia);

    const compresor = c.createDynamicsCompressor();
    const compensacion = c.createGain();
    const pre = c.createGain();
    pre.gain.value = 1 / MARGEN_SATURACION;
    if (canales === 1) {
      /* El compresor de Chrome saca siempre dos canales, aunque le entre una
         toma mono. Sin esto el panorama recibía «estéreo» (L = R) y no
         aplicaba la ley de igual potencia: la pista sonaba 3 dB más alta
         que antes del mezclador y al panearla subía otros 3. Aquí vuelve a
         ser mono (la media de L y R, que son iguales) antes de saturar y
         panear. En Safari, donde ya era mono, no cambia nada. */
      pre.channelCount = 1;
      pre.channelCountMode = 'explicit';
      pre.channelInterpretation = 'speakers';
    }
    const saturacion = c.createWaveShaper();
    saturacion.curve = this.curva(0);
    // Siempre a ×2, también con la curva recta: así la latencia de la
    // cadena no cambia al tocar la saturación y se puede compensar.
    saturacion.oversample = '2x';
    const panorama = c.createStereoPanner();
    const fader = c.createGain();
    const envioReverb = c.createGain();
    const envioEco = c.createGain();
    envioReverb.gain.value = 0;
    envioEco.gain.value = 0;

    entrada.connect(graves);
    graves.connect(medios);
    medios.connect(agudos);
    agudos.connect(compresor);
    compresor.connect(compensacion);
    compensacion.connect(pre);
    pre.connect(saturacion);
    saturacion.connect(panorama);
    panorama.connect(fader);
    fader.connect(this.entrada);
    fader.connect(envioReverb);
    fader.connect(envioEco);
    envioReverb.connect(this.reverbEntrada);
    envioEco.connect(this.ecoEntrada);

    let medidor: AnalyserNode | null = null;
    if (this.opciones.medidores) {
      medidor = c.createAnalyser();
      medidor.fftSize = 2048;
      fader.connect(medidor);
    }

    return {
      entrada,
      graves,
      medios,
      agudos,
      compresor,
      compensacion,
      pre,
      saturacion,
      panorama,
      fader,
      envioReverb,
      envioEco,
      medidor,
      hecho: new Map(),
      canales,
    };
  }

  private aplicarPista(cadena: Cadena, pista: PistaEnMezcla, inmediato: boolean) {
    const m = pista.mezcla;
    const h = cadena.hecho;
    this.poner(h, 'fader', cadena.fader.gain, pista.suena ? pista.volumen : 0, TAU, inmediato);
    this.poner(h, 'panorama', cadena.panorama.pan, m.panorama, TAU, inmediato);
    this.poner(h, 'graves', cadena.graves.gain, m.graves, TAU_FILTRO, inmediato);
    this.poner(h, 'medios', cadena.medios.gain, m.medios, TAU_FILTRO, inmediato);
    this.poner(h, 'agudos', cadena.agudos.gain, m.agudos, TAU_FILTRO, inmediato);

    const comp = parametrosCompresor(m.compresor);
    this.poner(h, 'umbral', cadena.compresor.threshold, comp.umbral, TAU_FILTRO, inmediato);
    this.poner(h, 'rodilla', cadena.compresor.knee, comp.rodilla, TAU_FILTRO, inmediato);
    this.poner(h, 'ratio', cadena.compresor.ratio, comp.ratio, TAU_FILTRO, inmediato);
    this.poner(h, 'ataque', cadena.compresor.attack, comp.ataque, TAU_FILTRO, inmediato);
    this.poner(h, 'relajacion', cadena.compresor.release, comp.relajacion, TAU_FILTRO, inmediato);
    this.poner(h, 'compensacion', cadena.compensacion.gain, comp.compensacion, TAU_FILTRO, inmediato);

    // La curva no es un parámetro: cambia de golpe, pero de un 1 % al
    // siguiente la diferencia no se oye.
    const clave = Math.round(m.saturacion * 100);
    if (h.get('saturacion') !== clave) {
      h.set('saturacion', clave);
      cadena.saturacion.curve = this.curva(m.saturacion);
    }

    this.poner(h, 'reverb', cadena.envioReverb.gain, gananciaDeEnvio(m.reverb), TAU, inmediato);
    this.poner(h, 'eco', cadena.envioEco.gain, gananciaDeEnvio(m.eco), TAU, inmediato);
  }

  private quitarCadena(id: string, yaMismo = false) {
    const cadena = this.cadenas.get(id);
    if (!cadena) return;
    this.cadenas.delete(id);
    const soltar = () => {
      for (const nodo of [cadena.entrada, cadena.fader, cadena.envioReverb, cadena.envioEco, cadena.medidor]) {
        try {
          nodo?.disconnect();
        } catch {
          /* ya desconectado */
        }
      }
    };
    if (yaMismo) {
      soltar();
      return;
    }
    // Si la pista sonaba al borrarla, se apaga en curva antes de soltarla.
    cadena.fader.gain.setTargetAtTime(0, this.ctx.currentTime, TAU);
    setTimeout(soltar, 150);
  }

  private ajustarLimitador(activo: boolean, inmediato: boolean) {
    const l = this.limitador;
    const h = this.hechoMaster;
    // Apagado = ratio 1 y umbral 0: el nodo sigue ahí (no cambia la latencia
    // ni hay que reconectar nada) pero no toca la señal.
    this.poner(h, 'l-umbral', l.threshold, activo ? LIMITADOR.umbral : 0, TAU_FILTRO, inmediato);
    this.poner(h, 'l-rodilla', l.knee, activo ? LIMITADOR.rodilla : 0, TAU_FILTRO, inmediato);
    this.poner(h, 'l-ratio', l.ratio, activo ? LIMITADOR.ratio : 1, TAU_FILTRO, inmediato);
    this.poner(h, 'l-ataque', l.attack, LIMITADOR.ataque, TAU_FILTRO, inmediato);
    this.poner(h, 'l-relajacion', l.release, LIMITADOR.relajacion, TAU_FILTRO, inmediato);
  }

  private aplicarMaster(estado: EstadoMezcla, inmediato: boolean) {
    const m = estado.master;
    const h = this.hechoMaster;
    this.poner(h, 'volumen', this.volumenMaster.gain, m.volumen, TAU, inmediato);
    this.ajustarLimitador(m.limitador, inmediato);
    this.poner(h, 'eco-tiempo', this.ecoRetardo.delayTime, segundosDeEco(estado.bpm, m.division), 0.06, inmediato);
    this.poner(h, 'eco-vuelta', this.ecoRealimentacion.gain, m.repeticiones, TAU, inmediato);
    // Una convolución de cinco segundos gasta móvil aunque le llegue
    // silencio: la sala no se monta hasta que alguna pista manda algo.
    if (this.reverb || estado.pistas.some((p) => p.mezcla.reverb > 0)) this.ponerReverb(m, inmediato);
  }

  /**
   * La sala de la reverb. Generarla cuesta unos milisegundos, así que
   * mientras arrastras el tamaño se espera a que pares un momento.
   */
  private ponerReverb(m: AjustesMaster, inmediato: boolean) {
    const clave = `${m.espacio}:${Math.round(m.tamano * 50)}`;
    if (this.reverb?.clave === clave) {
      if (this.reverbPendiente != null) {
        clearTimeout(this.reverbPendiente);
        this.reverbPendiente = null;
      }
      return;
    }
    if (inmediato || !this.reverb) {
      this.cambiarReverb(m, clave, true);
      return;
    }
    if (this.reverbPendiente != null) clearTimeout(this.reverbPendiente);
    this.reverbPendiente = setTimeout(() => {
      this.reverbPendiente = null;
      this.cambiarReverb(m, clave, false);
    }, 140) as unknown as number;
  }

  private cambiarReverb(m: AjustesMaster, clave: string, deGolpe: boolean) {
    const c = this.ctx;
    const canales = respuestaGuardada(m.espacio, m.tamano, c.sampleRate);
    const buffer = c.createBuffer(2, canales[0].length, c.sampleRate);
    buffer.copyToChannel(canales[0], 0);
    buffer.copyToChannel(canales[1], 1);
    const convolver = c.createConvolver();
    convolver.normalize = true;
    convolver.buffer = buffer;
    const nivel = c.createGain();
    this.reverbEntrada.connect(convolver);
    convolver.connect(nivel);
    nivel.connect(this.reverbSalida);

    const ahora = c.currentTime;
    const anterior = this.reverb;
    const retorno = 10 ** (RETORNO_DB[m.espacio] / 20);
    this.reverb = { convolver, nivel, clave };
    if (deGolpe || !anterior) {
      nivel.gain.setValueAtTime(retorno, ahora);
      if (anterior) this.soltarReverb(anterior, 0);
      return;
    }
    // Fundido cruzado: la sala nueva entra mientras la vieja se apaga, y la
    // cola que ya sonaba no se corta en seco.
    nivel.gain.setValueAtTime(0, ahora);
    nivel.gain.linearRampToValueAtTime(retorno, ahora + FUNDIDO_REVERB);
    anterior.nivel.gain.setValueAtTime(anterior.nivel.gain.value, ahora);
    anterior.nivel.gain.linearRampToValueAtTime(0, ahora + FUNDIDO_REVERB);
    this.soltarReverb(anterior, FUNDIDO_REVERB * 1000 + 60);
  }

  private soltarReverb(r: Reverb, ms: number) {
    const soltar = () => {
      try {
        this.reverbEntrada.disconnect(r.convolver);
      } catch {
        /* ya desconectado */
      }
      try {
        r.convolver.disconnect();
        r.nivel.disconnect();
      } catch {
        /* ya desconectado */
      }
    };
    if (ms <= 0) soltar();
    else setTimeout(soltar, ms);
  }
}

export function buildMixGraph(ctx: BaseAudioContext, opciones: OpcionesGrafo): GrafoMezcla {
  return new GrafoMezcla(ctx, opciones);
}

/* -------------------------------------------------------------------------- */
/* Latencia                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Lo que se supone mientras no se ha medido: los 6 ms que mira por delante
 * el compresor del navegador más un poco del sobremuestreo.
 */
export const LATENCIA_SUPUESTA = 0.0075;
const latencias = new Map<number, Promise<number>>();

/**
 * Cuánto tarda una pista en salir de su cadena. El compresor y la
 * saturación sobremuestreada retrasan la señal unos milisegundos; como
 * todas las pistas pasan por la misma cadena, el motor programa las fuentes
 * ese tanto antes y la toma suena donde está en la línea de tiempo (lo
 * mismo que hacen los DAW con la compensación de retardo). Se mide una vez
 * por frecuencia de muestreo con un impulso en un contexto sin sonido.
 */
export function medirLatenciaDeCadena(sampleRate: number): Promise<number> {
  const hay = latencias.get(sampleRate);
  if (hay) return hay;
  const medida = (async () => {
    try {
      const largo = 8192;
      const ctx = new OfflineAudioContext(1, largo, sampleRate);
      const impulso = ctx.createBuffer(1, 1, sampleRate);
      impulso.getChannelData(0)[0] = 0.5;
      const fuente = ctx.createBufferSource();
      fuente.buffer = impulso;
      const grafo = new GrafoMezcla(ctx, { salida: ctx.destination });
      grafo.sincronizar(
        {
          pistas: [{ id: 'impulso', canales: 1, volumen: 1, suena: true, mezcla: mezclaDe({}) }],
          // Sin limitador: aquí se mide la cadena de la pista, no el master.
          master: { ...masterDe({}), limitador: false },
          bpm: 120,
        },
        true,
      );
      // El master tiene su propio retardo (el limitador), igual para todo lo
      // que suena: se mide por separado y se resta.
      const base = new OfflineAudioContext(1, largo, sampleRate);
      const fuenteBase = base.createBufferSource();
      fuenteBase.buffer = impulso;
      const grafoBase = new GrafoMezcla(base, { salida: base.destination });
      grafoBase.sincronizar({ pistas: [], master: { ...masterDe({}), limitador: false }, bpm: 120 }, true);
      fuenteBase.connect(grafoBase.entrada);
      fuente.connect(grafo.entradaDe('impulso') as AudioNode);
      fuente.start(0);
      fuenteBase.start(0);
      const [conCadena, sinCadena] = await Promise.all([ctx.startRendering(), base.startRendering()]);
      const muestras = indiceDelPico(conCadena.getChannelData(0)) - indiceDelPico(sinCadena.getChannelData(0));
      return muestras > 0 && muestras < largo / 2 ? muestras / sampleRate : LATENCIA_SUPUESTA;
    } catch {
      return LATENCIA_SUPUESTA;
    }
  })();
  latencias.set(sampleRate, medida);
  return medida;
}
