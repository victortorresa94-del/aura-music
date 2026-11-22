/**
 * La claqueta: lo que suena para llevar el tempo mientras grabas.
 *
 * El tic-tac de siempre no le sirve a todo el mundo («nunca me ha
 * funcionado muy bien», el dueño, 22-nov-2026): con una guitarra delante un
 * clic agudo se pierde, y hay quien toca mejor con un bombo a negras o con
 * una rumba suave debajo. Aquí se decide QUÉ suena en cada paso; el motor
 * solo lo programa en el reloj de audio. Sin audio y sin Web Audio: se
 * prueba con números.
 *
 * Reutiliza el kit sintetizado y los ritmos de `rhythm/` tal cual, sin
 * tocarlos: la claqueta es otra forma de usar las mismas voces.
 */

import { getGroove, type Groove } from '../rhythm/grooves';
import type { VoiceId } from '../rhythm/kit';
import type { GrooveOptions } from '../rhythm/player';

export type SonidoClaqueta = 'tictac' | 'bombo' | 'bombo-caja' | 'shaker' | 'palmas' | 'baqueta';
export type Subdivision = 'blancas' | 'negras' | 'corcheas' | 'tresillos';
export type FondoId = 'rumba-suave' | 'pop' | 'balada' | 'buleria' | 'bossa';

export interface AjustesClaqueta {
  sonido: SonidoClaqueta;
  subdivision: Subdivision;
  /** El 1 de cada compás más fuerte (y en el tic-tac, más agudo). */
  acento: boolean;
  /** Ganancia de la claqueta, aparte de la mezcla: de 0 a 1,5. */
  volumen: number;
  /** Un ritmo suave que suena solo mientras grabas o reproduces. Nunca pasa a pista. */
  fondo: FondoId | null;
  /** Con un ritmo de fondo, si el clic suena también encima. */
  clicConFondo: boolean;
}

export const CLAQUETA_POR_DEFECTO: AjustesClaqueta = {
  // El de siempre: quien no toque nada oye exactamente lo mismo que antes.
  sonido: 'tictac',
  subdivision: 'negras',
  acento: true,
  volumen: 0.8,
  fondo: null,
  clicConFondo: false,
};

export const SONIDOS: { id: SonidoClaqueta; nombre: string }[] = [
  { id: 'tictac', nombre: 'Tic-tac' },
  { id: 'bombo', nombre: 'Bombo' },
  { id: 'bombo-caja', nombre: 'Bombo y caja' },
  { id: 'shaker', nombre: 'Shaker' },
  { id: 'palmas', nombre: 'Palmas' },
  { id: 'baqueta', nombre: 'Baqueta' },
];

export const SUBDIVISIONES: { id: Subdivision; nombre: string }[] = [
  { id: 'blancas', nombre: 'Blancas' },
  { id: 'negras', nombre: 'Negras' },
  { id: 'corcheas', nombre: 'Corcheas' },
  { id: 'tresillos', nombre: 'Tresillos' },
];

/** Cuántos pulsos dura cada golpe de la subdivisión. */
export const PULSOS_POR_GOLPE: Record<Subdivision, number> = {
  blancas: 2,
  negras: 1,
  corcheas: 0.5,
  tresillos: 1 / 3,
};

export interface Fondo {
  id: FondoId;
  nombre: string;
  grooveId: string;
  /**
   * Bajito y con poco relleno, como el «Cuánto» y el «Fuerza» bajos de la
   * hoja de Ritmos: está para llevar el tempo, no para tapar la toma.
   */
  opciones: GrooveOptions;
}

export const FONDOS: Fondo[] = [
  { id: 'rumba-suave', nombre: 'Rumba suave', grooveId: 'rumba', opciones: { complejidad: 0.35, fuerza: 0.55, humano: 0.25 } },
  { id: 'pop', nombre: 'Pop', grooveId: 'pop', opciones: { complejidad: 0.45, fuerza: 0.55, humano: 0.2 } },
  { id: 'balada', nombre: 'Balada', grooveId: 'balada68', opciones: { complejidad: 0.4, fuerza: 0.5, humano: 0.25 } },
  { id: 'buleria', nombre: 'Bulería', grooveId: 'bulerias-palmas', opciones: { complejidad: 0.5, fuerza: 0.55, humano: 0.2 } },
  { id: 'bossa', nombre: 'Bossa', grooveId: 'bossa', opciones: { complejidad: 0.45, fuerza: 0.5, humano: 0.2 } },
];

export function fondoDe(id: FondoId | null): (Fondo & { groove: Groove }) | null {
  const fondo = FONDOS.find((f) => f.id === id);
  const groove = fondo ? getGroove(fondo.grooveId) : null;
  return fondo && groove ? { ...fondo, groove } : null;
}

const SONIDOS_IDS = SONIDOS.map((s) => s.id);
const SUBDIVISIONES_IDS = SUBDIVISIONES.map((s) => s.id);
const FONDOS_IDS = FONDOS.map((f) => f.id);

