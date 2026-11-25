/**
 * Leer un fichero de audio (o el audio de un vídeo) a un AudioBuffer.
 *
 * Plan A, `decodeAudioData`: rápido y exacto. En Safari lee m4a (también el
 * sin pérdida de Notas de voz), mp3, wav, aiff y caf.
 *
 * Plan B, reproducirlo: lo que el navegador sabe REPRODUCIR pero no
 * decodificar de golpe (los vídeos .mov y .mp4 de la galería del iPhone,
 * algunos opus) se pasa por un `<audio>`/`<video>` conectado al grafo con
 * `MediaElementSource`, y se va copiando lo que suena. No se oye (va a un
 * volumen cero) y tarda lo mismo que dura, así que se avisa del avance.
 *
 * Si ninguno puede, el error dice qué formato era (`ErrorDeImportar`).
 */

import { ErrorDeImportar, MAXIMO_SONANDO_S, type Formato } from './formato';

/**
 * `decodeAudioData` con su forma vieja de callbacks también (algunos Safari
 * no devuelven promesa) y sobre una copia: el navegador se queda los bytes
 * que le pasas, y el plan B los puede necesitar.
 */
export function decodificar(ctx: BaseAudioContext, bytes: ArrayBuffer): Promise<AudioBuffer> {
  const copia = bytes.slice(0);
  return new Promise((resolver, rechazar) => {
    let hecho = false;
    const bien = (buffer: AudioBuffer) => {
      if (hecho) return;
      hecho = true;
      resolver(buffer);
    };
    const mal = (error?: unknown) => {
      if (hecho) return;
      hecho = true;
      rechazar(error ?? new Error('decodeAudioData'));
    };
    try {
      const promesa = ctx.decodeAudioData(copia, bien, mal) as Promise<AudioBuffer> | undefined;
      promesa?.then?.(bien, mal);
    } catch (error) {
      mal(error);
    }
  });
}

/** Espera a uno de varios eventos de un elemento (o al plazo). */
function esperarEvento(el: HTMLMediaElement, bien: string[], mal: string[], plazoMs: number): Promise<boolean> {
  return new Promise((resolver) => {
    const limpiar = () => {
      for (const e of [...bien, ...mal]) el.removeEventListener(e, alBien);
      for (const e of mal) el.removeEventListener(e, alMal);
      window.clearTimeout(reloj);
    };
    const alBien = () => {
      limpiar();
      resolver(true);
    };
    const alMal = () => {
      limpiar();
      resolver(false);
    };
    for (const e of bien) el.addEventListener(e, alBien, { once: true });
    for (const e of mal) el.addEventListener(e, alMal, { once: true });
    const reloj = window.setTimeout(alMal, plazoMs);
  });
}

/**
 * El plan B. Necesita el contexto en marcha (se llama justo después de
 * elegir el fichero, que en iOS cuenta como gesto) y que el navegador deje
 * reproducir; si no, lo dice.
 */
export async function leerSonando(
  fichero: File,
  ctx: AudioContext,
  formato: Formato,
  alAvanzar?: (segundos: number, total: number) => void,
): Promise<AudioBuffer> {
  if (ctx.state !== 'running') throw new ErrorDeImportar(formato, 'sin-permiso-para-sonar');
  const url = URL.createObjectURL(fichero);
  const el = document.createElement(formato.esVideo ? 'video' : 'audio');
  el.setAttribute('playsinline', '');
  el.preload = 'auto';
  // En el DOM, invisible: un vídeo suelto en iOS a veces no arranca.
  Object.assign(el.style, { position: 'fixed', width: '1px', height: '1px', opacity: '0', pointerEvents: 'none', left: '0', top: '0' });
  document.body.appendChild(el);
  el.src = url;

  let fuente: MediaElementAudioSourceNode | null = null;
  let proceso: ScriptProcessorNode | null = null;
  let silencio: GainNode | null = null;
  const limpiar = () => {
    try {
      el.pause();
    } catch {
      /* ya parado */
    }
    fuente?.disconnect();
    proceso?.disconnect();
    silencio?.disconnect();
    if (proceso) proceso.onaudioprocess = null;
    el.removeAttribute('src');
    el.load();
    el.remove();
    URL.revokeObjectURL(url);
  };

  try {
    const legible = await esperarEvento(el, ['loadedmetadata'], ['error'], 10_000);
    if (!legible) throw new ErrorDeImportar(formato, 'no-se-lee');
    const total = Number.isFinite(el.duration) ? el.duration : 0;
    if (total > MAXIMO_SONANDO_S) throw new ErrorDeImportar(formato, 'demasiado-largo');

    // Fuente → copiador → volumen cero → salida: el copiador solo trabaja si
    // acaba en algún sitio, y así no se oye nada.
    fuente = ctx.createMediaElementSource(el);
    proceso = ctx.createScriptProcessor(4096, 2, 2);
    silencio = ctx.createGain();
    silencio.gain.value = 0;
    fuente.connect(proceso);
    proceso.connect(silencio);
    silencio.connect(ctx.destination);

    const izquierda: Float32Array[] = [];
    const derecha: Float32Array[] = [];
    let sonando = false;
    proceso.onaudioprocess = (evento) => {
      if (!sonando) return;
      const entrada = evento.inputBuffer;
      izquierda.push(new Float32Array(entrada.getChannelData(0)));
      derecha.push(new Float32Array(entrada.getChannelData(Math.min(1, entrada.numberOfChannels - 1))));
    };
    el.addEventListener('playing', () => {
      sonando = true;
    });
    el.addEventListener('timeupdate', () => alAvanzar?.(el.currentTime, total));

    try {
      await el.play();
    } catch (error) {
      throw new ErrorDeImportar(formato, (error as DOMException)?.name === 'NotAllowedError' ? 'sin-permiso-para-sonar' : 'no-se-lee');
    }
    const plazo = (total > 0 ? total * 1.5 + 10 : MAXIMO_SONANDO_S) * 1000;
    await esperarEvento(el, ['ended'], ['error'], plazo);
    // Lo que quede en el copiador.
    await new Promise((r) => setTimeout(r, 120));
    sonando = false;

    const cuadros = izquierda.reduce((n, trozo) => n + trozo.length, 0);
    if (cuadros < ctx.sampleRate * 0.05) throw new ErrorDeImportar(formato, 'vacio');
    const buffer = ctx.createBuffer(2, cuadros, ctx.sampleRate);
    let pico = 0;
    for (const [canal, trozos] of [izquierda, derecha].entries()) {
      const destino = buffer.getChannelData(canal);
      let i = 0;
      for (const trozo of trozos) {
        destino.set(trozo, i);
        i += trozo.length;
        if (canal === 0) for (let k = 0; k < trozo.length; k += 64) pico = Math.max(pico, Math.abs(trozo[k]));
      }
    }
    // Todo ceros: el navegador lo ha reproducido pero no nos ha dejado oírlo.
    if (pico === 0) throw new ErrorDeImportar(formato, 'vacio');
    return buffer;
  } finally {
    limpiar();
  }
}
