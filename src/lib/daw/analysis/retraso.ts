/**
 * Cuánto llega tarde una toma.
 *
 * La compensación de latencia es una cifra: lo que tarda el sonido en salir
 * por el altavoz y volver por el micro. Si la cifra es buena, lo que tocas cae
 * donde lo oíste. Si es mala, y a ciegas lo es (en el PC el navegador no dice
 * nada de la latencia de entrada y se queda corto con la de salida), cada toma
 * sale un poco tarde y hay que moverla a mano.
 *
 * Pero la propia toma dice cuánto se equivocó la cifra. Si grabaste con algo
 * sonando (la claqueta, el ritmo u otras pistas), tus golpes se reparten
 * alrededor de esa referencia; si se reparten alrededor de un punto 34 ms por
 * detrás, ese es el error que queda. Aquí se mide. Quien llama decide si mueve
 * la toma y cuánto aprende para la siguiente: la máquina se adapta a ti.
 *
 * Los ataques de `musico/pulso.ts` van en saltos de 10 ms, que es de sobra
 * para encontrar un pulso pero no para medir un desfase en milisegundos. Aquí
 * la envolvente va de milisegundo en milisegundo y el arranque de cada golpe
 * se interpola entre dos valores.
 */

import type { Clip, Track } from '../types';
import { trackEnd } from '../types';

export interface Golpe {
  /** Segundos desde la primera muestra. */
  t: number;
  /** Cuánto sube la energía: los acentos pesan más que los roces. */
  fuerza: number;
}

export interface Retraso {
  /** Positivo = la toma llega tarde; negativo = se adelanta. */
  segundos: number;
  /** 0..1. Por debajo de `CONFIANZA_MINIMA` no se toca nada. */
  confianza: number;
  /** Golpes que han votado el resultado. */
  golpes: number;
}

/** Con menos golpes que estos no se opina. */
export const MIN_GOLPES = 6;
/** Por debajo de esto la medida no mueve la toma ni enseña nada. */
export const CONFIANZA_MINIMA = 0.5;

/** Las envolventes dan un valor por milisegundo. */
const PASO = 0.001;
/**
 * Ventana para ENCONTRAR golpes, en pasos. Corta (10 ms) se cuela el batido
 * entre las notas graves de un acorde (La y Mi baten a 55 Hz) y cada acorde
 * sostenido parece una ráfaga de golpes; con 30 ms ese rizo se promedia.
 */
const ANCHA = 30;
/** Ventana para SITUAR cada golpe, en pasos: corta, para no perder precisión. */
const FINA = 10;
/** Dos golpes no se cuentan si están más cerca que esto, en pasos. */
const SEPARACION = 40;
/** Anchura del voto de cada golpe, en segundos. */
const SIGMA = 0.006;
/** Cuánto puede separarse un golpe del consenso y seguir contando. */
const MARGEN = 0.035;
/** Contra otras pistas: hasta dónde se busca la pareja de cada golpe. */
const BUSCA_TARDE = 0.16;
const BUSCA_PRONTO = 0.08;
/** Si la claqueta y las pistas dicen cosas distintas, no se toca nada. */
const DISCREPANCIA = 0.02;

/* -------------------------------------------------------------------------- */
/* Golpes                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Energía en ventanas que TERMINAN en cada milisegundo (la fina, de 10 ms, y
 * la ancha, de 30). Miran hacia atrás a propósito: así la fina sube justo
 * después del ataque y no antes, y el instante que se mide no se adelanta
 * media ventana.
 */
function envolventes(samples: Float32Array, sampleRate: number) {
  const salto = Math.max(1, Math.round(sampleRate * PASO));
  const bloques = Math.floor(samples.length / salto);
  const energia = new Float64Array(bloques);
  for (let b = 0; b < bloques; b++) {
    let suma = 0;
    const desde = b * salto;
    for (let i = desde; i < desde + salto; i++) suma += samples[i] * samples[i];
    energia[b] = suma;
  }
  const media = (ventana: number) => {
    const env = new Float32Array(bloques + 1);
    let suma = 0;
    for (let j = 1; j <= bloques; j++) {
      suma += energia[j - 1];
      if (j > ventana) suma -= energia[j - 1 - ventana];
      env[j] = Math.sqrt(Math.max(0, suma) / (Math.min(j, ventana) * salto));
    }
    return env;
  };
  return { fina: media(FINA), ancha: media(ANCHA), segundosPorPaso: salto / sampleRate };
}

