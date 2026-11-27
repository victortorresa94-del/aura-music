/**
 * El almacén de bolsillo: canciones, versiones, artistas, playlists y audios.
 *
 * Local primero, como las ideas del estudio (decisión 0023): IndexedDB manda
 * en el móvil y nada de escuchar espera a la red. Base aparte de la del
 * estudio (`compas`), para no tocar su versión ni sus migraciones.
 *
 * Dos implementaciones con el mismo contrato: la de IndexedDB (el navegador)
 * y la de memoria (los tests y el servidor). Todo cambio avisa a quien esté
 * suscrito, así la biblioteca se repinta sola al llegar una versión nueva.
 */

import type { Artista, Cancion, Playlist, Version } from './tipos';

export interface Coleccion<T extends { id: string }> {
  todos(): Promise<T[]>;
  leer(id: string): Promise<T | null>;
  poner(valor: T): Promise<void>;
  borrar(id: string): Promise<void>;
}

export interface Audios {
  poner(id: string, audio: Blob): Promise<void>;
  leer(id: string): Promise<Blob | null>;
  borrar(id: string): Promise<void>;
}

export type NombreColeccion = 'canciones' | 'versiones' | 'artistas' | 'playlists' | 'audios';

export interface Cambio {
  coleccion: NombreColeccion;
  id: string;
  borrado: boolean;
}

export interface Almacen {
  canciones: Coleccion<Cancion>;
  versiones: Coleccion<Version>;
  artistas: Coleccion<Artista>;
  playlists: Coleccion<Playlist>;
  audios: Audios;
  suscribir(alCambiar: (cambio: Cambio) => void): () => void;
}

type Oyente = (cambio: Cambio) => void;

function avisador() {
  const oyentes = new Set<Oyente>();
  return {
    suscribir(oyente: Oyente) {
      oyentes.add(oyente);
      return () => {
        oyentes.delete(oyente);
      };
    },
    avisar(cambio: Cambio) {
      for (const oyente of oyentes) {
        try {
          oyente(cambio);
        } catch {
          /* un oyente roto no tumba a los demás */
        }
      }
    },
  };
}

/* ── En memoria: tests y servidor ─────────────────────────────────────── */

export function almacenEnMemoria(): Almacen {
  const { suscribir, avisar } = avisador();

  function coleccion<T extends { id: string }>(nombre: NombreColeccion): Coleccion<T> {
    const datos = new Map<string, T>();
    return {
      async todos() {
        return [...datos.values()].map((v) => structuredClone(v));
      },
      async leer(id) {
        const v = datos.get(id);
        return v ? structuredClone(v) : null;
      },
      async poner(valor) {
        datos.set(valor.id, structuredClone(valor));
        avisar({ coleccion: nombre, id: valor.id, borrado: false });
      },
      async borrar(id) {
        datos.delete(id);
        avisar({ coleccion: nombre, id, borrado: true });
      },
    };
  }

  const audios = new Map<string, Blob>();
  return {
    canciones: coleccion<Cancion>('canciones'),
    versiones: coleccion<Version>('versiones'),
    artistas: coleccion<Artista>('artistas'),
    playlists: coleccion<Playlist>('playlists'),
    audios: {
      async poner(id, audio) {
        audios.set(id, audio);
        avisar({ coleccion: 'audios', id, borrado: false });
      },
      async leer(id) {
        return audios.get(id) ?? null;
      },
      async borrar(id) {
        audios.delete(id);
        avisar({ coleccion: 'audios', id, borrado: true });
      },
    },
    suscribir,
  };
}

/* ── IndexedDB: el navegador ──────────────────────────────────────────── */

const DB_NOMBRE = 'aura-music-bolsillo';
const DB_VERSION = 1;
const STORES: NombreColeccion[] = ['canciones', 'versiones', 'artistas', 'playlists', 'audios'];

