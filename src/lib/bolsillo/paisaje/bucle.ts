/**
 * Convertir un trozo de música en un bucle que se repite sin costura.
 *
 * La jugada es la de siempre en los bucles de audio, en tres pasos:
 *   1. Se quitan los bordes que no sirven para repetir: el silencio del
 *      principio y el fundido de salida del final (una pieza de Lyria casi
 *      siempre se apaga al acabar; repetida, sería un bache cada vuelta).
 *   2. Se elige dónde cortar el final para que, al solaparlo con el
 *      principio, los golpes caigan juntos (el corte «en el compás»): se
 *      comparan los ataques del principio con los del final en un margen de
 *      dos segundos.
 *   3. El final se funde sobre el principio con un fundido de POTENCIA
 *      constante (seno y coseno): dos trozos distintos de música no están
 *      correlacionados, y así la suma suena igual de fuerte durante todo el
 *      fundido.
 *
 * Por construcción, la muestra que sigue a la última de la vuelta es la que
 * seguía en el original: el salto del final al principio es el de dos
 * muestras seguidas de la pieza, no un corte. Lo comprueba bucle.test.ts.
 *
 * Puro y sin navegador.
 */

import { ataques, SALTO } from '@/lib/musico/pulso';

/**
 * Cierra el bucle: devuelve `largo − fundido` muestras por canal, y las
 * primeras `fundido` llevan el final del original fundido encima.
 */
export function cerrarBucle(canales: readonly Float32Array[], fundido: number): Float32Array[] {
  const largo = canales[0]?.length ?? 0;
  const f = Math.max(0, Math.min(Math.floor(fundido), Math.floor(largo / 2)));
  const vuelta = largo - f;
  return canales.map((x) => {
    const y = new Float32Array(vuelta);
    y.set(x.subarray(0, vuelta));
    for (let i = 0; i < f; i++) {
      // A i = 0 solo suena el final (la muestra que sigue a la última de la
      // vuelta); a i = f, solo el principio.
      const t = (Math.PI / 2) * (i / f);
      y[i] = x[i] * Math.sin(t) + x[vuelta + i] * Math.cos(t);
    }
    return y;
  });
}

/** Lo que se funde la música para cerrar la vuelta: el 5 % de lo que dura, entre 3 y 6 s. */
export function segundosDeFundido(segundos: number): number {
  return Math.max(3, Math.min(6, segundos * 0.05));
}

/** La suma de los canales, para mirar el audio (no para oírlo). */
export function aMono(canales: readonly Float32Array[], desde = 0, hasta?: number): Float32Array {
  const fin = hasta ?? canales[0]?.length ?? 0;
  const n = Math.max(0, fin - desde);
  const mono = new Float32Array(n);
  for (const c of canales) for (let i = 0; i < n; i++) mono[i] += c[desde + i];
  if (canales.length > 1) for (let i = 0; i < n; i++) mono[i] /= canales.length;
  return mono;
}

/** El nivel (RMS) de cada ventana de 50 ms. */
function nivelesPorVentana(mono: Float32Array, sampleRate: number): { niveles: Float64Array; ventana: number } {
  const ventana = Math.max(1, Math.round(sampleRate * 0.05));
  const n = Math.floor(mono.length / ventana);
  const niveles = new Float64Array(n);
  for (let v = 0; v < n; v++) {
    let suma = 0;
    for (let i = v * ventana; i < (v + 1) * ventana; i++) suma += mono[i] * mono[i];
    niveles[v] = Math.sqrt(suma / ventana);
  }
  return { niveles, ventana };
}

/**
 * Dónde empieza y dónde acaba lo que sirve para repetir: fuera el silencio
 * del principio (20 dB por debajo de lo normal de la pieza) y el fundido de
 * salida del final (10 dB por debajo). Si eso se come más del 40 % de la
 * pieza, no se toca nada: será una pieza con partes flojas a propósito.
 */
