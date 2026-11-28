import { describe, expect, it } from 'vitest';
import {
  TOPES,
  diaDeLaFranja,
  franjaDe,
  haceCuanto,
  momentoDe,
  nombreDelBloque,
  saludo,
  seccionesDelInicio,
  textoMomento,
} from './inicio';
import type { Artista, Cancion, Momento, Version } from '../tipos';

// Fechas locales: el Inicio va con la hora del móvil. El 26-nov-2026 es jueves.
const jueves = (h: number, min = 0) => new Date(2026, 10, 26, h, min);
const HORA = 60 * 60 * 1000;
const DIA = 24 * HORA;

function cancion(id: string, datos: Partial<Cancion> = {}): Cancion {
  return {
    id,
    titulo: id,
    tipo: 'cancion',
    portada: { tipo: 'generativa', semilla: 1 },
    guardada: true,
    creadaEn: 0,
    actualizadaEn: 0,
    escuchas: 0,
    origen: 'bolsillo',
    ...datos,
  };
}

function version(cancionId: string, momento?: Momento, datos: Partial<Version> = {}): Version {
  return {
    id: `v_${cancionId}_${datos.n ?? 1}`,
    cancionId,
    n: 1,
    creadaEn: 0,
    receta: { tipo: 'cancion', frase: '', conVoz: false, duracionSeg: 150, motor: 'falso', ...(momento ? { momento } : {}) },
    cambio: 'Primera',
    estado: 'lista',
    audioId: `aud_${cancionId}`,
    creditos: 0,
    motor: 'falso',
    ...datos,
  };
}

function artista(id: string, actualizadoEn = 0): Artista {
  return {
    id,
    nombre: id,
    adn: { estilo: 'rumba', instrumentos: [], voz: '' },
    portada: { tipo: 'generativa', semilla: 2 },
    creadoEn: 0,
    actualizadoEn,
  };
}

describe('el momento del día', () => {
  it('mañana, tarde y noche con las horas de España', () => {
    expect(franjaDe(jueves(6))).toBe('manana');
    expect(franjaDe(jueves(13, 59))).toBe('manana');
    expect(franjaDe(jueves(14))).toBe('tarde');
    expect(franjaDe(jueves(20, 59))).toBe('tarde');
    expect(franjaDe(jueves(21))).toBe('noche');
    expect(franjaDe(jueves(2))).toBe('noche');
  });

  it('el bloque se llama como lo diría la persona', () => {
    expect(nombreDelBloque(jueves(17))).toBe('Tu jueves por la tarde');
    expect(nombreDelBloque(jueves(8))).toBe('Tu jueves por la mañana');
    expect(nombreDelBloque(jueves(23))).toBe('Tu jueves por la noche');
  });

  it('la madrugada sigue siendo la noche de ayer', () => {
    const viernesALasDos = new Date(2026, 10, 27, 2, 0);
    expect(diaDeLaFranja(viernesALasDos)).toBe('jueves');
    expect(nombreDelBloque(viernesALasDos)).toBe('Tu jueves por la noche');
    expect(nombreDelBloque(new Date(2026, 10, 27, 7, 0))).toBe('Tu viernes por la mañana');
  });

  it('el saludo cambia con la hora', () => {
    expect(saludo(jueves(9))).toBe('Buenos días');
    expect(saludo(jueves(16))).toBe('Buenas tardes');
    expect(saludo(jueves(22))).toBe('Buenas noches');
  });

  it('cuánto hace, en palabras', () => {
    const ahora = jueves(17).getTime();
    expect(haceCuanto(jueves(9).getTime(), ahora)).toBe('hoy');
    expect(haceCuanto(ahora - DIA, ahora)).toBe('ayer');
    expect(haceCuanto(ahora - 3 * DIA, ahora)).toBe('hace 3 días');
    expect(haceCuanto(ahora - 20 * DIA, ahora)).toBe('hace 2 semanas');
    expect(haceCuanto(ahora - 90 * DIA, ahora)).toBe('hace 3 meses');
  });

  it('cada momento se dice para qué es, sin prometer nada', () => {
    expect(textoMomento('dormir')).toBe('Para dormir');
    expect(textoMomento('concentrarme')).toBe('Para concentrarte');
  });
});

