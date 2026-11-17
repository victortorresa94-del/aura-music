/**
 * Motor del estudio: contexto de audio, transporte, metrónomo y mezcla.
 *
 * Todo se programa con relojes del AudioContext, nunca con setTimeout: los
 * timers de JavaScript se van varios milisegundos y en una maqueta con cuatro
 * pistas eso se oye. setTimeout solo se usa para "mirar el reloj" cada tanto y
 * decidir qué hay que programar en el futuro cercano.
 */

import { createClickBuffer } from './audio';
import { isInterrupted, primeContext, setAudioSession, unlockMediaPlayback } from './ios';
import { effectiveLatencyMs } from './latency';
import { Recorder, openMicrophone, type MicOptions } from './recorder';
import type { Groove } from './rhythm/grooves';
import { playVoice } from './rhythm/kit';
import { golpesEntre, OPCIONES_POR_DEFECTO, type GrooveOptions } from './rhythm/player';
import type { Project, StudioSettings, Track, TransportState } from './types';
import { projectDuration } from './types';

const LEAD_TIME = 0.12;
const SCHEDULER_INTERVAL = 25;
const SCHEDULER_LOOKAHEAD = 0.2;
const FADE_TIME = 0.006;

export interface RecordingTake {
  samples: Float32Array;
  sampleRate: number;
  /** Posición de la línea de tiempo donde empezó la grabación. */
  startPosition: number;
  /** Compensación aplicada, en segundos. */
  latencySeconds: number;
}

export interface TickInfo {
  position: number;
  state: TransportState;
  countInRemaining: number;
}

export class StudioEngine {
  ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private limiter: DynamicsCompressorNode | null = null;
  private clickBus: GainNode | null = null;

  private buffers = new Map<string, AudioBuffer>();
  private sources: AudioBufferSourceNode[] = [];
  private trackGains = new Map<string, GainNode>();

  private recorder: Recorder | null = null;
  private stream: MediaStream | null = null;

  private state: TransportState = 'stopped';
  private anchorTime = 0; // tiempo del contexto que equivale a `anchorPosition`
  private anchorPosition = 0;
  private idlePosition = 0;
  /** Posición a la que volver al parar una escucha de repaso. */
  private reviewReturn: number | null = null;
  private recordStartPosition = 0;
  private recordLatencySeconds = 0;

  private grooveBus: GainNode | null = null;
  private grooveDef: Groove | null = null;
  private grooveOpts: GrooveOptions = OPCIONES_POR_DEFECTO;
  private grooveNextPos = 0;
  private grooveOrigin: { ctxTime: number; position: number } | null = null;
  private grooveTimer: number | null = null;

  private clickHigh: AudioBuffer | null = null;
  private clickLow: AudioBuffer | null = null;
  private schedulerTimer: number | null = null;
  private nextClickTime = 0;
  private beatCounter = 0;
  private bpm = 100;
  private clickEnabled = false;
  private rafId: number | null = null;

  private project: Project | null = null;
  private settings: StudioSettings | null = null;
  private stopping: Promise<void> | null = null;
  /** PWA (pilar E): el último resume() no devolvió el sonido; el siguiente toque rehace el contexto. */
  private rehacerEnSiguienteToque = false;
  /** PWA: el audio ha llegado a sonar en esta sesión. Antes de eso, dormido es lo normal. */
  private haSonado = false;

  onTick: ((info: TickInfo) => void) | null = null;
  onLevel: ((level: number) => void) | null = null;
  onTakeReady: ((take: RecordingTake) => void) | null = null;
  onStateChange: ((state: TransportState) => void) | null = null;
  /** PWA: el audio no ha vuelto tras un toque; el siguiente lo rehace. */
  onContextoDormido: (() => void) | null = null;

  /* ------------------------------------------------------------------ */
  /* Contexto                                                            */
  /* ------------------------------------------------------------------ */

