/**
 * Cuánto suena un paisaje: el modo normal y el modo cuidado.
 *
 * Las dos cifras, con su porqué (skill `audio-mixing-mastering`, tabla de
 * objetivos verificada el 10-jul-2026):
 *
 *   · Normal: −14 LUFS integrados, techo −1 dBTP. Es lo que recomienda
 *     Spotify para música y lo que ya usa el masterizado del estudio
 *     (`OBJETIVOS.plataformas`). Así un paisaje suena igual de fuerte que
 *     las canciones de la biblioteca y pasar de una a otro no da un susto.
 *
 *   · Cuidado: −23 LUFS integrados, techo −9 dBTP. −23 es el objetivo de
 *     EBU R 128 para programas (la radio y la tele de Europa), que cae
 *     dentro de lo que ATSC A/85 pide a los servicios de streaming (−23 a
 *     −27): un nivel pensado para escuchar largo rato sin cansar. Son 9 LU
 *     por debajo del modo normal, bastante más de la mitad de bajo al oído,
 *     y nadie ha medido que más bajo «ayude»: se elige por comodidad, no por
 *     salud. El techo de −9 dBTP deja como mucho 14 dB entre la media y un
 *     pico (lo que mide una música tranquila bien hecha): nada salta.
 *     Además, en cuidado ningún tramo de 3 s puede sonar más de 3 LU por
 *     encima de lo normal de la pieza (`nivelarSinSubidas`): si la base
 *     tiene un crescendo, se aplana despacio en vez de despertarte.
 *
 * Todo es invariante en el tiempo salvo el nivelador y el limitador, y los
 * dos se calculan sobre la vuelta como un CÍRCULO: la ganancia al final de
 * la vuelta empalma con la del principio, y el bucle sigue sin costura.
 *
 * Un paisaje en mono suena por los dos altavoces, así que se mide como mono
 * doble (+3,01 dB sobre un solo canal), igual que la opción `--dual-mono`
 * del medidor de la skill. Si no, un paisaje en mono saldría 3 dB más
 * fuerte que uno en estéreo con la misma cifra.
 *
 * Puro y sin navegador.
 */

import { masterizar, type ObjetivoSonoridad } from '@/lib/daw/mezcla/masterizar';
import { energiaPorTrozos, filtrarK, picoVerdadero, sonoridadIntegrada, trozoDe, type Medida } from '@/lib/daw/mezcla/sonoridad';

export type ModoSonoridad = 'normal' | 'cuidado';

export const OBJETIVOS_PAISAJE: Record<ModoSonoridad, ObjetivoSonoridad> = {
  normal: { lufs: -14, techo: -1 },
  cuidado: { lufs: -23, techo: -9 },
};

/** En cuidado, ningún tramo de 3 s sube más de esto sobre lo normal de la pieza. */
export const SUBIDA_MAXIMA_CUIDADO_LU = 3;

/** Lo que suma medir un canal como mono doble. */
export const MONO_DOBLE_DB = 10 * Math.log10(2);

const dbALineal = (db: number) => 10 ** (db / 20);

/** Sonoridad y pico verdadero tal como suena: un canal se mide como mono doble. */
export function medirComoSuena(canales: readonly Float32Array[], sampleRate: number): Medida {
  const lufs = sonoridadIntegrada(canales, sampleRate) + (canales.length === 1 ? MONO_DOBLE_DB : 0);
  return { lufs, picoVerdadero: picoVerdadero(canales, sampleRate) };
}

/** Un índice dentro del círculo de `n`. */
const enCirculo = (i: number, n: number) => ((i % n) + n) % n;

/**
 * La sonoridad a corto plazo (ventanas de 3 s centradas) de cada trozo de
 * 100 ms, mirando la vuelta como un círculo. En LU relativos (sin el −0,691
 * de la norma: aquí solo se comparan entre sí).
 */
function cortoPlazoCircular(energias: Float64Array): Float64Array {
  const n = energias.length;
  const ventana = Math.min(30, n);
  const mitad = Math.floor(ventana / 2);
  const st = new Float64Array(n);
  let suma = 0;
  for (let k = -mitad; k < ventana - mitad; k++) suma += energias[enCirculo(k, n)];
  for (let t = 0; t < n; t++) {
    st[t] = suma > 0 ? 10 * Math.log10(suma / ventana) : -Infinity;
    suma += energias[enCirculo(t + ventana - mitad, n)] - energias[enCirculo(t - mitad, n)];
  }
  return st;
}

/** Mínimo y luego media en ±`radio` trozos, en círculo: la ganancia empieza a bajar ANTES de la subida. */
function suavizarCircular(valores: Float64Array, radio: number): Float64Array {
  const n = valores.length;
  const minimo = new Float64Array(n);
  for (let t = 0; t < n; t++) {
    let m = Infinity;
    for (let k = -radio; k <= radio; k++) m = Math.min(m, valores[enCirculo(t + k, n)]);
    minimo[t] = m;
  }
  const media = new Float64Array(n);
  let suma = 0;
  for (let k = -radio; k <= radio; k++) suma += minimo[enCirculo(k, n)];
  for (let t = 0; t < n; t++) {
    media[t] = suma / (2 * radio + 1);
    suma += minimo[enCirculo(t + radio + 1, n)] - minimo[enCirculo(t - radio, n)];
  }
  return media;
}

