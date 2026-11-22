/**
 * Estudio — modelo de datos del mini-DAW.
 *
 * Una pista = un clip de audio. Es la simplificación deliberada: cada toma
 * genera una pista nueva, y sobre esa pista se puede mover, recortar, repetir
 * y ajustar volumen. Nada más.
 */

import type { AjustesMaster, MezclaPista } from './mezcla/tipos';
import type { PistaDeNotas } from '@/lib/instrumentos/tipos';
import type { AjustesClaqueta } from './claqueta/claqueta';
import type { CuadreDeToma } from './cuadrar/toma';

export interface Clip {
  /** Clave del audio en el almacén (IndexedDB / mapa de buffers en memoria). */
  bufferId: string;
  /** Posición en la línea de tiempo, en segundos, donde empieza a sonar. */
  start: number;
  /** Segundos del buffer original que se saltan al empezar (recorte de entrada). */
  offset: number;
  /** Duración en segundos de cada repetición (recorte de salida). */
  duration: number;
  /** Número de veces que suena seguido. 1 = una sola vez. */
  repeats: number;
}

export interface Track {
  id: string;
  name: string;
  clip: Clip;
  /** Ganancia lineal. 1 = tal como se grabó. */
  volume: number;
  muted: boolean;
  soloed: boolean;
  /** Duración total del buffer original, en segundos (para limitar el recorte). */
  sourceDuration: number;
  createdAt: number;
  /**
   * La ha tocado la máquina, no tú: el músico de sesión. Se pinta en ámbar,
   * que en este estudio es el color de lo generado.
   */
  ia?: boolean;
  /**
   * Panorama, ecualizador, compresor, saturación y envíos (el mezclador).
   * Las pistas de antes no lo traen y suenan neutras: léelo con `mezclaDe`.
   */
  mezcla?: MezclaPista;
  /**
   * Pilar B: si la pista se tocó en la pantalla, sus notas en bruto, los
   * ajustes y el instrumento (ver `src/lib/instrumentos/tipos.ts`). El clip
   * apunta al audio hecho con ellas, así que el motor la reproduce y la
   * exporta como cualquier otra. Las pistas sin este campo son audio.
   */
  notas?: PistaDeNotas;
  /**
   * Toma de audio cuadrada al tempo: la original y la cuadrada, y cuál suena.
   * La original no se borra nunca (ver `src/lib/daw/cuadrar/toma.ts`).
   */
  cuadre?: CuadreDeToma;
}

export interface Project {
  id: string;
  name: string;
  bpm: number;
  tracks: Track[];
  createdAt: number;
  updatedAt: number;
  /** Reverb, eco, limitador y masterizado. Ausente en las ideas de antes: léelo con `masterDe`. */
  master?: AjustesMaster;
}

/**
 * Lo que han enseñado tus tomas. Al grabar con algo sonando, la app mide
 * cuánto llegan tarde tus golpes y mueve la compensación un 70 % de ese
 * error (ver `analysis/retraso.ts`): la máquina se adapta a ti, no al revés.
 */
export interface LatenciaAprendida {
  /**
   * El `latencyMs` que dejó la última toma. Si ya no coincide es que se ha
   * recalibrado o movido a mano, y lo aprendido deja de mandar.
   */
  ms: number;
  /**
   * Lo que han sumado las tomas a la cifra de partida (estimada, medida o a
   * mano). Es lo único que se puede deshacer: por debajo de la cifra de
   * partida no se baja.
   */
  extraMs: number;
  /** Tomas que han afinado o confirmado la cifra. */
  tomas: number;
}

export interface StudioSettings {
  /** Compensación de latencia de ida y vuelta, en milisegundos. */
  latencyMs: number;
  /**
   * ctx.outputLatency (ms) cuando la cifra se midió o la afinó una toma por
   * última vez, para detectar cambios de salida (unos cascos Bluetooth).
   */
  calibratedOutputLatencyMs: number | null;
  /** true si el valor viene de una medición real y no de una estimación. */
  calibrated: boolean;
  /** Lo que han afinado tus tomas; null si ninguna lo ha hecho todavía. */
  latenciaAprendida: LatenciaAprendida | null;
  /** Cancelación de eco. Off por defecto: destroza el sonido de un instrumento. */
  echoCancellation: boolean;
  inputDeviceId: string | null;
  /**
   * Qué entrada de la interfaz se graba: las dos juntas (lo de siempre), solo
   * la 1 (canal izquierdo) o solo la 2 (canal derecho). Para cuando el micro
   * va por una entrada y el teclado por otra. Ausente = las dos juntas.
   */
  canalEntrada?: CanalEntrada;
  /**
   * Por dónde suena el estudio: la tarjeta del PC, una interfaz de audio con
   * cascos, unos altavoces. null = la salida por defecto del sistema. Solo en
   * navegadores con `AudioContext.setSinkId` (Chrome y Edge en el PC).
   */
  outputDeviceId: string | null;
  metronome: boolean;
  /**
   * Cómo suena la claqueta: sonido, subdivisión, acento, volumen y ritmo de
   * fondo. Ausente en los ajustes de antes: léelo con `claquetaDe`, que da
   * el tic-tac de siempre.
   */
  claqueta?: AjustesClaqueta;
  countInBars: number;
  snapToGrid: boolean;
  /**
   * Soltar el micro al parar. En iPhone, mientras hay un micro abierto el
   * sistema cambia a modo "grabación" y baja el volumen de salida: escuchar lo
   * grabado se oye flojísimo. Soltándolo entre tomas se recupera el volumen.
   */
  releaseMicOnStop: boolean;
}

/** Qué entrada se graba: las dos juntas, solo la 1 (izquierda) o solo la 2 (derecha). */
export type CanalEntrada = 'juntas' | 'entrada-1' | 'entrada-2';

export const DEFAULT_SETTINGS: StudioSettings = {
  latencyMs: 0,
  calibratedOutputLatencyMs: null,
  calibrated: false,
  latenciaAprendida: null,
  echoCancellation: false,
  inputDeviceId: null,
  outputDeviceId: null,
  metronome: false,
  countInBars: 1,
  snapToGrid: false,
  releaseMicOnStop: false,
};

/** iPhone y iPad (iPadOS se hace pasar por Mac, de ahí lo del táctil). */
export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(ua));
}

export type TransportState = 'stopped' | 'playing' | 'recording' | 'countin';

export interface PeakData {
  peaksPerSecond: number;
  min: Float32Array;
  max: Float32Array;
  /** Pico absoluto de la toma, para poder dibujar la onda a escala. */
  pico: number;
}

export function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

/** Fin absoluto de la pista en la línea de tiempo. */
export function trackEnd(track: Track): number {
  return track.clip.start + track.clip.duration * track.clip.repeats;
}

export function projectDuration(project: Project): number {
  return project.tracks.reduce((max, t) => Math.max(max, trackEnd(t)), 0);
}
