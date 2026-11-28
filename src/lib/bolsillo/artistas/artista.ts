/**
 * Crear, editar y borrar un artista, sin perder nada por el camino.
 *
 * Guardar un artista es gratis: es una ficha. Lo que cuesta son sus
 * canciones, y eso se paga en Crear (o en «Tu semana con…», con su tope).
 */

import type { Almacen } from '../almacen';
import { nuevoId, portadaGenerativa } from '../biblioteca';
import type { AdnArtista, Artista } from '../tipos';
import { normalizarAdn } from './adn';

export function nuevoArtista(nombre: string, adn: AdnArtista, datos: { ahora?: number; id?: string } = {}): Artista {
  const ahora = datos.ahora ?? Date.now();
  const id = datos.id ?? nuevoId('art', ahora);
  const n = nombre.replace(/\s+/g, ' ').trim();
  return {
    id,
    nombre: n,
    adn: normalizarAdn(adn),
    portada: portadaGenerativa(`${id}:${n}`),
    creadoEn: ahora,
    actualizadoEn: ahora,
  };
}

/** El mismo artista con otro nombre o ADN. La portada no cambia: es su cara. */
export function artistaEditado(artista: Artista, nombre: string, adn: AdnArtista, ahora = Date.now()): Artista {
  return {
    ...artista,
    nombre: nombre.replace(/\s+/g, ' ').trim(),
    adn: normalizarAdn(adn),
    actualizadoEn: ahora,
  };
}

/**
 * Borra un artista sin llevarse nada que suene: sus canciones se quedan (sin
 * artista) y las playlists que se renovaban con él se apagan, para que no
 * sigan gastando en alguien que ya no existe.
 */
export async function borrarArtistaSinPerder(almacen: Almacen, artistaId: string, ahora = Date.now()): Promise<void> {
  for (const c of await almacen.canciones.todos()) {
    if (c.artistaId !== artistaId) continue;
    const { artistaId: _fuera, ...resto } = c;
    await almacen.canciones.poner({ ...resto, actualizadaEn: ahora });
  }
  for (const p of await almacen.playlists.todos()) {
    if (p.viva?.receta.artistaId !== artistaId) continue;
    const { viva: _fuera, ...resto } = p;
    await almacen.playlists.poner({ ...resto, actualizadaEn: ahora });
  }
  await almacen.artistas.borrar(artistaId);
}