/**
 * Dónde empieza cada golpe de una toma, con precisión de milisegundo.
 *
 * Primero se encuentra: en cada punto se compara la energía de los 30 ms
 * siguientes con la de los 30 anteriores, y un golpe es donde ese escalón es
 * máximo, sube al menos un 40 % (3 dB) y llega al 5 % del golpe más fuerte de
 * la toma. Después se sitúa con la envolvente fina: el instante no es el pico
 * (llega tarde y depende del instrumento) sino el arranque, el punto en el que
 * la energía ha recorrido un cuarto del camino desde el valle.
 */
export function detectarGolpes(samples: Float32Array, sampleRate: number): Golpe[] {
  const { fina, ancha, segundosPorPaso } = envolventes(samples, sampleRate);
  const n = ancha.length;
  if (n < ANCHA * 4) return [];

  let alto = 0;
  for (let j = 0; j < n; j++) if (ancha[j] > alto) alto = ancha[j];
  if (alto < 1e-4) return [];

  // Escalón en j: lo que suena en [j, j+30) frente a lo que sonaba en [j-30, j).
  const escalon = new Float32Array(n);
  for (let j = ANCHA; j + ANCHA < n; j++) {
    const antes = ancha[j];
    const despues = ancha[j + ANCHA];
    if (despues >= 1.4 * antes) escalon[j] = despues - antes;
  }

  const golpes: Golpe[] = [];
  let siguiente = 0;
  for (let j = ANCHA; j + ANCHA < n; j++) {
    if (j < siguiente) continue;
    const s = escalon[j];
    if (s < 0.05 * alto) continue;

    // Solo el punto donde más sube en ±25 ms; el resto es el mismo golpe.
    let esPico = true;
    for (let k = Math.max(0, j - 25); k <= Math.min(n - 1, j + 25); k++) {
      if (escalon[k] > s || (escalon[k] === s && k < j)) {
        esPico = false;
        break;
      }
    }
    if (!esPico) continue;

    /* El escalón dice que la nota nueva está en [j, j+30), no dónde empieza:
       con un golpe muy corto (un click, un golpe de cajón) el escalón es una
       meseta de 25 ms. Se sitúa con la fina: la cima de la nota nueva, el
       valle de antes, y desde la cima hacia atrás hasta que la energía baja
       del cuarto del camino. Ir hacia atrás y no hacia delante es lo que
       evita que el rizo de la nota anterior cruce el umbral antes de tiempo. */
    let cima = j;
    for (let k = j; k <= Math.min(n - 1, j + ANCHA + 10); k++) if (fina[k] > fina[cima]) cima = k;
    let valle = cima;
    for (let k = cima - 1; k >= Math.max(1, j - 25); k--) if (fina[k] < fina[valle]) valle = k;
    const umbral = fina[valle] + 0.25 * (fina[cima] - fina[valle]);
    let cruce = cima;
    while (cruce > valle + 1 && fina[cruce - 1] >= umbral) cruce--;
    const a = fina[cruce - 1];
    const b = fina[cruce];
    const fraccion = b > a ? Math.min(1, Math.max(0, (umbral - a) / (b - a))) : 0;

    golpes.push({ t: (cruce - 1 + fraccion) * segundosPorPaso, fuerza: s });
    siguiente = j + SEPARACION;
  }
  return golpes;
}

/* -------------------------------------------------------------------------- */
/* Consenso                                                                    */
/* -------------------------------------------------------------------------- */

interface Voto {
  /** Índice del golpe que vota. */
  golpe: number;
  /** Cuánto llega tarde respecto a su referencia, en segundos. */
  d: number;
}

function mediana(valores: number[]): number {
  const orden = [...valores].sort((a, b) => a - b);
  const mitad = Math.floor(orden.length / 2);
  return orden.length % 2 ? orden[mitad] : (orden[mitad - 1] + orden[mitad]) / 2;
}

