import { describe, expect, it } from 'vitest';
import { frecuencia } from '@/lib/musico/teoria';
import { pulsarCuerda } from './cuerda';

const SR = 48000;

/** Periodo dominante por autocorrelación, en muestras (con interpolación parabólica). */
function periodo(x: Float32Array, desde: number, largo: number, min: number, max: number): number {
  let mejor = min;
  let mejorValor = -Infinity;
  const valores: number[] = [];
  for (let lag = min; lag <= max; lag++) {
    let s = 0;
    for (let i = desde; i < desde + largo; i++) s += x[i] * x[i + lag];
    valores[lag] = s;
    if (s > mejorValor) {
      mejorValor = s;
      mejor = lag;
    }
  }
  const a = valores[mejor - 1] ?? mejorValor;
  const c = valores[mejor + 1] ?? mejorValor;
  const den = a - 2 * mejorValor + c;
  return den === 0 ? mejor : mejor + (0.5 * (a - c)) / den;
}

describe('pulsarCuerda', () => {
  it.each([40, 45, 52, 64, 76])('la nota MIDI %i suena afinada (menos de 6 cents)', (midi) => {
    const x = pulsarCuerda(midi, 0.8, { sampleRate: SR, duracion: 1 });
    const esperado = SR / frecuencia(midi);
    const medido = periodo(x, Math.round(SR * 0.2), 4096, Math.floor(esperado * 0.8), Math.ceil(esperado * 1.25));
    const cents = 1200 * Math.log2(esperado / medido);
    expect(Math.abs(cents)).toBeLessThan(6);
  });

  it('se apaga: la cola es mucho más débil que el ataque', () => {
    const x = pulsarCuerda(52, 1, { sampleRate: SR, duracion: 3 });
    const rms = (a: number, b: number) => {
      let s = 0;
      for (let i = a; i < b; i++) s += x[i] * x[i];
      return Math.sqrt(s / (b - a));
    };
    expect(rms(SR * 2.4, SR * 2.8)).toBeLessThan(rms(0, SR * 0.2) * 0.25);
  });

  it('tocar más fuerte suena más fuerte, sin pasar de 1', () => {
    const suave = pulsarCuerda(57, 0.2, { sampleRate: SR, duracion: 0.5 });
    const fuerte = pulsarCuerda(57, 1, { sampleRate: SR, duracion: 0.5 });
    const pico = (x: Float32Array) => x.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
    expect(pico(fuerte)).toBeGreaterThan(pico(suave) * 2);
    expect(pico(fuerte)).toBeLessThanOrEqual(1);
  });

  it('es determinista: la misma nota da las mismas muestras', () => {
    const a = pulsarCuerda(60, 0.7, { sampleRate: SR, duracion: 0.2 });
    const b = pulsarCuerda(60, 0.7, { sampleRate: SR, duracion: 0.2 });
    expect(a).toEqual(b);
  });
});
