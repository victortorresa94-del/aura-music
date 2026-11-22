/**
 * Una «voz» es un instrumento enchufado a un contexto de audio: se le pide una
 * nota y suena. Hay cuatro clases, con la misma cara:
 *
 * - batería: muestras de verdad (capas, golpes alternos, charles que se
 *   cierra) para lo que traiga el paquete; lo que le falte, con la muestra
 *   de esa pieza en otro paquete (`percusion.ts`: al cajón, los bongós de la
 *   latina). La 808 y la 909 son síntesis (`rhythm/kit.ts`), a propósito;
 * - muestras: smplr (MIT) con las muestras ya decodificadas (`muestras.ts`);
 * - osciladores: síntesis con nodos que sostiene mientras pisas
 *   (`osciladores.ts`): sub, 808, analógico, órgano, pad, sinte...;
 * - síntesis en buffer: notas calculadas en TypeScript (`sinte.ts`) y
 *   guardadas: piano, piano eléctrico, colchón, bajo y cuerda pulsada.
 *
 * Sirve igual para el contexto en directo y para un OfflineAudioContext, que
 * es lo que garantiza que el WAV suene como lo que oíste al tocar.
 */

import { Instrument, type NoteEvent, type Scheduler, type SmplrPreset, type StopFn } from 'smplr';
import { sintetizarVoz } from '@/lib/daw/rhythm/kit';
import { tocarMuestra } from './percusion';
import { esTimbreOscilador, tocarOscilador, type TimbreOscilador } from './osciladores';
import { getPaquete, type Paquete } from './packs';
import { notasConMuestra, presetDe } from './preset';
import { padDe, type DefInstrumento } from './registro';
import { LARGO_NOTA, sintetizarNota, type TimbreSintetico } from './sinte';

export { presetDe } from './preset';

/** Suelta una nota que se dejó sonando (la tecla que se levanta). */
export type Soltar = (cuando?: number) => void;

export interface Voz {
  readonly def: DefInstrumento;
  /** true si suena con muestras; false si es la síntesis de reserva. */
  readonly conMuestras: boolean;
  /**
   * Hace sonar `nota` (MIDI) con fuerza `vel` (1..127) en el instante
   * `cuando` del contexto. Con `dur` (segundos) se suelta sola; sin ella,
   * suena hasta que se llame a lo que devuelve.
   */
  tocar(nota: number, vel: number, cuando: number, dur?: number): Soltar;
  /** Lo que tarda en estar lista para sonar (inmediato salvo con muestras). */
  readonly lista: Promise<void>;
  /**
   * Apaga lo que esté sonando en `cuando`, deprisa pero sin clic. Es la mano
   * que para las cuerdas antes del rasgueo siguiente: sin esto, cada acorde
   * se monta encima del anterior y la guitarra se emborrona.
   */
  ahogar(cuando: number): void;
  dispose(): void;
}

const nada: Soltar = () => undefined;

/** Fuerza MIDI a ganancia: curva suave, como responde un teclado de verdad. */
export function gananciaDeFuerza(vel: number): number {
  const v = Math.max(1, Math.min(127, vel)) / 127;
  return 0.06 + 0.94 * Math.pow(v, 1.6);
}

/* -------------------------------------------------------------------------- */
/* Muestras (smplr)                                                            */
/* -------------------------------------------------------------------------- */

/**
 * smplr programa lo que cae más allá de 200 ms con un setInterval que mira el
 * reloj del contexto. En un OfflineAudioContext ese reloj corre a toda
 * velocidad y el intervalo llega tarde: las notas se perderían. Con este
 * programador todo se entrega al momento, con su instante exacto, y es el
 * propio motor de audio quien espera.
 */
const programadorInmediato: Scheduler = {
  schedule(event: NoteEvent, callback: (event: NoteEvent) => void): StopFn {
    callback(event);
    return () => undefined;
  },
  stop() {
    /* no hay cola */
  },
};

const Muestreado = Instrument<{ preset: SmplrPreset; buffers: Map<string, AudioBuffer> }>((_ctx, opciones, smplr) =>
  smplr.loadInstrument(opciones.preset, { buffers: opciones.buffers }),
);

function instrumentoDeMuestras(paquete: Paquete, muestras: Map<string, AudioBuffer>, ctx: BaseAudioContext, destino: AudioNode) {
  return Muestreado(ctx, {
    preset: presetDe(paquete),
    buffers: muestras,
    destination: destino,
    scheduler: programadorInmediato,
    // Un acorde rasgueado y repetido, o un redoble, no puede acumular voces
    // sin fin en un móvil.
    maxVoices: paquete.percusion ? 40 : 48,
  });
}

