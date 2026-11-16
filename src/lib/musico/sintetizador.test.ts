import { describe, expect, it } from 'vitest';
import { frecuenciaDominante, SR } from '@/test/senales';
import { sintetizarBajo } from './sintetizador';

describe('sintetizarBajo', () => {
  it('un La1 suena a 55 Hz', () => {
    const audio = sintetizarBajo([{ inicio: 0, duracion: 1, midi: 33, velocidad: 0.9 }], {
      sampleRate: SR,
      duracion: 1.2,
    });
    expect(frecuenciaDominante(audio.subarray(0, SR), SR, 40, 130)).toBeCloseTo(55, 0);
  });

  it('nunca satura y calla cuando acaba la nota', () => {
    const notas = [0, 0.5, 1, 1.5].map((inicio) => ({ inicio, duracion: 0.45, midi: 28, velocidad: 1 }));
    const audio = sintetizarBajo(notas, { sampleRate: SR, duracion: 3 });
    let pico = 0;
    for (const s of audio) pico = Math.max(pico, Math.abs(s));
    expect(pico).toBeLessThanOrEqual(1);
    expect(pico).toBeGreaterThan(0.2);
    const cola = audio.subarray(Math.round(2.2 * SR));
    expect(Math.max(...cola.map(Math.abs))).toBe(0);
  });
});