  /**
   * Crea el grafo. Separado del arranque porque en iOS hay que poder rehacerlo:
   * Safari deja el contexto en un estado 'interrupted' del que resume() no
   * siempre sale (llamada entrante, otra app tomando el audio...).
   */
  private buildContext(): AudioContext {
    // El tipo de sesión se declara ANTES de crear el contexto. Si se hace
    // después, iOS ya lo ha creado como 'ambient' y el interruptor de
    // silencio lo calla igualmente.
    setAudioSession('playback');
    unlockMediaPlayback();

    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctor({ latencyHint: 'interactive' });
    // PWA: solo se vigila un contexto que se ha dormido, no uno que nunca ha sonado.
    ctx.addEventListener('statechange', () => {
      if (ctx.state === 'running') this.haSonado = true;
    });

    const master = ctx.createGain();
    master.gain.value = 1;
    // Limitador suave: sumar cuatro pistas grabadas a saco satura, y un
    // recorte digital en una maqueta arruina la escucha.
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -3;
    limiter.knee.value = 6;
    limiter.ratio.value = 12;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.2;

    master.connect(limiter);
    limiter.connect(ctx.destination);

    const clickBus = ctx.createGain();
    clickBus.gain.value = 0.8;
    clickBus.connect(ctx.destination);

    // El ritmo va por el limitador, como las pistas: es material musical, no
    // una señal de servicio como el click.
    const grooveBus = ctx.createGain();
    grooveBus.gain.value = 1;
    grooveBus.connect(master);
    this.grooveBus = grooveBus;

    this.ctx = ctx;
    this.master = master;
    this.limiter = limiter;
    this.clickBus = clickBus;
    this.clickHigh = createClickBuffer(ctx, 1800, 0.03, 0.5);
    this.clickLow = createClickBuffer(ctx, 1200, 0.03, 0.35);
    return ctx;
  }

  /**
   * Desbloqueo SÍNCRONO. Tiene que llamarse dentro del propio manejador del
   * toque, antes de cualquier await: en iOS el permiso para sonar se pierde en
   * cuanto la ejecución cruza una promesa.
   */
  unlockSync(): AudioContext {
    // PWA: también se rehace si el toque anterior no consiguió despertarlo
    // (ver `vigilarReanudacion`). Nunca a media toma: se llevaría el micro.
    const dormido = this.rehacerEnSiguienteToque && this.state === 'stopped';
    if (!this.ctx || this.ctx.state === 'closed' || isInterrupted(this.ctx) || dormido) {
      this.rehacerEnSiguienteToque = false;
      // Los AudioBuffer no pertenecen a ningún contexto, así que las pistas
      // grabadas sobreviven al cambio. El worklet sí se vuelve a registrar.
      const previous = this.ctx;
      if (previous) {
        this.releaseInput();
        void previous.close().catch(() => undefined);
      }
      this.buildContext();
    }
    setAudioSession('playback');
    const ctx = this.ctx!;
    void ctx.resume();
    primeContext(ctx);
    this.vigilarReanudacion(ctx);
    return ctx;
  }

  /**
   * PWA (pilar E). Al volver a la app en un iPhone el contexto a veces se
   * queda 'suspended' o 'interrupted' aunque se le pida resume() dentro del
   * toque, y todo suena mudo. Se le da un segundo; si sigue dormido, el
   * SIGUIENTE toque lo rehace entero (rehacerlo ahora, fuera del gesto, daría
   * otro contexto igual de dormido).
   */
  private vigilarReanudacion(ctx: AudioContext) {
    // Al abrir la app el contexto nace dormido hasta el primer toque: eso no
    // es un fallo y no hay nada que rehacer.
    if (ctx.state === 'running' || !this.haSonado || typeof window === 'undefined') return;
    window.setTimeout(() => {
      if (this.ctx !== ctx || ctx.state === 'running') return;
      this.rehacerEnSiguienteToque = true;
      this.onContextoDormido?.();
    }, 1000);
  }

  async ensureContext(): Promise<AudioContext> {
    const ctx = this.unlockSync();
    // Con un tope de un segundo: en iOS un resume() sobre un contexto
    // interrumpido puede no resolverse nunca, y el transporte se quedaba
    // bloqueado esperándolo (ningún botón respondía).
    if (ctx.state !== 'running') {
      await Promise.race([
        ctx.resume().catch(() => undefined),
        new Promise((resolve) => setTimeout(resolve, 1000)),
      ]);
    }
    return ctx;
  }

  get contextSampleRate(): number {
    return this.ctx?.sampleRate ?? 48000;
  }

