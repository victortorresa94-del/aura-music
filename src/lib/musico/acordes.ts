/**
 * Qué acordes estás tocando, y cuándo.
 *
 * Es lo que necesita un bajista que entra a tocar contigo sin partitura:
 * escucha un par de vueltas y sabe que es «La m, Sol, Fa, Mi». Aquí se hace
 * igual, pulso a pulso:
 *
 *   1. Se trocea la toma en pulsos, empezando donde de verdad cae el primero.
 *   2. De cada trozo se saca el croma (cuánta energía hay en cada una de las
 *      doce notas) y la nota más grave, que es la que suele nombrar el acorde.
 *   3. Cada trozo se compara con los 24 acordes mayores y menores. Ayuda que
 *      el bajo coincida con la raíz y que el acorde quepa en la tonalidad.
 *   4. Un Viterbi decide la secuencia: cambiar de acorde cuesta, así que un
 *      golpe sucio no convierte un compás de La m en un La m-Do-La m.
 */

import { cromagrama, notaDelBajo } from '@/lib/daw/analysis/key';
import { ataques, SALTO } from './pulso';
import { acordesDiatonicos, nombreAcorde, notasDelAcorde, type Acorde, type Tonalidad } from './teoria';

export interface AcordeEnTiempo {
  /** Segundos desde el principio del audio analizado. */
  inicio: number;
  fin: number;
  /** null = no suena nada armónico (silencio o solo percusión). */
  acorde: Acorde | null;
  nombre: string;
}

export interface OpcionesAcordes {
  bpm: number;
  /** Segundo en el que cae el primer pulso completo. */
  fase: number;
  tonalidad?: Tonalidad | null;
}

const CANDIDATOS: Acorde[] = [];
for (let raiz = 0; raiz < 12; raiz++) {
  CANDIDATOS.push({ raiz, calidad: 'mayor' }, { raiz, calidad: 'menor' });
}

/** Puntuación de cada acorde contra un croma. Plantilla de tres notas, coseno. */
function puntuar(croma: Float32Array, bajo: number | null, diatonicos: Set<string>): number[] {
  let norma = 0;
  for (let i = 0; i < 12; i++) norma += croma[i] * croma[i];
  norma = Math.sqrt(norma) || 1;
  return CANDIDATOS.map((acorde) => {
    const [r, t, q] = notasDelAcorde(acorde);
    // Coseno contra una plantilla binaria de tres notas (norma √3).
    let puntos = (croma[r] + croma[t] + croma[q]) / (norma * Math.sqrt(3));
    if (bajo !== null) {
      if (bajo === r) puntos += 0.18;
      else if (bajo === t || bajo === q) puntos += 0.04;
    }
    if (diatonicos.has(`${acorde.raiz}:${acorde.calidad}`)) puntos += 0.06;
    return puntos;
  });
}

function rms(samples: Float32Array): number {
  let suma = 0;
  for (let i = 0; i < samples.length; i++) suma += samples[i] * samples[i];
  return Math.sqrt(suma / Math.max(1, samples.length));
}

/** La potencia de dos más grande que cabe en n, con un mínimo útil. */
function fftQueCabe(n: number, maximo: number): number {
  let size = 1024;
  while (size * 2 <= Math.min(n, maximo)) size *= 2;
  return size;
}

const CAMBIO = 0.14;

