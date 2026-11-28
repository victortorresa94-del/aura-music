/**
 * De una pista de Music Studio (aura Studio) a una canción de tu biblioteca.
 * PURO: sin red, sin almacén, sin Firebase.
 *
 * Music Studio guarda cada pista en `users/{uid}/studioAudios/{id}`
 * (`aura-studio/src/services/studioAudioService.ts`): `kind` (`music`, `voice`
 * o `sfx`), `url` (la del proveedor y, archivada, la de Storage), `prompt` (la
 * frase de quien la pidió, sin el «Instrumental, sin voz.» que se añade al
 * enviar), `durationSec` (lo PEDIDO, no lo medido), `model` (el id de
 * `MUSIC_MODELS`), `letra` (la de Lyria con sus tiempos, o la tuya), `modo`
 * (`sin`, `con` o `tuya`) y `createdAt`. Una pista de doblaje nace con la URL
 * vacía y `pendiente`; una que falló, con `estado: 'fallo'`. Esas no se traen.
 *
 * Lo que aquí NO se hace: deducir nada de la frase. Ni el momento, ni para
 * qué es, ni si es de salud. «Una lenta para la migraña» se copia como título
 * y como frase, tal cual, y la biblioteca no la etiqueta (plan, parte 3.2: lo
 * que se dice de salud no se guarda como salud).
 */

import { portadaGenerativa } from '../biblioteca';
import type { Cancion, MotorId, Receta, Version } from '../tipos';

/** Una pista de Music Studio ya validada: solo lo que se usa. */
export interface PistaDeAuraStudio {
  id: string;
  url: string;
  prompt: string;
  /** Un nombre puesto a mano, si el documento lo trae (hoy Music Studio no lo guarda). */
  nombre?: string;
  durationSec?: number;
  model?: string;
  letra?: string;
  modo?: 'sin' | 'con' | 'tuya';
  createdAt: number;
}

const MAX_URL = 4096;
const MAX_LETRA = 20_000;
const MAX_FRASE = 4000;
const MAX_TITULO = 48;
/** Un id de Firestore cabe aquí de sobra; lo raro se limpia para usarlo dentro de los nuestros. */
const ID_SEGURO = /[^A-Za-z0-9_-]/g;

const texto = (v: unknown): string => (typeof v === 'string' ? v : '');

/**
 * Lee un documento de `studioAudios` y devuelve la pista si es música que se
 * puede escuchar; `null` si no (una voz, un efecto, un doblaje a medias, una
 * que falló o una sin enlace https).
 */
