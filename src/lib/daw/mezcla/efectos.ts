/**
 * Los números de cada efecto, sin Web Audio: qué umbral lleva el compresor
 * con un 40 %, qué curva tiene la saturación, cuánto dura el eco a 96 BPM.
 * Separado del grafo para poder probarlo sin navegador.
 */

import type { DivisionEco } from './tipos';

/* -------------------------------------------------------------------------- */
/* Compresor                                                                   */
/* -------------------------------------------------------------------------- */

export interface ParametrosCompresor {
  umbral: number;
  rodilla: number;
  ratio: number;
  ataque: number;
  relajacion: number;
  /**
   * Ganancia lineal detrás del compresor. El `DynamicsCompressorNode` sube
   * él solo la señal comprimida (la especificación lo llama «makeup gain») y
   * con un 80 % la pista saltaba 12 dB por encima del resto. Aquí se quita
   * esa subida y se deja una pequeña, de 2 dB como mucho.
   */
  compensacion: number;
}

const dbALin = (db: number) => 10 ** (db / 20);
const linADb = (x: number) => 20 * Math.log10(Math.max(x, 1e-12));

/**
 * La curva estática del compresor, tal cual la define la especificación de
 * Web Audio y la implementan Chrome, Safari y Firefox (el mismo código de
 * origen): lineal hasta el umbral, una rodilla exponencial y la recta de la
 * ratio. Devuelve la salida lineal para una entrada lineal.
 */
export function curvaCompresor(x: number, umbralDb: number, rodillaDb: number, ratio: number): number {
  const umbral = dbALin(umbralDb);
  if (x < umbral) return x;
  const rodilla = (entrada: number, k: number) =>
    entrada < umbral ? entrada : umbral + (1 - Math.exp(-k * (entrada - umbral))) / k;
  const finRodillaDb = umbralDb + rodillaDb;
  const finRodilla = dbALin(finRodillaDb);

  // La k de la rodilla es la que deja la pendiente en 1/ratio justo al final
  // de la rodilla. Se busca igual que en el navegador: 15 pasos de bisección
  // geométrica entre 0,1 y 10 000.
  const pendiente = (en: number, k: number) => {
    if (en < umbral) return 1;
    const en2 = en * 1.001;
    return (linADb(rodilla(en2, k)) - linADb(rodilla(en, k))) / (linADb(en2) - linADb(en));
  };
  let min = 0.1;
  let max = 10000;
  let k = 5;
  for (let i = 0; i < 15; i++) {
    if (pendiente(finRodilla, k) < 1 / ratio) max = k;
    else min = k;
    k = Math.sqrt(min * max);
  }

  if (x < finRodilla) return rodilla(x, k);
  const yFinDb = linADb(rodilla(finRodilla, k));
  return dbALin(yFinDb + (linADb(x) - finRodillaDb) / ratio);
}

/** La subida automática que mete el navegador, en dB. */
export function subidaAutomaticaDb(umbralDb: number, rodillaDb: number, ratio: number): number {
  const plena = curvaCompresor(1, umbralDb, rodillaDb, ratio);
  return 0.6 * -linADb(plena);
}

/**
 * Cantidad 0 = el compresor no hace nada (ratio 1, umbral 0 dB): una pista
 * sin tocar suena igual que antes del mezclador. Al subir, baja el umbral,
 * sube la ratio y el ataque se hace más rápido.
 */
export function parametrosCompresor(cantidad: number): ParametrosCompresor {
  const c = Math.min(1, Math.max(0, cantidad));
  if (c <= 0) return { umbral: 0, rodilla: 0, ratio: 1, ataque: 0.012, relajacion: 0.25, compensacion: 1 };
  const umbral = -8 - 22 * c;
  const ratio = 1.5 + 6.5 * c;
  const rodilla = 10 - 6 * c;
  const subida = subidaAutomaticaDb(umbral, rodilla, ratio);
  return {
    umbral,
    rodilla,
    ratio,
    ataque: 0.012 - 0.008 * c,
    relajacion: 0.25 - 0.1 * c,
    compensacion: dbALin(-subida + 2 * c),
  };
}

