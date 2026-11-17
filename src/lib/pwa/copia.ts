/**
 * Copia de seguridad de una idea: un zip con el proyecto en JSON y un WAV por
 * cada audio. Es lo que te llevas a Archivos o a iCloud, y lo único que pasa
 * de Safari a la app instalada en un iPhone (cada una guarda lo suyo aparte).
 *
 * El formato está pensado para durar y para leerse sin la app:
 *   idea.json            proyecto tal cual + qué fichero es cada audio
 *   audio/01-pista-1.wav WAV PCM de 16 bits, el mismo dato que hay en el móvil
 *
 * El audio va en 16 bits porque es lo que guarda el móvil (`storage.ts`): ni
 * se pierde nada ni se infla el zip. La conversión es exacta: lo guardado son
 * enteros divididos entre 32768, y aquí se multiplica por 32768 y se redondea,
 * así que la idea sale y vuelve muestra a muestra.
 *
 * Los WAV van sin comprimir dentro del zip (nivel 0): el audio apenas encoge
 * con deflate y comprimirlo en el móvil es medio minuto de batería para nada.
 */

import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate';
import { z } from 'zod';
import { slugify } from '@/lib/daw/audio';
import { newId, type Project } from '@/lib/daw/types';

export const FORMATO_IDEA = 'aura-music-idea';
export const VERSION_IDEA = 1;
const FICHERO_PROYECTO = 'idea.json';

export interface AudioDeIdea {
  /** Un array por canal, en coma flotante entre -1 y 1. */
  channels: Float32Array[];
  sampleRate: number;
}

/** Un fallo que se le puede enseñar a quien importa, ya redactado. */
export class ErrorDeCopia extends Error {}

/* -------------------------------------------------------------------------- */
/* WAV                                                                         */
/* -------------------------------------------------------------------------- */

/** La inversa exacta de `int16ToFloat` (`storage.ts`): x / 32768 → x. */
function aEntero(muestra: number): number {
  const valor = Math.round(muestra * 0x8000);
  return valor > 0x7fff ? 0x7fff : valor < -0x8000 ? -0x8000 : valor;
}

/** WAV PCM de 16 bits con los canales entrelazados, como cualquier editor lo espera. */
export function codificarWav16(audio: AudioDeIdea): Uint8Array {
  const canales = Math.max(1, audio.channels.length);
  const muestras = audio.channels[0]?.length ?? 0;
  const bloque = canales * 2;
  const datos = muestras * bloque;
  const salida = new Uint8Array(44 + datos);
  const v = new DataView(salida.buffer);
  const texto = (desde: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(desde + i, s.charCodeAt(i));
  };
  texto(0, 'RIFF');
  v.setUint32(4, 36 + datos, true);
  texto(8, 'WAVE');
  texto(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, canales, true);
  v.setUint32(24, audio.sampleRate, true);
  v.setUint32(28, audio.sampleRate * bloque, true);
  v.setUint16(32, bloque, true);
  v.setUint16(34, 16, true);
  texto(36, 'data');
  v.setUint32(40, datos, true);
  let pos = 44;
  for (let i = 0; i < muestras; i++) {
    for (let c = 0; c < canales; c++) {
      v.setInt16(pos, aEntero(audio.channels[c]?.[i] ?? 0), true);
      pos += 2;
    }
  }
  return salida;
}

/**
 * Lee un WAV de 16 bits o de 32 en coma flotante, recorriendo los bloques en
 * vez de suponer la cabecera de 44 bytes: si alguien abre el zip y retoca una
 * pista en otro editor, este puede meter bloques LIST o un fmt más largo.
 */
