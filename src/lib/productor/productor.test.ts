import { describe, expect, it } from 'vitest';
import { normalizarPlan, tituloDelPaso, type Plan } from './plan';
import {
  apuntarNotas,
  apuntarPedido,
  apuntarToma,
  apuntarUso,
  cerebroVacio,
  leerCerebro,
  olvidarNota,
  resumirCerebro,
  sugerenciasDelCerebro,
} from './cerebro';
import { armarMensaje, PeticionProductorSchema, SISTEMA } from './prompt';

const plan = (pasos: Plan['pasos']): Plan => ({ respuesta: 'Vamos.', pasos, recuerda: [], sugerencias: [] });

describe('normalizarPlan', () => {
  it('cambia los estilos que no existen por uno que sí', () => {
    const p = normalizarPlan(
      plan([
        { tipo: 'al_momento', instrumento: 'bajo', estilo: 'funky-inventado', porque: 'x' },
        { tipo: 'al_momento', instrumento: 'teclado', estilo: 'nada', porque: 'x' },
        { tipo: 'al_momento', instrumento: 'bateria', estilo: 'trap', porque: 'x' },
      ]),
      { hayTomas: true, bpm: 96 },
    );
    expect(p.pasos.map((s) => (s.tipo === 'al_momento' ? s.estilo : null))).toEqual(['raiz-quinta', 'colchon', 'pop']);
  });

  it('respeta los estilos buenos', () => {
    const p = normalizarPlan(
      plan([{ tipo: 'al_momento', instrumento: 'bajo', estilo: 'caminante', porque: 'x' }]),
      { hayTomas: true, bpm: 96 },
    );
    expect(p.pasos[0]).toMatchObject({ estilo: 'caminante' });
  });

  it('no toca el tempo si ya hay audio grabado, y lo limita si no lo hay', () => {
    const pasos: Plan['pasos'] = [{ tipo: 'tempo', bpm: 400, porque: 'x' }];
    expect(normalizarPlan(plan(pasos), { hayTomas: true, bpm: 96 }).pasos).toHaveLength(0);
    expect(normalizarPlan(plan(pasos), { hayTomas: false, bpm: 96 }).pasos[0]).toMatchObject({ bpm: 240 });
  });

  it('como mucho cuatro pasos, y la canción entre 10 y 120 segundos', () => {
    const cancion = (segundos: number): Plan['pasos'][number] => ({
      tipo: 'cancion',
      descripcion: 'rumba',
      letra: null,
      segundos,
      bpm: null,
      tonalidad: null,
      porque: 'x',
    });
    const p = normalizarPlan(plan([cancion(3), cancion(900), cancion(60), cancion(60), cancion(60)]), {
      hayTomas: false,
      bpm: 100,
    });
    expect(p.pasos).toHaveLength(4);
    expect(p.pasos.map((s) => (s.tipo === 'cancion' ? s.segundos : 0))).toEqual([10, 120, 60, 60]);
  });

  it('pone título legible a cada paso', () => {
    expect(tituloDelPaso({ tipo: 'al_momento', instrumento: 'bajo', estilo: 'caminante', porque: '' })).toBe(
      'Bajo · caminante',
    );
    expect(tituloDelPaso({ tipo: 'al_momento', instrumento: 'bateria', estilo: 'rumba', porque: '' })).toMatch(/^Batería · /);
    expect(tituloDelPaso({ tipo: 'con_ia', instrumento: 'cuerdas', descripcion: '', porque: '' })).toBe('Cuerdas con IA');
    expect(tituloDelPaso({ tipo: 'cuadrar', pista: 'Batería 808', fuerza: 70, swing: 0, humanizar: true, porque: '' })).toBe(
      'Cuadrar Batería 808 al 70 % y humanizar',
    );
  });

  it('cuadra pistas que existen, tocadas en la pantalla o tomas de audio, y limita fuerza y swing', () => {
    const pasos: Plan['pasos'] = [
      { tipo: 'cuadrar', pista: 'Batería 808', fuerza: 140, swing: -5, humanizar: false, porque: 'x' },
      { tipo: 'cuadrar', pista: 'Guitarra grabada', fuerza: 70, swing: 0, humanizar: false, porque: 'x' },
      { tipo: 'cuadrar', pista: 'Una que no existe', fuerza: 70, swing: 0, humanizar: false, porque: 'x' },
    ];
    const p = normalizarPlan(plan(pasos), { hayTomas: true, bpm: 96, pistasDeNotas: ['Batería 808'] });
    expect(p.pasos).toHaveLength(1);
    expect(p.pasos[0]).toMatchObject({ pista: 'Batería 808', fuerza: 100, swing: 0 });
    expect(normalizarPlan(plan(pasos), { hayTomas: true, bpm: 96 }).pasos).toHaveLength(0);
    // Con la lista de pistas, la toma de audio también se cuadra (cortando en los golpes).
    const conAudio = normalizarPlan(plan(pasos), {
      hayTomas: true,
      bpm: 96,
      pistasDeNotas: ['Batería 808'],
      pistas: ['Batería 808', 'Guitarra grabada'],
    });
    expect(conAudio.pasos.map((s) => (s.tipo === 'cuadrar' ? s.pista : ''))).toEqual(['Batería 808', 'Guitarra grabada']);
  });
});

