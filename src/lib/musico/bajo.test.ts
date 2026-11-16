import { describe, expect, it } from 'vitest';
import type { AcordeEnTiempo } from './acordes';
import { escribirBajo, ESTILOS } from './bajo';
import { claseDeNota } from './teoria';

const T = 0.6; // 100 BPM
const progresion: AcordeEnTiempo[] = [
  { inicio: 0, fin: 4 * T, acorde: { raiz: 9, calidad: 'menor' }, nombre: 'La m' },
  { inicio: 4 * T, fin: 8 * T, acorde: { raiz: 7, calidad: 'mayor' }, nombre: 'Sol' },
];
const base = { bpm: 100, fase: 0, duracion: 8 * T, humano: 0 };

describe('escribirBajo', () => {
  it('a negras toca la raíz en cada pulso, en su sitio', () => {
    const notas = escribirBajo(progresion, { ...base, estilo: 'negras' });
    expect(notas).toHaveLength(8);
    notas.forEach((nota, k) => expect(nota.inicio).toBeCloseTo(k * T, 5));
    expect(notas.slice(0, 4).every((n) => claseDeNota(n.midi) === 9)).toBe(true);
    expect(notas.slice(4).every((n) => claseDeNota(n.midi) === 7)).toBe(true);
  });

  it('raíz y quinta alterna, y siempre entra en la raíz al cambiar de acorde', () => {
    const notas = escribirBajo(progresion, { ...base, estilo: 'raiz-quinta' });
    expect(notas.map((n) => claseDeNota(n.midi))).toEqual([9, 4, 9, 4, 7, 2, 7, 2]);
  });

  it('la raíz larga da una nota por acorde y por compás', () => {
    const notas = escribirBajo(progresion, { ...base, estilo: 'raiz' });
    expect(notas).toHaveLength(2);
    expect(notas[0].duracion).toBeGreaterThan(3 * T);
  });

  it('el caminante llega al acorde siguiente por semitono', () => {
    const notas = escribirBajo(progresion, { ...base, estilo: 'caminante' });
    const antesDelCambio = notas.find((n) => Math.abs(n.inicio - 3 * T) < 0.01);
    const cambio = notas.find((n) => Math.abs(n.inicio - 4 * T) < 0.01);
    expect(antesDelCambio && cambio).toBeTruthy();
    expect(Math.abs(cambio!.midi - antesDelCambio!.midi)).toBe(1);
  });

  it('al compás de doce golpea en los acentos del ciclo', () => {
    const doce: AcordeEnTiempo[] = [{ inicio: 0, fin: 12 * T, acorde: { raiz: 4, calidad: 'mayor' }, nombre: 'Mi' }];
    const notas = escribirBajo(doce, {
      ...base,
      duracion: 12 * T,
      estilo: 'compas',
      ciclo: { pulsos: 12, acentos: [12, 3, 6, 8, 10] },
    });
    const pulsos = notas.map((n) => Math.round(n.inicio / T) + 1);
    // El primer pulso entra porque es el cambio de acorde; el resto, acentos.
    expect(pulsos).toEqual([1, 3, 6, 8, 10, 12]);
  });

  it('se queda dentro del mástil de un bajo de cuatro cuerdas', () => {
    for (const estilo of ESTILOS) {
      const notas = escribirBajo(progresion, { ...base, estilo: estilo.id });
      for (const n of notas) {
        expect(n.midi).toBeGreaterThanOrEqual(28);
        expect(n.midi).toBeLessThanOrEqual(50);
      }
    }
  });

  it('con la misma semilla, el mismo bajo', () => {
    const a = escribirBajo(progresion, { ...base, humano: 1, semilla: 3, estilo: 'negras' });
    const b = escribirBajo(progresion, { ...base, humano: 1, semilla: 3, estilo: 'negras' });
    expect(a).toEqual(b);
  });
});
