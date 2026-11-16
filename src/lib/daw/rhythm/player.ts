/**
 * De patrón a sonido.
 *
 * El patrón se convierte en una lista de golpes con su posición en la línea de
 * tiempo, y de ahí al mismo reloj del AudioContext que usa todo lo demás. No
 * hay bucle de audio: el ritmo se REGENERA en cada vuelta, así que cambiar el
 * tempo, la intensidad o el propio ritmo mientras suena no tiene ninguna
 * costura que disimular.
 */

import { duracionPaso, getCompas, pasosPorCiclo } from './compases';
import { playVoice, type VoiceId } from './kit';
import type { Groove } from './grooves';

export interface GrooveOptions {
  /** Cuánto toca: a 0 solo quedan los golpes fuertes; a 1 el patrón entero. */
  complejidad: number;
  /** Cuánto pega. */
  fuerza: number;
  /** 0 = cuadrícula de máquina, 1 = mano suelta. */
  humano: number;
}

export const OPCIONES_POR_DEFECTO: GrooveOptions = {
  complejidad: 0.75,
  fuerza: 0.8,
  humano: 0.5,
};

export interface GolpeProgramado {
  posicion: number;
  voz: VoiceId;
  vel: number;
}

/** Aleatorio reproducible: el mismo compás suena igual dos veces seguidas. */
function ruidoDeterminista(a: number, b: number): number {
  const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Golpes del ritmo entre dos posiciones de la línea de tiempo. El patrón se
 * repite indefinidamente desde el segundo cero.
 */
export function golpesEntre(
  groove: Groove,
  bpm: number,
  desde: number,
  hasta: number,
  opciones: GrooveOptions,
): GolpeProgramado[] {
  const compas = getCompas(groove.compasId);
  const paso = duracionPaso(compas, bpm);
  const pasosPatron = pasosPorCiclo(compas) * Math.max(1, groove.ciclos);
  const duracionPatron = paso * pasosPatron;
  if (duracionPatron <= 0) return [];

  // Umbral de complejidad: los golpes flojos son los primeros en caerse.
  const umbral = (1 - opciones.complejidad) * 0.85;
  const jitter = opciones.humano * 0.012;

  const salida: GolpeProgramado[] = [];
  const primeraVuelta = Math.floor(desde / duracionPatron);
  const ultimaVuelta = Math.ceil(hasta / duracionPatron);

  for (let vuelta = primeraVuelta; vuelta <= ultimaVuelta; vuelta++) {
    const base = vuelta * duracionPatron;
    for (let i = 0; i < groove.hits.length; i++) {
      const hit = groove.hits[i];
      if (hit.vel < umbral) continue;

      const azar = ruidoDeterminista(vuelta * 97 + i, hit.paso);
      // El desvío va a los dos lados: adelantar un poco es tan humano como
      // atrasarse, y solo atrasar arrastra el ritmo hacia atrás.
      const desvio = (azar - 0.5) * 2 * jitter;
      const posicion = base + hit.paso * paso + desvio;
      if (posicion < desde || posicion >= hasta) continue;

      const variacion = 1 - opciones.humano * 0.25 * ruidoDeterminista(i, vuelta);
      salida.push({
        posicion,
        voz: hit.voz,
        vel: Math.max(0.05, Math.min(1, hit.vel * variacion * opciones.fuerza)),
      });
    }
  }

  salida.sort((a, b) => a.posicion - b.posicion);
  return salida;
}

/** Duración de una vuelta completa del patrón, en segundos. */
export function duracionPatron(groove: Groove, bpm: number): number {
  const compas = getCompas(groove.compasId);
  return duracionPaso(compas, bpm) * pasosPorCiclo(compas) * Math.max(1, groove.ciclos);
}

/**
 * Renderiza N vueltas del ritmo a un buffer. Es lo que convierte un ritmo en
 * una pista normal: a partir de ahí se mueve, se recorta y se repite como
 * cualquier toma grabada.
 */
export async function renderGroove(
  groove: Groove,
  bpm: number,
  opciones: GrooveOptions,
  vueltas: number,
  sampleRate: number,
): Promise<AudioBuffer> {
  const duracion = duracionPatron(groove, bpm) * vueltas;
  // Un pelín de cola para que no se corte la resonancia del último golpe.
  const total = duracion + 0.35;
  const offline = new OfflineAudioContext(1, Math.ceil(total * sampleRate), sampleRate);

  const master = offline.createGain();
  master.gain.value = 1;
  master.connect(offline.destination);

  for (const golpe of golpesEntre(groove, bpm, 0, duracion, opciones)) {
    playVoice(golpe.voz, offline, master, golpe.posicion, golpe.vel);
  }

  return offline.startRendering();
}