function limitar(valor: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, valor));
}

/**
 * Los acentos pesan más que los roces, pero ninguno más que uno: un golpe
 * contra el micro no puede decidir él solo.
 */
function pesos(golpes: Golpe[]): number[] {
  const referencia = Math.max(1e-9, mediana(golpes.map((g) => g.fuerza)) * 2);
  return golpes.map((g) => Math.min(1, g.fuerza / referencia));
}

/**
 * Cada golpe vota cuánto llega tarde. Se busca el desfase en el que más votos
 * coinciden (no la media: la media de un rasgueo con algún golpe a
 * contratiempo no es ningún sitio), se quedan los golpes que caen cerca y la
 * medida es su mediana.
 *
 * La confianza junta cuatro cosas: cuántos golpes votan, lo apretados que
 * están, qué parte de la toma los acompaña y si hay otro desfase casi igual
 * de votado (tocar semicorcheas contra una rejilla de corcheas, por ejemplo,
 * deja dos montones y no se sabe cuál es el bueno).
 */
function consenso(
  votos: Voto[],
  peso: number[],
  desde: number,
  hasta: number,
  periodo: number | null,
): Retraso | null {
  if (votos.length < MIN_GOLPES) return null;
  const dist = (a: number, b: number) => {
    const x = a - b;
    return periodo ? x - periodo * Math.round(x / periodo) : x;
  };

  const celdas = Math.max(1, Math.floor((hasta - desde) / PASO));
  const densidad = new Float64Array(celdas);
  for (const voto of votos) {
    const w = peso[voto.golpe];
    for (let k = 0; k < celdas; k++) {
      const x = dist(desde + k * PASO, voto.d) / SIGMA;
      if (x > -4 && x < 4) densidad[k] += w * Math.exp(-0.5 * x * x);
    }
  }

  let mejor = 0;
  for (let k = 1; k < celdas; k++) if (densidad[k] > densidad[mejor]) mejor = k;
  const moda = desde + mejor * PASO;
  if (densidad[mejor] <= 0) return null;

  // El segundo montón: el pico local más alto lejos del primero.
  let segundo = 0;
  for (let k = 0; k < celdas; k++) {
    const prev = periodo ? densidad[(k - 1 + celdas) % celdas] : (densidad[k - 1] ?? 0);
    const next = periodo ? densidad[(k + 1) % celdas] : (densidad[k + 1] ?? 0);
    if (densidad[k] < prev || densidad[k] < next) continue;
    if (Math.abs(dist(desde + k * PASO, moda)) <= MARGEN) continue;
    segundo = Math.max(segundo, densidad[k]);
  }

  // Cada golpe se queda con su voto más cercano al consenso.
  const elegido = new Map<number, number>();
  for (const voto of votos) {
    const desvio = dist(voto.d, moda);
    const actual = elegido.get(voto.golpe);
    if (actual === undefined || Math.abs(desvio) < Math.abs(actual)) elegido.set(voto.golpe, desvio);
  }
  const dentro: number[] = [];
  let pesoDentro = 0;
  let pesoTotal = 0;
  for (const [golpe, desvio] of elegido) {
    pesoTotal += peso[golpe];
    if (Math.abs(desvio) > MARGEN) continue;
    dentro.push(moda + desvio);
    pesoDentro += peso[golpe];
  }
  if (dentro.length < MIN_GOLPES) return null;

  const centro = mediana(dentro);
  const mad = mediana(dentro.map((d) => Math.abs(d - centro)));

  const cuenta = Math.min(1, dentro.length / 10);
  const apretados = limitar((0.02 - mad) / 0.01, 0, 1);
  const acompanan = limitar((pesoDentro / Math.max(1e-9, pesoTotal) - 0.3) / 0.3, 0, 1);
  const unico = 1 - limitar(segundo / densidad[mejor], 0, 1);

  return {
    segundos: centro,
    confianza: cuenta * apretados * acompanan * unico,
    golpes: dentro.length,
  };
}

/* -------------------------------------------------------------------------- */
/* Medidas                                                                     */
/* -------------------------------------------------------------------------- */

