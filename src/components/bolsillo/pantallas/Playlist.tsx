'use client';

import { useBolsillo } from '../contexto';
import { Cabecera, Vacio } from '../kit';

/** Una playlist. La monta el agente de Playlists y artistas (ola 1). */
export function PantallaPlaylist({ id }: { id: string }) {
  const { biblioteca, nav } = useBolsillo();
  const playlist = biblioteca.playlists.find((p) => p.id === id);
  return (
    <>
      <Cabecera titulo={playlist?.nombre ?? 'Playlist'} onAtras={nav.atras} />
      <Vacio texto="Aquí saldrán sus canciones." />
    </>
  );
}

/** Hacer una playlist (de tus canciones o con canciones nuevas). */
export function PantallaNuevaPlaylist() {
  const { nav } = useBolsillo();
  return (
    <>
      <Cabecera titulo="Nueva playlist" onAtras={nav.atras} />
      <Vacio texto="Pronto." />
    </>
  );
}