function abrir(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const peticion = indexedDB.open(DB_NOMBRE, DB_VERSION);
    peticion.onupgradeneeded = () => {
      const db = peticion.result;
      for (const store of STORES) {
        if (!db.objectStoreNames.contains(store)) db.createObjectStore(store, { keyPath: 'id' });
      }
    };
    peticion.onsuccess = () => resolve(peticion.result);
    peticion.onerror = () => reject(peticion.error ?? new Error('No se ha podido abrir el almacén del móvil.'));
    peticion.onblocked = () => reject(new Error('El almacén está abierto en otra pestaña con otra versión. Cierra las demás.'));
  });
}

function hecho<T>(peticion: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    peticion.onsuccess = () => resolve(peticion.result);
    peticion.onerror = () => reject(peticion.error ?? new Error('El almacén del móvil ha fallado.'));
  });
}

function terminada(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('No se ha guardado en el móvil.'));
    tx.onabort = () => reject(tx.error ?? new Error('No se ha guardado en el móvil (sin espacio o cancelado).'));
  });
}

export function almacenIndexedDB(): Almacen {
  const { suscribir, avisar } = avisador();
  let db: Promise<IDBDatabase> | null = null;
  const base = () => {
    if (!db) {
      db = abrir().catch((error: unknown) => {
        db = null;
        throw error;
      });
    }
    return db;
  };

  function coleccion<T extends { id: string }>(nombre: Exclude<NombreColeccion, 'audios'>): Coleccion<T> {
    return {
      async todos() {
        const tx = (await base()).transaction(nombre, 'readonly');
        return (await hecho(tx.objectStore(nombre).getAll())) as T[];
      },
      async leer(id) {
        const tx = (await base()).transaction(nombre, 'readonly');
        return ((await hecho(tx.objectStore(nombre).get(id))) as T | undefined) ?? null;
      },
      async poner(valor) {
        const tx = (await base()).transaction(nombre, 'readwrite');
        tx.objectStore(nombre).put(valor);
        await terminada(tx);
        avisar({ coleccion: nombre, id: valor.id, borrado: false });
      },
      async borrar(id) {
        const tx = (await base()).transaction(nombre, 'readwrite');
        tx.objectStore(nombre).delete(id);
        await terminada(tx);
        avisar({ coleccion: nombre, id, borrado: true });
      },
    };
  }

  return {
    canciones: coleccion<Cancion>('canciones'),
    versiones: coleccion<Version>('versiones'),
    artistas: coleccion<Artista>('artistas'),
    playlists: coleccion<Playlist>('playlists'),
    audios: {
      async poner(id, audio) {
        // El Blob se guarda tal cual: IndexedDB lo admite y no hay que pasarlo a PCM.
        const tx = (await base()).transaction('audios', 'readwrite');
        tx.objectStore('audios').put({ id, audio, tipo: audio.type, guardadoEn: Date.now() });
        await terminada(tx);
        avisar({ coleccion: 'audios', id, borrado: false });
      },
      async leer(id) {
        const tx = (await base()).transaction('audios', 'readonly');
        const registro = (await hecho(tx.objectStore('audios').get(id))) as { audio?: Blob } | undefined;
        return registro?.audio ?? null;
      },
      async borrar(id) {
        const tx = (await base()).transaction('audios', 'readwrite');
        tx.objectStore('audios').delete(id);
        await terminada(tx);
        avisar({ coleccion: 'audios', id, borrado: true });
      },
    },
    suscribir,
  };
}

/* ── El de esta página ────────────────────────────────────────────────── */

let unico: Almacen | null = null;

/** El almacén de esta página: IndexedDB en el navegador, memoria fuera de él. */
export function almacen(): Almacen {
  if (!unico) unico = typeof indexedDB === 'undefined' ? almacenEnMemoria() : almacenIndexedDB();
  return unico;
}

/** Solo para tests: empezar de cero con el almacén que se quiera. */
export function ponerAlmacenParaPruebas(otro: Almacen | null) {
  unico = otro;
}