export interface OpcionesRejilla {
  bpm: number;
  /** Tiempo del proyecto en el que cae la primera muestra de la toma. */
  inicio: number;
}

/**
 * Contra la rejilla del proyecto: corcheas del tempo, ancladas en el cero.
 * Es lo que suena cuando hay claqueta o ritmo. Cada golpe se compara con la
 * corchea más cercana, así que se puede medir hasta media corchea de retraso
 * (150 ms a 100 BPM); más allá ya no se sabe a qué corchea iba.
 */
export function medirRetraso(
  samples: Float32Array,
  sampleRate: number,
  { bpm, inicio }: OpcionesRejilla,
  golpes: Golpe[] = detectarGolpes(samples, sampleRate),
): Retraso | null {
  if (!(bpm > 0) || golpes.length < MIN_GOLPES) return null;
  const corchea = 60 / bpm / 2;
  const votos = golpes.map((golpe, i) => {
    const p = inicio + golpe.t;
    return { golpe: i, d: p - Math.round(p / corchea) * corchea };
  });
  return consenso(votos, pesos(golpes), -corchea / 2, corchea / 2, corchea);
}

export interface OpcionesReferencia {
  /** Tiempo del proyecto en el que cae la primera muestra de la toma. */
  inicio: number;
  /** Golpes de lo que sonaba mientras grababas, en tiempo del proyecto. */
  referencia: number[];
}

/**
 * Contra lo que sonaba de verdad: los golpes de las otras pistas. Es la
 * medida buena cuando la primera pista se tocó libre y no cae en la rejilla:
 * lo que tiene que cuadrar es la toma nueva con esa pista, no con un tempo
 * que nadie oyó.
 */
export function medirRetrasoContra(
  samples: Float32Array,
  sampleRate: number,
  { inicio, referencia }: OpcionesReferencia,
  golpes: Golpe[] = detectarGolpes(samples, sampleRate),
): Retraso | null {
  if (golpes.length < MIN_GOLPES || referencia.length < MIN_GOLPES) return null;
  const orden = [...referencia].sort((a, b) => a - b);
  const votos: Voto[] = [];
  golpes.forEach((golpe, i) => {
    const p = inicio + golpe.t;
    // Primera referencia que no queda más de BUSCA_TARDE por detrás.
    let lo = 0;
    let hi = orden.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (orden[mid] < p - BUSCA_TARDE) lo = mid + 1;
      else hi = mid;
    }
    for (let k = lo; k < orden.length && orden[k] <= p + BUSCA_PRONTO; k++) {
      votos.push({ golpe: i, d: p - orden[k] });
    }
  });
  return consenso(votos, pesos(golpes), -BUSCA_PRONTO, BUSCA_TARDE, null);
}

export interface OpcionesToma {
  /** Tiempo del proyecto en el que cae la primera muestra, ya compensada. */
  inicio: number;
  bpm: number;
  /** Sonaba la claqueta o el ritmo, que van en la rejilla. */
  rejilla: boolean;
  /** Golpes de las pistas que sonaban, en tiempo del proyecto. */
  referencia: number[];
}

function fiable(medida: Retraso | null): medida is Retraso {
  return !!medida && medida.confianza >= CONFIANZA_MINIMA;
}

/**
 * La medida de una toma recién grabada, contra lo que sonaba al grabarla.
 *
 * Con claqueta o ritmo manda la rejilla. Si además sonaban pistas y dicen
 * otra cosa (una primera toma libre que no cae en la rejilla, por ejemplo),
 * el músico tenía dos referencias que no cuadran entre sí y no se toca nada.
 * Sin claqueta, mandan las pistas.
 */
export function medirToma(samples: Float32Array, sampleRate: number, opciones: OpcionesToma): Retraso | null {
  const golpes = detectarGolpes(samples, sampleRate);
  const contraPistas =
    opciones.referencia.length >= MIN_GOLPES
      ? medirRetrasoContra(samples, sampleRate, opciones, golpes)
      : null;
  if (!opciones.rejilla) return contraPistas;

  const contraRejilla = medirRetraso(samples, sampleRate, opciones, golpes);
  if (fiable(contraRejilla) && fiable(contraPistas)) {
    return Math.abs(contraRejilla.segundos - contraPistas.segundos) > DISCREPANCIA ? null : contraRejilla;
  }
  if (fiable(contraRejilla)) return contraRejilla;
  if (fiable(contraPistas)) return contraPistas;
  return contraRejilla ?? contraPistas;
}