export function detectarAcordes(
  samples: Float32Array,
  sampleRate: number,
  opciones: OpcionesAcordes,
): AcordeEnTiempo[] {
  const { bpm, tonalidad } = opciones;
  const duracion = samples.length / sampleRate;
  if (bpm <= 0 || duracion < 0.5) return [];

  const pulso = 60 / bpm;
  const fase = ((opciones.fase % pulso) + pulso) % pulso;

  // Los trozos: la anacrusa (si la hay) y luego un pulso cada vez.
  const cortes: number[] = [0];
  for (let t = fase > 0.02 ? fase : pulso; t < duracion - 0.05; t += pulso) cortes.push(t);
  cortes.push(duracion);

  const diatonicos = new Set(
    (tonalidad ? acordesDiatonicos(tonalidad) : []).map((a) => `${a.raiz}:${a.calidad}`),
  );

  const trozos = cortes.slice(0, -1).map((inicio, i) => {
    const fin = cortes[i + 1];
    return samples.subarray(Math.floor(inicio * sampleRate), Math.floor(fin * sampleRate));
  });
  const energias = trozos.map(rms);
  const energiaMax = Math.max(...energias, 1e-9);

  // Emisiones: 24 acordes + «nada».
  const NADA = CANDIDATOS.length;
  const emisiones = trozos.map((trozo, i) => {
    const silencio = energias[i] < energiaMax * 0.04 || trozo.length < 1024;
    if (silencio) {
      const fila = new Array(NADA + 1).fill(0);
      fila[NADA] = 1;
      return fila;
    }
    const n = fftQueCabe(trozo.length, 8192);
    const croma = cromagrama(trozo, sampleRate, { n, freqMin: 70, freqMax: 1800 });
    const bajo = trozo.length >= 8192 ? notaDelBajo(trozo, sampleRate, fftQueCabe(trozo.length, 16384)) : null;
    const fila = puntuar(croma, bajo, diatonicos);
    fila.push(0.3);
    return fila;
  });

  /* Sin golpe no hay cambio. Un acorde nuevo entra con un rasgueo; si un
     trozo no empieza con un ataque, es la cola del anterior apagándose, y
     una cola que se apaga cambia de color (las cuerdas agudas aguantan más)
     sin que nadie haya cambiado de acorde. */
  const nov = ataques(samples, sampleRate);
  const golpes = cortes.slice(0, -1).map((inicio) => {
    const desde = Math.max(0, Math.round((inicio - 0.03) / SALTO));
    const hasta = Math.min(nov.length, Math.round((inicio + 0.06) / SALTO) + 1);
    let maximo = 0;
    for (let i = desde; i < hasta; i++) maximo = Math.max(maximo, nov[i]);
    return maximo;
  });
  const golpeMax = Math.max(...golpes, 1e-9);
  const costeCambio = golpes.map((g) => CAMBIO + (g < golpeMax * 0.2 ? 0.6 : 0));

  // Viterbi: la secuencia que más puntúa contando lo que cuesta cambiar.
  const estados = NADA + 1;
  let previo = emisiones[0].slice();
  const camino: number[][] = [];
  for (let s = 1; s < emisiones.length; s++) {
    let mejorPrevio = 0;
    for (let k = 1; k < estados; k++) if (previo[k] > previo[mejorPrevio]) mejorPrevio = k;
    const actual = new Array(estados);
    const desde = new Array(estados);
    for (let k = 0; k < estados; k++) {
      const quedarse = previo[k];
      const cambiar = previo[mejorPrevio] - costeCambio[s];
      if (quedarse >= cambiar) {
        actual[k] = quedarse + emisiones[s][k];
        desde[k] = k;
      } else {
        actual[k] = cambiar + emisiones[s][k];
        desde[k] = mejorPrevio;
      }
    }
    camino.push(desde);
    previo = actual;
  }
  let estado = 0;
  for (let k = 1; k < estados; k++) if (previo[k] > previo[estado]) estado = k;
  const secuencia = new Array<number>(emisiones.length);
  secuencia[emisiones.length - 1] = estado;
  for (let s = emisiones.length - 1; s > 0; s--) {
    estado = camino[s - 1][estado];
    secuencia[s - 1] = estado;
  }

  // Se juntan los pulsos seguidos con el mismo acorde (los candidatos son
  // objetos compartidos, así que basta con comparar la referencia).
  const resultado: AcordeEnTiempo[] = [];
  secuencia.forEach((k, i) => {
    const acorde = k === NADA ? null : CANDIDATOS[k];
    const ultimo = resultado[resultado.length - 1];
    if (ultimo && ultimo.acorde === acorde) {
      ultimo.fin = cortes[i + 1];
      return;
    }
    resultado.push({
      inicio: cortes[i],
      fin: cortes[i + 1],
      acorde,
      nombre: acorde ? nombreAcorde(acorde) : '—',
    });
  });

  // Una anacrusa de menos de medio pulso no es un acorde: se la queda el siguiente.
  if (resultado.length > 1 && resultado[0].fin - resultado[0].inicio < pulso / 2) {
    resultado[1].inicio = 0;
    resultado.shift();
  }

  /* Y al final, lo mismo pero al revés. Las canciones acaban sobre un acorde
     que se deja sonar; un acorde distinto que solo dura el último golpe suele
     ser la última mano rasgueada hacia arriba (la cuerda grave suena la
     última y la más floja) y no tiene una vuelta siguiente que lo corrija. Se
     lo queda el acorde anterior. */
  const armonicos = resultado.filter((a) => a.acorde);
  const ultimo = armonicos[armonicos.length - 1];
  const penultimo = armonicos[armonicos.length - 2];
  // Se cuentan los golpes, no los segundos: la cola que suena después del
  // último rasgueo no es una prueba de nada.
  const golpesDelUltimo = ultimo
    ? cortes.slice(0, -1).filter(
        (t, i) => t >= ultimo.inicio - 1e-6 && t < ultimo.fin - 1e-6 && golpes[i] >= golpeMax * 0.2,
      ).length
    : 0;
  if (ultimo && penultimo && golpesDelUltimo <= 1) {
    const i = resultado.indexOf(ultimo);
    if (resultado[i - 1] === penultimo) {
      penultimo.fin = ultimo.fin;
      resultado.splice(i, 1);
    }
  }
  return resultado;
}

/** La progresión en una línea, sin repetir vueltas: «La m · Sol · Fa · Mi». */
export function resumenProgresion(acordes: AcordeEnTiempo[], maximo = 8): string {
  const nombres = acordes.filter((a) => a.acorde).map((a) => a.nombre);
  // Si la progresión da vueltas, se enseña una sola.
  for (let largo = 1; largo <= nombres.length / 2; largo++) {
    const vuelta = nombres.slice(0, largo);
    const repite = nombres.every((n, i) => n === vuelta[i % largo]);
    if (repite) return vuelta.join(' · ');
  }
  const corta = nombres.slice(0, maximo).join(' · ');
  return nombres.length > maximo ? `${corta} …` : corta;
}
