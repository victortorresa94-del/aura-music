import { describe, expect, it } from 'vitest';
import { ATAJOS, atajoDe, escribiendoEn, teclaDelMando, teclasVisibles, type Pulsacion } from './atajos';

const tecla = (key: string, mods: Partial<Pulsacion> = {}): Pulsacion => ({
  key,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  altKey: false,
  ...mods,
});

describe('atajoDe', () => {
  it('reconoce los de toda la vida', () => {
    expect(atajoDe(tecla(' '))).toBe('reproducir');
    expect(atajoDe(tecla('r'))).toBe('grabar');
    expect(atajoDe(tecla('Delete'))).toBe('borrar');
    expect(atajoDe(tecla('Backspace'))).toBe('borrar');
    expect(atajoDe(tecla('s'))).toBe('dividir');
    expect(atajoDe(tecla('m'))).toBe('silenciar');
    expect(atajoDe(tecla('ArrowUp'))).toBe('pista-arriba');
    expect(atajoDe(tecla('ArrowDown'))).toBe('pista-abajo');
    expect(atajoDe(tecla('Home'))).toBe('inicio');
    expect(atajoDe(tecla('+'))).toBe('zoom-mas');
    expect(atajoDe(tecla('-'))).toBe('zoom-menos');
  });

  it('Mayús+S es solo, con la S en mayúscula o no', () => {
    expect(atajoDe(tecla('S', { shiftKey: true }))).toBe('solo');
    expect(atajoDe(tecla('s', { shiftKey: true }))).toBe('solo');
    expect(atajoDe(tecla('R', { shiftKey: true }))).toBeNull();
  });

  it('Ctrl y Cmd valen lo mismo', () => {
    for (const mod of [{ ctrlKey: true }, { metaKey: true }]) {
      expect(atajoDe(tecla('z', mod))).toBe('deshacer');
      expect(atajoDe(tecla('Z', { ...mod, shiftKey: true }))).toBe('rehacer');
      expect(atajoDe(tecla('y', mod))).toBe('rehacer');
      expect(atajoDe(tecla('c', mod))).toBe('copiar');
      expect(atajoDe(tecla('x', mod))).toBe('cortar');
      expect(atajoDe(tecla('v', mod))).toBe('pegar');
      expect(atajoDe(tecla('d', mod))).toBe('duplicar');
    }
  });

  it('con Ctrl, R o S no graban ni cortan (Ctrl+R recarga, Ctrl+S guarda)', () => {
    expect(atajoDe(tecla('r', { ctrlKey: true }))).toBeNull();
    expect(atajoDe(tecla('s', { ctrlKey: true }))).toBeNull();
    expect(atajoDe(tecla('m', { altKey: true }))).toBeNull();
  });
});

describe('dónde no cuentan', () => {
  it('mientras escribes no hay atajos', () => {
    expect(escribiendoEn({ tagName: 'INPUT', type: 'text' })).toBe(true);
    expect(escribiendoEn({ tagName: 'TEXTAREA' })).toBe(true);
    expect(escribiendoEn({ tagName: 'DIV', isContentEditable: true })).toBe(true);
    expect(escribiendoEn({ tagName: 'INPUT', type: 'range' })).toBe(false);
    expect(escribiendoEn({ tagName: 'BUTTON' })).toBe(false);
    expect(escribiendoEn(null)).toBe(false);
  });

  it('en un deslizador las flechas mueven el deslizador', () => {
    const deslizador = { tagName: 'DIV', getAttribute: (n: string) => (n === 'role' ? 'slider' : null) };
    expect(teclaDelMando(deslizador, 'pista-arriba')).toBe(true);
    expect(teclaDelMando(deslizador, 'inicio')).toBe(true);
    expect(teclaDelMando(deslizador, 'reproducir')).toBe(false);
    expect(teclaDelMando({ tagName: 'BUTTON', getAttribute: () => null }, 'pista-arriba')).toBe(false);
  });
});

describe('la lista', () => {
  it('cada atajo tiene nombre, grupo y teclas, y no se repite', () => {
    const ids = ATAJOS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const a of ATAJOS) {
      expect(a.nombre.length).toBeGreaterThan(2);
      expect(a.teclas.length).toBeGreaterThan(0);
    }
  });

  it('se escribe a la manera de cada sistema', () => {
    expect(teclasVisibles('rehacer', false)).toBe('Ctrl+Mayús+Z');
    expect(teclasVisibles('rehacer', true)).toBe('⌘⇧Z');
    expect(teclasVisibles('borrar', true)).toBe('⌦');
  });
});