  get isInputReady(): boolean {
    return !!this.recorder;
  }

  /* ------------------------------------------------------------------ */
  /* Entrada de micro                                                    */
  /* ------------------------------------------------------------------ */

  async armInput(options: MicOptions = {}): Promise<void> {
    const ctx = await this.ensureContext();
    if (this.recorder) return;
    // Antes de pedir el micro, no después: es lo que evita que iOS mande la
    // salida al auricular de llamadas.
    setAudioSession('play-and-record');
    const stream = await openMicrophone(options);
    const recorder = await Recorder.create(ctx, stream);
    recorder.onLevel = (level) => this.onLevel?.(level);
    this.stream = stream;
    this.recorder = recorder;
  }

  async reopenInput(options: MicOptions = {}): Promise<void> {
    this.releaseInput();
    await this.armInput(options);
  }

  releaseInput() {
    this.recorder?.dispose();
    this.recorder = null;
    this.stream = null;
    setAudioSession('playback');
    void this.ctx?.resume();
  }

  get inputStream(): MediaStream | null {
    return this.stream;
  }

  get rawRecorder(): Recorder | null {
    return this.recorder;
  }

  /* ------------------------------------------------------------------ */
  /* Buffers                                                             */
  /* ------------------------------------------------------------------ */

  putBuffer(id: string, buffer: AudioBuffer) {
    this.buffers.set(id, buffer);
  }

  getBuffer(id: string): AudioBuffer | undefined {
    return this.buffers.get(id);
  }

  hasBuffer(id: string): boolean {
    return this.buffers.has(id);
  }

  dropBuffer(id: string) {
    this.buffers.delete(id);
  }

  createBufferFromSamples(channels: Float32Array[], sampleRate: number): AudioBuffer {
    const ctx = this.ctx;
    if (!ctx) throw new Error('Contexto de audio no inicializado');
    const count = Math.max(1, channels.length);
    const frames = Math.max(1, channels[0]?.length ?? 1);
    const buffer = ctx.createBuffer(count, frames, sampleRate);
    for (let c = 0; c < count; c++) buffer.getChannelData(c).set(channels[c]);
    return buffer;
  }

  /**
   * Decodifica un fichero de audio del móvil. Se conserva el estéreo: una base
   * importada en mono pierde toda la anchura y se nota.
   */
  async decodeFile(file: File): Promise<AudioBuffer> {
    const ctx = await this.ensureContext();
    const bytes = await file.arrayBuffer();
    return ctx.decodeAudioData(bytes);
  }

  /* ------------------------------------------------------------------ */
  /* Transporte                                                          */
  /* ------------------------------------------------------------------ */

  get position(): number {
    if (!this.ctx || this.state === 'stopped') return this.idlePosition;
    const elapsed = this.ctx.currentTime - this.anchorTime;
    if (elapsed < 0) return this.anchorPosition; // claqueta en curso
    return this.anchorPosition + elapsed;
  }

  get transportState(): TransportState {
    return this.state;
  }

  /** Posición de la línea de tiempo donde arrancó la toma en curso. */
  get recordingStart(): number {
    return this.recordStartPosition;
  }

  /** Segundos que faltan para que termine la claqueta. */
  get countInRemaining(): number {
    if (!this.ctx || this.state !== 'countin') return 0;
    return Math.max(0, this.anchorTime - this.ctx.currentTime);
  }

  seek(position: number) {
    this.idlePosition = Math.max(0, position);
    this.anchorPosition = this.idlePosition;
    this.emitTick();
  }

  /**
   * Escuchar lo que se acaba de grabar. Igual que `play`, pero al parar deja
   * el cursor donde empezó la toma para que el siguiente botón rojo grabe
   * encima y no detrás.
   */
  async playReview(project: Project, settings: StudioSettings, from: number) {
    await this.play(project, settings, from);
    this.reviewReturn = from;
  }

