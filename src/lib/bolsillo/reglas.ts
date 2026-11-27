/**
 * Las reglas que no se saltan en bolsillo (plan, partes 3.4, 3.6 y 6), en
 * código y con tests: una regla que solo vive en un texto se la salta el
 * primero que tiene prisa.
 *
 * 1. Nada que imite a un artista real. Spotify solo admite la suplantación
 *    con permiso del artista (25-sep-2025), y un artista de aura es inventado
 *    y es tuyo. Si alguien pide «que suene como X», se le pide que describa
 *    cómo suena en vez de a quién se parece.
 * 2. Ninguna promesa de salud en la interfaz: se dice para qué está pensada
 *    («para bajar el ritmo»), nunca qué cura. Lo vigila `reglas.test.ts`
 *    leyendo los ficheros de la interfaz.
 */

/** Palabras con mayúscula que no son artistas aunque vayan tras «como». */
const NO_SON_ARTISTAS = new Set([
  'dios',
  'navidad',
  'españa',
  'madrid',
  'barcelona',
  'andalucía',
  'andalucia',
  'sevilla',
  'cádiz',
  'cadiz',
  'semana',
  'santa',
  'año',
  'nuevo',
]);

const DISPARADORES =
  /(?:\bque\s+suene\s+(?:a|como)|\bal\s+estilo\s+de|\bestilo\s+de|\bvoz\s+de|\bimitando\s+a|\bimitar\s+a|\bcomo\s+(?:las?\s+|los?\s+|el\s+)?(?:canciones\s+de\s+)?|\brollo|\bsound\s+like|\bin\s+the\s+style\s+of|\blike)\s+((?:[A-ZÁÉÍÓÚÑ][\p{L}'’.-]*)(?:\s+(?:(?:de|del|la|las|los|el|y|&)\s+)*[A-ZÁÉÍÓÚÑ][\p{L}'’.-]*)*)/gu;

/**
 * Si el texto pide parecerse a alguien con nombre propio, devuelve ese nombre.
 * Es una red, no un juez: ante la duda pregunta, no bloquea.
 */
export function pareceImitacion(texto: string): string | null {
  for (const m of texto.matchAll(DISPARADORES)) {
    const nombre = (m[1] ?? '').trim();
    if (!nombre) continue;
    const primera = nombre.split(/\s+/)[0].toLowerCase();
    if (NO_SON_ARTISTAS.has(primera)) continue;
    return nombre;
  }
  return null;
}

/** La frase que se le dice cuando pide parecerse a alguien. */
export function respuestaAImitacion(nombre: string): string {
  return `No hago canciones que imiten a ${nombre} ni su voz. Dime cómo quieres que suene (lenta, con guitarra, voz grave…) y la hago tuya.`;
}

/**
 * Lo que la interfaz no puede prometer. Se comprueba en los ficheros de
 * `src/components/bolsillo/` (test).
 */
export const PROMESAS_DE_SALUD =
  /\b(cura|curar|cura la|alivia|aliviar|alivio del dolor|sana|sanar|sanadora|sanador|elimina el dolor|quita el dolor|terapéutic[oa]|tratamiento|frecuencia milagro|frecuencias sanadoras)\b/iu;
