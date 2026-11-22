/**
 * El registro de instrumentos: qué hay, cómo se llama, qué registro cubre y
 * con qué suena. La pantalla «Tocar», la reproducción y el WAV leen de aquí;
 * añadir un instrumento es añadir una entrada.
 */

import type { VoiceId } from '@/lib/daw/rhythm/kit';
import type { TimbreOscilador } from './osciladores';
import type { PaqueteId } from './packs';
import type { TimbreSintetico } from './sinte';
import type { InstrumentoId } from './tipos';

/**
 * El icono de cada cosa. Los dibuja `components/daw/instrumentos/iconos.tsx`:
 * los de Phosphor (MIT), como en Aura, y los que Phosphor no tiene (batería,
 * cajón, bajo, órgano...) dibujados con su mismo trazo.
 */
export type IconoInstrumento =
  | 'bateria'
  | 'caja-de-ritmos'
  | 'cajon'
  | 'congas'
  | 'piano'
  | 'electrico'
  | 'organo'
  | 'pad'
  | 'sinte'
  | 'cuerdas'
  | 'pizzicato'
  | 'metales'
  | 'marimba'
  | 'guitarra'
  | 'bajo'
  | 'contrabajo'
  | 'sub'
  | 'analogico';

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
  sintesis: TimbreSintetico | TimbreOscilador;
  icono: IconoInstrumento;
  /** Una línea que dice cómo suena, para la baldosa. */
  detalle: string;
  /** Se puede tocar con las tiras de acordes. */
  acordes?: boolean;
  /** No se ofrece al elegir (se conserva para abrir pistas viejas). */
  oculto?: boolean;
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

/*
 * La batería acústica: muestras de verdad (capas de fuerza y golpes
 * alternos). Las voces solo cuentan si falta una muestra: entonces suena la
 * misma pieza de otro paquete, o su síntesis sin red.
 */
const KIT_ACUSTICA = kit(
  ['Cencerro', 'Claves', 'Shaker', 'Pandereta', 'Tom grave', 'Tom medio', 'Tom agudo', 'Ride', 'Charles', 'Charles pedal', 'Charles abierto', 'Crash', 'Bombo', 'Aro', 'Caja', 'Palmas'],
  ['cencerro', 'clave', 'shaker', 'pandereta', 'tom_grave', 'tom_medio', 'tom_agudo', 'ride', 'charles', 'charles_pedal', 'charles_abierto', 'platillo', 'bombo', 'nudillos', 'caja', 'palma_seca'],
);

/* Percusión latina: congas y bongós abajo, que es donde van las manos. */
const KIT_LATINA: Pad[] = [
  { nota: 36, nombre: 'Bombo', voz: 'bombo' },
  { nota: 39, nombre: 'Palmas', voz: 'palma_seca' },
  { nota: 37, nombre: 'Aro', voz: 'nudillos' },
  { nota: 49, nombre: 'Platillo', voz: 'platillo' },
  { nota: 73, nombre: 'Güiro', voz: 'guiro' },
  { nota: 70, nombre: 'Shaker', voz: 'shaker' },
  { nota: 75, nombre: 'Claves', voz: 'clave' },
  { nota: 54, nombre: 'Pandereta', voz: 'pandereta' },
  { nota: 64, nombre: 'Conga grave', voz: 'conga_grave' },
  { nota: 65, nombre: 'Timbal agudo', voz: 'timbal_agudo' },
  { nota: 66, nombre: 'Timbal grave', voz: 'timbal_grave' },
  { nota: 56, nombre: 'Cencerro', voz: 'cencerro' },
  { nota: 63, nombre: 'Conga', voz: 'conga_abierta' },
  { nota: 62, nombre: 'Conga slap', voz: 'conga_slap' },
  { nota: 60, nombre: 'Bongó agudo', voz: 'bongo_agudo' },
  { nota: 61, nombre: 'Bongó grave', voz: 'bongo_grave' },
];

/* El cajón: lo que hace el que acompaña por bulerías, con palmas y pitos. */
const KIT_CAJON = kit(
  ['Bongó agudo', 'Clave', 'Shaker', 'Pandereta', 'Bongó grave', 'Conga', 'Conga slap', 'Güiro', 'Palma sorda', 'Nudillos', 'Pito', 'Cencerro', 'Grave', 'Suave', 'Slap', 'Palmas'],
  ['bongo_agudo', 'clave', 'shaker', 'pandereta', 'bongo_grave', 'conga_abierta', 'conga_slap', 'guiro', 'palma_sorda', 'nudillos', 'chasquido', 'cencerro', 'cajon_grave', 'cajon_ghost', 'cajon_slap', 'palma_seca'],
);

