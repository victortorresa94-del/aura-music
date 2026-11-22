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
  | 'nudillos'
  // Pilar B: lo que hace falta para los pads (cajas de ritmos y cajón).
  | 'cajon_ghost'
  | 'chasquido'
  | 'pandereta'
  | 'cencerro'
  | 'bombo_808'
  | 'caja_808'
  | 'aro_808'
  | 'palmas_808'
  | 'charles_808'
  | 'charles_pedal_808'
  | 'charles_abierto_808'
  | 'platillo_808'
  | 'tom_grave_808'
  | 'tom_medio_808'
  | 'tom_agudo_808'
  | 'bombo_909'
  | 'caja_909'
  | 'aro_909'
  | 'palmas_909'
  | 'charles_909'
  | 'charles_pedal_909'
  | 'charles_abierto_909'
  | 'platillo_909'
  | 'ride_909'
  | 'tom_grave_909'
  | 'tom_medio_909'
  | 'tom_agudo_909';

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
  cajon_ghost: 'Cajón suave',
  chasquido: 'Pito',
  pandereta: 'Pandereta',
  cencerro: 'Cencerro',
  bombo_808: 'Bombo 808',
  caja_808: 'Caja 808',
  aro_808: 'Aro 808',
  palmas_808: 'Palmas 808',
  charles_808: 'Charles 808',
  charles_pedal_808: 'Charles corto 808',
  charles_abierto_808: 'Charles abierto 808',
  platillo_808: 'Platillo 808',
  tom_grave_808: 'Tom grave 808',
  tom_medio_808: 'Tom medio 808',
  tom_agudo_808: 'Tom agudo 808',
  bombo_909: 'Bombo 909',
  caja_909: 'Caja 909',
  aro_909: 'Aro 909',
  palmas_909: 'Palmas 909',
  charles_909: 'Charles 909',
  charles_pedal_909: 'Charles corto 909',
  charles_abierto_909: 'Charles abierto 909',
  platillo_909: 'Platillo 909',
  ride_909: 'Ride 909',
  tom_grave_909: 'Tom grave 909',
  tom_medio_909: 'Tom medio 909',
  tom_agudo_909: 'Tom agudo 909',
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

/* -------------------------------------------------------------------------- */
/* Cajas de ritmos (pilar B)                                                   */
/*                                                                             */
/* La 808 y la 909 ya eran síntesis analógica, así que aquí no se imitan unas  */
/* muestras: se rehace el circuito con nodos. El bombo es un seno que cae de   */
/* altura; la caja, dos tonos y ruido; los platos y el charles, seis ondas     */
/* cuadradas a frecuencias que no casan entre sí (las de la 808 original)      */
/* pasadas por filtros agudos. Pesan cero y suenan igual en el WAV.            */
/* -------------------------------------------------------------------------- */

/** Las seis frecuencias del metal de la 808 (Roland, manual de servicio). */
const METAL_808 = [205.3, 304.4, 369.6, 522.7, 540, 800];

/** Saturación suave: el bombo de una caja de ritmos empuja, no es un seno limpio. */
function saturador(ctx: BaseAudioContext, cantidad: number): WaveShaperNode {
  const shaper = ctx.createWaveShaper();
  const n = 1024;
  const curva = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curva[i] = Math.tanh(x * cantidad) / Math.tanh(cantidad);
  }
  shaper.curve = curva;
  return shaper;
}

/** Bombo: seno con caída de altura rápida y cola larga. */
function bomboAnalogico(
  g: Golpe,
  o: { desde: number; hasta: number; caida: number; cola: number; click: number; drive: number },
) {
  const { ctx, dest, time, vel } = g;
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(o.desde, time);
  osc.frequency.exponentialRampToValueAtTime(o.hasta, time + o.caida);
  const env = envelope(ctx, time, vel, 0.0015, o.cola);
  const drive = saturador(ctx, o.drive);
  osc.connect(drive);
  drive.connect(env);
  env.connect(dest);
  osc.start(time);
  osc.stop(time + o.cola + 0.05);
  if (o.click > 0) ruido(g, { type: 'lowpass', freq: 3200 }, 0.006, o.click);
}

/** Metal: charles y platos. Seis cuadradas desafinadas, filtradas arriba. */
function metal(g: Golpe, o: { decay: number; peak: number; corte: number; banda?: number; factor?: number }) {
  const { ctx, dest, time, vel } = g;
  const bus = ctx.createGain();
  bus.gain.value = 1 / METAL_808.length;
  const factor = o.factor ?? 1;
  const fin = time + o.decay + 0.06;
  for (const f of METAL_808) {
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = f * factor;
    osc.connect(bus);
    osc.start(time);
    osc.stop(fin);
  }
  const banda = ctx.createBiquadFilter();
  banda.type = 'bandpass';
  banda.frequency.value = o.banda ?? 10000;
  banda.Q.value = 0.8;
  const agudos = ctx.createBiquadFilter();
  agudos.type = 'highpass';
  agudos.frequency.value = o.corte;
  const env = envelope(ctx, time, o.peak * vel, 0.001, o.decay);
  bus.connect(banda);
  banda.connect(agudos);
  agudos.connect(env);
  env.connect(dest);
}

