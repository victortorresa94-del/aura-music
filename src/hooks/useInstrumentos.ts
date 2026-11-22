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
import { Atril, ReproductorDeBucle } from '@/lib/instrumentos/directo';
import {
  colocarEnBucle,
  colocarEnRejilla,
  porInstrumento,
  recuperarFrase,
  vueltaDe,
  type ClipDeNotas,
  type EventoTocado,
} from '@/lib/instrumentos/grabacion';
import { golpesParaPista, type Loop, type NivelLoop } from '@/lib/instrumentos/loops';
import { getInstrumento } from '@/lib/instrumentos/registro';
import { programarPrecarga } from '@/lib/instrumentos/percusion';
import { renderizarNotas } from '@/lib/instrumentos/render';
import { AJUSTES_SIN_TOCAR, type AjustesGroove, type InstrumentoId, type PistaDeNotas } from '@/lib/instrumentos/tipos';
import { leerToqueMs } from '@/lib/instrumentos/toque';
import { ajustesParaCuadrar, procesarGolpes } from '@/lib/musico/groove';

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

  // Las muestras de los ritmos y de la claqueta (bombo, palmas, bongós...),
  // en cuanto se toque la app: así el primer compás ya suena grabado.
  useEffect(() => programarPrecarga(), []);

  // Con el transporte sonando, cada golpe sabe dónde cae en la línea de tiempo.
  useEffect(() => {
    if (!atril || !engine) return;
    atril.posicion = transport === 'playing' ? (t) => engine.posicionEn(t) : null;
  }, [atril, engine, transport]);

  /* ---------------------------------------------------------------- */
  /* De notas a pistas                                                 */
  /* ---------------------------------------------------------------- */

  /**
   * Una pista de notas nueva a partir de un clip ya colocado: lo tocado, lo
   * recuperado o un loop de la biblioteca. Devuelve el id de la pista.
   */
  const crearPista = useCallback(
    async (o: {
      instrumento: InstrumentoId;
      clip: ClipDeNotas;
      ajustes?: AjustesGroove;
      repeticiones?: number;
      /** Un loop de la biblioteca lo ha puesto la máquina: va en verde. */
      ia?: boolean;
      nombre?: string;
    }): Promise<string | null> => {
      const s = studioRef.current;
      if (!s.engine) return null;
      const bpm = s.project.bpm;
      const pulso = 60 / bpm;
      const def = getInstrumento(o.instrumento);
      const ajustes = o.ajustes ?? AJUSTES_SIN_TOCAR;
      const golpes = procesarGolpes(o.clip.golpes, ajustes, { bpm, inicioBeat: o.clip.inicio / pulso });
      const render = await renderizarNotas({
        golpes,
        instrumento: o.instrumento,
        bpm,
        sampleRate: s.engine.contextSampleRate,
        decodificador: s.engine.ctx,
      });
      const duracion = o.clip.pulsos * pulso;
      const minimo = Math.ceil(duracion * render.sampleRate);
      const samples = render.samples.length >= minimo ? render.samples : alargar(render.samples, minimo);
      const track: Track | null = studioRef.current.addGeneratedTrack({
        name: o.nombre ?? def.nombre,
        samples,
        sampleRate: render.sampleRate,
        start: o.clip.inicio,
        repeats: Math.max(1, o.repeticiones ?? 1),
        volume: 0.9,
      });
      if (!track) return null;
      const notas: PistaDeNotas = {
        instrumento: o.instrumento,
        bruto: o.clip.golpes,
        golpes,
        ajustes,
        bpm,
        pulsosPorCompas,
        sonido: render.sonido,
      };
      // Lo tocado por ti no es verde; un loop de la biblioteca, sí. Y el clip,
      // en compases enteros para que se repita sin costuras.
      studioRef.current.updateTrack(
        track.id,
        { ia: !!o.ia, notas, clip: { ...track.clip, duration: duracion } },
        { history: false },
      );
      return track.id;
    },
    [pulsosPorCompas],
  );

  const crearPistas = useCallback(
    async (eventos: EventoTocado[], posiciones: number[]): Promise<string[]> => {
      const s = studioRef.current;
      if (!s.engine || eventos.length === 0) return [];
      const ids: string[] = [];
      for (const [instrumento, grupo] of porInstrumento(eventos, posiciones)) {
        const def = getInstrumento(instrumento);
        const clip = colocarEnRejilla(grupo.eventos, grupo.posiciones, { bpm: s.project.bpm, pulsosPorCompas, cola: !def.pads });
        if (!clip) continue;
        const id = await crearPista({ instrumento, clip });
        if (id) ids.push(id);
      }
      return ids;
    },
    [crearPista, pulsosPorCompas],
  );

  /* ---------------------------------------------------------------- */
  /* «¿Ha quedado bien?»                                               */
  /* ---------------------------------------------------------------- */

  /**
   * Después de cada toma, la pregunta. Si era un loop, ya viene cuadrado al
   * 70 % (fuerza y swing por defecto) y se ofrece dejarlo como lo tocaste o
   * cuadrarlo más; si no, cuadrarlo. Nunca se pierde lo tocado: el bruto se
   * queda en la pista, y «Deshacer» la quita entera con el Deshacer de
   * siempre.
   */
  const [resultado, setResultado] = useState<Resultado | null>(null);

  const cuadrarResultado = useCallback(
    async (fuerza: number | null) => {
      const s = studioRef.current;
      if (!resultado) return;
      for (const id of resultado.trackIds) {
        const track = s.project.tracks.find((t) => t.id === id);
        if (!track?.notas) continue;
        const inicioBeat = (track.clip.start * s.project.bpm) / 60;
        const ajustes =
          fuerza === null
            ? { ...track.notas.ajustes, cuadrar: null }
            : ajustesParaCuadrar(track.notas.bruto, track.notas.ajustes, { fuerza, swing: track.notas.ajustes.cuadrar?.swing ?? 0, humanizar: false, inicioBeat });
        await rehacerPistaDeNotas(studioRef.current, id, { ajustes });
      }
      // La tarjeta ya dice cómo ha quedado: sin aviso abajo, que sería decirlo dos veces.
      setResultado((r) => (r ? { ...r, fuerza } : r));
    },
    [resultado],
  );

  const cerrarResultado = useCallback(() => setResultado(null), []);

  const deshacerResultado = useCallback(() => {
    const s = studioRef.current;
    if (!resultado) return;
    for (const id of resultado.trackIds) s.deleteTrack(id);
    setResultado(null);
  }, [resultado]);

  /* ---------------------------------------------------------------- */
  /* Grabar                                                            */
  /* ---------------------------------------------------------------- */

  /** Lo que hace falta mientras se graba en bucle. */
  const bucleRef = useRef<{ desde: number; largo: number; compases: number; inicios: number[]; reproductor: ReproductorDeBucle | null } | null>(null);
  const [vuelta, setVuelta] = useState(0);

  const grabar = useCallback(
    async (claqueta: boolean, bucleCompases = 0) => {
      const s = studioRef.current;
      if (!s.engine || !atril) return;
      const motor = s.engine;
      if (motor.transportState !== 'stopped') await s.stop();
      setResultado(null);
      const pulso = 60 / s.project.bpm;
      const compas = pulso * pulsosPorCompas;
      // Se graba desde el principio del compás donde está el cursor.
      const desde = Math.max(0, Math.floor(motor.position / compas + 1e-6) * compas);
      const largo = bucleCompases > 0 ? bucleCompases * compas : 0;
      desdeRef.current = desde;
      atril.empezarToma();
      setEstado('claqueta');
      setVuelta(0);
      await motor.play(s.project, { ...s.settings, metronome: claqueta }, desde, {
        claquetaPulsos: Math.max(0, s.settings.countInBars) * pulsosPorCompas,
        sinFin: true,
        bucle: largo > 0 ? { inicio: desde, fin: desde + largo } : undefined,
      });
      // Sin esperar al efecto de React: el primer golpe ya tiene que saber dónde cae.
      atril.posicion = (t) => motor.posicionEn(t);
      const ctx = motor.ctx;
      const cuenta = ctx ? Math.max(0, -motor.posicionEn(ctx.currentTime) + desde) : 0;
      window.setTimeout(() => setEstado((e) => (e === 'claqueta' ? 'grabando' : e)), cuenta * 1000);

      if (largo > 0 && ctx) {
        // Modo loop: cada vuelta se suma a lo anterior. Lo de las vueltas ya
        // terminadas suena solo mientras tocas la siguiente.
        const inicioPrimera = ctx.currentTime + cuenta;
        const estadoBucle = { desde, largo, compases: bucleCompases, inicios: [inicioPrimera], reproductor: null as ReproductorDeBucle | null };
        bucleRef.current = estadoBucle;
        motor.onVuelta = (cuando) => {
          estadoBucle.inicios.push(cuando);
          window.setTimeout(() => setVuelta(estadoBucle.inicios.length - 1), Math.max(0, (cuando - ctx.currentTime) * 1000));
        };
        estadoBucle.reproductor = new ReproductorDeBucle(atril, ctx, {
          id: 'bateria-acustica',
          largo: largo / pulso,
          bpm: s.project.bpm,
          fase: (t) => (motor.posicionEn(t) - desde) / pulso,
          golpes: (t) => {
            const ahora = vueltaDe(t, estadoBucle.inicios);
            return atril.eventosDeLaToma
              .filter((e) => vueltaDe(e.t, estadoBucle.inicios) < ahora)
              .map((e) => {
                const pos = e.pos ?? motor.posicionEn(e.t);
                const dentro = (((pos - desde) % largo) + largo) % largo;
                return { beat: dentro / pulso, dur: (e.dur ?? 0.1) / pulso, nota: e.nota, vel: e.vel, instrumento: e.instrumento };
              });
          },
        });
      } else {
        bucleRef.current = null;
      }
    },
    [atril, pulsosPorCompas],
  );

  /** Quita la última vuelta que tenga algo (la que acabas de tocar, o la de antes). */
  const deshacerVuelta = useCallback(() => {
    const b = bucleRef.current;
    if (!b || !atril) return;
    const vueltas = atril.eventosDeLaToma.map((e) => vueltaDe(e.t, b.inicios));
    if (vueltas.length === 0) {
      studioRef.current.setStatus('Todavía no hay nada que quitar');
      return;
    }
    const ultima = Math.max(...vueltas);
    atril.quitarDeLaToma((e) => vueltaDe(e.t, b.inicios) === ultima);
    studioRef.current.setStatus(`Quitada la vuelta ${ultima + 1}`);
  }, [atril]);

  const parar = useCallback(async () => {
    const s = studioRef.current;
    if (!s.engine || !atril) return;
    const grabando = atril.grabando;
    const bucle = bucleRef.current;
    bucle?.reproductor?.parar();
    s.engine.onVuelta = null;
    bucleRef.current = null;
    await s.engine.stop();
    atril.posicion = null;
    setEstado('libre');
    setVuelta(0);
    if (!grabando) return;
    s.engine.seek(desdeRef.current);
    const eventos = atril.terminarToma();
    if (eventos.length === 0) {
      s.setStatus('No has tocado nada en esta toma');
      return;
    }
    const posiciones = eventos.map((e) => e.pos ?? s.engine!.posicionEn(e.t));

    if (!bucle) {
      const ids = await crearPistas(eventos, posiciones);
      if (ids.length > 0) setResultado({ origen: 'toma', trackIds: ids, fuerza: null });
      return;
    }

    // Un loop: se pliega en sus compases, se cuadra solo y se repite hasta
    // llenar unos ocho compases (el bloque se puede alargar o acortar luego).
    const ids: string[] = [];
    const pulso = 60 / s.project.bpm;
    for (const [instrumento, grupo] of porInstrumento(eventos, posiciones)) {
      const clip = colocarEnBucle(grupo.eventos, grupo.posiciones, { bpm: s.project.bpm, desde: bucle.desde, largo: bucle.largo });
      if (!clip) continue;
      const ajustes = ajustesParaCuadrar(clip.golpes, AJUSTES_SIN_TOCAR, {
        fuerza: 0.7,
        swing: 0,
        humanizar: false,
        inicioBeat: bucle.desde / pulso,
      });
      const id = await crearPista({
        instrumento,
        clip,
        ajustes,
        repeticiones: Math.max(1, Math.round(8 / bucle.compases)),
        nombre: `${getInstrumento(instrumento).nombre} · loop`,
      });
      if (id) ids.push(id);
    }
    if (ids.length > 0) setResultado({ origen: 'loop', trackIds: ids, fuerza: 0.7 });
  }, [atril, crearPistas, crearPista]);

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
    const ids = await crearPistas(frase.eventos, frase.posiciones);
    if (ids.length > 0) setResultado({ origen: 'recuperado', trackIds: ids, fuerza: null });
  }, [atril, crearPistas]);

  /* ---------------------------------------------------------------- */
  /* Biblioteca de loops                                               */
  /* ---------------------------------------------------------------- */

  const escuchaRef = useRef<ReproductorDeBucle | null>(null);
  const [escuchando, setEscuchando] = useState<string | null>(null);

  const pararEscucha = useCallback(() => {
    escuchaRef.current?.parar();
    escuchaRef.current = null;
    setEscuchando(null);
  }, []);

  /**
   * Escuchar un loop antes de ponerlo, a tu tempo. Si el proyecto está
   * sonando, entra pegado a su rejilla; si no, empieza ya.
   */
  const escucharLoop = useCallback(
    (loop: Loop, o: { nivel: NivelLoop; tonica: number }) => {
      const s = studioRef.current;
      if (!atril || !s.engine) return;
      pararEscucha();
      atril.preparar(loop.instrumento);
      const ctx = atril.contexto();
      const pulso = 60 / s.project.bpm;
      const { golpes, pulsos } = golpesParaPista(loop, { veces: loop.compases, nivel: o.nivel, tonica: o.tonica });
      const motor = s.engine;
      const sonando = motor.transportState === 'playing';
      const t0 = ctx.currentTime + 0.06;
      escuchaRef.current = new ReproductorDeBucle(atril, ctx, {
        id: loop.instrumento,
        largo: pulsos,
        bpm: s.project.bpm,
        fase: sonando ? (t) => motor.posicionEn(t) / pulso : (t) => (t - t0) / pulso,
        golpes: () => golpes,
      });
      setEscuchando(loop.id);
    },
    [atril, pararEscucha],
  );

  /** Poner un loop: entra como pista de notas en el compás del cursor, repetido `veces` ciclos. */
  const ponerLoop = useCallback(
    async (loop: Loop, o: { nivel: NivelLoop; veces: number; tonica: number }) => {
      const s = studioRef.current;
      if (!s.engine) return;
      pararEscucha();
      const pulso = 60 / s.project.bpm;
      const compas = pulso * pulsosPorCompas;
      const desde = Math.max(0, Math.floor(s.engine.position / compas + 1e-6) * compas);
      const { golpes, pulsos } = golpesParaPista(loop, o);
      const sufijo = o.nivel === 'bombo' ? ' · solo bombo' : o.nivel === 'bombo-caja' ? ' · bombo y caja' : '';
      // Un loop tocado por una mano: unos ms y unos puntos de fuerza que no se
      // repiten igual en cada vuelta. Las cajas de ritmos, no: van clavadas,
      // que es lo suyo. Lo de la biblioteca se puede cuadrar después igual.
      const maquina = loop.instrumento === 'bateria-808' || loop.instrumento === 'bateria-909';
      const semilla = [...loop.id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 9973, 7);
      const id = await crearPista({
        instrumento: loop.instrumento,
        clip: { inicio: desde, golpes, pulsos },
        ajustes: maquina ? AJUSTES_SIN_TOCAR : { ...AJUSTES_SIN_TOCAR, humanizar: { cantidad: 0.3, semilla } },
        ia: true,
        nombre: `${loop.nombre}${sufijo}`,
      });
      if (id) {
        setResultado({
          origen: 'biblioteca',
          trackIds: [id],
          fuerza: null,
          nombre: `${loop.nombre} · ${o.veces} ${o.veces === 1 ? 'compás' : 'compases'} a ${s.project.bpm} BPM`,
        });
      }
    },
    [crearPista, pararEscucha, pulsosPorCompas],
  );

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
    // Modo loop
    vuelta,
    deshacerVuelta,
    // «¿Ha quedado bien?»
    resultado,
    cuadrarResultado,
    deshacerResultado,
    cerrarResultado,
    // Biblioteca de loops
    escuchando,
    escucharLoop,
    pararEscucha,
    ponerLoop,
    pulsosPorCompas,
    settings,
  };
}

export type Instrumentos = ReturnType<typeof useInstrumentos>;

/**
 * Lo último que ha entrado en la canción desde «Tocar», para preguntar si ha
 * quedado bien. `fuerza` es cuánto está cuadrado (null: tal cual se tocó).
 */
export interface Resultado {
  origen: 'toma' | 'loop' | 'recuperado' | 'biblioteca';
  trackIds: string[];
  fuerza: number | null;
  /** Para un loop de la biblioteca: qué se ha puesto. */
  nombre?: string;
}
