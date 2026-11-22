/**
 * Medir cuánto suena una mezcla, como lo mide Spotify.
 *
 * Sonoridad integrada según ITU-R BS.1770 (la misma base que EBU R 128):
 *   1. Filtro K: una estantería que sube los agudos como los oye la cabeza y
 *      un paso alto que no deja contar los graves que casi no se oyen.
 *   2. Bloques de 400 ms que se solapan un 75 %.
 *   3. Dos puertas: fuera lo que esté por debajo de −70 LUFS (silencio) y
 *      fuera lo que esté 10 LU por debajo de la media (las pausas y las
 *      colas no bajan la cifra de una canción que suena fuerte).
 * Y el pico verdadero (dBTP): el pico entre muestras, que aparece al
 * convertir a analógico o a MP3 y no se ve mirando solo las muestras. Se
 * estima sobremuestreando por 4 con un filtro de 48 coeficientes, como
 * propone el anexo 2 de la norma.
 *
 * Coeficientes del filtro K para cualquier frecuencia de muestreo: los de
 * libebur128 (MIT), sacados de la norma por transformación bilineal.
 *
 * Los bucles están escritos a mano, con variables sueltas en vez de
 * arrays: masterizar una canción de tres minutos en un móvil tiene que
 * tardar segundos, no medio minuto.
 */

export interface Medida {
  /** Sonoridad integrada en LUFS; −Infinity si es silencio. */
  lufs: number;
  /** Pico verdadero en dBTP; −Infinity si es silencio. */
  picoVerdadero: number;
}

interface Biquad {
  b0: number;
  b1: number;
  b2: number;
  a1: number;
  a2: number;
}

function filtroK(sampleRate: number): [Biquad, Biquad] {
  // Etapa 1: estantería alta de +4 dB, el efecto de la cabeza.
  let f0 = 1681.974450955533;
  const G = 3.999843853973347;
  let Q = 0.7071752369554196;
  let K = Math.tan((Math.PI * f0) / sampleRate);
  const Vh = 10 ** (G / 20);
  const Vb = Vh ** 0.4996667741545416;
  let a0 = 1 + K / Q + K * K;
  const estanteria: Biquad = {
    b0: (Vh + (Vb * K) / Q + K * K) / a0,
    b1: (2 * (K * K - Vh)) / a0,
    b2: (Vh - (Vb * K) / Q + K * K) / a0,
    a1: (2 * (K * K - 1)) / a0,
    a2: (1 - K / Q + K * K) / a0,
  };
  // Etapa 2: paso alto RLB a unos 38 Hz.
  f0 = 38.13547087602444;
  Q = 0.5003270373238773;
  K = Math.tan((Math.PI * f0) / sampleRate);
  a0 = 1 + K / Q + K * K;
  const pasoAlto: Biquad = {
    b0: 1,
    b1: -2,
    b2: 1,
    a1: (2 * (K * K - 1)) / a0,
    a2: (1 - K / Q + K * K) / a0,
  };
  return [estanteria, pasoAlto];
}