/* -------------------------------------------------------------------------- */
/* Lo que sonaba                                                               */
/* -------------------------------------------------------------------------- */

/** Las pistas que se oían entre `desde` y `hasta`, con el mismo criterio de mute y solo que el motor. */
export function pistasQueSonaban(tracks: Track[], desde: number, hasta: number): Track[] {
  const haySolo = tracks.some((track) => track.soloed);
  return tracks.filter(
    (track) =>
      (haySolo ? track.soloed : !track.muted) && track.clip.start < hasta && trackEnd(track) > desde,
  );
}

/** Golpes de una pista ya colocada, en tiempo del proyecto, entre `desde` y `hasta`. */
export function golpesDePista(
  samples: Float32Array,
  sampleRate: number,
  clip: Clip,
  desde: number,
  hasta: number,
): number[] {
  const i0 = Math.max(0, Math.floor(clip.offset * sampleRate));
  const i1 = Math.min(samples.length, Math.floor((clip.offset + clip.duration) * sampleRate));
  if (i1 - i0 < sampleRate * 0.1) return [];
  const golpes = detectarGolpes(samples.subarray(i0, i1), sampleRate);
  const salida: number[] = [];
  const vueltas = Math.max(1, Math.floor(clip.repeats));
  for (let v = 0; v < vueltas; v++) {
    const base = clip.start + v * clip.duration;
    if (base > hasta || base + clip.duration < desde) continue;
    for (const golpe of golpes) {
      const p = base + golpe.t;
      if (p >= desde && p <= hasta) salida.push(p);
    }
  }
  return salida;
}

/* -------------------------------------------------------------------------- */
/* Qué se hace con la medida                                                   */
/* -------------------------------------------------------------------------- */

export interface Correccion {
  /** Cuánto se adelanta la toma, en segundos. Negativo = se retrasa. */
  adelanto: number;
  /** Cuánto se suma a la compensación para las próximas tomas, en ms. */
  aprendizajeMs: number;
}

/** Por debajo de esto no se oye y no se toca. */
const ZONA_MUERTA_MS = 8;
/** Más allá de esto no es latencia: es otra cosa y no se toca. */
const MAXIMO_MS = 150;
/** Qué parte del error se aprende en cada toma: llega sin pasarse. */
const RITMO_APRENDIZAJE = 0.7;

/**
 * Qué hacer con una medida.
 *
 * Tarde entre 8 y 150 ms: la toma se adelanta entero lo medido, para que
 * ESTA caiga a tiempo, y la compensación aprende el 70 %, para que la
 * siguiente ya venga casi bien sin pasarse por un golpe mal tocado.
 *
 * Pronto: solo se deshace lo que se aprendió de más (`extraAprendidoMs`).
 * Por debajo de la cifra medida o estimada no se baja, porque adelantarse al
 * pulso también es cosa del músico, y eso no lo arregla la máquina.
 *
 * Dentro de ±8 ms la toma ya está bien: corrección cero, que también cuenta
 * como toma que confirma la cifra.
 */
export function decidirCorreccion(medida: Retraso | null, extraAprendidoMs: number): Correccion | null {
  if (!fiable(medida)) return null;
  const ms = medida.segundos * 1000;
  if (Math.abs(ms) < ZONA_MUERTA_MS) return { adelanto: 0, aprendizajeMs: 0 };
  if (Math.abs(ms) > MAXIMO_MS) return null;
  if (ms > 0) return { adelanto: ms / 1000, aprendizajeMs: ms * RITMO_APRENDIZAJE };
  const deshacer = Math.min(-ms, Math.max(0, extraAprendidoMs));
  if (deshacer < ZONA_MUERTA_MS / 2) return null;
  return {
    adelanto: -deshacer / 1000,
    aprendizajeMs: -Math.min(-ms * RITMO_APRENDIZAJE, deshacer),
  };
}