function vozMuestreada(
  def: DefInstrumento,
  paquete: Paquete,
  muestras: Map<string, AudioBuffer>,
  ctx: BaseAudioContext,
  destino: AudioNode,
): Voz {
  const instrumento = instrumentoDeMuestras(paquete, muestras, ctx, destino);
  return {
    def,
    conMuestras: true,
    lista: instrumento.ready,
    tocar(nota, vel, cuando, dur) {
      const parar = instrumento.start({
        note: nota,
        velocity: Math.max(1, Math.min(127, Math.round(vel))),
        time: cuando,
        duration: dur ?? null,
      });
      return def.sostiene ? (momento) => parar(momento) : nada;
    },
    ahogar(cuando) {
      instrumento.stop({ time: cuando });
    },
    dispose() {
      instrumento.dispose();
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Batería                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Una batería: con muestras para las notas del paquete y, para el resto, la
 * muestra de esa pieza en otro paquete. Así el cajón tiene bongós, congas y
 * güiro de verdad aunque su paquete solo traiga el cajón y las palmas. Sin
 * paquete (la 808 y la 909), todo es síntesis: es su sonido.
 */
function vozDeBateria(
  def: DefInstrumento,
  ctx: BaseAudioContext,
  destino: AudioNode,
  paquete: Paquete | null,
  muestras: Map<string, AudioBuffer> | null | undefined,
): Voz {
  const conMuestras = !!(paquete && muestras && muestras.size > 0);
  const instrumento = conMuestras ? instrumentoDeMuestras(paquete as Paquete, muestras as Map<string, AudioBuffer>, ctx, destino) : null;
  const muestreadas = conMuestras ? notasConMuestra(paquete as Paquete) : new Set<number>();
  return {
    def,
    conMuestras,
    lista: instrumento ? instrumento.ready : Promise.resolve(),
    tocar(nota, vel, cuando) {
      if (instrumento && muestreadas.has(nota)) {
        instrumento.start({ note: nota, velocity: Math.max(1, Math.min(127, Math.round(vel))), time: cuando, duration: null });
        return nada;
      }
      const pad = padDe(def, nota);
      if (!pad) return nada;
      // Con paquete, la pieza que falta se busca grabada; si aún no está (o es
      // una caja de ritmos), se sintetiza.
      if (paquete && tocarMuestra(pad.voz, ctx, destino, cuando, Math.max(1, Math.min(127, vel)) / 127)) return nada;
      sintetizarVoz(pad.voz, ctx, destino, cuando, gananciaDeFuerza(vel));
      return nada;
    },
    ahogar() {
      /* un golpe de batería no se para */
    },
    dispose() {
      instrumento?.dispose();
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Osciladores                                                                 */
/* -------------------------------------------------------------------------- */

function vozDeOsciladores(def: DefInstrumento, timbre: TimbreOscilador, ctx: BaseAudioContext, destino: AudioNode): Voz {
  const sonando = new Map<number, { desde: number; soltar: (t?: number) => void }>();
  let siguiente = 0;
  return {
    def,
    conMuestras: false,
    lista: Promise.resolve(),
    tocar(nota, vel, cuando, dur) {
      const soltar = tocarOscilador(timbre, ctx, destino, nota, gananciaDeFuerza(vel), cuando, def.sostiene ? dur : undefined);
      const id = siguiente++;
      sonando.set(id, { desde: cuando, soltar });
      // Lo que ya se soltó se olvida pasado un rato: no hace falta guardarlo.
      if (sonando.size > 64) sonando.delete(sonando.keys().next().value as number);
      return def.sostiene
        ? (momento) => {
            soltar(momento);
            sonando.delete(id);
          }
        : nada;
    },
    ahogar(cuando) {
      for (const [id, { desde, soltar }] of sonando) {
        if (desde < cuando) {
          soltar(cuando);
          sonando.delete(id);
        }
      }
    },
    dispose() {
      for (const { soltar } of sonando.values()) soltar();
      sonando.clear();
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Síntesis en buffer                                                          */
/* -------------------------------------------------------------------------- */

/** Notas sintetizadas ya calculadas: el AudioBuffer no es de ningún contexto. */
const notasSinteticas = new Map<string, AudioBuffer>();

const CAPAS = [0.4, 0.72, 1] as const;
const capaDe = (vel: number) => (vel < 60 ? 0 : vel < 100 ? 1 : 2);

/** Constante de tiempo de la suelta al levantar el dedo. */
const SUELTA: Record<TimbreSintetico, number> = { piano: 0.09, epiano: 0.12, colchon: 0.28, bajo: 0.05, cuerda: 0.06 };

/**
 * La nota sintetizada, calculada la primera vez y guardada. Se normaliza el
 * pico para que todas las notas salgan igual de fuertes: la fuerza la pone
 * después la ganancia.
 */
export function bufferSintetico(timbre: TimbreSintetico, nota: number, vel: number, ctx: BaseAudioContext): AudioBuffer {
  const capa = capaDe(vel);
  const clave = `${timbre}:${nota}:${capa}`;
  const guardado = notasSinteticas.get(clave);
  if (guardado) return guardado;
  const datos = sintetizarNota(timbre, nota, CAPAS[capa], ctx.sampleRate);
  let pico = 1e-9;
  for (let i = 0; i < datos.length; i++) pico = Math.max(pico, Math.abs(datos[i]));
  const escala = 0.7 / pico;
  for (let i = 0; i < datos.length; i++) datos[i] *= escala;
  const buffer = ctx.createBuffer(1, Math.max(1, datos.length), ctx.sampleRate);
  buffer.getChannelData(0).set(datos);
  notasSinteticas.set(clave, buffer);
  return buffer;
}

/**
 * Calcula de antemano las notas que se van a tocar, poco a poco y sin
 * bloquear: así el primer toque de cada tecla no tiene que esperar a la
 * síntesis. Devuelve cómo cancelarlo.
 */
export function precalentar(timbre: TimbreSintetico, notas: number[], ctx: BaseAudioContext, vel = 96): () => void {
  let cancelado = false;
  const pendientes = [...notas];
  const paso = () => {
    if (cancelado) return;
    const limite = performance.now() + 8;
    while (pendientes.length && performance.now() < limite) {
      bufferSintetico(timbre, pendientes.shift() as number, vel, ctx);
    }
    if (pendientes.length) window.setTimeout(paso, 16);
  };
  window.setTimeout(paso, 0);
  return () => {
    cancelado = true;
  };
}

function vozSintetica(def: DefInstrumento, timbre: TimbreSintetico, ctx: BaseAudioContext, destino: AudioNode): Voz {
  const activas = new Set<AudioBufferSourceNode>();
  const soltadores = new Map<AudioBufferSourceNode, { desde: number; soltar: (t: number, tau: number) => void }>();
  return {
    def,
    conMuestras: false,
    lista: Promise.resolve(),
    tocar(nota, vel, cuando, dur) {
      const buffer = bufferSintetico(timbre, nota, vel, ctx);
      const fuente = ctx.createBufferSource();
      fuente.buffer = buffer;
      const ganancia = ctx.createGain();
      ganancia.gain.value = gananciaDeFuerza(vel);
      fuente.connect(ganancia);
      ganancia.connect(destino);
      fuente.start(cuando);
      activas.add(fuente);
      fuente.onended = () => {
        activas.delete(fuente);
        soltadores.delete(fuente);
        try {
          ganancia.disconnect();
        } catch {
          /* ya desconectada */
        }
      };
      let suelta = false;
      const cortar = (t: number, tau: number) => {
        if (suelta) return;
        suelta = true;
        ganancia.gain.setTargetAtTime(0, t, tau);
        try {
          fuente.stop(t + tau * 7);
        } catch {
          /* ya parada */
        }
      };
      soltadores.set(fuente, { desde: cuando, soltar: cortar });
      const soltar: Soltar = (momento) => cortar(Math.max(cuando, momento ?? ctx.currentTime), SUELTA[timbre]);
      if (dur !== undefined && def.sostiene) soltar(cuando + Math.min(dur, LARGO_NOTA[timbre]));
      return def.sostiene ? soltar : nada;
    },
    ahogar(cuando) {
      for (const { desde, soltar } of soltadores.values()) {
        if (desde < cuando) soltar(cuando, 0.018);
      }
    },
    dispose() {
      for (const fuente of activas) {
        try {
          fuente.stop();
        } catch {
          /* ya parada */
        }
      }
      activas.clear();
    },
  };
}

/* -------------------------------------------------------------------------- */
/* La fábrica                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Enchufa un instrumento a un contexto. Con `muestras` (ya decodificadas) y un
 * paquete válido suena con muestras; si no, con la síntesis de reserva.
 */
export function crearVoz(
  def: DefInstrumento,
  ctx: BaseAudioContext,
  destino: AudioNode,
  muestras?: Map<string, AudioBuffer> | null,
): Voz {
  const paquete = getPaquete(def.paquete);
  if (def.pads) return vozDeBateria(def, ctx, destino, paquete, muestras);
  if (paquete && muestras && muestras.size > 0) return vozMuestreada(def, paquete, muestras, ctx, destino);
  if (esTimbreOscilador(def.sintesis)) return vozDeOsciladores(def, def.sintesis, ctx, destino);
  return vozSintetica(def, def.sintesis, ctx, destino);
}

/** El timbre de buffer de un instrumento, si lo usa (para calcular sus notas antes). */
export function timbreDeBuffer(def: DefInstrumento): TimbreSintetico | null {
  return def.pads || esTimbreOscilador(def.sintesis) ? null : def.sintesis;
}
