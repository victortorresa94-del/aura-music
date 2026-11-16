/**
 * El código de acceso, en el lado del móvil.
 *
 * Si el servidor tiene candado (AURA_MUSIC_CODIGO), las rutas que gastan
 * dinero piden el código en una cabecera. Se escribe una vez en el productor
 * y se queda guardado en este móvil. Ver src/lib/servidor/acceso.ts.
 */

export const CABECERA_CODIGO = 'x-aura-music-codigo';
const CLAVE = 'aura-music:codigo';

// Si el almacenamiento falla (modo privado, sin espacio), el código vive al
// menos mientras la pestaña esté abierta: si no, se pediría en cada pedido.
let enMemoria = '';

export function leerCodigo(): string {
  try {
    return window.localStorage.getItem(CLAVE) ?? enMemoria;
  } catch {
    return enMemoria;
  }
}

export function guardarCodigo(codigo: string) {
  const limpio = codigo.normalize('NFC').trim();
  enMemoria = limpio;
  try {
    if (limpio) window.localStorage.setItem(CLAVE, limpio);
    else window.localStorage.removeItem(CLAVE);
  } catch {
    /* se queda en memoria */
  }
}

/**
 * Las cabeceras de cualquier petición a /api/musico o /api/productor. El
 * código va codificado: una cabecera HTTP no admite tildes ni eñes tal cual.
 */
export function cabecerasDeAcceso(
  extra: Record<string, string> = {},
  codigo: string = leerCodigo(),
): Record<string, string> {
  return codigo ? { ...extra, [CABECERA_CODIGO]: encodeURIComponent(codigo) } : extra;
}

/** Pregunta al servidor si el código vale, sin gastar nada. */
export async function comprobarCodigo(codigo: string): Promise<'vale' | 'no-vale' | 'sin-red'> {
  try {
    const respuesta = await fetch('/api/acceso', {
      method: 'POST',
      headers: cabecerasDeAcceso({}, codigo.normalize('NFC').trim()),
    });
    if (respuesta.status === 401) return 'no-vale';
    return respuesta.ok ? 'vale' : 'sin-red';
  } catch {
    return 'sin-red';
  }
}

/** El error que se enseña cuando el servidor pide código y no lo hay (o no vale). */
export class FaltaCodigo extends Error {
  constructor() {
    super('Hace falta el código de acceso. Escríbelo arriba y lo vuelvo a intentar.');
    this.name = 'FaltaCodigo';
  }
}
