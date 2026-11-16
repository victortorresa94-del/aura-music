/**
 * Quién toca cuando se pide «con IA». Se decide por variables de entorno y
 * solo en el servidor: las claves no llegan nunca al móvil.
 *
 * Para añadir un proveedor nuevo: un fichero que implemente
 * `ProveedorDePistas` y una línea aquí. Nada más cambia.
 */

import { crearAceStep } from './acestep';
import type { ProveedorDePistas } from './tipos';

type Entorno = Record<string, string | undefined>;

export function proveedorActivo(env: Entorno = process.env): ProveedorDePistas | null {
  if (env.ACESTEP_API_URL) {
    return crearAceStep({
      url: env.ACESTEP_API_URL,
      clave: env.ACESTEP_API_KEY || undefined,
      modelo: env.ACESTEP_MODEL || 'acestep-v15-base',
      pasos: env.ACESTEP_PASOS ? Number(env.ACESTEP_PASOS) : undefined,
    });
  }
  return null;
}
