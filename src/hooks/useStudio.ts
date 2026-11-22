'use client';

/**
 * Estado del estudio. La posición del cursor y el nivel de entrada NO viven en
 * el estado de React: cambian 60 veces por segundo y redibujar el árbol entero
 * a ese ritmo se nota en un móvil. Se leen del motor con rAF desde los dos
 * componentes que de verdad los necesitan.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { computePeaks } from '@/lib/daw/audio';
import { AudioBloqueado, StudioEngine, type RecordingTake } from '@/lib/daw/engine';
import { detectarTempo, type TempoResult } from '@/lib/daw/analysis/tempo';
import { detectarTonalidad, type KeyResult } from '@/lib/daw/analysis/key';
import {
  decidirCorreccion,
  golpesDePista,
  medirToma,
  pistasQueSonaban,
  type Correccion,
} from '@/lib/daw/analysis/retraso';
import { getAudioSession } from '@/lib/daw/ios';
import type { Groove } from '@/lib/daw/rhythm/grooves';
import { renderGroove, type GrooveOptions } from '@/lib/daw/rhythm/player';
import {
  aprenderLatencia,
  calibrateLatency,
  effectiveLatencyMs,
  estadoLatencia,
  estimateLatencyMs,
  extraAprendidoMs,
  outputLatencyMs,
} from '@/lib/daw/latency';
import * as store from '@/lib/daw/storage';
import { esCuotaLlena } from '@/lib/pwa/espacio';
import {
  DEFAULT_SETTINGS,
  newId,
  projectDuration,
  type PeakData,
  type Project,
  type StudioSettings,
  type Track,
  type TransportState,
} from '@/lib/daw/types';

export type MicStatus = 'idle' | 'requesting' | 'ready' | 'denied' | 'error';

/** Lo que la app ha oído en la última toma. */
export interface Oido {
  trackId: string;
  bpm: number | null;
  tonalidad: KeyResult | null;
}

function createProject(name = 'Idea nueva'): Project {
  const now = Date.now();
  return { id: newId('prj'), name, bpm: 100, tracks: [], createdAt: now, updatedAt: now };
}

