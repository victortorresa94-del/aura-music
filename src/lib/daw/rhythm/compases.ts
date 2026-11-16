/**
 * Compases.
 *
 * Aquí está la diferencia del producto, así que conviene explicarla bien.
 *
 * Casi todos los secuenciadores del mundo asumen que la música se cuenta en
 * grupos de cuatro. GarageBand admite 4/4, 3/4 y 6/8 y se acabó. Por eso
 * ninguna de las apps grandes puede acompañar una bulería: no es que les falte
 * un preset, es que su modelo de datos no sabe expresarla.
 *
 * Aquí el modelo es un CICLO de N pulsos con acentos en posiciones
 * arbitrarias. Un 4/4 no es el caso normal y la bulería la excepción: el 4/4
 * es simplemente el ciclo más corto y aburrido de la lista.
 *
 * El compás de doce del flamenco (soleá, bulería, alegrías) se cuenta
 * 1-2-3-4-5-6-7-8-9-10-11-12 con los acentos en 12, 3, 6, 8 y 10. Se escribe
 * aquí con índice desde 1 para que se lea igual que se cuenta en una peña, y
 * el motor ya se encarga de restar.
 */

export interface Compas {
  id: string;
  nombre: string;
  /** Pulsos del ciclo completo. */
  pulsos: number;
  /** Posiciones acentuadas, contando desde 1. */
  acentos: number[];
  /** Pasos por pulso. 2 = corcheas, 4 = semicorcheas. */
  subdivision: number;
  /** Cómo se cuenta en voz alta, para enseñarlo en pantalla. */
  cuenta?: string;
}

export const COMPASES: Compas[] = [
  {
    id: 'c44',
    nombre: '4/4',
    pulsos: 4,
    acentos: [1],
    subdivision: 4,
  },
  {
    id: 'c34',
    nombre: '3/4',
    pulsos: 3,
    acentos: [1],
    subdivision: 4,
  },
  {
    id: 'c68',
    nombre: '6/8',
    pulsos: 6,
    acentos: [1, 4],
    subdivision: 2,
  },
  {
    id: 'flamenco12',
    nombre: 'Doce flamenco',
    pulsos: 12,
    // El acento del 12 abre el ciclo: es el remate del anterior y el arranque
    // del siguiente a la vez. Por eso se cuenta 12-1-2-3...
    acentos: [12, 3, 6, 8, 10],
    subdivision: 2,
    cuenta: '12 · 1 · 2 · 3 · 4 · 5 · 6 · 7 · 8 · 9 · 10 · 11',
  },
  {
    id: 'rumba8',
    nombre: 'Rumba (8)',
    pulsos: 8,
    acentos: [1, 4, 7],
    subdivision: 2,
    cuenta: 'el tres-tres-dos de la rumba',
  },
  {
    id: 'tangos4',
    nombre: 'Tangos flamencos',
    pulsos: 4,
    acentos: [2, 3, 4],
    subdivision: 4,
  },
];

export function getCompas(id: string): Compas {
  return COMPASES.find((compas) => compas.id === id) ?? COMPASES[0];
}

/** Pasos del ciclo completo. */
export function pasosPorCiclo(compas: Compas): number {
  return compas.pulsos * compas.subdivision;
}

/** Duración de un paso, en segundos, para un tempo dado en pulsos por minuto. */
export function duracionPaso(compas: Compas, bpm: number): number {
  return 60 / bpm / compas.subdivision;
}

/** Duración del ciclo completo en segundos. */
export function duracionCiclo(compas: Compas, bpm: number): number {
  return duracionPaso(compas, bpm) * pasosPorCiclo(compas);
}

/** ¿Este paso cae en un pulso acentuado del compás? */
export function esAcento(compas: Compas, paso: number): boolean {
  if (paso % compas.subdivision !== 0) return false;
  const pulso = paso / compas.subdivision + 1;
  return compas.acentos.includes(pulso);
}
