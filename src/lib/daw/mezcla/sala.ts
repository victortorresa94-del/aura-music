/**
 * La respuesta de una sala, generada por código.
 *
 * Una reverb de convolución necesita la grabación de un golpe en una sala de
 * verdad. Aquí se fabrica: ruido blanco que cae en exponencial (−60 dB en el
 * tiempo de reverberación), con unas pocas reflexiones tempranas delante y
 * un paso bajo que se va cerrando, porque en una sala real los agudos se
 * apagan antes que los graves. Pesa 0 bytes, no tiene licencia que revisar y
 * la semilla es fija: la misma idea suena igual hoy, mañana y en el WAV.
 */

import type { Espacio } from './tipos';

interface Forma {
  /** Tiempo de reverberación, RT60, en segundos. */
  rt60: number;
  /** Lo que tarda en llegar la primera reflexión. */
  predelay: number;
  /** Paso bajo al principio y al final de la cola, en Hz. */
  brillo: number;
  oscuro: number;
  /** Reflexiones tempranas y en cuánto tiempo caen. */
  reflexiones: number;
  ventanaTemprana: number;
}

const FORMAS: Record<Espacio, Forma> = {
  estudio: { rt60: 0.45, predelay: 0.004, brillo: 10000, oscuro: 4500, reflexiones: 6, ventanaTemprana: 0.025 },
  sala: { rt60: 1.3, predelay: 0.012, brillo: 8500, oscuro: 2400, reflexiones: 8, ventanaTemprana: 0.06 },
  catedral: { rt60: 3.6, predelay: 0.03, brillo: 6500, oscuro: 1100, reflexiones: 10, ventanaTemprana: 0.12 },
};

/**
 * Nivel de vuelta de cada sitio, en dB. El `ConvolverNode` normaliza por la
 * potencia media de la respuesta, así que una cola larga devuelve mucha más
 * energía que una corta: medido en el navegador, con el envío a tope, el
 * estudio quedaba a −14,5 dB de la pista seca y la catedral a −3,4. Esto
 * los acerca para que cambiar de sitio no cambie la mezcla entera; la
 * catedral sigue siendo la más mojada, que para eso es catedral.
 */
export const RETORNO_DB: Record<Espacio, number> = { estudio: 6, sala: 0, catedral: -3 };

/** Ni una catedral necesita más: una cola más larga solo gasta móvil. */
export const DURACION_MAXIMA = 5.5;

/** Generador pseudoaleatorio pequeño y reproducible (mulberry32). */
function aleatorio(semilla: number): () => number {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** RT60 con el tamaño aplicado: de 0,6 a 1,4 veces el del sitio. */
export function rt60De(espacio: Espacio, tamano: number): number {
  const t = Math.min(1, Math.max(0, tamano));
  return FORMAS[espacio].rt60 * (0.6 + 0.8 * t);
}

/**
 * Dos canales (izquierdo y derecho, con ruido distinto para que la cola se
 * abra en estéreo). La amplitud absoluta da igual: el `ConvolverNode`
 * normaliza la respuesta.
 */
export function respuestaDeSala(
  espacio: Espacio,
  tamano: number,
  sampleRate: number,
  semilla = 0x5a1a,
): Float32Array<ArrayBuffer>[] {
  const forma = FORMAS[espacio];
  const escala = 0.6 + 0.8 * Math.min(1, Math.max(0, tamano));
  const rt60 = forma.rt60 * escala;
  const predelay = forma.predelay * escala;
  const duracion = Math.min(DURACION_MAXIMA, predelay + rt60 * 1.15);
  const largo = Math.max(1, Math.ceil(duracion * sampleRate));
  const inicio = Math.floor(predelay * sampleRate);
  const entrada = Math.max(1, Math.floor(0.004 * sampleRate));
  const salida = Math.max(1, Math.floor(0.06 * sampleRate));
  const caida = -6.907755 / (rt60 * sampleRate); // ln(10^-3) por muestra
  const canales: Float32Array<ArrayBuffer>[] = [];

  const paso = Math.exp(caida);
  const tramo = 64; // el filtro se recalcula cada 64 muestras: no se oye y va diez veces más rápido
  for (let canal = 0; canal < 2; canal++) {
    const azar = aleatorio(semilla + canal * 7919);
    const datos = new Float32Array(largo);
    let filtrado = 0;
    let envolvente = 1;
    let alfa = 1;
    let compensa = 1;
    for (let i = inicio; i < largo; i++) {
      if ((i - inicio) % tramo === 0) {
        const t = (i - inicio) / Math.max(1, largo - inicio);
        // El corte del paso bajo baja en geométrica, de brillante a oscuro.
        const corte = forma.brillo * (forma.oscuro / forma.brillo) ** t;
        alfa = 1 - Math.exp((-2 * Math.PI * corte) / sampleRate);
        // El paso bajo quita energía al ruido; se compensa para que la cola
        // no se hunda antes de tiempo cuando se cierra.
        compensa = Math.sqrt(sampleRate / (2 * corte));
      }
      filtrado += alfa * (azar() * 2 - 1 - filtrado);
      let nivel = envolvente;
      if (i - inicio < entrada) nivel *= (i - inicio) / entrada;
      if (largo - i < salida) nivel *= (largo - i) / salida;
      datos[i] = filtrado * nivel * compensa;
      envolvente *= paso;
    }

    // Reflexiones tempranas: golpes sueltos que dicen el tamaño del sitio
    // antes de que llegue la cola difusa.
    for (let r = 0; r < forma.reflexiones; r++) {
      const cuando = inicio + Math.floor(azar() * forma.ventanaTemprana * escala * sampleRate);
      if (cuando >= largo) continue;
      const signo = azar() < 0.5 ? -1 : 1;
      const fuerza = (0.9 - (0.6 * r) / forma.reflexiones) * Math.exp(caida * (cuando - inicio));
      datos[cuando] += signo * fuerza * 3;
    }
    canales.push(datos);
  }
  return canales;
}

/**
 * Generar la catedral cuesta unos milisegundos; se guardan las últimas para
 * no repetirlo al arrastrar o al exportar.
 */
const memoria = new Map<string, Float32Array<ArrayBuffer>[]>();

export function respuestaGuardada(espacio: Espacio, tamano: number, sampleRate: number): Float32Array<ArrayBuffer>[] {
  const clave = `${espacio}:${Math.round(tamano * 50)}:${sampleRate}`;
  const hay = memoria.get(clave);
  if (hay) return hay;
  const nueva = respuestaDeSala(espacio, Math.round(tamano * 50) / 50, sampleRate);
  memoria.set(clave, nueva);
  if (memoria.size > 6) memoria.delete(memoria.keys().next().value as string);
  return nueva;
}
