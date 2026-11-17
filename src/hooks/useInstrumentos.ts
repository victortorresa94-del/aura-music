'use client';

/**
 * Pilar B: lo que une los instrumentos de la pantalla con el estudio.
 *
 * - Un atril (`lib/instrumentos/directo.ts`) enchufado al contexto del motor.
 * - Grabar lo que tocas con claqueta y cuenta atrás, sin micro.
 * - Convertir una toma (o lo último que tocaste sin grabar) en pistas de notas.
 * - Rehacer el audio de una pista de notas cuando cambian sus ajustes, su
 *   sonido o el tempo del proyecto.
 *
 * Del estudio solo usa lo que ya expone (`engine`, `addGeneratedTrack`,
 * `updateTrack`, `updateClip`): no hace falta tocar `useStudio`.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Studio } from '@/hooks/useStudio';
import * as store from '@/lib/daw/storage';
import { newId, type Track } from '@/lib/daw/types';
import { Atril } from '@/lib/instrumentos/directo';
import {
  colocarEnRejilla,
  porInstrumento,
  recuperarFrase,
  type EventoTocado,
} from '@/lib/instrumentos/grabacion';
import { getInstrumento } from '@/lib/instrumentos/registro';
import { renderizarNotas } from '@/lib/instrumentos/render';
import { AJUSTES_SIN_TOCAR, type InstrumentoId, type PistaDeNotas } from '@/lib/instrumentos/tipos';
import { leerToqueMs } from '@/lib/instrumentos/toque';
import { procesarGolpes } from '@/lib/musico/groove';

export type EstadoTocar = 'libre' | 'claqueta' | 'grabando';

/** Lo último pedido para cada pista: si llega un audio viejo, se descarta. */
const versiones = new Map<string, number>();

/**
 * Rehace el audio de una pista de notas con otros ajustes, otro instrumento
 * u otro tempo. No borra nada: el audio anterior sigue guardado, así que
 * Deshacer vuelve a él al instante.
 */
export async function rehacerPistaDeNotas(
  studio: Studio,
  trackId: string,
  cambios: Partial<Pick<PistaDeNotas, 'ajustes' | 'instrumento'>> & { bpm?: number },
  o: { historial?: boolean; aviso?: string } = {},
): Promise<boolean> {
  const { engine, project } = studio;
  const track = project.tracks.find((t) => t.id === trackId);
  if (!engine || !track?.notas) return false;
  const version = (versiones.get(trackId) ?? 0) + 1;
  versiones.set(trackId, version);

  const bpm = cambios.bpm ?? project.bpm;
  const notas: PistaDeNotas = { ...track.notas, ...cambios, bpm };
  // Con otro tempo, el clip se queda en el mismo pulso: se escala en segundos.
  const escala = track.notas.bpm / bpm;
  const clip = escala !== 1
    ? { ...track.clip, start: track.clip.start * escala, offset: track.clip.offset * escala, duration: track.clip.duration * escala }
    : track.clip;
  const pulso = 60 / bpm;
  const golpes = procesarGolpes(notas.bruto, notas.ajustes, { bpm, inicioBeat: clip.start / pulso });

  try {
    const render = await renderizarNotas({
      golpes,
      instrumento: notas.instrumento,
      bpm,
      sampleRate: engine.contextSampleRate,
      decodificador: engine.ctx,
    });
    if (versiones.get(trackId) !== version) return false;
    // Que el audio llegue al menos hasta donde acaba el clip.
    const minimo = Math.ceil((clip.offset + clip.duration) * render.sampleRate);
    const samples = render.samples.length >= minimo ? render.samples : alargar(render.samples, minimo);
    const bufferId = newId('buf');
    engine.putBuffer(bufferId, engine.createBufferFromSamples([samples], render.sampleRate));
    await store.putAudio(bufferId, [samples], render.sampleRate);
    if (versiones.get(trackId) !== version) return false;

    // Primero las notas (con historial: la foto de antes queda entera para
    // deshacer), luego el clip sin historial.
    studio.updateTrack(
      trackId,
      { notas: { ...notas, golpes, sonido: render.sonido }, sourceDuration: samples.length / render.sampleRate },
      { history: o.historial !== false },
    );
    studio.updateClip(trackId, { bufferId, start: clip.start, offset: clip.offset, duration: clip.duration }, { history: false });
    if (o.aviso) studio.setStatus(o.aviso);
    return true;
  } catch {
    studio.setStatus('No he podido rehacer el sonido de la pista. Las notas siguen ahí.');
    return false;
  }
}

