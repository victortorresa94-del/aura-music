import { describe, expect, it } from 'vitest';
import { anteriorIndice, armarCola, decidirAnterior, dondeEstoy, siguienteIndice } from './cola';

const todas = () => true;

describe('la cola del reproductor', () => {
  it('tocar desde una lista que la contiene: la lista entera y su sitio', () => {
    expect(armarCola('b', ['a', 'b', 'c'])).toEqual({ ids: ['a', 'b', 'c'], indice: 1 });
  });

  it('tocar suelta: sola; desde una lista que no la tiene: delante de la lista', () => {
    expect(armarCola('x')).toEqual({ ids: ['x'], indice: 0 });
    expect(armarCola('x', [])).toEqual({ ids: ['x'], indice: 0 });
    expect(armarCola('x', ['a', 'b'])).toEqual({ ids: ['x', 'a', 'b'], indice: 0 });
  });

  it('no comparte la lista de quien llama', () => {
    const lista = ['a', 'b'];
    const cola = armarCola('a', lista);
    cola.ids.push('z');
    expect(lista).toEqual(['a', 'b']);
  });

  it('siguiente salta lo que no se puede tocar y se acaba al final', () => {
    const cola = { ids: ['a', 'b', 'c', 'd'], indice: 0 };
    const jugable = (id: string) => id !== 'b';
    expect(siguienteIndice(cola, jugable)).toBe(2);
    expect(siguienteIndice({ ...cola, indice: 3 }, todas)).toBeNull();
    expect(siguienteIndice({ ids: ['a', 'b'], indice: 0 }, (id) => id === 'a')).toBeNull();
  });

  it('anterior salta lo que no se puede tocar y no pasa del principio', () => {
    const cola = { ids: ['a', 'b', 'c'], indice: 2 };
    expect(anteriorIndice(cola, (id) => id !== 'b')).toBe(0);
    expect(anteriorIndice({ ...cola, indice: 0 }, todas)).toBeNull();
  });

  it('«Anterior» vuelve al principio si la canción ya lleva un rato, si no va a la de antes', () => {
    const cola = { ids: ['a', 'b'], indice: 1 };
    expect(decidirAnterior(45, cola, todas)).toEqual({ tipo: 'reiniciar' });
    expect(decidirAnterior(1.2, cola, todas)).toEqual({ tipo: 'ir', indice: 0 });
    expect(decidirAnterior(1.2, { ...cola, indice: 0 }, todas)).toEqual({ tipo: 'reiniciar' });
  });

  it('dónde estoy: «2 de 3», y si hay algo antes o después', () => {
    expect(dondeEstoy({ ids: ['a', 'b', 'c'], indice: 1 })).toEqual({
      numero: 2,
      total: 3,
      hayAnterior: true,
      haySiguiente: true,
    });
    expect(dondeEstoy({ ids: ['a', 'b', 'c'], indice: 1 }, (id) => id === 'b')).toMatchObject({
      hayAnterior: false,
      haySiguiente: false,
    });
    expect(dondeEstoy({ ids: [], indice: 0 })).toEqual({ numero: 0, total: 0, hayAnterior: false, haySiguiente: false });
  });
});
