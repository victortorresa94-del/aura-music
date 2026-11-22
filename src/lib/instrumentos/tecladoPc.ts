/**
 * El teclado del ordenador como instrumento, para tocar y grabar sin
 * pantalla táctil (como el «teclado musical» de GarageBand), y con las
 * teclas que tú elijas («Asignar teclas», en el panel «Sonido»).
 *
 * - Batería: lo que más se toca, en la fila de en medio. Bombo, aro, caja y
 *   palmas en A S D F; charles y platillos en Q W E R; toms y ride en
 *   1 2 3 4; la percusión pequeña en Z X C V.
 * - Lo demás: la fila A S D F G H J K L Ñ son las blancas y W E T Y U O P
 *   las negras, como un piano; Z y X bajan y suben de octava.
 *
 * Un mapa dice qué toca cada tecla: en la batería, el número de pad (de
 * arriba abajo, como la rejilla); en lo demás, semitonos desde el Do de la
 * octava elegida (así una tecla asignada sigue en su sitio al cambiar de
 * octava). Puro: se prueba sin navegador.
 */

/** Qué toca cada tecla (en minúscula). */
export type MapaTeclas = Record<string, number>;

/** Cada grupo recuerda sus teclas: todos los kits comparten las de los pads. */
export type GrupoTeclas = 'pads' | 'teclado' | 'bajo';

/** Pads, de arriba abajo: percusión, toms y ride, charles y platillos, bombo-aro-caja-palmas. */
const PADS: MapaTeclas = Object.fromEntries(
  [['z', 'x', 'c', 'v'], ['1', '2', '3', '4'], ['q', 'w', 'e', 'r'], ['a', 's', 'd', 'f']].flatMap((fila, f) =>
    fila.map((tecla, c) => [tecla, f * 4 + c]),
  ),
);

/** Semitonos desde el Do de la octava elegida. */
const PIANO: MapaTeclas = {
  a: 0, w: 1, s: 2, e: 3, d: 4, f: 5, t: 6, g: 7, y: 8, h: 9, u: 10, j: 11,
  k: 12, o: 13, l: 14, p: 15, 'ñ': 16, ';': 16,
};

export function mapaPorDefecto(grupo: GrupoTeclas): MapaTeclas {
  return { ...(grupo === 'pads' ? PADS : PIANO) };
}

export type AccionTecla =
  | { tipo: 'pad'; indice: number }
  | { tipo: 'nota'; semitonos: number }
  | { tipo: 'octava'; cambio: -1 | 1 }
  | null;

/**
 * Qué hace una tecla con el instrumento abierto. Sin mapa, las de siempre.
 * Z y X cambian de octava salvo que les hayas dado una nota.
 */
export function accionDeTecla(tecla: string, esBateria: boolean, mapa?: MapaTeclas | null): AccionTecla {
  const k = tecla.toLowerCase();
  const m = mapa ?? mapaPorDefecto(esBateria ? 'pads' : 'teclado');
  if (esBateria) return k in m ? { tipo: 'pad', indice: m[k] } : null;
  if (k in m) return { tipo: 'nota', semitonos: m[k] };
  if (k === 'z') return { tipo: 'octava', cambio: -1 };
  if (k === 'x') return { tipo: 'octava', cambio: 1 };
  return null;
}

/**
 * ¿Sirve esta tecla para asignarla? Un solo carácter que se escriba, sin
 * el espacio (escucha) ni lo que manda (Intro graba, Escape cierra).
 */
export function teclaAsignable(tecla: string): boolean {
  return tecla.length === 1 && tecla !== ' ';
}

/**
 * Da `tecla` a `valor` (un pad o unos semitonos). Esa tecla deja lo que
 * tocaba y ese pad o nota deja la tecla que tenía: una tecla por cosa, para
 * que lo que se ve escrito sea lo que suena.
 */
export function asignar(mapa: MapaTeclas, tecla: string, valor: number): MapaTeclas {
  const k = tecla.toLowerCase();
  const nuevo: MapaTeclas = {};
  for (const [t, v] of Object.entries(mapa)) if (t !== k && v !== valor) nuevo[t] = v;
  nuevo[k] = valor;
  return nuevo;
}

/** La tecla que toca cada pad o nota (para escribirla encima). */
export function etiquetas(mapa: MapaTeclas): Map<number, string> {
  const salida = new Map<number, string>();
  for (const [tecla, valor] of Object.entries(mapa)) {
    // Con dos para lo mismo (la ñ y el punto y coma), se queda la primera.
    if (!salida.has(valor)) salida.set(valor, tecla.toUpperCase());
  }
  return salida;
}

/** El Do donde empieza el teclado, en una octava que el instrumento cubra. */
export function doDeOctava(base: number, octava: number, rango: [number, number]): number {
  const doBase = base - (((base % 12) + 12) % 12);
  let n = doBase + octava * 12;
  while (n < rango[0] - 12) n += 12;
  while (n > rango[1]) n -= 12;
  return n;
}

/* -------------------------------------------------------------------------- */
/* Guardado                                                                    */
/* -------------------------------------------------------------------------- */

const clave = (grupo: GrupoTeclas) => `aura-music:teclas:${grupo}`;

/** Las teclas propias de un grupo, o null si van las de siempre. */
export function leerTeclas(grupo: GrupoTeclas): MapaTeclas | null {
  try {
    const crudo = window.localStorage.getItem(clave(grupo));
    if (!crudo) return null;
    const mapa = JSON.parse(crudo) as unknown;
    if (!mapa || typeof mapa !== 'object') return null;
    const limpio: MapaTeclas = {};
    for (const [t, v] of Object.entries(mapa as Record<string, unknown>)) {
      if (teclaAsignable(t) && typeof v === 'number' && Number.isInteger(v)) limpio[t] = v;
    }
    return Object.keys(limpio).length ? limpio : null;
  } catch {
    return null;
  }
}

export function guardarTeclas(grupo: GrupoTeclas, mapa: MapaTeclas | null) {
  try {
    if (mapa) window.localStorage.setItem(clave(grupo), JSON.stringify(mapa));
    else window.localStorage.removeItem(clave(grupo));
  } catch {
    /* sin almacenamiento: vale para esta sesión */
  }
}