export function bordesUtiles(canales: readonly Float32Array[], sampleRate: number): { desde: number; hasta: number } {
  const largo = canales[0]?.length ?? 0;
  const entero = { desde: 0, hasta: largo };
  const { niveles, ventana } = nivelesPorVentana(aMono(canales), sampleRate);
  const ordenados = [...niveles].filter((v) => v > 1e-6).sort((a, b) => a - b);
  if (ordenados.length < 10) return entero;
  const normal = ordenados[Math.floor(ordenados.length / 2)];
  const umbralInicio = normal * 10 ** (-20 / 20);
  const umbralFinal = normal * 10 ** (-10 / 20);
  let primera = 0;
  while (primera < niveles.length && niveles[primera] < umbralInicio) primera++;
  let ultima = niveles.length - 1;
  while (ultima > primera && niveles[ultima] < umbralFinal) ultima--;
  const desde = primera * ventana;
  const hasta = Math.min(largo, (ultima + 1) * ventana);
  if (hasta - desde < largo * 0.6) return entero;
  return { desde, hasta };
}

/**
 * Dónde cortar el final (en muestras, como mucho `largo`) para que sus
 * golpes caigan con los del principio al fundirse. Se busca en los últimos
 * `buscarS` segundos: lo que más se parece por ataques gana. Si la pieza no
 * tiene golpes claros (un pad, una nube), da igual dónde: se deja entera.
 */
export function mejorCorte(canales: readonly Float32Array[], sampleRate: number, fundido: number, buscarS = 2): number {
  const largo = canales[0]?.length ?? 0;
  const salto = Math.max(1, Math.round(sampleRate * SALTO));
  const buscar = Math.min(Math.round(buscarS * sampleRate), Math.floor((largo - 2 * fundido) / 2));
  if (fundido < salto * 20 || buscar < salto) return largo;

  const principio = ataques(aMono(canales, 0, fundido), sampleRate);
  const final = ataques(aMono(canales, largo - buscar - fundido, largo), sampleRate);
  const m = principio.length;
  const pasos = Math.floor(buscar / salto);

  const media = (a: Float32Array, desde: number) => {
    let s = 0;
    for (let i = 0; i < m; i++) s += a[desde + i];
    return s / m;
  };
  const mp = media(principio, 0);
  let varP = 0;
  for (let i = 0; i < m; i++) varP += (principio[i] - mp) ** 2;
  if (varP <= 1e-12) return largo;

  let mejor = 0;
  let mejorPuntuacion = -Infinity;
  for (let k = 0; k <= pasos; k++) {
    // Cortar k saltos antes del final: el trozo que se funde empieza k saltos antes.
    const desde = pasos - k;
    if (desde + m > final.length) continue;
    const mf = media(final, desde);
    let cov = 0;
    let varF = 0;
    for (let i = 0; i < m; i++) {
      const a = principio[i] - mp;
      const b = final[desde + i] - mf;
      cov += a * b;
      varF += b * b;
    }
    if (varF <= 1e-12) continue;
    const r = cov / Math.sqrt(varP * varF);
    if (r > mejorPuntuacion) {
      mejorPuntuacion = r;
      mejor = k;
    }
  }
  // Una correlación floja es azar: entonces no se mueve el corte.
  if (mejorPuntuacion < 0.3) return largo;
  return largo - mejor * salto;
}

/**
 * Todo junto para una base de música: quita los bordes, elige el corte y
 * cierra la vuelta. `segundosMaximos` recorta antes (una vuelta más corta
 * de lo que dura la base).
 */
export function bucleDeMusica(
  canales: readonly Float32Array[],
  sampleRate: number,
  segundosMaximos?: number,
): { canales: Float32Array[]; fundido: number } {
  const { desde, hasta } = bordesUtiles(canales, sampleRate);
  let util = canales.map((c) => c.subarray(desde, hasta));
  const segundos = (hasta - desde) / sampleRate;
  const fundido = Math.round(segundosDeFundido(segundos) * sampleRate);
  if (segundosMaximos && segundosMaximos > 0) {
    const maximo = Math.round(segundosMaximos * sampleRate) + fundido;
    if (maximo < util[0].length) util = util.map((c) => c.subarray(0, maximo));
  }
  const corte = mejorCorte(util, sampleRate, fundido);
  return { canales: cerrarBucle(util.map((c) => c.subarray(0, corte)), fundido), fundido };
}
