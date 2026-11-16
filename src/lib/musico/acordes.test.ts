import { describe, expect, it } from 'vitest';
import { rasgueo, SR } from '@/test/senales';
import { detectarAcordes, resumenProgresion } from './acordes';
import { estimarFase } from './pulso';

const LA_M = { raiz: 9, calidad: 'menor' as const };
const SOL = { raiz: 7, calidad: 'mayor' as const };
const FA = { raiz: 5, calidad: 'mayor' as const };
const MI = { raiz: 4, calidad: 'mayor' as const };
const DO = { raiz: 0, calidad: 'mayor' as const };

describe('detectarAcordes', () => {
  it('oye la cadencia andaluza a 100 BPM', () => {
    const toma = rasgueo(
      [LA_M, SOL, FA, MI].map((acorde) => ({ acorde, pulsos: 4 })),
      100,
    );
    const acordes = detectarAcordes(toma, SR, { bpm: 100, fase: 0 });
    expect(acordes.map((a) => a.nombre)).toEqual(['La m', 'Sol', 'Fa', 'Mi']);
    // Cada acorde dura cuatro pulsos: 2,4 s.
    expect(acordes[1].inicio).toBeCloseTo(2.4, 1);
  });

  it('resume una progresión que da vueltas en una sola vuelta', () => {
    const toma = rasgueo(
      [DO, SOL, LA_M, FA, DO, SOL, LA_M, FA].map((acorde) => ({ acorde, pulsos: 2 })),
      110,
    );
    const acordes = detectarAcordes(toma, SR, { bpm: 110, fase: 0, tonalidad: { tonica: 0, modo: 'mayor' } });
    expect(resumenProgresion(acordes)).toBe('Do · Sol · La m · Fa');
  });

  it('no se inventa acordes en el silencio', () => {
    const acordes = detectarAcordes(new Float32Array(SR * 3), SR, { bpm: 100, fase: 0 });
    expect(acordes.every((a) => a.acorde === null)).toBe(true);
  });
});

describe('estimarFase', () => {
  it('encuentra el primer pulso aunque la toma empiece tarde', () => {
    const toma = rasgueo([{ acorde: LA_M, pulsos: 8 }], 100, 0.25);
    expect(estimarFase(toma, SR, 100)).toBeCloseTo(0.25, 1);
  });
});
