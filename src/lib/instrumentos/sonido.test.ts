import { describe, expect, it } from 'vitest';
import { MEZCLA_NEUTRA } from '@/lib/daw/mezcla/tipos';
import { mezclaDeSonido, SONIDO_POR_DEFECTO, sonidoDe, VOLUMEN_MAXIMO } from './sonido';

describe('el panel «Sonido» de «Tocar»', () => {
  it('lo guardado se normaliza: fuera de rango o a medias, lo de siempre', () => {
    expect(sonidoDe(null)).toEqual(SONIDO_POR_DEFECTO);
    expect(sonidoDe({ volumen: 9, reverb: -1, brillo: 40 })).toEqual({ volumen: VOLUMEN_MAXIMO, reverb: 0, brillo: 12 });
    expect(sonidoDe({ reverb: 0.4 })).toEqual({ ...SONIDO_POR_DEFECTO, reverb: 0.4 });
    expect(sonidoDe({ volumen: Number.NaN }).volumen).toBe(SONIDO_POR_DEFECTO.volumen);
  });

  it('sin tocar nada, la pista grabada queda neutra; con reverb y brillo, en su mezcla', () => {
    expect(mezclaDeSonido(SONIDO_POR_DEFECTO)).toBeNull();
    expect(mezclaDeSonido({ volumen: 0.7, reverb: 0.35, brillo: -4 })).toEqual({ ...MEZCLA_NEUTRA, reverb: 0.35, agudos: -4 });
  });
});
