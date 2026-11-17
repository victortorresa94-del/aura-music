/**
 * Masterizar de un toque.
 *
 * Sube (o baja) la mezcla entera hasta la sonoridad que piden las
 * plataformas sin pasar del techo de pico verdadero:
 *   · Plataformas: −14 LUFS integrados, techo −1 dBTP (Spotify, y la skill
 *     `audio-mixing-mastering`).
 *   · Para el móvil: −16 LUFS, techo −1 dBTP (AES TD1008 para música
 *     normalizada por pista; deja más aire a los altavoces pequeños).
 *
 * Si con la ganancia los picos se pasan del techo, un limitador con mirada
 * adelante (1,5 ms) los baja justo a tiempo y suelta despacio (80 ms), y
 * como limitar quita algo de sonoridad, se repite el cálculo hasta llegar.
 * Todo en TypeScript puro, sobre el WAV ya mezclado: no depende de ningún
 * nodo del navegador y se puede probar con números.
 */

import { energiaPorTrozos, envolventeDePico, filtrarK, integrar, medir, picoVerdadero, sonoridadIntegrada, trozoDe, type Medida } from './sonoridad';
import type { ObjetivoMaster } from './tipos';

export interface ObjetivoSonoridad {
  lufs: number;
  /** Techo de pico verdadero, en dBTP. */
  techo: number;
}

export const OBJETIVOS: Record<Exclude<ObjetivoMaster, 'no'>, ObjetivoSonoridad> = {
  plataformas: { lufs: -14, techo: -1 },
  movil: { lufs: -16, techo: -1 },
};

export interface ResultadoMaster {
  canales: Float32Array<ArrayBuffer>[];
  antes: Medida;
  despues: Medida;
  /** Ganancia aplicada antes del limitador, en dB. */
  gananciaDb: number;
  /** Lo máximo que ha tenido que bajar el limitador, en dB (0 si nada). */
  limitadoDb: number;
}

/** Más de 24 dB de subida es amplificar ruido de fondo, no masterizar. */
const SUBIDA_MAXIMA_DB = 24;
const ATAQUE = 0.0015;
const RELAJACION = 0.08;
/** El limitador apunta un pelo por debajo del techo; el resto lo comprueba la medida final. */
const MARGEN_DB = 0.15;
const TOLERANCIA_LU = 0.15;

const dbALin = (db: number) => 10 ** (db / 20);

/**
 * La ganancia del limitador muestra a muestra (1 = no toca). Mínimo en
 * ventana hacia delante y media móvil: la bajada empieza 1,5 ms antes del
 * pico y llega a él justo a tiempo, sin recortar la onda.
 */
export function gananciaDeLimitador(
  envolvente: Float32Array,
  ganancia: number,
  techo: number,
  sampleRate: number,
): Float32Array {
  const n = envolvente.length;
  const ventana = Math.max(1, Math.round(ATAQUE * sampleRate));
  const necesaria = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const pico = envolvente[i] * ganancia;
    necesaria[i] = pico > techo ? techo / pico : 1;
  }

  // Mínimo de [i, i + ventana − 1] con una cola monótona: O(n).
  const minimo = new Float32Array(n);
  const cola = new Int32Array(n);
  let cabeza = 0;
  let fin = 0;
  for (let j = 0; j < n + ventana - 1; j++) {
    if (j < n) {
      while (fin > cabeza && necesaria[cola[fin - 1]] >= necesaria[j]) fin--;
      cola[fin++] = j;
    }
    const i = j - ventana + 1;
    if (i < 0) continue;
    while (cola[cabeza] < i) cabeza++;
    minimo[i] = necesaria[cola[cabeza]];
  }

  // Media de las últimas `ventana` muestras del mínimo, y relajación lenta.
  // Antes del principio se repite el primer valor, no 1: si la canción
  // arranca con un golpe en la muestra 0 no hay sitio para mirar por
  // delante, y con un 1 ahí el golpe se escapaba entero del limitador.
  const salida = new Float32Array(n);
  const suelta = 1 - Math.exp(-1 / (RELAJACION * sampleRate));
  const primero = n > 0 ? minimo[0] : 1;
  let suma = ventana * primero;
  let previa = 1;
  for (let i = 0; i < n; i++) {
    suma += minimo[i] - (i - ventana >= 0 ? minimo[i - ventana] : primero);
    const media = suma / ventana;
    previa = media < previa ? media : previa + (media - previa) * suelta;
    salida[i] = previa;
  }

  /* Y un último mínimo de ±6 muestras, el ancho del filtro que interpola el
     pico verdadero. Con 20 dB de limitador la ganancia cae varios dB en
     esas 12 muestras, y las vecinas, todavía altas, levantaban el pico
     entre muestras por encima del techo. */
  const radio = RADIO_INTERPOLACION;
  const final = new Float32Array(n);
  cabeza = 0;
  fin = 0;
  for (let j = 0; j < n + radio; j++) {
    if (j < n) {
      while (fin > cabeza && salida[cola[fin - 1]] >= salida[j]) fin--;
      cola[fin++] = j;
    }
    const i = j - radio;
    if (i < 0) continue;
    while (cola[cabeza] < i - radio) cabeza++;
    final[i] = salida[cola[cabeza]];
  }
  return final;
}

/** Medio ancho del filtro de pico verdadero, en muestras (12 coeficientes por fase). */
const RADIO_INTERPOLACION = 6;