describe('paso de mezcla', () => {
  const mezcla = (cambios: Partial<Extract<Plan['pasos'][number], { tipo: 'mezcla' }>>): Plan['pasos'][number] => ({
    tipo: 'mezcla',
    pista: 1,
    nombre: 'Voz',
    volumenDb: null,
    panorama: null,
    preajuste: null,
    graves: null,
    medios: null,
    agudos: null,
    compresor: null,
    saturacion: null,
    reverb: null,
    eco: null,
    espacio: null,
    porque: 'x',
    ...cambios,
  });
  const situacion = { hayTomas: true, bpm: 96, pistas: ['Voz', 'Guitarra'] };

  it('«súbele la voz»: se queda con la pista, el número y el nombre de verdad', () => {
    const p = normalizarPlan(plan([mezcla({ nombre: 'la voz', volumenDb: 2.2 })]), situacion);
    expect(p.pasos).toEqual([expect.objectContaining({ tipo: 'mezcla', pista: 1, nombre: 'Voz', volumenDb: 2 })]);
    expect(tituloDelPaso(p.pasos[0])).toBe('Voz · a +2 dB');
  });

  it('«más reverb a la guitarra»: valores en su rango y título legible', () => {
    const p = normalizarPlan(plan([mezcla({ pista: 2, reverb: 140, preajuste: 'guitarra-flamenca', graves: -30 })]), situacion);
    expect(p.pasos[0]).toMatchObject({ pista: 2, nombre: 'Guitarra', reverb: 100, graves: -12, preajuste: 'guitarra-flamenca' });
    expect(tituloDelPaso(p.pasos[0])).toBe('Guitarra · guitarra flamenca, graves \u221212 dB, reverb 100 %');
  });

  it('quita lo que no tiene arreglo: pistas que no existen, preajustes inventados, pasos vacíos', () => {
    const p = normalizarPlan(
      plan([mezcla({ pista: 7, volumenDb: 3 }), mezcla({ preajuste: 'lo-fi' as never }), mezcla({ pista: -1, reverb: 20 })]),
      situacion,
    );
    expect(p.pasos).toHaveLength(0);
  });

  it('al master solo le toca el volumen y la sala', () => {
    const p = normalizarPlan(plan([mezcla({ pista: 0, espacio: 'catedral', reverb: 50, volumenDb: -2 })]), situacion);
    expect(p.pasos[0]).toMatchObject({ pista: 0, nombre: 'Master', espacio: 'catedral', reverb: null, volumenDb: -2 });
    expect(tituloDelPaso(p.pasos[0])).toBe('Master · a \u22122 dB, reverb en catedral');
  });

  it('los pasos de mezcla no se comen el sitio de los demás', () => {
    const pasos: Plan['pasos'] = [
      ...Array.from({ length: 10 }, () => mezcla({ volumenDb: 1 })),
      { tipo: 'al_momento', instrumento: 'bajo', estilo: 'caminante', porque: 'x' },
    ];
    const p = normalizarPlan(plan(pasos), situacion);
    expect(p.pasos.filter((s) => s.tipo === 'mezcla')).toHaveLength(8);
    expect(p.pasos.some((s) => s.tipo === 'al_momento')).toBe(true);
  });
});

describe('cerebro', () => {
  it('apunta sin repetir lo que ya sabía', () => {
    let c = apuntarNotas(cerebroVacio(), ['Le tira la rumba']);
    c = apuntarNotas(c, ['le tira  la RUMBA', 'Prefiere bajos sencillos']);
    expect(c.notas.map((n) => n.texto)).toEqual(['Prefiere bajos sencillos', 'Le tira la rumba']);
  });

  it('resume en unas líneas lo que viaja a Claude', () => {
    let c = cerebroVacio();
    c = apuntarNotas(c, ['Le tira la rumba']);
    c = apuntarUso(apuntarUso(c, 'bajo:caminante'), 'bajo:caminante');
    c = apuntarToma(apuntarToma(c, { bpm: 92, tonalidad: 'La menor' }), { bpm: 104, tonalidad: 'La menor' });
    c = apuntarPedido(c, 'Ponle un bajo');
    const resumen = resumirCerebro(c);
    expect(resumen).toContain('Le tira la rumba');
    expect(resumen).toContain('bajo:caminante (2)');
    expect(resumen).toContain('entre 92 y 104 BPM');
    expect(resumen).toContain('La menor');
    expect(resumen).toContain('«Ponle un bajo»');
  });

  it('un cerebro vacío no manda nada', () => {
    expect(resumirCerebro(cerebroVacio())).toBe('');
  });

  it('se puede olvidar una nota', () => {
    const c = apuntarNotas(cerebroVacio(), ['a', 'b']);
    expect(olvidarNota(c, 0).notas.map((n) => n.texto)).toEqual(['b']);
  });

  it('si lo guardado está roto, empieza de cero', () => {
    expect(leerCerebro('{roto')).toEqual(cerebroVacio());
    expect(leerCerebro(JSON.stringify({ version: 9 }))).toEqual(cerebroVacio());
  });

  it('propone algo distinto con y sin toma', () => {
    const sin = sugerenciasDelCerebro(cerebroVacio(), { hayToma: false, pistas: 0, nombresDePistas: [] });
    expect(sin.join(' ')).toMatch(/canción/);
    const fav = apuntarUso(cerebroVacio(), 'bajo:caminante');
    const con = sugerenciasDelCerebro(fav, { hayToma: true, pistas: 1, nombresDePistas: ['Guitarra'] });
    expect(con[0]).toContain('caminante');
  });
});

