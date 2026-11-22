import { describe, expect, it } from 'vitest';
import type { Project } from '@/lib/daw/types';
import { cerebroVacio, type Cerebro } from '@/lib/productor/cerebro';
import { fusionarCerebros, mismoCerebro, nuevosDelante } from './cerebro';
import {
  AGRUPAR_MS,
  CLAVE_CEREBRO,
  ESPERA_MAXIMA_MS,
  claveDeProyecto,
  encolar,
  esperaTrasFallo,
  fallida,
  hecha,
  idDeClave,
  proximaEspera,
  reintentarYa,
  siguiente,
} from './cola';
import { leerConfig } from './config';
import { nombreDelDispositivo } from './dispositivo';
import { LIMITE_JSON, aProyectoRemoto, desempaquetar, empaquetar } from './documento';
import { clasificarError } from './errores';
import {
  ESPERA_ANTES_DE_BORRAR,
  buffersDe,
  copiaDeLaPerdedora,
  decidir,
  decidirLimpieza,
  nombreDeCopia,
  sePuedeVaciar,
} from './reconciliar';

const v = (updatedAt: number, buffers: string[] = []) => ({ updatedAt, buffers });
const r = (updatedAt: number, buffers: string[] = [], borrado = false) => ({ updatedAt, buffers, borrado });

function idea(id: string, updatedAt: number, buffers: string[] = ['buf_a']): Project {
  return {
    id,
    name: 'Bulería de la cocina',
    bpm: 120,
    createdAt: 1000,
    updatedAt,
    tracks: buffers.map((b, i) => ({
      id: `trk_${i}`,
      name: `Pista ${i + 1}`,
      clip: { bufferId: b, start: 0, offset: 0, duration: 2, repeats: 1 },
      volume: 1,
      muted: false,
      soloed: false,
      sourceDuration: 2,
      createdAt: 1000,
    })),
  };
}

describe('qué hacer con cada idea', () => {
  it('lo que solo está aquí sube y lo que solo está en la nube baja', () => {
    expect(decidir(v(10), null, null, undefined)).toEqual({ tipo: 'subir' });
    expect(decidir(null, null, r(10), undefined)).toEqual({ tipo: 'bajar' });
    expect(decidir(null, null, null, undefined)).toEqual({ tipo: 'nada' });
  });

  it('si solo cambió un lado, gana ese', () => {
    expect(decidir(v(20), null, r(10), 10)).toEqual({ tipo: 'subir' });
    expect(decidir(v(10), null, r(20), 10)).toEqual({ tipo: 'bajar' });
    expect(decidir(v(10), null, r(10), 10)).toEqual({ tipo: 'nada' });
  });

  it('deshacer hasta una versión más vieja también sube (lo que cuenta es que cambió)', () => {
    expect(decidir(v(5), null, r(10), 10)).toEqual({ tipo: 'subir' });
  });

  it('si cambiaron los dos, gana la última modificación', () => {
    expect(decidir(v(30, ['a']), null, r(20, ['a']), 10)).toEqual({ tipo: 'choque', gana: 'local', copia: false });
    expect(decidir(v(20, ['a']), null, r(30, ['a']), 10)).toEqual({ tipo: 'choque', gana: 'remoto', copia: false });
  });

  it('la que pierde se guarda como copia si tenía tomas que la otra no tiene', () => {
    // En el móvil grabaste «b»; en el PC, después, «c». Gana el PC, pero «b» no se pierde.
    expect(decidir(v(20, ['a', 'b']), null, r(30, ['a', 'c']), 10)).toEqual({ tipo: 'choque', gana: 'remoto', copia: true });
    // Si la que pierde solo borró algo, no hace falta copia.
    expect(decidir(v(20, ['a']), null, r(30, ['a', 'c']), 10)).toEqual({ tipo: 'choque', gana: 'remoto', copia: false });
  });

  it('sin base (primera vez con una idea que ya estaba en los dos) también es un choque', () => {
    expect(decidir(v(20, ['a']), null, r(30, ['b']), undefined)).toEqual({ tipo: 'choque', gana: 'remoto', copia: true });
    expect(decidir(v(30), null, r(30), undefined)).toEqual({ tipo: 'nada' });
  });

  it('un borrado de otro dispositivo se aplica aquí si no había cambios', () => {
    expect(decidir(v(10), null, r(40, [], true), 10)).toEqual({ tipo: 'borrar-local' });
  });

  it('pero no se lleva por delante cambios de aquí que no habían subido', () => {
    expect(decidir(v(50), null, r(40, [], true), 10)).toEqual({ tipo: 'subir' });
    expect(decidir(v(20), null, r(40, [], true), 10)).toEqual({ tipo: 'subir' });
  });

  it('un borrado de aquí sube como lápida, salvo que en otro sitio la tocaran después', () => {
    expect(decidir(null, 50, r(10), 10)).toEqual({ tipo: 'subir-borrado' });
    expect(decidir(null, 50, r(60), 10)).toEqual({ tipo: 'bajar' });
    expect(decidir(null, 50, r(40, [], true), 10)).toEqual({ tipo: 'nada' });
    expect(decidir(null, 50, null, undefined)).toEqual({ tipo: 'nada' });
  });

  it('los audios de una idea, sin repetir', () => {
    expect(buffersDe(idea('p', 1, ['a', 'b', 'a']))).toEqual(['a', 'b']);
  });

  it('una toma cuadrada al tempo viaja con su original, que no se borra nunca', () => {
    const p = idea('p', 1, ['buf_cuadrado']);
    (p.tracks[0] as unknown as { cuadre: unknown }).cuadre = {
      original: { bufferId: 'buf_original' },
      cuadrado: { bufferId: 'buf_cuadrado' },
      escuchando: 'cuadrado',
    };
    expect(buffersDe(p).sort()).toEqual(['buf_cuadrado', 'buf_original']);
  });

  it('la copia lleva otro id, la hora de ahora y dice de dónde viene', () => {
    const copia = copiaDeLaPerdedora(idea('prj_1', 10), 'iPhone', 99, () => 'prj_copia');
    expect(copia.id).toBe('prj_copia');
    expect(copia.updatedAt).toBe(99);
    expect(copia.name).toBe('Bulería de la cocina · copia del iPhone');
    expect(copia.tracks).toEqual(idea('prj_1', 10).tracks);
    expect(nombreDeCopia('Bulería · copia del PC', 'iPhone')).toBe('Bulería · copia del iPhone');
  });
});