export function useStudio() {
  const engineRef = useRef<StudioEngine | null>(null);
  if (!engineRef.current && typeof window !== 'undefined') {
    engineRef.current = new StudioEngine();
  }
  const engine = engineRef.current;

  const [project, setProjectState] = useState<Project>(() => createProject());
  const [settings, setSettingsState] = useState<StudioSettings>(DEFAULT_SETTINGS);
  const [transport, setTransport] = useState<TransportState>('stopped');
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [micStatus, setMicStatus] = useState<MicStatus>('idle');
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [peaksVersion, setPeaksVersion] = useState(0);
  const [lastTakePeak, setLastTakePeak] = useState<number | null>(null);
  const [grooveId, setGrooveId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [oido, setOido] = useState<Oido | null>(null);

  const peaksRef = useRef(new Map<string, PeakData>());
  const levelRef = useRef(0);
  const projectRef = useRef(project);
  const settingsRef = useRef(settings);
  const historyRef = useRef<Project[]>([]);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const saveTimerRef = useRef<number | null>(null);

  projectRef.current = project;
  settingsRef.current = settings;

  /* ---------------------------------------------------------------- */
  /* Guardado                                                          */
  /* ---------------------------------------------------------------- */

  const queueSave = useCallback((next: Project) => {
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      void store.saveProject(next);
      store.rememberLastProject(next.id);
    }, 600);
  }, []);

  /** Guardar YA, sin pasar por el temporizador. */
  const saveNow = useCallback(async (next: Project) => {
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    await store.saveProject(next);
    store.rememberLastProject(next.id);
  }, []);

  /**
   * El móvil puede llevarse la app en cualquier momento: entra una llamada,
   * te vas a WhatsApp, o Safari recicla la pestaña para recuperar memoria. Si
   * justo entonces hay medio segundo de trabajo esperando al temporizador, se
   * pierde — y perder una toma es lo único que este producto no se puede
   * permitir. Al ocultarse la página se escribe sin esperar a nadie.
   */
  useEffect(() => {
    const volcar = () => {
      if (!saveTimerRef.current) return;
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
      void store.saveProject(projectRef.current);
      store.rememberLastProject(projectRef.current.id);
    };
    const alOcultarse = () => {
      if (document.visibilityState === 'hidden') volcar();
    };
    document.addEventListener('visibilitychange', alOcultarse);
    window.addEventListener('pagehide', volcar);
    return () => {
      document.removeEventListener('visibilitychange', alOcultarse);
      window.removeEventListener('pagehide', volcar);
    };
  }, []);

  /**
   * El proyecto vive en `projectRef` además de en el estado. Grabar justo
   * después de tocar un ajuste tiene que usar el valor nuevo, y React no
   * garantiza que el estado esté aplicado en ese momento: el ref sí.
   */
  /* Mezcla (pilar A): un arrastre es un solo paso de Deshacer. Los cambios
     con el mismo `grupo` (el fader de una pista, el envío de reverb de
     otra…) que llegan seguidos, con menos de un segundo entre uno y otro,
     comparten la entrada del historial que abrió el primero. */
  const grupoRef = useRef<{ clave: string; hora: number } | null>(null);

  const commit = useCallback(
    (updater: (current: Project) => Project, options: { history?: boolean; grupo?: string } = {}) => {
      const current = projectRef.current;
      const ahora = Date.now();
      const anterior = grupoRef.current;
      const mismoGesto = !!options.grupo && anterior?.clave === options.grupo && ahora - anterior.hora < 1000;
      grupoRef.current = options.grupo ? { clave: options.grupo, hora: ahora } : null;
      if (options.history !== false && !mismoGesto) {
        historyRef.current = [...historyRef.current.slice(-29), current];
      }
      const next = { ...updater(current), updatedAt: Date.now() };
      projectRef.current = next;
      queueSave(next);
      setProjectState(next);
    },
    [queueSave],
  );

  const undo = useCallback(() => {
    const previous = historyRef.current.pop();
    if (!previous) {
      setStatus('No hay nada que deshacer');
      return;
    }
    grupoRef.current = null;
    projectRef.current = previous;
    setProjectState(previous);
    queueSave(previous);
    setStatus('Deshecho');
  }, [queueSave]);

  /* ---------------------------------------------------------------- */
  /* Carga inicial                                                     */
  /* ---------------------------------------------------------------- */

  const loadProjectAudio = useCallback(
    async (target: Project) => {
      if (!engine) return;
      await engine.ensureContext();
      for (const track of target.tracks) {
        if (engine.hasBuffer(track.clip.bufferId)) continue;
        const audio = await store.getAudio(track.clip.bufferId);
        if (!audio) continue;
        engine.putBuffer(
          track.clip.bufferId,
          engine.createBufferFromSamples(audio.channels, audio.sampleRate),
        );
        peaksRef.current.set(
          track.clip.bufferId,
          computePeaks(audio.channels[0], audio.sampleRate),
        );
      }
      setPeaksVersion((version) => version + 1);
    },
    [engine],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const saved = store.loadSettings();
      settingsRef.current = saved;
      setSettingsState(saved);
      const lastId = store.recallLastProject();
      let loaded: Project | null = lastId ? await store.loadProject(lastId) : null;
      if (!loaded) {
        const all = await store.listProjects();
        loaded = all[0] ?? null;
      }
      if (cancelled) return;
      if (loaded) {
        projectRef.current = loaded;
        setProjectState(loaded);
      }
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /* ---------------------------------------------------------------- */
  /* Ajustes                                                           */
  /* ---------------------------------------------------------------- */

  // Antes que el motor: cerrar una toma también afina la latencia.
  // La salida de audio elegida (la interfaz con cascos, por ejemplo) se aplica al motor.
  useEffect(() => {
    if (engine) void engine.setSalida(settings.outputDeviceId ?? null);
  }, [engine, settings.outputDeviceId]);

  const updateSettings = useCallback((patch: Partial<StudioSettings>) => {
    const next = { ...settingsRef.current, ...patch };
    settingsRef.current = next;
    store.saveSettings(next);
    setSettingsState(next);
  }, []);

  /* ---------------------------------------------------------------- */
  /* Motor                                                             */
  /* ---------------------------------------------------------------- */

  const handleTake = useCallback(
    async (take: RecordingTake) => {
      if (!engine) return;
      // Lo primero: ¿ha entrado señal? Una toma muda con el micro "concedido"
      // es el fallo más difícil de diagnosticar a ciegas, así que se avisa.
      let peak = 0;
      for (let i = 0; i < take.samples.length; i++) {
        const abs = Math.abs(take.samples[i]);
        if (abs > peak) peak = abs;
      }
      setLastTakePeak(peak);
      if (peak < 0.002) {
        setStatus('La toma ha entrado en silencio. Revisa el permiso del micro.');
      }

      const bufferId = newId('buf');
      const buffer = engine.createBufferFromSamples([take.samples], take.sampleRate);
      engine.putBuffer(bufferId, buffer);
      peaksRef.current.set(bufferId, computePeaks(take.samples, take.sampleRate));
      setPeaksVersion((version) => version + 1);

      /* El audio se escribe ANTES de anunciar la pista, y esperando de verdad.
         Con `void` había una ventana en la que la pista ya existía en el
         proyecto pero su audio todavía no estaba en disco: si la app moría ahí
         —una llamada entrante basta— quedaba una pista apuntando a un buffer
         inexistente, y el recolector de basura acababa borrándolo. Nuestra
         propia limpieza destruía la toma. */
      let sinGuardar = false;
      try {
        await store.putAudio(bufferId, [take.samples], take.sampleRate);
        void store.pedirPersistencia();
      } catch (error) {
        sinGuardar = true;
        // PWA: si es falta de sitio se dice tal cual, con la salida.
        setStatus(
          esCuotaLlena(error)
            ? 'El móvil está lleno: esta toma no se ha guardado. Exporta y borra ideas viejas en Ajustes.'
            : 'No he podido guardar la toma en este móvil. Puede que no quede espacio.',
        );
      }

      // Aquí es donde se corrige el desfase: la toma se adelanta exactamente
      // la latencia de ida y vuelta medida, que es lo que tardó en dar la
      // vuelta por los altavoces y volver por el micro.
      let colocada = take.startPosition - take.latencySeconds;

      /* Y aquí, lo que esa cifra no sabía. A ciegas (sin calibrar, y en el PC
         casi siempre) se queda corta y cada toma salía un poco tarde. Si
         sonaba algo mientras grababas, tus golpes dicen cuánto: se mide contra
         la claqueta o el ritmo, o contra las pistas que sonaban si no había
         claqueta, y la toma se adelanta eso antes de entrar en el proyecto.
         Es el mismo commit que la añade, así que deshacer la quita entera.
         Lo que falle aquí no puede llevarse la toma por delante. */
      let correccion: Correccion | null = null;
      if (peak >= 0.002) {
        try {
          const desde = take.startPosition;
          const hasta = desde + buffer.duration;
          const referencia = pistasQueSonaban(projectRef.current.tracks, desde, hasta).flatMap(
            (pista) => {
              const audio = engine.getBuffer(pista.clip.bufferId);
              if (!audio) return [];
              return golpesDePista(
                audio.getChannelData(0),
                audio.sampleRate,
                pista.clip,
                desde - 0.3,
                hasta + 0.3,
              );
            },
          );
          const rejilla = settingsRef.current.metronome || engine.currentGroove !== null;
          if (rejilla || referencia.length > 0) {
            const medida = medirToma(take.samples, take.sampleRate, {
              inicio: colocada,
              bpm: projectRef.current.bpm,
              rejilla,
              referencia,
            });
            correccion = decidirCorreccion(medida, extraAprendidoMs(settingsRef.current));
          }
        } catch {
          correccion = null;
        }
      }
      if (correccion) colocada -= correccion.adelanto;

      let start = colocada;
      let offset = 0;
      if (start < 0) {
        offset = -start;
        start = 0;
      }
      const duration = Math.max(0.08, buffer.duration - offset);

      const track: Track = {
        id: newId('trk'),
        name: `Pista ${projectRef.current.tracks.length + 1}`,
        clip: { bufferId, start, offset, duration, repeats: 1 },
        volume: 1,
        muted: false,
        soloed: false,
        sourceDuration: buffer.duration,
        createdAt: Date.now(),
      };

      commit((current) => ({ ...current, tracks: [...current.tracks, track] }));
      setSelectedTrackId(track.id);
      // Y el proyecto, a disco ya. Un cierre inesperado en los 600 ms del
      // temporizador se llevaría por delante la pista recién grabada.
      void saveNow(projectRef.current);

      /* Lo aprendido, para la siguiente: la compensación se mueve un 70 % de
         lo medido, así llega en dos o tres tomas sin pasarse por una mal
         tocada. Una toma que ya cae a tiempo también cuenta: confirma la
         cifra. */
      if (correccion) {
        const ctx = engine.ctx;
        updateSettings(
          aprenderLatencia(settingsRef.current, {
            aplicadaMs: take.latencySeconds * 1000,
            aprendizajeMs: correccion.aprendizajeMs,
            salidaMs: ctx ? outputLatencyMs(ctx) : null,
          }),
        );
        const ms = Math.round(correccion.adelanto * 1000);
        if (ms !== 0 && !sinGuardar) {
          setStatus(
            ms > 0
              ? `Toma adelantada ${ms} ms para que caiga a tiempo`
              : `Toma retrasada ${-ms} ms para que caiga a tiempo`,
          );
        }
      }

      /* El oído, al soltar el botón. Tempo y tonalidad de lo que acabas de
         tocar salen en milisegundos y en local: no hay nada que esperar y
         nada que pedirle a la red. */
      if (peak >= 0.002) {
        const datos = buffer.getChannelData(0).slice(Math.floor(offset * buffer.sampleRate));
        const tempo = detectarTempo(datos, buffer.sampleRate);
        const tono = detectarTonalidad(datos, buffer.sampleRate);
        setOido({
          trackId: track.id,
          bpm: tempo.confianza >= 0.25 ? Math.round(tempo.bpm) : null,
          tonalidad: tono && tono.confianza >= 0.2 ? tono : null,
        });
      } else {
        setOido(null);
      }

      /* Y suena sola. Este es el momento entero del producto: la segunda capa
         encajando con la primera es lo que justifica toda la ingeniería de
         compensación de latencia, y hasta ahora había que ir a buscarlo con
         dos toques. El retardo deja que iOS suelte el micro primero — con la
         sesión en `play-and-record` el altavoz sale bajísimo. */
      window.setTimeout(() => {
        if (!engine || engine.transportState !== 'stopped') return;
        // PWA: si la toma se cortó al salir de la app, no suena sola al volver.
        if (document.visibilityState === 'hidden') return;
        void engine.playReview(projectRef.current, settingsRef.current, start);
      }, 320);
    },
    [commit, engine, saveNow, updateSettings],
  );

  useEffect(() => {
    if (!engine) return;
    engine.onStateChange = (state) => {
      setTransport(state);
      if (state === 'stopped' && settingsRef.current.releaseMicOnStop) {
        engine.releaseInput();
        levelRef.current = 0;
      }
    };
    engine.onLevel = (level) => {
      levelRef.current = level;
    };
    engine.onTakeReady = (take) => {
      void handleTake(take);
    };
    return () => {
      engine.onStateChange = null;
      engine.onLevel = null;
      engine.onTakeReady = null;
    };
  }, [engine, handleTake]);

  /* Si cambia QUÉ suena mientras suena (una pista nueva del músico o del
     productor, un clip movido o recortado), el motor lo vuelve a programar
     sin parar. Volumen, mute y solo no cuentan: esos ya se aplican en
     caliente y re-programar en cada movimiento del fader daría saltos. */
  const loQueSuena = useMemo(
    () =>
      project.tracks
        .map((t) => `${t.id}:${t.clip.bufferId}:${t.clip.start}:${t.clip.offset}:${t.clip.duration}:${t.clip.repeats}`)
        .join('|'),
    [project.tracks],
  );
  const transportRef = useRef(transport);
  transportRef.current = transport;
  useEffect(() => {
    if (transportRef.current === 'playing') engineRef.current?.resync(projectRef.current);
  }, [loQueSuena]);

  useEffect(() => {
    return () => {
      engineRef.current?.dispose();
      engineRef.current = null;
    };
  }, []);

  /* ---------------------------------------------------------------- */
  /* Pantalla despierta mientras se toca                               */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    const active = transport !== 'stopped';
    const nav = navigator as Navigator & { wakeLock?: WakeLock };
    if (active && nav.wakeLock && !wakeLockRef.current) {
      nav.wakeLock
        .request('screen')
        .then((sentinel) => {
          wakeLockRef.current = sentinel;
        })
        .catch(() => {
          /* el navegador puede negarlo, no es crítico */
        });
    }
    if (!active && wakeLockRef.current) {
      void wakeLockRef.current.release();
      wakeLockRef.current = null;
    }
    /* PWA: el sistema suelta el bloqueo al ocultarse la página y no lo
       devuelve solo. Si vuelves con algo sonando, se pide otra vez. */
    if (!active || !nav.wakeLock) return;
    const alVolver = () => {
      if (document.visibilityState !== 'visible') return;
      if (wakeLockRef.current && !wakeLockRef.current.released) return;
      nav.wakeLock
        ?.request('screen')
        .then((sentinel) => {
          wakeLockRef.current = sentinel;
        })
        .catch(() => undefined);
    };
    document.addEventListener('visibilitychange', alVolver);
    return () => document.removeEventListener('visibilitychange', alVolver);
  }, [transport]);

  /* ---------------------------------------------------------------- */
  /* Micro                                                             */
  /* ---------------------------------------------------------------- */

  const ensureMic = useCallback(async (): Promise<boolean> => {
    if (!engine) return false;
    if (engine.isInputReady) return true;
    setMicStatus('requesting');
    try {
      await engine.armInput({
        deviceId: settingsRef.current.inputDeviceId,
        echoCancellation: settingsRef.current.echoCancellation,
        canal: settingsRef.current.canalEntrada ?? 'juntas',
      });
      setMicStatus('ready');
      // Si nunca se ha calibrado, al menos partimos de la estimación que da
      // el navegador en vez de asumir cero.
      if (!settingsRef.current.calibrated && settingsRef.current.latencyMs === 0) {
        const ctx = await engine.ensureContext();
        updateSettings({ latencyMs: estimateLatencyMs(ctx, engine.inputStream) });
      }
      return true;
    } catch (error) {
      const name = (error as DOMException)?.name;
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        setMicStatus('denied');
        setStatus('Sin permiso de micrófono. Actívalo en los ajustes del navegador.');
      } else {
        setMicStatus('error');
        setStatus('No he podido abrir el micrófono.');
      }
      return false;
    }
  }, [engine, updateSettings]);

  const reopenMic = useCallback(
    async (patch: Partial<StudioSettings>) => {
      updateSettings(patch);
      if (!engine || !engine.isInputReady) return;
      try {
        await engine.reopenInput({
          deviceId: patch.inputDeviceId ?? settingsRef.current.inputDeviceId,
          echoCancellation: patch.echoCancellation ?? settingsRef.current.echoCancellation,
          canal: patch.canalEntrada ?? settingsRef.current.canalEntrada ?? 'juntas',
        });
        setMicStatus('ready');
      } catch {
        setMicStatus('error');
        setStatus('No he podido cambiar la entrada.');
      }
    },
    [engine, updateSettings],
  );

  /* ---------------------------------------------------------------- */
  /* Transporte                                                        */
  /* ---------------------------------------------------------------- */

  // En el móvil se toca dos veces sin querer constantemente. Mientras una
  // acción de transporte está en curso, las demás se ignoran.
  const lockRef = useRef(false);
  const withLock = useCallback(async (action: () => Promise<void>) => {
    if (lockRef.current) return;
    lockRef.current = true;
    try {
      await action();
    } catch (error) {
      // iOS dejó el audio sin arrancar: se avisa y el siguiente toque lo rehace.
      if (error instanceof AudioBloqueado) setStatus(error.message);
      else throw error;
    } finally {
      lockRef.current = false;
    }
  }, []);

  const stop = useCallback(async () => {
    if (!engine) return;
    await withLock(() => engine.stop());
  }, [engine, withLock]);

  const play = useCallback(async () => {
    if (!engine) return;
    await withLock(async () => {
      if (engine.transportState !== 'stopped') {
        await engine.stop();
        return;
      }
      if (projectRef.current.tracks.length === 0) {
        setStatus('Todavía no hay nada que reproducir');
        return;
      }
      await engine.play(projectRef.current, settingsRef.current);
    });
  }, [engine, withLock]);

  const record = useCallback(async () => {
    if (!engine) return;
    await withLock(async () => {
      if (engine.transportState !== 'stopped') {
        await engine.stop();
        return;
      }
      const ok = await ensureMic();
      if (!ok) return;
      await engine.record(projectRef.current, settingsRef.current);
    });
  }, [engine, ensureMic, withLock]);

  const seek = useCallback(
    (position: number) => {
      if (!engine) return;
      const state = engine.transportState;
      // Buscando en mitad de una toma se perdería la grabación: se ignora.
      if (state === 'recording' || state === 'countin') return;
      if (state === 'playing') {
        // Reprogramamos desde el punto nuevo, si no el cursor y el sonido se
        // separan (el audio ya estaba encolado desde el punto anterior).
        void withLock(async () => {
          await engine.stop();
          engine.seek(position);
          await engine.play(projectRef.current, settingsRef.current, position);
        });
        return;
      }
      engine.seek(position);
    },
    [engine, withLock],
  );

  const rewind = useCallback(() => seek(0), [seek]);

  /* ---------------------------------------------------------------- */
  /* Pistas                                                            */
  /* ---------------------------------------------------------------- */

  const updateTrack = useCallback(
    (trackId: string, patch: Partial<Track>, options?: { history?: boolean; grupo?: string }) => {
      commit(
        (current) => ({
          ...current,
          tracks: current.tracks.map((track) =>
            track.id === trackId ? { ...track, ...patch } : track,
          ),
        }),
        options,
      );
    },
    [commit],
  );

  const updateClip = useCallback(
    (trackId: string, patch: Partial<Track['clip']>, options?: { history?: boolean }) => {
      commit(
        (current) => ({
          ...current,
          tracks: current.tracks.map((track) =>
            track.id === trackId ? { ...track, clip: { ...track.clip, ...patch } } : track,
          ),
        }),
        options,
      );
    },
    [commit],
  );

  const setVolume = useCallback(
    (trackId: string, volume: number) => {
      const track = projectRef.current.tracks.find((item) => item.id === trackId);
      const haySolo = projectRef.current.tracks.some((item) => item.soloed);
      const suena = !!track && (haySolo ? track.soloed : !track.muted);
      engine?.setTrackVolume(trackId, volume, suena);
      // Antes el volumen no entraba en el historial; ahora sí, y un arrastre
      // entero cuenta como un solo paso.
      updateTrack(trackId, { volume }, { grupo: `volumen:${trackId}` });
    },
    [engine, updateTrack],
  );

  const toggleMute = useCallback(
    (trackId: string) => {
      commit((current) => {
        const next = {
          ...current,
          tracks: current.tracks.map((track) =>
            track.id === trackId ? { ...track, muted: !track.muted } : track,
          ),
        };
        engine?.refreshMutes(next);
        return next;
      });
    },
    [commit, engine],
  );

  const toggleSolo = useCallback(
    (trackId: string) => {
      commit((current) => {
        const next = {
          ...current,
          tracks: current.tracks.map((track) =>
            track.id === trackId ? { ...track, soloed: !track.soloed } : track,
          ),
        };
        engine?.refreshMutes(next);
        return next;
      });
    },
    [commit, engine],
  );

  const deleteTrack = useCallback(
    (trackId: string) => {
      commit((current) => ({
        ...current,
        tracks: current.tracks.filter((track) => track.id !== trackId),
      }));
      setSelectedTrackId((current) => (current === trackId ? null : current));
      setStatus('Pista borrada. Puedes deshacer.');
    },
    [commit],
  );

  const duplicateTrack = useCallback(
    (trackId: string) => {
      commit((current) => {
        const source = current.tracks.find((track) => track.id === trackId);
        if (!source) return current;
        const copy: Track = {
          ...source,
          id: newId('trk'),
          name: `${source.name} copia`,
          clip: { ...source.clip },
          soloed: false,
          createdAt: Date.now(),
        };
        const index = current.tracks.findIndex((track) => track.id === trackId);
        const tracks = [...current.tracks];
        tracks.splice(index + 1, 0, copy);
        return { ...current, tracks };
      });
    },
    [commit],
  );

  /**
   * Añadir una pista desde un fichero del móvil: una base descargada, un bolo
   * grabado con otra cosa, una nota de voz. Cae en el cursor, como una toma
   * más, y a partir de ahí se mueve y se recorta igual que las demás.
   */
  const importFile = useCallback(
    async (file: File) => {
      if (!engine) return;
      setBusy('Metiendo el audio…');
      try {
        const buffer = await engine.decodeFile(file);
        const channels: Float32Array[] = [];
        for (let c = 0; c < Math.min(2, buffer.numberOfChannels); c++) {
          channels.push(new Float32Array(buffer.getChannelData(c)));
        }
        const bufferId = newId('buf');
        engine.putBuffer(bufferId, engine.createBufferFromSamples(channels, buffer.sampleRate));
        peaksRef.current.set(bufferId, computePeaks(channels[0], buffer.sampleRate));
        setPeaksVersion((version) => version + 1);
        void store.putAudio(bufferId, channels, buffer.sampleRate);

        const name = file.name.replace(/\.[^.]+$/, '').slice(0, 40) || 'Pista importada';
        const start = engine.position;
        const track: Track = {
          id: newId('trk'),
          name,
          clip: { bufferId, start, offset: 0, duration: buffer.duration, repeats: 1 },
          volume: 1,
          muted: false,
          soloed: false,
          sourceDuration: buffer.duration,
          createdAt: Date.now(),
        };
        commit((current) => ({ ...current, tracks: [...current.tracks, track] }));
        setSelectedTrackId(track.id);
        setStatus(`${name} · ${buffer.duration.toFixed(1)} s`);
      } catch {
        setStatus('No he podido leer ese audio. Prueba con un m4a, mp3 o wav.');
      } finally {
        setBusy(null);
      }
    },
    [commit, engine],
  );

  /**
   * Saca el tempo de una toma. Va en local y tarda milisegundos: tiene que
   * estar listo en cuanto sueltas el botón de parar.
   */
  const analizarTempo = useCallback(
    (trackId: string): TempoResult | null => {
      if (!engine) return null;
      const track = projectRef.current.tracks.find((item) => item.id === trackId);
      if (!track) return null;
      const buffer = engine.getBuffer(track.clip.bufferId);
      if (!buffer) return null;
      // Solo el trozo que de verdad suena, no el buffer entero.
      const sr = buffer.sampleRate;
      const desde = Math.floor(track.clip.offset * sr);
      const hasta = Math.min(buffer.length, Math.floor((track.clip.offset + track.clip.duration) * sr));
      const datos = buffer.getChannelData(0).slice(desde, hasta);
      return detectarTempo(datos, sr);
    },
    [engine],
  );

  /* ---------------------------------------------------------------- */
  /* Ritmo                                                             */
  /* ---------------------------------------------------------------- */

  const setGroove = useCallback(
    (groove: Groove | null, opciones?: Partial<GrooveOptions>) => {
      if (!engine) return;
      setGrooveId(groove?.id ?? null);
      if (!groove) {
        engine.setGroove(null);
        return;
      }
      // Si el transporte está parado, se escucha suelto; si está sonando, el
      // motor lo engancha a la posición actual.
      if (engine.transportState === 'stopped') void engine.previewGroove(groove, opciones);
      else engine.setGroove(groove, opciones);
    },
    [engine],
  );

  /**
   * Convierte el ritmo en una pista de audio normal. A partir de aquí deja de
   * ser un acompañamiento efímero y pasa a formar parte de la idea: se mueve,
   * se recorta, se exporta.
   */
  const printGroove = useCallback(
    async (groove: Groove, vueltas: number, opciones?: Partial<GrooveOptions>) => {
      if (!engine) return;
      setBusy('Pasando el ritmo a pista…');
      try {
        const opts = { ...engine.grooveOptions, ...opciones };
        const buffer = await renderGroove(
          groove,
          projectRef.current.bpm,
          opts,
          vueltas,
          engine.contextSampleRate,
        );
        const samples = new Float32Array(buffer.getChannelData(0));
        const bufferId = newId('buf');
        engine.putBuffer(bufferId, engine.createBufferFromSamples([samples], buffer.sampleRate));
        peaksRef.current.set(bufferId, computePeaks(samples, buffer.sampleRate));
        setPeaksVersion((version) => version + 1);
        void store.putAudio(bufferId, [samples], buffer.sampleRate);

        const track: Track = {
          id: newId('trk'),
          name: groove.nombre,
          clip: {
            bufferId,
            start: engine.position,
            offset: 0,
            duration: buffer.duration,
            repeats: 1,
          },
          volume: 0.9,
          muted: false,
          soloed: false,
          sourceDuration: buffer.duration,
          createdAt: Date.now(),
          // El ritmo lo toca la máquina: ámbar, como el músico de sesión.
          ia: true,
        };
        commit((current) => ({ ...current, tracks: [...current.tracks, track] }));
        setSelectedTrackId(track.id);
        setStatus(`${groove.nombre} · ${vueltas} vueltas en una pista`);
      } catch {
        setStatus('No he podido pasar el ritmo a pista');
      } finally {
        setBusy(null);
      }
    },
    [commit, engine],
  );

  /**
   * Mete en el proyecto una pista hecha por la máquina (el músico de sesión).
   * Entra en el mismo sitio y con las mismas repeticiones que la toma a la
   * que acompaña, guardada en disco como cualquier otra: si se cierra la app
   * a media canción, el bajo sigue ahí.
   */
  const addGeneratedTrack = useCallback(
    (pista: {
      name: string;
      samples: Float32Array;
      sampleRate: number;
      start: number;
      repeats: number;
      volume?: number;
    }): Track | null => {
      if (!engine) return null;
      const bufferId = newId('buf');
      engine.putBuffer(bufferId, engine.createBufferFromSamples([pista.samples], pista.sampleRate));
      peaksRef.current.set(bufferId, computePeaks(pista.samples, pista.sampleRate));
      setPeaksVersion((version) => version + 1);
      void store.putAudio(bufferId, [pista.samples], pista.sampleRate);

      const duration = pista.samples.length / pista.sampleRate;
      const track: Track = {
        id: newId('trk'),
        name: pista.name,
        clip: { bufferId, start: pista.start, offset: 0, duration, repeats: pista.repeats },
        volume: pista.volume ?? 0.85,
        muted: false,
        soloed: false,
        sourceDuration: duration,
        createdAt: Date.now(),
        ia: true,
      };
      commit((current) => ({ ...current, tracks: [...current.tracks, track] }));
      setSelectedTrackId(track.id);
      return track;
    },
    [commit, engine],
  );

  /* ---------------------------------------------------------------- */
  /* Proyectos                                                         */
  /* ---------------------------------------------------------------- */

  const newProject = useCallback(async () => {
    await engine?.stop();
    const next = createProject();
    historyRef.current = [];
    projectRef.current = next;
    setProjectState(next);
    setSelectedTrackId(null);
    await store.saveProject(next);
    store.rememberLastProject(next.id);
  }, [engine]);

  const openProject = useCallback(
    async (id: string) => {
      await engine?.stop();
      const loaded = await store.loadProject(id);
      if (!loaded) return;
      historyRef.current = [];
      projectRef.current = loaded;
      setProjectState(loaded);
      setSelectedTrackId(null);
      store.rememberLastProject(loaded.id);
      await loadProjectAudio(loaded);
    },
    [engine, loadProjectAudio],
  );

  const removeProject = useCallback(
    async (target: Project) => {
      await store.deleteProject(target);
      if (target.id === projectRef.current.id) {
        const remaining = await store.listProjects();
        if (remaining[0]) await openProject(remaining[0].id);
        else await newProject();
      }
    },
    [newProject, openProject],
  );

  const renameProject = useCallback(
    (name: string) => commit((current) => ({ ...current, name }), { history: false }),
    [commit],
  );

  const setBpm = useCallback(
    (bpm: number) => {
      // Al motor primero: así el click cambia de tempo al pulso siguiente
      // aunque estés en mitad de una toma.
      engine?.setTempo(bpm);
      commit((current) => ({ ...current, bpm }), { history: false });
    },
    [commit, engine],
  );

  const toggleMetronome = useCallback(() => {
    const next = !settingsRef.current.metronome;
    engine?.setMetronomeEnabled(next);
    updateSettings({ metronome: next });
  }, [engine, updateSettings]);

  /* ---------------------------------------------------------------- */
  /* Calibración                                                       */
  /* ---------------------------------------------------------------- */

  const runCalibration = useCallback(async () => {
    if (!engine) return null;
    const ok = await ensureMic();
    if (!ok) return null;
    const ctx = await engine.ensureContext();
    const recorder = engine.rawRecorder;
    if (!recorder) return null;

    setBusy('Midiendo latencia. No muevas el móvil.');
    try {
      const result = await calibrateLatency(ctx, recorder);
      if (result.ok) {
        // Una medición nueva manda: lo que enseñaron las tomas empieza de cero.
        updateSettings({
          latencyMs: result.latencyMs,
          calibrated: true,
          calibratedOutputLatencyMs: outputLatencyMs(ctx),
          latenciaAprendida: null,
        });
      }
      setStatus(result.message);
      return result;
    } finally {
      setBusy(null);
    }
  }, [engine, ensureMic, updateSettings]);

  /* ---------------------------------------------------------------- */
  /* Derivados                                                         */
  /* ---------------------------------------------------------------- */

  const duration = useMemo(() => projectDuration(project), [project]);
  const selectedTrack = useMemo(
    () => project.tracks.find((track) => track.id === selectedTrackId) ?? null,
    [project.tracks, selectedTrackId],
  );
  const currentLatencyMs = useMemo(
    () => effectiveLatencyMs(settings, engine?.ctx ?? null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [settings, engine?.ctx, transport],
  );
  /** De dónde sale la compensación: para que el transporte diga «ajustada con tus tomas» o «sin calibrar». */
  const latencia = useMemo(
    () => estadoLatencia(settings, engine?.ctx ?? null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [settings, engine?.ctx, transport],
  );

  /**
   * Meter un audio hecho en el móvil (una toma cuadrada al tempo) en el
   * motor, con sus picos para que la onda se dibuje. No lo guarda en disco:
   * eso lo hace quien lo crea, esperando a que acabe.
   */
  const ponerAudio = useCallback(
    (bufferId: string, channels: Float32Array[], sampleRate: number) => {
      if (!engine) return;
      engine.putBuffer(bufferId, engine.createBufferFromSamples(channels, sampleRate));
      peaksRef.current.set(bufferId, computePeaks(channels[0], sampleRate));
      setPeaksVersion((version) => version + 1);
    },
    [engine],
  );

  const getPeaks = useCallback(
    (bufferId: string) => peaksRef.current.get(bufferId) ?? null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [peaksVersion],
  );

  const diagnostics = useCallback(() => {
    const ctx = engine?.ctx ?? null;
    return {
      contexto: ctx ? ctx.state : 'sin crear',
      frecuencia: ctx ? Math.round(ctx.sampleRate) : 0,
      salidaMs: ctx ? Math.round((outputLatencyMs(ctx) ?? 0)) : 0,
      sesion: getAudioSession() ?? 'no soportada',
      micro: micStatus,
      pistas: projectRef.current.tracks.length,
      picoUltimaToma: lastTakePeak,
    };
  }, [engine, micStatus, lastTakePeak]);

  return {
    engine,
    ready,
    diagnostics,
    lastTakePeak,
    project,
    settings,
    transport,
    duration,
    status,
    busy,
    micStatus,
    levelRef,
    selectedTrack,
    selectedTrackId,
    currentLatencyMs,
    latencia,
    peaksVersion,
    oido,
    setOido,
    setStatus,
    setSelectedTrackId,
    getPeaks,
    // transporte
    play,
    stop,
    record,
    seek,
    rewind,
    // pistas
    updateTrack,
    updateClip,
    setVolume,
    toggleMute,
    toggleSolo,
    deleteTrack,
    duplicateTrack,
    importFile,
    analizarTempo,
    grooveId,
    setGroove,
    printGroove,
    addGeneratedTrack,
    undo,
    /** Cambiar el proyecto con historial (y `grupo` para juntar un arrastre). Lo usan el mezclador y el productor. */
    commit,
    /** Un audio nuevo al motor, con su onda (cuadrar al tempo). */
    ponerAudio,
    // proyecto
    newProject,
    openProject,
    removeProject,
    renameProject,
    setBpm,
    toggleMetronome,
    loadProjectAudio,
    // ajustes / micro
    updateSettings,
    reopenMic,
    ensureMic,
    runCalibration,
  };
}

export type Studio = ReturnType<typeof useStudio>;