  async play(project: Project, settings: StudioSettings, from?: number) {
    if (this.state !== 'stopped') await this.stop();
    const ctx = await this.ensureContext();
    this.reviewReturn = null;
    this.project = project;
    this.settings = settings;

    const start = from ?? this.idlePosition;
    const t0 = ctx.currentTime + LEAD_TIME;
    this.anchorTime = t0;
    this.anchorPosition = start;
    this.setTempo(project.bpm);
    this.scheduleProject(project, start, t0);
    this.clickEnabled = settings.metronome;
    if (settings.metronome) this.startMetronome(start, t0);
    if (this.grooveDef) {
      this.grooveOrigin = { ctxTime: t0, position: start };
      this.grooveNextPos = start;
      if (this.grooveBus) {
        this.grooveBus.gain.cancelScheduledValues(ctx.currentTime);
        this.grooveBus.gain.setValueAtTime(1, ctx.currentTime);
      }
      this.startGrooveTimer();
    }
    this.setState('playing');
    this.startClock();
  }

  async record(project: Project, settings: StudioSettings, from?: number) {
    if (this.state !== 'stopped') await this.stop();
    const ctx = await this.ensureContext();
    if (!this.recorder) throw new Error('Micrófono no disponible');

    this.project = project;
    this.settings = settings;

    const start = from ?? this.idlePosition;
    this.setTempo(project.bpm);
    const beatSeconds = 60 / project.bpm;
    const countInSeconds = settings.countInBars * 4 * beatSeconds;
    const t0 = ctx.currentTime + LEAD_TIME + countInSeconds;

    this.anchorTime = t0;
    this.anchorPosition = start;
    this.recordStartPosition = start;
    this.recordLatencySeconds = effectiveLatencyMs(settings, ctx) / 1000;

    setAudioSession('play-and-record');
    this.scheduleProject(project, start, t0);
    this.recorder.start(t0);

    // Durante la claqueta siempre suena el click, aunque el metrónomo esté
    // apagado: es lo que te da la entrada.
    if (countInSeconds > 0) {
      this.scheduleCountIn(project.bpm, ctx.currentTime + LEAD_TIME, settings.countInBars * 4);
    }
    this.clickEnabled = settings.metronome;
    if (settings.metronome) this.startMetronome(start, t0);
    if (this.grooveDef) {
      this.grooveOrigin = { ctxTime: t0, position: start };
      this.grooveNextPos = start;
      if (this.grooveBus) {
        this.grooveBus.gain.cancelScheduledValues(ctx.currentTime);
        this.grooveBus.gain.setValueAtTime(1, ctx.currentTime);
      }
      this.startGrooveTimer();
    }

    this.setState(countInSeconds > 0 ? 'countin' : 'recording');
    this.startClock();
  }

  /**
   * Parar es asíncrono (hay que esperar la cola de la grabación), así que dos
   * toques seguidos al botón podrían cerrar la misma toma dos veces y crear
   * una pista fantasma. La primera llamada manda; las demás esperan.
   */
  async stop(opciones: { inmediata?: boolean } = {}): Promise<void> {
    if (this.stopping) return this.stopping;
    if (this.state === 'stopped') return;
    this.stopping = this.doStop(opciones.inmediata === true).finally(() => {
      this.stopping = null;
    });
    return this.stopping;
  }

  /**
   * `inmediata` (PWA): la app se va a segundo plano a media toma. No se espera
   * la cola de la última nota: iOS congela la página en nada y lo que importa
   * es sacar lo grabado y guardarlo antes.
   */
  private async doStop(inmediata = false): Promise<void> {
    const wasRecording = this.state === 'recording' || this.state === 'countin';
    const ctx = this.ctx;
    const endPosition = wasRecording
      ? Math.max(this.recordStartPosition, this.position)
      : this.position;

    this.stopMetronome();
    this.silenceGroove();
    this.stopClock();

    if (wasRecording && this.recorder && ctx) {
      // La cola de la interpretación todavía está viajando por el sistema:
      // si cortamos ahora, la última nota se queda a medias.
      const tail = Math.min(600, this.recordLatencySeconds * 1000 + 150);
      if (!inmediata) await new Promise((resolve) => setTimeout(resolve, tail));
      const { samples, sampleRate } = this.recorder.stop();
      // Se vuelve a modo reproducción antes de que pueda darle al play.
      setAudioSession('playback');
      this.clearSources();
      this.setState('stopped');
      /* El cursor vuelve a donde EMPEZÓ la toma, no a donde acabó.
         Con `endPosition` pasaba esto: grababas la guitarra, parabas, le dabas
         otra vez al botón rojo para meter la voz encima — y la voz se grababa
         a continuación, no encima. O sea que el gesto por el que existe esta
         app fallaba salvo que te acordaras de rebobinar antes, y nada en la
         pantalla te lo decía. Es lo que hacen GarageBand y Logic con "volver a
         la última posición de reproducción". */
      this.idlePosition = this.recordStartPosition;
      this.emitTick();
      if (samples.length > 0) {
        this.onTakeReady?.({
          samples,
          sampleRate,
          startPosition: this.recordStartPosition,
          latencySeconds: this.recordLatencySeconds,
        });
      }
      return;
    }

    this.clearSources();
    this.setState('stopped');
    /* Al parar una escucha de repaso —la que suena sola en cuanto sueltas el
       botón— el cursor no se queda donde lo dejó la reproducción: vuelve al
       principio de la toma. Si no, la escucha automática deshacía justo lo que
       arregla la línea de arriba. */
    this.idlePosition = this.reviewReturn ?? endPosition;
    this.reviewReturn = null;
    this.emitTick();
  }

