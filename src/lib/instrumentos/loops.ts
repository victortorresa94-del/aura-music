/**
 * La biblioteca de loops: patrones listos de batería, bajo y percusión.
 *
 * Un loop son NOTAS sobre un instrumento (los kits de la pantalla «Tocar»),
 * no audio: por eso suena siempre al tempo y al compás del proyecto, sin
 * estirar nada, y una vez puesto es una pista de notas como cualquier otra
 * (se cuadra, se humaniza, se le cambia el kit).
 *
 * No se duplican los ritmos que ya había (`daw/rhythm/grooves.ts`, los de la
 * hoja de Ritmos): se convierten aquí a notas General MIDI sobre el kit que
 * les va (el cajón para el flamenco, la percusión latina para el bolero, la
 * batería para el pop). Lo nuevo (rock, funk, reguetón, lo-fi...) se escribe
 * ya en notas.
 *
 * Puro y sin audio: se prueba con tests.
 */

import { getCompas, type Compas } from '@/lib/daw/rhythm/compases';
import { GROOVES, type Groove } from '@/lib/daw/rhythm/grooves';
import type { VoiceId } from '@/lib/daw/rhythm/kit';
import type { Golpe, InstrumentoId } from './tipos';

export type FamiliaLoop = 'bateria' | 'bajo' | 'percusion';
export type NivelLoop = 'bombo' | 'bombo-caja' | 'completo';

export interface Loop {
  id: string;
  nombre: string;
  /** Pop, Rock, Flamenco...: para agrupar y para el productor. */
  estilo: string;
  familia: FamiliaLoop;
  /**
   * El instrumento con el que suena (el dembow con el bajo 808, el tumbao con
   * contrabajo...). Una vez puesto, se cambia desde la pista, en «Sonido».
   */
  instrumento: InstrumentoId;
  /** Pulsos de un ciclo del estilo (4 en casi todo, 12 en la bulería). */
  pulsosPorCompas: number;
  /** Cuántos de esos ciclos dura el patrón. */
  compases: number;
  /**
   * Las notas, en pulsos desde el principio del loop. En los bajos, `nota` va
   * en semitonos desde la tónica (0 = la tónica en el registro del bajo).
   */
  golpes: Golpe[];
  /** Tempo al que mejor suena, para avisar si el proyecto va muy lejos. */
  bpm: [number, number];
  detalle: string;
}

/* -------------------------------------------------------------------------- */
/* Notas de batería (General MIDI) y atajos para escribir patrones              */
/* -------------------------------------------------------------------------- */

const BOMBO = 36;
const ARO = 37;
const CAJA = 38;
const PALMAS = 39;
const CHARLES = 42;
const CHARLES_ABIERTO = 46;
const CRASH = 49;
const RIDE = 51;

/** Golpes en semicorcheas: `pasos` cuenta desde 0 a razón de 4 por pulso. */
const semis = (pasos: number[], nota: number, vel = 100): Golpe[] =>
  pasos.map((p) => ({ beat: p / 4, dur: 0.25, nota, vel }));

/** Notas largas de bajo: [pulso, semitonos, duración en pulsos, fuerza]. */
const linea = (notas: [number, number, number, number?][]): Golpe[] =>
  notas.map(([beat, nota, dur, vel]) => ({ beat, dur, nota, vel: vel ?? 100 }));

/* -------------------------------------------------------------------------- */
/* Batería nueva (en notas)                                                     */
/* -------------------------------------------------------------------------- */

