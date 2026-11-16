/**
 * Persistencia local. Todo se queda en el móvil: nada sube a ningún servidor.
 * El audio se guarda como PCM de 16 bits (la mitad de espacio que en coma
 * flotante y sin diferencia audible en una maqueta).
 */

import { floatToInt16, int16ToFloat } from './audio';
import { DEFAULT_SETTINGS, isIOS, type Project, type StudioSettings } from './types';

const DB_NAME = 'compas';
const DB_VERSION = 1;
const PROJECTS = 'projects';
const AUDIO = 'audio';
const SETTINGS_KEY = 'compas:settings';
const LAST_PROJECT_KEY = 'compas:last-project';

interface AudioRecord {
  id: string;
  sampleRate: number;
  /** Muestras por canal. */
  length: number;
  /** Ausente en grabaciones antiguas: entonces es mono. */
  channels?: number;
  data: ArrayBuffer;
}

let dbPromise: Promise<IDBDatabase> | null = null;
let persistenciaPedida = false;

/**
 * Pedirle al navegador que NO borre esto cuando le haga falta sitio.
 *
 * Sin esto, la política ITP de WebKit se lleva por delante todo el
 * almacenamiento escribible por script tras **siete días** sin abrir la web en
 * Safari. O sea que el escenario "vuelvo a aquella idea dentro de tres
 * semanas" —que es justo para lo que sirve esta app— era también el escenario
 * en el que las ideas ya no estaban. Las apps instaladas en la pantalla de
 * inicio están exentas, y por eso instalar deja de ser una comodidad y pasa a
 * ser la forma de no perder nada.
 *
 * Se pide después de la primera grabación, no al abrir: el navegador concede
 * con más facilidad cuando ya hay algo que valga la pena conservar.
 */
export async function pedirPersistencia(): Promise<boolean> {
  if (persistenciaPedida) return true;
  persistenciaPedida = true;
  try {
    if (!navigator.storage?.persist) return false;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(PROJECTS)) db.createObjectStore(PROJECTS, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(AUDIO)) db.createObjectStore(AUDIO, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

function tx<T>(store: string, mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(store, mode);
        const request = run(transaction.objectStore(store));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      }),
  );
}

/* -------------------------------------------------------------------------- */
/* Proyectos                                                                   */
/* -------------------------------------------------------------------------- */

export async function saveProject(project: Project): Promise<void> {
  await tx(PROJECTS, 'readwrite', (store) => store.put(project) as IDBRequest<IDBValidKey>);
}

export async function loadProject(id: string): Promise<Project | null> {
  const result = await tx<Project | undefined>(PROJECTS, 'readonly', (store) => store.get(id));
  return result ?? null;
}

export async function listProjects(): Promise<Project[]> {
  const result = await tx<Project[]>(PROJECTS, 'readonly', (store) => store.getAll());
  return (result ?? []).sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function deleteProject(project: Project): Promise<void> {
  for (const track of project.tracks) {
    await deleteAudio(track.clip.bufferId);
  }
  await tx(PROJECTS, 'readwrite', (store) => store.delete(project.id) as IDBRequest<undefined>);
}

/* -------------------------------------------------------------------------- */
/* Audio                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Guarda uno o dos canales. Los canales van seguidos, no entrelazados: así
 * reconstruirlos es un subarray y no hay que recorrer nada.
 */
export async function putAudio(
  id: string,
  channels: Float32Array[],
  sampleRate: number,
): Promise<void> {
  const count = Math.max(1, channels.length);
  const frames = channels[0]?.length ?? 0;
  const pcm = new Int16Array(frames * count);
  for (let c = 0; c < count; c++) {
    pcm.set(floatToInt16(channels[c]), c * frames);
  }
  const record: AudioRecord = {
    id,
    sampleRate,
    length: frames,
    channels: count,
    data: pcm.buffer as ArrayBuffer,
  };
  await tx(AUDIO, 'readwrite', (store) => store.put(record) as IDBRequest<IDBValidKey>);
}

export async function getAudio(
  id: string,
): Promise<{ channels: Float32Array[]; sampleRate: number } | null> {
  const record = await tx<AudioRecord | undefined>(AUDIO, 'readonly', (store) => store.get(id));
  if (!record) return null;
  const pcm = new Int16Array(record.data);
  const count = record.channels ?? 1;
  const frames = record.length || Math.floor(pcm.length / count);
  const channels: Float32Array[] = [];
  for (let c = 0; c < count; c++) {
    channels.push(int16ToFloat(pcm.subarray(c * frames, (c + 1) * frames)));
  }
  return { channels, sampleRate: record.sampleRate };
}

export async function deleteAudio(id: string): Promise<void> {
  await tx(AUDIO, 'readwrite', (store) => store.delete(id) as IDBRequest<undefined>);
}

/** Espacio ocupado, en bytes (aproximado, solo el audio). */
export async function estimateAudioBytes(): Promise<number> {
  const records = await tx<AudioRecord[]>(AUDIO, 'readonly', (store) => store.getAll());
  return (records ?? []).reduce((total, record) => total + record.data.byteLength, 0);
}

/** Borra audio que ya no referencia ningún proyecto. */
export async function collectGarbage(): Promise<number> {
  const projects = await listProjects();
  const alive = new Set<string>();
  projects.forEach((project) =>
    project.tracks.forEach((track) => alive.add(track.clip.bufferId)),
  );
  const records = await tx<AudioRecord[]>(AUDIO, 'readonly', (store) => store.getAll());
  let removed = 0;
  for (const record of records ?? []) {
    if (!alive.has(record.id)) {
      await deleteAudio(record.id);
      removed++;
    }
  }
  return removed;
}

/* -------------------------------------------------------------------------- */
/* Ajustes                                                                     */
/* -------------------------------------------------------------------------- */

export function loadSettings(): StudioSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  // En iPhone conviene soltar el micro al parar; en el resto no hace falta.
  const base: StudioSettings = { ...DEFAULT_SETTINGS, releaseMicOnStop: isIOS() };
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return base;
    return { ...base, ...(JSON.parse(raw) as Partial<StudioSettings>) };
  } catch {
    return base;
  }
}

export function saveSettings(settings: StudioSettings): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    /* almacenamiento lleno o bloqueado */
  }
}

export function rememberLastProject(id: string): void {
  try {
    window.localStorage.setItem(LAST_PROJECT_KEY, id);
  } catch {
    /* ignorado */
  }
}

export function recallLastProject(): string | null {
  try {
    return window.localStorage.getItem(LAST_PROJECT_KEY);
  } catch {
    return null;
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
