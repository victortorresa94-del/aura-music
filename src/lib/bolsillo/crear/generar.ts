/**
 * Generar una pieza: crea la canción (o la versión nueva de una que ya
 * existe) en el almacén, la pide al motor, guarda el audio en el móvil y la
 * marca como lista. CONTRATO: lo implementa el agente de Crear (ola 1); lo
 * usan también Paisajes y Playlists.
 *
 * - Escribe la versión en estado `generando` ANTES de llamar al motor, con su
 *   `trabajo` en cuanto lo haya: si se cierra la app, se retoma sin pagar dos
 *   veces.
 * - Si la receta es un paisaje, el trozo generado pasa por
 *   `renderizarPaisaje` (src/lib/bolsillo/paisaje/render.ts) antes de guardarse.
 * - El audio se guarda en el móvil (`almacen().audios`) además de su URL.
 */

import type { Receta } from '../tipos';

export interface ResultadoGenerar {
  cancionId: string;
  versionId: string;
}

export interface DatosGenerar {
  titulo: string;
  porque?: string;
  /** Si viene, es una versión nueva de esa canción. */
  cancionId?: string;
  /** Qué cambia respecto a la anterior. */
  cambio?: string;
  /** Boceto de 30 s (Lyria 3 Clip) para comprobar el rumbo. */
  boceto?: boolean;
  /** Para enseñar el avance: «en cola», «generando», «guardando». */
  alAvanzar?: (fase: string) => void;
}

export async function generarCancion(_receta: Receta, _datos: DatosGenerar): Promise<ResultadoGenerar> {
  throw new Error('Crear todavía no está montado.');
}
