/**
 * Todos los motores de música, y cuál conviene para cada cosa.
 *
 * Víctor, 28-nov-2026: «la idea es que se puedan mezclar todos los modelos de
 * música del mundo… Yo creo que Lyria está bien, porque a mí me están saliendo
 * muy buenos resultados». Así que:
 *
 * - Están TODOS los de aura Studio (mismos ids que su op `music`), y una
 *   canción puede tener versiones de motores distintos para compararlas:
 *   «Prueba con otro motor» es un retoque más.
 * - Por defecto, Lyria 3 Pro (Google directo desde aura Studio): el que mejor
 *   sigue lo que pides y el que le está dando buenos resultados.
 * - Hay tres excepciones automáticas, porque otro motor lo hace mejor:
 *   un boceto de 30 s (Lyria 3, la mitad de precio), una letra que hay que
 *   cantar tal cual (MiniMax Music 3) y el motor falso de desarrollo.
 * - Eleven Music está, pero apagado: sus condiciones piden el plan Enterprise
 *   para dárselo a usuarios (PLAN-MAESTRO.md, C7). Se enciende con su sí.
 *
 * Los precios salen de `precios.ts` (la tabla de aura Studio).
 */

import { creditosDeReceta } from './precios';
import type { MotorId, Receta } from './tipos';

export interface Motor {
  id: MotorId;
  nombre: string;
  /** Quién lo hace. */
  de: string;
  /** Para qué es bueno, en una línea, como lo entiende quien no sabe de modelos. */
  paraQue: string;
  /** Sabe cantar. */
  canta: boolean;
  /** Sabe hacer instrumental. */
  instrumental: boolean;
  /** La letra: la pide siempre, la acepta o la escribe él, o no la usa. */
  letra: 'pide' | 'opcional' | 'no';
  /** Lo más largo que hace de una vez, en segundos. */
  maxSeg: number;
  /** Sirve para el fondo de un paisaje (estable, sin estribillo). */
  paraPaisaje: boolean;
  /** Se puede elegir hoy. Si no, `motivo` dice por qué. */
  disponible: boolean;
  motivo?: string;
}

export const MOTORES: readonly Motor[] = [
  {
    id: 'lyria3',
    nombre: 'Lyria 3 Pro',
    de: 'Google',
    paraQue: 'Canciones enteras con voz o sin ella. Sigue lo que pides al pie de la letra.',
    canta: true,
    instrumental: true,
    letra: 'opcional',
    maxSeg: 180,
    paraPaisaje: true,
    disponible: true,
  },
  {
    id: 'lyria-3.5',
    nombre: 'Lyria 3.5',
    de: 'Google',
    paraQue: 'Lo último de Google. Canciones con voz.',
    canta: true,
    instrumental: true,
    letra: 'opcional',
    maxSeg: 180,
    paraPaisaje: true,
    disponible: true,
  },
  {
    id: 'lyria3-base',
    nombre: 'Lyria 3',
    de: 'Google',
    paraQue: 'Un boceto de 30 segundos para ver si va por ahí, a mitad de precio.',
    canta: true,
    instrumental: true,
    letra: 'opcional',
    maxSeg: 30,
    paraPaisaje: false,
    disponible: true,
  },
  {
    id: 'minimax-music-3',
    nombre: 'MiniMax Music 3',
    de: 'MiniMax',
    paraQue: 'Canta la letra que escribes, palabra por palabra.',
    canta: true,
    instrumental: false,
    letra: 'pide',
    maxSeg: 180,
    paraPaisaje: false,
    disponible: true,
  },
  {
    id: 'minimax-music',
    nombre: 'MiniMax 2.6',
    de: 'MiniMax',
    paraQue: 'Canción con letra; si no la das, la escribe.',
    canta: true,
    instrumental: false,
    letra: 'opcional',
    maxSeg: 180,
    paraPaisaje: false,
    disponible: true,
  },
  {
    id: 'diffrhythm',
    nombre: 'DiffRhythm',
    de: 'ASLP',
    paraQue: 'Tu letra hecha canción en segundos. Necesita estrofa y estribillo.',
    canta: true,
    instrumental: false,
    letra: 'pide',
    maxSeg: 180,
    paraPaisaje: false,
    disponible: true,
  },
  {
    id: 'stable-audio',
    nombre: 'Stable Audio 3',
    de: 'Stability AI',
    paraQue: 'Instrumental de fondo, estable. Bueno para paisajes largos.',
    canta: false,
    instrumental: true,
    letra: 'no',
    maxSeg: 180,
    paraPaisaje: true,
    disponible: true,
  },
  {
    id: 'lyria2',
    nombre: 'Lyria 2',
    de: 'Google',
    paraQue: 'Instrumental de 30 segundos.',
    canta: false,
    instrumental: true,
    letra: 'no',
    maxSeg: 30,
    paraPaisaje: false,
    disponible: true,
  },
  {
    id: 'sonilo',
    nombre: 'Sonilo',
    de: 'Sonilo',
    paraQue: 'Instrumental con licencia para uso comercial.',
    canta: false,
    instrumental: true,
    letra: 'no',
    maxSeg: 180,
    paraPaisaje: true,
    disponible: true,
  },
  {
    id: 'ace-step',
    nombre: 'ACE-Step',
    de: 'ACE Studio (código abierto)',
    paraQue: 'Barato y rápido. Para probar ideas.',
    canta: true,
    instrumental: true,
    letra: 'opcional',
    maxSeg: 180,
    paraPaisaje: true,
    disponible: true,
  },
  {
    id: 'cassette',
    nombre: 'CassetteAI',
    de: 'CassetteAI',
    paraQue: 'El más básico: sigue poco lo que pides.',
    canta: false,
    instrumental: true,
    letra: 'no',
    maxSeg: 180,
    paraPaisaje: false,
    disponible: true,
  },
  {
    id: 'eleven-music',
    nombre: 'Eleven Music',
    de: 'ElevenLabs',
    paraQue: 'Canción con voz del largo que pidas.',
    canta: true,
    instrumental: true,
    letra: 'opcional',
    maxSeg: 180,
    paraPaisaje: true,
    disponible: false,
    motivo: 'Sus condiciones piden el plan Enterprise para dárselo a usuarios.',
  },
  {
    id: 'falso',
    nombre: 'De prueba',
    de: 'aura Music',
    paraQue: 'Suena en el móvil sin gastar. Solo para probar la app.',
    canta: false,
    instrumental: true,
    letra: 'no',
    maxSeg: 180,
    paraPaisaje: true,
    disponible: true,
  },
];

