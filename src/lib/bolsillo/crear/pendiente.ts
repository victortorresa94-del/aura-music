/**
 * Abrir Crear con algo ya pedido: desde un artista («Una nueva de Lola
 * Niebla»), desde una playlist o desde un paisaje. Quien lo pide llama a
 * `pedirCrear` y luego a `nav.pestana('crear')`; la pantalla de Crear lo
 * recoge UNA vez al montarse con `tomarPeticion`.
 *
 * CONTRATO: lo usa el agente de Crear (lo lee) y los de Playlists y artistas
 * y Paisajes (lo escriben).
 */

import type { TipoPieza } from '../tipos';

export interface PeticionCrear {
  artistaId?: string;
  tipo?: TipoPieza;
  frase?: string;
  /** Para añadir lo que salga a esta playlist. */
  playlistId?: string;
}

let pendiente: PeticionCrear | null = null;

export function pedirCrear(peticion: PeticionCrear): void {
  pendiente = peticion;
}

/** La devuelve una sola vez: una segunda visita a Crear empieza de cero. */
export function tomarPeticion(): PeticionCrear | null {
  const p = pendiente;
  pendiente = null;
  return p;
}
