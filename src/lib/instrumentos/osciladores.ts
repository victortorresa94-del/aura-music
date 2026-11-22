/**
 * Sintetizadores hechos con nodos de Web Audio.
 *
 * Los sonidos sostenidos (un órgano, un pad, un bajo sub) no caben en un
 * buffer de longitud fija como los de `sinte.ts`: mientras pisas la tecla
 * tienen que seguir sonando. Aquí cada nota es un pequeño circuito de
 * osciladores, filtros y envolventes que se apaga al soltar. Funciona igual
 * en el contexto en directo y en un OfflineAudioContext, así que el WAV suena
 * como lo que tocaste.
 *
 * Cifras de partida: el bombo-bajo 808 cae una octava y algo en ~70 ms y se
 * satura (Roland TR-808, manual de servicio); el órgano usa los tiradores de
 * un tonewheel en «888000000» con percusión en la tercera armónica.
 */

export type TimbreOscilador = 'sub' | 'bajo808' | 'analogico' | 'organo' | 'pad' | 'sinte' | 'metales' | 'marimba';

export const TIMBRES_OSCILADOR: readonly TimbreOscilador[] = ['sub', 'bajo808', 'analogico', 'organo', 'pad', 'sinte', 'metales', 'marimba'];

export function esTimbreOscilador(timbre: string): timbre is TimbreOscilador {
  return (TIMBRES_OSCILADOR as readonly string[]).includes(timbre);
}

const frecuencia = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

/** Los timbres que se apagan solos (no hace falta soltarlos). */
const PERCUTIDOS = new Set<TimbreOscilador>(['marimba']);

const curvas = new WeakMap<BaseAudioContext, Map<number, Float32Array<ArrayBuffer>>>();
function saturador(ctx: BaseAudioContext, cantidad: number): WaveShaperNode {
  let porContexto = curvas.get(ctx);
  if (!porContexto) {
    porContexto = new Map();
    curvas.set(ctx, porContexto);
  }
  let curva = porContexto.get(cantidad);
  if (!curva) {
    curva = new Float32Array(new ArrayBuffer(1024 * 4));
    for (let i = 0; i < curva.length; i++) {
      const x = (i / (curva.length - 1)) * 2 - 1;
      curva[i] = Math.tanh(x * cantidad) / Math.tanh(cantidad);
    }
    porContexto.set(cantidad, curva);
  }
  const nodo = ctx.createWaveShaper();
  nodo.curve = curva;
  nodo.oversample = '2x';
  return nodo;
}

const ondasDeOrgano = new WeakMap<BaseAudioContext, PeriodicWave>();
/**
 * La onda del órgano, sobre el tirador de 16': armónicos 1 (16'), 2 (8'),
 * 3 (5⅓'), 4 (4'), 6 (2⅔'), 8 (2') con el registro clásico de jazz y gospel.
 */
function ondaDeOrgano(ctx: BaseAudioContext): PeriodicWave {
  const guardada = ondasDeOrgano.get(ctx);
  if (guardada) return guardada;
  const pesos: Record<number, number> = { 1: 0.55, 2: 1, 3: 0.55, 4: 0.42, 6: 0.18, 8: 0.22, 10: 0.06, 12: 0.08, 16: 0.05 };
  const n = 17;
  const real = new Float32Array(n);
  const imag = new Float32Array(n);
  for (const [k, peso] of Object.entries(pesos)) imag[Number(k)] = peso;
  const onda = ctx.createPeriodicWave(real, imag);
  ondasDeOrgano.set(ctx, onda);
  return onda;
}

/** Suelta la envolvente en `r` con constante de tiempo `tau`; devuelve la cola que queda. */
function liberar(env: GainNode, r: number, tau: number, cola: number): number {
  env.gain.cancelScheduledValues(r);
  env.gain.setTargetAtTime(0, r, tau);
  return cola;
}

interface Circuito {
  salida: GainNode;
  fuentes: (OscillatorNode | AudioBufferSourceNode)[];
  /** Suelta en `t`: devuelve cuánto tarda en apagarse del todo. */
  soltar: (t: number) => number;
}

/** Envolvente de amplitud: ataque lineal y luego sostenido (o caída). */
function envolvente(ctx: BaseAudioContext, t: number, pico: number, ataque: number, caida?: { nivel: number; tau: number }) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(pico, t + ataque);
  if (caida) g.gain.setTargetAtTime(pico * caida.nivel, t + ataque, caida.tau);
  return g;
}

