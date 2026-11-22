/**
 * Teclados MIDI (un Roland GO:KEYS, un controlador USB) tocando los
 * instrumentos de Aura Music.
 *
 * El navegador entrega los mensajes en crudo (Web MIDI: Chrome y Edge en el
 * PC, Chrome en Android; Safari en iPhone no lo tiene). Aquí solo se traducen
 * a lo que entiende el atril: qué nota, con qué fuerza, y el pedal. Va en
 * funciones puras para poder probarlo sin teclado.
 */

export type MensajeMidi =
  | { tipo: 'nota'; nota: number; vel: number; canal: number }
  | { tipo: 'suelta'; nota: number; canal: number }
  | { tipo: 'pedal'; abajo: boolean; canal: number }
  | { tipo: 'otro' };

/** Traduce un mensaje MIDI de canal (3 bytes) a lo que le importa al atril. */
export function leerMidi(datos: ArrayLike<number>): MensajeMidi {
  if (!datos || datos.length < 2) return { tipo: 'otro' };
  const estado = datos[0] & 0xf0;
  const canal = datos[0] & 0x0f;
  const d1 = datos[1] ?? 0;
  const d2 = datos[2] ?? 0;
  // Nota con fuerza 0 es «soltar»: muchos teclados nunca mandan el 0x80.
  if (estado === 0x90 && d2 > 0) return { tipo: 'nota', nota: d1, vel: velocidad(d2), canal };
  if (estado === 0x80 || (estado === 0x90 && d2 === 0)) return { tipo: 'suelta', nota: d1, canal };
  // Control 64: el pedal de sostenido. A partir de la mitad, pisado.
  if (estado === 0xb0 && d1 === 64) return { tipo: 'pedal', abajo: d2 >= 64, canal };
  return { tipo: 'otro' };
}

/**
 * Fuerza MIDI (1-127) a la fuerza del atril (0-1). Una curva suave hacia
 * arriba: con la lineal, tocar normal en un teclado ligero sonaba flojo.
 */
export function velocidad(v: number): number {
  return Math.max(0.05, Math.min(1, Math.pow(Math.max(1, v) / 127, 0.8)));
}

export interface InstrumentoParaMidi {
  pads?: { nota: number }[];
  rango: [number, number];
}

/**
 * La nota que suena en el instrumento elegido.
 *   · Batería: si la tecla es la nota General MIDI de un pad, ese pad; si
 *     no, se reparten los 16 pads por las teclas desde el Do 2 (36), así
 *     cualquier teclado los toca todos.
 *   · Lo demás: la misma nota, subida o bajada de octava si se sale del
 *     registro del instrumento.
 */
export function notaParaInstrumento(def: InstrumentoParaMidi, nota: number): number {
  if (def.pads && def.pads.length > 0) {
    if (def.pads.some((pad) => pad.nota === nota)) return nota;
    const indice = (((nota - 36) % def.pads.length) + def.pads.length) % def.pads.length;
    return def.pads[indice].nota;
  }
  let n = nota;
  const [bajo, alto] = def.rango;
  while (n < bajo) n += 12;
  while (n > alto) n -= 12;
  return n < bajo ? bajo : n;
}
