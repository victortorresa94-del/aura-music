/**
 * Cambios de mezcla sobre el proyecto, como funciones puras. Las usan el
 * mezclador (con el dedo) y el productor (con palabras), y pasan por el
 * mismo historial: todo se deshace igual.
 */

import type { Project } from '../types';
import { LIMITES, masterDe, mezclaDe, preajuste, conPreajuste, type AjustesMaster, type MezclaPista } from './tipos';
import { dbALineal } from './escala';

export function conVolumen(project: Project, trackId: string, volumen: number): Project {
  const v = Math.min(LIMITES.volumenMax, Math.max(0, Number.isFinite(volumen) ? volumen : 1));
  return {
    ...project,
    tracks: project.tracks.map((t) => (t.id === trackId ? { ...t, volume: v } : t)),
  };
}

export function conMezcla(project: Project, trackId: string, cambio: Partial<MezclaPista>): Project {
  return {
    ...project,
    tracks: project.tracks.map((t) =>
      t.id === trackId ? { ...t, mezcla: mezclaDe({ mezcla: { ...mezclaDe(t), ...cambio } }) } : t,
    ),
  };
}

export function conMaster(project: Project, cambio: Partial<AjustesMaster>): Project {
  return { ...project, master: masterDe({ master: { ...masterDe(project), ...cambio } }) };
}

/** Pone un preajuste en una pista. «Sala» y «Catedral» mueven también la reverb compartida. */
export function conPreajusteEn(project: Project, trackId: string, idPreajuste: string): Project {
  const p = preajuste(idPreajuste);
  const pista = project.tracks.find((t) => t.id === trackId);
  if (!p || !pista) return project;
  const siguiente = conMezcla(project, trackId, conPreajuste(mezclaDe(pista), p));
  return p.espacio ? conMaster(siguiente, { espacio: p.espacio }) : siguiente;
}

/**
 * Lo que puede pedir el productor para una pista: valores nuevos, no
 * incrementos (el contexto ya le dice cómo está cada cosa). Lo que viene a
 * null no se toca.
 */
export interface CambioDeMezcla {
  volumenDb?: number | null;
  /** −100 a 100. */
  panorama?: number | null;
  preajuste?: string | null;
  graves?: number | null;
  medios?: number | null;
  agudos?: number | null;
  /** 0 a 100. */
  compresor?: number | null;
  saturacion?: number | null;
  reverb?: number | null;
  eco?: number | null;
}

const porcentaje = (v: number | null | undefined) => (typeof v === 'number' && Number.isFinite(v) ? v / 100 : undefined);
const tal = (v: number | null | undefined) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);

export function aplicarCambio(project: Project, trackId: string, cambio: CambioDeMezcla): Project {
  let siguiente = project;
  // Primero el preajuste, y encima lo concreto: «voz cálida pero con más reverb».
  if (cambio.preajuste) siguiente = conPreajusteEn(siguiente, trackId, cambio.preajuste);
  const parcial: Partial<MezclaPista> = {};
  const pan = porcentaje(cambio.panorama);
  if (pan !== undefined) parcial.panorama = pan;
  for (const banda of ['graves', 'medios', 'agudos'] as const) {
    const v = tal(cambio[banda]);
    if (v !== undefined) parcial[banda] = v;
  }
  for (const efecto of ['compresor', 'saturacion', 'reverb', 'eco'] as const) {
    const v = porcentaje(cambio[efecto]);
    if (v !== undefined) parcial[efecto] = v;
  }
  if (Object.keys(parcial).length) siguiente = conMezcla(siguiente, trackId, parcial);
  const db = tal(cambio.volumenDb);
  if (db !== undefined) siguiente = conVolumen(siguiente, trackId, dbALineal(Math.min(6, Math.max(-60, db))));
  return siguiente;
}
