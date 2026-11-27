'use client';

import { useBolsillo } from '../contexto';
import { Cabecera, Vacio } from '../kit';

/** Un artista inventado con su ADN. Lo monta el agente de Playlists y artistas (ola 1). */
export function PantallaArtista({ id }: { id: string }) {
  const { biblioteca, nav } = useBolsillo();
  const artista = biblioteca.artistas.find((a) => a.id === id);
  return (
    <>
      <Cabecera titulo={artista?.nombre ?? 'Artista'} onAtras={nav.atras} />
      <Vacio texto="Aquí saldrán sus canciones y su ADN." />
    </>
  );
}

/** Crear un artista. */
export function PantallaNuevoArtista() {
  const { nav } = useBolsillo();
  return (
    <>
      <Cabecera titulo="Nuevo artista" onAtras={nav.atras} />
      <Vacio texto="Pronto." />
    </>
  );
}
