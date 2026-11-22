/**
 * Cuadrar al tempo una toma de audio (guitarra, voz, cajón).
 *
 * Con las pistas de notas es fácil: se mueven las notas. Con audio no hay
 * notas, así que se hace como Logic o Ableton con el «flex» de audio:
 *   1. Se buscan los ataques (`detectarGolpes`, el mismo oído que mide la
 *      latencia de las tomas).
 *   2. Cada ataque se acerca a su sitio en la rejilla del proyecto con la
 *      fuerza elegida: al 70 %, el que llegaba 20 ms tarde se queda a 6.
 *   3. La toma se corta un pelo antes de cada ataque (5 ms, para no tocar
 *      el golpe) y cada trozo se coloca en su sitio nuevo, con fundidos de
 *      4 ms entre trozo y trozo: ni clics ni costuras.
 *   4. Si al moverlos queda un hueco o un trozo pisa al siguiente, el trozo
 *      se estira o se encoge un poco con WSOLA (sin cambiar el tono), así
 *      no quedan silencios a mitad de una nota.
 * Los golpes que caen lejos de cualquier paso de la rejilla no se tocan:
 * una nota a mitad de camino es una decisión, no un error.
 *
 * Todo en TypeScript puro, sobre muestras: se prueba con números.
 */

import { detectarGolpes } from '../analysis/retraso';

export interface AjustesCuadreToma {
  /** De 0,5 a 1: cuánto se acerca cada golpe a la rejilla. */
  fuerza: number;
  /** El paso de la rejilla, en pulsos: 1 negras, 0,5 corcheas, 0,25 semicorcheas. */
  rejilla: number;
  /** Estirar los trozos para que no queden huecos (si no, hueco con fundido). */
  estirar: boolean;
}

export const CUADRE_POR_DEFECTO: AjustesCuadreToma = { fuerza: 0.7, rejilla: 0.5, estirar: true };

export const REJILLAS: { pulsos: number; nombre: string }[] = [
  { pulsos: 1, nombre: 'Negras' },
  { pulsos: 0.5, nombre: 'Corcheas' },
  { pulsos: 0.25, nombre: 'Semicorcheas' },
];

/** Dónde empieza un trozo en la toma original y dónde empieza en la cuadrada (segundos). */
export interface Ancla {
  origen: number;
  destino: number;
}

export interface PlanDeCuadre {
  anclas: Ancla[];
  /** Golpes que se han movido. */
  movidos: number;
  /** Golpes encontrados (los que se han dejado quietos también cuentan). */
  golpes: number;
  /** Lo que se separaban de la rejilla antes y lo que se separan después, de media (s). */
  antes: number;
  despues: number;
}

/** El corte va un poco antes del ataque: así el golpe entra entero. */
export const ANTES_DEL_GOLPE = 0.005;
/** Fundido entre trozos. Menor que `ANTES_DEL_GOLPE`: nunca cae sobre el golpe. */
export const FUNDIDO = 0.004;
/** Dos cortes nunca quedan más cerca que esto. */
const SEPARACION = 0.03;
/** Un golpe a más de este trozo de paso de la rejilla no se toca. */
const CAPTURA = 0.4;

const limitar = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/**
 * Qué se mueve y adónde. `inicio` es dónde cae el segundo 0 de la toma en
 * la línea de tiempo: la rejilla es la del proyecto, no la de la toma.
 */
export function planDeCuadre(
  ataques: readonly number[],
  contexto: { inicio: number; bpm: number; duracion: number },
  ajustes: AjustesCuadreToma,
): PlanDeCuadre {
  const fuerza = limitar(ajustes.fuerza, 0, 1);
  const paso = (Math.max(0.0625, ajustes.rejilla) * 60) / Math.max(20, contexto.bpm);
  const anclas: Ancla[] = [{ origen: 0, destino: 0 }];
  let movidos = 0;
  let sumaAntes = 0;
  let sumaDespues = 0;
  let medidos = 0;

  for (const t of [...ataques].sort((a, b) => a - b)) {
    if (t < 0 || t >= contexto.duracion) continue;
    const previa = anclas[anclas.length - 1];
    const origen = t - ANTES_DEL_GOLPE;
    // Pegado al corte anterior: es el mismo golpe (o un roce), va con el trozo de antes.
    if (origen < previa.origen + SEPARACION) continue;

    const posicion = contexto.inicio + t;
    const destinoRejilla = Math.round(posicion / paso) * paso;
    const falta = destinoRejilla - posicion;
    let desplazamiento = 0;
    if (Math.abs(falta) <= CAPTURA * paso) {
      desplazamiento = falta * fuerza;
      sumaAntes += Math.abs(falta);
      sumaDespues += Math.abs(falta - desplazamiento);
      medidos++;
    }
    let destino = origen + desplazamiento;
    // Nunca se cruzan ni se pegan: si no cabe, va con el desplazamiento del trozo de antes.
    if (destino < previa.destino + SEPARACION) destino = origen + (previa.destino - previa.origen);
    if (Math.abs(destino - origen) > 0.0005) movidos++;
    anclas.push({ origen, destino });
  }

  return {
    anclas,
    movidos,
    golpes: anclas.length - 1,
    antes: medidos ? sumaAntes / medidos : 0,
    despues: medidos ? sumaDespues / medidos : 0,
  };
}