/* -------------------------------------------------------------------------- */
/* Registro                                                                    */
/* -------------------------------------------------------------------------- */

export const INSTRUMENTOS: DefInstrumento[] = [
  // Batería
  { id: 'bateria-acustica', nombre: 'Batería acústica', corto: 'Acústica', detalle: 'Kit de verdad', icono: 'bateria', familia: 'bateria', pads: KIT_ACUSTICA, paquete: 'bateria-acustica', sintesis: 'piano', rango: [36, 75], base: 36, sostiene: false },
  { id: 'bateria-808', nombre: 'Caja de ritmos 808', corto: '808', detalle: 'Bombo largo, hip hop', icono: 'caja-de-ritmos', familia: 'bateria', pads: KIT_808, sintesis: 'piano', rango: [36, 75], base: 36, sostiene: false },
  { id: 'bateria-909', nombre: 'Caja de ritmos 909', corto: '909', detalle: 'Pegada de club', icono: 'caja-de-ritmos', familia: 'bateria', pads: KIT_909, sintesis: 'piano', rango: [36, 75], base: 36, sostiene: false },
  { id: 'cajon', nombre: 'Cajón y palmas', corto: 'Cajón', detalle: 'Flamenco y rumba', icono: 'cajon', familia: 'bateria', pads: KIT_CAJON, paquete: 'cajon', sintesis: 'piano', rango: [36, 75], base: 36, sostiene: false },
  { id: 'percusion-latina', nombre: 'Percusión latina', corto: 'Latina', detalle: 'Congas, bongós, güiro', icono: 'congas', familia: 'bateria', pads: KIT_LATINA, paquete: 'percusion-latina', sintesis: 'piano', rango: [36, 75], base: 36, sostiene: false },
  // Teclados y orquesta
  { id: 'piano', nombre: 'Piano', corto: 'Piano', detalle: 'De cola', icono: 'piano', familia: 'teclas', paquete: 'piano', sintesis: 'piano', rango: [36, 96], base: 60, sostiene: true, acordes: true },
  { id: 'piano-electrico', nombre: 'Piano eléctrico', corto: 'Eléctrico', detalle: 'FM de los ochenta', icono: 'electrico', familia: 'teclas', paquete: 'piano-electrico', sintesis: 'epiano', rango: [36, 91], base: 60, sostiene: true, acordes: true },
  { id: 'organo', nombre: 'Órgano de tubos', corto: 'Órgano', detalle: 'De tubos, lleno', icono: 'organo', familia: 'teclas', paquete: 'organo', sintesis: 'organo', rango: [36, 91], base: 60, sostiene: true, acordes: true },
  { id: 'organo-electrico', nombre: 'Órgano eléctrico', corto: 'Gospel', detalle: 'De ruedas, con vibrato', icono: 'organo', familia: 'teclas', sintesis: 'organo', rango: [36, 91], base: 60, sostiene: true, acordes: true },
  { id: 'cuerdas', nombre: 'Cuerdas', corto: 'Cuerdas', detalle: 'Sección sostenida', icono: 'cuerdas', familia: 'teclas', paquete: 'cuerdas', sintesis: 'colchon', rango: [36, 91], base: 60, sostiene: true, acordes: true },
  { id: 'pizzicato', nombre: 'Cuerdas en pizzicato', corto: 'Pizzicato', detalle: 'Pellizcadas', icono: 'pizzicato', familia: 'teclas', paquete: 'pizzicato', sintesis: 'cuerda', rango: [36, 88], base: 60, sostiene: false, acordes: true },
  { id: 'metales', nombre: 'Metales', corto: 'Metales', detalle: 'Trompetas y trombones', icono: 'metales', familia: 'teclas', paquete: 'metales', sintesis: 'metales', rango: [40, 84], base: 60, sostiene: true, acordes: true },
  { id: 'marimba', nombre: 'Marimba', corto: 'Marimba', detalle: 'Láminas de madera', icono: 'marimba', familia: 'teclas', paquete: 'marimba', sintesis: 'marimba', rango: [45, 96], base: 60, sostiene: false },
  { id: 'pad', nombre: 'Pad', corto: 'Pad', detalle: 'Colchón que respira', icono: 'pad', familia: 'teclas', sintesis: 'pad', rango: [36, 91], base: 60, sostiene: true, acordes: true },
  { id: 'sinte', nombre: 'Sinte solista', corto: 'Sinte', detalle: 'Para melodías', icono: 'sinte', familia: 'teclas', sintesis: 'sinte', rango: [40, 96], base: 60, sostiene: true },
  // Guitarras
  { id: 'guitarra', nombre: 'Guitarra española', corto: 'Española', detalle: 'Cuerdas de nailon', icono: 'guitarra', familia: 'guitarra', paquete: 'guitarra', sintesis: 'cuerda', rango: [40, 84], base: 52, sostiene: false, acordes: true },
  { id: 'guitarra-acero', nombre: 'Guitarra acústica', corto: 'Acero', detalle: 'Cuerdas de acero', icono: 'guitarra', familia: 'guitarra', paquete: 'guitarra-acero', sintesis: 'cuerda', rango: [40, 84], base: 52, sostiene: false, acordes: true },
  // Bajos
  { id: 'bajo-dedos', nombre: 'Bajo con dedos', corto: 'Dedos', detalle: 'Redondo y cálido', icono: 'bajo', familia: 'bajo', paquete: 'bajo-dedos', sintesis: 'bajo', rango: [28, 60], base: 40, sostiene: true },
  { id: 'bajo-pua', nombre: 'Bajo con púa', corto: 'Púa', detalle: 'Ataque y brillo', icono: 'bajo', familia: 'bajo', paquete: 'bajo-pua', sintesis: 'analogico', rango: [28, 60], base: 40, sostiene: true },
  { id: 'contrabajo', nombre: 'Contrabajo', corto: 'Contrabajo', detalle: 'Jazz, pizzicato', icono: 'contrabajo', familia: 'bajo', paquete: 'contrabajo', sintesis: 'cuerda', rango: [28, 60], base: 40, sostiene: false },
  { id: 'bajo-sub', nombre: 'Bajo sub', corto: 'Sub', detalle: 'Grave limpio', icono: 'sub', familia: 'bajo', sintesis: 'sub', rango: [24, 60], base: 36, sostiene: true },
  { id: 'bajo-808', nombre: 'Bajo 808', corto: '808', detalle: 'Cae y satura, trap', icono: 'caja-de-ritmos', familia: 'bajo', sintesis: 'bajo808', rango: [24, 60], base: 36, sostiene: true },
  { id: 'bajo-analogico', nombre: 'Bajo analógico', corto: 'Analógico', detalle: 'Sierra con filtro', icono: 'analogico', familia: 'bajo', sintesis: 'analogico', rango: [24, 60], base: 36, sostiene: true },
  // El de la primera versión: se queda para abrir pistas viejas.
  { id: 'bajo', nombre: 'Bajo eléctrico (Growlybass)', corto: 'Growly', detalle: 'El de antes', icono: 'bajo', familia: 'bajo', paquete: 'bajo', sintesis: 'bajo', rango: [28, 60], base: 40, sostiene: true, oculto: true },
];