  private setState(state: TransportState) {
    if (this.state === state) return;
    this.state = state;
    this.onStateChange?.(state);
  }

  private startClock() {
    const loop = () => {
      const ctx = this.ctx;
      if (!ctx || this.state === 'stopped') return;

      if (this.state === 'countin' && ctx.currentTime >= this.anchorTime) {
        this.setState('recording');
      }

      this.emitTick();

      if (this.state === 'playing' && this.project) {
        const end = projectDuration(this.project);
        if (end > 0 && this.position >= end + 0.15) {
          void this.stop();
          return;
        }
      }
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  private stopClock() {
    if (this.rafId != null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
  }

  private emitTick() {
    const ctx = this.ctx;
    const countIn =
      ctx && this.state === 'countin' ? Math.max(0, this.anchorTime - ctx.currentTime) : 0;
    this.onTick?.({ position: this.position, state: this.state, countInRemaining: countIn });
  }

  /* ------------------------------------------------------------------ */
  /* Programación de pistas                                              */
  /* ------------------------------------------------------------------ */

  private audibleTracks(project: Project): Track[] {
    const hasSolo = project.tracks.some((track) => track.soloed);
    return project.tracks.filter((track) => (hasSolo ? track.soloed : !track.muted));
  }

  private scheduleProject(project: Project, from: number, when: number) {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;

    this.clearSources();
    // Se programan TODAS las pistas, también las silenciadas, con la ganancia
    // a cero. Así quitar el mute a media reproducción funciona: si no las
    // programáramos, no habría nada que subir hasta volver a dar al play.
    const audible = new Set(this.audibleTracks(project).map((track) => track.id));

    for (const track of project.tracks) {
      const buffer = this.buffers.get(track.clip.bufferId);
      if (!buffer) continue;

      const gain = ctx.createGain();
      gain.gain.value = audible.has(track.id) ? track.volume : 0;
      gain.connect(master);
      this.trackGains.set(track.id, gain);

      const created = scheduleTrack(ctx, track, buffer, gain, from, when);
      this.sources.push(...created);
    }
  }

  private clearSources() {
    for (const source of this.sources) {
      try {
        source.onended = null;
        source.stop();
        source.disconnect();
      } catch {
        /* ya parado */
      }
    }
    this.sources = [];
    for (const gain of this.trackGains.values()) {
      try {
        gain.disconnect();
      } catch {
        /* ya desconectado */
      }
    }
    this.trackGains.clear();
  }

  setTrackVolume(trackId: string, volume: number) {
    const gain = this.trackGains.get(trackId);
    const ctx = this.ctx;
    if (gain && ctx) gain.gain.setTargetAtTime(volume, ctx.currentTime, 0.01);
  }

  /** Aplica en caliente cambios de mute/solo sin cortar la reproducción. */
  refreshMutes(project: Project) {
    const audible = new Set(this.audibleTracks(project).map((track) => track.id));
    const ctx = this.ctx;
    if (!ctx) return;
    for (const [trackId, gain] of this.trackGains) {
      const track = project.tracks.find((item) => item.id === trackId);
      const target = audible.has(trackId) ? (track?.volume ?? 1) : 0;
      gain.gain.setTargetAtTime(target, ctx.currentTime, 0.015);
    }
  }

  setMasterVolume(value: number) {
    const ctx = this.ctx;
    if (this.master && ctx) this.master.gain.setTargetAtTime(value, ctx.currentTime, 0.01);
  }

  /* ------------------------------------------------------------------ */
  /* Metrónomo                                                           */
  /* ------------------------------------------------------------------ */

  private scheduleCountIn(bpm: number, startAt: number, beats: number) {
    const ctx = this.ctx;
    if (!ctx || !this.clickBus) return;
    const beatSeconds = 60 / bpm;
    for (let i = 0; i < beats; i++) {
      this.playClick(startAt + i * beatSeconds, i % 4 === 0);
    }
  }

  private playClick(time: number, accent: boolean) {
    const ctx = this.ctx;
    const bus = this.clickBus;
    const buffer = accent ? this.clickHigh : this.clickLow;
    if (!ctx || !bus || !buffer) return;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(bus);
    source.start(time);
  }

  /**
   * Metrónomo con tempo vivo.
   *
   * El pulso NO se calcula como "compás número N por la duración del pulso":
   * si lo hiciera, mover el tempo a mitad de una toma recolocaría todos los
   * clicks pasados y el metrónomo daría un salto. Se lleva un puntero al
   * siguiente click y se avanza sumándole la duración del pulso ACTUAL, así
   * que un cambio de tempo entra a partir del pulso siguiente y ni se nota.
   */
  private startMetronome(fromPosition: number, when: number) {
    const ctx = this.ctx;
    if (!ctx) return;
    const beatSeconds = 60 / this.bpm;
    const firstBeat = Math.max(0, Math.ceil(fromPosition / beatSeconds));
    this.nextClickTime = when + (firstBeat * beatSeconds - fromPosition);
    this.beatCounter = firstBeat;
    this.clickEnabled = true;
    this.startTicking();
  }

  /** Tempo del proyecto. Se puede mover con el transporte en marcha. */
  setTempo(bpm: number) {
    this.bpm = Math.max(20, Math.min(300, bpm));
  }

  get tempo(): number {
    return this.bpm;
  }

  /** Encender o apagar el click sin parar lo que esté sonando. */
  setMetronomeEnabled(enabled: boolean) {
    const ctx = this.ctx;
    if (enabled === this.clickEnabled) return;
    this.clickEnabled = enabled;
    if (!enabled) {
      this.stopMetronome();
      return;
    }
    if (!ctx || this.state === 'stopped') return;
    // Enganchamos con el pulso más cercano para no entrar a destiempo.
    const beatSeconds = 60 / this.bpm;
    const position = this.position;
    const nextBeatIndex = Math.ceil(position / beatSeconds);
    this.beatCounter = nextBeatIndex;
    this.nextClickTime = ctx.currentTime + (nextBeatIndex * beatSeconds - position);
    this.startTicking();
  }

  private startTicking() {
    if (this.schedulerTimer != null) return;
    const tick = () => {
      const context = this.ctx;
      if (!context || this.state === 'stopped' || !this.clickEnabled) return;
      const horizon = context.currentTime + SCHEDULER_LOOKAHEAD;
      for (let guard = 0; guard < 64; guard++) {
        if (this.nextClickTime > horizon) break;
        if (this.nextClickTime >= context.currentTime) {
          this.playClick(this.nextClickTime, this.beatCounter % 4 === 0);
        }
        this.nextClickTime += 60 / this.bpm;
        this.beatCounter++;
      }
    };
    tick();
    this.schedulerTimer = window.setInterval(tick, SCHEDULER_INTERVAL);
  }

  private stopMetronome() {
    if (this.schedulerTimer != null) window.clearInterval(this.schedulerTimer);
    this.schedulerTimer = null;
  }


  setMetronomeVolume(value: number) {
    const ctx = this.ctx;
    if (this.clickBus && ctx) this.clickBus.gain.setTargetAtTime(value, ctx.currentTime, 0.01);
  }

  /**
   * Tono de prueba por la misma cadena que la música (master + limitador).
   * Si esto no se oye, el problema no son las pistas: es la salida del móvil.
   */
  async playTestTone(): Promise<void> {
    const ctx = await this.ensureContext();
    const master = this.master;
    if (!master) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 440;
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.35, now + 0.03);
    gain.gain.setValueAtTime(0.35, now + 0.6);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.85);
    osc.connect(gain);
    gain.connect(master);
    osc.start(now);
    osc.stop(now + 0.9);
  }

  /* ------------------------------------------------------------------ */
  /* Ritmo                                                               */
  /* ------------------------------------------------------------------ */

  get currentGroove(): Groove | null {
    return this.grooveDef;
  }

  /**
   * Pone o quita el ritmo. Entra en caliente: se puede cambiar de palo con el
   * transporte en marcha y no se corta nada, porque el patrón se regenera en
   * cada vuelta en vez de reproducir un bucle de audio.
   */
  setGroove(groove: Groove | null, opciones?: Partial<GrooveOptions>) {
    if (opciones) this.grooveOpts = { ...this.grooveOpts, ...opciones };
    const cambia = groove?.id !== this.grooveDef?.id;
    this.grooveDef = groove;

    if (!groove) {
      this.silenceGroove();
      return;
    }
    if (this.grooveBus && this.ctx) {
      this.grooveBus.gain.cancelScheduledValues(this.ctx.currentTime);
      this.grooveBus.gain.setValueAtTime(1, this.ctx.currentTime);
    }
    if (cambia && this.grooveOrigin) {
      // Reengancha desde ya, sin esperar a que acabe la vuelta.
      this.grooveNextPos = this.groovePosition();
    }
    if (this.grooveOrigin) this.startGrooveTimer();
  }

  setGrooveOptions(opciones: Partial<GrooveOptions>) {
    this.grooveOpts = { ...this.grooveOpts, ...opciones };
  }

  get grooveOptions(): GrooveOptions {
    return this.grooveOpts;
  }

  /** Escuchar el ritmo suelto, sin mover el transporte. */
  async previewGroove(groove: Groove, opciones?: Partial<GrooveOptions>) {
    const ctx = await this.ensureContext();
    if (opciones) this.grooveOpts = { ...this.grooveOpts, ...opciones };
    this.grooveDef = groove;
    this.grooveOrigin = { ctxTime: ctx.currentTime + 0.08, position: 0 };
    this.grooveNextPos = 0;
    if (this.grooveBus) {
      this.grooveBus.gain.cancelScheduledValues(ctx.currentTime);
      this.grooveBus.gain.setValueAtTime(1, ctx.currentTime);
    }
    this.startGrooveTimer();
  }

  stopGroovePreview() {
    if (this.state === 'stopped') this.silenceGroove();
  }

  private groovePosition(): number {
    const ctx = this.ctx;
    if (!ctx || !this.grooveOrigin) return 0;
    return this.grooveOrigin.position + (ctx.currentTime - this.grooveOrigin.ctxTime);
  }

  private silenceGroove() {
    const ctx = this.ctx;
    if (this.grooveTimer != null) window.clearInterval(this.grooveTimer);
    this.grooveTimer = null;
    this.grooveOrigin = null;
    // Los golpes ya programados (como mucho 200 ms) se callan bajando el bus.
    if (this.grooveBus && ctx) {
      this.grooveBus.gain.cancelScheduledValues(ctx.currentTime);
      this.grooveBus.gain.setValueAtTime(this.grooveBus.gain.value, ctx.currentTime);
      this.grooveBus.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.03);
    }
  }

