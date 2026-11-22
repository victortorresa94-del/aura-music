/**
 * La nube de Aura Music: las piezas y lo que se dicen.
 *
 * Local primero. IndexedDB sigue mandando en cada dispositivo: grabar, tocar
 * y guardar no esperan nunca a la red. La nube (el Firebase de Aura, con tu
 * cuenta de Aura) se pone al día en segundo plano:
 *
 *   · cada idea es un documento en `users/{uid}/auraMusicProjects/{id}`;
 *   · cada audio, un FLAC en Storage, `users/{uid}/aura-music/{id}/{bufferId}`;
 *   · el cerebro del productor, `users/{uid}/auraMusic/cerebro`.
 *
 * El motor (`motor.ts`) no sabe nada de Firebase ni de IndexedDB: habla con
 * un `Remoto` y un `Local`. Así se prueba entero con los dos simulados.
 */

import type { Project } from '@/lib/daw/types';
import type { Cerebro } from '@/lib/productor/cerebro';
import type { Pcm16 } from './flac';

export interface Dispositivo {
  /** Al azar, uno por navegador (la app instalada y Safari son dos). */
  id: string;
  /** Para las personas: «iPhone», «PC», «móvil Android». */
  nombre: string;
}

/** Lo que hay en la nube de cada idea. */
export interface ProyectoRemoto {
  id: string;
  /** La hora de la última modificación en el dispositivo que la hizo. Gana la más reciente. */
  updatedAt: number;
  /** Borrada: queda la lápida para que el borrado llegue a los demás dispositivos. */
  borrado: boolean;
  /** Los audios que usa esta versión. */
  buffers: string[];
  dispositivo: Dispositivo | null;
  /** La idea entera (sin audio). `null` en las borradas. */
  proyecto: Project | null;
  /** Hora del servidor al escribirlo: sirve para pedir solo lo que ha cambiado. */
  servidorEn: number;
  /** Audios de la carpeta que ya no usa nadie, con la hora en que se vio. */
  huerfanos: Record<string, number>;
  /** En las borradas: el audio ya se ha quitado de Storage. */
  audioBorrado: boolean;
}

export interface CerebroRemoto {
  cerebro: Cerebro;
  updatedAt: number;
}

export interface MetaAudio {
  sampleRate: number;
  canales: number;
  muestras: number;
}

/** El Firebase de Aura, visto desde el motor. Ya sabe de qué cuenta es (el uid va dentro). */
export interface Remoto {
  /** Las ideas; con `desde`, solo las escritas después de esa hora del servidor. */
  listarProyectos(desde: number | null): Promise<ProyectoRemoto[]>;
  leerProyecto(id: string): Promise<ProyectoRemoto | null>;
  escribirProyecto(proyecto: Project, buffers: string[], dispositivo: Dispositivo): Promise<void>;
  escribirBorrado(id: string, updatedAt: number, dispositivo: Dispositivo): Promise<void>;
  /** Solo los campos de limpieza: no cuenta como modificación de la idea. */
  marcarLimpieza(id: string, huerfanos: Record<string, number>, audioBorrado?: boolean): Promise<void>;
  subirAudio(
    proyectoId: string,
    bufferId: string,
    flac: Uint8Array,
    meta: MetaAudio,
    alProgreso?: (bytes: number) => void,
  ): Promise<void>;
  /** `null` si ese audio no está en la nube. */
  bajarAudio(proyectoId: string, bufferId: string): Promise<Uint8Array | null>;
  listarAudios(proyectoId: string): Promise<string[]>;
  borrarAudio(proyectoId: string, bufferId: string): Promise<void>;
  leerCerebro(): Promise<CerebroRemoto | null>;
  escribirCerebro(cerebro: Cerebro, dispositivo: Dispositivo): Promise<void>;
}

/** Lo de este dispositivo, visto desde el motor. Escribir aquí no avisa a la nube (no hay eco). */
export interface Local {
  listarProyectos(): Promise<Project[]>;
  leerProyecto(id: string): Promise<Project | null>;
  guardarProyecto(proyecto: Project): Promise<void>;
  borrarProyecto(proyecto: Project): Promise<void>;
  leerAudio(bufferId: string): Promise<Pcm16 | null>;
  guardarAudio(bufferId: string, audio: Pcm16): Promise<void>;
  tieneAudio(bufferId: string): Promise<boolean>;
  leerCerebro(): Cerebro;
  guardarCerebro(cerebro: Cerebro): void;
}

/** Una tarea pendiente: «pon al día esta idea» o «pon al día el cerebro». */
export interface EntradaCola {
  clave: string;
  /** Cuándo entró por primera vez (para no aplazarla para siempre). */
  desde: number;
  /** Cuándo se puede intentar. */
  cuando: number;
  intentos: number;
  /** Sube cada vez que se vuelve a pedir: si llega un cambio mientras se sube, no se da por hecha. */
  version: number;
  error?: string;
}

/** Lo que este dispositivo recuerda de una cuenta, entre sesiones. */
export interface EstadoGuardado {
  version: 1;
  /** Por idea, la `updatedAt` en la que este dispositivo y la nube estaban de acuerdo. */
  base: Record<string, number>;
  /** Ideas borradas aquí cuyo borrado aún no ha llegado a la nube, con la hora del borrado. */
  borrados: Record<string, number>;
  /** La hora del servidor más alta que se ha visto (para pedir solo lo nuevo). */
  marca: number;
  /** Cuándo se hizo la última limpieza de audios viejos. */
  ultimaLimpieza: number;
  cola: EntradaCola[];
  /** El cerebro tal como quedó en la última puesta al día (para mezclar sin perder borrados). */
  cerebroBase: Cerebro | null;
}

export function estadoVacio(): EstadoGuardado {
  return { version: 1, base: {}, borrados: {}, marca: 0, ultimaLimpieza: 0, cola: [], cerebroBase: null };
}

export type FaseNube = 'apagada' | 'fuera' | 'al-dia' | 'trabajando' | 'sin-conexion' | 'error';

/** Lo que la interfaz enseña. */
export interface EstadoNube {
  fase: FaseNube;
  /** Ideas (y el cerebro) que faltan por subir. */
  pendientes: number;
  /** Audios de la tarea en curso. */
  subiendo: { hechos: number; total: number } | null;
  bajando: boolean;
  error: string | null;
  /** La idea abierta ha cambiado en otro dispositivo y espera a que digas «Cargar». */
  cambioEnLaAbierta: { id: string; dispositivo: string } | null;
  ultimaVez: number | null;
}

export const ESTADO_INICIAL: EstadoNube = {
  fase: 'apagada',
  pendientes: 0,
  subiendo: null,
  bajando: false,
  error: null,
  cambioEnLaAbierta: null,
  ultimaVez: null,
};
