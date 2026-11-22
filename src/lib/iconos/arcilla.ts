/**
 * Los iconos de arcilla de Aura Music: objetos 3D mate (blanco roto, gris,
 * madera y el salvia de la casa), sin fondo, 256 × 256 en webp, en
 * `public/iconos/arcilla/<id>.webp`. Es el único sitio de la app donde hay
 * 3D: lo demás es plano.
 *
 * Salen de dos hojas 3×3 sobre magenta (22-nov-2026), recortadas con
 * `cortar-hoja.py` de Aura (la celda se mide con `Math.floor(W / 3)`; ver
 * `aura-iconos-app/docs/design/iconos-3d/README.md`). Un id es una clave: no
 * se renombra. Para uno nuevo, otra hoja y una línea aquí.
 */

import type { InstrumentoId } from '@/lib/instrumentos/tipos';

export const IDS_ARCILLA = [
  // Hoja 1
  'bateria',
  'caja-de-ritmos',
  'cajon',
  'congas',
  'piano',
  'sinte',
  'guitarra',
  'bajo',
  'micro',
  // Hoja 2
  'organo',
  'violin',
  'marimba',
  'contrabajo',
  'loops',
  'mezclador',
  'productor',
  'cascos',
  'altavoz',
] as const;

export type IdArcilla = (typeof IDS_ARCILLA)[number];

export const urlArcilla = (id: IdArcilla) => `/iconos/arcilla/${id}.webp`;

/**
 * El icono de cada instrumento de «Tocar». Los que no tienen objeto propio
 * todavía llevan el más cercano: el piano eléctrico y el pad, el sinte; los
 * metales, el altavoz (pendiente: una hoja con trompeta, Rhodes y pad).
 */
export const ARCILLA_DE_INSTRUMENTO: Record<InstrumentoId, IdArcilla> = {
  'bateria-acustica': 'bateria',
  'bateria-808': 'caja-de-ritmos',
  'bateria-909': 'caja-de-ritmos',
  cajon: 'cajon',
  'percusion-latina': 'congas',
  piano: 'piano',
  'piano-electrico': 'sinte',
  organo: 'organo',
  'organo-electrico': 'organo',
  cuerdas: 'violin',
  pizzicato: 'violin',
  metales: 'altavoz',
  marimba: 'marimba',
  pad: 'sinte',
  sinte: 'sinte',
  guitarra: 'guitarra',
  'guitarra-acero': 'guitarra',
  'bajo-dedos': 'bajo',
  'bajo-pua': 'bajo',
  contrabajo: 'contrabajo',
  'bajo-sub': 'altavoz',
  'bajo-808': 'caja-de-ritmos',
  'bajo-analogico': 'sinte',
  bajo: 'bajo',
};

/** Las pestañas de «Tocar» (y cualquier sitio que hable de una familia entera). */
export const ARCILLA_DE_FAMILIA = {
  pads: 'bateria',
  teclado: 'piano',
  acordes: 'guitarra',
  bajo: 'bajo',
  loops: 'loops',
} as const satisfies Record<string, IdArcilla>;

/** El de un instrumento, con uno neutro si llegara un id que no conocemos. */
export function arcillaDe(instrumento: string): IdArcilla {
  return (ARCILLA_DE_INSTRUMENTO as Record<string, IdArcilla>)[instrumento] ?? 'altavoz';
}