/** El canal pasado por el filtro K. */
export function filtrarK(datos: Float32Array, sampleRate: number): Float32Array {
  const [e, p] = filtroK(sampleRate);
  const eb0 = e.b0, eb1 = e.b1, eb2 = e.b2, ea1 = e.a1, ea2 = e.a2;
  const pb0 = p.b0, pb1 = p.b1, pb2 = p.b2, pa1 = p.a1, pa2 = p.a2;
  const salida = new Float32Array(datos.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0; // estantería
  let u1 = 0, u2 = 0, v1 = 0, v2 = 0; // paso alto
  for (let i = 0; i < datos.length; i++) {
    const x = datos[i];
    const y = eb0 * x + eb1 * x1 + eb2 * x2 - ea1 * y1 - ea2 * y2;
    x2 = x1; x1 = x; y2 = y1; y1 = y;
    const z = pb0 * y + pb1 * u1 + pb2 * u2 - pa1 * v1 - pa2 * v2;
    u2 = u1; u1 = y; v2 = v1; v1 = z;
    salida[i] = z;
  }
  return salida;
}

/** Trozos de 100 ms: cuatro seguidos hacen un bloque y se avanza de uno en uno (el 75 % de solape). */
export const trozoDe = (sampleRate: number) => Math.max(1, Math.round(sampleRate * 0.1));

/**
 * Suma de cuadrados por trozo de un canal ya filtrado. Con `ganancia`, cada
 * muestra se multiplica antes por `escala · ganancia[i]`: así el
 * masterizado prueba ganancias sin volver a filtrar la canción entera.
 */
export function energiaPorTrozos(
  filtrado: Float32Array,
  trozo: number,
  escala = 1,
  ganancia?: Float32Array,
): Float64Array {
  const n = Math.floor(filtrado.length / trozo);
  const sumas = new Float64Array(n);
  const e2 = escala * escala;
  for (let t = 0; t < n; t++) {
    let suma = 0;
    const desde = t * trozo;
    const hasta = desde + trozo;
    if (ganancia) {
      for (let i = desde; i < hasta; i++) {
        const v = filtrado[i] * ganancia[i];
        suma += v * v;
      }
    } else {
      for (let i = desde; i < hasta; i++) suma += filtrado[i] * filtrado[i];
    }
    sumas[t] = suma * e2;
  }
  return sumas;
}

const aLufs = (energia: number) => (energia > 0 ? -0.691 + 10 * Math.log10(energia) : -Infinity);

/** De las energías por trozo de cada canal a LUFS integrados, con las dos puertas. */
export function integrar(porCanal: readonly Float64Array[], trozo: number): number {
  if (porCanal.length === 0) return -Infinity;
  const trozos = porCanal[0].length;
  const bloques = trozos - 3;
  if (bloques <= 0) {
    // Menos de 400 ms: se mide entero, sin puertas.
    let total = 0;
    for (const sumas of porCanal) {
      let s = 0;
      for (let i = 0; i < sumas.length; i++) s += sumas[i];
      total += s / Math.max(1, sumas.length * trozo);
    }
    return aLufs(total);
  }

  const energia = new Float64Array(bloques);
  for (let b = 0; b < bloques; b++) {
    let total = 0;
    for (const sumas of porCanal) total += (sumas[b] + sumas[b + 1] + sumas[b + 2] + sumas[b + 3]) / (4 * trozo);
    energia[b] = total;
  }

  // Puerta absoluta: −70 LUFS.
  const umbralAbsoluto = 10 ** ((-70 + 0.691) / 10);
  let suma = 0;
  let cuenta = 0;
  for (let b = 0; b < bloques; b++) {
    if (energia[b] > umbralAbsoluto) {
      suma += energia[b];
      cuenta++;
    }
  }
  if (cuenta === 0) return -Infinity;

  // Puerta relativa: 10 LU por debajo de lo que ha pasado la primera.
  const umbralRelativo = (suma / cuenta) * 0.1;
  suma = 0;
  cuenta = 0;
  for (let b = 0; b < bloques; b++) {
    const z = energia[b];
    if (z > umbralAbsoluto && z > umbralRelativo) {
      suma += z;
      cuenta++;
    }
  }
  return cuenta > 0 ? aLufs(suma / cuenta) : -Infinity;
}

/** Sonoridad integrada en LUFS. Uno o dos canales, todos con peso 1. */
export function sonoridadIntegrada(canales: readonly Float32Array[], sampleRate: number): number {
  const trozo = trozoDe(sampleRate);
  return integrar(
    canales.map((c) => energiaPorTrozos(filtrarK(c, sampleRate), trozo)),
    trozo,
  );
}

/* -------------------------------------------------------------------------- */
/* Pico verdadero                                                              */
/* -------------------------------------------------------------------------- */

const FASES = 4;
const COEFICIENTES = 48;
const POR_FASE = COEFICIENTES / FASES;
/** Lo que se retrasa el filtro, en muestras de entrada (centro en 23,5 de 48 a ×4). */
export const RETRASO_SOBREMUESTREO = Math.round((COEFICIENTES - 1) / 2 / FASES);

let fasesCache: number[][] | null = null;

/** Sinc con ventana de Blackman, partido en cuatro fases de 12 coeficientes. */
function fasesDelFiltro(): number[][] {
  if (fasesCache) return fasesCache;
  const centro = (COEFICIENTES - 1) / 2;
  const h: number[] = [];
  for (let k = 0; k < COEFICIENTES; k++) {
    const x = (k - centro) / FASES;
    const sinc = x === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x);
    const w =
      0.42 - 0.5 * Math.cos((2 * Math.PI * k) / (COEFICIENTES - 1)) + 0.08 * Math.cos((4 * Math.PI * k) / (COEFICIENTES - 1));
    h.push(sinc * w);
  }
  const fases: number[][] = [];
  for (let p = 0; p < FASES; p++) {
    const fase: number[] = [];
    for (let j = 0; j < POR_FASE; j++) fase.push(h[p + FASES * j]);
    // Cada fase deja pasar la continua entera: si no, el pico sale torcido.
    const suma = fase.reduce((a, b) => a + b, 0);
    fases.push(fase.map((v) => v / suma));
  }
  fasesCache = fases;
  return fases;
}

/** Cuántas veces hay que sobremuestrear a esta frecuencia (a 192 kHz ya no hace falta). */
function sobremuestrea(sampleRate: number): boolean {
  return sampleRate < 176400;
}

/**
 * Recorre un canal interpolando ×4 y deja en `picos[n]` el mayor valor
 * absoluto interpolado alrededor de la muestra `n − RETRASO` (0 donde no
 * ha hecho falta mirar).
 * Con `umbral`, solo interpola donde alguna de las 12 muestras del filtro
 * llega a ese nivel (un pico entre muestras no sale 12 dB por encima de sus
 * vecinas en audio real).
 */
