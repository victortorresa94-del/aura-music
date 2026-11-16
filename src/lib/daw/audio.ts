/**
 * Utilidades de audio: conversión, picos para la forma de onda y export a WAV.
 */

import type { PeakData } from './types';

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

/** 00:00.0 */
export function formatTime(seconds: number): string {
  const s = Math.max(0, seconds);
  const m = Math.floor(s / 60);
  const rest = s - m * 60;
  const whole = Math.floor(rest);
  const tenths = Math.floor((rest - whole) * 10);
  return `${String(m).padStart(2, '0')}:${String(whole).padStart(2, '0')}.${tenths}`;
}

export function floatToInt16(input: Float32Array): Int16Array {
  const out = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = clamp(input[i], -1, 1);
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

export function int16ToFloat(input: Int16Array): Float32Array {
  const out = new Float32Array(input.length);
  for (let i = 0; i < input.length; i++) out[i] = input[i] / 0x8000;
  return out;
}

/** Une los trozos que llegan del grabador en un único Float32Array. */
export function concatChunks(chunks: Float32Array[], total: number): Float32Array {
  const out = new Float32Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

/**
 * Precalcula min/max por bucket para dibujar la forma de onda sin recorrer
 * el buffer entero en cada repintado.
 */
export function computePeaks(
  data: Float32Array,
  sampleRate: number,
  peaksPerSecond = 120,
): PeakData {
  const samplesPerPeak = Math.max(1, Math.floor(sampleRate / peaksPerSecond));
  const count = Math.max(1, Math.ceil(data.length / samplesPerPeak));
  const min = new Float32Array(count);
  const max = new Float32Array(count);
  let pico = 0;

  for (let p = 0; p < count; p++) {
    const from = p * samplesPerPeak;
    const to = Math.min(data.length, from + samplesPerPeak);
    let lo = 0;
    let hi = 0;
    for (let i = from; i < to; i++) {
      const v = data[i];
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
    min[p] = lo;
    max[p] = hi;
    if (-lo > pico) pico = -lo;
    if (hi > pico) pico = hi;
  }
  return { peaksPerSecond: sampleRate / samplesPerPeak, min, max, pico };
}

/** Nivel RMS de un bloque, en 0..1, para el vúmetro. */
export function blockRms(data: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
  return Math.sqrt(sum / Math.max(1, data.length));
}

/** Codifica un AudioBuffer a WAV PCM 16 bits. */
export function encodeWav(buffer: AudioBuffer): Blob {
  const channels = buffer.numberOfChannels;
  const length = buffer.length;
  const sampleRate = buffer.sampleRate;
  const bytesPerSample = 2;
  const blockAlign = channels * bytesPerSample;
  const dataSize = length * blockAlign;

  const out = new ArrayBuffer(44 + dataSize);
  const view = new DataView(out);

  const writeString = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 8 * bytesPerSample, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  const channelData: Float32Array[] = [];
  for (let c = 0; c < channels; c++) channelData.push(buffer.getChannelData(c));

  let offset = 44;
  for (let i = 0; i < length; i++) {
    for (let c = 0; c < channels; c++) {
      const s = clamp(channelData[c][i], -1, 1);
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([out], { type: 'audio/wav' });
}

/** Crea un click corto para el metrónomo (seno con ataque y caída rápidos). */
export function createClickBuffer(
  ctx: BaseAudioContext,
  frequency: number,
  durationSeconds = 0.035,
  gain = 0.6,
): AudioBuffer {
  const sr = ctx.sampleRate;
  const length = Math.max(1, Math.floor(sr * durationSeconds));
  const buffer = ctx.createBuffer(1, length, sr);
  const data = buffer.getChannelData(0);
  const attack = Math.floor(sr * 0.0008);
  for (let i = 0; i < length; i++) {
    const t = i / sr;
    const env =
      i < attack ? i / attack : Math.exp(-(i - attack) / (sr * durationSeconds * 0.28));
    data[i] = Math.sin(2 * Math.PI * frequency * t) * env * gain;
  }
  return buffer;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function slugify(text: string): string {
  return (
    text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase() || 'estudio'
  );
}
