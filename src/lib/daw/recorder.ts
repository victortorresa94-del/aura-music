/**
 * Grabador alineado por muestra.
 *
 * El problema clásico de grabar en el móvil es que la toma queda desplazada
 * respecto a lo que suena. Parte de ese desfase es hardware (se compensa con
 * la calibración, ver latency.ts) y parte es del propio código: si empiezas a
 * capturar "cuando llega el evento", ya te has comido decenas de milisegundos.
 *
 * Aquí el arranque de la captura se decide dentro del hilo de audio: se le
 * pasa al worklet el instante exacto del contexto en el que debe empezar y
 * este descarta las muestras anteriores dentro del propio bloque. El error de
 * alineación pasa a ser de una muestra, no de un bloque.
 */

import { blockRms } from './audio';

const WORKLET_NAME = 'compas-recorder';

const WORKLET_SOURCE = `
class CompasRecorder extends AudioWorkletProcessor {
  constructor() {
    super();
    this._active = false;
    this._startTime = -1;
    this.port.onmessage = (event) => {
      const msg = event.data;
      if (msg.cmd === 'start') {
        this._startTime = msg.startTime;
        this._active = true;
      } else if (msg.cmd === 'stop') {
        this._active = false;
        this._startTime = -1;
      }
    };
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || input.length === 0) return true;
    const channel = input[0];
    if (!channel || channel.length === 0) return true;

    if (!this._active) {
      // Sin grabar seguimos midiendo nivel para el vúmetro de entrada.
      let peak = 0;
      for (let i = 0; i < channel.length; i++) {
        const abs = channel[i] < 0 ? -channel[i] : channel[i];
        if (abs > peak) peak = abs;
      }
      this.port.postMessage({ type: 'level', peak });
      return true;
    }

    const blockStart = currentTime;
    const blockEnd = blockStart + channel.length / sampleRate;
    if (blockEnd <= this._startTime) return true;

    let from = 0;
    if (this._startTime > blockStart) {
      from = Math.round((this._startTime - blockStart) * sampleRate);
      if (from >= channel.length) return true;
      if (from < 0) from = 0;
    }

    const chunk = from === 0 ? channel.slice(0) : channel.slice(from);
    let peak = 0;
    for (let i = 0; i < chunk.length; i++) {
      const abs = chunk[i] < 0 ? -chunk[i] : chunk[i];
      if (abs > peak) peak = abs;
    }
    this.port.postMessage({ type: 'chunk', chunk, peak }, [chunk.buffer]);
    return true;
  }
}

registerProcessor('${WORKLET_NAME}', CompasRecorder);
`;

export interface RecordingResult {
  samples: Float32Array;
  sampleRate: number;
}

/**
 * Un processor solo se puede registrar una vez por contexto: al reabrir la
 * entrada (cambio de micro, o al soltarlo entre tomas) volver a registrarlo
 * lanza y nos dejaría en el camino de compatibilidad sin enterarnos.
 */
const modulesReady = new WeakSet<AudioContext>();

export class Recorder {
  private ctx: AudioContext;
  private stream: MediaStream;
  private source: MediaStreamAudioSourceNode;
  private node: AudioWorkletNode | ScriptProcessorNode | null = null;
  private sink: GainNode;
  private chunks: Float32Array[] = [];
  private total = 0;
  private active = false;
  private pendingStart = -1;

  /** Nivel de entrada 0..1, para el vúmetro. */
  onLevel: ((level: number) => void) | null = null;

  private constructor(ctx: AudioContext, stream: MediaStream) {
    this.ctx = ctx;
    this.stream = stream;
    this.source = ctx.createMediaStreamSource(stream);
    // El nodo de captura necesita estar conectado a la salida para que el grafo
    // "tire" de él, pero a ganancia cero: nunca monitorizamos el micro por los
    // altavoces (acople asegurado y, encima, con latencia).
    this.sink = ctx.createGain();
    this.sink.gain.value = 0;
    this.sink.connect(ctx.destination);
  }

  static async create(ctx: AudioContext, stream: MediaStream): Promise<Recorder> {
    const recorder = new Recorder(ctx, stream);
    await recorder.setup();
    return recorder;
  }

