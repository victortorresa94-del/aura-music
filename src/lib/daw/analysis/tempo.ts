/**
 * Sacar el tempo de una toma.
 *
 * Esto lo venden por API (Music.AI lo cobra a 0,03 $ el minuto) pero aquí va
 * en local por una razón de producto, no de dinero: tiene que salir en cuanto
 * sueltas el botón de parar, sin esperar a una respuesta y sin depender de que
 * haya cobertura en el local de ensayo.
 *
 * El método es el clásico y no necesita ni FFT:
 *   1. Envolvente de energía en saltos de 10 ms.
 *   2. Novedad: cuánto SUBE la energía respecto al bloque anterior. Solo las
 *      subidas — una nota que se apaga no es un ataque.
 *   3. Autocorrelación de esa novedad. Si tocas a 100 bpm, la señal se parece
 *      mucho a sí misma desplazada 0,6 s.
 *   4. Corrección de octava: 90 y 180 bpm correlan igual de bien, así que ante
 *      la duda se elige el que caiga en la horquilla en la que de verdad toca
 *      la gente.
 */

export interface TempoResult {
  bpm: number;
  /** 0..1. Por debajo de 0,25 no hay pulso claro y conviene no insistir. */
  confianza: number;
  /** Las otras candidatas, por si la elegida no es la buena. */
  alternativas: number[];
}

const HOP = 0.01;
const BPM_MIN = 45;
const BPM_MAX = 240;

/** Envolvente de energía, un valor cada 10 ms. */
function envolvente(samples: Float32Array, sampleRate: number): Float32Array {
  const salto = Math.max(1, Math.round(sampleRate * HOP));
  const ventana = salto * 2;
  const n = Math.floor(samples.length / salto);
  const out = new Float32Array(Math.max(0, n));
  for (let i = 0; i < n; i++) {
    const desde = i * salto;
    const hasta = Math.min(samples.length, desde + ventana);
    let suma = 0;
    for (let j = desde; j < hasta; j++) suma += samples[j] * samples[j];
    out[i] = Math.sqrt(suma / Math.max(1, hasta - desde));
  }
  return out;
}

/** Solo las subidas de energía: los ataques. */
function novedad(env: Float32Array): Float32Array {
  const out = new Float32Array(env.length);
  for (let i = 1; i < env.length; i++) {
    const d = env[i] - env[i - 1];
    out[i] = d > 0 ? d : 0;
  }
  // Restar la media móvil quita el pedestal y deja los picos limpios.
  const ventana = 25;
  const suavizada = new Float32Array(out.length);
  let acumulado = 0;
  for (let i = 0; i < out.length; i++) {
    acumulado += out[i];
    if (i >= ventana) acumulado -= out[i - ventana];
    suavizada[i] = acumulado / Math.min(ventana, i + 1);
  }
  for (let i = 0; i < out.length; i++) {
    out[i] = Math.max(0, out[i] - suavizada[i]);
  }
  return out;
}

function autocorrelacion(signal: Float32Array, lagMin: number, lagMax: number): Float32Array {
  const out = new Float32Array(lagMax + 1);
  for (let lag = lagMin; lag <= lagMax; lag++) {
    let suma = 0;
    const limite = signal.length - lag;
    if (limite <= 0) continue;
    for (let i = 0; i < limite; i++) suma += signal[i] * signal[i + lag];
    // Normalizar por el solape: si no, los desfases cortos ganan siempre.
    out[lag] = suma / limite;
  }
  return out;
}

export function detectarTempo(samples: Float32Array, sampleRate: number): TempoResult {
  const vacio: TempoResult = { bpm: 0, confianza: 0, alternativas: [] };
  if (samples.length < sampleRate * 2) return vacio;

  const nov = novedad(envolvente(samples, sampleRate));
  if (nov.length < 100) return vacio;

  const lagMin = Math.max(1, Math.round(60 / BPM_MAX / HOP));
  const lagMax = Math.min(nov.length - 1, Math.round(60 / BPM_MIN / HOP));
  if (lagMax <= lagMin) return vacio;

  const ac = autocorrelacion(nov, lagMin, lagMax);

  /* Peine.
     La autocorrelación a secas se deja engañar por los agrupamientos: en una
     rumba 3-3-2 el golpe fuerte cae cada tres corcheas, así que el pico más
     alto sale en el grupo de tres y no en el pulso. La solución clásica es
     puntuar cada candidata sumando también sus múltiplos: el pulso de verdad
     recibe apoyo de todos sus periodos derivados, y un agrupamiento suelto no. */
  const PESO_TOTAL = 1 + 1 / 2 + 1 / 3 + 1 / 4;
  const peine = new Float32Array(lagMax + 1);
  for (let lag = lagMin; lag <= lagMax; lag++) {
    let suma = 0;
    for (let k = 1; k <= 4; k++) {
      const l = Math.round(lag * k);
      if (l > lagMax) break;
      suma += ac[l] / k;
    }
    // Se divide siempre por el peso COMPLETO, no por el de los múltiplos que
    // caben. Si se normalizara por los presentes, un desfase largo (del que no
    // cabe ningún múltiplo) saldría comparado solo consigo mismo y ganaría
    // siempre: era justo el fallo que hacía salir 48 bpm en una toma a 96.
    peine[lag] = suma / PESO_TOTAL;
  }

  const picos: { lag: number; valor: number }[] = [];
  for (let lag = lagMin + 1; lag < lagMax; lag++) {
    if (peine[lag] > peine[lag - 1] && peine[lag] >= peine[lag + 1]) {
      picos.push({ lag, valor: peine[lag] });
    }
  }
  if (picos.length === 0) return vacio;

  const media = peine.slice(lagMin, lagMax).reduce((a, b) => a + b, 0) / (lagMax - lagMin);
  picos.sort((a, b) => b.valor - a.valor);

  /* Preferencia de tempo. En vez de un premio de todo o nada por caer dentro
     de una horquilla, una campana suave centrada en 110 bpm: la música que se
     toca con un instrumento en la mano se agolpa ahí, y así 54 y 216 pierden
     contra 108 sin necesidad de prohibirlos. */
  const preferencia = (bpm: number) => {
    const d = Math.log2(bpm / 110) / 0.9;
    return Math.exp(-0.5 * d * d);
  };

  const candidatas = picos.slice(0, 10).map((pico) => {
    const bpm = 60 / (pico.lag * HOP);
    const prominencia = pico.valor / (media + 1e-9);
    return { bpm, puntos: prominencia * preferencia(bpm), prominencia };
  });
  candidatas.sort((a, b) => b.puntos - a.puntos);

  const mejor = candidatas[0];
  // Confianza: cuánto destaca el ganador sobre el ruido de fondo, acotado.
  const confianza = Math.max(0, Math.min(1, (mejor.prominencia - 1.2) / 3));

  return {
    bpm: Math.round(mejor.bpm),
    confianza,
    alternativas: candidatas.slice(1, 4).map((c) => Math.round(c.bpm)),
  };
}
