import { describe, expect, it } from 'vitest';
import { clics, SR } from '@/test/senales';
import { desplazar, estimarDesfase } from './pulso';
import { codificarWav, leerWav, remuestrear } from './wav';

describe('estimarDesfase', () => {
  it('ve que una pista va 40 ms tarde', () => {
    const referencia = clics(100, 6);
    const tarde = clics(100, 6, 0.04);
    expect(estimarDesfase(referencia, tarde, SR)).toBeCloseTo(0.04, 2);
  });

  it('y la deja en su sitio al desplazarla', () => {
    const referencia = clics(100, 6);
    const corregida = desplazar(clics(100, 6, 0.04), SR, 0.04);
    expect(Math.abs(estimarDesfase(referencia, corregida, SR))).toBeLessThanOrEqual(0.01);
  });
});

describe('wav', () => {
  it('ida y vuelta sin perder nada que se oiga', () => {
    const original = new Float32Array(SR / 10).map((_, i) => Math.sin(i / 10) * 0.5);
    const { samples, sampleRate } = leerWav(codificarWav(original, SR));
    expect(sampleRate).toBe(SR);
    expect(samples.length).toBe(original.length);
    expect(Math.abs(samples[123] - original[123])).toBeLessThan(1e-3);
  });

  it('remuestrea de 48 a 32 kHz con la duración intacta', () => {
    expect(remuestrear(new Float32Array(48000), 48000, 32000).length).toBe(32000);
  });
});