  private startGrooveTimer() {
    if (this.grooveTimer != null) return;
    const tick = () => {
      const ctx = this.ctx;
      const groove = this.grooveDef;
      const origin = this.grooveOrigin;
      const bus = this.grooveBus;
      if (!ctx || !groove || !origin || !bus) return;

      const horizonteCtx = ctx.currentTime + SCHEDULER_LOOKAHEAD;
      const horizontePos = origin.position + (horizonteCtx - origin.ctxTime);
      if (horizontePos <= this.grooveNextPos) return;

      const golpes = golpesEntre(
        groove,
        this.bpm,
        this.grooveNextPos,
        horizontePos,
        this.grooveOpts,
      );
      for (const golpe of golpes) {
        const cuando = origin.ctxTime + (golpe.posicion - origin.position);
        if (cuando < ctx.currentTime) continue;
        playVoice(golpe.voz, ctx, bus, cuando, golpe.vel);
      }
      this.grooveNextPos = horizontePos;
    };
    tick();
    this.grooveTimer = window.setInterval(tick, SCHEDULER_INTERVAL);
  }

  /** Un click suelto, para el tap tempo y las pruebas de latencia. */
  previewClick(accent = true) {
    const ctx = this.ctx;
    if (!ctx) return;
    this.playClick(ctx.currentTime + 0.02, accent);
  }

