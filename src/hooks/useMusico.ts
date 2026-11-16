'use client';

/**
 * El músico de sesión, conectado al estudio.
 *
 * Dos motores con el mismo resultado, una pista nueva en ámbar debajo de tu
 * toma:
 *
 *   · «Al momento»: el bajista de Compás escribe la línea con tus acordes y
 *     la toca el sintetizador. En el móvil, sin red, en menos de un segundo.
 *   · «Con IA»: la toma viaja al músico de la nube (ACE-Step), que toca
 *     escuchándote. Tarda de 10 a 60 segundos y suena a banda de verdad.
 *
 * Vive aparte de useStudio a propósito: el estudio no necesita saber nada de
 * esto para grabar, y así su estado no se redibuja con cada consulta.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Studio } from '@/hooks/useStudio';
import type { Instrumento } from '@/lib/ia/tipos';
import { getGroove } from '@/lib/daw/rhythm/grooves';
import { OPCIONES_POR_DEFECTO, duracionPatron, renderGroove } from '@/lib/daw/rhythm/player';
import { escribirBajo, ESTILOS, type CicloBajo, type EstiloBajo } from '@/lib/musico/bajo';
import { colocarRitmo, tempoParaRitmo } from '@/lib/musico/bateria';
import { escucharToma, type Escucha } from '@/lib/musico/escucha';
import { desplazar, estimarDesfase } from '@/lib/musico/pulso';
import { sintetizarBajo, sintetizarTeclas } from '@/lib/musico/sintetizador';
import { escribirTeclas, ESTILOS_TECLAS, type EstiloTeclas } from '@/lib/musico/teclas';
import { tonalidadEnIngles } from '@/lib/musico/teoria';
import { codificarWav, remuestrear } from '@/lib/musico/wav';
import type { Track } from '@/lib/daw/types';

export type Motor = 'momento' | 'ia';

export type Paso = 'mandando' | 'en-cola' | 'generando' | 'bajando' | 'cuadrando';

export interface EstadoIA {
  /** Hay servidor configurado y responde. */
  disponible: boolean;
  /** Hay servidor configurado (aunque esté apagado). */
  configurado: boolean;
  /** Es el servidor de prueba, que devuelve siempre la misma nota. */
  prueba: boolean;
  proveedor: string | null;
}

/** Lo que se le pide al músico «al momento». */
export type PeticionMomento =
  | { instrumento: 'bajo'; estilo: EstiloBajo }
  | { instrumento: 'teclado'; estilo: EstiloTeclas }
  | { instrumento: 'bateria'; ritmo: string };

export const NOMBRE_INSTRUMENTO: Record<Instrumento, string> = {
  bajo: 'Bajo',
  bateria: 'Batería',
  teclado: 'Teclas',
  guitarra: 'Guitarra',
  cuerdas: 'Cuerdas',
  metales: 'Metales',
  percusion: 'Percusión',
  sinte: 'Sinte',
};

/** Lo máximo que se manda a la nube de una vez: cabe en una petición. */
const SEGUNDOS_IA = 45;
const FRECUENCIA_SUBIDA = 32000;
const CADA = 2000;
const PACIENCIA = 180_000;

function mono(buffer: AudioBuffer, desde: number, hasta: number): Float32Array {
  const a = buffer.getChannelData(0).slice(desde, hasta);
  if (buffer.numberOfChannels < 2) return a;
  const b = buffer.getChannelData(1);
  for (let i = 0; i < a.length; i++) a[i] = (a[i] + b[desde + i]) / 2;
  return a;
}

const espera = (ms: number, senal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = window.setTimeout(resolve, ms);
    senal.addEventListener('abort', () => {
      window.clearTimeout(t);
      reject(new DOMException('Cancelado', 'AbortError'));
    });
  });

