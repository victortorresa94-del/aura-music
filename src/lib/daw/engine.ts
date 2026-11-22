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
// Mezcla (pilar A): el mismo grafo para escuchar y para exportar.
import {
  buildMixGraph,
  estadoDeMezcla,
  medirLatenciaDeCadena,
  pistasQueSuenan,
  type GrafoMezcla,
} from './mezcla/grafo';
import { masterizar, OBJETIVOS, type ResultadoMaster } from './mezcla/masterizar';
import { masterDe, type ObjetivoMaster } from './mezcla/tipos';
// La claqueta de varias formas: sonido, subdivisión, ritmo de fondo y volumen.
import {
  CLAQUETA_POR_DEFECTO,
  fondoDe,
  golpesDeCuenta,
  golpesDelPaso,
  PULSOS_POR_GOLPE,
  primerPaso,
  suenaElClic,
  type AjustesClaqueta,
  type GolpeClaqueta,
} from './claqueta/claqueta';

const LEAD_TIME = 0.12;
/** Lo que se espera a que iOS despierte el audio antes de darlo por atascado. */
const RESUME_MS = 1200;

/** El audio del sistema no arranca: hay que volver a tocar para rehacerlo. */
export class AudioBloqueado extends Error {
  constructor() {
    super('El audio del móvil se ha quedado bloqueado. Toca otra vez y lo despierto.');
    this.name = 'AudioBloqueado';
  }
}
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

/**
 * Pilar B (instrumentos): opciones para reproducir mientras se graba lo que
 * tocas en la pantalla. No hay micro, así que no pasa por `record`.
 */
export interface OpcionesReproduccion {
  /** Pulsos de claqueta antes de arrancar (la cuenta atrás). */
  claquetaPulsos?: number;
  /** No parar al llegar al final del proyecto: se está tocando algo nuevo. */
  sinFin?: boolean;
}

export class StudioEngine {
  ctx: AudioContext | null = null;
  /** La entrada del master del grafo de mezcla: aquí van el ritmo y el tono de prueba. */
  private master: GainNode | null = null;
  private mezcla: GrafoMezcla | null = null;
  private clickBus: GainNode | null = null;

  private buffers = new Map<string, AudioBuffer>();
  private sources: AudioBufferSourceNode[] = [];
  /** El contexto no arrancó tras volver de otra app: el próximo toque lo rehace. */
  private contextoAtascado = false;
  /** La salida elegida en Ajustes (null = la del sistema). Se aplica también al rehacer el contexto. */
  private salidaId: string | null = null;

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
  /** El paso de la subdivisión que toca después (el 0 es el 1 del primer compás). */
  private beatCounter = 0;
  private bpm = 100;
  private clickEnabled = false;
  private claqueta: AjustesClaqueta = CLAQUETA_POR_DEFECTO;
  private pulsosCompas = 4;
  /** Ritmo de fondo de la claqueta: dónde va y desde qué instante se cuenta. */
  private fondoNextPos = 0;
  private fondoOrigin: { ctxTime: number; position: number } | null = null;
  /** El ejemplo que suena al elegir un sonido: se apaga si se pide otro. */
  private ejemplo: GainNode | null = null;
  private rafId: number | null = null;

  private project: Project | null = null;
  private settings: StudioSettings | null = null;
  private stopping: Promise<void> | null = null;
  /** Pilar B: grabando notas, el transporte no se para solo al final del proyecto. */
  private sinFin = false;

  onTick: ((info: TickInfo) => void) | null = null;
  onLevel: ((level: number) => void) | null = null;
  onTakeReady: ((take: RecordingTake) => void) | null = null;
  onStateChange: ((state: TransportState) => void) | null = null;

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
    if (this.salidaId) void this.aplicarSalida(ctx, this.salidaId);

    // El master (volumen y limitador) y las cadenas de las pistas viven en
    // el grafo de mezcla, el mismo que monta `renderMix` para exportar.
    this.mezcla?.desmontar();
    const mezcla = buildMixGraph(ctx, { salida: ctx.destination, medidores: true });
    this.mezcla = mezcla;
    void medirLatenciaDeCadena(ctx.sampleRate).then((segundos) => {
      if (this.mezcla === mezcla) mezcla.latencia = segundos;
    });
    const master = mezcla.entrada;

