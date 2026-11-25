/**
 * Qué es el fichero que se quiere importar, dicho como lo diría una persona,
 * para que el aviso de «no he podido leerlo» diga QUÉ no se ha podido leer.
 *
 * Lo que sale de un iPhone: notas de voz en m4a (AAC o sin pérdida), audios
 * de WhatsApp en opus u ogg, vídeos de la galería en mov o mp4, y desde
 * Archivos cualquier cosa (caf, aiff, wav…). Safari lee casi todo lo de Apple
 * con `decodeAudioData`, pero no los vídeos (hay que reproducirlos para
 * sacarles el audio, ver `leerSonando`) ni, según la versión, el opus.
 */

export interface Formato {
  /** Extensión en minúsculas, sin punto («m4a»), o «» si no tiene. */
  extension: string;
  /** Cómo se nombra en un aviso: «m4a», «vídeo .mov», «opus». */
  nombre: string;
  /** Un vídeo: su audio solo se saca reproduciéndolo. */
  esVideo: boolean;
}

const VIDEO = new Set(['mov', 'mp4', 'm4v', '3gp', 'webm', 'avi', 'mkv']);
const AUDIO_CONOCIDO = new Set(['m4a', 'mp3', 'wav', 'aac', 'caf', 'aif', 'aiff', 'ogg', 'oga', 'opus', 'flac', 'amr', 'wma']);

/** Lo que acepta el selector de ficheros: audios y vídeos (en el iPhone así sale también la galería). */
export const ACEPTA_AUDIO =
  'audio/*,video/*,.m4a,.mp3,.wav,.aac,.caf,.aif,.aiff,.ogg,.opus,.flac,.webm,.mov,.mp4,.m4v,.3gp';

export function formatoDe(fichero: { name: string; type: string }): Formato {
  const punto = fichero.name.lastIndexOf('.');
  const extension = punto > 0 ? fichero.name.slice(punto + 1).toLowerCase() : '';
  const tipo = (fichero.type || '').toLowerCase();
  // Un .webm puede ser solo audio (las notas de voz de Chrome): manda el tipo.
  const esVideo = tipo.startsWith('video/') || (VIDEO.has(extension) && !tipo.startsWith('audio/'));
  if (esVideo) return { extension, nombre: extension ? `vídeo .${extension}` : 'vídeo', esVideo };
  if (AUDIO_CONOCIDO.has(extension)) return { extension, nombre: extension, esVideo };
  // Sin extensión conocida, lo que diga el tipo («audio/x-caf» → «caf»).
  const delTipo = tipo.startsWith('audio/') ? tipo.slice(6).replace(/^x-/, '').split(';')[0] : '';
  if (delTipo) return { extension, nombre: delTipo === 'mpeg' ? 'mp3' : delTipo, esVideo };
  return { extension, nombre: extension ? `.${extension}` : 'fichero', esVideo };
}

export type MotivoDeFallo = 'no-se-lee' | 'sin-permiso-para-sonar' | 'demasiado-largo' | 'vacio';

/** Duración máxima que se saca reproduciendo (tarda lo mismo que dura). */
export const MAXIMO_SONANDO_S = 20 * 60;

/** El aviso, con el formato dentro y qué hacer. */
export function mensajeDeImportar(formato: Formato, motivo: MotivoDeFallo): string {
  const cual = formato.nombre;
  switch (motivo) {
    case 'sin-permiso-para-sonar':
      return `Para sacar el audio de ese ${cual} tengo que reproducirlo y el navegador no me ha dejado. Vuelve a elegirlo.`;
    case 'demasiado-largo':
      return `Ese ${cual} dura más de ${MAXIMO_SONANDO_S / 60} minutos. Sácale el audio con otra app y vuelve a probar.`;
    case 'vacio':
      return `Ese ${cual} no tiene sonido.`;
    case 'no-se-lee':
      return formato.nombre === 'opus' || formato.nombre === 'ogg'
        ? `Este navegador no lee el ${cual} (los audios de WhatsApp). Pásalo a m4a, mp3 o wav y vuelve a probar.`
        : `No he podido leer ese ${cual}. Prueba con un m4a, mp3 o wav.`;
  }
}

/** Un fallo al importar que ya sabe qué decir. */
export class ErrorDeImportar extends Error {
  constructor(
    readonly formato: Formato,
    readonly motivo: MotivoDeFallo,
  ) {
    super(mensajeDeImportar(formato, motivo));
    this.name = 'ErrorDeImportar';
  }
}
