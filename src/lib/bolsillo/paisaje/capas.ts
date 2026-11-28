/**
 * Las capas de un paisaje, sintetizadas en el móvil: un tono puro, un
 * binaural (un tono en cada oído), ruido blanco, rosa o marrón y un pulso
 * que sube y baja el volumen. Gratis e infinitas (plan, parte 3.6).
 *
 * Todo sale de aquí ya pensado para repetirse sin costura:
 *   · Los tonos dan un número ENTERO de ciclos en la vuelta: la frecuencia se
 *     corrige lo justo (como mucho media vuelta por vuelta: con 60 s de
 *     bucle, 0,008 Hz, que nadie oye). Así la muestra que sigue a la última
 *     es exactamente la primera.
 *   · El ruido no tiene ciclos: se genera un poco más largo y se cierra sobre
 *     sí mismo con el fundido de `bucle.ts`.
 *   · El pulso también da ciclos enteros por vuelta.
 *
 * El nivel de cada capa es relativo: `nivel` 1 es lo que suena una canción
 * normal de la biblioteca (−14 LUFS, medido con `sonoridad.ts`), 0,1 es
 * 20 dB menos. Cada capa se MIDE antes de mezclarse, porque a la misma
 * amplitud un tono de 142 Hz, un ruido rosa y uno marrón suenan muy
 * distinto. Lo que suena al final lo decide `cuidado.ts`.
 *
 * Puro y sin navegador: se prueba con números (capas.test.ts).
 */

import { sonoridadIntegrada } from '@/lib/daw/mezcla/sonoridad';
import { cerrarBucle } from './bucle';

/** La sonoridad de referencia de `nivel` 1: la de una canción de la biblioteca. */
export const LUFS_REFERENCIA = -14;

export type ColorRuido = 'blanco' | 'rosa' | 'marron';

