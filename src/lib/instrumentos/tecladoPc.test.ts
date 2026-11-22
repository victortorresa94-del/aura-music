import { describe, expect, it } from 'vitest';
import { accionDeTecla, asignar, doDeOctava, etiquetas, mapaPorDefecto, teclaAsignable } from './tecladoPc';

describe('teclado del ordenador', () => {
  it('en la batería, lo que más se toca va en la fila de en medio', () => {
    // La rejilla va de arriba abajo: el pad 12 es el bombo, el 14 la caja.
    expect(accionDeTecla('a', true)).toEqual({ tipo: 'pad', indice: 12 });
    expect(accionDeTecla('D', true)).toEqual({ tipo: 'pad', indice: 14 });
    expect(accionDeTecla('q', true)).toEqual({ tipo: 'pad', indice: 8 });
    expect(accionDeTecla('1', true)).toEqual({ tipo: 'pad', indice: 4 });
    expect(accionDeTecla('z', true)).toEqual({ tipo: 'pad', indice: 0 });
    expect(accionDeTecla('g', true)).toBeNull();
  });

  it('en lo demás es un piano, con Z y X para la octava', () => {
    expect(accionDeTecla('a', false)).toEqual({ tipo: 'nota', semitonos: 0 });
    expect(accionDeTecla('w', false)).toEqual({ tipo: 'nota', semitonos: 1 });
    expect(accionDeTecla('k', false)).toEqual({ tipo: 'nota', semitonos: 12 });
    expect(accionDeTecla('x', false)).toEqual({ tipo: 'octava', cambio: 1 });
    expect(doDeOctava(60, 0, [36, 96])).toBe(60);
    expect(doDeOctava(40, 0, [28, 60])).toBe(36);
    expect(doDeOctava(60, 5, [36, 96])).toBe(96);
  });

  it('asignar: una tecla por cosa, y lo escrito es lo que suena', () => {
    // La J pasa a ser el bombo: la A deja de serlo.
    const propio = asignar(mapaPorDefecto('pads'), 'J', 12);
    expect(accionDeTecla('j', true, propio)).toEqual({ tipo: 'pad', indice: 12 });
    expect(accionDeTecla('a', true, propio)).toBeNull();
    expect(etiquetas(propio).get(12)).toBe('J');
    // Darle a la S (era el aro) el bombo: el aro se queda sin tecla.
    const otra = asignar(propio, 's', 12);
    expect(etiquetas(otra).get(12)).toBe('S');
    expect(etiquetas(otra).has(13)).toBe(false);
  });

  it('una nota en la Z le quita la octava; las de mando no se asignan', () => {
    const propio = asignar(mapaPorDefecto('teclado'), 'z', 7);
    expect(accionDeTecla('z', false, propio)).toEqual({ tipo: 'nota', semitonos: 7 });
    expect(accionDeTecla('x', false, propio)).toEqual({ tipo: 'octava', cambio: 1 });
    expect(teclaAsignable('j')).toBe(true);
    for (const t of [' ', 'Enter', 'Escape', 'ArrowLeft']) expect(teclaAsignable(t)).toBe(false);
  });
});
