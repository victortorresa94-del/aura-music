import { describe, expect, it } from 'vitest';
import type { Project, Track } from '../types';
import {
  cicloDesde,
  cicloEntre,
  compasesDelCiclo,
  conCiclo,
  elegirToma,
  moverBorde,
  segundosDelCiclo,
  separarTomas,
  tomasDeVueltas,
  tomasUsables,
} from './bucle';

// A 120 BPM un pulso son 0,5 s y un compás de 4/4, 2 s.
const BPM = 120;

describe('la zona del ciclo', () => {
  it('«repetir 2 compases desde aquí» empieza en el compás donde está el cursor', () => {
    // El cursor a 5,3 s está en el compás 3 (de 4 a 6 s).
    expect(cicloDesde(5.3, 2, BPM, 4)).toEqual({ desde: 8, hasta: 16, activo: true });
    expect(segundosDelCiclo(cicloDesde(5.3, 2, BPM, 4), BPM)).toEqual({ inicio: 4, fin: 8 });
    expect(cicloDesde(0, 1, BPM, 4)).toEqual({ desde: 0, hasta: 4, activo: true });
  });

  it('en 3/4 los compases son de tres pulsos', () => {
    expect(cicloDesde(1.6, 1, BPM, 3)).toEqual({ desde: 3, hasta: 6, activo: true });
  });

  it('arrastrando, de compás entero a compás entero y al menos uno', () => {
    expect(cicloEntre(4.4, 9.1, BPM, 4)).toEqual({ desde: 8, hasta: 20, activo: true });
    // Al revés también vale, y un arrastre pequeño es un compás.
    expect(cicloEntre(9.1, 4.4, BPM, 4)).toEqual({ desde: 8, hasta: 20, activo: true });
    expect(cicloEntre(4.2, 4.3, BPM, 4)).toEqual({ desde: 8, hasta: 12, activo: true });
  });

  it('mover un borde no deja la zona en nada', () => {
    const c = { desde: 8, hasta: 16, activo: true };
    expect(moverBorde(c, 'hasta', 12, BPM, 4)).toEqual({ ...c, hasta: 24 });
    expect(moverBorde(c, 'hasta', 1, BPM, 4)).toEqual({ ...c, hasta: 12 });
    expect(moverBorde(c, 'desde', 9, BPM, 4)).toEqual({ ...c, desde: 12 });
    expect(compasesDelCiclo(c, 4)).toBe(2);
  });

  it('apagado o sin largo no se repite nada', () => {
    expect(segundosDelCiclo({ desde: 0, hasta: 8, activo: false }, BPM)).toBeNull();
    expect(segundosDelCiclo({ desde: 8, hasta: 8, activo: true }, BPM)).toBeNull();
    expect(segundosDelCiclo(undefined, BPM)).toBeNull();
  });

  it('si cambia el tempo, siguen siendo los mismos compases', () => {
    const c = cicloDesde(0, 2, BPM, 4);
    expect(segundosDelCiclo(c, 60)).toEqual({ inicio: 0, fin: 8 });
  });
});

describe('cortar la grabación en vueltas', () => {
  // Zona de 4 a 8 s; la grabación empezó en 4 y se colocó 0,05 s antes por la latencia.
  const base = { inicio: 4, fin: 8, colocada: 3.95 };

  it('cada vuelta entera es una toma, con la misma latencia compensada en todas', () => {
    // Tres vueltas y un poco (13 s de audio): tres tomas.
    const t = tomasDeVueltas({ ...base, duracionAudio: 13 })!;
    expect(t.offsets.map((o) => Number(o.toFixed(6)))).toEqual([0.05, 4.05, 8.05]);
    // Suena la última.
    expect(t.elegida).toBe(2);
  });

  it('una vuelta a la que le falta un pelo (paraste justo al acabar) cuenta', () => {
    const t = tomasDeVueltas({ ...base, duracionAudio: 7.8 })!;
    expect(t.offsets).toHaveLength(2);
  });

  it('sin ninguna vuelta entera es una toma normal', () => {
    expect(tomasDeVueltas({ ...base, duracionAudio: 2.5 })).toBeNull();
  });
});

describe('elegir y separar tomas', () => {
  const pista = (): Track => ({
    id: 'v',
    name: 'Voz',
    clip: { bufferId: 'b', start: 4, offset: 8.05, duration: 4, repeats: 1 },
    volume: 1,
    muted: false,
    soloed: false,
    sourceDuration: 13,
    createdAt: 0,
    tomas: { offsets: [0.05, 4.05, 8.05], elegida: 2 },
  });
  const proyecto = (): Project => ({ id: 'p', name: 'Idea', bpm: BPM, createdAt: 0, updatedAt: 0, tracks: [pista()] });

  it('elegir otra toma solo cambia qué trozo suena', () => {
    const t = elegirToma(proyecto(), 'v', 0).tracks[0];
    expect(t.clip).toEqual({ bufferId: 'b', start: 4, offset: 0.05, duration: 4, repeats: 1 });
    expect(t.tomas?.elegida).toBe(0);
    // Fuera de rango, la más cercana.
    expect(elegirToma(proyecto(), 'v', 9).tracks[0].tomas?.elegida).toBe(2);
  });

  it('una pista por toma: la que sonaba se queda y las demás salen debajo', () => {
    let n = 0;
    const p = separarTomas(proyecto(), 'v', () => `n${++n}`);
    expect(p.tracks.map((t) => t.name)).toEqual(['Voz · toma 3', 'Voz · toma 1', 'Voz · toma 2']);
    expect(p.tracks.map((t) => t.clip.offset)).toEqual([8.05, 0.05, 4.05]);
    expect(p.tracks.every((t) => !t.tomas && t.clip.bufferId === 'b' && t.clip.start === 4)).toBe(true);
  });

  it('si el clip se corta o se recorta, las tomas se esconden y no se pueden cambiar', () => {
    expect(tomasUsables(pista())).not.toBeNull();
    // Cortado en el cursor (la mitad derecha): ni la duración ni el trozo son de una vuelta.
    const cortada: Track = { ...pista(), clip: { ...pista().clip, offset: 10.05, duration: 2 } };
    expect(tomasUsables(cortada)).toBeNull();
    const p: Project = { ...proyecto(), tracks: [cortada] };
    expect(elegirToma(p, 'v', 0)).toEqual(p);
    expect(separarTomas(p, 'v', () => 'x')).toEqual(p);
  });

  it('poner y quitar el ciclo', () => {
    const con = conCiclo(proyecto(), { desde: 8, hasta: 16, activo: true });
    expect(con.ciclo).toEqual({ desde: 8, hasta: 16, activo: true });
    expect('ciclo' in conCiclo(con, null)).toBe(false);
  });
});
