/**
 * Calibración de latencia.
 *
 * El desfase al grabar sobre una pista no es un bug: es física. Lo que suena
 * por el altavoz tarda en salir (buffer de salida + DAC + Bluetooth) y lo que
 * entra por el micro tarda en llegar (ADC + buffer de entrada). El músico toca
 * sincronizado con lo que OYE, así que su interpretación aparece en la
 * grabación desplazada exactamente esa ida y vuelta.
 *
 * La única forma honesta de saber cuánto vale ese número en TU móvil, con TUS
 * cascos, es medirlo: emitimos una serie de clicks, los grabamos por el micro
 * y buscamos con un filtro adaptado dónde han caído. La diferencia entre el
 * instante en que los mandamos y el instante en que los oímos es la latencia
 * real de ida y vuelta.
 */

import { createClickBuffer } from './audio';
import type { Recorder } from './recorder';
import type { StudioSettings } from './types';

export interface CalibrationResult {
  ok: boolean;
  latencyMs: number;
  spreadMs: number;
  detections: number;
  message: string;
}

// Los clicks van separados 0,6 s y la ventana de búsqueda es de 0,5 s: así
// nunca puede colarse el click siguiente dentro de la ventana del anterior,
// que era la forma de equivocarse en 400 ms enteros.
const CLICK_TIMES = [0.6, 1.2, 1.8, 2.4, 3.0];
const SEARCH_WINDOW = 0.5;
const SEARCH_AHEAD = 0.02;
const TAIL = 0.55;
const LEAD = 0.35;

/** Latencia de salida que reporta el navegador, en ms (Chrome la expone; Safari no). */
export function outputLatencyMs(ctx: AudioContext): number | null {
  const value = (ctx as AudioContext & { outputLatency?: number }).outputLatency;
  if (typeof value === 'number' && isFinite(value) && value > 0) return value * 1000;
  return null;
}

/** Estimación a ciegas, para tener algo razonable antes de calibrar. */
export function estimateLatencyMs(ctx: AudioContext, stream?: MediaStream | null): number {
  const out = outputLatencyMs(ctx) ?? (ctx.baseLatency || 0.01) * 2 * 1000;

  let input = (ctx.baseLatency || 0.01) * 1000;
  const track = stream?.getAudioTracks?.()[0];
  if (track) {
    const settings = track.getSettings() as MediaTrackSettings & { latency?: number };
    if (typeof settings.latency === 'number' && isFinite(settings.latency)) {
      input = settings.latency * 1000;
    }
  }
  return Math.round(out + input + 10);
}

/**
 * ¿Sigue mandando lo que enseñaron las tomas? Deja de hacerlo en cuanto la
 * cifra se mueve por otro lado (recalibrar, el ajuste manual).
 */
export function aprendidaVigente(settings: StudioSettings): boolean {
  const aprendida = settings.latenciaAprendida;
  return !!aprendida && aprendida.tomas > 0 && aprendida.ms === settings.latencyMs;
}

/** Lo que las tomas han sumado a la cifra de partida, en ms. */
export function extraAprendidoMs(settings: StudioSettings): number {
  return aprendidaVigente(settings) ? (settings.latenciaAprendida?.extraMs ?? 0) : 0;
}

/**
 * Compensación efectiva. Si el navegador informa de que la salida ha cambiado
 * desde que se midió la cifra, con la calibración o con tus tomas (típico al
 * conectar unos cascos Bluetooth), se ajusta la diferencia sin obligarte a
 * volver a calibrar.
 */
export function effectiveLatencyMs(settings: StudioSettings, ctx: AudioContext | null): number {
  if (!ctx) return settings.latencyMs;
  const contrastada = settings.calibrated || aprendidaVigente(settings);
  if (!contrastada || settings.calibratedOutputLatencyMs == null) {
    return settings.latencyMs;
  }
  const current = outputLatencyMs(ctx);
  if (current == null) return settings.latencyMs;
  const delta = current - settings.calibratedOutputLatencyMs;
  if (!isFinite(delta) || Math.abs(delta) < 3) return settings.latencyMs;
  return Math.max(0, Math.round(settings.latencyMs + delta));
}

/** Tope de lo que pueden sumar las tomas a la cifra de partida. */
const EXTRA_MAXIMO_MS = 300;
/** El mismo tope que el ajuste manual. */
const LATENCIA_MAXIMA_MS = 400;

