/**
 * aura Music de bolsillo: el contrato común.
 *
 * La parte de aura Music para quien ESCUCHA: te haces canciones, paisajes
 * largos, artistas y playlists, las retocas con versiones hasta que te gustan
 * y las escuchas como en Spotify. Plan: docs/PLAN-BOLSILLO.md. Decisión 0029.
 *
 * Todo lo de bolsillo habla con estos tipos. Son datos planos (se guardan tal
 * cual en IndexedDB y, más adelante, en Firestore), sin funciones ni clases.
 */

/** Para qué es la música. Es el primer chip del chat de crear. */
export type Momento =
  | 'concentrarme'
  | 'dormir'
  | 'desconectar'
  | 'correr'
  | 'para-alguien'
  | 'sorprendeme';

export const MOMENTOS: readonly Momento[] = [
  'concentrarme',
  'dormir',
  'desconectar',
  'correr',
  'para-alguien',
  'sorprendeme',
];

/**
 * Los motores que se pueden pedir: TODOS los de música de aura Studio, con
 * sus mismos ids (`aura-studio/api/fal.ts`, `MUSIC_MODELS` de la op `music`),
 * más el motor falso de desarrollo, que suena en el móvil y no gasta. Qué es
 * cada uno y cuándo conviene: `motores.ts`.
 */
export type MotorId =
  | 'lyria3'
  | 'lyria-3.5'
  | 'lyria3-base'
  | 'lyria2'
  | 'eleven-music'
  | 'minimax-music-3'
  | 'minimax-music'
  | 'diffrhythm'
  | 'sonilo'
  | 'stable-audio'
  | 'ace-step'
  | 'cassette'
  | 'falso';

/** Una canción (2-3 min, con estructura) o un paisaje (largo, sin estribillo, para un fin). */
export type TipoPieza = 'cancion' | 'paisaje';

/** Las capas que el móvil pone encima de un paisaje. Gratis: se sintetizan aquí. */
export interface CapasPaisaje {
  /** Un tono puro, p. ej. 142 Hz. `nivel` de 0 a 1 (0,1 = muy bajo). */
  tono?: { hz: number; nivel: number };
  /** Un tono distinto en cada oído. Solo tiene sentido con auriculares. */
  binaural?: { baseHz: number; difHz: number; nivel: number };
  ruido?: { color: 'blanco' | 'rosa' | 'marron'; nivel: number };
  /** Pulso isocrónico: el volumen de la base sube y baja `hz` veces por segundo. */
  pulso?: { hz: number; profundidad: number };
  /** Volumen de la música base dentro del paisaje (0-1). */
  nivelBase?: number;
}

/** Lo que se le pide a la máquina, en castellano y en datos. */
export interface Receta {
  tipo: TipoPieza;
  momento?: Momento;
  /** Lo que pidió la persona, con sus palabras. */
  frase: string;
  /** Estilo en palabras sencillas: «piano y pad cálido», «rumba». */
  estilo?: string;
  conVoz: boolean;
  /** Idioma de la letra si canta: 'es', 'en'… */
  idioma?: string;
  /** Letra literal, si la hay (el nombre de tu madre). */
  letra?: string;
  /** Lo que dura lo que se escucha. En un paisaje, la duración total (el bucle se alarga en el móvil). */
  duracionSeg: number;
  /** Tempo aproximado, si se sabe. */
  bpm?: number;
  /** Más tranquila (0) o con más energía (1). */
  energia?: number;
  artistaId?: string;
  capas?: CapasPaisaje;
  motor: MotorId;
}

export type EstadoVersion = 'generando' | 'lista' | 'fallo';

/** El trabajo en la nube de una versión que aún no ha llegado: para retomarlo sin pagar dos veces. */
export interface TrabajoRemoto {
  /** Lo que devolvió aura Studio al encolar (requestId+queueSlug, o provider+jobId). */
  referencia: Record<string, string>;
  lanzadoEn: number;
}