export function useMusico(studio: Studio, ciclo?: CicloBajo) {
  const { engine, project, addGeneratedTrack, setStatus, setBpm } = studio;
  const [escucha, setEscucha] = useState<(Escucha & { trackId: string }) | null>(null);
  const [paso, setPaso] = useState<Paso | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ia, setIa] = useState<EstadoIA | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  /**
   * Si tocaste libre, el proyecto pasa a tu tempo: la claqueta, la rejilla y
   * los ritmos tienen que ir con el bajo y contigo, no a 100 por defecto.
   * Devuelve el trozo de mensaje que lo cuenta, o nada.
   */
  const seguirTempo = useCallback(
    (oido: Escucha): string => {
      const redondo = Math.round(oido.bpm);
      if (oido.fuenteBpm !== 'toma' || Math.abs(project.bpm - redondo) < 1) return '';
      setBpm(redondo);
      return ` · proyecto a ${redondo} BPM`;
    },
    [project.bpm, setBpm],
  );

  /* Se pregunta al abrir la app y cada vez que se vuelve a ella: el servidor
     de la GPU se enciende y se apaga, y la opción tiene que decir la verdad. */
  const comprobarIA = useCallback(() => {
    fetch('/api/musico/estado', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d: { ia: boolean; conectado?: boolean; prueba?: boolean; proveedor: string | null }) => {
        setIa({
          configurado: d.ia,
          disponible: d.ia && d.conectado !== false,
          prueba: Boolean(d.prueba),
          proveedor: d.proveedor,
        });
      })
      .catch(() => setIa({ configurado: false, disponible: false, prueba: false, proveedor: null }));
  }, []);

  useEffect(() => {
    comprobarIA();
    const alVolver = () => document.visibilityState === 'visible' && comprobarIA();
    document.addEventListener('visibilitychange', alVolver);
    return () => document.removeEventListener('visibilitychange', alVolver);
  }, [comprobarIA]);

  /** El trozo de audio que de verdad suena en la pista (una repetición). */
  const region = useCallback(
    (track: Track) => {
      const buffer = engine?.getBuffer(track.clip.bufferId);
      if (!buffer) return null;
      const sr = buffer.sampleRate;
      const desde = Math.floor(track.clip.offset * sr);
      const hasta = Math.min(buffer.length, Math.floor((track.clip.offset + track.clip.duration) * sr));
      return { samples: mono(buffer, desde, hasta), sampleRate: sr };
    },
    [engine],
  );

  const escuchar = useCallback(
    (track: Track): Escucha | null => {
      const r = region(track);
      if (!r || r.samples.length < r.sampleRate * 2) {
        setError('La toma es muy corta: con dos segundos ya puedo oír algo.');
        return null;
      }
      setError(null);
      const resultado = escucharToma(r.samples, r.sampleRate, project.bpm);
      setEscucha({ ...resultado, trackId: track.id });
      return resultado;
    },
    [region, project.bpm],
  );

  /**
   * Bajo, teclas o batería tocados aquí mismo. Los tres salen igual: a tu
   * tempo, desde tu primer pulso y tan largos como tu toma, para que se
   * repitan con ella sin desfasarse.
   */
  const tocarAlMomento = useCallback(
    async (track: Track, oido: Escucha, peticion: PeticionMomento) => {
      if (!engine) return;
      const sr = engine.contextSampleRate;
      const comun = { bpm: oido.bpm, fase: oido.fase, duracion: oido.duracion, ciclo, semilla: Date.now() % 100_000 };
      let samples: Float32Array;
      let nombre: string;
      let detalle: string;

      if (peticion.instrumento === 'bateria') {
        const groove = getGroove(peticion.ritmo);
        if (!groove) return;
        const bpm = tempoParaRitmo(oido.bpm, groove.bpm);
        const vueltas = Math.max(1, Math.ceil(oido.duracion / duracionPatron(groove, bpm)));
        const render = await renderGroove(groove, bpm, OPCIONES_POR_DEFECTO, vueltas, sr);
        samples = colocarRitmo(render.getChannelData(0), sr, oido);
        nombre = `Batería · ${groove.nombre.toLowerCase()}`;
        detalle = `${groove.nombre} a ${Math.round(bpm)} BPM`;
      } else {
        const notas =
          peticion.instrumento === 'bajo'
            ? escribirBajo(oido.acordes, { ...comun, estilo: peticion.estilo })
            : escribirTeclas(oido.acordes, { ...comun, estilo: peticion.estilo });
        if (notas.length === 0) {
          setError('No he oído acordes claros en esta toma. Prueba con una parte con más armonía.');
          return;
        }
        samples =
          peticion.instrumento === 'bajo'
            ? sintetizarBajo(notas, { sampleRate: sr, duracion: oido.duracion })
            : sintetizarTeclas(notas, {
                sampleRate: sr,
                duracion: oido.duracion,
                timbre: peticion.estilo === 'colchon' ? 'colchon' : 'piano',
              });
        const estilos: { id: string; nombre: string }[] = peticion.instrumento === 'bajo' ? ESTILOS : ESTILOS_TECLAS;
        const estilo = estilos.find((e) => e.id === peticion.estilo)?.nombre.toLowerCase() ?? '';
        nombre = `${NOMBRE_INSTRUMENTO[peticion.instrumento]} · ${estilo}`;
        detalle = oido.progresion || 'sobre tu toma';
      }

      addGeneratedTrack({
        name: nombre,
        samples,
        sampleRate: sr,
        start: track.clip.start,
        repeats: track.clip.repeats,
        volume: peticion.instrumento === 'teclado' ? 0.7 : undefined,
      });
      const listo = { bajo: 'Bajo listo', teclado: 'Teclas listas', bateria: 'Batería lista' }[peticion.instrumento];
      setStatus(`${listo} · ${detalle}${seguirTempo(oido)}`);
    },
    [engine, ciclo, addGeneratedTrack, setStatus, seguirTempo],
  );

  const tocarConIA = useCallback(
    async (track: Track, oido: Escucha, instrumento: Instrumento, descripcion: string): Promise<boolean> => {
      const r = region(track);
      if (!engine || !r) return false;
      const controlador = new AbortController();
      abortRef.current = controlador;
      const senal = controlador.signal;

      try {
        setPaso('mandando');
        const segundos = Math.min(SEGUNDOS_IA, oido.duracion);
        const recorte = r.samples.subarray(0, Math.round(segundos * r.sampleRate));
        const wav = codificarWav(remuestrear(recorte, r.sampleRate, FRECUENCIA_SUBIDA), FRECUENCIA_SUBIDA);

        const form = new FormData();
        form.set('audio', new Blob([wav], { type: 'audio/wav' }), 'toma.wav');
        form.set('instrumento', instrumento);
        form.set('bpm', String(oido.bpm));
        form.set('duracion', segundos.toFixed(2));
        form.set('pulsosPorCompas', String(ciclo?.pulsos ?? 4));
        if (oido.tonalidad) {
          form.set('tonalidad', tonalidadEnIngles({ tonica: oido.tonalidad.tonica, modo: oido.tonalidad.modo }));
        }
        if (descripcion.trim()) form.set('descripcion', descripcion.trim());

        const encargo = await fetch('/api/musico/pista', { method: 'POST', body: form, signal: senal });
        const datos = (await encargo.json()) as { tarea?: string; error?: string };
        if (!encargo.ok || !datos.tarea) throw new Error(datos.error ?? 'El músico de la nube no ha cogido el encargo.');

        // Preguntar cada dos segundos, con paciencia pero no infinita.
        setPaso('en-cola');
        const limite = Date.now() + PACIENCIA;
        let audioUrl: string | undefined;
        while (!audioUrl) {
          if (Date.now() > limite) throw new Error('El músico de la nube está tardando demasiado. Prueba otra vez.');
          await espera(CADA, senal);
          const consulta = await fetch(`/api/musico/pista?tarea=${encodeURIComponent(datos.tarea)}`, { signal: senal });
          const estado = (await consulta.json()) as { estado?: string; audio?: string; error?: string };
          if (!consulta.ok || estado.estado === 'fallo') throw new Error(estado.error ?? 'No ha salido la pista.');
          if (estado.estado === 'generando') setPaso('generando');
          if (estado.estado === 'listo') audioUrl = estado.audio;
        }

        setPaso('bajando');
        const audio = await fetch(audioUrl, { signal: senal });
        if (!audio.ok) throw new Error('No he podido bajar la pista.');
        const decodificado = await engine.decodeFile(new File([await audio.arrayBuffer()], 'pista.wav'));
        const sr = decodificado.sampleRate;
        let samples = mono(decodificado, 0, decodificado.length);

        /* Red de seguridad: el modelo toca encima de tu toma y debería venir
           ya en su sitio, pero se comprueba contra tus ataques y se corrige si
           se ha ido más de 10 ms. Después se ajusta a lo que dura la toma. */
        setPaso('cuadrando');
        const referencia = remuestrear(recorte, r.sampleRate, sr);
        const desfase = estimarDesfase(referencia, samples, sr, 0.25);
        if (Math.abs(desfase) > 0.01) samples = desplazar(samples, sr, desfase);
        const largo = Math.round(segundos * sr);
        const ajustada = new Float32Array(largo);
        ajustada.set(samples.subarray(0, largo));

        addGeneratedTrack({
          name: `${NOMBRE_INSTRUMENTO[instrumento]} · IA`,
          samples: ajustada,
          sampleRate: sr,
          start: track.clip.start,
          // Si la toma era más larga de lo que cabe en un encargo, la pista
          // nueva no puede repetirse con ella: quedaría desfasada a la vuelta.
          repeats: segundos < oido.duracion - 0.05 ? 1 : track.clip.repeats,
        });
        setStatus(
          `Pista de ${ia?.proveedor ?? 'la nube'} lista${Math.abs(desfase) > 0.01 ? ` · cuadrada ${Math.round(desfase * 1000)} ms` : ''}${seguirTempo(oido)}`,
        );

        return true;
      } catch (e) {
        if ((e as Error).name === 'AbortError') setStatus('Encargo cancelado');
        else setError((e as Error).message);
        return false;
      } finally {
        abortRef.current = null;
        setPaso(null);
      }
    },
    [engine, region, ciclo, addGeneratedTrack, setStatus, ia?.proveedor, seguirTempo],
  );

  const cancelar = useCallback(() => abortRef.current?.abort(), []);

  return { ia, comprobarIA, escucha, escuchar, paso, error, setError, tocarAlMomento, tocarConIA, cancelar };
}

export type Musico = ReturnType<typeof useMusico>;
