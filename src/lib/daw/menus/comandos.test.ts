import { describe, expect, it } from 'vitest';
import {
  ATAJOS,
  NOMBRES_DE_COMANDOS,
  SECCIONES_DE_ATAJOS,
  atajoPermitido,
  comandoDeTecla,
  escribiendo,
  haceCuanto,
  teclaDelMando,
  textoAtajo,
  type IdComando,
  type Tecla,
} from './comandos';

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

  it('no dispara nada con Alt, ni con una letra que no es de nadie', () => {
    expect(comandoDeTecla(tecla('q'), false)).toBeNull();
    expect(comandoDeTecla(tecla('s', { ctrlKey: true, altKey: true }), false)).toBeNull();
    expect(comandoDeTecla(tecla('m', { altKey: true }), false)).toBeNull();
  });
});

describe('los atajos de toda la vida de un DAW', () => {
  it('teclas sueltas: Espacio, R, S, M, Supr, flechas, Inicio y Fin', () => {
    expect(comandoDeTecla(tecla(' '), false)).toBe('reproducir');
    expect(comandoDeTecla(tecla('r'), false)).toBe('grabar');
    expect(comandoDeTecla(tecla('s'), false)).toBe('dividirClip');
    expect(comandoDeTecla(tecla('m'), false)).toBe('silenciarPista');
    expect(comandoDeTecla(tecla('Delete'), false)).toBe('borrarPista');
    expect(comandoDeTecla(tecla('Backspace'), false)).toBe('borrarPista');
    expect(comandoDeTecla(tecla('ArrowUp'), false)).toBe('pistaArriba');
    expect(comandoDeTecla(tecla('ArrowDown'), false)).toBe('pistaAbajo');
    expect(comandoDeTecla(tecla('ArrowLeft'), false)).toBe('compasAtras');
    expect(comandoDeTecla(tecla('ArrowRight'), false)).toBe('compasAdelante');
    expect(comandoDeTecla(tecla('Home'), false)).toBe('irAlPrincipio');
    expect(comandoDeTecla(tecla('End'), false)).toBe('irAlFinal');
    expect(comandoDeTecla(tecla('Escape'), false)).toBe('soltarPista');
  });

  it('Mayús+S es solo; Ctrl+S sigue siendo Guardar y Ctrl+R no graba', () => {
    expect(comandoDeTecla(tecla('S', { shiftKey: true }), false)).toBe('soloPista');
    expect(comandoDeTecla(tecla('s', { ctrlKey: true }), false)).toBe('guardar');
    expect(comandoDeTecla(tecla('r', { ctrlKey: true }), false)).toBeNull();
    expect(comandoDeTecla(tecla('R', { shiftKey: true }), false)).toBeNull();
  });

  it('el portapapeles con Ctrl en Windows y con ⌘ en Mac', () => {
    expect(comandoDeTecla(tecla('c', { ctrlKey: true }), false)).toBe('copiarPista');
    expect(comandoDeTecla(tecla('x', { ctrlKey: true }), false)).toBe('cortarPista');
    expect(comandoDeTecla(tecla('v', { ctrlKey: true }), false)).toBe('pegarPista');
    expect(comandoDeTecla(tecla('d', { ctrlKey: true }), false)).toBe('duplicarPista');
    expect(comandoDeTecla(tecla('v', { metaKey: true }), true)).toBe('pegarPista');
  });

  it('el zoom con el + y el − de cualquier teclado', () => {
    expect(comandoDeTecla(tecla('+'), false)).toBe('acercar');
    expect(comandoDeTecla(tecla('+', { shiftKey: true }), false)).toBe('acercar');
    expect(comandoDeTecla(tecla('='), false)).toBe('acercar');
    expect(comandoDeTecla(tecla('-'), false)).toBe('alejar');
    expect(comandoDeTecla(tecla('_', { shiftKey: true }), false)).toBe('alejar');
  });

  it('ninguna pulsación sirve a dos comandos', () => {
    const vistas = new Map<string, IdComando>();
    for (const [id, atajos] of Object.entries(ATAJOS) as [IdComando, { tecla: string; mod?: boolean; shift?: boolean }[]][]) {
      for (const a of atajos) {
        const clave = `${a.tecla}|${!!a.mod}|${!!a.shift}`;
        expect(vistas.get(clave) ?? id).toBe(id);
        vistas.set(clave, id);
      }
    }
  });

  it('la chuleta enseña todos los atajos, cada uno con su nombre', () => {
    const enLaChuleta = SECCIONES_DE_ATAJOS.flatMap((s) => s.ids);
    expect(new Set(enLaChuleta)).toEqual(new Set(Object.keys(ATAJOS)));
    for (const id of enLaChuleta) expect(NOMBRES_DE_COMANDOS[id]).toBeTruthy();
  });
});

describe('dónde valen', () => {
  it('con una hoja encima, Archivo y Deshacer sí; editar la línea de tiempo no', () => {
    expect(atajoPermitido('guardar', 'hoja')).toBe(true);
    expect(atajoPermitido('deshacer', 'hoja')).toBe(true);
    expect(atajoPermitido('reproducir', 'hoja')).toBe(true);
    expect(atajoPermitido('borrarPista', 'hoja')).toBe(false);
    expect(atajoPermitido('soltarPista', 'hoja')).toBe(false);
  });

  it('con «Tocar» abierto el teclado toca: ni S, ni M, ni Espacio', () => {
    expect(atajoPermitido('dividirClip', 'tocar')).toBe(false);
    expect(atajoPermitido('silenciarPista', 'tocar')).toBe(false);
    expect(atajoPermitido('reproducir', 'tocar')).toBe(false);
    expect(atajoPermitido('deshacer', 'tocar')).toBe(true);
  });

  it('en un deslizador las flechas lo mueven a él', () => {
    const deslizador = { tagName: 'DIV', getAttribute: (n: string) => (n === 'role' ? 'slider' : null) };
    expect(teclaDelMando(deslizador, 'pistaArriba')).toBe(true);
    expect(teclaDelMando(deslizador, 'irAlPrincipio')).toBe(true);
    expect(teclaDelMando(deslizador, 'reproducir')).toBe(false);
    expect(teclaDelMando({ tagName: 'INPUT', type: 'range' }, 'compasAtras')).toBe(true);
    expect(teclaDelMando({ tagName: 'BUTTON', getAttribute: () => null }, 'pistaArriba')).toBe(false);
  });
});

describe('textoAtajo', () => {
  it('escribe el atajo a la manera de cada sistema', () => {
    expect(textoAtajo('guardarCopia', false)).toBe('Ctrl+Mayús+S');
    expect(textoAtajo('guardarCopia', true)).toBe('⇧⌘S');
    expect(textoAtajo('ajustes', false)).toBe('Ctrl+,');
    expect(textoAtajo('reproducir', false)).toBe('Espacio');
    expect(textoAtajo('borrarPista', false)).toBe('Supr');
    expect(textoAtajo('borrarPista', true)).toBe('⌦');
    expect(textoAtajo('soloPista', false)).toBe('Mayús+S');
    expect(textoAtajo('alejar', false)).toBe('−');
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

  it('un deslizador o una casilla no son para escribir', () => {
    expect(escribiendo({ tagName: 'INPUT', type: 'range' })).toBe(false);
    expect(escribiendo({ tagName: 'INPUT', type: 'checkbox' })).toBe(false);
    expect(escribiendo({ tagName: 'INPUT', type: 'number' })).toBe(true);
  });
});