export const MOTOR_POR_DEFECTO: MotorId = 'lyria3';

export function motor(id: MotorId): Motor {
  return MOTORES.find((m) => m.id === id) ?? MOTORES[0];
}

/** ¿Puede este motor hacer esta receta? */
export function sirvePara(m: Motor, receta: Pick<Receta, 'tipo' | 'conVoz' | 'letra'>): boolean {
  if (!m.disponible) return false;
  const conLetra = !!receta.letra?.trim();
  if (m.letra === 'pide' && !conLetra) return false;
  if (receta.conVoz && !m.canta) return false;
  if (!receta.conVoz && !m.instrumental) return false;
  if (receta.tipo === 'paisaje' && !m.paraPaisaje) return false;
  return true;
}

/**
 * El motor que se usa si la persona no elige. Lyria 3 Pro salvo que otro lo
 * haga mejor: el boceto (Lyria 3) y una letra que hay que cantar tal cual
 * (MiniMax Music 3). El motor falso solo si se pide (desarrollo).
 */
export function elegirMotor(
  receta: Pick<Receta, 'tipo' | 'conVoz' | 'letra'>,
  opciones: { boceto?: boolean; falso?: boolean } = {},
): MotorId {
  if (opciones.falso) return 'falso';
  if (opciones.boceto) return 'lyria3-base';
  if (receta.conVoz && receta.letra?.trim()) return 'minimax-music-3';
  return MOTOR_POR_DEFECTO;
}

/**
 * Los otros motores que pueden hacer lo mismo, del más recomendable al menos,
 * para «Prueba con otro motor». Nunca el falso ni los apagados.
 */
export function alternativas(receta: Pick<Receta, 'tipo' | 'conVoz' | 'letra' | 'motor'>): Motor[] {
  return MOTORES.filter((m) => m.id !== receta.motor && m.id !== 'falso' && m.id !== 'lyria3-base' && sirvePara(m, receta));
}

/** Lo que cuesta la receta con cada motor que sirve: para enseñarlo al elegir. */
export function preciosPorMotor(receta: Receta): { motor: Motor; creditos: number }[] {
  return MOTORES.filter((m) => m.id !== 'falso' && sirvePara(m, receta)).map((m) => ({
    motor: m,
    creditos: creditosDeReceta({ ...receta, motor: m.id }),
  }));
}
