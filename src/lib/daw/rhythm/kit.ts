/**
 * Percusión sintetizada.
 *
 * Nada de samples por ahora, y no es una decisión perezosa: la percusión de
 * mano se sintetiza sorprendentemente bien porque casi toda es ruido filtrado
 * más una resonancia corta. Una palma, una clave o un güiro son exactamente
 * eso. Y así el banco de ritmos pesa cero, funciona sin cobertura, no depende
 * de la licencia de nadie y suena idéntico en cualquier móvil.
 *
 * Las congas y los bongós son lo que peor sale de aquí (una membrana tiene más
 * armónicos de los que compensa modelar). Cuando lleguen samples con licencia
 * clara, se sustituyen esas voces sin tocar ni un patrón: el motor de ritmos
 * habla de golpes, no de cómo suena cada golpe.
 */

export type VoiceId =
  | 'cajon_grave'
  | 'cajon_slap'
  | 'palma_seca'
  | 'palma_sorda'
  | 'clave'
  | 'guiro'
  | 'shaker'
  | 'conga_abierta'
  | 'conga_slap'
  | 'bongo_agudo'
  | 'bongo_grave'
  | 'bombo'
  | 'caja'
  | 'charles'
  | 'nudillos';

export const VOICE_NAMES: Record<VoiceId, string> = {
  cajon_grave: 'Cajón grave',
  cajon_slap: 'Cajón slap',
  palma_seca: 'Palma seca',
  palma_sorda: 'Palma sorda',
  clave: 'Clave',
  guiro: 'Güiro',
  shaker: 'Shaker',
  conga_abierta: 'Conga abierta',
  conga_slap: 'Conga slap',
  bongo_agudo: 'Bongó agudo',
  bongo_grave: 'Bongó grave',
  bombo: 'Bombo',
  caja: 'Caja',
  charles: 'Charles',
  nudillos: 'Nudillos',
};

const noiseCache = new WeakMap<BaseAudioContext, AudioBuffer>();

/** Un segundo de ruido blanco, reutilizado por todas las voces. */
function noise(ctx: BaseAudioContext): AudioBuffer {
  const cached = noiseCache.get(ctx);
  if (cached) return cached;
  const length = Math.floor(ctx.sampleRate);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let seed = 22222;
  for (let i = 0; i < length; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    data[i] = (seed / 0x7fffffff) * 2 - 1;
  }
  noiseCache.set(ctx, buffer);
  return buffer;
}

interface Golpe {
  ctx: BaseAudioContext;
  dest: AudioNode;
  time: number;
  /** 0..1 */
  vel: number;
}

function envelope(ctx: BaseAudioContext, time: number, peak: number, attack: number, decay: number) {
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), time + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + attack + decay);
  return gain;
}

/** Cuerpo tonal con caída de altura: membranas, bombos, claves. */
function tono(
  { ctx, dest, time, vel }: Golpe,
  from: number,
  to: number,
  decay: number,
  peak: number,
  type: OscillatorType = 'sine',
) {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(from, time);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), time + decay * 0.7);
  const env = envelope(ctx, time, peak * vel, 0.002, decay);
  osc.connect(env);
  env.connect(dest);
  osc.start(time);
  osc.stop(time + decay + 0.05);
}

/** Ruido filtrado: palmas, slaps, charles, güiro. */
function ruido(
  { ctx, dest, time, vel }: Golpe,
  filter: { type: BiquadFilterType; freq: number; q?: number },
  decay: number,
  peak: number,
  attack = 0.001,
) {
  const source = ctx.createBufferSource();
  source.buffer = noise(ctx);
  source.loop = true;
  const band = ctx.createBiquadFilter();
  band.type = filter.type;
  band.frequency.value = filter.freq;
  band.Q.value = filter.q ?? 1;
  const env = envelope(ctx, time, peak * vel, attack, decay);
  source.connect(band);
  band.connect(env);
  env.connect(dest);
  source.start(time);
  source.stop(time + attack + decay + 0.05);
}

export function playVoice(voice: VoiceId, ctx: BaseAudioContext, dest: AudioNode, time: number, vel = 1) {
  const g: Golpe = { ctx, dest, time, vel };

  switch (voice) {
    case 'cajon_grave':
      // Golpe en el centro de la tapa: cuerpo grave y aire de la caja.
      tono(g, 105, 58, 0.16, 0.9);
      ruido(g, { type: 'lowpass', freq: 420 }, 0.08, 0.25);
      break;
    case 'cajon_slap':
      // Golpe en la esquina: chapa, agudo y seco.
      ruido(g, { type: 'bandpass', freq: 2100, q: 0.9 }, 0.075, 0.5);
      ruido(g, { type: 'highpass', freq: 5200 }, 0.03, 0.28);
      break;
    case 'palma_seca':
      // Palma alta, la que corta. Dos capas muy cortas dan el chasquido.
      ruido(g, { type: 'bandpass', freq: 1900, q: 1.4 }, 0.045, 0.55);
      ruido(g, { type: 'bandpass', freq: 3600, q: 2.2 }, 0.03, 0.3);
      break;
    case 'palma_sorda':
      // Palma con las manos huecas: más grave y redonda, acompaña sin cortar.
      ruido(g, { type: 'bandpass', freq: 700, q: 1.1 }, 0.07, 0.45);
      break;
    case 'clave':
      tono(g, 2450, 2350, 0.05, 0.5);
      tono(g, 3350, 3250, 0.035, 0.22);
      break;
    case 'guiro': {
      // Raspado: una serie de pulsitos, no un golpe.
      const pulsos = 7;
      for (let i = 0; i < pulsos; i++) {
        ruido(
          { ...g, time: time + i * 0.016, vel: vel * (0.55 + (i / pulsos) * 0.45) },
          { type: 'bandpass', freq: 2600 + i * 90, q: 3 },
          0.012,
          0.3,
        );
      }
      break;
    }
    case 'shaker':
      ruido(g, { type: 'highpass', freq: 6500 }, 0.045, 0.3, 0.004);
      break;
    case 'conga_abierta':
      tono(g, 235, 195, 0.35, 0.75);
      ruido(g, { type: 'bandpass', freq: 1500, q: 1.2 }, 0.035, 0.2);
      break;
    case 'conga_slap':
      tono(g, 380, 300, 0.1, 0.4);
      ruido(g, { type: 'bandpass', freq: 2400, q: 1.6 }, 0.05, 0.45);
      break;
    case 'bongo_agudo':
      tono(g, 520, 430, 0.13, 0.6);
      ruido(g, { type: 'bandpass', freq: 2800, q: 1.5 }, 0.03, 0.22);
      break;
    case 'bongo_grave':
      tono(g, 330, 270, 0.18, 0.65);
      ruido(g, { type: 'bandpass', freq: 1800, q: 1.4 }, 0.03, 0.18);
      break;
    case 'bombo':
      tono(g, 120, 45, 0.28, 1);
      break;
    case 'caja':
      tono(g, 190, 170, 0.09, 0.35);
      ruido(g, { type: 'highpass', freq: 1700 }, 0.12, 0.5);
      break;
    case 'charles':
      ruido(g, { type: 'highpass', freq: 8000 }, 0.035, 0.22);
      break;
    case 'nudillos':
      // Nudillos en la mesa: lo que usa media peña cuando no hay cajón.
      tono(g, 900, 700, 0.03, 0.35);
      ruido(g, { type: 'bandpass', freq: 3200, q: 2 }, 0.02, 0.25);
      break;
  }
}
