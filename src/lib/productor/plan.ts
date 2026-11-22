/**
 * El plan del productor: lo que Claude devuelve y la app ejecuta.
 *
 * Claude no toca nada directamente. Contesta con una lista corta de pasos que
 * solo puede usar las piezas que ya existen (el músico al momento, el músico
 * con IA, el tempo y la canción entera), y es la app la que los ejecuta uno
 * a uno, en el móvil, con el mismo Deshacer de siempre.
 *
 * El esquema va sin mínimos ni máximos: las salidas estructuradas no los
 * garantizan. Los límites se ponen aquí, en `normalizarPlan`, que es lo
 * último que pasa antes de ejecutar.
 */

import { z } from 'zod';
import { ESTILOS } from '@/lib/musico/bajo';
import { ritmosParaTempo } from '@/lib/musico/bateria';
import { ESTILOS_TECLAS } from '@/lib/musico/teclas';
import { getGroove } from '@/lib/daw/rhythm/grooves';
import { INSTRUMENTOS } from '@/lib/ia/tipos';
// Mezcla (pilar A): el productor también mezcla.
import { textoGanancia } from '@/lib/daw/mezcla/escala';
import { IDS_PREAJUSTES, NOMBRE_ESPACIO, preajuste } from '@/lib/daw/mezcla/tipos';

const porque = z.string().describe('Una frase corta, en español, de por qué este paso.');

export const PasoSchema = z.discriminatedUnion('tipo', [
  z.object({
    tipo: z.literal('al_momento'),
    instrumento: z.enum(['bajo', 'teclado', 'bateria']),
    estilo: z
      .string()
      .describe('Id del estilo de bajo o de teclas, o id del ritmo si es batería. Solo ids del catálogo.'),
    porque,
  }),
  z.object({
    tipo: z.literal('con_ia'),
    instrumento: z.enum(INSTRUMENTOS as [string, ...string[]]),
    descripcion: z.string().describe('Cómo debe sonar, en inglés y concreto: estilo, articulación, energía.'),
    porque,
  }),
  z.object({
    tipo: z.literal('tempo'),
    bpm: z.number(),
    porque,
  }),
  z.object({
    tipo: z.literal('mezcla'),
    pista: z.number().describe('Número de la pista en la lista del proyecto (1, 2…). 0 es el master.'),
    nombre: z.string().describe('El nombre de esa pista, tal cual sale en la lista, o «Master».'),
    volumenDb: z
      .number()
      .nullable()
      .describe('Volumen NUEVO en dB: 0 es como se grabó, −6 la mitad, +3 algo más fuerte. null = no tocar.'),
    panorama: z.number().nullable().describe('De −100 (todo a la izquierda) a 100 (todo a la derecha). null = no tocar.'),
    preajuste: z.enum(IDS_PREAJUSTES).nullable().describe('Un preajuste de efectos del catálogo, o null.'),
    graves: z.number().nullable().describe('Ecualizador en dB, de −12 a 12. null = no tocar.'),
    medios: z.number().nullable(),
    agudos: z.number().nullable(),
    compresor: z.number().nullable().describe('De 0 a 100. null = no tocar.'),
    saturacion: z.number().nullable(),
    reverb: z.number().nullable().describe('Envío a la reverb compartida, de 0 a 100. null = no tocar.'),
    eco: z.number().nullable(),
    espacio: z
      .enum(['estudio', 'sala', 'catedral'])
      .nullable()
      .describe('Solo con el master: dónde suena la reverb que comparten todas las pistas.'),
    porque,
  }),
  z.object({
    tipo: z.literal('cancion'),
    descripcion: z.string().describe('La canción en inglés: género, instrumentos, ambiente, voz.'),
    letra: z.string().nullable().describe('Letra con [verse], [chorus]… o null si es instrumental.'),
    segundos: z.number(),
    bpm: z.number().nullable(),
    tonalidad: z.string().nullable().describe('En inglés, como «A minor», o null.'),
    porque,
  }),
  // Pilar B: cuadrar una pista tocada en la pantalla (ver src/lib/musico/groove).
  z.object({
    tipo: z.literal('cuadrar'),
    pista: z.string().describe('Nombre exacto de la pista: tocada en la pantalla o toma de audio.'),
    fuerza: z.number().describe('De 0 a 100: cuánto se lleva a la rejilla. 70 corrige sin dejarlo de máquina.'),
    swing: z.number().describe('De 0 a 100. 0 es recto; a partir de 30 ya se nota.'),
    humanizar: z.boolean().describe('Además, un poco de mano: desvíos pequeños y con memoria.'),
    porque,
  }),
]);

export const PlanSchema = z.object({
  respuesta: z.string().describe('Lo que le dices al músico, en español, como un productor: corto y directo.'),
  pasos: z.array(PasoSchema),
  recuerda: z
    .array(z.string())
    .describe('Cosas nuevas que has aprendido de sus gustos en este pedido. Vacío si no hay nada nuevo.'),
  sugerencias: z.array(z.string()).describe('Dos o tres siguientes pedidos, cortos, como los diría él.'),
});