const BATERIA: Loop[] = [
  {
    id: 'rock',
    nombre: 'Rock',
    estilo: 'Rock',
    familia: 'bateria',
    instrumento: 'bateria-acustica',
    pulsosPorCompas: 4,
    compases: 1,
    bpm: [90, 160],
    detalle: 'Bombo en el 1 y el 3, caja en 2 y 4, charles a corcheas',
    golpes: [
      ...semis([0, 8, 10], BOMBO, 110),
      ...semis([4, 12], CAJA, 112),
      ...semis([0, 4, 8, 12], CHARLES, 92),
      ...semis([2, 6, 10, 14], CHARLES, 72),
    ],
  },
  {
    id: 'funk',
    nombre: 'Funk',
    estilo: 'Funk',
    familia: 'bateria',
    instrumento: 'bateria-acustica',
    pulsosPorCompas: 4,
    compases: 1,
    bpm: [85, 120],
    detalle: 'Charles a semicorcheas y caja con notas fantasma',
    golpes: [
      ...semis([0, 3, 10], BOMBO, 108),
      ...semis([4, 12], CAJA, 110),
      ...semis([7, 9, 15], CAJA, 34),
      ...semis([0, 2, 4, 6, 8, 10, 12, 14], CHARLES, 90),
      ...semis([1, 3, 5, 7, 9, 11, 13, 15], CHARLES, 58),
    ],
  },
  {
    id: 'reggaeton',
    nombre: 'Reguetón',
    estilo: 'Reguetón',
    familia: 'bateria',
    instrumento: 'bateria-acustica',
    pulsosPorCompas: 4,
    compases: 1,
    bpm: [85, 105],
    detalle: 'El dembow: bombo en cada pulso y la caja en el tres-tres-dos',
    golpes: [
      ...semis([0, 4, 8, 12], BOMBO, 112),
      ...semis([3, 6, 11, 14], CAJA, 104),
      ...semis([0, 2, 4, 6, 8, 10, 12, 14], CHARLES, 70),
    ],
  },
  {
    id: 'lofi',
    nombre: 'Lo-fi',
    estilo: 'Lo-fi',
    familia: 'bateria',
    instrumento: 'bateria-acustica',
    pulsosPorCompas: 4,
    compases: 2,
    bpm: [70, 95],
    detalle: 'Suelto y con swing, de hip hop tranquilo',
    golpes: [
      // Las corcheas de detrás llegan tarde (swing de casi tresillo).
      ...[0, 1, 2, 3, 4, 5, 6, 7].flatMap((b) => [
        { beat: b, dur: 0.25, nota: CHARLES, vel: b % 2 ? 66 : 82 },
        { beat: b + 0.6, dur: 0.25, nota: CHARLES, vel: 52 },
      ]),
      ...linea([[0, BOMBO, 0.25, 104], [2.6, BOMBO, 0.25, 86], [4, BOMBO, 0.25, 100], [5.6, BOMBO, 0.25, 80], [6.6, BOMBO, 0.25, 84]]),
      ...linea([[1, CAJA, 0.25, 96], [3, CAJA, 0.25, 98], [5, CAJA, 0.25, 94], [7, CAJA, 0.25, 100]]),
    ],
  },
  {
    id: 'disco',
    nombre: 'Disco',
    estilo: 'Disco',
    familia: 'bateria',
    instrumento: 'bateria-acustica',
    pulsosPorCompas: 4,
    compases: 1,
    bpm: [110, 130],
    detalle: 'Bombo a negras y charles abierto en el contratiempo',
    golpes: [
      ...semis([0, 4, 8, 12], BOMBO, 110),
      ...semis([4, 12], PALMAS, 96),
      ...semis([4, 12], CAJA, 100),
      ...semis([2, 6, 10, 14], CHARLES_ABIERTO, 84),
      ...semis([0, 4, 8, 12], CHARLES, 64),
    ],
  },
  {
    id: 'balada-ride',
    nombre: 'Balada con ride',
    estilo: 'Pop',
    familia: 'bateria',
    instrumento: 'bateria-acustica',
    pulsosPorCompas: 4,
    compases: 1,
    bpm: [60, 90],
    detalle: 'Aro en vez de caja y el ride marcando',
    golpes: [
      ...semis([0, 10], BOMBO, 96),
      ...semis([4, 12], ARO, 92),
      ...semis([0, 4, 8, 12], RIDE, 80),
      ...semis([2, 6, 10, 14], RIDE, 58),
    ],
  },
  {
    id: 'trap',
    nombre: 'Trap',
    estilo: 'Trap',
    familia: 'bateria',
    instrumento: 'bateria-808',
    pulsosPorCompas: 4,
    compases: 1,
    bpm: [130, 160],
    detalle: 'A medio tiempo: caja en el 3 y charles con redobles',
    golpes: [
      ...semis([0, 7, 10], BOMBO, 112),
      ...semis([8], CAJA, 110),
      ...semis([8], PALMAS, 96),
      ...semis([0, 2, 4, 6, 8, 10, 12], CHARLES, 76),
      // El redoble del final, a fusas.
      ...[14, 14.5, 15, 15.5].map((p) => ({ beat: p / 4, dur: 0.125, nota: CHARLES, vel: 60 + (p - 14) * 20 })),
    ],
  },
  {
    id: 'rock-crash',
    nombre: 'Rock con entrada',
    estilo: 'Rock',
    familia: 'bateria',
    instrumento: 'bateria-acustica',
    pulsosPorCompas: 4,
    compases: 2,
    bpm: [90, 160],
    detalle: 'Platillo en el uno y redoble de toms al final',
    golpes: [
      ...semis([0], CRASH, 112),
      ...semis([0, 8, 10, 16, 24], BOMBO, 110),
      ...semis([4, 12, 20], CAJA, 112),
      ...semis([2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22], CHARLES, 80),
      ...semis([24, 25], CAJA, 100),
      ...semis([26, 27], 50, 104),
      ...semis([28, 29], 47, 104),
      ...semis([30, 31], 45, 108),
    ],
  },
];

