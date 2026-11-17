/**
 * Ruido rosa (1/f) con semilla.
 *
 * Un batería de verdad no se equivoca al azar en cada golpe: si va un poco por
 * delante, va por delante durante varios golpes seguidos y luego vuelve. Ese
 * desvío con memoria es ruido 1/f, y se nota: el mismo ±10 ms con ruido blanco
 * suena a máquina estropeada; con ruido rosa suena a alguien tocando
 * (Hennig y otros, «The Nature and Perception of Fluctuations in Human
 * Musical Rhythms», PLoS ONE, 2011).
 *
 * Se genera con el algoritmo de Voss-McCartney: varias fuentes de ruido
 * blanco, cada una cambiando la mitad de veces que la anterior, sumadas.
 */

import { aleatorio } from '../teoria';

const FILAS = 8;

/**
 * Devuelve `n` valores de ruido rosa, centrados en 0 y escalados para que
 * casi todos caigan entre -1 y 1. La misma semilla da la misma serie.
 */
export function ruidoRosa(n: number, semilla: number): Float32Array {
  const azar = aleatorio(semilla);
  const filas = new Float32Array(FILAS);
  for (let f = 0; f < FILAS; f++) filas[f] = azar() * 2 - 1;
  let suma = filas.reduce((a, b) => a + b, 0);

  const salida = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    // La fila que cambia es la del bit más bajo que pasa a 1: la primera
    // cambia en cada paso, la segunda cada dos, la tercera cada cuatro…
    const contador = i + 1;
    let fila = 0;
    while (fila < FILAS - 1 && ((contador >> fila) & 1) === 0) fila++;
    suma -= filas[fila];
    filas[fila] = azar() * 2 - 1;
    suma += filas[fila];
    // Un término blanco más, para que el paso a paso no sea escalonado.
    const blanco = azar() * 2 - 1;
    salida[i] = (suma + blanco) / Math.sqrt(FILAS + 1) / 1.1;
  }
  return salida;
}