describe('limpieza del audio de la nube', () => {
  const ahora = 100 * ESPERA_ANTES_DE_BORRAR;

  it('un audio en uso no se toca nunca', () => {
    const l = decidirLimpieza(['a', 'b'], new Set(['a', 'b']), {}, ahora);
    expect(l).toEqual({ huerfanos: {}, borrar: [], cambia: false });
  });

  it('uno sin uso se apunta y se borra a los 30 días, no antes', () => {
    const primera = decidirLimpieza(['a', 'b'], new Set(['a']), {}, ahora);
    expect(primera.borrar).toEqual([]);
    expect(primera.huerfanos).toEqual({ b: ahora });
    expect(primera.cambia).toBe(true);
    const antes = decidirLimpieza(['a', 'b'], new Set(['a']), primera.huerfanos, ahora + ESPERA_ANTES_DE_BORRAR - 1);
    expect(antes.borrar).toEqual([]);
    expect(antes.cambia).toBe(false);
    const despues = decidirLimpieza(['a', 'b'], new Set(['a']), primera.huerfanos, ahora + ESPERA_ANTES_DE_BORRAR);
    expect(despues.borrar).toEqual(['b']);
  });

  it('si vuelve a usarse, se desapunta', () => {
    const l = decidirLimpieza(['a', 'b'], new Set(['a', 'b']), { b: 5 }, ahora);
    expect(l).toEqual({ huerfanos: {}, borrar: [], cambia: true });
  });

  it('una idea borrada pierde su audio a los 30 días de la lápida', () => {
    expect(sePuedeVaciar({ borrado: true, updatedAt: ahora, audioBorrado: false }, ahora + 1)).toBe(false);
    expect(sePuedeVaciar({ borrado: true, updatedAt: ahora, audioBorrado: false }, ahora + ESPERA_ANTES_DE_BORRAR)).toBe(true);
    expect(sePuedeVaciar({ borrado: true, updatedAt: ahora, audioBorrado: true }, ahora + ESPERA_ANTES_DE_BORRAR)).toBe(false);
    expect(sePuedeVaciar({ borrado: false, updatedAt: 0, audioBorrado: false }, ahora)).toBe(false);
  });
});

