/**
 * Lo que cuesta cada cosa en créditos de aura.
 *
 * Copia de la regla de aura Studio (`aura-studio/api/_precios.ts`): coste del
 * proveedor × 3,75, a 0,05 € el crédito, 0,92 € por dólar, redondeado hacia
 * arriba y nunca menos de 1. Los costes por modelo son los de `usdMusica`.
 * Si allí cambia un precio, cambia aquí: lo que dice el botón tiene que ser
 * lo que cobra el monedero. Quien cobra de verdad es aura Studio; esto solo
 * lo enseña antes.
 */

import type { MotorId, Receta } from './tipos';

export const USD_EUR = 0.92;
export const MULTIPLICADOR = 3.75;
export const EUR_POR_CREDITO = 0.05;

/** Lo mismo que `usdMusica` de aura Studio: 30 s si no viene, entre 5 y 180. */
export function usdMusica(motor: MotorId, segundosPedidos: number): number {
  const n = Number(segundosPedidos);
  const s = Math.max(5, Math.min(180, Number.isFinite(n) ? n : 30));
  switch (motor) {
    case 'lyria-3.5':
      return 0.1;
    case 'minimax-music-3':
      return 0.002 * s;
    case 'ace-step':
      return 0.0002 * s;
    case 'lyria3-base':
      return 0.04;
    case 'falso':
      return 0;
    case 'lyria3':
    default:
      return 0.08;
  }
}

export function creditosDeCosteEur(eur: number): number {
  if (eur <= 0) return 0;
  return Math.max(1, Math.ceil((eur * MULTIPLICADOR) / EUR_POR_CREDITO - 1e-9));
}

/**
 * Los segundos que se le piden al motor. Un paisaje no se genera entero: se
 * genera un trozo pensado para repetirse (como mucho 180 s) y el móvil lo
 * alarga gratis.
 */
export function segundosAGenerar(receta: Pick<Receta, 'tipo' | 'duracionSeg'>): number {
  if (receta.tipo === 'paisaje') return 150;
  return Math.max(30, Math.min(180, Math.round(receta.duracionSeg)));
}

/** Créditos de generar una pieza con esta receta. */
export function creditosDeReceta(receta: Pick<Receta, 'tipo' | 'duracionSeg' | 'motor'>): number {
  return creditosDeCosteEur(usdMusica(receta.motor, segundosAGenerar(receta)) * USD_EUR);
}

/** Un boceto de 30 s para comprobar el rumbo antes de la entera (Lyria 3 Clip). */
export function creditosDeBoceto(): number {
  return creditosDeCosteEur(usdMusica('lyria3-base', 30) * USD_EUR);
}

/** Lo que se dice en un botón: «6 créditos», «1 crédito», «Gratis». */
export function textoCreditos(creditos: number): string {
  if (creditos <= 0) return 'Gratis';
  return creditos === 1 ? '1 crédito' : `${creditos} créditos`;
}