  /* ------------------------------------------------------------------ */
  /* Mezcla y exportación                                                */
  /* ------------------------------------------------------------------ */

  async renderMix(project: Project, only?: Track[]): Promise<AudioBuffer> {
    const sampleRate = this.contextSampleRate;
    const tracks = only ?? this.audibleTracks(project);
    const duration = Math.max(
      0.5,
      tracks.reduce(
        (max, track) => Math.max(max, track.clip.start + track.clip.duration * track.clip.repeats),
        0,
      ) + 0.4,
    );

    const offline = new OfflineAudioContext(2, Math.ceil(duration * sampleRate), sampleRate);
    const master = offline.createGain();
    master.gain.value = 1;
    const limiter = offline.createDynamicsCompressor();
    limiter.threshold.value = -3;
    limiter.knee.value = 6;
    limiter.ratio.value = 12;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.2;
    master.connect(limiter);
    limiter.connect(offline.destination);

    for (const track of tracks) {
      const buffer = this.buffers.get(track.clip.bufferId);
      if (!buffer) continue;
      const gain = offline.createGain();
      gain.gain.value = track.volume;
      gain.connect(master);
      scheduleTrack(offline, track, buffer, gain, 0, 0);
    }

    return offline.startRendering();
  }

  dispose() {
    this.stopMetronome();
    this.silenceGroove();
    this.stopClock();
    this.clearSources();
    this.releaseInput();
    this.buffers.clear();
    void this.ctx?.close();
    this.ctx = null;
  }
}

