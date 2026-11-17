import { afterEach, describe, expect, it, vi } from 'vitest';
import { AudioBloqueado, StudioEngine } from './engine';
import type { Project, StudioSettings } from './types';

/**
 * Un AudioContext de mentira con lo justo para que el motor arranque. Su
 * `resume()` puede no volver nunca, como hace iOS 26 al regresar de otra app.
 */
function contextoFalso(opciones: { resumeCuelga: boolean }) {
  const nodo = () => ({
    connect: () => undefined,
    disconnect: () => undefined,
    gain: {
      value: 1,
      setValueAtTime: () => undefined,
      setTargetAtTime: () => undefined,
      cancelScheduledValues: () => undefined,
      linearRampToValueAtTime: () => undefined,
    },
    threshold: { value: 0 },
    knee: { value: 0 },
    ratio: { value: 0 },
    attack: { value: 0 },
    release: { value: 0 },
  });
  return class {
    state: AudioContextState = 'suspended';
    currentTime = 0;
    sampleRate = 48000;
    destination = nodo();
    createGain = nodo;
    createDynamicsCompressor = nodo;
    createBuffer(_c: number, length: number, sampleRate: number) {
      const data = new Float32Array(length);
      return { duration: length / sampleRate, length, sampleRate, numberOfChannels: 1, getChannelData: () => data };
    }
    createBufferSource() {
      return { ...nodo(), buffer: null, start: () => undefined, stop: () => undefined, onended: null };
    }
    resume() {
      if (opciones.resumeCuelga) return new Promise<void>(() => undefined);
      this.state = 'running';
      return Promise.resolve();
    }
    close() {
      this.state = 'closed';
      return Promise.resolve();
    }
  };
}

const proyecto = { id: 'p', name: 'Idea', bpm: 100, tracks: [] } as unknown as Project;
const ajustes = { metronome: false, countInBars: 0 } as unknown as StudioSettings;

function prepararNavegador(resumeCuelga: boolean) {
  const Ctor = contextoFalso({ resumeCuelga });
  vi.stubGlobal('window', { AudioContext: Ctor, setTimeout, clearTimeout, requestAnimationFrame: () => 0, cancelAnimationFrame: () => undefined });
  vi.stubGlobal('navigator', {});
  vi.stubGlobal('document', { createElement: () => ({ setAttribute: () => undefined, play: () => Promise.resolve() }) });
  vi.stubGlobal('requestAnimationFrame', () => 0);
  vi.stubGlobal('cancelAnimationFrame', () => undefined);
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('el play no se queda colgado si iOS no despierta el audio', () => {
  it('si resume() no vuelve nunca, avisa en poco más de un segundo en vez de esperar para siempre', async () => {
    vi.useFakeTimers();
    prepararNavegador(true);
    const engine = new StudioEngine();
    const intento = engine.play(proyecto, ajustes);
    const resultado = expect(intento).rejects.toBeInstanceOf(AudioBloqueado);
    await vi.advanceTimersByTimeAsync(1300);
    await resultado;
    expect(engine.transportState).toBe('stopped');
  });

  it('el siguiente toque rehace el contexto entero en vez de reusar el atascado', async () => {
    vi.useFakeTimers();
    prepararNavegador(true);
    const engine = new StudioEngine();
    const intento = engine.play(proyecto, ajustes).catch(() => undefined);
    await vi.advanceTimersByTimeAsync(1300);
    await intento;
    const atascado = engine.ctx;
    engine.unlockSync();
    expect(engine.ctx).not.toBe(atascado);
  });

  it('con el audio sano, arranca como siempre', async () => {
    prepararNavegador(false);
    const engine = new StudioEngine();
    await engine.play(proyecto, ajustes);
    expect(engine.transportState).toBe('playing');
    await engine.stop();
  });
});