export function leerPista(id: string, datos: Record<string, unknown>, ahora = Date.now()): PistaDeAuraStudio | null {
  if (!id || !datos || typeof datos !== 'object') return null;
  if (datos.kind !== 'music') return null;
  if (datos.pendiente === true || datos.estado === 'fallo') return null;
  const url = texto(datos.url).trim();
  if (!url || url.length > MAX_URL || !/^https:\/\//i.test(url)) return null;

  const creada = typeof datos.createdAt === 'number' && Number.isFinite(datos.createdAt) && datos.createdAt > 0 ? datos.createdAt : ahora;
  const duracion =
    typeof datos.durationSec === 'number' && Number.isFinite(datos.durationSec) && datos.durationSec > 0 && datos.durationSec < 24 * 3600
      ? datos.durationSec
      : undefined;
  const modo = datos.modo === 'sin' || datos.modo === 'con' || datos.modo === 'tuya' ? datos.modo : undefined;
  const nombre = [datos.nombre, datos.titulo, datos.name, datos.title].map(texto).map((t) => t.trim()).find(Boolean);
  const letra = texto(datos.letra).trim().slice(0, MAX_LETRA);
  const model = texto(datos.model).trim().slice(0, 80);

  return {
    id,
    url,
    prompt: texto(datos.prompt).trim().slice(0, MAX_FRASE),
    ...(nombre ? { nombre: nombre.slice(0, 120) } : {}),
    ...(duracion !== undefined ? { durationSec: duracion } : {}),
    ...(model ? { model } : {}),
    ...(letra ? { letra } : {}),
    ...(modo ? { modo } : {}),
    createdAt: creada,
  };
}

/**
 * El motor de bolsillo que corresponde al modelo de Music Studio. Los que
 * bolsillo no tiene (Eleven Music, Stable Audio, MiniMax 2.6…) o una pista
 * sin modelo quedan como Lyria 3 Pro, el de por defecto de Music Studio
 * (`MUSICA_POR_DEFECTO`): es lo que se usará si la retocas desde aquí. No
 * cobra nada: una canción importada lleva `creditos: 0`.
 */
export function motorDeModelo(model?: string): MotorId {
  switch (model) {
    case 'lyria-3.5':
      return 'lyria-3.5';
    case 'lyria3-base':
      return 'lyria3-base';
    case 'minimax-music-3':
      return 'minimax-music-3';
    case 'ace-step':
      return 'ace-step';
    case 'lyria3':
    default:
      return 'lyria3';
  }
}

/**
 * El título: el nombre si lo tiene; si no, el principio de su frase, tal cual
 * (solo se corta: la primera línea, hasta el primer punto, y a 48 letras sin
 * partir una palabra; la primera letra, en mayúscula). Sin frase, «Canción de
 * aura Studio».
 */
export function tituloDePista(pista: Pick<PistaDeAuraStudio, 'nombre' | 'prompt'>): string {
  const linea = (pista.nombre || pista.prompt).split('\n').map((l) => l.trim()).find(Boolean) ?? '';
  const base = linea.replace(/\s+/g, ' ').trim();
  if (!base) return 'Canción de aura Studio';
  // Hasta el primer punto que acaba una frase («142.5 Hz» no corta) o punto y coma.
  const primera = base.split(/[.;](?=\s|$)/)[0].trim() || base;
  let titulo = primera;
  if (titulo.length > MAX_TITULO) {
    const corte = titulo.slice(0, MAX_TITULO + 1);
    const espacio = corte.lastIndexOf(' ');
    titulo = `${(espacio > 20 ? corte.slice(0, espacio) : titulo.slice(0, MAX_TITULO)).replace(/[\s,:;-]+$/, '')}…`;
  }
  return titulo.charAt(0).toLocaleUpperCase('es') + titulo.slice(1);
}

/** Los ids salen de la pista, no del azar: traerla dos veces escribe encima, nunca duplica. */
export function idsDePista(pista: Pick<PistaDeAuraStudio, 'id' | 'createdAt'>): { cancion: string; version: string; audio: string } {
  const sufijo = `${Math.trunc(pista.createdAt).toString(36)}_as_${pista.id.replace(ID_SEGURO, '').slice(0, 60)}`;
  return { cancion: `can_${sufijo}`, version: `ver_${sufijo}`, audio: `aud_${sufijo}` };
}

/** El tipo de un audio por la extensión de su enlace, para cuando el servidor no lo dice. */
export function tipoDeAudio(url: string): string {
  const m = /\.(mp3|wav|m4a|ogg|opus|webm|aac|flac)(?:[?#]|$)/i.exec(url);
  switch (m?.[1].toLowerCase()) {
    case 'wav':
      return 'audio/wav';
    case 'm4a':
    case 'aac':
      return 'audio/mp4';
    case 'ogg':
    case 'opus':
      return 'audio/ogg';
    case 'webm':
      return 'audio/webm';
    case 'flac':
      return 'audio/flac';
    default:
      return 'audio/mpeg';
  }
}

/**
 * La canción y su v1, listas, a partir de una pista de Music Studio. Ya está
 * hecha y pagada allí: entra guardada («Me la quedo» ya está dicho), con
 * `creditos: 0` y el enlace de aura Studio. El audio del móvil (`audioId`) se
 * pone después, si se consigue bajar.
 */
export function cancionDePista(pista: PistaDeAuraStudio): { cancion: Cancion; version: Version } {
  const ids = idsDePista(pista);
  const titulo = tituloDePista(pista);
  const motor = motorDeModelo(pista.model);
  const conVoz = pista.modo === 'sin' ? false : pista.modo ? true : !!pista.letra;
  const duracion = pista.durationSec ?? 30;
  const receta: Receta = {
    tipo: 'cancion',
    frase: pista.prompt,
    conVoz,
    // Solo la letra que pusiste tú es «letra pedida»; la de Lyria es lo que cantó.
    ...(pista.modo === 'tuya' && pista.letra ? { letra: pista.letra } : {}),
    duracionSeg: duracion,
    motor,
  };
  const version: Version = {
    id: ids.version,
    cancionId: ids.cancion,
    n: 1,
    creadaEn: pista.createdAt,
    receta,
    cambio: 'Hecha en aura Studio',
    estado: 'lista',
    urlRemota: pista.url,
    ...(pista.durationSec !== undefined ? { duracionSeg: pista.durationSec } : {}),
    creditos: 0,
    motor,
    ...(pista.letra ? { letra: pista.letra } : {}),
  };
  const cancion: Cancion = {
    id: ids.cancion,
    titulo,
    tipo: 'cancion',
    portada: portadaGenerativa(`${ids.cancion}:${titulo}`),
    versionElegida: ids.version,
    guardada: true,
    creadaEn: pista.createdAt,
    actualizadaEn: pista.createdAt,
    escuchas: 0,
    origen: 'aura-studio',
    idOrigen: pista.id,
  };
  return { cancion, version };
}
