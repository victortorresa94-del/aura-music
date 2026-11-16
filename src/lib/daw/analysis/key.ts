/**
 * Sacar la tonalidad de una toma.
 *
 * El método es el estándar: se reparte la energía del espectro entre las doce
 * notas (el "croma"), se suma a lo largo de toda la toma y se compara con los
 * perfiles de Krumhansl y Schmuckler, que miden cuánto "pertenece" cada nota a
 * cada tonalidad. La rotación que mejor correla, gana.
 *
 * Y una vuelta de tuerca que ningún detector comercial da: además de mayor y
 * menor, aquí se lee el MODO FRIGIO. Porque cuando un guitarrista toca por
 * bulerías en la posición de siempre, ningún afinador del mundo le dice "mi
 * frigio": le dice "la menor", que es verdad a medias y no es lo que él
 * necesita oír. La cadencia andaluza (Am-G-F-E) resuelve en el V grado, así
 * que una toma que sale como la menor es, en flamenco, mi frigio: por arriba.
 * Y re menor es la frigio: por medio.
 */

const NOTAS = ['Do', 'Do#', 'Re', 'Mib', 'Mi', 'Fa', 'Fa#', 'Sol', 'Sol#', 'La', 'Sib', 'Si'];

/** Perfiles de Krumhansl-Kessler. */
const PERFIL_MAYOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const PERFIL_MENOR = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

export type Modo = 'mayor' | 'menor' | 'frigio';

export interface KeyResult {
  /** Índice de la tónica, 0 = Do. */
  tonica: number;
  modo: Modo;
  nombre: string;
  /** Lectura flamenca, cuando la hay. */
  flamenco: string | null;
  /**
   * La misma tonalidad leída como la nombraría un teórico: un frigio en mi es
   * un la menor con cadencia andaluza. Se enseñan las dos porque el guitarrista
   * y el que viene del conservatorio no llaman igual a lo mismo.
   */
  equivalente: string | null;
  /** 0..1 */
  confianza: number;
  alternativas: string[];
}

/* -------------------------------------------------------------------------- */
/* FFT mínima, radix-2 en el sitio                                             */
/* -------------------------------------------------------------------------- */

function fft(re: Float32Array, im: Float32Array) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wRe = Math.cos(ang);
    const wIm = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let curRe = 1;
      let curIm = 0;
      for (let k = 0; k < len / 2; k++) {
        const uRe = re[i + k];
        const uIm = im[i + k];
        const vRe = re[i + k + len / 2] * curRe - im[i + k + len / 2] * curIm;
        const vIm = re[i + k + len / 2] * curIm + im[i + k + len / 2] * curRe;
        re[i + k] = uRe + vRe;
        im[i + k] = uIm + vIm;
        re[i + k + len / 2] = uRe - vRe;
        im[i + k + len / 2] = uIm - vIm;
        const nextRe = curRe * wRe - curIm * wIm;
        curIm = curRe * wIm + curIm * wRe;
        curRe = nextRe;
      }
    }
  }
}

/* -------------------------------------------------------------------------- */

interface OpcionesCroma {
  /** Tamaño de la FFT. Más grande = distingue mejor notas graves. */
  n?: number;
  freqMin?: number;
  freqMax?: number;
}

/** Reparte la energía del espectro entre las doce notas. */
export function cromagrama(
  samples: Float32Array,
  sampleRate: number,
  opciones: OpcionesCroma = {},
): Float32Array {
  // Por defecto, de 80 Hz a 2 kHz: por debajo mandan los golpes y por encima,
  // los armónicos agudos, que ensucian el reparto de notas.
  const { n: N = 4096, freqMin = 80, freqMax = 2000 } = opciones;
  const croma = new Float32Array(12);
  const ventana = new Float32Array(N);
  for (let i = 0; i < N; i++) ventana[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1));

  const binMin = Math.max(1, Math.floor((freqMin * N) / sampleRate));
  const binMax = Math.min(N / 2 - 1, Math.ceil((freqMax * N) / sampleRate));

  const re = new Float32Array(N);
  const im = new Float32Array(N);

  for (let inicio = 0; inicio + N <= samples.length; inicio += N) {
    for (let i = 0; i < N; i++) {
      re[i] = samples[inicio + i] * ventana[i];
      im[i] = 0;
    }
    fft(re, im);

    for (let bin = binMin; bin <= binMax; bin++) {
      const mag = Math.sqrt(re[bin] * re[bin] + im[bin] * im[bin]);
      if (mag < 1e-6) continue;
      const freq = (bin * sampleRate) / N;
      // 69 = La4 = 440 Hz en numeración MIDI.
      const nota = 69 + 12 * Math.log2(freq / 440);
      const clase = ((Math.round(nota) % 12) + 12) % 12;
      croma[clase] += mag;
    }
  }

  const total = croma.reduce((a, b) => a + b, 0);
  if (total > 0) for (let i = 0; i < 12; i++) croma[i] /= total;
  return croma;
}

