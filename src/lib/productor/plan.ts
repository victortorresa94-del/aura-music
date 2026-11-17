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
    pista: z.string().describe('Nombre exacto de una pista tocada en la pantalla.'),
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
export const SEGUNDOS_CANCION = { min: 10, max: 120 } as const;

export interface SituacionDelPlan {
  /** Hay tomas grabadas: el tempo ya no se toca, lo marca el audio. */
  hayTomas: boolean;
  bpm: number;
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
  for (const paso of plan.pasos) {
    if (pasos.length >= MAX_PASOS) break;
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
        // Solo lo tocado en la pantalla: el audio grabado no tiene notas que mover.
        if (!situacion.pistasDeNotas?.includes(paso.pista)) break;
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