export type Paso = z.infer<typeof PasoSchema>;
export type Plan = z.infer<typeof PlanSchema>;

export const MAX_PASOS = 4;
/** Mezclar no cuesta nada ni tarda: «déjalo como una maqueta de bar» toca varias pistas a la vez. */
export const MAX_PASOS_MEZCLA = 8;
export const SEGUNDOS_CANCION = { min: 10, max: 120 } as const;

export interface SituacionDelPlan {
  /** Hay tomas grabadas: el tempo ya no se toca, lo marca el audio. */
  hayTomas: boolean;
  bpm: number;
  /** Los nombres de las pistas, en orden: el paso `mezcla` las nombra por su número. */
  pistas?: string[];
  /** Pilar B: nombres de las pistas tocadas en la pantalla, las únicas que se cuadran. */
  pistasDeNotas?: string[];
}

const ESTILOS_BAJO = new Set<string>(ESTILOS.map((e) => e.id));
const ESTILOS_DE_TECLAS = new Set<string>(ESTILOS_TECLAS.map((e) => e.id));

const limitar = (valor: number, min: number, max: number) => Math.min(max, Math.max(min, valor));
const recortar = (texto: string, largo: number) => texto.trim().slice(0, largo);

/**
 * Deja el plan listo para ejecutar: ids que existen, números en su sitio,
 * como mucho cuatro pasos y textos de un largo razonable. Lo que no tiene
 * arreglo se quita. Nunca lanza.
 */
export function normalizarPlan(plan: Plan, situacion: SituacionDelPlan): Plan {
  const pasos: Paso[] = [];
  let mezclas = 0;
  for (const paso of plan.pasos) {
    if (paso.tipo === 'mezcla') {
      if (mezclas >= MAX_PASOS_MEZCLA) continue;
      const limpio = normalizarMezcla(paso, situacion);
      if (limpio) {
        pasos.push(limpio);
        mezclas++;
      }
      continue;
    }
    if (pasos.length - mezclas >= MAX_PASOS) continue;
    switch (paso.tipo) {
      case 'al_momento': {
        let estilo = paso.estilo;
        if (paso.instrumento === 'bajo' && !ESTILOS_BAJO.has(estilo)) estilo = 'raiz-quinta';
        if (paso.instrumento === 'teclado' && !ESTILOS_DE_TECLAS.has(estilo)) estilo = 'colchon';
        if (paso.instrumento === 'bateria' && !getGroove(estilo)) {
          estilo = ritmosParaTempo(situacion.bpm)[0]?.id ?? 'pop';
        }
        pasos.push({ ...paso, estilo, porque: recortar(paso.porque, 200) });
        break;
      }
      case 'con_ia':
        pasos.push({ ...paso, descripcion: recortar(paso.descripcion, 400), porque: recortar(paso.porque, 200) });
        break;
      case 'tempo':
        // Con audio grabado no se cambia: el audio no se estira y se descuadraría.
        if (situacion.hayTomas || !Number.isFinite(paso.bpm)) break;
        pasos.push({ ...paso, bpm: Math.round(limitar(paso.bpm, 40, 240)), porque: recortar(paso.porque, 200) });
        break;
      case 'cancion':
        pasos.push({
          ...paso,
          descripcion: recortar(paso.descripcion, 600),
          letra: paso.letra ? recortar(paso.letra, 3000) : null,
          segundos: Math.round(
            limitar(Number.isFinite(paso.segundos) ? paso.segundos : 60, SEGUNDOS_CANCION.min, SEGUNDOS_CANCION.max),
          ),
          bpm: paso.bpm && Number.isFinite(paso.bpm) ? Math.round(limitar(paso.bpm, 40, 240)) : null,
          tonalidad: paso.tonalidad ? recortar(paso.tonalidad, 30) : null,
          porque: recortar(paso.porque, 200),
        });
        break;
      case 'cuadrar':
        // Lo tocado en la pantalla mueve notas; una toma de audio se corta en
        // los golpes (src/lib/daw/cuadrar). Tiene que ser una pista que exista.
        if (!situacion.pistasDeNotas?.includes(paso.pista) && !situacion.pistas?.includes(paso.pista)) break;
        pasos.push({
          ...paso,
          fuerza: Math.round(limitar(Number.isFinite(paso.fuerza) ? paso.fuerza : 70, 0, 100)),
          swing: Math.round(limitar(Number.isFinite(paso.swing) ? paso.swing : 0, 0, 100)),
          porque: recortar(paso.porque, 200),
        });
        break;
    }
  }
  return {
    respuesta: recortar(plan.respuesta, 800),
    pasos,
    recuerda: plan.recuerda.map((n) => recortar(n, 160)).filter(Boolean).slice(0, 5),
    sugerencias: plan.sugerencias.map((s) => recortar(s, 90)).filter(Boolean).slice(0, 3),
  };
}

type PasoMezcla = Extract<Paso, { tipo: 'mezcla' }>;