describe('la cola de pendientes', () => {
  it('pedir dos veces lo mismo es una sola tarea, y espera a que dejes de tocar', () => {
    let cola = encolar([], claveDeProyecto('p'), 0, AGRUPAR_MS);
    cola = encolar(cola, claveDeProyecto('p'), 1000, AGRUPAR_MS);
    expect(cola).toHaveLength(1);
    expect(cola[0].cuando).toBe(1000 + AGRUPAR_MS);
    expect(siguiente(cola, 1000)).toBeNull();
    expect(siguiente(cola, 1000 + AGRUPAR_MS)?.clave).toBe('proyecto:p');
  });

  it('pero no se aplaza para siempre si sigues tocando', () => {
    let cola = encolar([], 'proyecto:p', 0, AGRUPAR_MS);
    for (let t = 1000; t < 60_000; t += 1000) cola = encolar(cola, 'proyecto:p', t, AGRUPAR_MS);
    expect(cola[0].cuando).toBe(ESPERA_MAXIMA_MS);
  });

  it('va por orden: la que antes se pueda', () => {
    let cola = encolar([], 'proyecto:b', 0, 500);
    cola = encolar(cola, 'proyecto:a', 10);
    cola = encolar(cola, CLAVE_CEREBRO, 20);
    expect(siguiente(cola, 600)?.clave).toBe('proyecto:a');
    expect(proximaEspera(cola, 0)).toBe(10);
    expect(proximaEspera([], 0)).toBeNull();
  });

  it('sin red espera cada vez más, y al volver la red se reintenta todo ya', () => {
    let cola = encolar([], 'proyecto:p', 0);
    cola = fallida(cola, 'proyecto:p', 0, 'Sin conexión');
    expect(cola[0].cuando).toBe(esperaTrasFallo(1));
    cola = fallida(cola, 'proyecto:p', 0, 'Sin conexión');
    expect(cola[0].cuando).toBe(esperaTrasFallo(2));
    expect(esperaTrasFallo(2)).toBeGreaterThan(esperaTrasFallo(1));
    expect(esperaTrasFallo(50)).toBe(5 * 60_000);
    // Guardar mientras espera no la adelanta: la red no ha vuelto por guardar.
    const otra = encolar(cola, 'proyecto:p', 1, 0);
    expect(otra[0].cuando).toBe(cola[0].cuando);
    cola = reintentarYa(cola, 7);
    expect(cola[0].cuando).toBe(7);
  });

  it('si la idea cambia mientras se sube, no se da por hecha', () => {
    let cola = encolar([], 'proyecto:p', 0);
    const enCurso = cola[0].version;
    cola = encolar(cola, 'proyecto:p', 5); // llega un cambio a media subida
    cola = hecha(cola, 'proyecto:p', enCurso);
    expect(cola).toHaveLength(1);
    cola = hecha(cola, 'proyecto:p', cola[0].version);
    expect(cola).toHaveLength(0);
  });

  it('las claves', () => {
    expect(idDeClave(claveDeProyecto('prj_x'))).toBe('prj_x');
    expect(idDeClave(CLAVE_CEREBRO)).toBeNull();
  });
});

