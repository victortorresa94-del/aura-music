import { describe, expect, it } from 'vitest';
import type { Golpe } from '@/lib/instrumentos/tipos';
import {
  cuantizar,
  diagnosticar,
  humanizar,
  PLANTILLAS,
  procesarGolpes,
  quitarDobles,
  rejillaSugerida,
} from './index';
import { ruidoRosa } from './ruido';

const BPM = 120; // un pulso = 500 ms
const ms = (m: number) => (m / 1000) * (BPM / 60);
const g = (beat: number, nota = 36, vel = 100, dur = 0.25): Golpe => ({ beat, dur, nota, vel });
const ctx = { bpm: BPM, inicioBeat: 0 };
const cuadrar = { rejilla: 0.25, fuerza: 1, swing: 0, ventana: 1, plantilla: null };

describe('quitarDobles', () => {
  it('quita la misma nota repetida en menos de 30 ms y se queda con la fuerza mayor', () => {
    const limpio = quitarDobles([g(0, 36, 80), g(ms(18), 36, 110), g(1, 36, 90)], BPM);
    expect(limpio).toHaveLength(2);
    expect(limpio[0].beat).toBe(0);
    expect(limpio[0].vel).toBe(110);
  });

  it('no toca dos notas distintas a la vez ni golpes separados por más de 30 ms', () => {
    const limpio = quitarDobles([g(0, 36), g(0, 42), g(ms(45), 36)], BPM);
    expect(limpio).toHaveLength(3);
  });

  it('no modifica el original', () => {
    const bruto = [g(0, 36, 80), g(ms(10), 36, 120)];
    quitarDobles(bruto, BPM);
    expect(bruto[0].vel).toBe(80);
    expect(bruto).toHaveLength(2);
  });
});

describe('cuantizar', () => {
  it('a fuerza 1 clava los golpes en la rejilla', () => {
    const salida = cuantizar([g(ms(20)), g(0.5 - ms(15)), g(1.25 + ms(30))], cuadrar, ctx);
    expect(salida.map((x) => x.beat)).toEqual([0, 0.5, 1.25].map((b) => expect.closeTo(b, 9)));
  });

  it('a fuerza 0,5 deja el golpe a mitad de camino', () => {
    const [salida] = cuantizar([g(0.5 + ms(40))], { ...cuadrar, fuerza: 0.5 }, ctx);
    expect(salida.beat).toBeCloseTo(0.5 + ms(20), 9);
  });

  it('con swing a 1 el paso impar cae en el tresillo', () => {
    const [salida] = cuantizar([g(0.5 + 0.01)], { ...cuadrar, rejilla: 0.5, swing: 1 }, ctx);
    expect(salida.beat).toBeCloseTo(0.5 + 0.5 / 3, 9);
  });

  it('la ventana respeta lo que cae lejos de la rejilla', () => {
    const lejos = 0.25 * 0.4; // a 0,4 pasos de la rejilla
    const [quieto] = cuantizar([g(lejos)], { ...cuadrar, ventana: 0.5 }, ctx);
    expect(quieto.beat).toBeCloseTo(lejos, 9);
    const [movido] = cuantizar([g(lejos)], { ...cuadrar, ventana: 1 }, ctx);
    expect(movido.beat).toBeCloseTo(0, 9);
  });

  it('usa la rejilla del proyecto aunque el clip empiece desplazado', () => {
    // El clip empieza en el pulso 0,1: su golpe en 0 está en el 0,1 absoluto.
    const [salida] = cuantizar([g(0)], cuadrar, { bpm: BPM, inicioBeat: 0.1 });
    expect(0.1 + salida.beat).toBeCloseTo(0, 9);
  });

  it('con plantilla de shuffle lleva la corchea de detrás al tresillo y le baja la fuerza', () => {
    const [primero, segundo] = cuantizar([g(0, 42, 100), g(0.5, 42, 100)], { ...cuadrar, plantilla: 'shuffle' }, ctx);
    expect(primero.beat).toBeCloseTo(0, 9);
    expect(segundo.beat).toBeCloseTo(0.5 + 0.5 * 0.333, 6);
    expect(segundo.vel).toBeLessThan(primero.vel);
  });

  it('todas las plantillas tienen tantos desfases como fuerzas y una rejilla válida', () => {
    expect(PLANTILLAS.length).toBeGreaterThanOrEqual(4);
    for (const p of PLANTILLAS) {
      expect(p.desfase.length).toBe(p.vel.length);
      expect(p.rejilla).toBeGreaterThan(0);
      expect((p.desfase.length * p.rejilla) % 1).toBeCloseTo(0, 6);
    }
  });
});