/* -------------------------------------------------------------------------- */
/* Saturación                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Margen de la curva. El `WaveShaperNode` recorta todo lo que pase de ±1, así
 * que se le entra con la señal dividida entre 4 y la curva la devuelve a su
 * nivel: hasta +12 dBFS pasa sin recortar. Con la saturación a cero la curva
 * es una recta y la pista suena como antes.
 */
export const MARGEN_SATURACION = 4;
const PUNTOS_CURVA = 2049;

/**
 * Mezcla de la señal limpia con una tanh normalizada: a volumen bajo la
 * ganancia es 1 (no sube el ruido ni las colas) y los picos se redondean.
 * Así «más saturación» suena más densa, no solo más fuerte.
 */
export function saturar(x: number, cantidad: number): number {
  const a = Math.min(1, Math.max(0, cantidad));
  if (a === 0) return x;
  const k = 1 + 5 * a;
  return (1 - a) * x + (a * Math.tanh(k * x)) / k;
}

export function curvaSaturacion(cantidad: number): Float32Array<ArrayBuffer> {
  const curva = new Float32Array(PUNTOS_CURVA);
  for (let i = 0; i < PUNTOS_CURVA; i++) {
    const u = (i / (PUNTOS_CURVA - 1)) * 2 - 1;
    curva[i] = saturar(u * MARGEN_SATURACION, cantidad);
  }
  return curva;
}

/* -------------------------------------------------------------------------- */
/* Eco                                                                         */
/* -------------------------------------------------------------------------- */

const PULSOS: Record<DivisionEco, number> = { '1/8': 0.5, '1/4': 1, '1/4.': 1.5 };
export const ECO_MAX_SEGUNDOS = 2.9;

/** El eco va a tempo: a 100 BPM, una negra son 0,6 s. */
export function segundosDeEco(bpm: number, division: DivisionEco): number {
  const pulso = 60 / Math.max(20, Math.min(400, bpm || 100));
  return Math.min(ECO_MAX_SEGUNDOS, Math.max(0.03, pulso * (PULSOS[division] ?? 1)));
}

/* -------------------------------------------------------------------------- */
/* Ecualizador                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Dónde actúa cada banda. Graves en estantería a 120 Hz (el cuerpo, el
 * retumbe de la caja de una guitarra), medios en campana ancha a 1 kHz (el
 * cartón, la nariz) y agudos en estantería a 6 kHz (el aire, la púa).
 */
export const BANDAS = {
  graves: { frecuencia: 120 },
  medios: { frecuencia: 1000, q: 0.8 },
  agudos: { frecuencia: 6000 },
} as const;

/**
 * De la posición del envío (0 a 1) a ganancia. Medido en el navegador con
 * una sala: a tope, la reverb queda unos 5 dB por debajo de la pista seca
 * (muy mojado); con el 20 % de «Voz cálida», unos 16 dB por debajo, que se
 * nota sin ensuciar. Una curva cuadrática dejaba el 20 % a −35 dB: no se oía.
 */
export function gananciaDeEnvio(envio: number): number {
  const e = Math.min(1, Math.max(0, envio));
  return e === 0 ? 0 : e ** 0.8;
}

/* -------------------------------------------------------------------------- */
/* Latencia de la cadena                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Dónde cae el golpe en la respuesta a un impulso: es la latencia de la
 * cadena en muestras. El compresor del navegador mira 6 ms por delante y el
 * sobremuestreo de la saturación añade un poco más; medirlo en vez de
 * suponerlo vale para cualquier navegador.
 */
export function indiceDelPico(respuesta: Float32Array): number {
  let indice = 0;
  let maximo = 0;
  for (let i = 0; i < respuesta.length; i++) {
    const a = Math.abs(respuesta[i]);
    if (a > maximo) {
      maximo = a;
      indice = i;
    }
  }
  return indice;
}
