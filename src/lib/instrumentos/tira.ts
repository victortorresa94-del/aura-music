/**
 * Las cuentas de la tira de tiempo de «Tocar»: cuántos compases caben, qué
 * trozo de la canción se ve, qué notas caen ahí y a qué compás saltan los
 * botones. Puro, sin navegador: se prueba en `tira.test.ts`.
 *
 * Todo va en segundos de la línea de tiempo, como el motor.
 */

import type { Track } from '@/lib/daw/types';
import type { InstrumentoId } from './tipos';

/** Unos 28 px por compás: el número se lee, el dedo acierta y en un móvil caben ocho. */
export function compasesVisibles(ancho: number): number {
  const n = Math.max(4, Math.min(32, Math.floor(ancho / 28)));
  // De ocho en adelante, de cuatro en cuatro: las frases se ven enteras.
  return n >= 8 ? n - (n % 4) : n;
}

/** El compás (desde 0) en el que está una posición. */
export function compasDe(posicion: number, compasSeg: number): number {
  return Math.max(0, Math.floor(posicion / compasSeg + 1e-6));
}

/**
 * «Atrás un compás»: si estás ya entrado en el compás, al principio de ese;
 * si estás en su principio, al anterior. Como el botón de atrás de un
 * reproductor.
 */
export function compasAnterior(posicion: number, compasSeg: number, pulso: number): number {
  const actual = compasDe(posicion, compasSeg);
  const dentro = posicion - actual * compasSeg;
  return dentro > pulso * 0.25 ? actual : Math.max(0, actual - 1);
}

/** El primer compás que se ve: por páginas, y con el loop entero a la vista si lo hay. */
export function paginaDe(compasCursor: number, visibles: number, bucle?: { desdeCompas: number; compases: number } | null): number {
  if (bucle && bucle.compases <= visibles) return Math.floor(bucle.desdeCompas / visibles) * visibles;
  return Math.floor(Math.max(0, compasCursor) / visibles) * visibles;
}

/** Una posición tocada dentro de un loop, plegada a sus compases. */
export function plegar(posicion: number, bucle: { desde: number; largo: number } | null): number {
  if (!bucle || bucle.largo <= 0) return posicion;
  return bucle.desde + ((((posicion - bucle.desde) % bucle.largo) + bucle.largo) % bucle.largo);
}

export interface NotaEnTira {
  /** Segundos de la línea de tiempo. */
  t: number;
  dur: number;
  nota: number;
  /** «propia»: del instrumento que tienes abierto; «otra»: de otra pista de notas. */
  tipo: 'propia' | 'otra';
}

/**
 * Las notas de las pistas que caen entre `desde` y `hasta`, con sus
 * repeticiones y su recorte. Las pistas de audio no tienen notas: van aparte,
 * como bloques (`bloquesDeAudio`).
 */
export function notasEnVentana(tracks: Track[], bpm: number, desde: number, hasta: number, instrumento: InstrumentoId): NotaEnTira[] {
  const pulso = 60 / bpm;
  const salida: NotaEnTira[] = [];
  for (const track of tracks) {
    const notas = track.notas;
    if (!notas || track.muted) continue;
    const { start, offset, duration, repeats } = track.clip;
    const tipo = notas.instrumento === instrumento ? 'propia' : 'otra';
    for (let r = 0; r < Math.max(1, repeats); r++) {
      const base = start + r * duration;
      if (base > hasta || base + duration < desde) continue;
      for (const g of notas.golpes) {
        const local = g.beat * pulso - offset;
        if (local < 0 || local >= duration) continue;
        const t = base + local;
        if (t < desde || t >= hasta) continue;
        salida.push({ t, dur: Math.max(0, g.dur) * pulso, nota: g.nota, tipo });
      }
    }
  }
  return salida;
}

/** Dónde hay audio grabado: un bloque por repetición del clip, recortado a la ventana. */
export function bloquesDeAudio(tracks: Track[], desde: number, hasta: number): { desde: number; hasta: number }[] {
  const salida: { desde: number; hasta: number }[] = [];
  for (const track of tracks) {
    if (track.notas || track.muted) continue;
    const { start, duration, repeats } = track.clip;
    for (let r = 0; r < Math.max(1, repeats); r++) {
      const a = Math.max(desde, start + r * duration);
      const b = Math.min(hasta, start + (r + 1) * duration);
      if (b > a) salida.push({ desde: a, hasta: b });
    }
  }
  return salida;
}
