/**
 * Renderizar un paisaje: el trozo generado (o nada) más las capas que hace el
 * móvil (tono, binaural, ruido, pulso), como UN fichero WAV estéreo que se
 * repite sin costuras. Gratis: todo es síntesis aquí.
 *
 * Por qué un fichero y no Web Audio en vivo: en el iPhone el AudioContext se
 * calla al bloquear la pantalla y un <audio> sigue sonando (plan, parte 3.6).
 *
 * Lo puro (`mezclarPaisaje`) se prueba sin navegador; decodificar la base es
 * lo único que necesita `AudioContext`.
 */

import { remuestrear } from '@/lib/musico/wav';
import type { CapasPaisaje } from '../tipos';
import { bucleDeMusica } from './bucle';
import { amplitudDeSeno, crearAzar, frecuenciaEnBucle, gananciaParaNivel, pulso, ruidoEnBucle, sumarSeno, ciclosEnBucle } from './capas';
import { OBJETIVOS_PAISAJE, ajustarSonoridad } from './cuidado';

export interface OpcionesRender {
  /** Lo que dura una vuelta del bucle. Por defecto, lo que dura la base (o 60 s sin base). */
  segundosBucle?: number;
  /** Volumen bajo y sin picos para dormir o dolor de cabeza. */
  cuidado?: boolean;
  alAvanzar?: (progreso: number) => void;
}

/** 32 kHz estéreo: sobra para un paisaje y una vuelta de 2,5 min son unos 19 MB. */
export const SAMPLE_RATE_PAISAJE = 32000;
const VUELTA_SIN_BASE_S = 60;
const VUELTA_MAX_S = 150;

const pausa = () => new Promise<void>((r) => setTimeout(r, 0));

/**
 * Mezcla la base (si hay) con las capas en una vuelta que se repite sin
 * costura y la deja a la sonoridad de su modo. PURA salvo las pausas.
 */
export async function mezclarPaisaje(
  base: Float32Array[] | null,
  sampleRate: number,
  capas: CapasPaisaje,
  opciones: OpcionesRender = {},
): Promise<Float32Array[]> {
  const avance = opciones.alAvanzar ?? (() => {});
  let vuelta: Float32Array[];
  if (base && base.length && base[0].length > sampleRate) {
    const estereo = base.length === 1 ? [base[0], base[0]] : [base[0], base[1]];
    const maximo = Math.min(opciones.segundosBucle ?? VUELTA_MAX_S, VUELTA_MAX_S);
    vuelta = bucleDeMusica(estereo, sampleRate, maximo).canales.map((c) => Float32Array.from(c));
    const nivelBase = capas.nivelBase ?? 1;
    if (nivelBase !== 1) for (const c of vuelta) for (let i = 0; i < c.length; i++) c[i] *= nivelBase;
  } else {
    const n = Math.round((opciones.segundosBucle ?? VUELTA_SIN_BASE_S) * sampleRate);
    vuelta = [new Float32Array(n), new Float32Array(n)];
  }
  avance(0.3);
  const n = vuelta[0].length;

  if (capas.pulso && capas.pulso.profundidad > 0 && base) {
    const g = pulso(capas.pulso.hz, capas.pulso.profundidad, n, sampleRate);
    for (const c of vuelta) for (let i = 0; i < n; i++) c[i] *= g(i);
  }
  if (capas.tono && capas.tono.nivel > 0) {
    const hz = frecuenciaEnBucle(capas.tono.hz, n, sampleRate);
    await sumarSeno(vuelta, ciclosEnBucle(hz, n, sampleRate), amplitudDeSeno(hz, sampleRate, capas.tono.nivel), { pausa });
  }
  avance(0.5);
  if (capas.binaural && capas.binaural.nivel > 0) {
    const { baseHz, difHz, nivel } = capas.binaural;
    const amp = amplitudDeSeno(baseHz, sampleRate, nivel);
    await sumarSeno([vuelta[0]], ciclosEnBucle(baseHz, n, sampleRate), amp, { pausa });
    await sumarSeno([vuelta[1]], ciclosEnBucle(baseHz + difHz, n, sampleRate), amp, { pausa });
  }
  avance(0.65);
  if (capas.ruido && capas.ruido.nivel > 0) {
    const r = ruidoEnBucle(capas.ruido.color, n, sampleRate, 7);
    const l = ruidoEnBucle(capas.ruido.color, n, sampleRate, 11);
    const g = gananciaParaNivel([r, l], sampleRate, capas.ruido.nivel);
    for (let i = 0; i < n; i++) {
      vuelta[0][i] += r[i] * g;
      vuelta[1][i] += l[i] * g;
    }
  }
  avance(0.8);
  ajustarSonoridad(vuelta, sampleRate, OBJETIVOS_PAISAJE[opciones.cuidado ? 'cuidado' : 'normal']);
  avance(0.95);
  return vuelta;
}

/** WAV estéreo de 16 bits. */
export function wavEstereo(canales: readonly Float32Array[], sampleRate: number): ArrayBuffer {
  const [l, r] = [canales[0], canales[1] ?? canales[0]];
  const n = l.length;
  const buffer = new ArrayBuffer(44 + n * 4);
  const v = new DataView(buffer);
  const texto = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i));
  };
  texto(0, 'RIFF');
  v.setUint32(4, 36 + n * 4, true);
  texto(8, 'WAVE');
  texto(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 2, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 4, true);
  v.setUint16(32, 4, true);
  v.setUint16(34, 16, true);
  texto(36, 'data');
  v.setUint32(40, n * 4, true);
  let o = 44;
  for (let i = 0; i < n; i++) {
    for (const c of [l, r]) {
      const s = Math.max(-1, Math.min(1, c[i]));
      v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      o += 2;
    }
  }
  return buffer;
}

/** Decodifica la base con el navegador y la pasa a la frecuencia del paisaje. */
async function decodificar(base: Blob): Promise<Float32Array[]> {
  const Ctx = (window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
  const ctx = new Ctx();
  try {
    const audio = await ctx.decodeAudioData(await base.arrayBuffer());
    const canales: Float32Array[] = [];
    for (let i = 0; i < Math.min(2, audio.numberOfChannels); i++) {
      canales.push(remuestrear(audio.getChannelData(i), audio.sampleRate, SAMPLE_RATE_PAISAJE));
    }
    return canales;
  } finally {
    void ctx.close();
  }
}

export async function renderizarPaisaje(base: Blob | null, capas: CapasPaisaje, opciones: OpcionesRender = {}): Promise<Blob> {
  opciones.alAvanzar?.(0.05);
  const pcm = base ? await decodificar(base) : null;
  const vuelta = await mezclarPaisaje(pcm, SAMPLE_RATE_PAISAJE, capas, opciones);
  const wav = new Blob([wavEstereo(vuelta, SAMPLE_RATE_PAISAJE)], { type: 'audio/wav' });
  opciones.alAvanzar?.(1);
  return wav;
}

/** Para enseñarlo antes de hacerlo: con 142 Hz, el altavoz del móvil casi no se oye. */
export function tonoGraveParaAltavoz(capas: CapasPaisaje): boolean {
  return !!capas.tono && capas.tono.nivel > 0 && capas.tono.hz < 200;
}

/** Que el ruido no salga igual siempre (azar estable para tests). */
export { crearAzar };