export function leerWav(bytes: Uint8Array): AudioDeIdea {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const texto = (desde: number) =>
    String.fromCharCode(v.getUint8(desde), v.getUint8(desde + 1), v.getUint8(desde + 2), v.getUint8(desde + 3));
  if (bytes.byteLength < 12 || texto(0) !== 'RIFF' || texto(8) !== 'WAVE') {
    throw new ErrorDeCopia('Uno de los audios no es un WAV.');
  }
  let formato = 0;
  let canales = 0;
  let frecuencia = 0;
  let bits = 0;
  let inicioDatos = -1;
  let largoDatos = 0;
  let pos = 12;
  while (pos + 8 <= bytes.byteLength) {
    const id = texto(pos);
    const largo = v.getUint32(pos + 4, true);
    const cuerpo = pos + 8;
    if (id === 'fmt ') {
      formato = v.getUint16(cuerpo, true);
      canales = v.getUint16(cuerpo + 2, true);
      frecuencia = v.getUint32(cuerpo + 4, true);
      bits = v.getUint16(cuerpo + 14, true);
      // WAVE_FORMAT_EXTENSIBLE: el formato de verdad va en el subformato.
      if (formato === 0xfffe && largo >= 26) formato = v.getUint16(cuerpo + 24, true);
    } else if (id === 'data') {
      inicioDatos = cuerpo;
      largoDatos = Math.min(largo, bytes.byteLength - cuerpo);
      break;
    }
    pos = cuerpo + largo + (largo % 2);
  }
  const pcm16 = formato === 1 && bits === 16;
  const flotante = formato === 3 && bits === 32;
  if (inicioDatos < 0 || canales < 1 || frecuencia < 1 || (!pcm16 && !flotante)) {
    throw new ErrorDeCopia('Uno de los audios tiene un formato que no sé leer.');
  }
  const ancho = pcm16 ? 2 : 4;
  const muestras = Math.floor(largoDatos / (ancho * canales));
  const channels = Array.from({ length: canales }, () => new Float32Array(muestras));
  let p = inicioDatos;
  for (let i = 0; i < muestras; i++) {
    for (let c = 0; c < canales; c++) {
      channels[c][i] = pcm16 ? v.getInt16(p, true) / 0x8000 : v.getFloat32(p, true);
      p += ancho;
    }
  }
  return { channels, sampleRate: frecuencia };
}

/* -------------------------------------------------------------------------- */
/* Proyecto                                                                    */
/* -------------------------------------------------------------------------- */

const numero = z.number().refine(Number.isFinite, 'número no válido');

/* Abiertos a campos que no conocen (`looseObject`): el mezclador y los
   instrumentos van a añadir cosas a las pistas, y una copia hecha con una
   versión más nueva no puede perderlas al volver a entrar. */
const ClipSchema = z.looseObject({
  bufferId: z.string().min(1),
  start: numero,
  offset: numero,
  duration: numero,
  repeats: numero,
});

const TrackSchema = z.looseObject({
  id: z.string().min(1),
  name: z.string(),
  clip: ClipSchema,
  volume: numero,
  muted: z.boolean(),
  soloed: z.boolean(),
  sourceDuration: numero,
  createdAt: numero,
  ia: z.boolean().optional(),
});

const ProyectoSchema = z.looseObject({
  id: z.string().min(1),
  name: z.string(),
  bpm: numero,
  tracks: z.array(TrackSchema),
  createdAt: numero,
  updatedAt: numero,
});

const EntradaAudioSchema = z.object({
  bufferId: z.string().min(1),
  fichero: z.string().min(1),
  canales: z.number().int().min(1),
  muestras: z.number().int().min(0),
  frecuencia: z.number().int().min(1),
});

const ManifiestoSchema = z.object({
  formato: z.literal(FORMATO_IDEA),
  version: z.number().int(),
  exportadaEn: z.string(),
  proyecto: ProyectoSchema,
  audios: z.array(EntradaAudioSchema),
});

export type ManifiestoIdea = z.infer<typeof ManifiestoSchema>;

/** Los audios que hay que meter en el zip: uno por buffer, aunque dos pistas lo compartan. */
export function audiosDeLaIdea(proyecto: Project): string[] {
  return [...new Set(proyecto.tracks.map((pista) => pista.clip.bufferId))];
}

/**
 * Empaqueta la idea. `audios` trae lo que haya en el móvil para cada buffer;
 * si falta alguno (una pista cuyo audio nunca llegó a guardarse) el proyecto
 * va igual y esa pista vuelve muda, como está ahora.
 */
