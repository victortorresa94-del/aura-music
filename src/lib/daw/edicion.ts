/**
 * Edición de clips como funciones puras: cortar en el cursor, pegar,
 * duplicar y elegir la pista de al lado. Las usan los atajos de teclado y
 * los menús, y pasan por el historial de siempre (todo se deshace igual).
 *
 * En este estudio una pista es un clip (ver `types.ts`). Así que cortar un
 * clip en dos deja la segunda mitad en una pista nueva, justo debajo y con
 * la misma mezcla; y pegar crea una pista nueva con el clip en el cursor.
 * Es lo mismo que pasa al grabar: cada toma cae en su propia pista.
 */

import { newId, trackEnd, type Clip, type Project, type Track } from './types';

/** Lo más corto que puede quedar un trozo al cortar o recortar. */
export const TROZO_MINIMO = 0.05;

export interface Corte {
  proyecto: Project;
  /** La pista nueva con la segunda mitad. */
  nuevaId: string;
  /** Si había repeticiones, el corte se va a la frontera entre vueltas más cercana. */
  ajustadoAVuelta: boolean;
}

/**
 * Corta la pista en el instante `t` (segundos de la línea de tiempo).
 * Devuelve null si `t` no cae dentro del clip con margen para dos trozos.
 *
 * Con repeticiones, un corte a media vuelta dejaría un trozo que no cabe en
 * un clip (media vuelta más varias enteras), así que se corta en la frontera
 * entre vueltas más cercana.
 */
export function cortarPista(project: Project, trackId: string, t: number, ahora = Date.now()): Corte | null {
  const index = project.tracks.findIndex((track) => track.id === trackId);
  if (index < 0) return null;
  const track = project.tracks[index];
  const { clip } = track;
  const local = t - clip.start;
  const total = clip.duration * clip.repeats;
  if (local < TROZO_MINIMO || local > total - TROZO_MINIMO) return null;

  let izquierda: Clip;
  let derecha: Clip;
  let ajustadoAVuelta = false;

  if (clip.repeats > 1) {
    const vuelta = Math.round(local / clip.duration);
    if (vuelta <= 0 || vuelta >= clip.repeats) return null;
    ajustadoAVuelta = Math.abs(vuelta * clip.duration - local) > 1e-6;
    izquierda = { ...clip, repeats: vuelta };
    derecha = { ...clip, start: clip.start + vuelta * clip.duration, repeats: clip.repeats - vuelta };
  } else {
    izquierda = { ...clip, duration: local };
    derecha = { ...clip, start: t, offset: clip.offset + local, duration: clip.duration - local };
  }

  const nueva: Track = {
    ...track,
    id: newId('trk'),
    name: nombreDeTrozo(track.name, project.tracks),
    clip: derecha,
    soloed: false,
    createdAt: ahora,
  };
  const tracks = [...project.tracks];
  tracks.splice(index, 1, { ...track, clip: izquierda }, nueva);
  return { proyecto: { ...project, tracks }, nuevaId: nueva.id, ajustadoAVuelta };
}

/** «Voz» → «Voz (2)», «Voz (2)» → «Voz (3)», sin repetir un nombre que ya existe. */
export function nombreDeTrozo(nombre: string, pistas: Track[]): string {
  const base = nombre.replace(/\s*\(\d+\)$/, '');
  const usados = new Set(pistas.map((track) => track.name));
  for (let n = 2; n < 1000; n++) {
    const candidato = `${base} (${n})`;
    if (!usados.has(candidato)) return candidato;
  }
  return `${base} (copia)`;
}

/**
 * Pega una pista copiada como pista nueva, con el clip empezando en `t`.
 * Va justo debajo de `despuesDe` (la elegida) o al final si no hay.
 */
export function pegarPista(
  project: Project,
  copiada: Track,
  t: number,
  despuesDe: string | null,
  ahora = Date.now(),
): { proyecto: Project; nuevaId: string } {
  const nueva: Track = {
    ...copiada,
    id: newId('trk'),
    name: nombreDeTrozo(copiada.name, project.tracks),
    clip: { ...copiada.clip, start: Math.max(0, t) },
    soloed: false,
    createdAt: ahora,
  };
  const index = despuesDe ? project.tracks.findIndex((track) => track.id === despuesDe) : -1;
  const tracks = [...project.tracks];
  if (index >= 0) tracks.splice(index + 1, 0, nueva);
  else tracks.push(nueva);
  return { proyecto: { ...project, tracks }, nuevaId: nueva.id };
}

/** La pista de arriba (−1) o la de abajo (+1). Sin elegida, la primera o la última. */
export function pistaVecina(project: Project, elegida: string | null, direccion: -1 | 1): string | null {
  const { tracks } = project;
  if (tracks.length === 0) return null;
  const index = elegida ? tracks.findIndex((track) => track.id === elegida) : -1;
  if (index < 0) return direccion > 0 ? tracks[0].id : tracks[tracks.length - 1].id;
  const siguiente = Math.min(tracks.length - 1, Math.max(0, index + direccion));
  return tracks[siguiente].id;
}

/** Después de borrar una pista, la que queda en su sitio (o la de arriba si era la última). */
export function pistaTrasBorrar(project: Project, borrada: string): string | null {
  const index = project.tracks.findIndex((track) => track.id === borrada);
  if (index < 0) return null;
  const resto = project.tracks.filter((track) => track.id !== borrada);
  if (resto.length === 0) return null;
  return resto[Math.min(index, resto.length - 1)].id;
}

/**
 * El imán a la rejilla: si `valor` cae cerca de un pulso, se pega a él.
 * «Cerca» es un cuarto de pulso, para no arrancar una toma que empieza a
 * propósito un poco antes (una anacrusa, una respiración).
 */
export function alPulso(valor: number, pulso: number, activo: boolean): number {
  if (!activo || pulso <= 0) return valor;
  const cercano = Math.round(valor / pulso) * pulso;
  return Math.abs(cercano - valor) < pulso * 0.25 ? cercano : valor;
}

/** El compás de al lado (para las flechas izquierda y derecha). */
export function compasVecino(posicion: number, segundosPorCompas: number, direccion: -1 | 1): number {
  if (segundosPorCompas <= 0) return posicion;
  const actual = posicion / segundosPorCompas;
  const destino = direccion > 0 ? Math.floor(actual + 1e-6) + 1 : Math.ceil(actual - 1e-6) - 1;
  return Math.max(0, destino * segundosPorCompas);
}

/** Dónde acaba lo último que suena (para la tecla Fin). */
export function finDelProyecto(project: Project): number {
  return project.tracks.reduce((max, track) => Math.max(max, trackEnd(track)), 0);
}