/** Un generador pequeño, rápido y con semilla (mulberry32): el mismo paisaje sale igual. */
export function crearAzar(semilla: number): () => number {
  let s = semilla >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Los ciclos enteros que caben en una vuelta de `n` muestras, al menos uno. */
export function ciclosEnBucle(hz: number, n: number, sampleRate: number): number {
  return Math.max(1, Math.round((hz * n) / sampleRate));
}

/** La frecuencia que suena de verdad tras ajustarla a ciclos enteros. */
export function frecuenciaEnBucle(hz: number, n: number, sampleRate: number): number {
  return (ciclosEnBucle(hz, n, sampleRate) * sampleRate) / n;
}

/** Cada cuántas muestras se deja respirar al hilo mientras se sintetiza. */
export const TROZO_SINTESIS = 1 << 17;

export type Pausa = () => Promise<void>;
const sinPausa: Pausa = async () => {};

/**
 * Un seno de ciclos enteros sobre `n` muestras: `sin(2π·c·i/n)`. Se escribe
 * (sumando) en cada destino con su ganancia. `modular`, si viene, multiplica
 * muestra a muestra (el pulso).
 */
export async function sumarSeno(
  destinos: readonly Float32Array[],
  ciclos: number,
  amplitud: number,
  opciones: { modular?: (i: number) => number; pausa?: Pausa } = {},
): Promise<void> {
  const n = destinos[0]?.length ?? 0;
  const radianesPorMuestra = (2 * Math.PI) / n;
  const pausa = opciones.pausa ?? sinPausa;
  const modular = opciones.modular;
  for (let desde = 0; desde < n; desde += TROZO_SINTESIS) {
    const hasta = Math.min(n, desde + TROZO_SINTESIS);
    for (let i = desde; i < hasta; i++) {
      // El ángulo se reduce con el resto ENTERO de c·i entre n: con millones de
      // muestras, un ángulo que solo crece pierde decimales y la vuelta no cierra.
      let v = amplitud * Math.sin(radianesPorMuestra * ((ciclos * i) % n));
      if (modular) v *= modular(i);
      for (const d of destinos) d[i] += v;
    }
    await pausa();
  }
}

/**
 * Ruido de un color, a varianza 1 (un σ = 1) y sin picos raros: lo que pase
 * de 3σ se redondea con una rodilla suave. Al ruido no le cambia el sonido,
 * y así no obliga a meter un limitador para un pico de una vez por minuto.
 *
 *   · Blanco: igual energía por herzio.
 *   · Rosa: igual energía por octava (−3 dB por octava). Filtro de Paul
 *     Kellet, el «refinado», pensado para 44,1 kHz.
 *   · Marrón: −6 dB por octava (un integrador con fuga a 60 Hz) y un paso
 *     alto a 20 Hz para que no se cuelen los graves que no se oyen pero
 *     ocupan sitio.
 */
export function ruido(color: ColorRuido, n: number, sampleRate: number, azar: () => number): Float32Array {
  const salida = new Float32Array(n);
  if (n === 0) return salida;
  // Blanco uniforme de varianza 1: √3 · U(−1, 1).
  const k = Math.sqrt(3);
  if (color === 'blanco') {
    for (let i = 0; i < n; i++) salida[i] = k * (2 * azar() - 1);
  } else if (color === 'rosa') {
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < n; i++) {
      const w = k * (2 * azar() - 1);
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856;
      b4 = 0.55 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.016898;
      salida[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362;
      b6 = w * 0.115926;
    }
  } else {
    const fuga = Math.exp((-2 * Math.PI * 60) / sampleRate);
    const alto = Math.exp((-2 * Math.PI * 20) / sampleRate);
    let y = 0;
    let xPrevio = 0;
    let z = 0;
    for (let i = 0; i < n; i++) {
      const w = k * (2 * azar() - 1);
      y = fuga * y + (1 - fuga) * w;
      // Paso alto de un polo: z = a·(z + y − y_previo).
      z = alto * (z + y - xPrevio);
      xPrevio = y;
      salida[i] = z;
    }
  }
  // A varianza 1, sin contar el arranque de los filtros (los primeros 50 ms).
  const desde = Math.min(n - 1, Math.round(sampleRate * 0.05));
  let suma = 0;
  for (let i = desde; i < n; i++) suma += salida[i] * salida[i];
  const rms = Math.sqrt(suma / Math.max(1, n - desde)) || 1;
  const escala = 1 / rms;
  const rodilla = 2.5;
  const techo = 3;
  for (let i = 0; i < n; i++) {
    const v = salida[i] * escala;
    const a = v < 0 ? -v : v;
    salida[i] = a <= rodilla ? v : Math.sign(v) * (rodilla + (techo - rodilla) * Math.tanh((a - rodilla) / (techo - rodilla)));
  }
  return salida;
}

/** Lo que se funde el ruido sobre sí mismo para cerrar la vuelta. */
export const FUNDIDO_RUIDO_S = 2;

/** Ruido que se repite cada `n` muestras sin costura: se hace más largo y se cierra con un fundido. */
export function ruidoEnBucle(color: ColorRuido, n: number, sampleRate: number, semilla: number): Float32Array {
  const fundido = Math.min(Math.round(FUNDIDO_RUIDO_S * sampleRate), Math.floor(n / 2));
  const largo = ruido(color, n + fundido, sampleRate, crearAzar(semilla));
  return cerrarBucle([largo], fundido)[0];
}

/**
 * La ganancia del pulso isocrónico en la muestra `i`: sube y baja suave
 * (coseno alzado, sin escalones que hagan clic) entre 1 y `1 − profundidad`,
 * con ciclos enteros por vuelta.
 */
export function pulso(hz: number, profundidad: number, n: number, sampleRate: number): (i: number) => number {
  const ciclos = ciclosEnBucle(hz, n, sampleRate);
  const p = Math.max(0, Math.min(1, profundidad));
  const radianesPorMuestra = (2 * Math.PI) / n;
  return (i: number) => 1 - p * 0.5 * (1 - Math.cos(radianesPorMuestra * ((ciclos * i) % n)));
}

/** dB a lineal. */
export const dbALineal = (db: number) => 10 ** (db / 20);

/**
 * La ganancia que pone una señal (medida como suena: cada canal tal cual) a
 * `LUFS_REFERENCIA + 20·log10(nivel)`. Silencio o nivel 0 → 0.
 */
export function gananciaParaNivel(canalesMedidos: readonly Float32Array[], sampleRate: number, nivel: number): number {
  if (!(nivel > 0)) return 0;
  const lufs = sonoridadIntegrada(canalesMedidos, sampleRate);
  if (!Number.isFinite(lufs)) return 0;
  return dbALineal(LUFS_REFERENCIA - lufs) * nivel;
}

/**
 * La amplitud de un seno de `ciclos` por vuelta que suena a ese nivel.
 * Basta medir dos segundos: un seno suena igual todo el rato.
 */
export function amplitudDeSeno(hz: number, sampleRate: number, nivel: number): number {
  const n = Math.round(2 * sampleRate);
  const s = new Float32Array(n);
  const paso = (2 * Math.PI * hz) / sampleRate;
  for (let i = 0; i < n; i++) s[i] = Math.sin(paso * i);
  // Centrado: suena igual por los dos lados (en mono también: sale por los dos altavoces).
  return gananciaParaNivel([s, s], sampleRate, nivel);
}