export function masterizar(
  canales: readonly Float32Array[],
  sampleRate: number,
  objetivo: ObjetivoSonoridad,
): ResultadoMaster {
  const copia = () => canales.map((c) => new Float32Array(c));
  const antes = medir(canales, sampleRate);
  if (!Number.isFinite(antes.lufs)) {
    return { canales: copia(), antes, despues: antes, gananciaDb: 0, limitadoDb: 0 };
  }

  const techo = dbALin(objetivo.techo - MARGEN_DB);
  const largo = canales[0].length;
  let gananciaDb = Math.min(SUBIDA_MAXIMA_DB, objetivo.lufs - antes.lufs);
  /* La envolvente de pico verdadero solo se interpola donde la señal, con
     la ganancia que se está probando, podría llegar al techo (dejando 6 dB
     para el pico entre muestras): interpolar la canción entera es lo que
     más cuesta. Si las vueltas suben la ganancia por encima de lo que
     cubre, se vuelve a calcular con más margen. */
  let cubre = 0;
  let envolvente: Float32Array = new Float32Array(0);
  const envolventePara = (g: number) => {
    if (g > cubre) {
      cubre = g * 2;
      envolvente = envolventeDePico(canales, sampleRate, techo / (2 * cubre));
    }
    return envolvente;
  };
  // El filtro K se pasa una vez. Como la ganancia del limitador se mueve
  // despacio comparada con el filtro, filtrar y luego multiplicar da lo
  // mismo que al revés, y cada vuelta cuesta una multiplicación por muestra.
  const trozo = trozoDe(sampleRate);
  const filtrados = canales.map((c) => filtrarK(c, sampleRate));
  let techoInterno = techo;
  let limitador: Float32Array = new Float32Array(0);
  /** La ganancia del limitador SIEMPRE se calcula para la ganancia que se aplica. */
  const limitar = () => {
    const g = dbALin(gananciaDb);
    limitador = gananciaDeLimitador(envolventePara(g), g, techoInterno, sampleRate);
    return g;
  };

  for (let vuelta = 0; vuelta < 6; vuelta++) {
    const g = limitar();
    const lufs = integrar(
      filtrados.map((f) => energiaPorTrozos(f, trozo, g, limitador)),
      trozo,
    );
    const falta = objetivo.lufs - lufs;
    if (Math.abs(falta) < 0.03 || (falta > 0 && gananciaDb >= SUBIDA_MAXIMA_DB)) break;
    gananciaDb = Math.min(SUBIDA_MAXIMA_DB, gananciaDb + falta);
  }

  const salida = canales.map(() => new Float32Array(largo));
  const aplicar = () => {
    const g = limitar();
    canales.forEach((origen, c) => {
      const destino = salida[c];
      for (let i = 0; i < largo; i++) destino[i] = origen[i] * g * limitador[i];
    });
  };
  aplicar();

  /* Con mucho limitador (una batería sola, toda picos) la cuenta rápida se
     desvía: cada dB de ganancia ya no da un dB de sonoridad (el limitador
     se come parte). Se termina de afinar midiendo el audio de verdad, con
     el método de la secante (la pendiente sale de las dos últimas medidas),
     y si algún pico entre muestras se ha pasado del techo, se aprieta el
     techo del limitador eso mismo. Dos o tres vueltas. Una décima y media
     de LU arriba o abajo no la oye nadie, y Spotify normaliza igual. */
  let anterior: { g: number; lufs: number } | null = null;
  for (let vuelta = 0; vuelta < 4; vuelta++) {
    const lufs = sonoridadIntegrada(salida, sampleRate);
    const falta = objetivo.lufs - lufs;
    if (Math.abs(falta) < TOLERANCIA_LU || (falta > 0 && gananciaDb >= SUBIDA_MAXIMA_DB)) break;
    let pendiente = 1;
    if (anterior && Math.abs(gananciaDb - anterior.g) > 0.01) {
      pendiente = Math.min(1, Math.max(0.15, (lufs - anterior.lufs) / (gananciaDb - anterior.g)));
    }
    anterior = { g: gananciaDb, lufs };
    gananciaDb = Math.min(SUBIDA_MAXIMA_DB, gananciaDb + falta / pendiente);
    aplicar();
  }
  // El pico entre muestras, solo al final (interpolar es lo que más cuesta).
  for (let vuelta = 0; vuelta < 2; vuelta++) {
    const exceso = picoVerdadero(salida, sampleRate) - objetivo.techo;
    if (exceso <= 0) break;
    techoInterno *= dbALin(-(exceso + 0.05));
    aplicar();
  }

  // Red de seguridad: si algún pico entre muestras se ha escapado, se baja
  // todo lo justo. Prima el techo sobre la sonoridad.
  const pico = picoVerdadero(salida, sampleRate);
  if (pico > objetivo.techo) {
    const baja = dbALin(objetivo.techo - pico - 0.02);
    for (const destino of salida) for (let i = 0; i < largo; i++) destino[i] *= baja;
  }

  let minimo = 1;
  for (let i = 0; i < limitador.length; i++) if (limitador[i] < minimo) minimo = limitador[i];
  return {
    canales: salida,
    antes,
    despues: medir(salida, sampleRate),
    gananciaDb,
    limitadoDb: minimo < 1 ? -20 * Math.log10(minimo) : 0,
  };
}
