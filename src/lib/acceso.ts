/**
 * El código de acceso, en el lado del móvil.
 *
 * Si el servidor tiene candado (AURA_MUSIC_CODIGO), las rutas que gastan
 * dinero piden el código en una cabecera. Se escribe una vez en el productor
 * y se queda guardado en este móvil. Ver src/lib/servidor/acceso.ts.
 */

export const CABECERA_CODIGO = 'x-aura-music-codigo';
const CLAVE = 'aura-music:codigo';

export function leerCodigo(): string {
  try {
    return window.localStorage.getItem(CLAVE) ?? '';
  } catch {
    return '';
  }
}

export function guardarCodigo(codigo: string) {
  try {
    if (codigo.trim()) window.localStorage.setItem(CLAVE, codigo.trim());
    else window.localStorage.removeItem(CLAVE);
  } catch {
    /* sin almacenamiento, el código dura lo que la pestaña */
  }
}

/** Las cabeceras de cualquier petición a /api/musico o /api/productor. */
export function cabecerasDeAcceso(extra: Record<string, string> = {}): Record<string, string> {
  const codigo = leerCodigo();
  return codigo ? { ...extra, [CABECERA_CODIGO]: codigo } : extra;
}

/** El error que se enseña cuando el servidor pide código y no lo hay (o no vale). */
export class FaltaCodigo extends Error {
  constructor() {
    super('Hace falta el código de acceso. Escríbelo en el productor.');
    this.name = 'FaltaCodigo';
  }
}