    const clickBus = ctx.createGain();
    // Lo que diga la claqueta (0,8 por defecto, lo de siempre).
    clickBus.gain.value = this.claqueta.volumen;
    clickBus.connect(ctx.destination);

    // El ritmo va por el limitador, como las pistas: es material musical, no
    // una señal de servicio como el click.
    const grooveBus = ctx.createGain();
    grooveBus.gain.value = 1;
    grooveBus.connect(master);
    this.grooveBus = grooveBus;

    this.ctx = ctx;
    this.master = master;
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
    if (!this.ctx || this.ctx.state === 'closed' || isInterrupted(this.ctx) || this.contextoAtascado) {
      this.contextoAtascado = false;
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
    return ctx;
  }

  /**
   * Nunca se queda esperando para siempre. En iOS 26, al volver de otra app,
   * `resume()` a veces no vuelve nunca (WebKit 291892): antes eso dejaba el
   * play colgado y, con él, el candado del transporte, así que el botón ya no
   * respondía hasta recargar (17-nov-2026, el dueño: «no me va el play en el
   * móvil»). Ahora se espera como mucho RESUME_MS; si el contexto no arranca,
   * se marca como atascado y el siguiente toque lo rehace entero dentro del
   * gesto, que es lo único que iOS acepta.
   */
  async ensureContext(): Promise<AudioContext> {
    const ctx = this.unlockSync();
    if (ctx.state !== 'running') {
      await Promise.race([
        ctx.resume().catch(() => undefined),
        new Promise((resolve) => setTimeout(resolve, RESUME_MS)),
      ]);
      // TS cree que el estado no cambia tras el await; en el navegador sí.
      if ((ctx.state as AudioContextState) !== 'running') this.contextoAtascado = true;
    }
    return ctx;
  }

