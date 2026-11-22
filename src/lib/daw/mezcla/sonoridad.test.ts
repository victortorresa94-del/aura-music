import { describe, expect, it } from 'vitest';
import { masterizar, OBJETIVOS } from './masterizar';
import { medir, picoVerdadero, sonoridadIntegrada } from './sonoridad';

const SR = 48000;

function seno(frecuencia: number, amplitud: number, segundos: number, fase = 0, sr = SR): Float32Array {
  const datos = new Float32Array(Math.round(segundos * sr));
  for (let i = 0; i < datos.length; i++) datos[i] = amplitud * Math.sin((2 * Math.PI * frecuencia * i) / sr + fase);
  return datos;
}

/**
 * Algo con forma de música: rasgueos que atacan y caen (picos altos sobre
 * un nivel medio bajo, como una guitarra grabada con el móvil), un bajo
 * sostenido y un poco de ruido. Reproducible: el ruido sale de una semilla.
 */
function maqueta(segundos: number, nivel: number): Float32Array[] {
  const n = Math.round(segundos * SR);
  const izq = new Float32Array(n);
  const der = new Float32Array(n);
  let semilla = 12345;
  const azar = () => {
    semilla = (semilla * 1103515245 + 12345) >>> 0;
    return semilla / 4294967296 - 0.5;
  };
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const golpe = t % 0.5;
    const ataque = Math.exp(-golpe * 9);
    const cuerdas = Math.sin(2 * Math.PI * 196 * t) + 0.6 * Math.sin(2 * Math.PI * 247 * t) + 0.4 * Math.sin(2 * Math.PI * 1175 * t);
    const bajo = 0.5 * Math.sin(2 * Math.PI * 55 * t);
    const ruido = azar() * 0.4 * ataque;
    izq[i] = nivel * (cuerdas * ataque + bajo + ruido);
    der[i] = nivel * (0.85 * cuerdas * ataque + bajo - ruido);
  }
  return [izq, der];
}

describe('sonoridad integrada (BS.1770)', () => {
  it('un seno de 1 kHz a 0 dBFS en un solo canal mide −3,01 LUFS', () => {
    expect(sonoridadIntegrada([seno(1000, 1, 5)], SR)).toBeCloseTo(-3.01, 1);
  });

  it('el mismo seno en los dos canales mide 0 LUFS', () => {
    const s = seno(1000, 1, 5);
    expect(sonoridadIntegrada([s, s], SR)).toBeCloseTo(0, 1);
  });

  it('un seno a −20 dBFS en estéreo mide −20 LUFS, también a 44,1 kHz', () => {
    const a = 10 ** (-20 / 20);
    const s48 = seno(1000, a, 6);
    expect(sonoridadIntegrada([s48, s48], SR)).toBeCloseTo(-20, 1);
    const s44 = seno(1000, a, 6, 0, 44100);
    expect(sonoridadIntegrada([s44, s44], 44100)).toBeCloseTo(-20, 1);
  });

  it('las puertas no dejan que las partes flojas bajen la cifra', () => {
    const fuerte = seno(1000, 10 ** (-20 / 20), 10);
    const flojo = seno(1000, 10 ** (-40 / 20), 10);
    const junto = new Float32Array(fuerte.length + flojo.length);
    junto.set(fuerte);
    junto.set(flojo, fuerte.length);
    expect(sonoridadIntegrada([junto, junto], SR)).toBeCloseTo(-20, 0);
  });

  it('el silencio no es un número', () => {
    expect(sonoridadIntegrada([new Float32Array(SR * 2)], SR)).toBe(-Infinity);
  });
});

describe('pico verdadero', () => {
  it('ve el pico entre muestras que se le escapa al pico de muestra', () => {
    // Un seno a fs/4 desfasado 45°: todas las muestras valen ±0,707, pero
    // la onda llega a 1 entre ellas. Pico de muestra −3 dB; verdadero, 0.
    const s = seno(SR / 4, 1, 1, Math.PI / 4);
    let muestra = 0;
    for (const v of s) muestra = Math.max(muestra, Math.abs(v));
    expect(20 * Math.log10(muestra)).toBeCloseTo(-3.01, 1);
    expect(picoVerdadero([s], SR)).toBeGreaterThan(-0.3);
    expect(picoVerdadero([s], SR)).toBeLessThan(0.3);
  });

  it('en un seno grave coincide con el de muestra', () => {
    expect(picoVerdadero([seno(100, 0.5, 1)], SR)).toBeCloseTo(-6.02, 1);
  });
});

