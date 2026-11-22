import { describe, expect, it } from 'vitest';
import { comandoDeTecla, escribiendo, haceCuanto, textoAtajo, type Tecla } from './comandos';

const tecla = (key: string, extra: Partial<Tecla> = {}): Tecla => ({
  key,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  altKey: false,
  ...extra,
});

describe('comandoDeTecla', () => {
  it('reconoce los atajos de Archivo con Ctrl en Windows', () => {
    expect(comandoDeTecla(tecla('n', { ctrlKey: true }), false)).toBe('nueva');
    expect(comandoDeTecla(tecla('o', { ctrlKey: true }), false)).toBe('abrir');
    expect(comandoDeTecla(tecla('s', { ctrlKey: true }), false)).toBe('guardar');
    expect(comandoDeTecla(tecla('W', { ctrlKey: true }), false)).toBe('cerrar');
  });

  it('distingue Guardar de Guardar como copia por la Mayúscula', () => {
    expect(comandoDeTecla(tecla('S', { ctrlKey: true, shiftKey: true }), false)).toBe('guardarCopia');
  });

  it('rehace con Ctrl+Mayús+Z y con Ctrl+Y', () => {
    expect(comandoDeTecla(tecla('z', { ctrlKey: true }), false)).toBe('deshacer');
    expect(comandoDeTecla(tecla('Z', { ctrlKey: true, shiftKey: true }), false)).toBe('rehacer');
    expect(comandoDeTecla(tecla('y', { ctrlKey: true }), false)).toBe('rehacer');
  });

  it('en Mac usa ⌘ y no reacciona a Ctrl', () => {
    expect(comandoDeTecla(tecla('s', { metaKey: true }), true)).toBe('guardar');
    expect(comandoDeTecla(tecla('s', { ctrlKey: true }), true)).toBeNull();
  });

  it('no dispara nada sin modificador ni con Alt', () => {
    expect(comandoDeTecla(tecla('s'), false)).toBeNull();
    expect(comandoDeTecla(tecla('s', { ctrlKey: true, altKey: true }), false)).toBeNull();
  });
});

describe('textoAtajo', () => {
  it('escribe el atajo a la manera de cada sistema', () => {
    expect(textoAtajo('guardarCopia', false)).toBe('Ctrl+Mayús+S');
    expect(textoAtajo('guardarCopia', true)).toBe('⇧⌘S');
    expect(textoAtajo('ajustes', false)).toBe('Ctrl+,');
  });

  it('devuelve null si el comando no tiene atajo', () => {
    expect(textoAtajo('exportarWav', false)).toBeNull();
  });
});

describe('haceCuanto', () => {
  const ahora = 1_800_000_000_000;
  it('cuenta segundos, minutos, horas y días', () => {
    expect(haceCuanto(ahora - 500, ahora)).toBe('ahora mismo');
    expect(haceCuanto(ahora - 3_000, ahora)).toBe('hace 3 s');
    expect(haceCuanto(ahora - 125_000, ahora)).toBe('hace 2 min');
    expect(haceCuanto(ahora - 3_600_000, ahora)).toBe('hace 1 hora');
    expect(haceCuanto(ahora - 5 * 3_600_000, ahora)).toBe('hace 5 horas');
    expect(haceCuanto(ahora - 26 * 3_600_000, ahora)).toBe('ayer');
    expect(haceCuanto(ahora - 72 * 3_600_000, ahora)).toBe('hace 3 días');
  });

  it('no dice «hace -1 s» si el reloj va un poco por detrás', () => {
    expect(haceCuanto(ahora + 2_000, ahora)).toBe('ahora mismo');
  });
});

describe('escribiendo', () => {
  it('reconoce los campos de texto', () => {
    expect(escribiendo({ tagName: 'INPUT' })).toBe(true);
    expect(escribiendo({ tagName: 'TEXTAREA' })).toBe(true);
    expect(escribiendo({ tagName: 'DIV', isContentEditable: true })).toBe(true);
    expect(escribiendo({ tagName: 'BUTTON' })).toBe(false);
    expect(escribiendo(null)).toBe(false);
  });
});