describe('el cerebro en dos dispositivos', () => {
  const nota = (texto: string, fecha = '2026-11-20') => ({ texto, fecha });
  const conNotas = (...textos: string[]): Cerebro => ({ ...cerebroVacio(), notas: textos.map((t) => nota(t)) });

  it('lo aprendido en cada uno se junta', () => {
    const base = conNotas('Le gusta la rumba');
    const movil = conNotas('Bajo caminante siempre', 'Le gusta la rumba');
    const pc = conNotas('Reverb de sala, nunca de catedral', 'Le gusta la rumba');
    const juntos = fusionarCerebros(base, movil, pc);
    expect(juntos.notas.map((n) => n.texto).sort()).toEqual(
      ['Bajo caminante siempre', 'Le gusta la rumba', 'Reverb de sala, nunca de catedral'].sort(),
    );
  });

  it('lo que olvidaste en uno se queda olvidado', () => {
    const base = conNotas('Le gusta la rumba', 'Toca en Mi frigio');
    const movil = conNotas('Toca en Mi frigio'); // aquí olvidó la rumba
    const pc = conNotas('Le gusta la rumba', 'Toca en Mi frigio');
    expect(fusionarCerebros(base, movil, pc).notas.map((n) => n.texto)).toEqual(['Toca en Mi frigio']);
  });

  it('la misma nota con otras mayúsculas no se repite', () => {
    const juntos = fusionarCerebros(null, conNotas('Le gusta la rumba'), conNotas('le gusta  la RUMBA'));
    expect(juntos.notas).toHaveLength(1);
  });

  it('los usos suman lo de cada uno desde la última vez, sin contar dos veces', () => {
    const base = { ...cerebroVacio(), usos: { 'bajo:caminante': 3 } };
    const movil = { ...cerebroVacio(), usos: { 'bajo:caminante': 5 } };
    const pc = { ...cerebroVacio(), usos: { 'bajo:caminante': 4, 'ritmo:rumba': 1 } };
    expect(fusionarCerebros(base, movil, pc).usos).toEqual({ 'bajo:caminante': 6, 'ritmo:rumba': 1 });
    // La primera vez no se sabe qué es de quién: el mayor.
    expect(fusionarCerebros(null, movil, pc).usos).toEqual({ 'bajo:caminante': 5, 'ritmo:rumba': 1 });
  });

  it('tempos: lo nuevo de los dos delante de lo de antes', () => {
    expect(nuevosDelante([100, 96, 120], [96, 120, 90])).toEqual([100]);
    expect(nuevosDelante([96, 120], [96, 120])).toEqual([]);
    expect(nuevosDelante([5, 4], [])).toEqual([5, 4]);
    const base = { ...cerebroVacio(), tempos: [96, 120] };
    const juntos = fusionarCerebros(base, { ...base, tempos: [100, 96, 120] }, { ...base, tempos: [132, 96, 120] });
    expect(juntos.tempos).toEqual([100, 132, 96, 120]);
  });

  it('las ideas recordadas se juntan y gana la más reciente', () => {
    const movil = { ...cerebroVacio(), ideas: { p1: { nombre: 'Viejo', bpm: 90, tonalidad: null, pistas: 1, fecha: '2026-11-01' } } };
    const pc = { ...cerebroVacio(), ideas: { p1: { nombre: 'Nuevo', bpm: 90, tonalidad: null, pistas: 2, fecha: '2026-11-05' } } };
    expect(fusionarCerebros(null, movil, pc).ideas.p1.nombre).toBe('Nuevo');
  });

  it('mezclar dos veces da lo mismo, y el orden de las claves no cuenta', () => {
    const a = { ...conNotas('x'), usos: { b: 1, a: 2 } };
    const b = { ...conNotas('x'), usos: { a: 2, b: 1 } };
    expect(mismoCerebro(a, b)).toBe(true);
    const una = fusionarCerebros(null, a, conNotas('y'));
    expect(mismoCerebro(fusionarCerebros(una, una, una), una)).toBe(true);
  });
});

describe('la idea como documento', () => {
  it('ida y vuelta exacta en JSON', () => {
    const p = { ...idea('prj_1', 1234), mezcla: { algo: [1, 2] } } as unknown as Project;
    const paquete = empaquetar(p);
    expect(paquete.json).toBeDefined();
    expect(desempaquetar(paquete)).toEqual(p);
  });

  it('si es muy grande, va comprimida y vuelve igual', () => {
    const grande = idea('prj_g', 1);
    (grande.tracks[0] as unknown as { notas: unknown }).notas = Array.from({ length: 30_000 }, (_, i) => ({ beat: i / 4, dur: 0.25, nota: 60 + (i % 12), vel: 0.8 }));
    const paquete = empaquetar(grande);
    expect(JSON.stringify(grande).length).toBeGreaterThan(LIMITE_JSON);
    expect(paquete.gz).toBeInstanceOf(Uint8Array);
    expect(desempaquetar(paquete)).toEqual(grande);
  });

  it('lo que no tiene forma de idea no entra (y no pisa nada de aquí)', () => {
    expect(() => desempaquetar({ json: '{"id":"x"}' })).toThrow();
    expect(() => desempaquetar({ json: 'no es json' })).toThrow();
    expect(aProyectoRemoto('x', { json: '{"id":"x"}', updatedAt: 1 }, 0)).toBeNull();
  });

  it('un documento de Firestore pasa a lo que entiende el motor', () => {
    const p = idea('prj_1', 50, ['a', 'b']);
    const remoto = aProyectoRemoto(
      'prj_1',
      { json: JSON.stringify(p), updatedAt: 50, buffers: ['a', 'b'], dispositivo: { id: 'd1', nombre: 'iPhone' }, huerfanos: { z: 3, mal: 'x' } },
      777,
    );
    expect(remoto).toMatchObject({ id: 'prj_1', updatedAt: 50, borrado: false, buffers: ['a', 'b'], servidorEn: 777, huerfanos: { z: 3 } });
    expect(remoto?.dispositivo?.nombre).toBe('iPhone');
    expect(remoto?.proyecto).toEqual(p);
    const lapida = aProyectoRemoto('prj_2', { borrado: true, updatedAt: 9 }, 1);
    expect(lapida).toMatchObject({ borrado: true, proyecto: null, updatedAt: 9 });
  });
});

