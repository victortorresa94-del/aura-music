/**
 * Lo mínimo de teoría que necesita el músico de sesión para no desafinar:
 * cómo se llaman las notas, qué es un acorde y qué acordes caben en una
 * tonalidad.
 *
 * Las clases de nota van de 0 (Do) a 11 (Si). Las notas concretas, en
 * numeración MIDI: 69 es el La de 440 Hz y el Mi más grave del bajo es el 28.
 */

import type { Modo } from '@/lib/daw/analysis/key';

export const NOTAS = ['Do', 'Do#', 'Re', 'Mib', 'Mi', 'Fa', 'Fa#', 'Sol', 'Sol#', 'La', 'Sib', 'Si'] as const;

/** Las mismas notas en inglés, que es como las entienden los modelos. */
export const NOTAS_EN = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'G#', 'A', 'Bb', 'B'] as const;

export type Calidad = 'mayor' | 'menor';

export interface Acorde {
  /** Clase de nota de la raíz, 0 = Do. */
  raiz: number;
  calidad: Calidad;
}

export interface Tonalidad {
  tonica: number;
  modo: Modo;
}

export function claseDeNota(n: number): number {
  return ((Math.round(n) % 12) + 12) % 12;
}

/** «La m», «Sol», «Fa#». La m minúscula es como se escribe en un cancionero. */
export function nombreAcorde(acorde: Acorde): string {
  return `${NOTAS[claseDeNota(acorde.raiz)]}${acorde.calidad === 'menor' ? ' m' : ''}`;
}

/** Intervalos del acorde desde la raíz: tercera y quinta. */
export function notasDelAcorde(acorde: Acorde): [number, number, number] {
  const r = claseDeNota(acorde.raiz);
  const tercera = acorde.calidad === 'mayor' ? 4 : 3;
  return [r, (r + tercera) % 12, (r + 7) % 12];
}

const ESCALAS: Record<Modo, number[]> = {
  mayor: [0, 2, 4, 5, 7, 9, 11],
  menor: [0, 2, 3, 5, 7, 8, 10],
  /* El frigio del flamenco lleva la tercera MAYOR sobre la tónica (el Mi
     mayor de «por arriba»), así que la escala que de verdad suena tiene las
     dos terceras: la menor en la melodía y la mayor en el acorde. */
  frigio: [0, 1, 3, 4, 5, 7, 8, 10],
};

export function escala(t: Tonalidad): number[] {
  return ESCALAS[t.modo].map((i) => (t.tonica + i) % 12);
}

/**
 * Los acordes que «tocan» en la tonalidad. No es una prohibición —una canción
 * puede pedir prestado lo que quiera— sino un empujón a favor cuando el oído
 * duda entre dos lecturas.
 */
export function acordesDiatonicos(t: Tonalidad): Acorde[] {
  const at = (grado: number, calidad: Calidad): Acorde => ({ raiz: (t.tonica + grado) % 12, calidad });
  switch (t.modo) {
    case 'mayor':
      return [at(0, 'mayor'), at(2, 'menor'), at(4, 'menor'), at(5, 'mayor'), at(7, 'mayor'), at(9, 'menor')];
    case 'menor':
      // Con el V mayor de la menor armónica: es el que se toca de verdad.
      return [at(0, 'menor'), at(3, 'mayor'), at(5, 'menor'), at(7, 'menor'), at(7, 'mayor'), at(8, 'mayor'), at(10, 'mayor')];
    case 'frigio':
      // Cadencia andaluza en Mi: La m, Sol, Fa, MI. Más el Do y el Re m.
      return [at(0, 'mayor'), at(1, 'mayor'), at(3, 'mayor'), at(5, 'menor'), at(8, 'mayor'), at(10, 'menor')];
  }
}

export function mismoAcorde(a: Acorde | null, b: Acorde | null): boolean {
  if (!a || !b) return a === b;
  return claseDeNota(a.raiz) === claseDeNota(b.raiz) && a.calidad === b.calidad;
}

/** Frecuencia de una nota MIDI. */
export function frecuencia(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/**
 * La raíz del acorde en el registro del bajo: del Mi grave (28) al Re# de
 * encima (39). Es donde un bajo eléctrico de cuatro cuerdas pisa la raíz casi
 * siempre, y deja sitio a la quinta y la octava sin salirse del mástil.
 */
export function raizEnElBajo(clase: number): number {
  return 28 + ((claseDeNota(clase) - 4 + 12) % 12);
}

/** «E minor», «C major»: el formato que esperan los modelos generativos. */
export function tonalidadEnIngles(t: Tonalidad): string {
  // Un frigio en Mi tiene la armadura de La menor: es lo que entiende un
  // modelo entrenado con música occidental de catálogo.
  if (t.modo === 'frigio') return `${NOTAS_EN[(t.tonica + 5) % 12]} minor`;
  return `${NOTAS_EN[t.tonica]} ${t.modo === 'mayor' ? 'major' : 'minor'}`;
}

/** Generador pseudoaleatorio con semilla: la misma petición, el mismo bajo. */
export function aleatorio(semilla: number): () => number {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
