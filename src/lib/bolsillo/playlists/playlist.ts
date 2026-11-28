/**
 * Las reglas de una playlist, puras: crearla, añadirle canciones, renombrarla
 * y borrarla sin perder ninguna canción.
 *
 * Una playlist de tus canciones es gratis. Una canción que solo vive en una
 * playlist es un borrador protegido (no se limpia a los 30 días: lo dice
 * `borradoresCaducados`), así que borrar la playlist no puede dejarla a la
 * intemperie: se queda en tu biblioteca. Perder una canción que te gusta es
 * lo único que no se perdona.
 */

import type { Almacen } from '../almacen';
import { nuevoId, portadaGenerativa, quedarme, versionQueSuena } from '../biblioteca';
import type { Cancion, Playlist } from '../tipos';

export const MAX_NOMBRE_PLAYLIST = 60;

export function nombreDePlaylist(nombre: string): string {
  const n = nombre.replace(/\s+/g, ' ').trim().slice(0, MAX_NOMBRE_PLAYLIST);
  return n || 'Mi playlist';
}

export function nuevaPlaylist(
  datos: { nombre: string; porque?: string; cancionIds?: string[]; porques?: Record<string, string> },
  opciones: { ahora?: number; id?: string } = {},
): Playlist {
  const ahora = opciones.ahora ?? Date.now();
  const id = opciones.id ?? nuevoId('pl', ahora);
  const nombre = nombreDePlaylist(datos.nombre);
  const porque = datos.porque?.trim();
  return {
    id,
    nombre,
    ...(porque ? { porque } : {}),
    cancionIds: [...new Set(datos.cancionIds ?? [])],
    porques: { ...(datos.porques ?? {}) },
    portada: portadaGenerativa(`${id}:${nombre}`),
    creadaEn: ahora,
    actualizadaEn: ahora,
  };
}

/**
 * La playlist con estas canciones añadidas (sin repetir ninguna), al final o
 * al principio, cada una con su porqué si lo trae.
 */
export function conCanciones(
  playlist: Playlist,
  ids: readonly string[],
  opciones: { porques?: Record<string, string>; posicion?: 'final' | 'principio'; ahora?: number } = {},
): Playlist {
  const nuevas = [...new Set(ids)].filter((id) => !playlist.cancionIds.includes(id));
  const porques = { ...(playlist.porques ?? {}) };
  for (const [id, porque] of Object.entries(opciones.porques ?? {})) {
    if (porque && (nuevas.includes(id) || playlist.cancionIds.includes(id))) porques[id] = porque;
  }
  const cancionIds =
    opciones.posicion === 'principio' ? [...nuevas, ...playlist.cancionIds] : [...playlist.cancionIds, ...nuevas];
  return { ...playlist, cancionIds, porques, actualizadaEn: opciones.ahora ?? Date.now() };
}

export function renombrada(playlist: Playlist, nombre: string, ahora = Date.now()): Playlist {
  return { ...playlist, nombre: nombreDePlaylist(nombre), actualizadaEn: ahora };
}

/** La playlist sin renovarse sola: apagarla no borra nada, solo deja de gastar. */
export function sinViva(playlist: Playlist, ahora = Date.now()): Playlist {
  const { viva: _fuera, ...resto } = playlist;
  return { ...resto, actualizadaEn: ahora };
}

/**
 * Las canciones que son tuyas para meter en una playlist: las que te has
 * quedado y las que ya están en alguna playlist. Lo último tocado, primero.
 */
export function cancionesTuyas(canciones: readonly Cancion[], playlists: readonly Playlist[]): Cancion[] {
  const enAlguna = new Set(playlists.flatMap((p) => p.cancionIds));
  return canciones
    .filter((c) => c.guardada || enAlguna.has(c.id))
    .sort((a, b) => (b.ultimaEscucha ?? b.actualizadaEn) - (a.ultimaEscucha ?? a.actualizadaEn));
}

/**
 * Borra una playlist sin perder canciones: las que no te habías quedado y no
 * están en ninguna otra playlist pasan a tu biblioteca con la versión que
 * suena (sin esto, a los 30 días se limpiarían solas).
 */
export async function borrarPlaylistSinPerder(almacen: Almacen, playlistId: string, ahora = Date.now()): Promise<number> {
  const playlist = await almacen.playlists.leer(playlistId);
  if (!playlist) return 0;
  const otras = (await almacen.playlists.todos()).filter((p) => p.id !== playlistId);
  const enOtras = new Set(otras.flatMap((p) => p.cancionIds));
  const versiones = await almacen.versiones.todos();
  let rescatadas = 0;
  for (const id of playlist.cancionIds) {
    if (enOtras.has(id)) continue;
    const cancion = await almacen.canciones.leer(id);
    if (!cancion || cancion.guardada) continue;
    const suena = versionQueSuena(cancion, versiones);
    if (!suena) continue;
    await almacen.canciones.poner(quedarme(cancion, suena.id, ahora));
    rescatadas++;
  }
  await almacen.playlists.borrar(playlistId);
  return rescatadas;
}