describe('detalles', () => {
  it('el nombre del dispositivo, corto', () => {
    expect(nombreDelDispositivo('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)')).toBe('iPhone');
    expect(nombreDelDispositivo('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5)).toBe('iPad');
    expect(nombreDelDispositivo('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 0)).toBe('Mac');
    expect(nombreDelDispositivo('Mozilla/5.0 (Linux; Android 15; Pixel 9) Mobile Safari')).toBe('móvil Android');
    expect(nombreDelDispositivo('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe('PC');
  });

  it('sin configuración completa no hay nube', () => {
    expect(leerConfig({})).toBeNull();
    expect(leerConfig({ apiKey: 'k', authDomain: 'd', projectId: 'p', storageBucket: 'b' })).toBeNull();
    expect(leerConfig({ apiKey: ' k ', authDomain: 'd', projectId: 'p', storageBucket: 'b', appId: 'a' })).toEqual({
      apiKey: 'k',
      authDomain: 'd',
      projectId: 'p',
      storageBucket: 'b',
      appId: 'a',
      messagingSenderId: undefined,
    });
  });

  it('sin red no es un error, y un audio que no baja con red es el CORS', () => {
    expect(clasificarError({ code: 'permission-denied' }, { enLinea: false })).toBe('red');
    expect(clasificarError({ code: 'unavailable' })).toBe('red');
    expect(clasificarError({ code: 'permission-denied' })).toBe('permiso');
    expect(clasificarError({ code: 'storage/unauthorized' })).toBe('permiso');
    expect(clasificarError({ code: 'storage/retry-limit-exceeded' }, { bajando: true })).toBe('cors');
    expect(clasificarError({ code: 'storage/quota-exceeded' })).toBe('cuota');
    expect(clasificarError(new Error('raro'))).toBe('otro');
  });
});

describe('lo que dice la interfaz', () => {
  const base = { fase: 'al-dia', pendientes: 0, subiendo: null, bajando: false, error: null, cambioEnLaAbierta: null, ultimaVez: null } as const;

  it('el estado, corto y sin jerga', async () => {
    const { textoDelEstado, haceCuanto, textoDelIndicador } = await import('./textos');
    expect(textoDelEstado({ ...base }, 0)).toBe('Al día');
    expect(textoDelEstado({ ...base, ultimaVez: 0 }, 3 * 60_000)).toBe('Al día · hace 3 min');
    expect(textoDelEstado({ ...base, fase: 'trabajando', subiendo: { hechos: 1, total: 4 } }, 0)).toBe('Subiendo audio 2 de 4');
    expect(textoDelEstado({ ...base, fase: 'trabajando', subiendo: { hechos: 4, total: 4 } }, 0)).toBe('Subiendo audio 4 de 4');
    expect(textoDelEstado({ ...base, fase: 'trabajando', pendientes: 1 }, 0)).toBe('Subiendo 1 cambio');
    expect(textoDelEstado({ ...base, fase: 'sin-conexion', pendientes: 2 }, 0)).toBe('Sin conexión · 2 cambios esperan para subir');
    expect(textoDelEstado({ ...base, fase: 'error', error: 'Falta el CORS' }, 0)).toBe('Falta el CORS');
    expect(haceCuanto(0, 10_000)).toBe('ahora');
    expect(haceCuanto(0, 3 * 3600_000)).toBe('hace 3 h');
    expect(haceCuanto(0, 2 * 86_400_000)).toBe('hace 2 días');
    expect(textoDelIndicador({ ...base, cambioEnLaAbierta: { id: 'p', dispositivo: 'PC' } })).toBe('Esta idea ha cambiado en el PC');
    expect(textoDelIndicador({ ...base, fase: 'fuera' })).toBeNull();
  });

  it('ningún texto lleva rayas largas', async () => {
    const fuentes = await Promise.all(
      ['./textos.ts', './errores.ts', './firebase.ts', '../../components/cuenta/Cuenta.tsx'].map(async (f) => {
        const { readFile } = await import('node:fs/promises');
        return readFile(new URL(f, import.meta.url), 'utf8');
      }),
    );
    for (const texto of fuentes) expect(texto).not.toMatch(/—/);
  });
});