export interface TomaAprendida {
  /** La compensación con la que se grabó la toma, en ms. */
  aplicadaMs: number;
  /** Lo que hay que sumarle (o restarle) para la siguiente, en ms. */
  aprendizajeMs: number;
  /** ctx.outputLatency ahora mismo, en ms, si el navegador la da. */
  salidaMs: number | null;
}

/**
 * Los ajustes que deja una toma que se ha podido medir.
 *
 * Se parte de la compensación con la que se grabó (que ya incluye el cambio de
 * salida, si lo hubo) y se le suma lo aprendido, con dos topes: lo que suman
 * las tomas nunca baja de cero (no se desaprende por debajo de la cifra
 * medida o estimada) ni pasa de 300 ms. La salida de este momento queda como
 * referencia, así que si luego conectas unos cascos Bluetooth la cifra se
 * mueve sola con ellos, igual que con una calibración.
 */
export function aprenderLatencia(settings: StudioSettings, toma: TomaAprendida): Partial<StudioSettings> {
  const previa = aprendidaVigente(settings) ? settings.latenciaAprendida : null;
  const extraPrevio = previa?.extraMs ?? 0;
  const extra = Math.min(EXTRA_MAXIMO_MS, Math.max(0, extraPrevio + toma.aprendizajeMs));
  const latencyMs = Math.round(
    Math.min(LATENCIA_MAXIMA_MS, Math.max(0, toma.aplicadaMs + (extra - extraPrevio))),
  );
  return {
    latencyMs,
    calibratedOutputLatencyMs: toma.salidaMs ?? settings.calibratedOutputLatencyMs,
    latenciaAprendida: {
      ms: latencyMs,
      extraMs: Math.round(extra * 10) / 10,
      tomas: (previa?.tomas ?? 0) + 1,
    },
  };
}

/**
 * De dónde sale la cifra:
 * - `ninguna`: todavía cero, no se ha abierto el micro nunca («sin calibrar»).
 * - `estimada`: lo que dice el navegador, a ciegas, o el ajuste manual.
 * - `medida`: la calibración con clicks.
 * - `tomas`: afinada con tus propias tomas.
 */
export type OrigenLatencia = 'ninguna' | 'estimada' | 'medida' | 'tomas';

export interface EstadoLatencia {
  /** La compensación que se aplica ahora, en ms. */
  ms: number;
  origen: OrigenLatencia;
  /** Tomas que la han afinado o confirmado (0 si el origen no es `tomas`). */
  tomas: number;
}

export function estadoLatencia(settings: StudioSettings, ctx: AudioContext | null): EstadoLatencia {
  const ms = effectiveLatencyMs(settings, ctx);
  if (aprendidaVigente(settings)) {
    return { ms, origen: 'tomas', tomas: settings.latenciaAprendida?.tomas ?? 0 };
  }
  return { ms, origen: settings.calibrated ? 'medida' : ms > 0 ? 'estimada' : 'ninguna', tomas: 0 };
}

/**
 * Filtro adaptado: correla la señal grabada con el click de referencia y
 * devuelve el desplazamiento (en muestras) donde mejor encaja, junto con una
 * medida de cuánto destaca ese pico sobre el resto de la ventana.
 */