/**
 * Baja, despacio y solo donde hace falta, los tramos que suenan más de
 * `margenLu` por encima de lo normal de la pieza (la mediana de su
 * sonoridad a corto plazo). Nunca sube nada: subir lo flojo sube también el
 * ruido de fondo. Cambia los canales que recibe y devuelve lo máximo que ha
 * bajado, en dB (0 si nada).
 */
export function nivelarSinSubidas(canales: Float32Array[], sampleRate: number, margenLu = SUBIDA_MAXIMA_CUIDADO_LU): number {
  const largo = canales[0]?.length ?? 0;
  const trozo = trozoDe(sampleRate);
  const n = Math.floor(largo / trozo);
  if (n < 40) return 0;
  const energias = new Float64Array(n);
  for (const c of canales) {
    const e = energiaPorTrozos(filtrarK(c, sampleRate), trozo);
    for (let t = 0; t < n; t++) energias[t] += e[t];
  }
  const st = cortoPlazoCircular(energias);
  const audibles = [...st].filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (audibles.length === 0) return 0;
  const techo = audibles[Math.floor(audibles.length / 2)] + margenLu;
  const reduccion = new Float64Array(n);
  let hace = false;
  for (let t = 0; t < n; t++) {
    reduccion[t] = Number.isFinite(st[t]) ? Math.min(0, techo - st[t]) : 0;
    if (reduccion[t] < 0) hace = true;
  }
  if (!hace) return 0;
  // ±1 s: la bajada se prepara un segundo antes y se suelta en dos.
  const suave = suavizarCircular(reduccion, 10);
  const ganancia = new Float64Array(n);
  let maximo = 0;
  for (let t = 0; t < n; t++) {
    ganancia[t] = dbALineal(suave[t]);
    maximo = Math.max(maximo, -suave[t]);
  }
  // De un valor por trozo a uno por muestra, interpolando entre los centros
  // de los trozos y repartidos sobre la vuelta entera, así la muestra que
  // sigue a la última vuelve a ser la primera.
  for (const c of canales) {
    for (let i = 0; i < largo; i++) {
      const p = (i * n) / largo - 0.5;
      const j = Math.floor(p);
      const f = p - j;
      c[i] *= ganancia[enCirculo(j, n)] * (1 - f) + ganancia[enCirculo(j + 1, n)] * f;
    }
  }
  return maximo;
}

export interface ResultadoAjuste {
  canales: Float32Array[];
  antes: Medida;
  despues: Medida;
  /** Si ha hecho falta el limitador (casi nunca en un paisaje). */
  limitado: boolean;
}

/** Margen bajo el techo para la vía rápida (una sola ganancia). */
const MARGEN_PICO_DB = 0.2;
/** Lo que se añade a cada lado de la vuelta para que el limitador la vea como un círculo. */
const RELLENO_S = 2;

/**
 * Pone la vuelta a la sonoridad del objetivo sin pasar del techo.
 *
 * La vía normal es una sola ganancia (un paisaje es casi siempre estable y
 * sin picos: el ruido sale ya sin picos raros de `capas.ts`): cambia los
 * canales que recibe, no cuesta nada y no toca la costura. Solo si con esa
 * ganancia algún pico pasaría del techo se usa el masterizado del estudio
 * (limitador con mirada adelante), sobre la vuelta con dos segundos del
 * final delante y del principio detrás, para que el limitador la vea como un
 * círculo; luego se recorta.
 */
export function ajustarSonoridad(
  canales: Float32Array[],
  sampleRate: number,
  objetivo: ObjetivoSonoridad,
): ResultadoAjuste {
  const antes = medirComoSuena(canales, sampleRate);
  if (!Number.isFinite(antes.lufs)) return { canales, antes, despues: antes, limitado: false };
  const ganancia = objetivo.lufs - antes.lufs;

  if (antes.picoVerdadero + ganancia <= objetivo.techo - MARGEN_PICO_DB) {
    const g = dbALineal(ganancia);
    for (const c of canales) for (let i = 0; i < c.length; i++) c[i] *= g;
    // La sonoridad y el pico verdadero son lineales: no hace falta medir otra vez.
    return {
      canales,
      antes,
      despues: { lufs: objetivo.lufs, picoVerdadero: antes.picoVerdadero + ganancia },
      limitado: false,
    };
  }

  const largo = canales[0].length;
  const relleno = Math.min(largo, Math.round(RELLENO_S * sampleRate));
  const acolchados = canales.map((c) => {
    const a = new Float32Array(largo + 2 * relleno);
    a.set(c.subarray(largo - relleno), 0);
    a.set(c, relleno);
    a.set(c.subarray(0, relleno), relleno + largo);
    return a;
  });
  // masterizar mide los canales tal cual: un mono se mide como mono doble moviendo el objetivo.
  const mono = canales.length === 1;
  const resultado = masterizar(acolchados, sampleRate, {
    lufs: objetivo.lufs - (mono ? MONO_DOBLE_DB : 0),
    techo: objetivo.techo,
  });
  const salida = resultado.canales.map((c) => c.slice(relleno, relleno + largo));
  // Recortar puede dejar algún pico entre muestras en los bordes: prima el techo.
  const pico = picoVerdadero(salida, sampleRate);
  if (pico > objetivo.techo) {
    const baja = dbALineal(objetivo.techo - pico - 0.02);
    for (const c of salida) for (let i = 0; i < c.length; i++) c[i] *= baja;
  }
  return { canales: salida, antes, despues: medirComoSuena(salida, sampleRate), limitado: true };
}
