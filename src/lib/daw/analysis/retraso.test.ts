import { describe, expect, it } from 'vitest';
import { clics, guitarra, SR } from '@/test/senales';
import {
  aprenderLatencia,
  effectiveLatencyMs,
  estadoLatencia,
  extraAprendidoMs,
} from '../latency';
import { DEFAULT_SETTINGS, type StudioSettings } from '../types';
import {
  CONFIANZA_MINIMA,
  decidirCorreccion,
  detectarGolpes,
  golpesDePista,
  medirRetraso,
  medirRetrasoContra,
  medirToma,
  type Retraso,
} from './retraso';

/** Clics en instantes concretos, con fuerza y ruido de fondo opcionales. */
function clicsEn(tiempos: number[], segundos: number, fuerzas?: number[], ruido = 0): Float32Array {
  const out = new Float32Array(Math.ceil(segundos * SR));
  const azar = generador(3);
  if (ruido) for (let i = 0; i < out.length; i++) out[i] = (azar() * 2 - 1) * ruido;
  tiempos.forEach((t, k) => {
    const i0 = Math.round(t * SR);
    const fuerza = fuerzas ? fuerzas[k] : 1;
    for (let i = 0; i < 240 && i0 + i < out.length; i++) {
      if (i0 + i >= 0) out[i0 + i] += fuerza * Math.sin(i * 0.9) * Math.exp(-i / 40);
    }
  });
  return out;
}