function matchedFilter(
  haystack: Float32Array,
  needle: Float32Array,
): { offset: number; score: number; prominence: number } {
  const limit = haystack.length - needle.length;
  if (limit <= 0) return { offset: -1, score: 0, prominence: 0 };

  // Energía móvil de la ventana, para normalizar y que un golpe fuerte lejano
  // no gane por volumen.
  let energy = 0;
  for (let i = 0; i < needle.length; i++) energy += haystack[i] * haystack[i];

  const scores = new Float32Array(limit + 1);
  let bestScore = 0;
  let sum = 0;

  for (let d = 0; d <= limit; d++) {
    let dot = 0;
    for (let i = 0; i < needle.length; i++) dot += needle[i] * haystack[d + i];
    const score = Math.abs(dot) / Math.sqrt(energy + 1e-9);
    scores[d] = score;
    sum += score;
    if (score > bestScore) bestScore = score;
    if (d < limit) {
      const entering = haystack[d + needle.length];
      const leaving = haystack[d];
      energy += entering * entering - leaving * leaving;
      if (energy < 0) energy = 0;
    }
  }

  // Nos quedamos con el PRIMER pico que casi iguala al mejor, no con el mejor
  // a secas: en una habitación, el sonido directo llega antes que el rebote de
  // la pared, y a veces el rebote correla algo mejor. Lo que queremos medir es
  // el directo.
  let best = -1;
  const threshold = bestScore * 0.85;
  for (let d = 0; d <= limit; d++) {
    if (scores[d] >= threshold) {
      best = d;
      break;
    }
  }

  const mean = sum / (limit + 1);
  return { offset: best, score: bestScore, prominence: bestScore / (mean + 1e-9) };
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Análisis puro: dada la grabación y los instantes en los que se emitió cada
 * click, devuelve cuánto tardaron en volver. Está separado de la parte de
 * audio para poder comprobarlo con señales sintéticas.
 */
export function analyzeClickDelays(
  samples: Float32Array,
  sampleRate: number,
  reference: Float32Array,
  clickTimes: number[] = CLICK_TIMES,
): CalibrationResult {
  if (samples.length < sampleRate * 0.5) {
    return {
      ok: false,
      latencyMs: 0,
      spreadMs: 0,
      detections: 0,
      message: 'No ha entrado señal por el micro. Revisa el permiso y vuelve a intentarlo.',
    };
  }

  const searchAhead = Math.floor(sampleRate * SEARCH_AHEAD);
  const searchWindow = Math.floor(sampleRate * SEARCH_WINDOW);
  const delays: number[] = [];

  for (const time of clickTimes) {
    const expected = Math.round(time * sampleRate);
    const from = Math.max(0, expected - searchAhead);
    const to = Math.min(samples.length, expected + searchWindow);
    if (to - from < reference.length * 2) continue;

    const window = samples.subarray(from, to);
    const { offset, prominence } = matchedFilter(window, reference);
    if (offset < 0 || prominence < 4) continue;

    const delaySeconds = (from + offset - expected) / sampleRate;
    if (delaySeconds < -0.005 || delaySeconds > 0.5) continue;
    delays.push(delaySeconds * 1000);
  }

  if (delays.length < 3) {
    return {
      ok: false,
      latencyMs: 0,
      spreadMs: 0,
      detections: delays.length,
      message:
        'No he podido oír los clicks. Quítate los cascos, sube el volumen del móvil y déjalo quieto sobre la mesa.',
    };
  }

  // Nos quedamos con las detecciones coherentes entre sí.
  const rough = median(delays);
  const inliers = delays.filter((value) => Math.abs(value - rough) < 25);
  if (inliers.length < 3) {
    return {
      ok: false,
      latencyMs: 0,
      spreadMs: 0,
      detections: inliers.length,
      message: 'Las medidas salen inconsistentes. Busca un sitio con menos ruido e inténtalo otra vez.',
    };
  }

  const latency = median(inliers);
  const spread = Math.max(...inliers) - Math.min(...inliers);

  if (spread > 20) {
    return {
      ok: false,
      latencyMs: Math.round(latency),
      spreadMs: Math.round(spread),
      detections: inliers.length,
      message: 'Demasiada dispersión entre medidas. Repite la calibración en un sitio más silencioso.',
    };
  }

  return {
    ok: true,
    latencyMs: Math.round(latency),
    spreadMs: Math.round(spread),
    detections: inliers.length,
    message: `Latencia medida: ${Math.round(latency)} ms (${inliers.length} clicks, ±${Math.round(spread / 2)} ms).`,
  };
}

/**
 * Mide la latencia de ida y vuelta. Requiere que el micro pueda oír la salida,
 * así que se hace por altavoz (o con los cascos puestos del revés, apuntando
 * al micro). El resultado incluye TODA la cadena real del dispositivo.
 */
export async function calibrateLatency(
  ctx: AudioContext,
  recorder: Recorder,
): Promise<CalibrationResult> {
  const click = createClickBuffer(ctx, 2200, 0.01, 1);
  const reference = click.getChannelData(0).slice(0);

  const gain = ctx.createGain();
  gain.gain.value = 1;
  gain.connect(ctx.destination);

  const t0 = ctx.currentTime + LEAD;
  const sources: AudioBufferSourceNode[] = [];
  for (const time of CLICK_TIMES) {
    const source = ctx.createBufferSource();
    source.buffer = click;
    source.connect(gain);
    source.start(t0 + time);
    sources.push(source);
  }

  recorder.start(t0);
  const totalWait = (CLICK_TIMES[CLICK_TIMES.length - 1] + TAIL + LEAD) * 1000;
  await new Promise((resolve) => setTimeout(resolve, totalWait + 120));

  const { samples } = recorder.stop();
  sources.forEach((source) => {
    try {
      source.stop();
      source.disconnect();
    } catch {
      /* ya terminado */
    }
  });
  gain.disconnect();

  return analyzeClickDelays(samples, recorder.sampleRate, reference);
}