/** Los ajustes guardados, con lo que falte puesto por defecto y todo en su sitio. */
export function claquetaDe(settings: { claqueta?: Partial<AjustesClaqueta> | null }): AjustesClaqueta {
  const c = settings.claqueta ?? {};
  const d = CLAQUETA_POR_DEFECTO;
  return {
    sonido: SONIDOS_IDS.includes(c.sonido as SonidoClaqueta) ? (c.sonido as SonidoClaqueta) : d.sonido,
    subdivision: SUBDIVISIONES_IDS.includes(c.subdivision as Subdivision) ? (c.subdivision as Subdivision) : d.subdivision,
    acento: typeof c.acento === 'boolean' ? c.acento : d.acento,
    volumen: typeof c.volumen === 'number' && Number.isFinite(c.volumen) ? Math.min(1.5, Math.max(0, c.volumen)) : d.volumen,
    fondo: FONDOS_IDS.includes(c.fondo as FondoId) ? (c.fondo as FondoId) : null,
    clicConFondo: typeof c.clicConFondo === 'boolean' ? c.clicConFondo : d.clicConFondo,
  };
}

/** ¿Suena el clic? Con un ritmo de fondo, solo si se ha pedido encima. */
export function suenaElClic(ajustes: AjustesClaqueta): boolean {
  return !ajustes.fondo || ajustes.clicConFondo;
}

/* -------------------------------------------------------------------------- */
/* Qué suena en cada paso                                                      */
/* -------------------------------------------------------------------------- */

/** Un tic del metrónomo de siempre (agudo en el acento) o una voz del kit. */
export type VozClaqueta = { tipo: 'tic'; agudo: boolean } | { tipo: 'kit'; voz: VoiceId };

export interface GolpeClaqueta {
  voz: VozClaqueta;
  /** 0..1 */
  vel: number;
}

const tic = (agudo: boolean, vel: number): GolpeClaqueta => ({ voz: { tipo: 'tic', agudo }, vel });
const kit = (voz: VoiceId, vel: number): GolpeClaqueta => ({ voz: { tipo: 'kit', voz }, vel });

/** Dónde cae el paso `k` de la subdivisión dentro del compás. */
export function lugarDelPaso(subdivision: Subdivision, paso: number, pulsosPorCompas: number) {
  const pulsos = Math.max(1, Math.round(pulsosPorCompas));
  const beat = paso * PULSOS_POR_GOLPE[subdivision];
  const redondo = Math.round(beat);
  const esPulso = Math.abs(beat - redondo) < 1e-6;
  const pulsoEnCompas = ((redondo % pulsos) + pulsos) % pulsos;
  return { beat, esPulso, esUno: esPulso && pulsoEnCompas === 0, pulsoEnCompas };
}

/**
 * Lo que suena en el paso `k` (el paso 0 es el 1 del primer compás). Los
 * pulsos llevan el sonido elegido; lo que hay entre pulso y pulso (corcheas,
 * tresillos) va más flojo, para que el pulso se siga oyendo como pulso.
 */
export function golpesDelPaso(ajustes: AjustesClaqueta, paso: number, pulsosPorCompas: number): GolpeClaqueta[] {
  const { esPulso, esUno, pulsoEnCompas } = lugarDelPaso(ajustes.subdivision, paso, pulsosPorCompas);
  const acento = ajustes.acento && esUno;
  switch (ajustes.sonido) {
    case 'tictac':
      // Los pulsos, a tope como siempre: el tic-tac por defecto suena igual que antes.
      return [esPulso ? tic(acento, 1) : tic(false, 0.5)];
    case 'bombo':
      // A negras y con todo el cuerpo: el «modo bombo» que pedía el dueño.
      return [esPulso ? kit('bombo', acento ? 1 : 0.82) : kit('bombo', 0.35)];
    case 'bombo-caja':
      if (!esPulso) return [kit('charles', 0.4)];
      // Bombo en el 1 y el 3, caja en el 2 y el 4.
      return [pulsoEnCompas % 2 === 0 ? kit('bombo', acento ? 1 : 0.85) : kit('caja', 0.75)];
    case 'shaker':
      return [kit('shaker', esPulso ? (acento ? 1 : 0.75) : 0.45)];
    case 'palmas':
      return [esPulso ? kit('palma_seca', acento ? 1 : 0.78) : kit('palma_sorda', 0.5)];
    case 'baqueta':
      // Dos baquetas que chocan: un golpe de madera, seco y agudo.
      return [kit('clave', esPulso ? (acento ? 1 : 0.7) : 0.4)];
  }
}

/**
 * La cuenta atrás: siempre a negras y con el 1 marcado (es lo que te da la
 * entrada), pero con el MISMO sonido que la claqueta. Un bombo que cuenta
 * cuatro y luego un tic-tac despistaba.
 */
export function golpesDeCuenta(ajustes: AjustesClaqueta, pulso: number, pulsosPorCompas: number): GolpeClaqueta[] {
  return golpesDelPaso({ ...ajustes, subdivision: 'negras', acento: true }, pulso, pulsosPorCompas);
}

/** El primer paso que cae en `posicion` o después (en segundos de línea de tiempo). */
export function primerPaso(posicion: number, bpm: number, subdivision: Subdivision): { paso: number; segundos: number } {
  const duracion = (60 / Math.max(1, bpm)) * PULSOS_POR_GOLPE[subdivision];
  const paso = Math.max(0, Math.ceil(posicion / duracion - 1e-6));
  return { paso, segundos: paso * duracion };
}