/* -------------------------------------------------------------------------- */
/* Los ritmos que ya había, convertidos a notas sobre su kit                    */
/* -------------------------------------------------------------------------- */

/** La nota General MIDI de cada voz del kit sintetizado, en el kit al que va. */
const NOTA_DE_VOZ: Partial<Record<VoiceId, number>> = {
  bombo: BOMBO,
  caja: CAJA,
  charles: CHARLES,
  nudillos: ARO,
  cajon_grave: 36,
  cajon_slap: 38,
  cajon_ghost: 37,
  palma_seca: 39,
  palma_sorda: 42,
  chasquido: 46,
  clave: 75,
  shaker: 70,
  guiro: 73,
  bongo_agudo: 60,
  bongo_grave: 61,
  conga_slap: 62,
  conga_abierta: 63,
  cencerro: 56,
  pandereta: 54,
};

function kitDe(groove: Groove): { instrumento: InstrumentoId; familia: FamiliaLoop } {
  if (groove.familia === 'Flamenco') return { instrumento: 'cajon', familia: 'bateria' };
  if (groove.familia === 'Latino') return { instrumento: 'percusion-latina', familia: 'percusion' };
  return { instrumento: 'bateria-acustica', familia: 'bateria' };
}

/** Un ritmo de la hoja de Ritmos, como loop de notas. */
export function loopDeGroove(groove: Groove): Loop {
  const compas: Compas = getCompas(groove.compasId);
  const { instrumento, familia } = kitDe(groove);
  // Pasos a pulsos: la rumba de ocho son dos compases de cuatro; el doce
  // flamenco es un ciclo de doce pulsos.
  const pulsosCiclo = compas.pulsos;
  const pulsosPorCompas = pulsosCiclo === 8 ? 4 : pulsosCiclo;
  const compases = (pulsosCiclo / pulsosPorCompas) * Math.max(1, groove.ciclos);
  const golpes: Golpe[] = groove.hits
    .filter((hit) => NOTA_DE_VOZ[hit.voz] !== undefined)
    .map((hit) => ({
      beat: hit.paso / compas.subdivision,
      dur: 1 / compas.subdivision,
      nota: NOTA_DE_VOZ[hit.voz] as number,
      vel: Math.max(1, Math.min(127, Math.round(20 + hit.vel * 105))),
    }));
  return {
    id: `ritmo-${groove.id}`,
    nombre: groove.nombre,
    estilo: groove.familia,
    familia,
    instrumento,
    pulsosPorCompas,
    compases,
    golpes,
    bpm: groove.bpm,
    detalle: groove.nota ?? (pulsosPorCompas === 12 ? 'En el compás de doce' : `En ${compas.nombre}`),
  };
}

/* -------------------------------------------------------------------------- */
/* Bajos (en semitonos desde la tónica)                                         */
/* -------------------------------------------------------------------------- */

