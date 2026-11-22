/**
 * El teclado del ordenador como instrumento, para tocar y grabar sin
 * pantalla táctil (como el «teclado musical» de GarageBand).
 *
 * - Batería: las cuatro filas de la izquierda son los 16 pads en su sitio,
 *   1 2 3 4 / Q W E R / A S D F / Z X C V (la de abajo, la de abajo).
 * - Lo demás: la fila A S D F G H J K L Ñ son las blancas y W E T Y U O P
 *   las negras, como un piano; Z y X bajan y suben de octava.
 *
 * Puro: traduce una tecla a una nota y se prueba sin navegador.
 */

/** Teclas de los pads, en el mismo orden que la rejilla (de arriba abajo). */
const PADS = ['1', '2', '3', '4', 'q', 'w', 'e', 'r', 'a', 's', 'd', 'f', 'z', 'x', 'c', 'v'];

/** Semitonos desde el Do de la octava elegida. */
const PIANO: Record<string, number> = {
  a: 0, w: 1, s: 2, e: 3, d: 4, f: 5, t: 6, g: 7, y: 8, h: 9, u: 10, j: 11,
  k: 12, o: 13, l: 14, p: 15, 'ñ': 16, ';': 16,
};

export type AccionTecla =
  | { tipo: 'pad'; indice: number }
  | { tipo: 'nota'; semitonos: number }
  | { tipo: 'octava'; cambio: -1 | 1 }
  | null;

/** Qué hace una tecla con el instrumento abierto (batería o no). */
export function accionDeTecla(tecla: string, esBateria: boolean): AccionTecla {
  const k = tecla.toLowerCase();
  if (esBateria) {
    const indice = PADS.indexOf(k);
    return indice >= 0 ? { tipo: 'pad', indice } : null;
  }
  if (k === 'z') return { tipo: 'octava', cambio: -1 };
  if (k === 'x') return { tipo: 'octava', cambio: 1 };
  return k in PIANO ? { tipo: 'nota', semitonos: PIANO[k] } : null;
}

/** El Do donde empieza el teclado, en una octava que el instrumento cubra. */
export function doDeOctava(base: number, octava: number, rango: [number, number]): number {
  const doBase = base - (((base % 12) + 12) % 12);
  let n = doBase + octava * 12;
  while (n < rango[0] - 12) n += 12;
  while (n > rango[1]) n -= 12;
  return n;
}