  private async setup() {
    const supportsWorklet =
      typeof AudioWorkletNode !== 'undefined' && !!this.ctx.audioWorklet;

    if (supportsWorklet) {
      try {
        if (!modulesReady.has(this.ctx)) {
          const blob = new Blob([WORKLET_SOURCE], { type: 'application/javascript' });
          const url = URL.createObjectURL(blob);
          await this.ctx.audioWorklet.addModule(url);
          URL.revokeObjectURL(url);
          modulesReady.add(this.ctx);
        }

        const node = new AudioWorkletNode(this.ctx, WORKLET_NAME, {
          numberOfInputs: 1,
          numberOfOutputs: 1,
          outputChannelCount: [1],
          channelCount: 1,
          channelCountMode: 'explicit',
        });
        node.port.onmessage = (event) => {
          const msg = event.data;
          if (msg.type === 'chunk') {
            const chunk = msg.chunk as Float32Array;
            this.chunks.push(chunk);
            this.total += chunk.length;
            this.onLevel?.(msg.peak);
          } else if (msg.type === 'level') {
            this.onLevel?.(msg.peak);
          }
        };
        this.node = node;
        this.source.connect(node);
        node.connect(this.sink);
        return;
      } catch {
        // Si el worklet falla, seguimos con el camino de compatibilidad.
      }
    }

    const processor = this.ctx.createScriptProcessor(1024, 1, 1);
    processor.onaudioprocess = (event) => {
      const channel = event.inputBuffer.getChannelData(0);
      if (!this.active) {
        this.onLevel?.(blockRms(channel) * 1.6);
        return;
      }
      const blockStart = event.playbackTime ?? this.ctx.currentTime;
      const blockEnd = blockStart + channel.length / this.ctx.sampleRate;
      if (blockEnd <= this.pendingStart) return;
      let from = 0;
      if (this.pendingStart > blockStart) {
        from = Math.round((this.pendingStart - blockStart) * this.ctx.sampleRate);
        if (from >= channel.length) return;
      }
      const chunk = channel.slice(from);
      this.chunks.push(chunk);
      this.total += chunk.length;
      this.onLevel?.(blockRms(chunk) * 1.6);
    };
    this.node = processor;
    this.source.connect(processor);
    processor.connect(this.sink);
  }

  get sampleRate(): number {
    return this.ctx.sampleRate;
  }

  /** Empieza a capturar exactamente en `startTime` (tiempo del AudioContext). */
  start(startTime: number) {
    this.chunks = [];
    this.total = 0;
    this.active = true;
    this.pendingStart = startTime;
    if (this.node && 'port' in this.node) {
      this.node.port.postMessage({ cmd: 'start', startTime });
    }
  }

  stop(): RecordingResult {
    this.active = false;
    if (this.node && 'port' in this.node) {
      this.node.port.postMessage({ cmd: 'stop' });
    }
    const samples = new Float32Array(this.total);
    let offset = 0;
    for (const chunk of this.chunks) {
      samples.set(chunk, offset);
      offset += chunk.length;
    }
    this.chunks = [];
    this.total = 0;
    return { samples, sampleRate: this.ctx.sampleRate };
  }

  /** Segundos capturados hasta ahora. */
  get capturedSeconds(): number {
    return this.total / this.ctx.sampleRate;
  }

  dispose() {
    try {
      this.source.disconnect();
      this.node?.disconnect();
      this.sink.disconnect();
    } catch {
      /* nodos ya desconectados */
    }
    if (this.node && 'port' in this.node) this.node.port.onmessage = null;
    if (this.node && 'onaudioprocess' in this.node) {
      (this.node as ScriptProcessorNode).onaudioprocess = null;
    }
    this.stream.getTracks().forEach((track) => track.stop());
    this.node = null;
  }
}

export interface MicOptions {
  deviceId?: string | null;
  echoCancellation?: boolean;
}

/**
 * Abre el micro en crudo. Las tres "mejoras" del navegador (cancelación de eco,
 * supresión de ruido y control automático de ganancia) están pensadas para
 * videollamadas: en música comen transitorios, bombean el volumen y añaden
 * latencia. Por defecto van desactivadas.
 */
export async function openMicrophone(options: MicOptions = {}): Promise<MediaStream> {
  const constraints: MediaTrackConstraints = {
    echoCancellation: options.echoCancellation ?? false,
    noiseSuppression: false,
    autoGainControl: false,
    channelCount: 1,
  };
  if (options.deviceId) constraints.deviceId = { exact: options.deviceId };

  return navigator.mediaDevices.getUserMedia({ audio: constraints, video: false });
}

export async function listInputDevices(): Promise<MediaDeviceInfo[]> {
  if (!navigator.mediaDevices?.enumerateDevices) return [];
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter((device) => device.kind === 'audioinput');
}
