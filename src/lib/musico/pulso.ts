/**
 * Dónde caen los pulsos de una toma.
 *
 * El tempo dice CADA CUÁNTO hay un pulso; esto dice DÓNDE. Son dos preguntas
 * distintas y la segunda es la que decide si el bajo entra contigo o medio
 * golpe por detrás. Si grabaste con claqueta, los pulsos caen en la rejilla
 * del proyecto; si tocaste libre, hay que encontrarlos en el audio.
 */

/** Un valor cada 10 ms. */
export const SALTO = 0.01;

/** Energía de la señal en saltos de 10 ms. */
export function envolvente(samples: Float32Array, sampleRate: number): Float32Array {
  const salto = Math.max(1, Math.round(sampleRate * SALTO));
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

/**
 * Los ataques: cuánto SUBE la energía respecto al bloque anterior. Una nota
 * que se apaga no es un golpe.
 */
export function ataques(samples: Float32Array, sampleRate: number): Float32Array {
  const env = envolvente(samples, sampleRate);
  const out = new Float32Array(env.length);
  for (let i = 1; i < env.length; i++) {
    const d = env[i] - env[i - 1];
    out[i] = d > 0 ? d : 0;
  }
  return out;
}

/** Suma de los ataques que caen en la rejilla, con un bloque de tolerancia. */
function enRejilla(nov: Float32Array, fase: number, periodo: number): number {
  let suma = 0;
  for (let t = fase; t < nov.length; t += periodo) {
    const i = Math.round(t);
    const a = nov[i] ?? 0;
    const b = nov[i - 1] ?? 0;
    const c = nov[i + 1] ?? 0;
    suma += Math.max(a, b * 0.6, c * 0.6);
  }
  return suma;
}

/**
 * En qué segundo cae el primer pulso, entre 0 y la duración de un pulso.
 *
 * Se prueban todas las fases posibles cada 10 ms y gana la que deja más
 * golpes encima de la rejilla. Con una toma rasgueada a 100 BPM el error
 * típico es de un bloque, 10 ms: por debajo de lo que el oído separa.
 */
export function estimarFase(samples: Float32Array, sampleRate: number, bpm: number): number {
  const nov = ataques(samples, sampleRate);
  if (nov.length < 10 || bpm <= 0) return 0;
  const periodo = 60 / bpm / SALTO;
  let mejor = 0;
  let mejorValor = -1;
  for (let fase = 0; fase < periodo; fase += 1) {
    const valor = enRejilla(nov, fase, periodo);
    if (valor > mejorValor) {
      mejorValor = valor;
      mejor = fase;
    }
  }
  return mejor * SALTO;
}

/**
 * El tempo con decimales.
 *
 * El detector de tempo trabaja en saltos de 10 ms, así que no distingue 95
 * de 96 BPM: los dos caen en el mismo salto. Parece poco, pero en veinte
 * segundos ese 1 % son 200 ms de desfase al final de la toma, y un bajo que
 * llega 200 ms tarde no es un bajo, es un eco. Aquí se prueban todos los
 * tempos cercanos, de décima en décima, y gana el que deja más golpes de la
 * toma ENTERA encima de su rejilla: cuanto más larga la toma, más fino sale.
 */
export function afinarTempo(samples: Float32Array, sampleRate: number, bpm: number, margen = 0.04): number {
  const nov = ataques(samples, sampleRate);
  if (nov.length < 50 || bpm <= 0) return bpm;
  let mejorBpm = bpm;
  let mejorValor = -1;
  for (let candidato = bpm * (1 - margen); candidato <= bpm * (1 + margen); candidato += 0.1) {
    const periodo = 60 / candidato / SALTO;
    for (let fase = 0; fase < periodo; fase += 1) {
      const valor = enRejilla(nov, fase, periodo);
      if (valor > mejorValor) {
        mejorValor = valor;
        mejorBpm = candidato;
      }
    }
  }
  return Math.round(mejorBpm * 10) / 10;
}

/**
 * Cuánto va retrasada (positivo) o adelantada (negativo) una pista respecto a
 * otra, en segundos. Se comparan los ataques de las dos: el desfase que más
 * los hace coincidir es el bueno.
 *
 * Sirve para la red de seguridad del bajo de la IA. El modelo lo genera
 * encima de tu toma y debería venir ya en su sitio, pero «debería» no es
 * suficiente para algo que tiene que sonar a compás.
 */
export function estimarDesfase(
  referencia: Float32Array,
  pista: Float32Array,
  sampleRate: number,
  maximo = 0.25,
): number {
  const a = ataques(referencia, sampleRate);
  const b = ataques(pista, sampleRate);
  const n = Math.min(a.length, b.length);
  if (n < 10) return 0;
  const lagMax = Math.min(n - 1, Math.round(maximo / SALTO));
  let mejorLag = 0;
  let mejorValor = -Infinity;
  for (let lag = -lagMax; lag <= lagMax; lag++) {
    let suma = 0;
    for (let i = 0; i < n; i++) {
      const j = i + lag;
      if (j < 0 || j >= n) continue;
      suma += a[i] * b[j];
    }
    // A igualdad de parecido, gana el desfase más pequeño: no se mueve una
    // pista que ya está bien por una coincidencia de la cuenta.
    const valor = suma - Math.abs(lag) * 1e-9;
    if (valor > mejorValor) {
      mejorValor = valor;
      mejorLag = lag;
    }
  }
  return mejorLag * SALTO;
}

/** Mueve el audio: positivo lo adelanta (quita del principio), negativo lo retrasa. */
export function desplazar(samples: Float32Array, sampleRate: number, segundos: number): Float32Array {
  const n = Math.round(segundos * sampleRate);
  const out = new Float32Array(samples.length);
  if (n >= 0) out.set(samples.subarray(Math.min(n, samples.length)));
  else out.set(samples.subarray(0, Math.max(0, samples.length + n)), -n);
  return out;
}