function alargar(samples: Float32Array, largo: number): Float32Array {
  const salida = new Float32Array(largo);
  salida.set(samples);
  return salida;
}

const NOMBRES: Record<InstrumentoId, string> = {
  'bateria-808': 'Batería 808',
  'bateria-909': 'Batería 909',
  cajon: 'Cajón',
  piano: 'Piano',
  'piano-electrico': 'Piano eléctrico',
  cuerdas: 'Cuerdas',
  guitarra: 'Guitarra',
  bajo: 'Bajo',
};

export function useInstrumentos(studio: Studio, pulsosPorCompas: number) {
  const { engine, project, settings, transport } = studio;
  const studioRef = useRef(studio);
  studioRef.current = studio;
  const [estado, setEstado] = useState<EstadoTocar>('libre');
  const [version, setVersion] = useState(0);
  const desdeRef = useRef(0);

  const atril = useMemo(() => {
    if (!engine) return null;
    // `unlockSync` es síncrono: se puede llamar dentro del propio toque.
    const nuevo = new Atril(() => engine.unlockSync());
    nuevo.toqueMs = leerToqueMs() ?? 0;
    return nuevo;
  }, [engine]);

  useEffect(() => {
    if (!atril) return;
    atril.alCambiar = () => setVersion((v) => v + 1);
    return () => {
      atril.alCambiar = null;
      atril.dispose();
    };
  }, [atril]);

  // Con el transporte sonando, cada golpe sabe dónde cae en la línea de tiempo.
  useEffect(() => {
    if (!atril || !engine) return;
    atril.posicion = transport === 'playing' ? (t) => engine.posicionEn(t) : null;
  }, [atril, engine, transport]);

  /* ---------------------------------------------------------------- */
  /* De eventos a pistas                                               */
  /* ---------------------------------------------------------------- */

  const crearPistas = useCallback(
    async (eventos: EventoTocado[], posiciones: number[]): Promise<number> => {
      const s = studioRef.current;
      if (!s.engine || eventos.length === 0) return 0;
      const bpm = s.project.bpm;
      let creadas = 0;
      for (const [instrumento, grupo] of porInstrumento(eventos, posiciones)) {
        const def = getInstrumento(instrumento);
        const clip = colocarEnRejilla(grupo.eventos, grupo.posiciones, { bpm, pulsosPorCompas, cola: !def.pads });
        if (!clip) continue;
        const pulso = 60 / bpm;
        const golpes = procesarGolpes(clip.golpes, AJUSTES_SIN_TOCAR, { bpm, inicioBeat: clip.inicio / pulso });
        const render = await renderizarNotas({
          golpes,
          instrumento,
          bpm,
          sampleRate: s.engine.contextSampleRate,
          decodificador: s.engine.ctx,
        });
        const duracion = clip.pulsos * pulso;
        const minimo = Math.ceil(duracion * render.sampleRate);
        const samples = render.samples.length >= minimo ? render.samples : alargar(render.samples, minimo);
        const track: Track | null = studioRef.current.addGeneratedTrack({
          name: NOMBRES[instrumento],
          samples,
          sampleRate: render.sampleRate,
          start: clip.inicio,
          repeats: 1,
          volume: 0.9,
        });
        if (!track) continue;
        const notas: PistaDeNotas = {
          instrumento,
          bruto: clip.golpes,
          golpes,
          ajustes: AJUSTES_SIN_TOCAR,
          bpm,
          pulsosPorCompas,
          sonido: render.sonido,
        };
        // La has tocado tú: no es verde. Y el clip, en compases enteros para
        // que se pueda repetir sin costuras.
        studioRef.current.updateTrack(
          track.id,
          { ia: false, notas, clip: { ...track.clip, duration: duracion } },
          { history: false },
        );
        creadas++;
      }
      return creadas;
    },
    [pulsosPorCompas],
  );

  /* ---------------------------------------------------------------- */
  /* Grabar                                                            */
  /* ---------------------------------------------------------------- */

  const grabar = useCallback(
    async (claqueta: boolean) => {
      const s = studioRef.current;
      if (!s.engine || !atril) return;
      const motor = s.engine;
      if (motor.transportState !== 'stopped') await s.stop();
      const pulso = 60 / s.project.bpm;
      const compas = pulso * pulsosPorCompas;
      // Se graba desde el principio del compás donde está el cursor.
      const desde = Math.max(0, Math.floor(motor.position / compas + 1e-6) * compas);
      desdeRef.current = desde;
      atril.empezarToma();
      setEstado('claqueta');
      await motor.play(s.project, { ...s.settings, metronome: claqueta }, desde, {
        claquetaPulsos: Math.max(0, s.settings.countInBars) * pulsosPorCompas,
        sinFin: true,
      });
      // Sin esperar al efecto de React: el primer golpe ya tiene que saber dónde cae.
      atril.posicion = (t) => motor.posicionEn(t);
      const cuenta = motor.ctx ? Math.max(0, -motor.posicionEn(motor.ctx.currentTime) + desde) : 0;
      window.setTimeout(() => setEstado((e) => (e === 'claqueta' ? 'grabando' : e)), cuenta * 1000);
    },
    [atril, pulsosPorCompas],
  );

  const parar = useCallback(async () => {
    const s = studioRef.current;
    if (!s.engine || !atril) return;
    const grabando = atril.grabando;
    await s.engine.stop();
    atril.posicion = null;
    setEstado('libre');
    if (!grabando) return;
    s.engine.seek(desdeRef.current);
    const eventos = atril.terminarToma();
    if (eventos.length === 0) {
      s.setStatus('No has tocado nada en esta toma');
      return;
    }
    const posiciones = eventos.map((e) => e.pos ?? s.engine!.posicionEn(e.t));
    const creadas = await crearPistas(eventos, posiciones);
    if (creadas > 0) s.setStatus(creadas === 1 ? 'Toma guardada como pista de notas' : `${creadas} pistas de notas guardadas`);
  }, [atril, crearPistas]);

  /** Reproducir el proyecto para tocar encima (sin grabar, pero capturando). */
  const escuchar = useCallback(async () => {
    const s = studioRef.current;
    if (!s.engine || !atril) return;
    if (s.engine.transportState !== 'stopped') {
      await parar();
      return;
    }
    await s.engine.play(s.project, s.settings, undefined, { sinFin: true });
    atril.posicion = (t) => s.engine!.posicionEn(t);
  }, [atril, parar]);

  /** «Recuperar lo último»: lo que tocaste sin grabar, a una pista. */
  const recuperar = useCallback(async () => {
    const s = studioRef.current;
    if (!s.engine || !atril) return;
    const frase = recuperarFrase(atril.captura, { cursor: s.engine.position, bpm: s.project.bpm });
    if (!frase) return;
    atril.vaciarCaptura();
    const creadas = await crearPistas(frase.eventos, frase.posiciones);
    if (creadas > 0) s.setStatus('Recuperado: lo último que tocaste ya es una pista');
  }, [atril, crearPistas]);

  /* ---------------------------------------------------------------- */
  /* Mantener las pistas al día                                        */
  /* ---------------------------------------------------------------- */

  /* Si cambia el tempo, las pistas de notas se rehacen a tu tempo nuevo (el
     audio grabado no puede; las notas sí). Y si se tocaron sin red y ahora
     están las muestras, se rehacen con ellas. Sin historial: no es algo que
     hayas hecho tú. */
  useEffect(() => {
    if (transport !== 'stopped') return;
    const pendientes = project.tracks.filter((t) => {
      if (!t.notas) return false;
      if (t.notas.bpm !== project.bpm) return true;
      const def = getInstrumento(t.notas.instrumento);
      return t.notas.sonido === 'sintesis' && !!def.paquete && atril?.cargas.get(def.paquete) === 'lista';
    });
    if (pendientes.length === 0) return;
    const timer = window.setTimeout(() => {
      for (const t of pendientes) void rehacerPistaDeNotas(studioRef.current, t.id, {}, { historial: false });
    }, 700);
    return () => window.clearTimeout(timer);
  }, [project.bpm, project.tracks, transport, atril, version]);

  return {
    atril,
    estado,
    /** Cambia cuando cambian las cargas o la captura: para redibujar lo que lo enseña. */
    version,
    grabar,
    parar,
    escuchar,
    recuperar,
    hayCaptura: (atril?.captura.length ?? 0) > 0,
    pulsosPorCompas,
    settings,
  };
}

export type Instrumentos = ReturnType<typeof useInstrumentos>;