const BAJOS: Loop[] = [
  {
    id: 'bajo-corcheas',
    nombre: 'Raíz a corcheas',
    estilo: 'Rock',
    familia: 'bajo',
    instrumento: 'bajo-pua',
    pulsosPorCompas: 4,
    compases: 1,
    bpm: [90, 170],
    detalle: 'La tónica sin parar, el motor del rock',
    golpes: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5].map((b) => ({ beat: b, dur: 0.42, nota: 0, vel: b % 1 ? 84 : 104 })),
  },
  {
    id: 'bajo-raiz-quinta',
    nombre: 'Raíz y quinta',
    estilo: 'Pop',
    familia: 'bajo',
    instrumento: 'bajo-dedos',
    pulsosPorCompas: 4,
    compases: 1,
    bpm: [60, 140],
    detalle: 'Tónica en el 1 y quinta en el 3',
    golpes: linea([[0, 0, 1.8, 104], [2, 7, 1.4, 94], [3.5, 5, 0.45, 80]]),
  },
  {
    id: 'bajo-octavas',
    nombre: 'Octavas',
    estilo: 'Disco',
    familia: 'bajo',
    instrumento: 'bajo-dedos',
    pulsosPorCompas: 4,
    compases: 1,
    bpm: [105, 130],
    detalle: 'Arriba y abajo a corcheas, de pista de baile',
    golpes: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5].map((b, i) => ({ beat: b, dur: 0.38, nota: i % 2 ? 12 : 0, vel: i % 2 ? 90 : 104 })),
  },
  {
    id: 'bajo-dembow',
    nombre: 'Dembow',
    estilo: 'Reguetón',
    familia: 'bajo',
    instrumento: 'bajo-808',
    pulsosPorCompas: 4,
    compases: 1,
    bpm: [85, 105],
    detalle: 'Siguiendo al bombo y a la caja del reguetón',
    golpes: linea([[0, 0, 0.7, 106], [0.75, 0, 0.6, 92], [1.5, 7, 0.45, 90], [2, 0, 0.7, 104], [2.75, 0, 0.6, 92], [3.5, 5, 0.45, 88]]),
  },
  {
    id: 'bajo-tumbao',
    nombre: 'Tumbao',
    estilo: 'Latino',
    familia: 'bajo',
    instrumento: 'contrabajo',
    pulsosPorCompas: 4,
    compases: 1,
    bpm: [80, 130],
    detalle: 'Adelantado: el «y» del dos y el cuatro',
    golpes: linea([[1.5, 7, 1.4, 100], [3, 0, 1, 104]]),
  },
  {
    id: 'bajo-808-largo',
    nombre: '808 largo',
    estilo: 'Trap',
    familia: 'bajo',
    instrumento: 'bajo-808',
    pulsosPorCompas: 4,
    compases: 2,
    bpm: [130, 160],
    detalle: 'Notas que caen y se quedan sonando',
    golpes: linea([[0, 0, 1.6, 110], [1.75, 0, 0.6, 96], [4, 3, 1.6, 106], [6, 5, 0.9, 98], [7, 7, 0.9, 96]]),
  },
];

/* -------------------------------------------------------------------------- */
/* Percusión                                                                    */
/* -------------------------------------------------------------------------- */

const PERCUSION: Loop[] = [
  {
    id: 'shaker',
    nombre: 'Shaker',
    estilo: 'Percusión',
    familia: 'percusion',
    instrumento: 'percusion-latina',
    pulsosPorCompas: 4,
    compases: 1,
    bpm: [70, 140],
    detalle: 'Semicorcheas con el acento en el pulso',
    golpes: [...Array(16).keys()].map((p) => ({ beat: p / 4, dur: 0.25, nota: 70, vel: p % 4 === 0 ? 100 : p % 2 ? 58 : 76 })),
  },
  {
    id: 'pandereta',
    nombre: 'Pandereta',
    estilo: 'Percusión',
    familia: 'percusion',
    instrumento: 'bateria-acustica',
    pulsosPorCompas: 4,
    compases: 1,
    bpm: [70, 150],
    detalle: 'En el 2 y el 4, como en el soul',
    golpes: [...semis([4, 12], 54, 104), ...semis([2, 6, 10, 14], 54, 56)],
  },
  {
    id: 'congas',
    nombre: 'Congas',
    estilo: 'Latino',
    familia: 'percusion',
    instrumento: 'percusion-latina',
    pulsosPorCompas: 4,
    compases: 1,
    bpm: [80, 130],
    detalle: 'Tumbao: apagado en el 2 y dos abiertos al final',
    golpes: [...semis([4, 12], 62, 96), ...semis([10, 14], 63, 104), ...semis([0, 8], 64, 88)],
  },
  {
    id: 'clave-son',
    nombre: 'Clave de son 3-2',
    estilo: 'Latino',
    familia: 'percusion',
    instrumento: 'percusion-latina',
    pulsosPorCompas: 4,
    compases: 2,
    bpm: [80, 130],
    detalle: 'Tres golpes y luego dos: la base de la salsa',
    golpes: semis([0, 6, 12, 20, 24], 75, 100),
  },
];