function circuito(timbre: TimbreOscilador, ctx: BaseAudioContext, f: number, fuerza: number, t: number): Circuito {
  const osc = (tipo: OscillatorType, frec: number, detune = 0) => {
    const o = ctx.createOscillator();
    o.type = tipo;
    o.frequency.setValueAtTime(frec, t);
    o.detune.setValueAtTime(detune, t);
    return o;
  };
  const conectar = (fuentes: AudioNode[], destino: AudioNode) => fuentes.forEach((f) => f.connect(destino));

  switch (timbre) {
    case 'sub': {
      // Seno y una pizca de segunda armónica: que se oiga también en el altavoz del móvil.
      const a = osc('sine', f);
      const b = osc('sine', f * 2);
      const mezcla2 = ctx.createGain();
      mezcla2.gain.value = 0.16;
      b.connect(mezcla2);
      const sat = saturador(ctx, 1.6);
      a.connect(sat);
      mezcla2.connect(sat);
      const env = envolvente(ctx, t, 0.62 * fuerza, 0.006, { nivel: 0.85, tau: 0.4 });
      sat.connect(env);
      return { salida: env, fuentes: [a, b], soltar: (r) => liberar(env, r, 0.05, 0.4) };
    }
    case 'bajo808': {
      // El bombo-bajo de la 808: arranca más agudo, cae a la nota y se satura.
      const a = osc('sine', f * 2.4);
      a.frequency.exponentialRampToValueAtTime(f, t + 0.07);
      const sat = saturador(ctx, 2.4);
      const tono = ctx.createBiquadFilter();
      tono.type = 'lowpass';
      tono.frequency.value = 3200;
      const env = envolvente(ctx, t, 0.6 * fuerza, 0.003, { nivel: 0.0001, tau: 0.75 });
      a.connect(sat);
      sat.connect(tono);
      tono.connect(env);
      return { salida: env, fuentes: [a], soltar: (r) => liberar(env, r, 0.07, 0.5) };
    }
    case 'analogico': {
      // Dos dientes de sierra un pelo desafinados y un cuadrado una octava abajo, por un filtro con resonancia.
      const a = osc('sawtooth', f, -7);
      const b = osc('sawtooth', f, 7);
      const c = osc('square', f / 2);
      const sub = ctx.createGain();
      sub.gain.value = 0.35;
      c.connect(sub);
      const filtro = ctx.createBiquadFilter();
      filtro.type = 'lowpass';
      filtro.Q.value = 7;
      const alto = Math.min(7000, f * (8 + 10 * fuerza));
      filtro.frequency.setValueAtTime(alto, t);
      filtro.frequency.setTargetAtTime(Math.min(3000, f * 2.6), t + 0.01, 0.12);
      conectar([a, b, sub], filtro);
      const env = envolvente(ctx, t, 0.3 * fuerza, 0.004, { nivel: 0.8, tau: 0.3 });
      filtro.connect(env);
      return { salida: env, fuentes: [a, b, c], soltar: (r) => liberar(env, r, 0.06, 0.45) };
    }
    case 'organo': {
      const a = osc('sine', f / 2);
      a.setPeriodicWave(ondaDeOrgano(ctx));
      // Vibrato y coro suaves, como el de una caja Leslie lenta.
      const lfo = osc('sine', 6.2);
      const profundidad = ctx.createGain();
      profundidad.gain.value = 9;
      lfo.connect(profundidad);
      profundidad.connect(a.detune);
      // Percusión: la tercera armónica con un golpe corto al apretar.
      const p = osc('sine', f * 3);
      const percusion = ctx.createGain();
      percusion.gain.setValueAtTime(0.0001, t);
      percusion.gain.linearRampToValueAtTime(0.32 * fuerza, t + 0.003);
      percusion.gain.setTargetAtTime(0, t + 0.003, 0.11);
      p.connect(percusion);
      const env = envolvente(ctx, t, 0.17 * (0.7 + 0.3 * fuerza), 0.008);
      a.connect(env);
      percusion.connect(env);
      return { salida: env, fuentes: [a, lfo, p], soltar: (r) => liberar(env, r, 0.035, 0.3) };
    }
    case 'pad': {
      const voces = [-11, 0, 9].map((d) => osc('sawtooth', f, d));
      const octava = osc('sawtooth', f / 2, 4);
      const bajaOctava = ctx.createGain();
      bajaOctava.gain.value = 0.4;
      octava.connect(bajaOctava);
      const filtro = ctx.createBiquadFilter();
      filtro.type = 'lowpass';
      filtro.Q.value = 0.9;
      filtro.frequency.value = Math.min(4000, 900 + f * 2);
      // El filtro respira despacio: eso es lo que hace que un pad no suene quieto.
      const lfo = osc('sine', 0.22);
      const barrido = ctx.createGain();
      barrido.gain.value = 380;
      lfo.connect(barrido);
      barrido.connect(filtro.frequency);
      conectar([...voces, bajaOctava], filtro);
      const env = ctx.createGain();
      env.gain.setValueAtTime(0, t);
      env.gain.setTargetAtTime(0.11 * (0.6 + 0.4 * fuerza), t, 0.22);
      filtro.connect(env);
      return { salida: env, fuentes: [...voces, octava, lfo], soltar: (r) => liberar(env, r, 0.45, 2.6) };
    }
    case 'sinte': {
      const a = osc('square', f);
      const b = osc('sawtooth', f, 6);
      const filtro = ctx.createBiquadFilter();
      filtro.type = 'lowpass';
      filtro.Q.value = 4;
      filtro.frequency.setValueAtTime(Math.min(9000, f * (10 + 8 * fuerza)), t);
      filtro.frequency.setTargetAtTime(Math.min(6000, f * 4), t + 0.005, 0.16);
      // Vibrato que entra tarde, como lo haría un cantante.
      const lfo = osc('sine', 5.4);
      const profundidad = ctx.createGain();
      profundidad.gain.setValueAtTime(0, t);
      profundidad.gain.linearRampToValueAtTime(14, t + 0.45);
      lfo.connect(profundidad);
      profundidad.connect(a.detune);
      profundidad.connect(b.detune);
      conectar([a, b], filtro);
      const env = envolvente(ctx, t, 0.16 * (0.6 + 0.4 * fuerza), 0.004, { nivel: 0.85, tau: 0.2 });
      filtro.connect(env);
      return { salida: env, fuentes: [a, b, lfo], soltar: (r) => liberar(env, r, 0.08, 0.6) };
    }
    case 'metales': {
      // Metales de sintetizador: el filtro se abre un poco después del ataque, como el soplo.
      const a = osc('sawtooth', f, -5);
      const b = osc('sawtooth', f, 5);
      const filtro = ctx.createBiquadFilter();
      filtro.type = 'lowpass';
      filtro.Q.value = 1.4;
      filtro.frequency.setValueAtTime(Math.max(200, f * 1.5), t);
      filtro.frequency.linearRampToValueAtTime(Math.min(6000, f * (5 + 5 * fuerza)), t + 0.07);
      filtro.frequency.setTargetAtTime(Math.min(4500, f * 3.5), t + 0.07, 0.25);
      conectar([a, b], filtro);
      const env = envolvente(ctx, t, 0.17 * (0.6 + 0.4 * fuerza), 0.05, { nivel: 0.8, tau: 0.3 });
      filtro.connect(env);
      return { salida: env, fuentes: [a, b], soltar: (r) => liberar(env, r, 0.1, 0.7) };
    }
    case 'marimba': {
      // Barra de madera: la fundamental, el cuarto armónico (afinado así en las
      // marimbas) que se apaga antes, y un golpe de baqueta muy corto.
      const a = osc('sine', f);
      const b = osc('sine', f * 4);
      const c = osc('sine', f * 9.9);
      const gb = ctx.createGain();
      gb.gain.setValueAtTime(0.35 * fuerza, t);
      gb.gain.setTargetAtTime(0, t, 0.07);
      const gc = ctx.createGain();
      gc.gain.setValueAtTime(0.12 * fuerza, t);
      gc.gain.setTargetAtTime(0, t, 0.012);
      b.connect(gb);
      c.connect(gc);
      const env = envolvente(ctx, t, 0.45 * fuerza, 0.002, { nivel: 0.0001, tau: Math.max(0.12, 0.5 - (f / 2000) * 0.3) });
      a.connect(env);
      gb.connect(env);
      gc.connect(env);
      return { salida: env, fuentes: [a, b, c], soltar: () => 0 };
    }
  }
}

