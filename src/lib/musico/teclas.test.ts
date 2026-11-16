import { describe, expect, it } from 'vitest';
import type { AcordeEnTiempo } from './acordes';
import { colocarRitmo, ritmosParaTempo, tempoParaRitmo, vaConTuTempo } from './bateria';
import { sintetizarTeclas } from './sintetizador';
import { enlazar, escribirTeclas } from './teclas';
import { claseDeNota, frecuencia } from './teoria';

const T = 0.6; // 100 BPM
const progresion: AcordeEnTiempo[] = [
  { inicio: 0, fin: 4 * T, acorde: { raiz: 9, calidad: 'menor' }, nombre: 'La m' },
  { inicio: 4 * T, fin: 8 * T, acorde: { raiz: 7, calidad: 'mayor' }, nombre: 'Sol' },
];
const base = { bpm: 100, fase: 0, duracion: 8 * T, humano: 0 };

describe('escribirTeclas', () => {
  it('el colchón da el acorde entero, una vez por acorde, y largo', () => {
    const notas = escribirTeclas(progresion, { ...base, estilo: 'colchon' });
    expect(notas).toHaveLength(6);
    const primero = notas.filter((n) => n.inicio < 0.01).map((n) => claseDeNota(n.midi)).sort();
    expect(primero).toEqual([0, 4, 9]); // La, Do, Mi
    expect(notas[0].duracion).toBeGreaterThan(3 * T);
  });

  it('a golpes toca en cada pulso, en su sitio', () => {
    const notas = escribirTeclas(progresion, { ...base, estilo: 'pulsos' });
    const inicios = [...new Set(notas.map((n) => n.inicio.toFixed(3)))];
    expect(inicios).toHaveLength(8);
    inicios.forEach((inicio, k) => expect(Number(inicio)).toBeCloseTo(k * T, 3));
  });

  it('el arpegio va a corcheas', () => {
    const notas = escribirTeclas(progresion, { ...base, estilo: 'arpegio' });
    expect(notas).toHaveLength(16);
    expect(notas[1].inicio - notas[0].inicio).toBeCloseTo(T / 2, 5);
  });

  it('enlaza las voces: de La m a Sol ningún dedo salta más de tres semitonos', () => {
    const lam = enlazar({ raiz: 9, calidad: 'menor' }, null);
    const sol = enlazar({ raiz: 7, calidad: 'mayor' }, lam);
    sol.forEach((n, i) => expect(Math.abs(n - lam[i])).toBeLessThanOrEqual(3));
  });

  it('respeta la fase: el primer acorde cae en el primer pulso de la toma', () => {
    const desplazada = progresion.map((a) => ({ ...a, inicio: a.inicio + 0.25, fin: a.fin + 0.25 }));
    const notas = escribirTeclas(desplazada, { ...base, fase: 0.25, duracion: 8 * T + 0.25, estilo: 'pulsos' });
    expect(notas[0].inicio).toBeCloseTo(0.25, 3);
  });
});

describe('sintetizarTeclas', () => {
  it('suena, no satura y la nota está donde tiene que estar', () => {
    const sr = 16000;
    const audio = sintetizarTeclas([{ inicio: 0, duracion: 1, midi: 69, velocidad: 0.8 }], {
      sampleRate: sr,
      duracion: 1.2,
    });
    const pico = audio.reduce((m, x) => Math.max(m, Math.abs(x)), 0);
    expect(pico).toBeGreaterThan(0.05);
    expect(pico).toBeLessThanOrEqual(1);
    // Correlación con un seno a 440 Hz frente a uno a 466 Hz (medio tono arriba).
    const energia = (f: number) => {
      let re = 0;
      let im = 0;
      for (let i = 0; i < sr; i++) {
        re += audio[i] * Math.cos((2 * Math.PI * f * i) / sr);
        im += audio[i] * Math.sin((2 * Math.PI * f * i) / sr);
      }
      return Math.hypot(re, im);
    };
    expect(energia(frecuencia(69))).toBeGreaterThan(5 * energia(frecuencia(70)));
  });

  it('el colchón entra despacio', () => {
    const sr = 16000;
    const audio = sintetizarTeclas([{ inicio: 0, duracion: 1, midi: 60, velocidad: 1 }], {
      sampleRate: sr,
      duracion: 1,
      timbre: 'colchon',
    });
    const max = (a: number, b: number) => audio.subarray(a, b).reduce((m, x) => Math.max(m, Math.abs(x)), 0);
    expect(max(0, 160)).toBeLessThan(max(2400, 3200));
  });
});

describe('batería', () => {
  it('busca el tempo del ritmo al doble o a la mitad antes que forzarlo', () => {
    expect(tempoParaRitmo(96, [70, 160])).toBe(96);
    expect(tempoParaRitmo(100, [160, 260])).toBe(200);
    expect(tempoParaRitmo(180, [60, 110])).toBe(90);
    expect(tempoParaRitmo(40, [160, 260])).toBe(40);
  });

  it('ordena los ritmos por lo bien que van con tu tempo', () => {
    const ritmos = ritmosParaTempo(96);
    expect(ritmos[0].id).toBe('pop');
    expect(vaConTuTempo(96, ritmos[0])).toBe(true);
    expect(ritmos.findIndex((r) => r.id === 'pop')).toBeLessThan(ritmos.findIndex((r) => r.id === 'balada68'));
  });

  it('pone el primer golpe en el primer pulso de la toma', () => {
    const sr = 1000;
    const ritmo = new Float32Array(5000);
    ritmo[0] = 1;
    const colocado = colocarRitmo(ritmo, sr, { fase: 0.25, bpm: 100, duracion: 3 });
    expect(colocado).toHaveLength(3000);
    expect(colocado[250]).toBe(1);
    expect(colocado.subarray(0, 250).every((x) => x === 0)).toBe(true);
  });
});
