/**
 * El registro de instrumentos: qué hay, cómo se llama, qué registro cubre y
 * con qué suena. La pantalla «Tocar», la reproducción y el WAV leen de aquí;
 * añadir un instrumento es añadir una entrada.
 */

import type { VoiceId } from '@/lib/daw/rhythm/kit';
import type { PaqueteId } from './packs';
import type { TimbreSintetico } from './sinte';
import type { InstrumentoId } from './tipos';

export type Familia = 'bateria' | 'teclas' | 'guitarra' | 'bajo';

export interface Pad {
  /** Nota General MIDI del pad: es lo que se guarda en el golpe. */
  nota: number;
  nombre: string;
  voz: VoiceId;
}

export interface DefInstrumento {
  id: InstrumentoId;
  nombre: string;
  /** Nombre corto para los chips de la pantalla «Tocar». */
  corto: string;
  familia: Familia;
  /** Solo batería: 16 pads, de arriba abajo y de izquierda a derecha. */
  pads?: Pad[];
  /** Muestras que se bajan al abrirlo. Sin paquete, suena sintetizado. */
  paquete?: PaqueteId;
  /** Lo que suena mientras no hay muestras (o si nunca llegan). */
  sintesis: TimbreSintetico;
  /** Registro que cubre bien, en MIDI. */
  rango: [number, number];
  /** Octava (en MIDI de la tónica) donde arranca el teclado. */
  base: number;
  /** Si al soltar el dedo la nota se corta (teclas) o sigue sonando (cuerda pulsada). */
  sostiene: boolean;
}

/* -------------------------------------------------------------------------- */
/* Batería                                                                     */
/* -------------------------------------------------------------------------- */

/*
 * Los 16 pads, con la misma nota General MIDI en los tres kits. Abajo, al
 * alcance del pulgar, bombo, aro, caja y palmas (como en una MPC); arriba lo
 * que se toca menos. Cambiar de 808 a cajón no mueve ni un golpe: el bombo
 * pasa a ser el grave del cajón y la caja, el slap.
 */
const NOTAS_PADS = [
  56, 75, 70, 54, // cencerro, clave, maracas, pandereta
  45, 47, 50, 51, // toms y ride
  42, 44, 46, 49, // charles cerrado, corto, abierto y platillo
  36, 37, 38, 39, // bombo, aro, caja, palmas
] as const;

function kit(nombres: string[], voces: VoiceId[]): Pad[] {
  return NOTAS_PADS.map((nota, i) => ({ nota, nombre: nombres[i], voz: voces[i] }));
}

const KIT_808 = kit(
  ['Cencerro', 'Clave', 'Shaker', 'Pandereta', 'Tom grave', 'Tom medio', 'Tom agudo', 'Platillo', 'Charles', 'Charles corto', 'Charles abierto', 'Crash', 'Bombo', 'Aro', 'Caja', 'Palmas'],
  ['cencerro', 'clave', 'shaker', 'pandereta', 'tom_grave_808', 'tom_medio_808', 'tom_agudo_808', 'platillo_808', 'charles_808', 'charles_pedal_808', 'charles_abierto_808', 'platillo_808', 'bombo_808', 'aro_808', 'caja_808', 'palmas_808'],
);

const KIT_909 = kit(
  ['Cencerro', 'Clave', 'Shaker', 'Pandereta', 'Tom grave', 'Tom medio', 'Tom agudo', 'Ride', 'Charles', 'Charles corto', 'Charles abierto', 'Crash', 'Bombo', 'Aro', 'Caja', 'Palmas'],
  ['cencerro', 'clave', 'shaker', 'pandereta', 'tom_grave_909', 'tom_medio_909', 'tom_agudo_909', 'ride_909', 'charles_909', 'charles_pedal_909', 'charles_abierto_909', 'platillo_909', 'bombo_909', 'aro_909', 'caja_909', 'palmas_909'],
);

/* El cajón: lo que hace el que acompaña por bulerías, con palmas y pitos. */
const KIT_CAJON = kit(
  ['Bongó agudo', 'Clave', 'Shaker', 'Pandereta', 'Bongó grave', 'Conga', 'Conga slap', 'Güiro', 'Palma sorda', 'Nudillos', 'Pito', 'Cencerro', 'Grave', 'Suave', 'Slap', 'Palmas'],
  ['bongo_agudo', 'clave', 'shaker', 'pandereta', 'bongo_grave', 'conga_abierta', 'conga_slap', 'guiro', 'palma_sorda', 'nudillos', 'chasquido', 'cencerro', 'cajon_grave', 'cajon_ghost', 'cajon_slap', 'palma_seca'],
);

/* -------------------------------------------------------------------------- */
/* Registro                                                                    */
/* -------------------------------------------------------------------------- */

export const INSTRUMENTOS: DefInstrumento[] = [
  { id: 'bateria-808', nombre: 'Caja de ritmos 808', corto: '808', familia: 'bateria', pads: KIT_808, sintesis: 'piano', rango: [36, 75], base: 36, sostiene: false },
  { id: 'bateria-909', nombre: 'Caja de ritmos 909', corto: '909', familia: 'bateria', pads: KIT_909, sintesis: 'piano', rango: [36, 75], base: 36, sostiene: false },
  { id: 'cajon', nombre: 'Cajón y palmas', corto: 'Cajón', familia: 'bateria', pads: KIT_CAJON, sintesis: 'piano', rango: [36, 75], base: 36, sostiene: false },
  { id: 'piano', nombre: 'Piano', corto: 'Piano', familia: 'teclas', paquete: 'piano', sintesis: 'piano', rango: [36, 96], base: 60, sostiene: true },
  { id: 'piano-electrico', nombre: 'Piano eléctrico', corto: 'Eléctrico', familia: 'teclas', paquete: 'piano-electrico', sintesis: 'epiano', rango: [36, 91], base: 60, sostiene: true },
  { id: 'cuerdas', nombre: 'Cuerdas', corto: 'Cuerdas', familia: 'teclas', paquete: 'cuerdas', sintesis: 'colchon', rango: [36, 91], base: 60, sostiene: true },
  { id: 'guitarra', nombre: 'Guitarra', corto: 'Guitarra', familia: 'guitarra', paquete: 'guitarra', sintesis: 'cuerda', rango: [40, 84], base: 52, sostiene: false },
  { id: 'bajo', nombre: 'Bajo', corto: 'Bajo', familia: 'bajo', paquete: 'bajo', sintesis: 'bajo', rango: [28, 60], base: 40, sostiene: true },
];

export function getInstrumento(id: InstrumentoId): DefInstrumento {
  return INSTRUMENTOS.find((def) => def.id === id) ?? INSTRUMENTOS[0];
}

export function instrumentosDe(familia: Familia): DefInstrumento[] {
  return INSTRUMENTOS.filter((def) => def.familia === familia);
}

/** El pad de una nota en un kit; si el kit no la tiene, el más parecido por posición. */
export function padDe(def: DefInstrumento, nota: number): Pad | null {
  if (!def.pads) return null;
  return def.pads.find((pad) => pad.nota === nota) ?? null;
}
