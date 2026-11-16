/**
 * WAV de 16 bits, para mandar una toma a un modelo.
 *
 * Se manda en mono y a 32 kHz: el modelo trabaja a su propia frecuencia y lo
 * reconvierte igual, y así una toma de 45 segundos pesa menos de 3 MB, por
 * debajo del límite de 4,5 MB que tiene una función de Vercel por petición.
 */

export const LIMITE_SUBIDA_BYTES = 4_200_000;

/** Remuestreo lineal. Suficiente para que un modelo «oiga» la toma. */
export function remuestrear(samples: Float32Array, desde: number, hasta: number): Float32Array {
  if (desde === hasta) return samples;
  const ratio = desde / hasta;
  const n = Math.floor(samples.length / ratio);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = i * ratio;
    const j = Math.floor(x);
    const f = x - j;
    out[i] = samples[j] * (1 - f) + (samples[j + 1] ?? samples[j]) * f;
  }
  return out;
}

export function codificarWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const datos = samples.length * 2;
  const buffer = new ArrayBuffer(44 + datos);
  const v = new DataView(buffer);
  const texto = (offset: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(offset + i, s.charCodeAt(i));
  };
  texto(0, 'RIFF');
  v.setUint32(4, 36 + datos, true);
  texto(8, 'WAVE');
  texto(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  texto(36, 'data');
  v.setUint32(40, datos, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buffer;
}

/** Lo contrario, solo para WAV PCM de 16 bits mono. Lo usan los tests. */
export function leerWav(buffer: ArrayBuffer): { samples: Float32Array; sampleRate: number } {
  const v = new DataView(buffer);
  const sampleRate = v.getUint32(24, true);
  const n = v.getUint32(40, true) / 2;
  const samples = new Float32Array(n);
  for (let i = 0; i < n; i++) samples[i] = v.getInt16(44 + i * 2, true) / 0x8000;
  return { samples, sampleRate };
}