function generador(semilla: number): () => number {
  let s = semilla;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function conSilencio(audio: Float32Array, segundos: number): Float32Array {
  const out = new Float32Array(audio.length + Math.round(segundos * SR));
  out.set(audio, Math.round(segundos * SR));
  return out;
}

const fiable = (medida: Retraso | null) => !!medida && medida.confianza >= CONFIANZA_MINIMA;

describe('detectarGolpes', () => {
  it('sitúa cada click al milisegundo', () => {
    const golpes = detectarGolpes(clics(100, 12, 0.035), SR);
    expect(golpes).toHaveLength(20);
    golpes.forEach((golpe, k) => expect(Math.abs(golpe.t - (0.035 + k * 0.6))).toBeLessThan(0.001));
  });

  it('un acorde sostenido no es una ráfaga de golpes', () => {
    // 32 rasgueos de cuerdas de acero: ni uno más, aunque las graves batan.
    const toma = conSilencio(guitarra(['La m', 'Fa', 'Do', 'Sol'], 96, 2), 0.05);
    expect(detectarGolpes(toma, SR)).toHaveLength(32);
  });
});

describe('medirRetraso contra la rejilla', () => {
  it('una toma 35 ms tarde mide 35 ms', () => {
    const medida = medirRetraso(clics(100, 12, 0.035), SR, { bpm: 100, inicio: 0 });
    expect(fiable(medida)).toBe(true);
    expect(medida!.segundos).toBeCloseTo(0.035, 2);
  });

  it('una toma a tiempo mide cero', () => {
    const medida = medirRetraso(clics(100, 12), SR, { bpm: 100, inicio: 0 });
    expect(fiable(medida)).toBe(true);
    expect(Math.abs(medida!.segundos)).toBeLessThan(0.003);
  });

  it('la rejilla va anclada al cero del proyecto, no al principio de la toma', () => {
    // La toma empieza en el segundo 1,3 del proyecto, a mitad de pulso.
    const pulso = 60 / 96;
    const fase = (((0.035 - 1.3) % pulso) + pulso) % pulso;
    const toma = conSilencio(guitarra(['La m', 'Fa', 'Do', 'Sol'], 96, 2), fase);
    const medida = medirRetraso(toma, SR, { bpm: 96, inicio: 1.3 });
    expect(fiable(medida)).toBe(true);
    expect(Math.abs(medida!.segundos - 0.035)).toBeLessThan(0.005);
  });

  it('con un músico de verdad: corcheas con fallos, acentos, ruido y 12 ms de vaivén', () => {
    const azar = generador(11);
    const gauss = () => Math.sqrt(-2 * Math.log(azar() + 1e-12)) * Math.cos(2 * Math.PI * azar());
    const corchea = 60 / 110 / 2;
    const tiempos: number[] = [];
    const fuerzas: number[] = [];
    for (let k = 0; k * corchea < 20; k++) {
      if (azar() < 0.25) continue;
      tiempos.push(k * corchea + 0.045 + gauss() * 0.012);
      fuerzas.push(k % 2 ? 0.5 : 1);
    }
    const medida = medirRetraso(clicsEn(tiempos, 21, fuerzas, 0.01), SR, { bpm: 110, inicio: 0 });
    expect(fiable(medida)).toBe(true);
    expect(Math.abs(medida!.segundos - 0.045)).toBeLessThan(0.005);
  });

  it('mide más allá de un octavo de pulso (90 ms a 100 BPM)', () => {
    const medida = medirRetraso(clics(100, 12, 0.09), SR, { bpm: 100, inicio: 0 });
    expect(fiable(medida)).toBe(true);
    expect(medida!.segundos).toBeCloseTo(0.09, 2);
  });

  it('golpes al azar no dicen nada', () => {
    for (let semilla = 1; semilla <= 12; semilla++) {
      const azar = generador(semilla);
      const tiempos: number[] = [];
      for (let t = 0.3; t < 20; t += 0.18 + azar() * 0.5) tiempos.push(t);
      expect(fiable(medirRetraso(clicsEn(tiempos, 21), SR, { bpm: 100, inicio: 0 }))).toBe(false);
    }
  });

  it('tocar libre, acelerando de 90 a 115, tampoco', () => {
    const tiempos: number[] = [];
    for (let t = 0.2, bpm = 90; t < 20; t += 60 / bpm, bpm += 1.3) tiempos.push(t);
    expect(fiable(medirRetraso(clicsEn(tiempos, 21), SR, { bpm: 100, inicio: 0 }))).toBe(false);
  });

  it('con menos de seis golpes no opina', () => {
    expect(medirRetraso(clicsEn([0.535, 1.135, 1.735, 2.335], 3), SR, { bpm: 100, inicio: 0 })).toBeNull();
  });

  it('semicorcheas iguales contra corcheas son ambiguas: no se fía', () => {
    const tiempos: number[] = [];
    for (let k = 0; k * 0.15 < 15; k++) tiempos.push(k * 0.15 + 0.03);
    expect(fiable(medirRetraso(clicsEn(tiempos, 16), SR, { bpm: 100, inicio: 0 }))).toBe(false);
  });
});

describe('medirRetraso contra lo que sonaba', () => {
  // Una primera pista tocada libre: a 100 BPM pero 130 ms fuera de la rejilla.
  const pista: number[] = [];
  for (let t = 0.13; t < 20; t += 0.6) pista.push(t);
  // La toma nueva se grabó desde el segundo 2 y llega 30 ms tarde respecto a ella.
  const toma = clicsEn(
    pista.map((t) => t + 0.03 - 2).filter((t) => t > 0),
    16,
  );

  it('mide contra la pista, no contra un tempo que nadie oyó', () => {
    const contraPista = medirRetrasoContra(toma, SR, { inicio: 2, referencia: pista });
    expect(fiable(contraPista)).toBe(true);
    expect(contraPista!.segundos).toBeCloseTo(0.03, 2);
    // La rejilla, en cambio, diría con toda seguridad algo que no es.
    const contraRejilla = medirRetraso(toma, SR, { bpm: 100, inicio: 2 });
    expect(fiable(contraRejilla)).toBe(true);
    expect(Math.abs(contraRejilla!.segundos - 0.03)).toBeGreaterThan(0.05);
  });

  it('sin claqueta mandan las pistas', () => {
    const medida = medirToma(toma, SR, { inicio: 2, bpm: 100, rejilla: false, referencia: pista });
    expect(medida!.segundos).toBeCloseTo(0.03, 2);
  });

  it('si la claqueta y las pistas no cuadran entre sí, no se toca nada', () => {
    expect(medirToma(toma, SR, { inicio: 2, bpm: 100, rejilla: true, referencia: pista })).toBeNull();
  });

  it('si cuadran, manda la claqueta', () => {
    const enRejilla: number[] = [];
    for (let t = 0; t < 20; t += 0.3) enRejilla.push(t);
    const tarde = clicsEn(enRejilla.map((t) => t + 0.05).filter((_, i) => i % 3 !== 2), 16);
    const medida = medirToma(tarde, SR, { inicio: 0, bpm: 100, rejilla: true, referencia: enRejilla });
    expect(medida!.segundos).toBeCloseTo(0.05, 2);
  });

  it('los golpes de una pista se leen donde suena, con su recorte y sus vueltas', () => {
    // Clics en 0; 0,6; 1,2; 1,8 y 2,4 del audio. El clip suena de 0,5 a 1,7.
    const clip = { bufferId: 'x', start: 10, offset: 0.5, duration: 1.2, repeats: 2 };
    const golpes = golpesDePista(clics(100, 3), SR, clip, 10, 11.5);
    expect(golpes).toHaveLength(3);
    [10.1, 10.7, 11.3].forEach((t, k) => expect(Math.abs(golpes[k] - t)).toBeLessThan(0.002));
  });
});

describe('decidirCorreccion', () => {
  const medida = (ms: number, confianza = 1): Retraso => ({ segundos: ms / 1000, confianza, golpes: 20 });

  it('tarde: se adelanta entera la toma y se aprende el 70 %', () => {
    const correccion = decidirCorreccion(medida(34), 0)!;
    expect(correccion.adelanto).toBeCloseTo(0.034, 6);
    expect(correccion.aprendizajeMs).toBeCloseTo(23.8, 6);
  });

  it('a tiempo: no se mueve nada, pero confirma la cifra', () => {
    expect(decidirCorreccion(medida(5), 0)).toEqual({ adelanto: 0, aprendizajeMs: 0 });
  });

  it('sin confianza, o con un desfase que no es latencia, no se toca', () => {
    expect(decidirCorreccion(null, 0)).toBeNull();
    expect(decidirCorreccion(medida(34, CONFIANZA_MINIMA - 0.01), 0)).toBeNull();
    expect(decidirCorreccion(medida(200), 0)).toBeNull();
  });

  it('pronto: solo se deshace lo aprendido de más, nunca por debajo de la cifra de partida', () => {
    expect(decidirCorreccion(medida(-20), 0)).toBeNull();
    expect(decidirCorreccion(medida(-20), 12)).toEqual({ adelanto: -0.012, aprendizajeMs: -12 });
    const parcial = decidirCorreccion(medida(-20), 50)!;
    expect(parcial.adelanto).toBeCloseTo(-0.02, 6);
    expect(parcial.aprendizajeMs).toBeCloseTo(-14, 6);
  });
});

describe('la máquina se adapta a ti', () => {
  /** Graba una toma de clicks a tiempo con una ida y vuelta real de `real` segundos. */
  function grabar(settings: StudioSettings, real: number, arrastre = 0) {
    const aplicada = effectiveLatencyMs(settings, null) / 1000;
    // Se graba desde el 2,4 (en el pulso); el músico toca justo con lo que oye.
    const audio = clics(100, 10, real + arrastre);
    const medida = medirRetraso(audio, SR, { bpm: 100, inicio: 2.4 - aplicada });
    const correccion = decidirCorreccion(medida, extraAprendidoMs(settings));
    const errorFinal = real + arrastre - aplicada - (correccion?.adelanto ?? 0);
    const siguiente: StudioSettings = correccion
      ? {
          ...settings,
          ...aprenderLatencia(settings, {
            aplicadaMs: aplicada * 1000,
            aprendizajeMs: correccion.aprendizajeMs,
            salidaMs: null,
          }),
        }
      : settings;
    return { errorFinal, siguiente };
  }

  it('desde una estimación corta, cada toma cae a tiempo y la cifra converge sin pasarse', () => {
    let settings: StudioSettings = { ...DEFAULT_SETTINGS, latencyMs: 40 };
    for (let toma = 0; toma < 5; toma++) {
      const { errorFinal, siguiente } = grabar(settings, 0.095);
      expect(Math.abs(errorFinal)).toBeLessThan(0.008);
      expect(siguiente.latencyMs).toBeLessThanOrEqual(95 + 2);
      settings = siguiente;
    }
    expect(Math.abs(settings.latencyMs - 95)).toBeLessThan(8);
    expect(estadoLatencia(settings, null)).toEqual({ ms: settings.latencyMs, origen: 'tomas', tomas: 5 });
  });

  it('una toma arrastrada que la hace pasarse se corrige con las siguientes', () => {
    let settings: StudioSettings = { ...DEFAULT_SETTINGS, latencyMs: 60 };
    settings = grabar(settings, 0.06, 0.04).siguiente; // 40 ms por detrás, una vez
    expect(settings.latencyMs).toBeGreaterThan(80);
    for (let toma = 0; toma < 4; toma++) settings = grabar(settings, 0.06).siguiente;
    expect(Math.abs(settings.latencyMs - 60)).toBeLessThan(8);
  });

  it('nunca baja de la cifra medida aunque el músico se adelante', () => {
    let settings: StudioSettings = { ...DEFAULT_SETTINGS, latencyMs: 80, calibrated: true };
    for (let toma = 0; toma < 3; toma++) settings = grabar(settings, 0.08, -0.02).siguiente;
    expect(settings.latencyMs).toBe(80);
  });

  it('el estado distingue sin calibrar, estimada, medida y afinada con tus tomas', () => {
    expect(estadoLatencia(DEFAULT_SETTINGS, null).origen).toBe('ninguna');
    const estimada = { ...DEFAULT_SETTINGS, latencyMs: 40 };
    expect(estadoLatencia(estimada, null).origen).toBe('estimada');
    expect(estadoLatencia({ ...estimada, calibrated: true }, null).origen).toBe('medida');
    const afinada = {
      ...estimada,
      ...aprenderLatencia(estimada, { aplicadaMs: 40, aprendizajeMs: 24, salidaMs: null }),
    };
    expect(estadoLatencia(afinada, null)).toEqual({ ms: 64, origen: 'tomas', tomas: 1 });
    // Si luego se mueve a mano, lo aprendido deja de mandar.
    expect(estadoLatencia({ ...afinada, latencyMs: 70 }, null).origen).toBe('estimada');
  });

  it('lo aprendido sigue a la salida si cambia, como una calibración', () => {
    const ctx = (salida: number) => ({ outputLatency: salida, baseLatency: 0.01 }) as unknown as AudioContext;
    const base = { ...DEFAULT_SETTINGS, latencyMs: 40 };
    const afinada = {
      ...base,
      ...aprenderLatencia(base, { aplicadaMs: 40, aprendizajeMs: 30, salidaMs: 20 }),
    };
    expect(effectiveLatencyMs(afinada, ctx(0.02))).toBe(70);
    // Cascos Bluetooth: la salida pasa de 20 a 200 ms.
    expect(effectiveLatencyMs(afinada, ctx(0.2))).toBe(250);
  });
});