describe('las secciones del Inicio', () => {
  it('sin nada no hay ninguna sección (nunca una caja vacía)', () => {
    expect(seccionesDelInicio({ canciones: [], versiones: [], artistas: [], ahora: jueves(17).getTime() })).toEqual([]);
  });

  it('«Seguir escuchando» va arriba, con lo último que sonó', () => {
    const ahora = jueves(17).getTime();
    const canciones = [
      cancion('a', { ultimaEscucha: ahora - 3 * HORA }),
      cancion('b', { ultimaEscucha: ahora - HORA }),
      cancion('c'), // nunca escuchada
      cancion('d', { ultimaEscucha: ahora - 2 * HORA, guardada: false }), // borrador: va a «Por decidir»
    ];
    const secciones = seccionesDelInicio({ canciones, versiones: [], artistas: [], ahora });
    expect(secciones[0]).toMatchObject({ id: 'seguir', titulo: 'Seguir escuchando', cancionIds: ['b', 'a'] });
  });

  it('el bloque de ahora junta lo hecho para este momento y lo que sueles poner a esta hora', () => {
    const ahora = jueves(22).getTime();
    const ayerPorLaNoche = jueves(23).getTime() - DIA;
    const canciones = [
      cancion('dormir'),
      cancion('correr'),
      cancion('costumbre', { ultimaEscucha: ayerPorLaNoche }),
      cancion('desconectar'),
    ];
    const versiones = [version('dormir', 'dormir'), version('correr', 'correr'), version('desconectar', 'desconectar')];
    const franja = seccionesDelInicio({ canciones, versiones, artistas: [], ahora }).find((s) => s.id === 'franja');
    expect(franja?.titulo).toBe('Tu jueves por la noche');
    // Primero lo de dormir, luego desconectar y luego la costumbre; correr no pega de noche.
    expect(franja?.cancionIds).toEqual(['dormir', 'desconectar', 'costumbre']);
    expect(franja?.linea).toBe('Para dormir y desconectar');
  });

  it('si solo pega por costumbre, lo dice así', () => {
    const ahora = jueves(16).getTime();
    const canciones = [cancion('x', { ultimaEscucha: jueves(15).getTime() - DIA })];
    const franja = seccionesDelInicio({ canciones, versiones: [], artistas: [], ahora }).find((s) => s.id === 'franja');
    expect(franja?.linea).toBe('Lo que sueles poner a esta hora');
  });

  it('el bloque de ahora no sale si nada pega con este momento', () => {
    const ahora = jueves(9).getTime();
    const canciones = [cancion('dormir')];
    const secciones = seccionesDelInicio({ canciones, versiones: [version('dormir', 'dormir')], artistas: [], ahora });
    expect(secciones.find((s) => s.id === 'franja')).toBeUndefined();
  });

  it('las estanterías no se repiten entre sí; «Seguir escuchando» sí puede repetirlas', () => {
    const ahora = jueves(23).getTime();
    const canciones = [
      cancion('noche', { tipo: 'paisaje', ultimaEscucha: ahora - HORA }),
      cancion('lluvia', { tipo: 'paisaje' }),
    ];
    const versiones = [version('noche', 'dormir', { bucle: true }), version('lluvia', 'concentrarme', { bucle: true })];
    const secciones = seccionesDelInicio({ canciones, versiones, artistas: [], ahora });
    const de = (id: string) => secciones.find((s) => s.id === id)?.cancionIds;
    expect(de('seguir')).toEqual(['noche']);
    expect(de('franja')).toEqual(['noche']);
    expect(de('paisajes')).toEqual(['lluvia']);
  });

  it('«Tus artistas», los que se han movido hace menos primero', () => {
    const ahora = jueves(17).getTime();
    const canciones = [cancion('r1', { artistaId: 'rumba', ultimaEscucha: ahora - HORA })];
    const artistas = [artista('jazz', ahora - DIA), artista('rumba', 0), artista('pop', ahora - 2 * DIA)];
    const s = seccionesDelInicio({ canciones, versiones: [], artistas, ahora }).find((x) => x.id === 'artistas');
    expect(s?.artistaIds).toEqual(['rumba', 'jazz', 'pop']);
    expect(s?.cancionIds).toEqual([]);
  });

  it('«Por decidir»: los borradores recientes, nunca los que ya caducaron', () => {
    const ahora = jueves(17).getTime();
    const canciones = [
      cancion('nuevo', { guardada: false, actualizadaEn: ahora - HORA }),
      cancion('de-ayer', { guardada: false, actualizadaEn: ahora - DIA }),
      cancion('viejo', { guardada: false, actualizadaEn: ahora - 40 * DIA }),
      cancion('mia'),
    ];
    const s = seccionesDelInicio({ canciones, versiones: [], artistas: [], ahora }).find((x) => x.id === 'decidir');
    expect(s?.cancionIds).toEqual(['nuevo', 'de-ayer']);
  });

  it('cada sección tiene su tope', () => {
    const ahora = jueves(17).getTime();
    const canciones = Array.from({ length: 30 }, (_, i) => cancion(`c${i}`, { ultimaEscucha: ahora - i * 1000 }));
    const s = seccionesDelInicio({ canciones, versiones: [], artistas: [], ahora });
    expect(s.find((x) => x.id === 'seguir')?.cancionIds).toHaveLength(TOPES.seguir);
    expect(s.find((x) => x.id === 'franja')?.cancionIds).toHaveLength(TOPES.franja);
  });

  it('el momento de una canción es el de la versión que suena', () => {
    const c = cancion('c', { versionElegida: 'v_c_1' });
    const v1 = version('c', 'dormir', { n: 1 });
    const v2 = version('c', 'correr', { n: 2, id: 'v_c_2' });
    expect(momentoDe(c, [v1, v2])).toBe('dormir');
    expect(momentoDe(cancion('c'), [v1, v2])).toBe('correr');
    expect(momentoDe(cancion('c'), [version('c', 'dormir', { estado: 'generando' })])).toBe('dormir');
  });
});
