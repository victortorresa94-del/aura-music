/**
 * El motor falso: suena en el móvil sin red y sin gastar. Para desarrollo
 * (`NEXT_PUBLIC_BOLSILLO_MOTOR=falso`, o sin Firebase en `next dev`) y para
 * los tests. No es IA y no se vende como tal: la receta lleva `motor: 'falso'`
 * y el botón dice «Gratis».
 *
 * Hace unos acordes suaves con envolvente (piano eléctrico de juguete y un
 * bajo), en una tonalidad y una progresión que salen de la semilla, al tempo
 * de la receta. Corto a propósito (como mucho 45 s): un WAV de 3 minutos son
 * 8 MB en el móvil para nada.
 *
 * Todo lo que necesita para sonar va en la referencia del trabajo: si se
 * cierra la app a medias, al volver se rehace igual (no hay nada que perder).
 */

import { codificarWav } from '@/lib/musico/wav';
import type { EstadoTrabajo, MotorDeCanciones, PeticionMotor, TrabajoIniciado } from './tipos';

export const SEGUNDOS_MAX_FALSO = 45;
const FRECUENCIA = 22050;

/** Semitonos de cada acorde sobre la tónica (grados de una escala mayor). */
const PROGRESIONES: number[][][] = [
  [[0, 4, 7], [7, 11, 14], [9, 12, 16], [5, 9, 12]], // I V vi IV
  [[9, 12, 16], [5, 9, 12], [0, 4, 7], [7, 11, 14]], // vi IV I V
  [[0, 4, 7], [9, 12, 16], [5, 9, 12], [7, 11, 14]], // I vi IV V
  [[2, 5, 9], [7, 11, 14], [0, 4, 7], [9, 12, 16]], // ii V I vi
];
const TONICAS = [0, 2, 3, 5, 7, 9]; // Do, Re, Mi♭, Fa, Sol, La

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

export interface DatosFalso {
  segundos: number;
  bpm: number;
  energia: number;
  semilla: number;
}

/** Los acordes, en muestras mono entre −1 y 1. Puro y determinista. */
export function sintetizarAcordes({ segundos, bpm, energia, semilla }: DatosFalso, frecuencia = FRECUENCIA): Float32Array {
  const total = Math.max(1, Math.round(Math.min(SEGUNDOS_MAX_FALSO, Math.max(3, segundos)) * frecuencia));
  const out = new Float32Array(total);
  const progresion = PROGRESIONES[semilla % PROGRESIONES.length];
  const tonica = 60 + TONICAS[Math.floor(semilla / PROGRESIONES.length) % TONICAS.length];
  const pulso = 60 / Math.max(50, Math.min(180, bpm));
  const durAcorde = pulso * 4;
  const brillo = 0.15 + 0.35 * Math.max(0, Math.min(1, energia));
  const ataque = 0.06;
  const cola = 0.25; // un acorde suena un poco por encima del siguiente: sin cortes

  for (let inicio = 0, k = 0; inicio < total / frecuencia; inicio += durAcorde, k++) {
    const acorde = progresion[k % progresion.length];
    const notas = [...acorde.map((s) => tonica + s), tonica + acorde[0] - 24];
    const desde = Math.floor(inicio * frecuencia);
    const hasta = Math.min(total, Math.floor((inicio + durAcorde + cola) * frecuencia));
    for (let i = desde; i < hasta; i++) {
      const t = (i - desde) / frecuencia;
      let env = t < ataque ? t / ataque : Math.exp(-(t - ataque) * 0.9) * 0.7 + 0.3;
      if (t > durAcorde) env *= Math.max(0, 1 - (t - durAcorde) / cola);
      // Con energía, un latido suave en cada pulso.
      const latido = energia > 0.55 ? 0.75 + 0.25 * Math.exp(-((t % pulso) / pulso) * 6) : 1;
      let s = 0;
      for (let n = 0; n < notas.length; n++) {
        const f = hz(notas[n]);
        const fase = 2 * Math.PI * f * (i / frecuencia);
        const peso = n === notas.length - 1 ? 0.9 : 0.5;
        s += peso * (Math.sin(fase) + brillo * Math.sin(2 * fase));
      }
      out[i] += s * env * latido;
    }
  }
  // Entrada y salida suaves, y un pico cómodo.
  const fundido = Math.min(Math.floor(frecuencia * 1.2), Math.floor(total / 4));
  let pico = 0;
  for (let i = 0; i < total; i++) {
    if (i < fundido) out[i] *= i / fundido;
    if (i > total - fundido) out[i] *= (total - i) / fundido;
    pico = Math.max(pico, Math.abs(out[i]));
  }
  const ganancia = pico > 0 ? 0.7 / pico : 0;
  for (let i = 0; i < total; i++) out[i] *= ganancia;
  return out;
}

export function wavFalso(datos: DatosFalso): Blob {
  return new Blob([codificarWav(sintetizarAcordes(datos), FRECUENCIA)], { type: 'audio/wav' });
}

export function crearMotorFalso(opciones: { retrasoMs?: number; ahora?: () => number } = {}): MotorDeCanciones {
  const retrasoMs = opciones.retrasoMs ?? 2500;
  const ahora = opciones.ahora ?? Date.now;
  return {
    id: 'falso',
    gratis: true,
    async iniciar(p: PeticionMotor): Promise<TrabajoIniciado> {
      const referencia = {
        falso: '1',
        listaEn: String(ahora() + retrasoMs),
        segundos: String(Math.round(p.segundos)),
        bpm: String(Math.round(p.bpm ?? 80)),
        energia: String(p.energia ?? 0.4),
        semilla: String((p.semilla ?? 0) >>> 0),
        ...(p.letra ? { letra: p.letra } : {}),
      };
      return { referencia, estado: { estado: 'en-cola' } };
    },
    async consultar(r: Record<string, string>): Promise<EstadoTrabajo> {
      if (r.falso !== '1') return { estado: 'fallo', error: 'Este trabajo no es del motor de prueba.' };
      if (ahora() < Number(r.listaEn)) return { estado: 'generando' };
      const audio = wavFalso({
        segundos: Number(r.segundos) || 30,
        bpm: Number(r.bpm) || 80,
        energia: Number(r.energia) || 0.4,
        semilla: Number(r.semilla) || 0,
      });
      return {
        estado: 'lista',
        audio,
        ...(r.letra ? { letra: r.letra } : {}),
        aviso: 'Motor de prueba: esto no es IA, son unos acordes para probar la app.',
        modelo: 'motor de prueba',
      };
    },
  };
}
