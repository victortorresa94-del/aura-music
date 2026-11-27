import { describe, expect, it } from 'vitest';
import { creditosDeBoceto, creditosDeReceta, textoCreditos } from './precios';

describe('precios de bolsillo', () => {
  it('una canción de Lyria 3 Pro cuesta 6 créditos, como en aura Studio', () => {
    expect(creditosDeReceta({ tipo: 'cancion', duracionSeg: 150, motor: 'lyria3' })).toBe(6);
  });

  it('Lyria 3.5 cuesta 7 y el boceto de 30 s cuesta 3', () => {
    expect(creditosDeReceta({ tipo: 'cancion', duracionSeg: 150, motor: 'lyria-3.5' })).toBe(7);
    expect(creditosDeBoceto()).toBe(3);
  });

  it('un paisaje de una hora cuesta lo mismo que una canción: el móvil lo alarga', () => {
    const hora = creditosDeReceta({ tipo: 'paisaje', duracionSeg: 3600, motor: 'lyria3' });
    const cancion = creditosDeReceta({ tipo: 'cancion', duracionSeg: 150, motor: 'lyria3' });
    expect(hora).toBe(cancion);
  });

  it('MiniMax cobra por segundo: 3 min son 25 créditos', () => {
    expect(creditosDeReceta({ tipo: 'cancion', duracionSeg: 180, motor: 'minimax-music-3' })).toBe(25);
  });

  it('el motor falso no gasta y lo dice', () => {
    expect(creditosDeReceta({ tipo: 'cancion', duracionSeg: 150, motor: 'falso' })).toBe(0);
    expect(textoCreditos(0)).toBe('Gratis');
    expect(textoCreditos(1)).toBe('1 crédito');
    expect(textoCreditos(6)).toBe('6 créditos');
  });
});
