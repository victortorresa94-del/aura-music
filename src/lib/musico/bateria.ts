/**
 * La batería del músico de sesión.
 *
 * No escribe notas propias: usa los ritmos del estudio (pop, bolero, rumba,
 * bulerías…), pero al tempo y al pulso de TU toma. Antes era al revés: el
 * ritmo traía su tempo y te tocaba ajustarlo a mano.
 */

import { GROOVES, type Groove } from '@/lib/daw/rhythm/grooves';

/**
 * El tempo al que tiene que ir un ritmo para cuadrar con tu toma. Si tu tempo
 * cae fuera de lo que ese ritmo admite, se prueba al doble y a la mitad: así
 * los golpes siguen cayendo en tus pulsos. Si ni así, manda tu tempo.
 */
export function tempoParaRitmo(bpm: number, [minimo, maximo]: [number, number]): number {
  for (const candidato of [bpm, bpm * 2, bpm / 2]) {
    if (candidato >= minimo && candidato <= maximo) return candidato;
  }
  return bpm;
}

/** Cuánto se aleja tu tempo de lo natural en ese ritmo (0 = dentro, al tempo). */
function distancia(bpm: number, groove: Groove): number {
  const t = tempoParaRitmo(bpm, groove.bpm);
  if (t >= groove.bpm[0] && t <= groove.bpm[1]) return t === bpm ? 0 : 1;
  return 2 + Math.min(Math.abs(bpm - groove.bpm[0]), Math.abs(bpm - groove.bpm[1])) / 100;
}

/**
 * Los ritmos ordenados de más a menos natural para tu tempo. A igualdad, el
 * pop sencillo y luego los de cuatro: sin saber tu compás, es lo que menos
 * sorprende. Un doce flamenco de salida sobre una canción pop suena a error.
 */
export function ritmosParaTempo(bpm: number): Groove[] {
  const preferencia = (g: Groove) => (g.id === 'pop' ? 0 : g.compasId === 'c44' ? 1 : 2);
  return [...GROOVES].sort(
    (a, b) => distancia(bpm, a) - distancia(bpm, b) || preferencia(a) - preferencia(b),
  );
}

/** Si cuadra con tu tempo sin forzarlo. */
export function vaConTuTempo(bpm: number, groove: Groove): boolean {
  return distancia(bpm, groove) < 2;
}

/**
 * Coloca un ritmo ya renderizado debajo de la toma: el primer golpe del ritmo
 * en el primer pulso de la toma, y nada más allá de lo que dura.
 */
export function colocarRitmo(
  ritmo: Float32Array,
  sampleRate: number,
  o: { fase: number; bpm: number; duracion: number },
): Float32Array {
  const T = 60 / o.bpm;
  const fase = ((o.fase % T) + T) % T;
  const out = new Float32Array(Math.max(0, Math.round(o.duracion * sampleRate)));
  const desde = Math.round(fase * sampleRate);
  if (desde < out.length) out.set(ritmo.subarray(0, out.length - desde), desde);
  return out;
}
