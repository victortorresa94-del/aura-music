'use client';

import { Cabecera, Vacio } from '../kit';

/** Biblioteca. La monta el agente de Escuchar (ola 1): Canciones · Playlists · Artistas · Paisajes. */
export function PantallaBiblioteca() {
  return (
    <>
      <Cabecera titulo="Biblioteca" />
      <Vacio texto="Lo que te quedas sale aquí." />
    </>
  );
}