export function getInstrumento(id: InstrumentoId): DefInstrumento {
  return INSTRUMENTOS.find((def) => def.id === id) ?? INSTRUMENTOS[0];
}

export function instrumentosDe(familia: Familia): DefInstrumento[] {
  return INSTRUMENTOS.filter((def) => def.familia === familia && !def.oculto);
}

/**
 * Lo que se puede tocar con las tiras de acordes. Los tres de siempre van
 * primero y en su orden (Española, Piano, Cuerdas): las cuerdas son el sonido
 * favorito del dueño y tienen que seguir a la vista, a un toque. Los nuevos,
 * detrás.
 */
const ORDEN_ACORDES: InstrumentoId[] = ['guitarra', 'piano', 'cuerdas', 'guitarra-acero', 'piano-electrico', 'organo', 'organo-electrico', 'pizzicato', 'metales', 'pad'];

export function instrumentosDeAcordes(): DefInstrumento[] {
  const lista = INSTRUMENTOS.filter((def) => def.acordes && !def.oculto);
  const posicion = (id: InstrumentoId) => {
    const i = ORDEN_ACORDES.indexOf(id);
    return i < 0 ? ORDEN_ACORDES.length : i;
  };
  return [...lista].sort((a, b) => posicion(a.id) - posicion(b.id));
}

/** El bajo que suena si no has elegido otro. */
export const BAJO_POR_DEFECTO: InstrumentoId = 'bajo-dedos';

/** El pad de una nota en un kit; si el kit no la tiene, el más parecido por posición. */
export function padDe(def: DefInstrumento, nota: number): Pad | null {
  if (!def.pads) return null;
  return def.pads.find((pad) => pad.nota === nota) ?? null;
}
