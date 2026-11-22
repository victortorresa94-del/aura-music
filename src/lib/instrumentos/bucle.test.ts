import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// El reproductor solo necesita el reloj del contexto y `atril.reproducir`;
// las voces y las muestras no pintan nada aquí (y piden un navegador).
vi.mock('./voz', () => ({ crearVoz: vi.fn(), precalentar: vi.fn(), timbreDeBuffer: vi.fn() }));
vi.mock('./muestras', () => ({ cargarPaquete: vi.fn(), muestrasListas: vi.fn() }));

import type { Atril } from './directo';
import { ReproductorDeBucle } from './directo';
import { getLoop, golpesParaPista } from './loops';

/**
 * Lo que hay que garantizar del bucle que suena mientras escuchas o grabas:
 * cada golpe suena una vez por vuelta y en su sitio, aunque el temporizador
 * vaya a trompicones; y si se duerme, lo atrasado se salta en vez de
 * amontonarse.
 */
describe('ReproductorDeBucle', () => {
  // En Node no hay `window`: el del navegador es el global, con los temporizadores falsos.
  beforeEach(() => {
    vi.stubGlobal('window', globalThis);
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  function montar(intervaloMs: number, segundos: number) {
    const ctx = { currentTime: 0 } as unknown as AudioContext;
    const sonados: { nota: number; cuando: number; tic: number }[] = [];
    const atril = {
      reproducir: (_id: string, nota: number, _vel: number, cuando: number) => sonados.push({ nota, cuando, tic: ctx.currentTime }),
    } as unknown as Atril;
    const rock = getLoop('rock')!;
    const { golpes, pulsos } = golpesParaPista(rock, { veces: rock.compases });
    const bpm = 120;
    const pulso = 60 / bpm;
    const t0 = 0.05;
    // El reloj del contexto avanza con los temporizadores falsos.
    const r = new ReproductorDeBucle(atril, ctx, { id: 'bateria-acustica', largo: pulsos, bpm, fase: (t) => (t - t0) / pulso, golpes: () => golpes });
    const pasos = Math.round((segundos * 1000) / intervaloMs);
    for (let i = 0; i < pasos; i++) {
      (ctx as unknown as { currentTime: number }).currentTime += intervaloMs / 1000;
      vi.advanceTimersByTime(intervaloMs);
    }
    r.parar();
    return { sonados, golpes, pulso, t0, pulsos };
  }

  it('suena cada golpe una vez por vuelta y en su sitio', () => {
    // Dos vueltas de rock a 120 (2 s por compás de 4) y un poco más.
    const { sonados, golpes, pulso, t0, pulsos } = montar(25, 4.2);
    const vueltaS = pulsos * pulso;
    const enDosVueltas = sonados.filter((s) => s.cuando < t0 + 2 * vueltaS - 1e-6);
    expect(enDosVueltas).toHaveLength(golpes.length * 2);
    // Cada uno cae donde dice su pulso, sin repetirse.
    const esperados = [0, 1].flatMap((v) => golpes.map((g) => +(t0 + (v * pulsos + g.beat) * pulso).toFixed(4))).sort();
    expect(enDosVueltas.map((s) => +s.cuando.toFixed(4)).sort()).toEqual(esperados);
  });

  it('si el temporizador se duerme, no amontona lo atrasado', () => {
    // Un tic por segundo (lo que hace el navegador en segundo plano).
    const { sonados } = montar(1000, 4);
    // Nada se programa para antes del tic que lo programa: lo que se perdió
    // mientras dormía, se pierde, pero no suena todo junto y a destiempo.
    expect(sonados.length).toBeGreaterThan(0);
    for (const s of sonados) expect(s.cuando).toBeGreaterThanOrEqual(s.tic - 1e-9);
  });
});