/* -------------------------------------------------------------------------- */
/* WSOLA                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Estira o encoge sin cambiar el tono (WSOLA: solape y suma con búsqueda
 * del parecido). Cada ventana de ~20 ms se coge de donde mejor encaja con
 * la anterior, en ±5 ms alrededor de donde tocaría, y se suma con ventanas
 * de Hann normalizadas: así la primera media ventana sale idéntica a la
 * entrada y el ataque del trozo no se toca. La búsqueda se hace en el
 * primer canal y se aplica igual a todos, para no descolocar el estéreo.
 */
export function wsola(canales: readonly Float32Array[], largoSalida: number, sampleRate: number): Float32Array[] {
  const largoEntrada = canales[0]?.length ?? 0;
  const salida = canales.map(() => new Float32Array(Math.max(0, largoSalida)));
  if (largoSalida <= 0 || largoEntrada === 0) return salida;
  const N = Math.max(256, 2 ** Math.round(Math.log2(0.02 * sampleRate)));
  const H = N / 2;
  // Muy corto para estirar con ventanas: se copia lo que quepa.
  if (largoEntrada < N + H || largoSalida < N) {
    canales.forEach((c, i) => salida[i].set(c.subarray(0, Math.min(c.length, largoSalida))));
    return salida;
  }
  const tolerancia = N / 4;
  const ventana = new Float32Array(N);
  for (let k = 0; k < N; k++) ventana[k] = 0.5 - 0.5 * Math.cos((2 * Math.PI * k) / N);
  const pesos = new Float32Array(largoSalida + N);
  const acum = canales.map(() => new Float32Array(largoSalida + N));
  const ref = canales[0];
  const saltoEntrada = (H * largoEntrada) / largoSalida;
  const ultimoInicio = largoEntrada - N;

  const parecido = (a: number, b: number) => {
    let suma = 0;
    for (let j = 0; j < H; j++) suma += ref[a + j] * ref[b + j];
    return suma;
  };

  let anterior = 0;
  for (let m = 0; m * H < largoSalida; m++) {
    let inicio = 0;
    if (m > 0) {
      const natural = Math.min(ultimoInicio, anterior + H);
      const nominal = Math.round(m * saltoEntrada);
      const desde = Math.max(0, nominal - tolerancia);
      const hasta = Math.min(ultimoInicio, nominal + tolerancia);
      if (hasta < desde) {
        inicio = limitar(nominal, 0, ultimoInicio);
      } else {
        // A saltos de 4 y luego fino alrededor del mejor: el mismo resultado por mucho menos.
        let mejor = desde;
        let maximo = -Infinity;
        for (let c = desde; c <= hasta; c += 4) {
          const p = parecido(natural, c);
          if (p > maximo) {
            maximo = p;
            mejor = c;
          }
        }
        for (let c = Math.max(desde, mejor - 3); c <= Math.min(hasta, mejor + 3); c++) {
          const p = parecido(natural, c);
          if (p > maximo) {
            maximo = p;
            mejor = c;
          }
        }
        inicio = mejor;
      }
    }
    const destino = m * H;
    for (let k = 0; k < N; k++) pesos[destino + k] += ventana[k];
    for (let c = 0; c < canales.length; c++) {
      const entrada = canales[c];
      const a = acum[c];
      for (let k = 0; k < N; k++) a[destino + k] += ventana[k] * entrada[inicio + k];
    }
    anterior = inicio;
  }

  for (let c = 0; c < canales.length; c++) {
    const a = acum[c];
    const s = salida[c];
    const entrada = canales[c];
    for (let n = 0; n < largoSalida; n++) {
      // Donde la ventana vale casi cero (la primera muestra) manda la entrada.
      s[n] = pesos[n] > 1e-3 ? a[n] / pesos[n] : entrada[Math.min(n, largoEntrada - 1)];
    }
  }
  return salida;
}

