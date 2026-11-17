/**
 * Sonidos sintetizados nota a nota, para tocar con 0 MB descargados.
 *
 * Son el suelo del pilar B: lo que suena el primer día, sin red, y mientras
 * se bajan las muestras de un instrumento. Cada nota se calcula una vez en
 * TypeScript puro (la misma regla que la 0005 del músico de sesión) y se
 * guarda; tocarla otra vez es reproducir un buffer.
 */

import { sintetizarBajo, sintetizarTeclas } from '@/lib/musico/sintetizador';
import { frecuencia } from '@/lib/musico/teoria';
import { pulsarCuerda } from './cuerda';

export type TimbreSintetico = 'piano' | 'epiano' | 'colchon' | 'bajo' | 'cuerda';

/** Segundos de cada nota sintetizada: lo que tarda en apagarse de forma natural. */
export const LARGO_NOTA: Record<TimbreSintetico, number> = {
  piano: 3,
  epiano: 3,
  colchon: 4.5,
  bajo: 2.2,
  cuerda: 3.2,
};

/**
 * Piano eléctrico por FM: una portadora y una moduladora a la misma
 * frecuencia cuyo índice cae deprisa (el «tine» del Rhodes al golpear) y una
 * pizca de campana a 14 veces la fundamental en el ataque.
 */
function pianoElectrico(midi: number, vel: number, sr: number, duracion: number): Float32Array {
  const f0 = frecuencia(midi);
  const n = Math.round(duracion * sr);
  const out = new Float32Array(n);
  const indice = 1.2 + 2.2 * vel;
  const caida = 1.1 + Math.max(0, (midi - 48) / 36);
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const ataque = Math.min(1, t / 0.002);
    const env = ataque * Math.exp(-t * caida);
    const mod = indice * Math.exp(-t * 6) * Math.sin(2 * Math.PI * f0 * t);
    const campana = 0.12 * vel * Math.exp(-t * 28) * Math.sin(2 * Math.PI * f0 * 14 * t);
    out[i] = (Math.sin(2 * Math.PI * f0 * t + mod) + campana) * env * 0.42;
  }
  const fundido = Math.min(n, Math.round(0.05 * sr));
  for (let i = 0; i < fundido; i++) out[n - 1 - i] *= i / fundido;
  return out;
}

/** Una nota suelta del timbre pedido, a fuerza `vel` (0..1). */
export function sintetizarNota(timbre: TimbreSintetico, midi: number, vel: number, sampleRate: number): Float32Array {
  const duracion = LARGO_NOTA[timbre];
  switch (timbre) {
    case 'cuerda':
      return pulsarCuerda(midi, vel, { sampleRate, duracion });
    case 'epiano':
      return pianoElectrico(midi, vel, sampleRate, duracion);
    case 'bajo':
      return sintetizarBajo([{ inicio: 0, duracion: duracion - 0.1, midi, velocidad: vel }], {
        sampleRate,
        duracion,
        brillo: 0.35 + vel * 0.3,
      });
    case 'piano':
    case 'colchon':
      return sintetizarTeclas([{ inicio: 0, duracion: duracion - 0.4, midi, velocidad: vel }], {
        sampleRate,
        duracion,
        timbre,
      });
  }
}