describe('humanizar', () => {
  const recto = Array.from({ length: 64 }, (_, i) => g(i * 0.25, i % 2 ? 42 : 36, 100));

  it('mueve los golpes como mucho unos milisegundos y siempre igual con la misma semilla', () => {
    const a = humanizar(recto, { cantidad: 1, semilla: 7 }, { bpm: BPM });
    const b = humanizar(recto, { cantidad: 1, semilla: 7 }, { bpm: BPM });
    expect(a).toEqual(b);
    const desvios = a.map((x, i) => Math.abs(x.beat - recto[i].beat) / ms(1));
    expect(Math.max(...desvios)).toBeLessThan(30);
    expect(desvios.some((d) => d > 1)).toBe(true);
  });

  it('el desvío tiene memoria (1/f): dos golpes seguidos se parecen más que dos al azar', () => {
    const r = ruidoRosa(4096, 3);
    let vecinos = 0;
    let lejanos = 0;
    for (let i = 1; i < r.length; i++) vecinos += Math.abs(r[i] - r[i - 1]);
    for (let i = 512; i < r.length; i++) lejanos += Math.abs(r[i] - r[i - 512]);
    expect(vecinos / (r.length - 1)).toBeLessThan((lejanos / (r.length - 512)) * 0.85);
  });

  it('los golpes que caen juntos se mueven juntos', () => {
    const acorde = [g(1, 60), g(1, 64), g(1, 67)];
    const salida = humanizar(acorde, { cantidad: 1, semilla: 11 }, { bpm: BPM });
    expect(new Set(salida.map((x) => x.beat.toFixed(9))).size).toBe(1);
  });

  it('a cantidad 0 no cambia nada', () => {
    expect(humanizar(recto, { cantidad: 0, semilla: 1 }, { bpm: BPM })).toEqual(recto);
  });
});

describe('procesarGolpes', () => {
  it('limpia, cuadra y humaniza sin tocar el bruto, y nunca deja golpes antes del clip', () => {
    const bruto = [g(ms(5)), g(ms(15)), g(0.5 + ms(25)), g(1 - ms(10))];
    const copia = JSON.parse(JSON.stringify(bruto));
    const salida = procesarGolpes(
      bruto,
      { limpiar: true, cuadrar, humanizar: { cantidad: 0.3, semilla: 2 } },
      ctx,
    );
    expect(bruto).toEqual(copia);
    expect(salida).toHaveLength(3);
    expect(salida.every((x) => x.beat >= 0)).toBe(true);
  });
});

describe('rejillaSugerida y diagnosticar', () => {
  it('reconoce corcheas, semicorcheas y tresillos', () => {
    const corcheas = Array.from({ length: 16 }, (_, i) => g(i * 0.5 + (i % 3 === 0 ? ms(12) : -ms(8))));
    expect(rejillaSugerida(corcheas, 0)).toBe(0.5);
    const semis = Array.from({ length: 16 }, (_, i) => g(i * 0.25 + (i % 2 ? ms(10) : 0)));
    expect(rejillaSugerida(semis, 0)).toBe(0.25);
    const tresillos = Array.from({ length: 12 }, (_, i) => g(i / 3 + ms(6)));
    expect(rejillaSugerida(tresillos, 0)).toBeCloseTo(1 / 3, 9);
  });

  it('con pocos golpes no se arriesga: semicorcheas', () => {
    expect(rejillaSugerida([g(0), g(0.147)], 0)).toBe(0.25);
  });

  it('dice en qué pulso arrastras', () => {
    // Cuatro compases a negras; el 3 siempre llega 40 ms tarde.
    const golpes = Array.from({ length: 16 }, (_, i) => g(i + (i % 4 === 2 ? ms(40) : 0)));
    const d = diagnosticar(golpes, { ...ctx, pulsosPorCompas: 4, rejilla: 1 });
    expect(d.peorPulso?.pulso).toBe(3);
    expect(d.peorPulso?.ms).toBeCloseTo(40, 0);
    expect(d.desvioMs).toBeGreaterThan(0);
  });
});