/**
 * Suena una nota. Devuelve con qué soltarla (sin efecto en los percutidos).
 * `fuerza` va de 0 a 1. Con `dur` se suelta sola a su hora.
 */
export function tocarOscilador(
  timbre: TimbreOscilador,
  ctx: BaseAudioContext,
  destino: AudioNode,
  nota: number,
  fuerza: number,
  cuando: number,
  dur?: number,
): (momento?: number) => void {
  const c = circuito(timbre, ctx, frecuencia(nota), Math.max(0.05, Math.min(1, fuerza)), cuando);
  c.salida.connect(destino);
  for (const fuente of c.fuentes) fuente.start(cuando);
  const percutido = PERCUTIDOS.has(timbre);
  let fin = cuando + (percutido ? 2.5 : 3600);
  const parar = (t: number) => {
    for (const fuente of c.fuentes) {
      try {
        fuente.stop(t);
      } catch {
        /* ya parada */
      }
    }
  };
  if (percutido) parar(fin);
  let suelta = false;
  const soltar = (momento?: number) => {
    if (suelta || percutido) return;
    suelta = true;
    const t = Math.max(cuando + 0.005, momento ?? ctx.currentTime);
    fin = t + c.soltar(t);
    parar(fin);
  };
  if (dur !== undefined) soltar(cuando + dur);
  const ultima = c.fuentes[0];
  ultima.onended = () => {
    try {
      c.salida.disconnect();
    } catch {
      /* ya desconectada */
    }
  };
  return soltar;
}

export function esPercutido(timbre: TimbreOscilador): boolean {
  return PERCUTIDOS.has(timbre);
}
