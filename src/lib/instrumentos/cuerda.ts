/**
 * Una cuerda pulsada, con el algoritmo de Karplus-Strong ampliado (Jaffe y
 * Smith, «Extensions of the Karplus-Strong Plucked-String Algorithm», 1983).
 *
 * Una línea de retardo del largo de un periodo se llena de ruido (la púa) y se
 * hace dar vueltas pasando por un filtro que apaga antes los agudos. Lo que
 * sale es, sorprendentemente, una guitarra: ataque brillante y cola cada vez
 * más redonda, como una cuerda de verdad.
 *
 * Va en TypeScript puro y no en un AudioWorklet a propósito (ver 0015 en
 * `docs/DECISIONES.md`): la misma función hace la nota que suena al tocar y
 * la que va al WAV, se prueba sin navegador y, guardada en caché por nota, en
 * el segundo toque no cuesta nada.
 */

import { aleatorio, frecuencia } from '@/lib/musico/teoria';

export interface OpcionesCuerda {
  sampleRate: number;
  /** Segundos de audio. Por defecto, lo que tarda en apagarse. */
  duracion?: number;
  /** 0 = púa blanda y cuerda vieja, 1 = púa dura y cuerdas nuevas. */
  brillo?: number;
  /** Dónde se pulsa, en fracción de la cuerda: 0,13 es cerca del puente. */
  posicion?: number;
  /** Segundos que tarda en caer 60 dB la nota más grave (Mi2). */
  sostenido?: number;
  semilla?: number;
}

/**
 * Devuelve la nota pulsada. `vel` va de 0 a 1 y cambia el volumen y el
 * brillo, como al tocar más fuerte.
 */
export function pulsarCuerda(midi: number, vel: number, o: OpcionesCuerda): Float32Array {
  const sr = o.sampleRate;
  const f0 = frecuencia(midi);
  const fuerza = Math.max(0.05, Math.min(1, vel));
  const brillo = Math.max(0, Math.min(1, (o.brillo ?? 0.6) * (0.55 + 0.45 * fuerza)));
  // Las cuerdas graves suenan más tiempo que las agudas.
  const sostenidoGrave = o.sostenido ?? 4.2;
  const t60 = Math.max(0.6, sostenidoGrave * Math.pow(82.4 / f0, 0.45));
  const duracion = o.duracion ?? Math.min(6, t60 * 0.9);
  const largo = Math.max(1, Math.round(duracion * sr));

  // Periodo en muestras: parte entera en la línea, el resto en un pasatodo.
  // El promediador del lazo ya retrasa media muestra.
  const periodo = sr / f0;
  const L = Math.max(2, Math.floor(periodo - 0.5));
  const fraccion = periodo - L - 0.5;
  const C = (1 - fraccion) / (1 + fraccion);

  // Pérdida por vuelta para que la nota caiga 60 dB en t60 segundos.
  const rho = Math.pow(0.001, 1 / (f0 * t60));

  // La púa: ruido, suavizado según el brillo, con el filtro de peine de la
  // posición de pulsado (pulsar cerca del puente quita los armónicos que
  // tienen un nodo justo ahí).
  const azar = aleatorio(o.semilla ?? midi * 7919 + 13);
  const linea = new Float32Array(L);
  const suavizado = 0.15 + 0.8 * (1 - brillo);
  let anterior = 0;
  for (let i = 0; i < L; i++) {
    const blanco = azar() * 2 - 1;
    anterior = anterior * suavizado + blanco * (1 - suavizado);
    linea[i] = anterior;
  }
  const hueco = Math.max(1, Math.round((o.posicion ?? 0.13) * L));
  const excitacion = new Float32Array(L);
  for (let i = 0; i < L; i++) excitacion[i] = linea[i] - (i >= hueco ? linea[i - hueco] : 0);
  // Sin continua: una púa no empuja la cuerda hacia un lado para siempre.
  let media = 0;
  for (let i = 0; i < L; i++) media += excitacion[i];
  media /= L;
  let pico = 1e-9;
  for (let i = 0; i < L; i++) {
    excitacion[i] -= media;
    pico = Math.max(pico, Math.abs(excitacion[i]));
  }
  for (let i = 0; i < L; i++) linea[i] = (excitacion[i] / pico) * fuerza;

  const salida = new Float32Array(largo);
  let idx = 0;
  let previo = 0;
  let apEntrada = 0;
  let apSalida = 0;
  // Paso alto de un polo: quita la poca continua que se cuela en el lazo.
  let hpEntrada = 0;
  let hpSalida = 0;
  const hp = 1 - (2 * Math.PI * 30) / sr;

  for (let n = 0; n < largo; n++) {
    const x = linea[idx];
    const promedio = 0.5 * (x + previo);
    previo = x;
    const ap = C * promedio + apEntrada - C * apSalida;
    apEntrada = promedio;
    apSalida = ap;
    linea[idx] = ap * rho;
    idx = idx + 1 === L ? 0 : idx + 1;

    const y = x - hpEntrada + hp * hpSalida;
    hpEntrada = x;
    hpSalida = y;
    salida[n] = y * 0.6;
  }

  // Cola: 40 ms de fundido para que el final del buffer no haga clic.
  const fundido = Math.min(largo, Math.round(0.04 * sr));
  for (let i = 0; i < fundido; i++) salida[largo - 1 - i] *= i / fundido;
  return salida;
}
