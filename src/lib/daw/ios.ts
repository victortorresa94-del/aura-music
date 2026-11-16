/**
 * Rarezas de iOS con el audio de la web.
 *
 * En un iPhone, que el navegador tenga audio no significa que se oiga. Hay dos
 * cosas que lo silencian y ninguna es culpa del código:
 *
 * 1. El interruptor lateral de silencio. Con la web sonando por Web Audio a
 *    secas, iOS lo trata como sonido "de ambiente" y el interruptor lo calla.
 * 2. Tener el micro abierto. Mientras hay un getUserMedia vivo, el sistema pasa
 *    a modo "grabación": baja el volumen de salida y a veces lo manda al
 *    auricular de llamadas en vez de al altavoz.
 *
 * Safari expone `navigator.audioSession` justo para esto: declarando el tipo de
 * sesión se le dice al sistema qué estamos haciendo. 'playback' es "esto es
 * música, súbelo y sáltate el interruptor"; 'play-and-record' es lo que toca
 * mientras se graba.
 */

export type AudioSessionType =
  | 'auto'
  | 'playback'
  | 'play-and-record'
  | 'transient'
  | 'transient-solo'
  | 'ambient';

interface AudioSessionCapable {
  audioSession?: { type: AudioSessionType };
}

export function setAudioSession(type: AudioSessionType): boolean {
  if (typeof navigator === 'undefined') return false;
  const session = (navigator as Navigator & AudioSessionCapable).audioSession;
  if (!session) return false;
  try {
    session.type = type;
    return true;
  } catch {
    return false;
  }
}

export function getAudioSession(): string | null {
  if (typeof navigator === 'undefined') return null;
  const session = (navigator as Navigator & AudioSessionCapable).audioSession;
  return session ? session.type : null;
}

/**
 * Ceba el contexto dentro del propio gesto del usuario: un buffer de una
 * muestra basta para que iOS lo dé por "usado" y no lo deje suspendido.
 */
export function primeContext(ctx: BaseAudioContext) {
  try {
    const buffer = ctx.createBuffer(1, 1, 22050);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);
  } catch {
    /* contexto cerrado */
  }
}

/** Safari inventa este estado y resume() no siempre saca de él. */
export function isInterrupted(ctx: AudioContext | null): boolean {
  return !!ctx && (ctx.state as string) === 'interrupted';
}

export function hasAudioSession(): boolean {
  return typeof navigator !== 'undefined' && 'audioSession' in navigator;
}

let unlockElement: HTMLAudioElement | null = null;

/**
 * Red de seguridad para los iOS que no tienen `audioSession`: reproducir un
 * elemento <audio> de verdad cambia la sesión a reproducción de medios. Va en
 * silencio, dura un instante y solo se hace una vez.
 */
export function unlockMediaPlayback() {
  // Con audioSession disponible no hace falta, y el elemento tiene efectos
  // secundarios feos (controles en la pantalla de bloqueo, cortes a los pocos
  // segundos). Solo se usa donde no hay API.
  if (hasAudioSession()) return;
  if (typeof document === 'undefined' || unlockElement) return;
  // WAV mínimo válido, 0,1 s de silencio a 8 kHz.
  const silence =
    'data:audio/wav;base64,UklGRjIAAABXQVZFZm10IBIAAAABAAEAQB8AAEAfAAABAAgAAABmYWN0BAAAAAAAAABkYXRhAAAAAA==';
  const audio = document.createElement('audio');
  audio.src = silence;
  audio.setAttribute('playsinline', '');
  audio.preload = 'auto';
  audio.volume = 0.0001;
  unlockElement = audio;
  void audio.play().catch(() => {
    /* si el navegador lo rechaza, no pasa nada: es solo un refuerzo */
  });
}
