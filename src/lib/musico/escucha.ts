/**
 * Lo que oye el músico de sesión antes de tocar: tempo, dónde cae el pulso,
 * tonalidad y acordes. Todo en el móvil, sin red, en lo que se tarda en abrir
 * la hoja.
 */

import { detectarTempo } from '@/lib/daw/analysis/tempo';
import { detectarTonalidad, type KeyResult } from '@/lib/daw/analysis/key';
import { detectarAcordes, resumenProgresion, type AcordeEnTiempo } from './acordes';
import { afinarTempo, estimarFase } from './pulso';

export interface Escucha {
  bpm: number;
  /** De dónde sale el tempo: la claqueta del proyecto o lo que has tocado. */
  fuenteBpm: 'proyecto' | 'toma';
  fase: number;
  tonalidad: KeyResult | null;
  acordes: AcordeEnTiempo[];
  progresion: string;
  duracion: number;
}

/** ¿Es el mismo tempo, o su doble o su mitad, con un 3 % de margen? */
function cuadraCon(a: number, b: number): boolean {
  return [1, 2, 0.5].some((k) => Math.abs(a * k - b) / b < 0.03);
}

export function escucharToma(samples: Float32Array, sampleRate: number, bpmProyecto: number): Escucha {
  const duracion = samples.length / sampleRate;
  const tempo = detectarTempo(samples, sampleRate);
  // El detector da el tempo a la unidad; aquí se afina a la décima.
  if (tempo.bpm > 0) tempo.bpm = afinarTempo(samples, sampleRate, tempo.bpm);

  /* Si lo que has tocado cuadra con la claqueta, manda la claqueta: es la
     rejilla en la que vive todo lo demás. Si no cuadra y el pulso de la toma
     es claro, has tocado libre y manda la toma. */
  let bpm = bpmProyecto;
  let fuenteBpm: Escucha['fuenteBpm'] = 'proyecto';
  if (tempo.bpm > 0 && !cuadraCon(tempo.bpm, bpmProyecto) && tempo.confianza >= 0.3) {
    bpm = tempo.bpm;
    fuenteBpm = 'toma';
  }

  const fase = estimarFase(samples, sampleRate, bpm);
  const key = detectarTonalidad(samples, sampleRate);
  const tonalidad = key && key.confianza > 0.15 ? key : null;
  const acordes = detectarAcordes(samples, sampleRate, {
    bpm,
    fase,
    tonalidad: tonalidad ? { tonica: tonalidad.tonica, modo: tonalidad.modo } : null,
  });

  return { bpm, fuenteBpm, fase, tonalidad, acordes, progresion: resumenProgresion(acordes), duracion };
}
