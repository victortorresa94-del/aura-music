/**
 * Los avisos entre el estudio y la nube. Son eventos de `window` para que la
 * nube se enganche sin que `storage.ts` ni el productor sepan que existe: si
 * no hay cuenta, nadie escucha y todo sigue igual que antes.
 */

/** `storage.saveProject` ha escrito una idea. `detail: { id }`. */
export const EVENTO_IDEA_GUARDADA = 'aura-music:idea-guardada';
/** `storage.deleteProject` ha borrado una idea. `detail: { id }`. */
export const EVENTO_IDEA_BORRADA = 'aura-music:idea-borrada';
/** El productor ha cambiado su cerebro en este dispositivo. */
export const EVENTO_CEREBRO_CAMBIADO = 'aura-music:cerebro-cambiado';
/** La nube ha traído un cerebro mezclado: el productor tiene que volver a leerlo. */
export const EVENTO_CEREBRO_DE_LA_NUBE = 'aura-music:cerebro-de-la-nube';

export function avisar(nombre: string, detalle?: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent(nombre, { detail: detalle }));
  } catch {
    /* sin CustomEvent (navegadores muy viejos): la nube se entera en la siguiente vuelta */
  }
}