function correlacion(a: Float32Array | number[], b: number[]): number {
  const n = 12;
  const ma = Array.from(a).reduce((x, y) => x + y, 0) / n;
  const mb = b.reduce((x, y) => x + y, 0) / n;
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < n; i++) {
    const x = a[i] - ma;
    const y = b[i] - mb;
    num += x * y;
    da += x * x;
    db += y * y;
  }
  return num / (Math.sqrt(da * db) + 1e-12);
}

/**
 * Cómo llama el guitarrista a la posición. Las dos que se usan a diario tienen
 * nombre propio y no se dicen de otra manera en ningún sitio.
 */
function lecturaFlamenca(tonica: number, modo: Modo): string | null {
  if (modo !== 'frigio') return null;
  if (tonica === 4) return 'por arriba';
  if (tonica === 9) return 'por medio';
  return null;
}

/** El mismo sitio, dicho como lo diría el conservatorio. */
function equivalenteClasico(tonica: number, modo: Modo): string | null {
  // Un frigio en mi es el V grado de la menor: misma escala, otro centro.
  if (modo === 'frigio') return `${NOTAS[(tonica + 5) % 12]} menor`;
  return null;
}

/**
 * Cuánto se parece esto a música con una tonalidad, y no a un cajón.
 *
 * Un croma de música tonal es picudo: unas notas mandan y otras no aparecen.
 * El de un golpe de percusión o el del ruido de una sala es casi plano. La
 * diferencia se mide con el coeficiente de variación, y separa muy bien: en
 * las pruebas, música entre 0,46 y 0,67; ruido blanco 0,20; cajón solo 0,26.
 */
function factorTonal(croma: Float32Array): number {
  const media = croma.reduce((a, b) => a + b, 0) / 12;
  if (media <= 0) return 0;
  let varianza = 0;
  for (let i = 0; i < 12; i++) varianza += (croma[i] - media) ** 2;
  const cv = Math.sqrt(varianza / 12) / media;
  return Math.max(0, Math.min(1, (cv - 0.3) / 0.15));
}

/**
 * La nota MÁS GRAVE que suena, que es la que da nombre al acorde.
 *
 * No vale coger la clase de nota con más energía en la banda de graves: un la
 * mayor abierto en la guitarra es la-mi-la-do#-mi, o sea dos mies contra un
 * solo la, y encima el tercer armónico de cada la vuelve a caer en el mi. Con
 * cualquier suma, el mi gana dentro de su propio acorde de la. Lo que hay que
 * buscar no es la nota más fuerte: es la primera que aparece subiendo desde
 * abajo, que es la cuerda al aire que el guitarrista ha pisado para nombrarlo.
 *
 * La FFT va larga a propósito: a 82 Hz un semitono son 5 Hz, y con 4096
 * muestras un mi grave y un fa caen en el mismo compartimento.
 */
export function notaDelBajo(samples: Float32Array, sampleRate: number, N = 16384): number | null {
  if (samples.length < N) return null;
  const ventana = new Float32Array(N);
  for (let i = 0; i < N; i++) ventana[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1));

  const espectro = new Float32Array(N / 2);
  const re = new Float32Array(N);
  const im = new Float32Array(N);
  let frames = 0;
  for (let inicio = 0; inicio + N <= samples.length; inicio += N) {
    for (let i = 0; i < N; i++) {
      re[i] = samples[inicio + i] * ventana[i];
      im[i] = 0;
    }
    fft(re, im);
    for (let bin = 0; bin < N / 2; bin++) {
      espectro[bin] += Math.sqrt(re[bin] * re[bin] + im[bin] * im[bin]);
    }
    frames++;
  }
  if (frames === 0) return null;

  // De 70 a 400 Hz: la sexta cuerda al aire está en 82 y la tercera en 196.
  const binMin = Math.max(2, Math.floor((70 * N) / sampleRate));
  const binMax = Math.min(N / 2 - 2, Math.ceil((400 * N) / sampleRate));
  let maximo = 0;
  for (let bin = binMin; bin <= binMax; bin++) maximo = Math.max(maximo, espectro[bin]);
  if (maximo <= 0) return null;

  for (let bin = binMin; bin <= binMax; bin++) {
    const esPico = espectro[bin] > espectro[bin - 1] && espectro[bin] >= espectro[bin + 1];
    if (!esPico || espectro[bin] < maximo * 0.25) continue;
    const freq = (bin * sampleRate) / N;
    const nota = 69 + 12 * Math.log2(freq / 440);
    return ((Math.round(nota) % 12) + 12) % 12;
  }
  return null;
}