  /** Para el transporte: sin el audio en marcha no se arranca, se avisa. */
  private async contextoEnMarcha(): Promise<AudioContext> {
    const ctx = await this.ensureContext();
    if (ctx.state !== 'running') throw new AudioBloqueado();
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

  /**
   * Pilar B: la posición de la línea de tiempo que corresponde a un instante
   * del reloj de audio, sin recortar la claqueta (sale negativa antes del
   * arranque). Es lo que coloca cada nota tocada en la pantalla en su sitio.
   */
  posicionEn(tiempoContexto: number): number {
    return this.anchorPosition + (tiempoContexto - this.anchorTime);
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

  async play(project: Project, settings: StudioSettings, from?: number, opciones: OpcionesReproduccion = {}) {
    if (this.state !== 'stopped') await this.stop();
    const ctx = await this.contextoEnMarcha();
    this.reviewReturn = null;
    this.project = project;
    this.settings = settings;

    const start = from ?? this.idlePosition;
    // Pilar B: la claqueta va delante del arranque, como en `record`.
    const claquetaPulsos = Math.max(0, Math.round(opciones.claquetaPulsos ?? 0));
    const claqueta = claquetaPulsos * (60 / project.bpm);
    if (claquetaPulsos > 0) this.scheduleCountIn(project.bpm, ctx.currentTime + LEAD_TIME, claquetaPulsos, this.pulsosCompas);
    this.sinFin = !!opciones.sinFin;
    const t0 = ctx.currentTime + LEAD_TIME + claqueta;
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
    const ctx = await this.contextoEnMarcha();
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
    this.sinFin = false;

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

      if (this.state === 'playing' && this.project && !this.sinFin) {
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
    const suenan = pistasQueSuenan(project.tracks);
    return project.tracks.filter((track) => suenan.has(track.id));
  }

  /** Canales del audio de una pista: el grafo compensa el panorama de las mono. */
  private canalesDe = (track: Track): number => this.buffers.get(track.clip.bufferId)?.numberOfChannels ?? 1;

  private scheduleProject(project: Project, from: number, when: number) {
    const ctx = this.ctx;
    const mezcla = this.mezcla;
    if (!ctx || !mezcla) return;

    this.clearSources();
    // Se programan TODAS las pistas, también las silenciadas, con el fader
    // a cero. Así quitar el mute a media reproducción funciona: si no las
    // programáramos, no habría nada que subir hasta volver a dar al play.
    mezcla.sincronizar(estadoDeMezcla(project, this.canalesDe));

    // La cadena de cada pista retrasa unos milisegundos (el compresor mira
    // por delante). Las fuentes salen ese tanto antes y la toma suena justo
    // donde está en la línea de tiempo, a la par que el click y el ritmo.
    const salida = when - mezcla.latencia;
    for (const track of project.tracks) {
      const buffer = this.buffers.get(track.clip.bufferId);
      const entrada = mezcla.entradaDe(track.id);
      if (!buffer || !entrada) continue;
      const created = scheduleTrack(ctx, track, buffer, entrada, from, salida);
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
  }

  /** El fader de una pista, en caliente. `suena` = false si está en mute o fuera del solo. */
  setTrackVolume(trackId: string, volume: number, suena = true) {
    this.mezcla?.volumenEnVivo(trackId, volume, suena);
  }

  /** Aplica en caliente cambios de mute/solo sin cortar la reproducción. */
  refreshMutes(project: Project) {
    this.aplicarMezcla(project);
  }

  /**
   * Pone la mezcla del proyecto (faders, mute y solo, efectos, master) en
   * lo que está sonando. Solo mueve lo que ha cambiado, así que se puede
   * llamar en cada cambio del proyecto, también al deshacer.
   */
  aplicarMezcla(project: Project) {
    this.mezcla?.sincronizar(estadoDeMezcla(project, this.canalesDe));
  }

  /** Para los medidores del mezclador. Cambia si iOS obliga a rehacer el contexto. */
  get grafoMezcla(): GrafoMezcla | null {
    return this.mezcla;
  }

  /**
   * Vuelve a programar lo que suena sin parar la reproducción, desde donde va
   * el cursor. Hace falta cuando cambia QUÉ suena mientras suena: una pista
   * que pone el músico o el productor, o un clip que se mueve o se recorta.
   * Sin esto, lo nuevo no se oía hasta parar y volver a darle al play
   * (17-nov-2026, el dueño: «no se oye la pista que he añadido»).
   *
   * El reloj no se toca, así que la claqueta y el ritmo siguen igual. Las
   * fuentes nuevas arrancan dentro de LEAD_TIME justo en su punto de la línea
   * de tiempo y las viejas se paran en ese mismo instante: no hay hueco.
   * Reutiliza `scheduleProject`, para que lo nuevo pase por la misma cadena
   * que lo demás.
   *
   * Mezcla (pilar A): las cadenas de las pistas viven en el grafo de mezcla
   * y no se rehacen; solo cambian las fuentes. Las nuevas salen adelantadas
   * la latencia de la cadena (ver `scheduleProject`), así que las viejas se
   * paran en ese mismo instante, no en `when`, para no solaparse 9 ms.
   */
  resync(project: Project) {
    const ctx = this.ctx;
    if (!ctx || this.state !== 'playing') return;
    this.project = project;
    const when = ctx.currentTime + LEAD_TIME;
    const from = this.anchorPosition + (when - this.anchorTime);
    const corte = when - (this.mezcla?.latencia ?? 0);

    const viejas = this.sources;
    // Vacías antes de programar: `scheduleProject` limpia lo que haya, y lo
    // viejo tiene que seguir sonando hasta el corte.
    this.sources = [];
    this.scheduleProject(project, from, when);

    for (const source of viejas) {
      try {
        source.onended = null;
        source.stop(corte);
      } catch {
        /* ya parado */
      }
    }
    window.setTimeout(() => {
      for (const node of viejas) {
        try {
          node.disconnect();
        } catch {
          /* ya desconectado */
        }
      }
    }, (LEAD_TIME + 0.25) * 1000);
  }

  /**
   * Elige por dónde suena todo el estudio (pistas, instrumentos, claqueta):
   * por ejemplo los cascos de la interfaz de audio. Devuelve false si el
   * navegador no deja elegir o la salida ya no existe.
   */
  async setSalida(id: string | null): Promise<boolean> {
    this.salidaId = id;
    if (!this.ctx) return true;
    return this.aplicarSalida(this.ctx, id);
  }

  private async aplicarSalida(ctx: AudioContext, id: string | null): Promise<boolean> {
    const conSalida = ctx as AudioContext & { setSinkId?: (id: string) => Promise<void> };
    if (!conSalida.setSinkId) return false;
    try {
      await conSalida.setSinkId(id ?? '');
      return true;
    } catch {
      return false;
    }
  }

  setMasterVolume(value: number) {
    const ctx = this.ctx;
    if (this.master && ctx) this.master.gain.setTargetAtTime(value, ctx.currentTime, 0.01);
  }

  /* ------------------------------------------------------------------ */
  /* Metrónomo                                                           */
  /* ------------------------------------------------------------------ */

  /** La cuenta atrás, con el sonido de la claqueta. `pulsosPorCompas` marca dónde va el 1. */
  private scheduleCountIn(bpm: number, startAt: number, beats: number, pulsosPorCompas = 4) {
    const ctx = this.ctx;
    if (!ctx || !this.clickBus) return;
    const beatSeconds = 60 / bpm;
    for (let i = 0; i < beats; i++) {
      for (const golpe of golpesDeCuenta(this.claqueta, i, pulsosPorCompas)) {
        this.sonarGolpe(startAt + i * beatSeconds, golpe);
      }
    }
  }

  private playClick(time: number, accent: boolean, vel = 1, destino?: AudioNode) {
    const ctx = this.ctx;
    const bus = destino ?? this.clickBus;
    const buffer = accent ? this.clickHigh : this.clickLow;
    if (!ctx || !bus || !buffer) return;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    if (vel < 1) {
      const gain = ctx.createGain();
      gain.gain.value = vel;
      source.connect(gain);
      gain.connect(bus);
      source.onended = () => gain.disconnect();
    } else {
      source.connect(bus);
    }
    source.start(time);
  }

  /** Un golpe de la claqueta: el tic de siempre o una voz del kit de ritmos. */
  private sonarGolpe(time: number, golpe: GolpeClaqueta, destino?: AudioNode) {
    const ctx = this.ctx;
    const bus = destino ?? this.clickBus;
    if (!ctx || !bus) return;
    if (golpe.voz.tipo === 'tic') this.playClick(time, golpe.voz.agudo, golpe.vel, bus);
    else playVoice(golpe.voz.voz, ctx, bus, time, golpe.vel);
  }

  /**
   * Metrónomo con tempo vivo.
   *
   * El pulso NO se calcula como "compás número N por la duración del pulso":
   * si lo hiciera, mover el tempo a mitad de una toma recolocaría todos los
   * clicks pasados y el metrónomo daría un salto. Se lleva un puntero al
   * siguiente click y se avanza sumándole la duración del paso ACTUAL, así
   * que un cambio de tempo entra a partir del paso siguiente y ni se nota.
   * El paso es el de la subdivisión de la claqueta (blancas, negras,
   * corcheas o tresillos).
   */
  private startMetronome(fromPosition: number, when: number) {
    const ctx = this.ctx;
    if (!ctx) return;
    this.engancharClaqueta(fromPosition, when);
    this.clickEnabled = true;
    this.startTicking();
  }

  /** Pone el puntero de la claqueta y el del ritmo de fondo en `posicion`, que suena en `cuando`. */
  private engancharClaqueta(posicion: number, cuando: number) {
    const { paso, segundos } = primerPaso(posicion, this.bpm, this.claqueta.subdivision);
    this.nextClickTime = cuando + (segundos - posicion);
    this.beatCounter = paso;
    this.fondoOrigin = { ctxTime: cuando, position: posicion };
    this.fondoNextPos = posicion;
  }

  /** Tempo del proyecto. Se puede mover con el transporte en marcha. */
  setTempo(bpm: number) {
    this.bpm = Math.max(20, Math.min(300, bpm));
  }

  get tempo(): number {
    return this.bpm;
  }

  /**
   * Cómo suena la claqueta y cuántos pulsos tiene el compás (para saber
   * dónde va el 1). Entra en caliente: si cambia la subdivisión o el ritmo
   * de fondo con el transporte en marcha, se reengancha desde donde va.
   */
  setClaqueta(ajustes: AjustesClaqueta, pulsosPorCompas = this.pulsosCompas) {
    const antes = this.claqueta;
    this.claqueta = ajustes;
    this.pulsosCompas = Math.max(1, Math.round(pulsosPorCompas));
    const ctx = this.ctx;
    if (this.clickBus && ctx && antes.volumen !== ajustes.volumen) {
      this.clickBus.gain.setTargetAtTime(ajustes.volumen, ctx.currentTime, 0.02);
    }
    const sonando = this.state === 'playing' || this.state === 'recording';
    if (ctx && sonando && this.clickEnabled && (antes.subdivision !== ajustes.subdivision || antes.fondo !== ajustes.fondo)) {
      this.engancharClaqueta(this.position + SCHEDULER_LOOKAHEAD, ctx.currentTime + SCHEDULER_LOOKAHEAD);
    }
  }

  get ajustesClaqueta(): AjustesClaqueta {
    return this.claqueta;
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
    // Enganchamos con el paso más cercano para no entrar a destiempo.
    this.engancharClaqueta(this.position, ctx.currentTime);
    this.startTicking();
  }

  private startTicking() {
    if (this.schedulerTimer != null) return;
    const tick = () => {
      const context = this.ctx;
      if (!context || this.state === 'stopped' || !this.clickEnabled) return;
      const horizon = context.currentTime + SCHEDULER_LOOKAHEAD;
      const ajustes = this.claqueta;
      const clic = suenaElClic(ajustes);
      for (let guard = 0; guard < 64; guard++) {
        if (this.nextClickTime > horizon) break;
        if (clic && this.nextClickTime >= context.currentTime) {
          for (const golpe of golpesDelPaso(ajustes, this.beatCounter, this.pulsosCompas)) {
            this.sonarGolpe(this.nextClickTime, golpe);
          }
        }
        this.nextClickTime += (60 / this.bpm) * PULSOS_POR_GOLPE[ajustes.subdivision];
        this.beatCounter++;
      }

      // El ritmo de fondo: suena por el bus de la claqueta (no por la mezcla,
      // ni se graba, ni se exporta) y se regenera en cada vuelta, como los
      // ritmos de la hoja de Ritmos.
      const fondo = fondoDe(ajustes.fondo);
      const origen = this.fondoOrigin;
      if (fondo && origen && this.clickBus) {
        const hasta = origen.position + (horizon - origen.ctxTime);
        if (hasta > this.fondoNextPos) {
          for (const golpe of golpesEntre(fondo.groove, this.bpm, this.fondoNextPos, hasta, fondo.opciones)) {
            const cuando = origen.ctxTime + (golpe.posicion - origen.position);
            if (cuando < context.currentTime) continue;
            playVoice(golpe.voz, context, this.clickBus, cuando, golpe.vel);
          }
          this.fondoNextPos = hasta;
        }
      }
    };
    tick();
    this.schedulerTimer = window.setInterval(tick, SCHEDULER_INTERVAL);
  }

  private stopMetronome() {
    if (this.schedulerTimer != null) window.clearInterval(this.schedulerTimer);
    this.schedulerTimer = null;
    this.fondoOrigin = null;
  }

  /**
   * Un ejemplo de la claqueta al elegirla: un compás del sonido, o una vuelta
   * del ritmo de fondo. Con el transporte en marcha no suena nada aparte: el
   * cambio ya se oye en lo que está sonando.
   */
  previewClaqueta(ajustes: AjustesClaqueta = this.claqueta, que: 'clic' | 'fondo' = 'clic') {
    const ctx = this.ctx;
    if (!ctx || !this.clickBus || this.state !== 'stopped') return;
    const ahora = ctx.currentTime;
    if (this.ejemplo) {
      const viejo = this.ejemplo;
      viejo.gain.setTargetAtTime(0, ahora, 0.01);
      window.setTimeout(() => viejo.disconnect(), 120);
    }
    // El volumen del ejemplo es el que se acaba de elegir: se pone ya en el bus.
    this.clickBus.gain.setTargetAtTime(ajustes.volumen, ahora, 0.01);
    const salida = ctx.createGain();
    salida.connect(this.clickBus);
    this.ejemplo = salida;
    const t0 = ahora + 0.05;
    const fondo = que === 'fondo' ? fondoDe(ajustes.fondo) : null;
    if (fondo) {
      // Dos compases como mucho: lo justo para reconocerlo.
      const hasta = Math.min(4, (60 / this.bpm) * this.pulsosCompas * 2);
      for (const golpe of golpesEntre(fondo.groove, this.bpm, 0, hasta, fondo.opciones)) {
        playVoice(golpe.voz, ctx, salida, t0 + golpe.posicion, golpe.vel);
      }
      return;
    }
    const duracion = (60 / this.bpm) * PULSOS_POR_GOLPE[ajustes.subdivision];
    const pasos = Math.max(1, Math.round(this.pulsosCompas / PULSOS_POR_GOLPE[ajustes.subdivision]));
    for (let k = 0; k < pasos; k++) {
      for (const golpe of golpesDelPaso(ajustes, k, this.pulsosCompas)) this.sonarGolpe(t0 + k * duracion, golpe, salida);
    }
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

  /**
   * La mezcla en un WAV, con el mismo grafo que suena al reproducir
   * (`buildMixGraph`). Con `only`, una pista suelta con su cadena y sus
   * envíos. La mezcla entera sale masterizada si el master lo pide;
   * las pistas sueltas nunca: son piezas para acabar en otro sitio.
   */
  async renderMix(
    project: Project,
    only?: Track[],
    opciones: { masterizar?: boolean } = {},
  ): Promise<AudioBuffer> {
    const crudo = await this.renderizar(project, only);
    const objetivo = masterDe(project).masterizado;
    if (only || objetivo === 'no' || opciones.masterizar === false) return crudo;
    return this.aBuffer(this.masterizarBuffer(crudo, objetivo).canales, crudo.sampleRate);
  }

  /**
   * Lo que haría «Masterizar» con la mezcla de ahora: cuánto suena antes y
   * cuánto sonará el WAV. Mezcla en un contexto sin sonido, así que se puede
   * pedir con el transporte parado o en marcha.
   */
  async analizarMaster(project: Project, objetivo: Exclude<ObjetivoMaster, 'no'>): Promise<ResultadoMaster> {
    const crudo = await this.renderizar(project);
    return this.masterizarBuffer(crudo, objetivo);
  }

  private masterizarBuffer(buffer: AudioBuffer, objetivo: Exclude<ObjetivoMaster, 'no'>): ResultadoMaster {
    const canales: Float32Array[] = [];
    for (let c = 0; c < buffer.numberOfChannels; c++) canales.push(buffer.getChannelData(c));
    return masterizar(canales, buffer.sampleRate, OBJETIVOS[objetivo]);
  }

  private aBuffer(canales: Float32Array<ArrayBuffer>[], sampleRate: number): AudioBuffer {
    const salida = new AudioBuffer({ numberOfChannels: canales.length, length: canales[0].length, sampleRate });
    canales.forEach((datos, c) => salida.copyToChannel(datos, c));
    return salida;
  }

  private async renderizar(project: Project, only?: Track[]): Promise<AudioBuffer> {
    const sampleRate = this.contextSampleRate;
    const tracks = only ?? this.audibleTracks(project);
    const latencia = await medirLatenciaDeCadena(sampleRate);
    const masterProyecto = masterDe(project);
    // Las colas de la reverb y del eco también son parte de la canción: el
    // WAV no se corta en seco al acabar la última pista.
    const haySala = tracks.some((t) => (t.mezcla?.reverb ?? 0) > 0);
    const hayEco = tracks.some((t) => (t.mezcla?.eco ?? 0) > 0);
    const cola = Math.max(0.4, haySala ? 2.5 : 0, hayEco ? 1.5 + masterProyecto.repeticiones * 4 : 0);
    const duration = Math.max(
      0.5,
      tracks.reduce(
        (max, track) => Math.max(max, track.clip.start + track.clip.duration * track.clip.repeats),
        0,
      ) + cola,
    );

    const retraso = Math.round(latencia * sampleRate);
    const frames = Math.ceil(duration * sampleRate);
    const offline = new OfflineAudioContext(2, frames + retraso, sampleRate);
    const grafo = buildMixGraph(offline, { salida: offline.destination });
    grafo.sincronizar(estadoDeMezcla(project, this.canalesDe, only), true);

    for (const track of tracks) {
      const buffer = this.buffers.get(track.clip.bufferId);
      const entrada = grafo.entradaDe(track.id);
      if (!buffer || !entrada) continue;
      scheduleTrack(offline, track, buffer, entrada, 0, 0);
    }

    const rendered = await offline.startRendering();
    // Lo que en directo se compensa adelantando las fuentes, aquí se quita
    // del principio: la muestra 0 del WAV es el segundo 0 de la idea.
    if (retraso === 0) return rendered;
    const salida = new AudioBuffer({ numberOfChannels: 2, length: frames, sampleRate });
    for (let c = 0; c < 2; c++) salida.copyToChannel(rendered.getChannelData(c).subarray(retraso, retraso + frames), c);
    return salida;
  }

  dispose() {
    this.stopMetronome();
    this.silenceGroove();
    this.stopClock();
    this.clearSources();
    this.releaseInput();
    this.buffers.clear();
    this.mezcla?.desmontar();
    this.mezcla = null;
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