/**
 * Un platillo (crash o ride). Lo que lo hacía sonar a juguete era la caída de
 * un solo tramo: un platillo de verdad pega fuerte, baja deprisa los primeros
 * 80 ms y luego se queda brillando varios segundos. Aquí se hace así, con el
 * metal de la 808, ruido agudo y un banco de filtros estrechos a frecuencias
 * que no casan entre sí (los modos de una chapa, no los armónicos de una
 * cuerda), que es lo que da el «shhh» con brillo.
 */
function platillo(g: Golpe, o: { cola: number; peak: number; factor: number; brillo: number }) {
  const { ctx, dest, time, vel } = g;
  const salida = ctx.createGain();
  salida.gain.setValueAtTime(0.0001, time);
  salida.gain.linearRampToValueAtTime(o.peak * vel, time + 0.002);
  salida.gain.setTargetAtTime(o.peak * vel * 0.32, time + 0.002, 0.035);
  salida.gain.setTargetAtTime(0.0001, time + 0.09, o.cola / 4.5);
  salida.connect(dest);
  const fin = time + o.cola + 0.2;

  // Metal: las seis cuadradas, un poco más agudas que en el charles.
  const metalBus = ctx.createGain();
  metalBus.gain.value = 0.5 / METAL_808.length;
  for (const f of METAL_808) {
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = f * o.factor;
    osc.connect(metalBus);
    osc.start(time);
    osc.stop(fin);
  }
  const agudos = ctx.createBiquadFilter();
  agudos.type = 'highpass';
  agudos.frequency.value = 5200 * o.brillo;
  metalBus.connect(agudos);
  agudos.connect(salida);

  // Ruido por un banco de resonancias de chapa.
  const fuente = ctx.createBufferSource();
  fuente.buffer = noise(ctx);
  fuente.loop = true;
  const banco = ctx.createGain();
  banco.gain.value = 0.9;
  for (const [f, q] of [[3150, 7], [4730, 9], [6890, 8], [9420, 6], [12100, 4]] as const) {
    const filtro = ctx.createBiquadFilter();
    filtro.type = 'bandpass';
    filtro.frequency.value = f * o.brillo;
    filtro.Q.value = q;
    fuente.connect(filtro);
    filtro.connect(banco);
  }
  const aire = ctx.createBiquadFilter();
  aire.type = 'highpass';
  aire.frequency.value = 7000 * o.brillo;
  const aireG = ctx.createGain();
  aireG.gain.value = 0.35;
  fuente.connect(aire);
  aire.connect(aireG);
  aireG.connect(salida);
  banco.connect(salida);
  fuente.start(time);
  fuente.stop(fin);
}

/** Palmas de caja de ritmos: tres o cuatro ráfagas seguidas y una cola. */
function palmasAnalogicas(g: Golpe, frecuencia: number, rafagas: number) {
  for (let i = 0; i < rafagas; i++) {
    ruido({ ...g, time: g.time + i * 0.0105 }, { type: 'bandpass', freq: frecuencia, q: 1.6 }, 0.012, 0.55);
  }
  ruido({ ...g, time: g.time + rafagas * 0.0105 }, { type: 'bandpass', freq: frecuencia, q: 1.2 }, 0.13, 0.4);
}

/** Tom: seno que baja un poco, con un soplo de ruido al principio. */
function tomAnalogico(g: Golpe, altura: number, cola: number) {
  tono(g, altura * 1.35, altura, cola, 0.8);
  ruido(g, { type: 'bandpass', freq: altura * 6, q: 1 }, 0.02, 0.12);
}

