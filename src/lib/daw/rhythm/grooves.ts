/**
 * Los ritmos.
 *
 * Un ritmo es DATOS: qué golpe cae en qué paso del ciclo y con cuánta fuerza.
 * No hay audio aquí. Eso significa tres cosas buenas: se puede cambiar el
 * tempo sin que nada se estire, se puede corregir un patrón editando una
 * línea, y un modelo de lenguaje puede escribir uno nuevo sin tocar el motor.
 *
 * AVISO HONESTO sobre los palos flamencos: los he escrito con el compás bien
 * puesto (el doce con acentos en 12, 3, 6, 8 y 10) y con lo que sé, pero yo no
 * toco por bulerías. Están para que Víctor los corrija oyéndolos, que para eso
 * son cuatro números en un array.
 */

import type { VoiceId } from './kit';

export interface Hit {
  /** Paso dentro del patrón, desde 0. */
  paso: number;
  voz: VoiceId;
  /** 0..1 */
  vel: number;
}

export interface Groove {
  id: string;
  nombre: string;
  familia: string;
  compasId: string;
  /** Cuántos ciclos del compás ocupa el patrón. La clave, por ejemplo, son dos. */
  ciclos: number;
  bpm: [number, number];
  bpmPorDefecto: number;
  hits: Hit[];
  nota?: string;
}

/* Atajos para que los patrones se lean como una partitura y no como JSON. */
const h = (paso: number, voz: VoiceId, vel = 1): Hit => ({ paso, voz, vel });
const serie = (pasos: number[], voz: VoiceId, vel = 1): Hit[] =>
  pasos.map((paso) => h(paso, voz, vel));

/* En el doce flamenco, subdivisión 2, el ciclo son 24 pasos.
   Pulso 1 → paso 0 · pulso 2 → paso 2 · … · pulso 12 → paso 22.
   Los acentos (12, 3, 6, 8, 10) caen en los pasos 22, 4, 10, 14 y 18. */
const P = (pulso: number) => (pulso - 1) * 2;

export const GROOVES: Groove[] = [
  {
    id: 'bulerias-palmas',
    nombre: 'Bulerías · palmas',
    familia: 'Flamenco',
    compasId: 'flamenco12',
    ciclos: 1,
    bpm: [160, 260],
    bpmPorDefecto: 200,
    nota: 'Marcaje básico: seca en los acentos, sorda rellenando.',
    hits: [
      ...serie([P(12), P(3), P(6), P(8), P(10)], 'palma_seca', 1),
      ...serie([P(1), P(2), P(4), P(5), P(7), P(9), P(11)], 'palma_sorda', 0.4),
    ],
  },
  {
    id: 'bulerias-cajon',
    nombre: 'Bulerías · cajón y palmas',
    familia: 'Flamenco',
    compasId: 'flamenco12',
    ciclos: 1,
    bpm: [160, 260],
    bpmPorDefecto: 200,
    hits: [
      ...serie([P(12), P(3), P(8), P(10)], 'cajon_grave', 0.95),
      ...serie([P(6), P(7)], 'cajon_slap', 0.8),
      ...serie([P(12), P(3), P(6), P(8), P(10)], 'palma_seca', 0.7),
      ...serie([P(2), P(5), P(9), P(11)], 'palma_sorda', 0.35),
    ],
  },
  {
    id: 'solea',
    nombre: 'Soleá',
    familia: 'Flamenco',
    compasId: 'flamenco12',
    ciclos: 1,
    bpm: [60, 110],
    bpmPorDefecto: 85,
    nota: 'El mismo doce, pero lento y con aire.',
    hits: [
      ...serie([P(12), P(3), P(8), P(10)], 'cajon_grave', 0.9),
      ...serie([P(6)], 'cajon_slap', 0.75),
      ...serie([P(3), P(6), P(8), P(10), P(12)], 'palma_sorda', 0.5),
    ],
  },
  {
    id: 'rumba',
    nombre: 'Rumba flamenca',
    familia: 'Flamenco',
    compasId: 'rumba8',
    ciclos: 1,
    bpm: [90, 140],
    bpmPorDefecto: 108,
    nota: 'El tres-tres-dos de toda la vida.',
    hits: [
      ...serie([0, 6, 12], 'cajon_grave', 0.95),
      ...serie([3, 9, 14], 'cajon_slap', 0.7),
      ...serie([0, 2, 4, 6, 8, 10, 12, 14], 'palma_sorda', 0.35),
      ...serie([0, 6, 12], 'palma_seca', 0.8),
    ],
  },
  {
    id: 'tangos',
    nombre: 'Tangos flamencos',
    familia: 'Flamenco',
    compasId: 'tangos4',
    ciclos: 1,
    bpm: [80, 130],
    bpmPorDefecto: 100,
    hits: [
      ...serie([4, 8, 12], 'cajon_grave', 0.9),
      ...serie([6, 14], 'cajon_slap', 0.6),
      ...serie([4, 8, 12], 'palma_seca', 0.75),
      ...serie([2, 6, 10, 14], 'palma_sorda', 0.35),
    ],
  },
  {
    id: 'bolero',
    nombre: 'Bolero',
    familia: 'Latino',
    compasId: 'c44',
    ciclos: 2,
    bpm: [60, 100],
    bpmPorDefecto: 84,
    nota: 'Bongó al martillo, tumbao de conga y clave 3-2. Sin bajo: aquí el bajo no existe.',
    hits: [
      // Martillo: corcheas continuas en el bongó, con la grave marcando.
      ...serie([0, 2, 6, 10, 14, 16, 18, 22, 26, 30], 'bongo_agudo', 0.45),
      ...serie([4, 12, 20, 28], 'bongo_grave', 0.7),
      // Tumbao: slap en el 2 y dos abiertos al final del compás.
      ...serie([4, 20], 'conga_slap', 0.65),
      ...serie([12, 14, 28, 30], 'conga_abierta', 0.8),
      // Clave 3-2.
      ...serie([0, 3, 6, 20, 24], 'clave', 0.7),
    ],
  },
  {
    id: 'bossa',
    nombre: 'Bossa',
    familia: 'Latino',
    compasId: 'c44',
    ciclos: 2,
    bpm: [110, 160],
    bpmPorDefecto: 130,
    hits: [
      ...serie([0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30], 'shaker', 0.32),
      ...serie([0, 6, 10, 16, 22, 28], 'nudillos', 0.55),
      ...serie([0, 8, 16, 24], 'bombo', 0.5),
    ],
  },
  {
    id: 'pop',
    nombre: 'Pop sencillo',
    familia: 'Pop',
    compasId: 'c44',
    ciclos: 1,
    bpm: [70, 160],
    bpmPorDefecto: 100,
    hits: [
      ...serie([0, 8], 'bombo', 0.95),
      ...serie([4, 12], 'caja', 0.85),
      ...serie([0, 2, 4, 6, 8, 10, 12, 14], 'charles', 0.3),
    ],
  },
  {
    id: 'balada68',
    nombre: 'Balada 6/8',
    familia: 'Pop',
    compasId: 'c68',
    ciclos: 1,
    bpm: [50, 90],
    bpmPorDefecto: 68,
    hits: [
      ...serie([0], 'bombo', 0.9),
      ...serie([6], 'caja', 0.8),
      ...serie([0, 2, 4, 6, 8, 10], 'charles', 0.3),
    ],
  },
];

export function getGroove(id: string): Groove | null {
  return GROOVES.find((groove) => groove.id === id) ?? null;
}

export function familias(): string[] {
  return [...new Set(GROOVES.map((groove) => groove.familia))];
}
