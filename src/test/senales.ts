/**
 * Señales de prueba: una guitarra rasgueando acordes, hecha con senos. Lo
 * justo para que los tests del oído y del bajista trabajen con algo que se
 * parezca a una toma de verdad (ataque por pulso, armónicos, nota grave).
 */

import { frecuencia, notasDelAcorde, type Acorde } from '@/lib/musico/teoria';

export const SR = 48000;

export interface Tramo {
  acorde: Acorde;
  pulsos: number;
}

/** Nota MIDI de la clase pedida dentro de [desde, desde + 11]. */
function enRegistro(clase: number, desde: number): number {
  return desde + ((clase - (desde % 12) + 12) % 12);
}

export function rasgueo(tramos: Tramo[], bpm: number, silencioInicial = 0): Float32Array {
  const pulso = 60 / bpm;
  const total = silencioInicial + tramos.reduce((s, t) => s + t.pulsos, 0) * pulso;
  const out = new Float32Array(Math.ceil(total * SR));
  let t0 = silencioInicial;
  for (const tramo of tramos) {
    const [r, tercera, quinta] = notasDelAcorde(tramo.acorde);
    // Voicing de guitarra: raíz grave, quinta, raíz, tercera, quinta.
    const notas = [
      enRegistro(r, 40),
      enRegistro(quinta, 47),
      enRegistro(r, 52),
      enRegistro(tercera, 55),
      enRegistro(quinta, 59),
    ];
    for (let p = 0; p < tramo.pulsos; p++) {
      const inicio = Math.round((t0 + p * pulso) * SR);
      const largo = Math.round(pulso * SR);
      for (let i = 0; i < largo && inicio + i < out.length; i++) {
        const t = i / SR;
        const env = Math.min(1, t / 0.003) * Math.exp(-t * 4);
        let s = 0;
        notas.forEach((midi, n) => {
          const f = frecuencia(midi);
          const peso = n === 0 ? 1.2 : 0.8;
          s += peso * (Math.sin(2 * Math.PI * f * t) + 0.35 * Math.sin(4 * Math.PI * f * t));
        });
        out[inicio + i] += s * env * 0.12;
      }
    }
    t0 += tramo.pulsos * pulso;
  }
  return out;
}

/** Posturas de guitarra reales (de la sexta a la primera, solo lo que suena). */
export const POSTURAS: Record<string, number[]> = {
  'La m': [45, 52, 57, 60, 64],
  Sol: [43, 47, 50, 55, 59, 67],
  Fa: [41, 48, 53, 57, 60, 65],
  Mi: [40, 47, 52, 56, 59, 64],
  Do: [48, 52, 55, 60, 64],
  Re: [50, 57, 62, 66],
  'Mi m': [40, 47, 52, 55, 59, 64],
};

/**
 * Una guitarra de verdad, o casi: cuerdas con Karplus-Strong (ricas en
 * armónicos, como las de acero), rasgueo abajo y arriba con las cuerdas
 * escalonadas y la cola de cada acorde pisando el siguiente.
 */
export function guitarra(progresion: string[], bpm: number, vueltas = 2, pulsosPorAcorde = 4): Float32Array {
  const T = 60 / bpm;
  const total = vueltas * progresion.length * pulsosPorAcorde * T + 1;
  const out = new Float32Array(Math.round(total * SR));
  let semilla = 1;
  const rnd = () => ((semilla = (semilla * 16807) % 2147483647) / 2147483647) * 2 - 1;
  const cuerda = (midi: number, inicio: number, largo: number, fuerza: number) => {
    const n = Math.round(SR / frecuencia(midi));
    const linea = new Float32Array(n).map(() => rnd() * fuerza);
    const i0 = Math.round(inicio * SR);
    let k = 0;
    for (let i = 0; i < Math.round(largo * SR) && i0 + i < out.length; i++) {
      const a = linea[k];
      linea[k] = 0.996 * 0.5 * (a + linea[(k + 1) % n]);
      out[i0 + i] += a * 0.22;
      k = (k + 1) % n;
    }
  };
  let t = 0;
  for (let v = 0; v < vueltas; v++) {
    for (const nombre of progresion) {
      for (let p = 0; p < pulsosPorAcorde; p++) {
        const abajo = p % 2 === 0;
        const notas = abajo ? POSTURAS[nombre] : [...POSTURAS[nombre]].reverse();
        notas.forEach((midi, s) => cuerda(midi, t + s * 0.009, T * 1.1, abajo ? 1 : 0.6));
        t += T;
      }
    }
  }
  return out;
}

/** Clics cortos en los pulsos: un metrónomo para probar desfases. */
export function clics(bpm: number, segundos: number, desplazamiento = 0): Float32Array {
  const out = new Float32Array(Math.ceil(segundos * SR));
  for (let t = desplazamiento; t < segundos; t += 60 / bpm) {
    const i0 = Math.round(t * SR);
    for (let i = 0; i < 240 && i0 + i < out.length; i++) out[i0 + i] = Math.sin(i * 0.9) * Math.exp(-i / 40);
  }
  return out;
}

/** Frecuencia dominante entre dos límites, por DFT directa. */
export function frecuenciaDominante(samples: Float32Array, sr: number, min: number, max: number): number {
  let mejor = min;
  let mejorMag = -1;
  for (let f = min; f <= max; f += 0.5) {
    let re = 0;
    let im = 0;
    const w = (2 * Math.PI * f) / sr;
    for (let i = 0; i < samples.length; i += 2) {
      re += samples[i] * Math.cos(w * i);
      im += samples[i] * Math.sin(w * i);
    }
    const mag = re * re + im * im;
    if (mag > mejorMag) {
      mejorMag = mag;
      mejor = f;
    }
  }
  return mejor;
}
