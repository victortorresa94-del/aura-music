import { describe, expect, it } from 'vitest';
import { GROOVES } from '@/lib/daw/rhythm/grooves';
import { colocarEnBucle, vueltaDe, type EventoTocado } from './grabacion';
import { getLoop, golpesDeNivel, golpesParaPista, LOOPS, loopsDe, tieneNiveles, tonicaEnElBajo, vaConElTempo } from './loops';
import { getInstrumento } from './registro';

describe('biblioteca de loops', () => {
  it('trae los estilos pedidos y los ritmos que ya había, sin duplicarlos', () => {
    const estilos = new Set(LOOPS.map((l) => l.estilo));
    for (const e of ['Pop', 'Rock', 'Funk', 'Reguetón', 'Flamenco', 'Lo-fi']) expect(estilos.has(e)).toBe(true);
    for (const g of GROOVES) expect(getLoop(`ritmo-${g.id}`)).not.toBeNull();
    expect(new Set(LOOPS.map((l) => l.id)).size).toBe(LOOPS.length);
  });

  it('cada golpe cae dentro de su loop y en una nota que su kit sabe tocar', () => {
    for (const loop of LOOPS) {
      const largo = loop.pulsosPorCompas * loop.compases;
      expect(loop.golpes.length).toBeGreaterThan(0);
      for (const g of loop.golpes) {
        expect(g.beat).toBeGreaterThanOrEqual(0);
        expect(g.beat).toBeLessThan(largo);
        expect(g.vel).toBeGreaterThanOrEqual(1);
        expect(g.vel).toBeLessThanOrEqual(127);
      }
      const def = getInstrumento(loop.instrumento);
      if (def.pads) {
        const notas = new Set(def.pads.map((p) => p.nota));
        for (const g of loop.golpes) expect(notas.has(g.nota), `${loop.id}: nota ${g.nota}`).toBe(true);
      }
    }
  });

  it('el flamenco va en el cajón y en el compás de doce', () => {
    const bulerias = getLoop('ritmo-bulerias-cajon');
    expect(bulerias?.instrumento).toBe('cajon');
    expect(bulerias?.pulsosPorCompas).toBe(12);
    const rumba = getLoop('ritmo-rumba');
    expect(rumba?.pulsosPorCompas).toBe(4);
    expect(rumba?.compases).toBe(2);
  });

  it('los niveles: solo bombo, bombo y caja, completo', () => {
    const rock = getLoop('rock')!;
    expect(tieneNiveles(rock)).toBe(true);
    expect(golpesDeNivel(rock, 'bombo').every((g) => g.nota === 36)).toBe(true);
    expect(golpesDeNivel(rock, 'bombo-caja').some((g) => g.nota === 38)).toBe(true);
    expect(golpesDeNivel(rock, 'completo')).toHaveLength(rock.golpes.length);
    expect(tieneNiveles(loopsDe('bajo')[0])).toBe(false);
  });

  it('se repite hasta cubrir los compases pedidos', () => {
    const rock = getLoop('rock')!;
    const { golpes, pulsos } = golpesParaPista(rock, { veces: 4 });
    expect(pulsos).toBe(16);
    expect(golpes).toHaveLength(rock.golpes.length * 4);
    const lofi = getLoop('lofi')!; // dos compases
    expect(golpesParaPista(lofi, { veces: 4 }).pulsos).toBe(16);
  });

  it('el bajo va en la tonalidad del proyecto, en su registro', () => {
    expect(tonicaEnElBajo(4)).toBe(28);
    expect(tonicaEnElBajo(9)).toBe(33);
    const quinta = getLoop('bajo-raiz-quinta')!;
    const { golpes } = golpesParaPista(quinta, { veces: 1, tonica: 9 });
    expect(golpes[0].nota).toBe(33);
    expect(golpes[1].nota).toBe(40);
  });

  it('avisa del tempo sin impedir nada', () => {
    const trap = getLoop('trap')!;
    expect(vaConElTempo(trap, 140)).toBe(true);
    expect(vaConElTempo(trap, 70)).toBe(false);
  });
});

describe('grabar en bucle', () => {
  const ev = (t: number, nota = 36): EventoTocado => ({ instrumento: 'bateria-acustica', nota, vel: 100, t, dur: null, pos: null });

  it('pliega cada golpe dentro del bucle, también lo tocado justo antes de dar la vuelta', () => {
    // Bucle de 2 s desde el segundo 4 (un compás a 120 BPM).
    const clip = colocarEnBucle([ev(0), ev(0), ev(0)], [4.5, 6.25, 3.99], { bpm: 120, desde: 4, largo: 2 });
    expect(clip?.inicio).toBe(4);
    expect(clip?.pulsos).toBe(4);
    const beats = clip!.golpes.map((g) => Number(g.beat.toFixed(2)));
    expect(beats).toEqual([0.5, 1, 3.98]);
  });

  it('sabe en qué vuelta cayó cada golpe', () => {
    const inicios = [10, 12, 14];
    expect(vueltaDe(10.5, inicios)).toBe(0);
    expect(vueltaDe(12, inicios)).toBe(1);
    expect(vueltaDe(15.9, inicios)).toBe(2);
  });
});