describe('prompt', () => {
  const peticion = PeticionProductorSchema.parse({
    pedido: 'Ponle un bajo funky',
    contexto: {
      proyecto: { nombre: 'Idea', bpm: 96, pulsosPorCompas: 4, ritmo: null },
      pistas: [{ nombre: 'Guitarra', ia: false, segundos: 12 }],
      toma: { nombre: 'Guitarra', bpm: 96, tonalidad: 'La menor', progresion: 'La m · Sol · Fa · Mi', segundos: 12 },
      ia: { disponible: false, prueba: false },
    },
    cerebro: 'Lo que sabes de sus gustos:\n- Le tira la rumba',
    conversacion: [],
  });

  it('el sistema lleva el catálogo y no cambia entre pedidos (caché)', () => {
    expect(SISTEMA).toContain('caminante');
    expect(SISTEMA).toContain('rumba');
    expect(SISTEMA).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it('el mensaje cuenta la toma, la IA y el cerebro, y acaba en el pedido', () => {
    const m = armarMensaje(peticion);
    expect(m).toContain('La menor');
    expect(m).toContain('ACE-Step en su GPU de RunPod): apagado');
    expect(m).toContain('Le tira la rumba');
    expect(m.trim().endsWith('Ponle un bajo funky')).toBe(true);
  });

  it('cuenta cómo está mezclada cada pista, numerada, y el sistema sabe mezclar', () => {
    const conMezcla = PeticionProductorSchema.parse({
      ...peticion,
      pedido: 'Súbele la voz',
      contexto: {
        ...peticion.contexto,
        pistas: [
          {
            nombre: 'Voz',
            ia: false,
            segundos: 12,
            mezcla: {
              volumenDb: -3,
              panorama: 0,
              preajuste: 'voz-calida',
              graves: 2,
              medios: -1.5,
              agudos: 2.5,
              compresor: 55,
              saturacion: 15,
              reverb: 22,
              eco: 8,
              silenciada: false,
            },
          },
        ],
        master: { espacio: 'sala', volumenDb: 0 },
      },
    });
    const m = armarMensaje(conMezcla);
    expect(m).toContain('1. Voz');
    expect(m).toContain('-3 dB');
    expect(m).toContain('reverb 22 %');
    expect(m).toContain('Master (pista 0)');
    expect(SISTEMA).toContain('6. mezcla');
    expect(SISTEMA).toContain('guitarra-flamenca');
  });

  it('un móvil con la versión de antes (sin mezcla en el contexto) sigue valiendo', () => {
    expect(PeticionProductorSchema.safeParse(peticion).success).toBe(true);
    expect(armarMensaje(peticion)).toContain('1. Guitarra (12 s, grabada por él)');
  });

  it('cuenta las pistas tocadas en la pantalla con su diagnóstico', () => {
    const conNotas = PeticionProductorSchema.parse({
      ...peticion,
      contexto: {
        ...peticion.contexto,
        pistas: [
          ...peticion.contexto.pistas,
          { nombre: 'Batería 808', ia: false, segundos: 9.6, notas: { instrumento: 'caja de ritmos 808', diagnostico: 'vas 14 ms por detrás' } },
        ],
      },
    });
    const m = armarMensaje(conNotas);
    expect(m).toContain('Batería 808 (10 s, tocada en la pantalla con caja de ritmos 808: vas 14 ms por detrás)');
    expect(SISTEMA).toContain('cuadrar');
  });

  it('rechaza pedidos vacíos o enormes', () => {
    expect(PeticionProductorSchema.safeParse({ ...peticion, pedido: '   ' }).success).toBe(false);
    expect(PeticionProductorSchema.safeParse({ ...peticion, pedido: 'x'.repeat(601) }).success).toBe(false);
  });
});