/**
 * Programa todas las repeticiones de un clip. Devuelve las fuentes creadas
 * para poder pararlas después. Se usa igual en directo y en la mezcla offline,
 * así lo que exportas es exactamente lo que oyes.
 */
function scheduleTrack(
  ctx: BaseAudioContext,
  track: Track,
  buffer: AudioBuffer,
  destination: AudioNode,
  from: number,
  when: number,
): AudioBufferSourceNode[] {
  const created: AudioBufferSourceNode[] = [];
  const { clip } = track;
  const repeats = Math.max(1, Math.floor(clip.repeats));

  for (let repeat = 0; repeat < repeats; repeat++) {
    const repeatStart = clip.start + repeat * clip.duration;
    const repeatEnd = repeatStart + clip.duration;
    if (repeatEnd <= from) continue;

    const skip = Math.max(0, from - repeatStart);
    const playDuration = clip.duration - skip;
    if (playDuration <= 0.005) continue;

    const bufferOffset = clip.offset + skip;
    if (bufferOffset >= buffer.duration) continue;

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const startAt = when + Math.max(0, repeatStart - from);
    const duration = Math.min(playDuration, buffer.duration - bufferOffset);

    // Un corte a mitad de onda hace un CLIC. No es un defecto sutil: se oye
    // en cada repetición y en cada extremo recortado. Seis milisegundos de
    // entrada y de salida lo matan sin comerse el ataque de nada.
    const fade = Math.min(FADE_TIME, duration / 3);
    const envelope = ctx.createGain();
    envelope.gain.setValueAtTime(0, startAt);
    envelope.gain.linearRampToValueAtTime(1, startAt + fade);
    envelope.gain.setValueAtTime(1, startAt + duration - fade);
    envelope.gain.linearRampToValueAtTime(0, startAt + duration);

    source.connect(envelope);
    envelope.connect(destination);
    source.start(startAt, bufferOffset, duration);
    source.onended = () => {
      try {
        envelope.disconnect();
      } catch {
        /* ya desconectado */
      }
    };
    created.push(source);
  }

  return created;
}