/** Una versión de una canción: v1, v2, v3… Cada una con su receta y su audio. */
export interface Version {
  id: string;
  cancionId: string;
  /** 1, 2, 3… en el orden en que nacieron. */
  n: number;
  creadaEn: number;
  receta: Receta;
  /** Qué cambió respecto a la anterior, en una frase: «Más lenta y sin voz». */
  cambio: string;
  estado: EstadoVersion;
  error?: string;
  /** Clave del audio en el almacén del móvil (store `audios`). Ausente mientras se genera. */
  audioId?: string;
  /** Dónde vive el audio en la nube (el enlace de aura Studio), si lo hay. */
  urlRemota?: string;
  duracionSeg?: number;
  /** Un paisaje suena en bucle hasta `receta.duracionSeg` o hasta el temporizador. */
  bucle?: boolean;
  creditos: number;
  motor: MotorId;
  letra?: string;
  trabajo?: TrabajoRemoto;
}

/** La portada. Por defecto es generativa (gratis, sale de una semilla). */
export type Portada = { tipo: 'generativa'; semilla: number } | { tipo: 'imagen'; url: string };

export type OrigenCancion = 'bolsillo' | 'aura-studio';

export interface Cancion {
  id: string;
  titulo: string;
  /** Por qué existe, en una frase: «Para las tardes de dolor de cabeza, lenta y sin voz». */
  porque?: string;
  tipo: TipoPieza;
  artistaId?: string;
  portada: Portada;
  /** La versión que suena al tocarla. La elige «Me la quedo»; mientras, la última lista. */
  versionElegida?: string;
  /** «Me la quedo»: está en la biblioteca. Sin esto es un borrador y se limpia a los 30 días. */
  guardada: boolean;
  creadaEn: number;
  actualizadaEn: number;
  escuchas: number;
  ultimaEscucha?: number;
  origen: OrigenCancion;
  /** Id en aura Studio cuando se importó de allí (para no importarla dos veces). */
  idOrigen?: string;
}

/** El ADN de un artista inventado. Cada canción suya sale de aquí. */
export interface AdnArtista {
  estilo: string;
  instrumentos: string[];
  /** Cómo canta, descrito: «voz grave y cálida, casi hablada». Vacío = instrumental. */
  voz: string;
  idioma?: string;
  tempo?: { min: number; max: number };
  /** De qué habla. */
  temas?: string;
  /** Lo que no hace nunca. */
  nunca?: string;
}

export interface Artista {
  id: string;
  nombre: string;
  adn: AdnArtista;
  portada: Portada;
  creadoEn: number;
  actualizadoEn: number;
}

/** Una playlist que se renueva sola, siempre con un tope de gasto que se ve. */
export interface PlaylistViva {
  cada: 'dia' | 'semana';
  /** Cuántas canciones nuevas trae cada vez. */
  nuevas: number;
  topeCreditosMes: number;
  gastadoMes: number;
  /** «2026-11»: el mes al que se refiere `gastadoMes`. */
  mes: string;
  ultimaRenovacion?: number;
  /** La receta base de lo que se renueva. */
  receta: Receta;
}

export interface Playlist {
  id: string;
  nombre: string;
  porque?: string;
  cancionIds: string[];
  /** Por qué está cada canción, en una frase (como Prompted Playlist). */
  porques?: Record<string, string>;
  portada: Portada;
  viva?: PlaylistViva;
  creadaEn: number;
  actualizadaEn: number;
}

/** El reproductor toca una versión concreta de una canción. */
export interface Pista {
  cancion: Cancion;
  version: Version;
}

/** A dónde se puede ir dentro de la app. Lo usa la navegación de BolsilloApp. */
export type Destino =
  | { tipo: 'cancion'; id: string }
  | { tipo: 'playlist'; id: string }
  | { tipo: 'artista'; id: string }
  | { tipo: 'nuevo-artista' }
  | { tipo: 'nueva-playlist' }
  | { tipo: 'paisaje'; cancionId?: string }
  | { tipo: 'cuenta' };

export type Pestana = 'inicio' | 'crear' | 'biblioteca';

export interface Navegacion {
  ir(destino: Destino): void;
  atras(): void;
  pestana(p: Pestana): void;
}