describe('masterizar de un toque', { timeout: 30_000 }, () => {
  it('lleva una maqueta floja a −14 LUFS sin pasar de −1 dBTP', () => {
    const entrada = maqueta(12, 0.05);
    const antes = medir(entrada, SR);
    expect(antes.lufs).toBeLessThan(-20);
    const r = masterizar(entrada, SR, OBJETIVOS.plataformas);
    expect(r.despues.lufs).toBeGreaterThan(-14.5);
    expect(r.despues.lufs).toBeLessThan(-13.5);
    expect(r.despues.picoVerdadero).toBeLessThanOrEqual(-1 + 0.05);
    // Para llegar ha tenido que limitar: los rasgueos tienen mucho pico.
    expect(r.limitadoDb).toBeGreaterThan(0.5);
    // Y la medida que devuelve es la del audio que devuelve.
    expect(medir(r.canales, SR).lufs).toBeCloseTo(r.despues.lufs, 6);
  });

  it('«para el móvil» la deja en −16 LUFS', () => {
    const r = masterizar(maqueta(10, 0.05), SR, OBJETIVOS.movil);
    expect(Math.abs(r.despues.lufs + 16)).toBeLessThan(0.5);
    expect(r.despues.picoVerdadero).toBeLessThanOrEqual(-1 + 0.05);
  });

  it('una mezcla demasiado fuerte la baja, sin limitar', () => {
    // Un acorde sostenido casi a tope: unos −4 LUFS.
    const a = seno(220, 0.45, 6);
    const b = seno(330, 0.4, 6);
    const acorde = a.map((v, i) => v + b[i]);
    const r = masterizar([acorde, acorde], SR, OBJETIVOS.plataformas);
    expect(r.antes.lufs).toBeGreaterThan(-8);
    expect(r.gananciaDb).toBeLessThan(-5);
    expect(r.limitadoDb).toBe(0);
    expect(Math.abs(r.despues.lufs + 14)).toBeLessThan(0.1);
    expect(r.despues.picoVerdadero).toBeLessThanOrEqual(-1 + 0.05);
  });

  it('llega también con una batería sola, toda picos (hay que limitar mucho)', () => {
    // Golpes de ruido que caen en 30 ms, cada 0,6 s: como el ritmo pasado a pista.
    const n = SR * 10;
    const golpes = new Float32Array(n);
    let semilla = 99;
    for (let i = 0; i < n; i++) {
      semilla = (semilla * 1664525 + 1013904223) >>> 0;
      const t = (i / SR) % 0.6;
      golpes[i] = 1.8 * (semilla / 4294967296 - 0.5) * Math.exp(-t / 0.03);
    }
    const r = masterizar([golpes, golpes], SR, OBJETIVOS.plataformas);
    expect(r.limitadoDb).toBeGreaterThan(6);
    expect(Math.abs(r.despues.lufs + 14)).toBeLessThan(0.25);
    expect(r.despues.picoVerdadero).toBeLessThanOrEqual(-1 + 0.05);
  });

  it('el silencio sale tal cual y sin números raros', () => {
    const r = masterizar([new Float32Array(SR), new Float32Array(SR)], SR, OBJETIVOS.plataformas);
    expect(r.gananciaDb).toBe(0);
    expect(r.canales[0].every((v) => v === 0)).toBe(true);
  });

  it('no toca la entrada', () => {
    const entrada = maqueta(3, 0.05);
    const copia = new Float32Array(entrada[0]);
    masterizar(entrada, SR, OBJETIVOS.plataformas);
    expect(entrada[0].every((v, i) => v === copia[i])).toBe(true);
  });
});