export function crearZipDeIdea(
  proyecto: Project,
  audios: ReadonlyMap<string, AudioDeIdea>,
  ahora: Date = new Date(),
): Uint8Array {
  const ficheros: Zippable = {};
  const entradas: ManifiestoIdea['audios'] = [];
  const usados = new Set<string>();

  audiosDeLaIdea(proyecto).forEach((bufferId, i) => {
    const audio = audios.get(bufferId);
    if (!audio) return;
    const pista = proyecto.tracks.find((t) => t.clip.bufferId === bufferId);
    let nombre = `audio/${String(i + 1).padStart(2, '0')}-${slugify(pista?.name ?? 'pista')}.wav`;
    // Dos pistas con el mismo nombre no pueden pisarse el fichero.
    while (usados.has(nombre)) nombre = nombre.replace(/\.wav$/, '-b.wav');
    usados.add(nombre);
    ficheros[nombre] = [codificarWav16(audio), { level: 0 }];
    entradas.push({
      bufferId,
      fichero: nombre,
      canales: Math.max(1, audio.channels.length),
      muestras: audio.channels[0]?.length ?? 0,
      frecuencia: audio.sampleRate,
    });
  });

  const manifiesto: ManifiestoIdea = {
    formato: FORMATO_IDEA,
    version: VERSION_IDEA,
    exportadaEn: ahora.toISOString(),
    proyecto: proyecto as ManifiestoIdea['proyecto'],
    audios: entradas,
  };
  ficheros[FICHERO_PROYECTO] = [strToU8(JSON.stringify(manifiesto, null, 2)), { level: 6 }];
  return zipSync(ficheros, { mtime: ahora });
}

/** Lo contrario. Lanza `ErrorDeCopia` con un mensaje que se puede enseñar tal cual. */
export function leerZipDeIdea(bytes: Uint8Array): {
  proyecto: Project;
  audios: Map<string, AudioDeIdea>;
  exportadaEn: string;
} {
  let ficheros: Record<string, Uint8Array>;
  try {
    ficheros = unzipSync(bytes);
  } catch {
    throw new ErrorDeCopia('Ese fichero no es un zip, o está a medias.');
  }
  const json = ficheros[FICHERO_PROYECTO];
  if (!json) throw new ErrorDeCopia('Ese zip no es una idea de Aura Music.');

  let crudo: unknown;
  try {
    crudo = JSON.parse(strFromU8(json));
  } catch {
    throw new ErrorDeCopia('La idea del zip está dañada.');
  }
  const leido = ManifiestoSchema.safeParse(crudo);
  if (!leido.success) throw new ErrorDeCopia('Ese zip no es una idea de Aura Music, o está dañado.');
  if (leido.data.version > VERSION_IDEA) {
    throw new ErrorDeCopia('Esa idea viene de una versión más nueva. Actualiza la app y vuelve a probar.');
  }

  const audios = new Map<string, AudioDeIdea>();
  for (const entrada of leido.data.audios) {
    const wav = ficheros[entrada.fichero];
    if (!wav) throw new ErrorDeCopia(`Falta ${entrada.fichero} dentro del zip.`);
    audios.set(entrada.bufferId, leerWav(wav));
  }
  return { proyecto: leido.data.proyecto as Project, audios, exportadaEn: leido.data.exportadaEn };
}

/**
 * Prepara una idea leída para meterla en el móvil sin pisar nada:
 *   · los audios siempre estrenan id (son internos y así no chocan con nada);
 *   · el proyecto conserva el suyo salvo que ya exista, y entonces entra como
 *     una idea aparte «(copia)». Importar nunca sobrescribe: lo que hay en el
 *     móvil puede ser más nuevo que la copia.
 */
export function prepararParaImportar(
  proyecto: Project,
  audios: ReadonlyMap<string, AudioDeIdea>,
  yaExiste: boolean,
  nuevoId: (prefijo: string) => string = newId,
): { proyecto: Project; audios: Map<string, AudioDeIdea> } {
  const ids = new Map<string, string>();
  for (const bufferId of audiosDeLaIdea(proyecto)) ids.set(bufferId, nuevoId('buf'));
  const nuevos = new Map<string, AudioDeIdea>();
  for (const [viejo, audio] of audios) {
    const nuevo = ids.get(viejo);
    if (nuevo) nuevos.set(nuevo, audio);
  }
  return {
    proyecto: {
      ...proyecto,
      id: yaExiste ? nuevoId('prj') : proyecto.id,
      name: yaExiste ? `${proyecto.name} (copia)` : proyecto.name,
      tracks: proyecto.tracks.map((pista) => ({
        ...pista,
        clip: { ...pista.clip, bufferId: ids.get(pista.clip.bufferId) ?? pista.clip.bufferId },
      })),
    },
    audios: nuevos,
  };
}

/** Nombre del zip: el de la idea y la fecha, para que varias copias no se pisen. */
export function nombreDelZip(proyecto: Pick<Project, 'name'>, ahora: Date = new Date()): string {
  const dia = ahora.toISOString().slice(0, 10);
  return `${slugify(proyecto.name)}-${dia}.zip`;
}
