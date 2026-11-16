/**
 * Un bajo eléctrico tocado con los dedos, hecho con sumas de senos.
 *
 * Es síntesis aditiva con un truco que lo acerca a una cuerda de verdad: los
 * armónicos agudos se apagan antes que la fundamental. Al pulsar, la nota
 * tiene brillo y ataque; medio segundo después queda el cuerpo redondo que
 * sostiene la canción. Se calcula aquí, en el móvil y sin red, en una
 * fracción de lo que dura la pista.
 *
 * Va en TypeScript puro y no en un OfflineAudioContext a propósito: así se
 * puede probar con tests sin navegador y suena igual en todos los móviles.
 */

import type { Nota } from './bajo';
import { frecuencia } from './teoria';

export interface OpcionesSintesis {
  sampleRate: number;
  /** Segundos de audio a devolver. */
  duracion: number;
  /** 0 = redondo y oscuro, 1 = con más púa. */
  brillo?: number;
}

const ARMONICOS = 10;
const ATAQUE = 0.004;
const SUELTA = 0.035;

export function sintetizarBajo(notas: Nota[], o: OpcionesSintesis): Float32Array {
  const { sampleRate: sr, duracion } = o;
  const brillo = Math.max(0, Math.min(1, o.brillo ?? 0.45));
  const out = new Float32Array(Math.max(0, Math.round(duracion * sr)));

  // Amplitud y velocidad de apagado de cada armónico, igual para todas las notas.
  const amplitudes = new Float32Array(ARMONICOS);
  const apagados = new Float32Array(ARMONICOS);
  for (let k = 1; k <= ARMONICOS; k++) {
    amplitudes[k - 1] = Math.pow(k, -(1.6 - brillo * 0.7));
    apagados[k - 1] = 1.1 + 1.4 * (k - 1) * (1.2 - brillo * 0.6);
  }

  for (const nota of notas) {
    const f0 = frecuencia(nota.midi);
    const desde = Math.max(0, Math.round(nota.inicio * sr));
    const largo = nota.duracion + SUELTA;
    const hasta = Math.min(out.length, Math.round((nota.inicio + largo) * sr));
    if (hasta <= desde) continue;
    const v = nota.velocidad;

    // Por encima de 8 kHz no se suma nada: no se oye en un bajo y evita el aliasing.
    let tope = ARMONICOS;
    while (tope > 1 && f0 * tope > 8000) tope--;

    for (let i = desde; i < hasta; i++) {
      const t = (i - desde) / sr;
      // Envolvente: ataque corto, cuerpo que decae y una suelta sin chasquido.
      let env = t < ATAQUE ? t / ATAQUE : Math.exp(-(t - ATAQUE) * 1.1);
      const restante = largo - t;
      if (restante < SUELTA) env *= Math.max(0, restante / SUELTA);

      let muestra = 0;
      const fase = 2 * Math.PI * f0 * t;
      for (let k = 0; k < tope; k++) {
        muestra += amplitudes[k] * Math.exp(-t * apagados[k]) * Math.sin(fase * (k + 1));
      }
      // El golpe del dedo: un rastro de ruido muy corto al principio.
      if (t < 0.012) muestra += (Math.sin(i * 12.9898) * 43758.5453 % 1) * 0.08 * (1 - t / 0.012);

      out[i] += muestra * env * v * 0.42;
    }
  }

  // Saturación suave: pega las notas entre sí y evita que nada pase de 1.
  for (let i = 0; i < out.length; i++) out[i] = Math.tanh(out[i] * 1.4) / Math.tanh(1.4);
  return out;
}

export type Timbre = 'piano' | 'colchon';

/**
 * Teclas. Dos timbres con la misma receta aditiva:
 *
 *   · «piano»: un piano eléctrico de púa suave. Ataque instantáneo, un
 *     armónico de campana que se apaga en décimas y un cuerpo que decae.
 *   · «colchon»: entra despacio, se sostiene y lleva dos osciladores
 *     desafinados unos centésimos, que es lo que hace que un pad «respire».
 */
export function sintetizarTeclas(
  notas: Nota[],
  o: OpcionesSintesis & { timbre?: Timbre },
): Float32Array {
  const { sampleRate: sr, duracion } = o;
  const colchon = o.timbre === 'colchon';
  const out = new Float32Array(Math.max(0, Math.round(duracion * sr)));
  const ataque = colchon ? 0.09 : 0.003;
  const suelta = colchon ? 0.35 : 0.14;
  const pesos = colchon ? [1, 0.42, 0.2, 0.11, 0.06, 0.03] : [1, 0.55, 0.12, 0.22, 0.05, 0.08, 0.02, 0.03];
  const desafino = colchon ? [-0.004, 0.004] : [0];

  for (const nota of notas) {
    const f0 = frecuencia(nota.midi);
    const desde = Math.max(0, Math.round(nota.inicio * sr));
    const largo = nota.duracion + suelta;
    const hasta = Math.min(out.length, Math.round((nota.inicio + largo) * sr));
    if (hasta <= desde) continue;
    let tope = pesos.length;
    while (tope > 1 && f0 * tope > 7000) tope--;

    for (let i = desde; i < hasta; i++) {
      const t = (i - desde) / sr;
      let env = t < ataque ? t / ataque : colchon ? 1 : Math.exp(-(t - ataque) * 1.6);
      if (t > nota.duracion) env *= Math.max(0, 1 - (t - nota.duracion) / suelta);

      let muestra = 0;
      for (const d of desafino) {
        const fase = 2 * Math.PI * f0 * (1 + d) * t;
        for (let k = 0; k < tope; k++) {
          // Los armónicos altos se apagan antes: el brillo es del golpe, no de la nota.
          const caida = colchon ? 1 : Math.exp(-t * (0.6 + k * 1.3));
          muestra += pesos[k] * caida * Math.sin(fase * (k + 1));
        }
      }
      out[i] += (muestra / desafino.length) * env * nota.velocidad * 0.16;
    }
  }

  for (let i = 0; i < out.length; i++) out[i] = Math.tanh(out[i] * 1.2) / Math.tanh(1.2);
  return out;
}