/* -------------------------------------------------------------------------- */
/* La biblioteca entera                                                         */
/* -------------------------------------------------------------------------- */

export const LOOPS: Loop[] = [...BATERIA, ...GROOVES.map(loopDeGroove), ...BAJOS, ...PERCUSION];

export function getLoop(id: string): Loop | null {
  return LOOPS.find((loop) => loop.id === id) ?? null;
}

export function loopsDe(familia: FamiliaLoop): Loop[] {
  return LOOPS.filter((loop) => loop.familia === familia);
}

/** Lo que entra en cada nivel: solo el bombo, bombo y caja, o todo. */
const NIVEL_BOMBO = new Set([35, 36]);
const NIVEL_BOMBO_CAJA = new Set([35, 36, 37, 38, 39, 40]);

export function golpesDeNivel(loop: Loop, nivel: NivelLoop): Golpe[] {
  if (loop.familia !== 'bateria' || nivel === 'completo') return loop.golpes;
  const permitidas = nivel === 'bombo' ? NIVEL_BOMBO : NIVEL_BOMBO_CAJA;
  return loop.golpes.filter((g) => permitidas.has(g.nota));
}

/** ¿Tiene sentido ofrecer niveles? Solo si quitar cosas deja algo distinto. */
export function tieneNiveles(loop: Loop): boolean {
  if (loop.familia !== 'bateria') return false;
  const bombo = golpesDeNivel(loop, 'bombo').length;
  const conCaja = golpesDeNivel(loop, 'bombo-caja').length;
  return bombo > 0 && conCaja > bombo && loop.golpes.length > conCaja;
}

/** La tónica en el registro del bajo: del Mi grave (28) al Re# de encima (39). */
export function tonicaEnElBajo(tonica: number): number {
  return 28 + ((((tonica - 4) % 12) + 12) % 12);
}

/**
 * Las notas que van a la pista: el loop repetido hasta cubrir `veces`
 * ciclos (en flamenco un ciclo es un compás de doce), con el nivel elegido y,
 * en los bajos, en la tonalidad del proyecto.
 */
export function golpesParaPista(loop: Loop, o: { veces: number; nivel?: NivelLoop; tonica?: number }): { golpes: Golpe[]; pulsos: number } {
  const base = golpesDeNivel(loop, o.nivel ?? 'completo');
  const largo = loop.pulsosPorCompas * loop.compases;
  const vueltas = Math.max(1, Math.ceil(o.veces / loop.compases));
  const raiz = loop.familia === 'bajo' ? tonicaEnElBajo(o.tonica ?? 0) : 0;
  const golpes: Golpe[] = [];
  for (let v = 0; v < vueltas; v++) {
    for (const g of base) {
      golpes.push({ ...g, beat: g.beat + v * largo, nota: g.nota + raiz });
    }
  }
  return { golpes: golpes.sort((a, b) => a.beat - b.beat || a.nota - b.nota), pulsos: vueltas * largo };
}

/** ¿Va el loop a gusto con este tempo? (para avisar, nunca para impedir) */
export function vaConElTempo(loop: Loop, bpm: number): boolean {
  return bpm >= loop.bpm[0] * 0.85 && bpm <= loop.bpm[1] * 1.15;
}
