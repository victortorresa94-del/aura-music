/**
 * La cola de lo que falta por subir. Pura, para poder probarla sin red.
 *
 * Cada entrada es una clave («proyecto:prj_x», «cerebro»), no una orden: quien
 * la atiende mira en ese momento qué hay que hacer. Así pedir dos veces lo
 * mismo es una sola tarea, y una idea que cambia diez veces mientras arrastras
 * un fader sube una vez.
 *
 * Sin red, la entrada falla y espera cada vez más (2 s, 4 s, 8 s… hasta 5
 * min); al volver la cobertura se reintenta todo al momento. La cola se guarda
 * con el estado de la cuenta, así que lo pendiente sobrevive a cerrar la app.
 */

import type { EntradaCola } from './tipos';

/** Un cambio que llega se agrupa con los siguientes durante este rato. */
export const AGRUPAR_MS = 2500;
/** Pero nunca se aplaza más que esto desde el primero, aunque sigas tocando. */
export const ESPERA_MAXIMA_MS = 20_000;
const REINTENTO_MIN_MS = 2000;
const REINTENTO_MAX_MS = 5 * 60_000;

export function claveDeProyecto(id: string): string {
  return `proyecto:${id}`;
}

export const CLAVE_CEREBRO = 'cerebro';

export function idDeClave(clave: string): string | null {
  return clave.startsWith('proyecto:') ? clave.slice('proyecto:'.length) : null;
}

/** Espera antes del intento número `intentos` (1, 2, 3…). */
export function esperaTrasFallo(intentos: number): number {
  return Math.min(REINTENTO_MAX_MS, REINTENTO_MIN_MS * 2 ** Math.max(0, intentos - 1));
}

/**
 * Pide (o vuelve a pedir) una clave. Con `retraso`, se agrupa con lo que venga
 * después, hasta `ESPERA_MAXIMA_MS` desde la primera vez. Si estaba esperando
 * tras un fallo, se respeta esa espera: la red no ha vuelto por guardar.
 */
export function encolar(cola: EntradaCola[], clave: string, ahora: number, retraso = 0): EntradaCola[] {
  const existente = cola.find((e) => e.clave === clave);
  if (!existente) {
    return [...cola, { clave, desde: ahora, cuando: ahora + retraso, intentos: 0, version: 1 }];
  }
  const cuando =
    existente.intentos > 0
      ? existente.cuando
      : Math.min(Math.max(existente.cuando, ahora + retraso), existente.desde + ESPERA_MAXIMA_MS);
  return cola.map((e) => (e === existente ? { ...e, cuando, version: e.version + 1 } : e));
}

/** La siguiente que toca: la que antes se pueda, y entre iguales la más antigua. */
export function siguiente(cola: EntradaCola[], ahora: number): EntradaCola | null {
  let mejor: EntradaCola | null = null;
  for (const e of cola) {
    if (e.cuando > ahora) continue;
    if (!mejor || e.cuando < mejor.cuando || (e.cuando === mejor.cuando && e.desde < mejor.desde)) mejor = e;
  }
  return mejor;
}

/** Cuánto falta para que toque alguna (`null` si la cola está vacía). */
export function proximaEspera(cola: EntradaCola[], ahora: number): number | null {
  if (cola.length === 0) return null;
  return Math.max(0, Math.min(...cola.map((e) => e.cuando)) - ahora);
}

/**
 * Hecha. Solo sale de la cola si nadie la ha vuelto a pedir mientras se
 * hacía (si la idea cambió durante la subida, queda para otra vuelta).
 */
export function hecha(cola: EntradaCola[], clave: string, version: number): EntradaCola[] {
  return cola
    .filter((e) => !(e.clave === clave && e.version === version))
    .map((e) => (e.clave === clave ? { ...e, intentos: 0, error: undefined } : e));
}

export function fallida(cola: EntradaCola[], clave: string, ahora: number, error: string): EntradaCola[] {
  return cola.map((e) => {
    if (e.clave !== clave) return e;
    const intentos = e.intentos + 1;
    return { ...e, intentos, cuando: ahora + esperaTrasFallo(intentos), error };
  });
}

/** Ha vuelto la red, o has tocado «Reintentar»: todo se puede intentar ya. */
export function reintentarYa(cola: EntradaCola[], ahora: number): EntradaCola[] {
  return cola.map((e) => ({ ...e, cuando: Math.min(e.cuando, ahora) }));
}

export function quitar(cola: EntradaCola[], clave: string): EntradaCola[] {
  return cola.filter((e) => e.clave !== clave);
}
