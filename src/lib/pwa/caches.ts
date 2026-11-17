/**
 * Nombres de las cachés del service worker y qué se borra al estrenar versión.
 *
 * Va aparte del worker para poder probarlo sin navegador: la regla de qué se
 * borra es la que puede llevarse por delante algo que no es nuestro. El
 * service worker escrito a mano de antes borraba TODA caché que no fuera la
 * suya, y eso incluía las muestras de los instrumentos (`aura-samples-*`), que
 * pesan y se bajan una vez. Ahora solo se toca lo que empieza por nuestro
 * prefijo y no está en la lista de vigentes.
 */

/** Prefijo de todo lo que guarda el service worker de la app. */
export const PREFIJO = 'aura-music';

/** Lo que guardan los instrumentos. No es nuestro y no se toca nunca. */
export const PREFIJO_MUESTRAS = 'aura-samples-';

/**
 * Cachés de tiempo de ejecución. Llevan nombre fijo, sin versión: el contenido
 * de `_next/static` va con huella en el nombre del fichero, así que una caché
 * por tipo basta y la caducidad la pone cada estrategia.
 */
export const CACHES = {
  /** El HTML de la app, red primero. */
  paginas: `${PREFIJO}-paginas`,
  /** Trozos de `_next/static` que no venían en la lista de la versión. */
  estaticos: `${PREFIJO}-estaticos`,
  /** Las Geist. */
  letras: `${PREFIJO}-letras`,
  /** Iconos e imágenes. */
  imagenes: `${PREFIJO}-imagenes`,
  /** Audios que llegan por «Compartir» desde otra app (Android). */
  compartido: `${PREFIJO}-compartido`,
} as const;

/**
 * Qué cachés sobran al activarse una versión nueva: las nuestras que ya no se
 * usan (la `aura-music-v3` del worker escrito a mano, por ejemplo). Las de
 * otros, y sobre todo las muestras de los instrumentos, nunca. La copia de la
 * app (`serwist-precache-v2-…`) la limpia Serwist por dentro, entrada a
 * entrada, al estrenar versión; aquí no se toca.
 */
export function cachesQueSobran(nombres: readonly string[]): string[] {
  const vigentes = new Set<string>(Object.values(CACHES));
  return nombres.filter((nombre) => {
    if (nombre.startsWith(PREFIJO_MUESTRAS)) return false;
    if (!nombre.startsWith(`${PREFIJO}-`)) return false;
    return !vigentes.has(nombre);
  });
}

/**
 * La copia de la app que se guarda al instalar el worker. No es `/` a secas
 * porque la ruta del precache sirve primero lo guardado, y las páginas tienen
 * que ir red primero. Next sirve la misma página estática con o sin
 * parámetros, así que esta URL es la app entera y solo se usa como respaldo
 * cuando no hay red ni copia más reciente.
 */
export const URL_APP_GUARDADA = '/?app=guardada';

/** A dónde manda el formulario de compartir de Android (ver el manifest). */
export const RUTA_COMPARTIR = '/compartir';
