/**
 * Cuánto ocupa la app en el móvil y qué pasa cuando no cabe más.
 *
 * `navigator.storage.estimate()` da lo que usa el origen entero (ideas, la
 * copia de la app, las muestras de los instrumentos) y la cuota que el
 * navegador nos deja. Es una estimación a propósito: los navegadores la
 * redondean para no dar pistas a quien quiera identificar el equipo. Basta
 * para saber si vas holgado o al límite.
 */

export interface Espacio {
  usado: number;
  cuota: number;
  /** El navegador ha prometido no borrarlo por su cuenta (`persist()`). */
  protegido: boolean | null;
}

/** A partir de aquí se avisa aunque todavía quepa: una toma de cinco minutos son 30 MB. */
export const UMBRAL_CASI_LLENO = 0.9;
const MARGEN_MINIMO = 80 * 1024 * 1024;

export async function medirEspacio(): Promise<Espacio | null> {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) return null;
  try {
    const { usage = 0, quota = 0 } = await navigator.storage.estimate();
    const protegido = navigator.storage.persisted ? await navigator.storage.persisted() : null;
    return { usado: usage, cuota: quota, protegido };
  } catch {
    return null;
  }
}

export type NivelEspacio = 'holgado' | 'casi-lleno' | 'lleno';

/** Casi lleno: más del 90 % usado, o menos de 80 MB libres, lo que llegue antes. */
export function nivelDeEspacio({ usado, cuota }: Pick<Espacio, 'usado' | 'cuota'>): NivelEspacio {
  if (cuota <= 0) return 'holgado';
  const libre = cuota - usado;
  if (libre <= 0) return 'lleno';
  if (usado / cuota >= UMBRAL_CASI_LLENO || libre < MARGEN_MINIMO) return 'casi-lleno';
  return 'holgado';
}

/**
 * El navegador avisa de que no cabe con nombres distintos según dónde falle:
 * `QuotaExceededError` casi siempre, y Firefox antiguo con su propio código.
 * Safari, cuando IndexedDB se queda sin sitio, aborta la transacción con un
 * `UnknownError` que dice «quota» en el mensaje.
 */
export function esCuotaLlena(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const { name, message, code } = error as { name?: string; message?: string; code?: number };
  if (name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED') return true;
  if (code === 22 || code === 1014) return true;
  return typeof message === 'string' && /quota/i.test(message);
}

/** Bytes en castellano: «812 KB», «84,3 MB», «2,1 GB». */
export function formatoBytes(bytes: number): string {
  const kb = 1024;
  const mb = kb * 1024;
  const gb = mb * 1024;
  const fmt = (n: number, decimales: number) =>
    n.toLocaleString('es-ES', { minimumFractionDigits: decimales, maximumFractionDigits: decimales });
  if (bytes < kb) return `${Math.max(0, Math.round(bytes))} B`;
  if (bytes < mb) return `${fmt(bytes / kb, 0)} KB`;
  if (bytes < gb) return `${fmt(bytes / mb, bytes < 10 * mb ? 1 : 0)} MB`;
  return `${fmt(bytes / gb, bytes < 10 * gb ? 1 : 0)} GB`;
}

/**
 * Nombre del evento que lanza `storage.ts` cuando una escritura no cabe. Así
 * el aviso sale igual venga de una toma, de una pista del músico o de una
 * importación, sin que cada sitio tenga que acordarse de avisar.
 */
export const EVENTO_ALMACENAMIENTO_LLENO = 'aura-music:almacenamiento-lleno';
