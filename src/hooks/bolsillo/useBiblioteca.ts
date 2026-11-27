'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { almacen } from '@/lib/bolsillo/almacen';
import { borrarCancionEntera, conEscucha, quedarme, versionQueSuena, versionesDe } from '@/lib/bolsillo/biblioteca';
import type { Artista, Cancion, Playlist, Version } from '@/lib/bolsillo/tipos';

export interface Biblioteca {
  cargando: boolean;
  /** Todas, borradores incluidos. Las de la biblioteca son las `guardada`. */
  canciones: Cancion[];
  versiones: Version[];
  artistas: Artista[];
  playlists: Playlist[];
  cancion(id: string): Cancion | undefined;
  versionesDe(cancionId: string): Version[];
  versionQueSuena(cancion: Cancion): Version | null;
  guardarCancion(c: Cancion): Promise<void>;
  guardarVersion(v: Version): Promise<void>;
  guardarArtista(a: Artista): Promise<void>;
  guardarPlaylist(p: Playlist): Promise<void>;
  borrarCancion(id: string): Promise<void>;
  borrarArtista(id: string): Promise<void>;
  borrarPlaylist(id: string): Promise<void>;
  /** «Me la quedo». */
  quedarme(cancionId: string, versionId: string): Promise<void>;
  registrarEscucha(cancionId: string): Promise<void>;
  /** Una URL que se puede tocar: el audio del móvil y, si no está, el de la nube. */
  urlDeAudio(version: Version): Promise<string | null>;
}

/**
 * La biblioteca entera, viva: se repinta sola cuando cualquier parte de la
 * app (crear, paisajes, importar) escribe en el almacén.
 */
export function useBiblioteca(): Biblioteca {
  const [cargando, setCargando] = useState(true);
  const [canciones, setCanciones] = useState<Cancion[]>([]);
  const [versiones, setVersiones] = useState<Version[]>([]);
  const [artistas, setArtistas] = useState<Artista[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);

  useEffect(() => {
    const a = almacen();
    let vivo = true;
    let pendiente: ReturnType<typeof setTimeout> | null = null;
    const recargar = async () => {
      try {
        const [c, v, ar, p] = await Promise.all([
          a.canciones.todos(),
          a.versiones.todos(),
          a.artistas.todos(),
          a.playlists.todos(),
        ]);
        if (!vivo) return;
        setCanciones(c);
        setVersiones(v);
        setArtistas(ar);
        setPlaylists(p);
      } finally {
        if (vivo) setCargando(false);
      }
    };
    void recargar();
    // Varias escrituras seguidas (una versión y su canción) son una sola recarga.
    const quitar = a.suscribir((cambio) => {
      if (cambio.coleccion === 'audios') return;
      if (pendiente) clearTimeout(pendiente);
      pendiente = setTimeout(() => void recargar(), 30);
    });
    return () => {
      vivo = false;
      if (pendiente) clearTimeout(pendiente);
      quitar();
    };
  }, []);

  const porId = useMemo(() => new Map(canciones.map((c) => [c.id, c])), [canciones]);

  const urlsCreadas = useMemo(() => new Map<string, string>(), []);
  useEffect(
    () => () => {
      for (const url of urlsCreadas.values()) URL.revokeObjectURL(url);
    },
    [urlsCreadas],
  );

  const urlDeAudio = useCallback(
    async (version: Version) => {
      if (version.audioId) {
        const ya = urlsCreadas.get(version.audioId);
        if (ya) return ya;
        const blob = await almacen().audios.leer(version.audioId);
        if (blob) {
          const url = URL.createObjectURL(blob);
          urlsCreadas.set(version.audioId, url);
          return url;
        }
      }
      return version.urlRemota ?? null;
    },
    [urlsCreadas],
  );

  return {
    cargando,
    canciones,
    versiones,
    artistas,
    playlists,
    cancion: (id) => porId.get(id),
    versionesDe: (cancionId) => versionesDe(cancionId, versiones),
    versionQueSuena: (cancion) => versionQueSuena(cancion, versiones),
    guardarCancion: (c) => almacen().canciones.poner(c),
    guardarVersion: (v) => almacen().versiones.poner(v),
    guardarArtista: (ar) => almacen().artistas.poner(ar),
    guardarPlaylist: (p) => almacen().playlists.poner(p),
    borrarCancion: (id) => borrarCancionEntera(almacen(), id),
    borrarArtista: (id) => almacen().artistas.borrar(id),
    borrarPlaylist: (id) => almacen().playlists.borrar(id),
    async quedarme(cancionId, versionId) {
      const c = await almacen().canciones.leer(cancionId);
      if (c) await almacen().canciones.poner(quedarme(c, versionId));
    },
    async registrarEscucha(cancionId) {
      const c = await almacen().canciones.leer(cancionId);
      if (c) await almacen().canciones.poner(conEscucha(c));
    },
    urlDeAudio,
  };
}
