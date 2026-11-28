/**
 * Cambiar y combinar playlists (Víctor, 28-nov-2026: «que pueda añadir, crear
 * y modificar las playlists o combinarlas»). Puro: devuelve la playlist nueva
 * y quien llama la guarda.
 */

import { nuevoId, portadaGenerativa } from '../biblioteca';
import type { Playlist } from '../tipos';
import { nombreDePlaylist } from './playlist';

export function sinCancion(playlist: Playlist, cancionId: string, ahora = Date.now()): Playlist {
  const porques = { ...(playlist.porques ?? {}) };
  delete porques[cancionId];
  return { ...playlist, cancionIds: playlist.cancionIds.filter((id) => id !== cancionId), porques, actualizadaEn: ahora };
}

/** Mueve una canción un puesto arriba (-1) o abajo (+1). */
export function moverCancion(playlist: Playlist, cancionId: string, paso: -1 | 1, ahora = Date.now()): Playlist {
  const ids = [...playlist.cancionIds];
  const i = ids.indexOf(cancionId);
  const j = i + paso;
  if (i < 0 || j < 0 || j >= ids.length) return playlist;
  [ids[i], ids[j]] = [ids[j], ids[i]];
  return { ...playlist, cancionIds: ids, actualizadaEn: ahora };
}

/**
 * Una playlist nueva con las canciones de varias, sin repetir, alternando
 * entre ellas para que se mezclen (una de cada en orden) y con sus porqués.
 * Las de origen no se tocan.
 */
export function combinar(playlists: readonly Playlist[], nombre?: string, ahora = Date.now()): Playlist {
  const ids: string[] = [];
  const porques: Record<string, string> = {};
  const largo = Math.max(0, ...playlists.map((p) => p.cancionIds.length));
  for (let i = 0; i < largo; i++) {
    for (const p of playlists) {
      const id = p.cancionIds[i];
      if (!id || ids.includes(id)) continue;
      ids.push(id);
      const porque = p.porques?.[id];
      if (porque) porques[id] = porque;
    }
  }
  const id = nuevoId('pl', ahora);
  const titulo = nombreDePlaylist(nombre?.trim() || playlists.map((p) => p.nombre).join(' + '));
  return {
    id,
    nombre: titulo,
    porque: `Mezcla de ${playlists.map((p) => `«${p.nombre}»`).join(' y ')}.`,
    cancionIds: ids,
    porques,
    portada: portadaGenerativa(`${id}:${titulo}`),
    creadaEn: ahora,
    actualizadaEn: ahora,
  };
}