function interpolar(datos: Float32Array, umbral: number, picos: Float32Array) {
  const [A, B, C, D] = fasesDelFiltro();
  const [a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11] = A;
  const [b0, b1, b2, b3, b4, b5, b6, b7, b8, b9, b10, b11] = B;
  const [c0, c1, c2, c3, c4, c5, c6, c7, c8, c9, c10, c11] = C;
  const [d0, d1, d2, d3, d4, d5, d6, d7, d8, d9, d10, d11] = D;
  // x0 es la muestra actual; x11, la de hace 11.
  let x0 = 0, x1 = 0, x2 = 0, x3 = 0, x4 = 0, x5 = 0, x6 = 0, x7 = 0, x8 = 0, x9 = 0, x10 = 0, x11 = 0;
  let ultimaFuerte = -POR_FASE;
  for (let n = 0; n < datos.length; n++) {
    x11 = x10; x10 = x9; x9 = x8; x8 = x7; x7 = x6; x6 = x5; x5 = x4; x4 = x3; x3 = x2; x2 = x1; x1 = x0;
    x0 = datos[n];
    if (x0 >= umbral || x0 <= -umbral) ultimaFuerte = n;
    if (n - ultimaFuerte >= POR_FASE) continue;
    const ya = a0 * x0 + a1 * x1 + a2 * x2 + a3 * x3 + a4 * x4 + a5 * x5 + a6 * x6 + a7 * x7 + a8 * x8 + a9 * x9 + a10 * x10 + a11 * x11;
    const yb = b0 * x0 + b1 * x1 + b2 * x2 + b3 * x3 + b4 * x4 + b5 * x5 + b6 * x6 + b7 * x7 + b8 * x8 + b9 * x9 + b10 * x10 + b11 * x11;
    const yc = c0 * x0 + c1 * x1 + c2 * x2 + c3 * x3 + c4 * x4 + c5 * x5 + c6 * x6 + c7 * x7 + c8 * x8 + c9 * x9 + c10 * x10 + c11 * x11;
    const yd = d0 * x0 + d1 * x1 + d2 * x2 + d3 * x3 + d4 * x4 + d5 * x5 + d6 * x6 + d7 * x7 + d8 * x8 + d9 * x9 + d10 * x10 + d11 * x11;
    let m = ya < 0 ? -ya : ya;
    const ab = yb < 0 ? -yb : yb;
    if (ab > m) m = ab;
    const ac = yc < 0 ? -yc : yc;
    if (ac > m) m = ac;
    const ad = yd < 0 ? -yd : yd;
    if (ad > m) m = ad;
    picos[n] = m;
  }
}

/**
 * Envolvente de pico verdadero, muestra a muestra y alineada con la señal:
 * en cada muestra, el mayor valor absoluto entre ella y lo interpolado hasta
 * la siguiente, en cualquiera de los canales. Es lo que mira el limitador.
 * Solo se interpola por encima de `umbral` (lineal): por debajo basta el
 * valor de la muestra.
 */
export function envolventeDePico(canales: readonly Float32Array[], sampleRate: number, umbral = 0): Float32Array {
  const largo = canales[0]?.length ?? 0;
  const env = new Float32Array(largo);
  for (const datos of canales) {
    for (let i = 0; i < largo; i++) {
      const a = datos[i] < 0 ? -datos[i] : datos[i];
      if (a > env[i]) env[i] = a;
    }
    if (!sobremuestrea(sampleRate)) continue;
    const picos = new Float32Array(largo);
    interpolar(datos, umbral, picos);
    for (let n = RETRASO_SOBREMUESTREO; n < largo; n++) {
      const destino = n - RETRASO_SOBREMUESTREO;
      if (picos[n] > env[destino]) env[destino] = picos[n];
    }
  }
  return env;
}

/** Pico verdadero en dBTP. */
export function picoVerdadero(canales: readonly Float32Array[], sampleRate: number): number {
  let pico = 0;
  for (const datos of canales) {
    for (let i = 0; i < datos.length; i++) {
      const a = datos[i] < 0 ? -datos[i] : datos[i];
      if (a > pico) pico = a;
    }
  }
  if (pico === 0) return -Infinity;
  if (sobremuestrea(sampleRate)) {
    const umbral = pico * 0.25;
    for (const datos of canales) {
      const picos = new Float32Array(datos.length);
      interpolar(datos, umbral, picos);
      for (let n = 0; n < picos.length; n++) if (picos[n] > pico) pico = picos[n];
    }
  }
  return 20 * Math.log10(pico);
}

export function medir(canales: readonly Float32Array[], sampleRate: number): Medida {
  return { lufs: sonoridadIntegrada(canales, sampleRate), picoVerdadero: picoVerdadero(canales, sampleRate) };
}
