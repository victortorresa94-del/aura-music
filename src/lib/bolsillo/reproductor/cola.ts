/**
 * La cola del reproductor, pura: qué suena después, qué antes y dónde estoy.
 *
 * Una cola es una lista de ids de canción y el sitio por el que va. Se arma al
 * tocar desde una lista (la biblioteca, un bloque del Inicio, una playlist) y
 * el reproductor la recorre. Las canciones que no se pueden tocar (aún se
 * están haciendo, o se borraron) se saltan: pararse en una que no suena es
 * dejar a alguien con la música cortada sin saber por qué.
 */

export interface Cola {
  ids: string[];
  /** El sitio de la que suena dentro de `ids`. */
  indice: number;
}

/** «Anterior» vuelve al principio de la canción si ya lleva más de esto sonando (como cualquier reproductor). */
export const UMBRAL_REINICIAR_SEG = 3;

/**
 * La cola al tocar una canción. Si viene de una lista que la contiene, la
 * lista entera con el sitio de esa canción; si no, la canción y detrás la
 * lista (o sola).
 */
export function armarCola(cancionId: string, lista?: readonly string[]): Cola {
  const ids = lista && lista.length ? [...lista] : [];
  const indice = ids.indexOf(cancionId);
  if (indice >= 0) return { ids, indice };
  return { ids: [cancionId, ...ids.filter((id) => id !== cancionId)], indice: 0 };
}

/** La siguiente que se puede tocar, o null si se acaba la cola. */
export function siguienteIndice(cola: Cola, esJugable: (id: string) => boolean): number | null {
  for (let i = cola.indice + 1; i < cola.ids.length; i++) {
    if (esJugable(cola.ids[i])) return i;
  }
  return null;
}

/** La anterior que se puede tocar, o null si es la primera. */
export function anteriorIndice(cola: Cola, esJugable: (id: string) => boolean): number | null {
  for (let i = Math.min(cola.indice, cola.ids.length) - 1; i >= 0; i--) {
    if (esJugable(cola.ids[i])) return i;
  }
  return null;
}

export type Anterior = { tipo: 'reiniciar' } | { tipo: 'ir'; indice: number };

/**
 * Qué hace «Anterior»: si la canción ya lleva un rato, volver a su principio;
 * si acaba de empezar, la de antes; si no hay de antes, al principio.
 */
export function decidirAnterior(posicionSeg: number, cola: Cola, esJugable: (id: string) => boolean): Anterior {
  if (posicionSeg > UMBRAL_REINICIAR_SEG) return { tipo: 'reiniciar' };
  const indice = anteriorIndice(cola, esJugable);
  return indice === null ? { tipo: 'reiniciar' } : { tipo: 'ir', indice };
}

export interface DondeEstoy {
  /** 1, 2, 3… (0 si la canción no está en la cola). */
  numero: number;
  total: number;
  hayAnterior: boolean;
  haySiguiente: boolean;
}

/** «3 de 8», y si hay algo antes o después que se pueda tocar. */
export function dondeEstoy(cola: Cola, esJugable: (id: string) => boolean = () => true): DondeEstoy {
  const dentro = cola.indice >= 0 && cola.indice < cola.ids.length;
  return {
    numero: dentro ? cola.indice + 1 : 0,
    total: cola.ids.length,
    hayAnterior: dentro && anteriorIndice(cola, esJugable) !== null,
    haySiguiente: dentro && siguienteIndice(cola, esJugable) !== null,
  };
}
