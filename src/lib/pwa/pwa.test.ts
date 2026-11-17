import { describe, expect, it } from 'vitest';
import { sePuedeActualizar } from './actualizacion';
import { leerCompartido } from './compartir';
import { plataformaDe } from './instalacion';

describe('sePuedeActualizar', () => {
  it('solo con el transporte parado y nada a medias', () => {
    expect(sePuedeActualizar('stopped', false)).toBe(true);
    expect(sePuedeActualizar('recording', false)).toBe(false);
    expect(sePuedeActualizar('countin', false)).toBe(false);
    expect(sePuedeActualizar('playing', false)).toBe(false);
    expect(sePuedeActualizar('stopped', true)).toBe(false);
  });
});

describe('leerCompartido', () => {
  it('reconoce lo que deja el service worker y lo que deja el servidor', () => {
    expect(leerCompartido('?compartido=1')).toBe('recibido');
    expect(leerCompartido('?compartido=vacio')).toBe('vacio');
    expect(leerCompartido('?compartido=sin-app')).toBe('sin-app');
    expect(leerCompartido('?grabar=1')).toBeNull();
    expect(leerCompartido('?compartido=otra-cosa')).toBeNull();
  });
});

describe('plataformaDe', () => {
  it('distingue iPhone, iPad que se hace pasar por Mac, Android y el resto', () => {
    const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_1 like Mac OS X) AppleWebKit/605.1.15 Version/26.1 Mobile/15E148 Safari/604.1';
    const ipad = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/26.1 Safari/605.1.15';
    const android = 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/157.0 Mobile Safari/537.36';
    expect(plataformaDe(iphone, 5)).toBe('iphone');
    expect(plataformaDe(ipad, 5)).toBe('iphone');
    expect(plataformaDe(ipad, 0)).toBe('otro');
    expect(plataformaDe(android, 5)).toBe('android');
  });
});
