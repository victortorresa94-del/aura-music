/**
 * Una idea como documento de Firestore, y de vuelta.
 *
 * La idea viaja como texto JSON y no como campos de Firestore, por tres
 * razones: Firestore no admite listas dentro de listas (las notas de una
 * pista tocada podrían llevarlas algún día), tumba la escritura entera si un
 * campo vale `undefined`, y así lo que se baja es exactamente lo que se subió.
 * Un documento no puede pasar de 1 MiB: si el JSON se acerca, va comprimido
 * (gzip, con fflate, que ya usan las copias en zip).
 */

import { gunzipSync, gzipSync, strFromU8, strToU8 } from 'fflate';
import { z } from 'zod';
import type { Project } from '@/lib/daw/types';
import type { Dispositivo, ProyectoRemoto } from './tipos';

/** Por encima de esto se comprime: deja sitio de sobra a los demás campos del documento. */
export const LIMITE_JSON = 600 * 1024;

export class ErrorDeDocumento extends Error {}

export type Empaquetado = { json: string; gz?: undefined } | { gz: Uint8Array; json?: undefined };

export function empaquetar(proyecto: Project): Empaquetado {
  const json = JSON.stringify(proyecto);
  if (json.length <= LIMITE_JSON) return { json };
  const gz = gzipSync(strToU8(json), { level: 9 });
  if (gz.length > 900 * 1024) throw new ErrorDeDocumento('La idea es demasiado grande para la nube');
  return { gz };
}

/* Lo mínimo para fiarse de lo que llega. Abierto a campos nuevos
   (`looseObject`), como en las copias: una versión más nueva de la app puede
   traer cosas que esta no conoce y no se pueden perder. */
const numero = z.number().refine(Number.isFinite);
const ProyectoSchema = z.looseObject({
  id: z.string().min(1),
  name: z.string(),
  bpm: numero,
  createdAt: numero,
  updatedAt: numero,
  tracks: z.array(
    z.looseObject({
      id: z.string().min(1),
      name: z.string(),
      clip: z.looseObject({ bufferId: z.string().min(1), start: numero, offset: numero, duration: numero, repeats: numero }),
      volume: numero,
      muted: z.boolean(),
      soloed: z.boolean(),
      sourceDuration: numero,
      createdAt: numero,
    }),
  ),
});

export function desempaquetar(datos: { json?: unknown; gz?: unknown }): Project {
  let texto: string;
  if (typeof datos.json === 'string') texto = datos.json;
  else if (datos.gz instanceof Uint8Array) texto = strFromU8(gunzipSync(datos.gz));
  else throw new ErrorDeDocumento('El documento no trae la idea');
  let crudo: unknown;
  try {
    crudo = JSON.parse(texto);
  } catch {
    throw new ErrorDeDocumento('La idea de la nube está rota');
  }
  const leido = ProyectoSchema.safeParse(crudo);
  if (!leido.success) throw new ErrorDeDocumento('La idea de la nube no tiene la forma esperada');
  return leido.data as unknown as Project;
}

const num = (v: unknown, otro = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : otro);

/**
 * Un documento leído de Firestore (ya con los Bytes pasados a Uint8Array y
 * la hora del servidor a milisegundos) → lo que entiende el motor. Si la idea
 * no se puede leer, se trata como si no estuviera: nunca pisa nada de aquí.
 */
export function aProyectoRemoto(id: string, d: Record<string, unknown>, servidorEn: number): ProyectoRemoto | null {
  const borrado = d.borrado === true;
  let proyecto: Project | null = null;
  if (!borrado) {
    try {
      proyecto = desempaquetar({ json: d.json, gz: d.gz });
    } catch {
      return null;
    }
  }
  const disp = d.dispositivo as Partial<Dispositivo> | undefined;
  const huerfanos: Record<string, number> = {};
  if (d.huerfanos && typeof d.huerfanos === 'object') {
    for (const [k, v] of Object.entries(d.huerfanos as Record<string, unknown>)) if (typeof v === 'number') huerfanos[k] = v;
  }
  return {
    id,
    updatedAt: num(d.updatedAt, proyecto?.updatedAt ?? 0),
    borrado,
    buffers: Array.isArray(d.buffers) ? d.buffers.filter((b): b is string => typeof b === 'string') : [],
    dispositivo: disp && typeof disp.id === 'string' ? { id: disp.id, nombre: String(disp.nombre ?? '') } : null,
    proyecto,
    servidorEn,
    huerfanos,
    audioBorrado: d.audioBorrado === true,
  };
}
