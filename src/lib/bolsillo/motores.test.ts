import { describe, expect, it } from 'vitest';
import { MOTORES, alternativas, elegirMotor, motor, preciosPorMotor, sirvePara } from './motores';
import type { Receta } from './tipos';

const base: Receta = { tipo: 'cancion', frase: 'algo', conVoz: true, duracionSeg: 150, motor: 'lyria3' };

describe('los motores de música', () => {
  it('están todos los de aura Studio, sin repetir', () => {
    const ids = MOTORES.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ['lyria3', 'lyria-3.5', 'lyria3-base', 'lyria2', 'eleven-music', 'minimax-music-3', 'minimax-music', 'diffrhythm', 'sonilo', 'stable-audio', 'ace-step', 'cassette'] as const) {
      expect(ids).toContain(id);
    }
  });

  it('por defecto, Lyria 3 Pro', () => {
    expect(elegirMotor(base)).toBe('lyria3');
    expect(elegirMotor({ ...base, conVoz: false })).toBe('lyria3');
    expect(elegirMotor({ ...base, tipo: 'paisaje', conVoz: false })).toBe('lyria3');
  });

  it('un boceto va por Lyria 3 y una letra literal por MiniMax Music 3', () => {
    expect(elegirMotor(base, { boceto: true })).toBe('lyria3-base');
    expect(elegirMotor({ ...base, letra: 'Feliz cumpleaños, Carmen' })).toBe('minimax-music-3');
    expect(elegirMotor(base, { falso: true })).toBe('falso');
  });

  it('un motor que solo es instrumental no sirve para cantar, y uno que pide letra no sirve sin ella', () => {
    expect(sirvePara(motor('stable-audio'), base)).toBe(false);
    expect(sirvePara(motor('stable-audio'), { ...base, conVoz: false })).toBe(true);
    expect(sirvePara(motor('minimax-music-3'), base)).toBe(false);
    expect(sirvePara(motor('minimax-music-3'), { ...base, letra: 'hola' })).toBe(true);
  });

  it('Eleven Music está apagado hasta su sí y no sale como alternativa', () => {
    expect(motor('eleven-music').disponible).toBe(false);
    expect(alternativas(base).map((m) => m.id)).not.toContain('eleven-music');
  });

  it('«Prueba con otro motor» ofrece los que pueden hacer lo mismo y no el que ya usaste', () => {
    const otros = alternativas({ ...base, conVoz: false, tipo: 'paisaje' }).map((m) => m.id);
    expect(otros).not.toContain('lyria3');
    expect(otros).toContain('stable-audio');
    expect(otros).not.toContain('falso');
  });

  it('cada motor que sirve dice su precio', () => {
    const precios = preciosPorMotor(base);
    expect(precios.find((p) => p.motor.id === 'lyria3')?.creditos).toBe(6);
    expect(precios.every((p) => p.creditos >= 1)).toBe(true);
  });
});