const numero = (v: number | null, min: number, max: number, redondeo = 1) =>
  v === null || !Number.isFinite(v) ? null : Math.round(limitar(v, min, max) / redondeo) * redondeo;

/**
 * Una pista que existe, valores en su rango y algo que cambiar. Al master
 * solo se le cambia el volumen y el sitio de la reverb; el resto no tiene
 * sentido en él. Si no queda nada que hacer, el paso se quita.
 */
function normalizarMezcla(paso: PasoMezcla, situacion: SituacionDelPlan): PasoMezcla | null {
  const n = Math.round(paso.pista);
  const master = n === 0;
  if (!master && (n < 1 || (situacion.pistas && n > situacion.pistas.length))) return null;
  const nombre = master ? 'Master' : (situacion.pistas?.[n - 1] ?? recortar(paso.nombre, 60));
  const limpio: PasoMezcla = {
    tipo: 'mezcla',
    pista: n,
    nombre,
    volumenDb: numero(paso.volumenDb, -60, 6, 0.5),
    panorama: master ? null : numero(paso.panorama, -100, 100),
    preajuste: master || !paso.preajuste || !preajuste(paso.preajuste) ? null : paso.preajuste,
    graves: master ? null : numero(paso.graves, -12, 12, 0.5),
    medios: master ? null : numero(paso.medios, -12, 12, 0.5),
    agudos: master ? null : numero(paso.agudos, -12, 12, 0.5),
    compresor: master ? null : numero(paso.compresor, 0, 100),
    saturacion: master ? null : numero(paso.saturacion, 0, 100),
    reverb: master ? null : numero(paso.reverb, 0, 100),
    eco: master ? null : numero(paso.eco, 0, 100),
    espacio: master ? paso.espacio : null,
    porque: recortar(paso.porque, 200),
  };
  const algo = Object.entries(limpio).some(
    ([clave, valor]) => !['tipo', 'pista', 'nombre', 'porque'].includes(clave) && valor !== null,
  );
  return algo ? limpio : null;
}

/** «Voz · voz cálida, a −3 dB, reverb 40 %». */
function resumenDeMezcla(paso: PasoMezcla): string {
  const partes: string[] = [];
  if (paso.preajuste) partes.push((preajuste(paso.preajuste)?.nombre ?? paso.preajuste).toLowerCase());
  if (paso.volumenDb !== null) partes.push(`a ${textoGanancia(paso.volumenDb)}`);
  if (paso.panorama !== null) {
    partes.push(paso.panorama === 0 ? 'al centro' : `${Math.abs(paso.panorama)} a la ${paso.panorama < 0 ? 'izquierda' : 'derecha'}`);
  }
  for (const banda of ['graves', 'medios', 'agudos'] as const) {
    const v = paso[banda];
    if (v !== null) partes.push(`${banda} ${textoGanancia(v)}`);
  }
  if (paso.compresor !== null) partes.push(`compresor ${paso.compresor} %`);
  if (paso.saturacion !== null) partes.push(`saturación ${paso.saturacion} %`);
  if (paso.reverb !== null) partes.push(`reverb ${paso.reverb} %`);
  if (paso.eco !== null) partes.push(`eco ${paso.eco} %`);
  if (paso.espacio) partes.push(`reverb en ${NOMBRE_ESPACIO[paso.espacio].toLowerCase()}`);
  return partes.join(', ');
}

/** Cómo se lee un paso en la lista: «Bajo caminante, al momento». */
export function tituloDelPaso(paso: Paso): string {
  switch (paso.tipo) {
    case 'al_momento': {
      if (paso.instrumento === 'bateria') return `Batería · ${getGroove(paso.estilo)?.nombre ?? paso.estilo}`;
      const lista: { id: string; nombre: string }[] = paso.instrumento === 'bajo' ? ESTILOS : ESTILOS_TECLAS;
      const nombre = lista.find((e) => e.id === paso.estilo)?.nombre ?? paso.estilo;
      return `${paso.instrumento === 'bajo' ? 'Bajo' : 'Teclas'} · ${nombre.toLowerCase()}`;
    }
    case 'con_ia':
      return `${NOMBRES[paso.instrumento] ?? paso.instrumento} con IA`;
    case 'tempo':
      return `Tempo a ${paso.bpm} BPM`;
    case 'cancion':
      return `Canción de ${paso.segundos} s${paso.letra ? ' con letra' : ''}`;
    case 'mezcla':
      return `${paso.nombre} · ${resumenDeMezcla(paso)}`;
    case 'cuadrar':
      return `Cuadrar ${paso.pista} al ${paso.fuerza} %${paso.humanizar ? ' y humanizar' : ''}`;
  }
}

const NOMBRES: Record<string, string> = {
  bajo: 'Bajo',
  bateria: 'Batería',
  teclado: 'Teclas',
  guitarra: 'Guitarra',
  cuerdas: 'Cuerdas',
  metales: 'Metales',
  percusion: 'Percusión',
  sinte: 'Sinte',
};
