/**
 * Cuadrar sin destruir: qué se guarda en la pista y cómo se cambia de una
 * versión a otra. La toma tal como se tocó nunca se borra; la cuadrada es
 * otro audio, y la pista recuerda los dos. Así se puede oír antes y después,
 * deshacer con el Deshacer de siempre o «dejarla como la toqué» cuando sea.
 */

import type { Project, Track } from '../types';
import type { AjustesCuadreToma } from './cuadrar';

/** Un trozo de audio guardado: qué buffer y qué parte suena. */
export interface RegionDeAudio {
  bufferId: string;
  offset: number;
  duration: number;
  /** Duración del buffer entero, para limitar el recorte. */
  sourceDuration: number;
}

export interface CuadreDeToma {
  /** La toma como se tocó. No se borra nunca. */
  original: RegionDeAudio;
  /** La cuadrada: un audio nuevo con la región que sonaba, ya en la rejilla. */
  cuadrado: RegionDeAudio;
  ajustes: AjustesCuadreToma;
  /** Cuál suena ahora. */
  escuchando: 'original' | 'cuadrado';
  /** Lo que se le cuenta al músico: cuántos golpes y cuánto se acercaron. */
  movidos: number;
  golpes: number;
  antesMs: number;
  despuesMs: number;
}

/** Lo que hay que cuadrar: siempre la original, aunque ya esté cuadrada (no se cuadra lo cuadrado). */
export function regionOriginal(track: Track): RegionDeAudio {
  if (track.cuadre) return track.cuadre.original;
  return {
    bufferId: track.clip.bufferId,
    offset: track.clip.offset,
    duration: track.clip.duration,
    sourceDuration: track.sourceDuration,
  };
}

function conRegion(track: Track, region: RegionDeAudio): Track {
  // Donde empieza y cuántas veces se repite no cambia: solo qué audio suena.
  return {
    ...track,
    clip: { ...track.clip, bufferId: region.bufferId, offset: region.offset, duration: region.duration },
    sourceDuration: region.sourceDuration,
  };
}

const enPista = (project: Project, trackId: string, cambio: (t: Track) => Track): Project => ({
  ...project,
  tracks: project.tracks.map((t) => (t.id === trackId ? cambio(t) : t)),
});

/** Pone la toma cuadrada a sonar y guarda las dos versiones. */
export function conCuadre(project: Project, trackId: string, cuadre: CuadreDeToma): Project {
  return enPista(project, trackId, (t) => ({ ...conRegion(t, cuadre.cuadrado), cuadre: { ...cuadre, escuchando: 'cuadrado' } }));
}

/** Antes o después, sin perder ninguna. */
export function escucharVersion(project: Project, trackId: string, cual: CuadreDeToma['escuchando']): Project {
  return enPista(project, trackId, (t) => {
    if (!t.cuadre) return t;
    return { ...conRegion(t, t.cuadre[cual]), cuadre: { ...t.cuadre, escuchando: cual } };
  });
}

/** «Dejar como lo toqué»: vuelve la original y se olvida el cuadre. */
export function sinCuadre(project: Project, trackId: string): Project {
  return enPista(project, trackId, (t) => {
    if (!t.cuadre) return t;
    const { cuadre, ...resto } = t;
    return conRegion(resto, cuadre.original);
  });
}

/** Todos los audios que necesita una pista (para no borrar la original al recoger basura). */
export function audiosDePista(track: Track): string[] {
  const ids = new Set([track.clip.bufferId]);
  if (track.cuadre) {
    ids.add(track.cuadre.original.bufferId);
    ids.add(track.cuadre.cuadrado.bufferId);
  }
  return [...ids];
}
