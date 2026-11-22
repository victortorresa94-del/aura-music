'use client';

/**
 * Cuadrar al tempo una toma de audio, conectado al estudio. Lo usan el
 * panel de la pista y el productor.
 *
 * Igual que con todo lo demás: primero se guarda el audio nuevo en disco,
 * esperando de verdad, y solo después cambia la pista (perder una toma es
 * lo único que no se perdona). La original sigue guardada y se vuelve a ella
 * con «Dejar como lo toqué» o con Deshacer.
 */

import type { Studio } from '@/hooks/useStudio';
import { cuadrarMuestras, type AjustesCuadreToma } from '@/lib/daw/cuadrar/cuadrar';
import { conCuadre, escucharVersion, regionOriginal, sinCuadre, type CuadreDeToma } from '@/lib/daw/cuadrar/toma';
import * as store from '@/lib/daw/storage';
import { newId } from '@/lib/daw/types';

type Estudio = Pick<Studio, 'engine' | 'project' | 'commit' | 'ponerAudio' | 'setStatus'>;

/** El audio de un buffer, cargándolo del disco si al abrir la idea no hacía falta (la versión que no sonaba). */
export async function asegurarAudio(studio: Estudio, bufferId: string): Promise<AudioBuffer | null> {
  const { engine } = studio;
  if (!engine) return null;
  const cargado = engine.getBuffer(bufferId);
  if (cargado) return cargado;
  const audio = await store.getAudio(bufferId);
  if (!audio) return null;
  studio.ponerAudio(bufferId, audio.channels, audio.sampleRate);
  return engine.getBuffer(bufferId) ?? null;
}

const ms = (s: number) => Math.round(s * 1000);

/**
 * Cuadra la toma (siempre desde la original, aunque ya estuviera cuadrada)
 * y la deja sonando. Devuelve el cuadre, o null si no había nada que hacer.
 */
export async function cuadrarToma(studio: Estudio, trackId: string, ajustes: AjustesCuadreToma): Promise<CuadreDeToma | null> {
  const { engine, project } = studio;
  const track = project.tracks.find((t) => t.id === trackId);
  if (!engine || !track || track.notas) return null;
  const original = regionOriginal(track);
  const buffer = await asegurarAudio(studio, original.bufferId);
  if (!buffer) {
    studio.setStatus('No encuentro el audio de esta toma en el móvil.');
    return null;
  }

  // Solo la región que suena: lo recortado fuera no se toca.
  const sr = buffer.sampleRate;
  const desde = Math.max(0, Math.round(original.offset * sr));
  const hasta = Math.min(buffer.length, Math.round((original.offset + original.duration) * sr));
  const canales: Float32Array[] = [];
  for (let c = 0; c < buffer.numberOfChannels; c++) canales.push(buffer.getChannelData(c).slice(desde, hasta));

  // Un respiro para que el botón diga «Cuadrando…» antes del cálculo.
  await new Promise((resolve) => setTimeout(resolve, 30));
  const { canales: salida, plan } = cuadrarMuestras(canales, sr, { inicio: track.clip.start, bpm: project.bpm }, ajustes);
  if (plan.golpes === 0) {
    studio.setStatus('No he encontrado golpes claros en esta toma: no hay nada que cuadrar.');
    return null;
  }
  if (plan.movidos === 0) {
    studio.setStatus('Ya estaba a tempo: no he tenido que mover nada.');
    return null;
  }

  const bufferId = newId('buf');
  try {
    await store.putAudio(bufferId, salida, sr);
  } catch {
    studio.setStatus('No he podido guardar la toma cuadrada. La original sigue igual.');
    return null;
  }
  studio.ponerAudio(bufferId, salida, sr);

  const duracion = salida[0].length / sr;
  const cuadre: CuadreDeToma = {
    original,
    cuadrado: { bufferId, offset: 0, duration: duracion, sourceDuration: duracion },
    ajustes,
    escuchando: 'cuadrado',
    movidos: plan.movidos,
    golpes: plan.golpes,
    antesMs: ms(plan.antes),
    despuesMs: ms(plan.despues),
  };
  studio.commit((p) => conCuadre(p, trackId, cuadre));
  studio.setStatus(
    `Cuadrada: ${plan.movidos} ${plan.movidos === 1 ? 'golpe movido' : 'golpes movidos'}, de ${ms(plan.antes)} a ${ms(plan.despues)} ms de la rejilla.`,
  );
  return cuadre;
}

/**
 * Antes o después. No es un cambio que haya que deshacer, así que no entra
 * en el historial; con la canción en marcha el motor cambia de audio sin
 * parar (`resync`).
 */
export async function escucharCuadre(studio: Estudio, trackId: string, cual: CuadreDeToma['escuchando']): Promise<void> {
  const track = studio.project.tracks.find((t) => t.id === trackId);
  if (!track?.cuadre) return;
  if (!(await asegurarAudio(studio, track.cuadre[cual].bufferId))) {
    studio.setStatus('No encuentro esa versión de la toma en el móvil.');
    return;
  }
  studio.commit((p) => escucharVersion(p, trackId, cual), { history: false });
}

/** «Dejar como lo toqué»: vuelve la original, con su paso de Deshacer. */
export async function dejarComoLoToque(studio: Estudio, trackId: string): Promise<void> {
  const track = studio.project.tracks.find((t) => t.id === trackId);
  if (!track?.cuadre) return;
  if (!(await asegurarAudio(studio, track.cuadre.original.bufferId))) {
    studio.setStatus('No encuentro la toma original en el móvil.');
    return;
  }
  studio.commit((p) => sinCuadre(p, trackId));
  studio.setStatus('Como la tocaste. Puedes deshacer.');
}
