/**
 * Grabar en bucle (el «ciclo» de cualquier DAW).
 *
 * Una zona de compases enteros se repite al reproducir y al grabar. Grabando,
 * el micro no para: sale una sola grabación larga y aquí se corta en vueltas.
 * Cada vuelta es una toma de la MISMA pista (el mismo audio, otro trozo), así
 * que cambiar de toma es cambiar qué trozo suena, sin copiar nada, y todas
 * llevan la misma compensación de latencia, porque salen de la misma
 * grabación con el mismo desfase.
 *
 * La zona se guarda en pulsos, no en segundos: si cambias el tempo, sigue
 * siendo «los compases 5 a 8».
 */

import type { Project, Track } from '../types';

export interface Ciclo {
  /** Pulso donde empieza (el 0 es el primer pulso del proyecto). */
  desde: number;
  /** Pulso donde acaba (no incluido). */
  hasta: number;
  /** Puesto o quitado: la zona se recuerda aunque se apague. */
  activo: boolean;
}

/** Las tomas de una pista grabada con el ciclo: el mismo audio, distinto trozo. */
export interface TomasDeBucle {
  /** Dónde empieza cada toma dentro del audio de la pista (segundos). */
  offsets: number[];
  /** La que suena (índice). */
  elegida: number;
}

export const COMPASES_DE_CICLO = [1, 2, 4, 8] as const;

const pulso = (bpm: number) => 60 / Math.max(20, bpm || 100);

/** La zona en segundos de la línea de tiempo, o null si está quitada o no tiene largo. */
export function segundosDelCiclo(ciclo: Ciclo | null | undefined, bpm: number): { inicio: number; fin: number } | null {
  if (!ciclo || !ciclo.activo || !(ciclo.hasta > ciclo.desde)) return null;
  return { inicio: ciclo.desde * pulso(bpm), fin: ciclo.hasta * pulso(bpm) };
}

/** «Repetir N compases desde aquí»: desde el principio del compás donde está el cursor. */
export function cicloDesde(posicion: number, compases: number, bpm: number, pulsosPorCompas: number): Ciclo {
  const p = Math.max(1, Math.round(pulsosPorCompas));
  const compas = Math.max(0, Math.floor(posicion / pulso(bpm) / p + 1e-6));
  return { desde: compas * p, hasta: (compas + Math.max(1, Math.round(compases))) * p, activo: true };
}

/** Arrastrando por la regla: de compás entero a compás entero, como mínimo uno. */
export function cicloEntre(a: number, b: number, bpm: number, pulsosPorCompas: number): Ciclo {
  const p = Math.max(1, Math.round(pulsosPorCompas));
  const compasA = Math.max(0, Math.floor(Math.min(a, b) / pulso(bpm) / p + 1e-6));
  const compasB = Math.max(compasA + 1, Math.ceil(Math.max(a, b) / pulso(bpm) / p - 1e-6));
  return { desde: compasA * p, hasta: compasB * p, activo: true };
}

/** Mover un borde de la zona a otro compás, sin que la zona se quede en nada. */
export function moverBorde(ciclo: Ciclo, borde: 'desde' | 'hasta', posicion: number, bpm: number, pulsosPorCompas: number): Ciclo {
  const p = Math.max(1, Math.round(pulsosPorCompas));
  const compas = Math.max(0, Math.round(posicion / pulso(bpm) / p));
  if (borde === 'desde') return { ...ciclo, desde: Math.min(compas * p, ciclo.hasta - p) };
  return { ...ciclo, hasta: Math.max(compas * p, ciclo.desde + p) };
}

/** Cuántos compases mide la zona (para decirlo: «2 compases»). */
export function compasesDelCiclo(ciclo: Ciclo, pulsosPorCompas: number): number {
  return Math.max(1, Math.round((ciclo.hasta - ciclo.desde) / Math.max(1, pulsosPorCompas)));
}

/**
 * Corta una grabación hecha con el ciclo en vueltas. La grabación entera se
 * colocó como una toma normal (empieza en `colocada`, con la latencia ya
 * compensada); la vuelta k es lo que sonó mientras la línea de tiempo
 * pasaba por la zona por k-ésima vez. Solo cuentan las vueltas enteras (con
 * un 10 % de margen, por si paraste justo al acabar); si no hay ninguna, es
 * una toma normal y devuelve null. Suena la última: es la que acabas de tocar.
 */
export function tomasDeVueltas(o: { duracionAudio: number; colocada: number; inicio: number; fin: number }): TomasDeBucle | null {
  const largo = o.fin - o.inicio;
  if (!(largo > 0)) return null;
  const offsets: number[] = [];
  for (let k = 0; k < 256; k++) {
    const offset = o.inicio + k * largo - o.colocada;
    if (offset + largo > o.duracionAudio + largo * 0.1) break;
    if (offset < -0.001) continue;
    offsets.push(Math.max(0, offset));
  }
  if (offsets.length === 0) return null;
  return { offsets, elegida: offsets.length - 1 };
}

/* -------------------------------------------------------------------------- */
/* Cambios sobre el proyecto                                                   */
/* -------------------------------------------------------------------------- */

export function conCiclo(project: Project, ciclo: Ciclo | null): Project {
  if (!ciclo) {
    const { ciclo: _quitado, ...resto } = project;
    return resto;
  }
  return { ...project, ciclo };
}

/** Elegir otra toma: solo cambia qué trozo del audio suena. */
export function elegirToma(project: Project, trackId: string, indice: number): Project {
  return {
    ...project,
    tracks: project.tracks.map((t) => {
      if (t.id !== trackId || !t.tomas) return t;
      const i = Math.min(t.tomas.offsets.length - 1, Math.max(0, Math.round(indice)));
      return { ...t, clip: { ...t.clip, offset: t.tomas.offsets[i] }, tomas: { ...t.tomas, elegida: i } };
    }),
  };
}

/**
 * «Una pista por toma»: las tomas apiladas, sonando a la vez, para
 * superponerlas (unas palmas, unos coros). La pista se queda con la toma
 * que sonaba y las demás salen debajo, cada una en su pista.
 */
export function separarTomas(project: Project, trackId: string, nuevoId: () => string): Project {
  const indice = project.tracks.findIndex((t) => t.id === trackId);
  const pista = project.tracks[indice];
  if (!pista?.tomas || pista.tomas.offsets.length < 2) return project;
  const { tomas, ...base } = pista;
  const ahora = Date.now();
  const nuevas: Track[] = tomas.offsets
    .map((offset, i) => ({ offset, i }))
    .filter(({ i }) => i !== tomas.elegida)
    .map(({ offset, i }) => ({
      ...base,
      id: nuevoId(),
      name: `${pista.name} · toma ${i + 1}`.slice(0, 40),
      clip: { ...pista.clip, offset },
      soloed: false,
      createdAt: ahora,
    }));
  const tracks = [...project.tracks];
  tracks.splice(indice, 1, { ...base, name: `${pista.name} · toma ${tomas.elegida + 1}`.slice(0, 40) }, ...nuevas);
  return { ...project, tracks };
}
