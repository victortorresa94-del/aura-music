import { describe, expect, it } from 'vitest';
import { floatToInt16 } from '@/lib/daw/audio';
import { guitarra, SR } from '@/test/senales';
import { codificarFlac, decodificarFlac, ErrorFlac, type Pcm16 } from './flac';

/** Un audio con los canales seguidos, como lo guarda `storage.ts`. */
function pcmDe(canales: Float32Array[], sampleRate = SR): Pcm16 {
  const muestras = canales[0].length;
  const pcm = new Int16Array(muestras * canales.length);
  canales.forEach((c, i) => pcm.set(floatToInt16(c), i * muestras));
  return { pcm, canales: canales.length, muestras, sampleRate };
}

function ruido(n: number, amplitud: number, semilla = 7): Float32Array {
  const out = new Float32Array(n);
  let x = semilla;
  for (let i = 0; i < n; i++) {
    x = (x * 1103515245 + 12345) % 2147483648;
    out[i] = (x / 2147483648 - 0.5) * 2 * amplitud;
  }
  return out;
}

/** -1 si son iguales muestra a muestra; si no, dónde empiezan a diferir. (`toEqual` con un millón de muestras tarda segundos.) */
function primeraDiferencia(a: Int16Array, b: Int16Array): number {
  if (a.length !== b.length) return Math.min(a.length, b.length);
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return i;
  return -1;
}

async function idaYVuelta(audio: Pcm16): Promise<{ vuelta: Pcm16; bytes: number }> {
  const flac = await codificarFlac(audio, { pausas: false });
  const vuelta = await decodificarFlac(flac, { pausas: false });
  return { vuelta, bytes: flac.length };
}

describe('FLAC de 16 bits', () => {
  it('una toma vuelve muestra a muestra y pesa bastante menos que el PCM', async () => {
    // Como una toma de verdad: un segundo de sala (ruido de fondo a −60 dBFS),
    // la guitarra rasgueando y otro segundo de sala al soltar.
    const guitar = guitarra(['La m', 'Sol', 'Fa', 'Mi'], 96, 2);
    const sala = ruido(guitar.length + 2 * SR, 0.001, 3);
    const toma = sala.map((v, i) => v + (i >= SR && i < SR + guitar.length ? guitar[i - SR] : 0));
    const audio = pcmDe([toma]);
    const { vuelta, bytes } = await idaYVuelta(audio);
    expect(vuelta.sampleRate).toBe(SR);
    expect(vuelta.canales).toBe(1);
    expect(vuelta.muestras).toBe(audio.muestras);
    expect(primeraDiferencia(vuelta.pcm, audio.pcm)).toBe(-1);
    const pcm16 = audio.muestras * 2;
    // Medido el 22-nov-2026: 0,60 del PCM de 16 bits (23 s de toma: 2,1 MB en
    // PCM, 1,3 MB en FLAC; la guitarra sola, 0,54). Las cuerdas pulsadas son de lo que
    // menos se deja comprimir; una voz con pausas baja más.
    expect(bytes / pcm16).toBeLessThan(0.65);
  });

  it('el silencio casi no ocupa', async () => {
    const audio = pcmDe([new Float32Array(SR * 10)]);
    const { vuelta, bytes } = await idaYVuelta(audio);
    expect(primeraDiferencia(vuelta.pcm, audio.pcm)).toBe(-1);
    // 10 s de silencio: 960 KB en PCM, unos pocos KB en FLAC.
    expect(bytes).toBeLessThan(2 * 1024);
  });

  it('el ruido blanco va tal cual y no crece más que la cabecera', async () => {
    const audio = pcmDe([ruido(SR * 2, 0.99)]);
    const { vuelta, bytes } = await idaYVuelta(audio);
    expect(primeraDiferencia(vuelta.pcm, audio.pcm)).toBe(-1);
    expect(bytes).toBeLessThan(audio.muestras * 2 * 1.01 + 64);
  });

  it('estéreo, los extremos y tamaños que no caen en bloque', async () => {
    for (const n of [1, 15, 4095, 4096, 4097, 3 * 4096 + 17]) {
      const izq = ruido(n, 0.4, n);
      const der = new Float32Array(n).map((_, i) => Math.sin(i / 9) * 0.7);
      izq[0] = 1;
      if (n > 1) der[1] = -1;
      const audio = pcmDe([izq, der], 44100);
      const { vuelta } = await idaYVuelta(audio);
      expect(vuelta.canales).toBe(2);
      expect(vuelta.sampleRate).toBe(44100);
      expect(vuelta.muestras).toBe(n);
      expect(primeraDiferencia(vuelta.pcm, audio.pcm)).toBe(-1);
    }
  });

  it('frecuencias raras viajan en la cabecera', async () => {
    const audio = pcmDe([ruido(5000, 0.2)], 37800);
    const { vuelta } = await idaYVuelta(audio);
    expect(vuelta.sampleRate).toBe(37800);
    expect(primeraDiferencia(vuelta.pcm, audio.pcm)).toBe(-1);
  });

  it('un audio vacío es un FLAC válido sin bloques', async () => {
    const audio: Pcm16 = { pcm: new Int16Array(0), canales: 1, muestras: 0, sampleRate: SR };
    const { vuelta } = await idaYVuelta(audio);
    expect(vuelta.muestras).toBe(0);
  });

  it('si el fichero llega roto, lo dice en vez de devolver ruido', async () => {
    const flac = await codificarFlac(pcmDe([guitarra(['La m'], 100, 1)]), { pausas: false });
    const roto = flac.slice();
    roto[Math.floor(roto.length / 2)] ^= 0x55;
    await expect(decodificarFlac(roto, { pausas: false })).rejects.toBeInstanceOf(ErrorFlac);
    await expect(decodificarFlac(new Uint8Array(100), { pausas: false })).rejects.toBeInstanceOf(ErrorFlac);
    await expect(decodificarFlac(flac.slice(0, flac.length - 40), { pausas: false })).rejects.toBeInstanceOf(ErrorFlac);
  });

  it('empieza por la cabecera estándar', async () => {
    const flac = await codificarFlac(pcmDe([ruido(100, 0.1)]), { pausas: false });
    expect(String.fromCharCode(...flac.slice(0, 4))).toBe('fLaC');
  });
});
