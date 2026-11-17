/**
 * Una «voz» es un instrumento enchufado a un contexto de audio: se le pide una
 * nota y suena. Hay tres clases, con la misma cara:
 *
 * - batería: los golpes sintetizados del kit (`rhythm/kit.ts`);
 * - muestras: smplr (MIT) con las muestras ya decodificadas (`muestras.ts`);
 * - síntesis: notas calculadas en TypeScript (`sinte.ts`) y guardadas.
 *
 * Sirve igual para el contexto en directo y para un OfflineAudioContext, que
 * es lo que garantiza que el WAV suene como lo que oíste al tocar.
 */

import { Instrument, type NoteEvent, type Scheduler, type SmplrPreset, type StopFn } from 'smplr';
import { playVoice } from '@/lib/daw/rhythm/kit';
import { getPaquete, type Paquete } from './packs';
import { padDe, type DefInstrumento } from './registro';
import { LARGO_NOTA, sintetizarNota, type TimbreSintetico } from './sinte';
import { nombreDeMuestra } from './muestras';

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
/* Batería                                                                     */
/* -------------------------------------------------------------------------- */

function vozDeBateria(def: DefInstrumento, ctx: BaseAudioContext, destino: AudioNode): Voz {
  return {
    def,
    conMuestras: false,
    lista: Promise.resolve(),
    tocar(nota, vel, cuando) {
      const pad = padDe(def, nota);
      if (pad) playVoice(pad.voz, ctx, destino, cuando, gananciaDeFuerza(vel));
      return nada;
    },
    ahogar() {
      /* un golpe de batería no se para */
    },
    dispose() {
      /* las voces del kit se apagan solas */
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Síntesis                                                                    */
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

function vozSintetica(def: DefInstrumento, ctx: BaseAudioContext, destino: AudioNode): Voz {
  const timbre = def.sintesis;
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

/** El preset de smplr de un paquete: cada muestra cubre hasta medio camino de sus vecinas. */
export function presetDe(paquete: Paquete): SmplrPreset {
  const raices = [...new Set(paquete.archivos.map((a) => a.midi))].sort((a, b) => a - b);
  const rango = (midi: number): [number, number] => {
    const i = raices.indexOf(midi);
    const lo = i === 0 ? 0 : Math.floor((raices[i - 1] + midi) / 2) + 1;
    const hi = i === raices.length - 1 ? 127 : Math.floor((midi + raices[i + 1]) / 2);
    return [lo, hi];
  };
  const hayCapas = paquete.archivos.some((a) => a.capa);
  return {
    meta: { name: paquete.nombre, license: paquete.licencia, source: paquete.origen },
    samples: { baseUrl: `/samples/${paquete.id}`, formats: ['mp3'] },
    defaults: { ampAttack: paquete.sonido.ataque, ampRelease: paquete.sonido.suelta },
    groups: [
      {
        regions: paquete.archivos.map((archivo) => ({
          sample: nombreDeMuestra(archivo.nombre),
          pitch: archivo.midi,
          keyRange: rango(archivo.midi),
          ...(hayCapas ? { velRange: (archivo.capa === 'p' ? [1, 84] : [85, 127]) as [number, number] } : {}),
        })),
      },
    ],
  };
}

function vozMuestreada(
  def: DefInstrumento,
  paquete: Paquete,
  muestras: Map<string, AudioBuffer>,
  ctx: BaseAudioContext,
  destino: AudioNode,
): Voz {
  const instrumento = Muestreado(ctx, {
    preset: presetDe(paquete),
    buffers: muestras,
    destination: destino,
    scheduler: programadorInmediato,
    // Un acorde rasgueado y repetido no puede acumular voces sin fin en un móvil.
    maxVoices: 48,
  });
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
  if (def.pads) return vozDeBateria(def, ctx, destino);
  const paquete = getPaquete(def.paquete);
  if (paquete && muestras && muestras.size > 0) return vozMuestreada(def, paquete, muestras, ctx, destino);
  return vozSintetica(def, ctx, destino);
}