/**
 * En qué acorde has parado. Devuelve [tónica, ¿es mayor?] o null.
 *
 * Es la pieza que decide el frigio, y hubo que llegar aquí a base de descartes.
 * Mi frigio y la menor tienen EXACTAMENTE las mismas siete notas, así que un
 * tercer perfil de croma no los separa: sale tan plano que gana hasta con ruido
 * blanco. Y las dos señales que parecían obvias tampoco valen — la tercera
 * mayor del quinto solo suena en uno de cada cuatro acordes, y el peso del
 * quinto sale MÁS alto en una menor armónica normal (1,48) que en la propia
 * cadencia andaluza (1,18).
 *
 * Lo que de verdad los separa no está en el reparto de notas de toda la toma:
 * está en el tiempo. La cadencia andaluza baja la-sol-fa-MI y se queda ahí. La
 * menor de manual pasa por mi y vuelve a LA. O sea que la pregunta útil no es
 * cuánto suena cada nota, sino dónde has dejado la mano al final.
 */
function acordeDeReposo(
  samples: Float32Array,
  sampleRate: number,
): { tonica: number; mayor: boolean } | null {
  // El último trozo con sonido de verdad, saltándose la cola que se apaga.
  const bloque = Math.round(sampleRate * 0.05);
  const energias: number[] = [];
  for (let i = 0; i + bloque <= samples.length; i += bloque) {
    let suma = 0;
    for (let j = i; j < i + bloque; j++) suma += samples[j] * samples[j];
    energias.push(Math.sqrt(suma / bloque));
  }
  if (energias.length < 8) return null;
  const pico = Math.max(...energias);
  if (pico <= 0) return null;

  /* Se ancla al último ATAQUE, no al último trozo que suena. Los acordes de
     guitarra tienen una cola larga, así que "donde todavía hay energía" cae
     mucho después de la última mano y arrastra el acorde anterior dentro de la
     ventana: la progresión la-re-mi-LA acababa leyéndose como mi. */
  let ultimo = -1;
  for (let i = energias.length - 1; i >= 1; i--) {
    if (energias[i] - energias[i - 1] > pico * 0.1) {
      ultimo = i;
      break;
    }
  }
  if (ultimo < 0) return null;

  const inicio = ultimo * bloque;
  const fin = Math.min(samples.length, inicio + Math.round(sampleRate * 1.1));
  if (fin - inicio < 16384) return null;
  const trozo = samples.subarray(inicio, fin);

  const tonica = notaDelBajo(trozo, sampleRate);
  if (tonica === null) return null;
  // Y el modo lo dice la tercera, esta sí con el espectro entero.
  const pleno = cromagrama(trozo, sampleRate);
  const mayor = pleno[(tonica + 4) % 12] >= pleno[(tonica + 3) % 12];
  return { tonica, mayor };
}

export function detectarTonalidad(samples: Float32Array, sampleRate: number): KeyResult | null {
  if (samples.length < sampleRate * 1.5) return null;
  const croma = cromagrama(samples, sampleRate);
  const energia = croma.reduce((a, b) => a + b, 0);
  if (energia <= 0) return null;

  const puntuaciones: { tonica: number; modo: Modo; r: number }[] = [];
  for (let t = 0; t < 12; t++) {
    const rotado = new Float32Array(12);
    for (let i = 0; i < 12; i++) rotado[i] = croma[(i + t) % 12];
    puntuaciones.push({ tonica: t, modo: 'mayor', r: correlacion(rotado, PERFIL_MAYOR) });
    puntuaciones.push({ tonica: t, modo: 'menor', r: correlacion(rotado, PERFIL_MENOR) });
  }
  puntuaciones.sort((a, b) => b.r - a.r);

  const mejor = puntuaciones[0];
  // Cuánto le saca al siguiente, rebajado si la toma no tiene pinta de tener
  // tonalidad: un cajón correla con algo, pero no está en ninguna tonalidad.
  const margen = Math.max(0, Math.min(1, (mejor.r - puntuaciones[1].r) * 4));
  const confianza = margen * factorTonal(croma);

  let tonica = mejor.tonica;
  let modo: Modo = mejor.modo;
  /* Cadencia andaluza: la lectura sale menor, pero has parado en un acorde
     MAYOR. Eso no es una menor, es un frigio, y hay dos formas de llegar:

       - Reposas en el V grado. La escala de la menor, pero descansando en mi:
         mi frigio, por arriba.
       - Reposas en la propia tónica convertida en mayor. Es lo que pasa por
         medio (re-do-sib-LA): el croma dice "la menor" porque las notas son
         casi esas, pero la mano se queda en la mayor. La frigio. */
  if (modo === 'menor') {
    const reposo = acordeDeReposo(samples, sampleRate);
    if (reposo?.mayor) {
      if (reposo.tonica === (tonica + 7) % 12) {
        tonica = reposo.tonica;
        modo = 'frigio';
      } else if (reposo.tonica === tonica) {
        modo = 'frigio';
      }
    }
  }

  return {
    tonica,
    modo,
    nombre: `${NOTAS[tonica]} ${modo}`,
    flamenco: lecturaFlamenca(tonica, modo),
    equivalente: equivalenteClasico(tonica, modo),
    confianza,
    alternativas: puntuaciones.slice(1, 4).map((p) => `${NOTAS[p.tonica]} ${p.modo}`),
  };
}