export function playVoice(voice: VoiceId, ctx: BaseAudioContext, dest: AudioNode, time: number, vel = 1) {
  const g: Golpe = { ctx, dest, time, vel };

  switch (voice) {
    /* ---- cajón y mano (pilar B) ---- */
    case 'cajon_ghost':
      // El golpe de relleno: la yema rozando la esquina, casi sin cuerpo.
      ruido(g, { type: 'bandpass', freq: 1900, q: 1 }, 0.05, 0.22);
      break;
    case 'chasquido':
      // El pito: dedo corazón contra la base del pulgar. Chasquido corto y agudo.
      ruido(g, { type: 'bandpass', freq: 2900, q: 2.4 }, 0.022, 0.6);
      tono(g, 1650, 1500, 0.015, 0.18);
      break;
    case 'pandereta': {
      // Las sonajas: varias chapitas que no suenan a la vez.
      for (let i = 0; i < 4; i++) {
        ruido(
          { ...g, time: time + i * 0.007, vel: vel * (1 - i * 0.15) },
          { type: 'bandpass', freq: 7400 + i * 500, q: 2.5 },
          0.09,
          0.32,
        );
      }
      break;
    }
    case 'cencerro': {
      // Dos cuadradas a 540 y 800 Hz, el cencerro de la 808.
      const bus = ctx.createGain();
      bus.gain.value = 0.5;
      for (const f of [540, 800]) {
        const osc = ctx.createOscillator();
        osc.type = 'square';
        osc.frequency.value = f;
        osc.connect(bus);
        osc.start(time);
        osc.stop(time + 0.4);
      }
      const banda = ctx.createBiquadFilter();
      banda.type = 'bandpass';
      banda.frequency.value = 2640;
      banda.Q.value = 1;
      const env = envelope(ctx, time, 0.42 * vel, 0.001, 0.3);
      bus.connect(banda);
      banda.connect(env);
      env.connect(dest);
      break;
    }

    /* ---- 808 ---- */
    case 'bombo_808':
      bomboAnalogico(g, { desde: 150, hasta: 50, caida: 0.07, cola: 0.75, click: 0.12, drive: 1.6 });
      break;
    case 'caja_808':
      tono(g, 250, 238, 0.11, 0.42, 'triangle');
      tono(g, 490, 476, 0.07, 0.2);
      ruido(g, { type: 'highpass', freq: 1800 }, 0.17, 0.5);
      break;
    case 'aro_808':
      tono(g, 1720, 1700, 0.02, 0.4, 'triangle');
      tono(g, 470, 455, 0.03, 0.35);
      break;
    case 'palmas_808':
      palmasAnalogicas(g, 1250, 3);
      break;
    case 'charles_808':
      metal(g, { decay: 0.05, peak: 0.42, corte: 7200 });
      break;
    case 'charles_pedal_808':
      metal(g, { decay: 0.025, peak: 0.34, corte: 7600 });
      break;
    case 'charles_abierto_808':
      metal(g, { decay: 0.38, peak: 0.36, corte: 7200 });
      break;
    case 'platillo_808':
      platillo(g, { cola: 2.6, peak: 0.42, factor: 1.2, brillo: 0.95 });
      break;
    case 'tom_grave_808':
      tomAnalogico(g, 92, 0.42);
      break;
    case 'tom_medio_808':
      tomAnalogico(g, 132, 0.36);
      break;
    case 'tom_agudo_808':
      tomAnalogico(g, 196, 0.3);
      break;

    /* ---- 909: más pegada, más ruido y más brillo ---- */
    case 'bombo_909':
      bomboAnalogico(g, { desde: 290, hasta: 54, caida: 0.045, cola: 0.42, click: 0.3, drive: 2.4 });
      break;
    case 'caja_909':
      tono(g, 200, 182, 0.09, 0.42, 'triangle');
      tono(g, 350, 330, 0.06, 0.2, 'triangle');
      ruido(g, { type: 'highpass', freq: 2200 }, 0.2, 0.62);
      ruido(g, { type: 'bandpass', freq: 5400, q: 0.7 }, 0.12, 0.25);
      break;
    case 'aro_909':
      tono(g, 1950, 1900, 0.018, 0.42, 'triangle');
      ruido(g, { type: 'bandpass', freq: 3800, q: 2 }, 0.015, 0.3);
      break;
    case 'palmas_909':
      palmasAnalogicas(g, 1550, 4);
      break;
    case 'charles_909':
      ruido(g, { type: 'highpass', freq: 9200 }, 0.045, 0.4);
      metal(g, { decay: 0.04, peak: 0.18, corte: 8800, factor: 1.4 });
      break;
    case 'charles_pedal_909':
      ruido(g, { type: 'highpass', freq: 9600 }, 0.022, 0.32);
      break;
    case 'charles_abierto_909':
      ruido(g, { type: 'highpass', freq: 8800 }, 0.32, 0.34, 0.002);
      metal(g, { decay: 0.3, peak: 0.16, corte: 8400, factor: 1.4 });
      break;
    case 'platillo_909':
      platillo(g, { cola: 3, peak: 0.46, factor: 1.7, brillo: 1.05 });
      break;
    case 'ride_909':
      // El ride: menos ruido y más «ping», con la campana marcada.
      platillo(g, { cola: 2.2, peak: 0.22, factor: 2.1, brillo: 0.9 });
      tono(g, 3520, 3500, 0.9, 0.1);
      tono(g, 5310, 5290, 0.5, 0.05);
      break;
    case 'tom_grave_909':
      tomAnalogico(g, 105, 0.34);
      break;
    case 'tom_medio_909':
      tomAnalogico(g, 150, 0.3);
      break;
    case 'tom_agudo_909':
      tomAnalogico(g, 215, 0.26);
      break;

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