/* -------------------------------------------------------------------------- */
/* Montar la toma cuadrada                                                     */
/* -------------------------------------------------------------------------- */

/** Estirar más o menos de esto suena raro: entonces se recorta o queda un hueco con fundido. */
const ESTIRADO_MIN = 0.7;
const ESTIRADO_MAX = 1.45;

/**
 * La toma con cada trozo en su sitio nuevo. Mismo largo y mismos canales
 * que la original. Con un plan sin movimientos sale idéntica: los fundidos
 * de un trozo y del siguiente suman 1 sobre las mismas muestras.
 */
export function aplicarCuadre(
  canales: readonly Float32Array[],
  sampleRate: number,
  plan: PlanDeCuadre,
  ajustes: Pick<AjustesCuadreToma, 'estirar'>,
): Float32Array[] {
  const largo = canales[0]?.length ?? 0;
  const salida = canales.map(() => new Float32Array(largo));
  if (largo === 0) return salida;
  const fundido = Math.max(1, Math.round(FUNDIDO * sampleRate));
  const anclas = plan.anclas.map((a) => ({
    origen: limitar(Math.round(a.origen * sampleRate), 0, largo),
    destino: limitar(Math.round(a.destino * sampleRate), 0, largo),
  }));

  for (let k = 0; k < anclas.length; k++) {
    const { origen, destino } = anclas[k];
    const ultimo = k === anclas.length - 1;
    const largoOrigen = (ultimo ? largo : anclas[k + 1].origen) - origen;
    const largoDestino = (ultimo ? largo : anclas[k + 1].destino) - destino;
    if (largoOrigen <= 0 || largoDestino <= 0) continue;
    // La cola: el trozo sigue `fundido` muestras más allá de su final, para
    // fundirse con el siguiente. Son muestras de antes del golpe siguiente.
    const cola = ultimo ? 0 : fundido;

    let trozo: Float32Array[];
    const razon = largoDestino / largoOrigen;
    const fin = Math.min(largo, origen + largoOrigen + cola);
    if (ajustes.estirar && Math.abs(razon - 1) > 1e-3 && razon >= ESTIRADO_MIN && razon <= ESTIRADO_MAX) {
      trozo = wsola(
        canales.map((c) => c.subarray(origen, fin)),
        largoDestino + cola,
        sampleRate,
      );
    } else {
      // Sin estirar: lo que quepa. Si sobra, se corta; si falta, queda un
      // hueco, siempre con fundido para que no haya clic.
      const cabe = Math.min(fin - origen, largoDestino + cola);
      trozo = canales.map((c) => c.slice(origen, origen + cabe));
    }

    const n = trozo[0].length;
    const entra = k === 0 ? 0 : Math.min(fundido, n);
    const sale = ultimo ? 0 : Math.min(fundido, n);
    for (let c = 0; c < canales.length; c++) {
      const t = trozo[c];
      const s = salida[c];
      for (let i = 0; i < n; i++) {
        const j = destino + i;
        if (j >= largo) break;
        let g = 1;
        if (i < entra) g *= i / entra;
        if (i >= n - sale) g *= (n - i) / sale;
        s[j] += t[i] * g;
      }
    }
  }
  return salida;
}

/** Todo junto: de la toma (región que suena del clip) a la toma cuadrada y su plan. */
export function cuadrarMuestras(
  canales: readonly Float32Array[],
  sampleRate: number,
  contexto: { inicio: number; bpm: number },
  ajustes: AjustesCuadreToma,
): { canales: Float32Array[]; plan: PlanDeCuadre } {
  const largo = canales[0]?.length ?? 0;
  // El oído escucha la suma de canales (una toma importada en estéreo).
  let mono = canales[0];
  if (canales.length > 1) {
    mono = new Float32Array(largo);
    for (const c of canales) for (let i = 0; i < largo; i++) mono[i] += c[i] / canales.length;
  }
  const ataques = detectarGolpes(mono, sampleRate).map((g) => g.t);
  const plan = planDeCuadre(ataques, { ...contexto, duracion: largo / sampleRate }, ajustes);
  return { canales: aplicarCuadre(canales, sampleRate, plan, ajustes), plan };
}
