/**
 * Las reglas de la biblioteca, puras: crear una canción, añadirle versiones,
 * «Me la quedo», qué versión suena y qué borradores se limpian.
 *
 * La unidad no es la generación sino la canción que te quedas (plan, parte 0):
 * una canción nace como borrador con su v1, se retoca con versiones y entra en
 * la biblioteca al pulsar «Me la quedo». Lo que no te quedas se limpia a los
 * 30 días, como la nube del estudio (decisión 0023).
 */

import type { Almacen } from './almacen';
import type { Cancion, Portada, Receta, Version } from './tipos';

export const DIAS_BORRADOR = 30;
const DIA_MS = 24 * 60 * 60 * 1000;

/** Un id corto, único y que ordena por fecha: «can_m1x2y3_ab12». */
export function nuevoId(prefijo: string, ahora = Date.now()): string {
  const azar = Math.random().toString(36).slice(2, 8);
  return `${prefijo}_${ahora.toString(36)}_${azar}`;
}

/** Una semilla estable a partir de un texto: la misma canción, la misma portada. */
export function semillaDe(texto: string): number {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function portadaGenerativa(texto: string): Portada {
  return { tipo: 'generativa', semilla: semillaDe(texto) };
}

export function nuevaCancion(
  receta: Receta,
  datos: { titulo: string; porque?: string; ahora?: number; id?: string },
): Cancion {
  const ahora = datos.ahora ?? Date.now();
  const id = datos.id ?? nuevoId('can', ahora);
  return {
    id,
    titulo: datos.titulo.trim() || 'Sin título',
    ...(datos.porque ? { porque: datos.porque } : {}),
    tipo: receta.tipo,
    ...(receta.artistaId ? { artistaId: receta.artistaId } : {}),
    portada: portadaGenerativa(`${id}:${datos.titulo}`),
    guardada: false,
    creadaEn: ahora,
    actualizadaEn: ahora,
    escuchas: 0,
    origen: 'bolsillo',
  };
}

/** La versión siguiente de una canción, todavía generándose. */
export function nuevaVersion(
  cancion: Cancion,
  anteriores: Version[],
  receta: Receta,
  datos: { cambio: string; creditos: number; ahora?: number; id?: string },
): Version {
  const ahora = datos.ahora ?? Date.now();
  const n = anteriores.filter((v) => v.cancionId === cancion.id).reduce((max, v) => Math.max(max, v.n), 0) + 1;
  return {
    id: datos.id ?? nuevoId('ver', ahora),
    cancionId: cancion.id,
    n,
    creadaEn: ahora,
    receta,
    cambio: datos.cambio,
    estado: 'generando',
    creditos: datos.creditos,
    motor: receta.motor,
    ...(receta.tipo === 'paisaje' ? { bucle: true } : {}),
  };
}

/** Las versiones de una canción, de la primera a la última. */
export function versionesDe(cancionId: string, versiones: Version[]): Version[] {
  return versiones.filter((v) => v.cancionId === cancionId).sort((a, b) => a.n - b.n);
}

/** La que suena al tocar la canción: la elegida y, si no hay, la última que esté lista. */
export function versionQueSuena(cancion: Cancion, versiones: Version[]): Version | null {
  const suyas = versionesDe(cancion.id, versiones);
  const elegida = suyas.find((v) => v.id === cancion.versionElegida && v.estado === 'lista');
  if (elegida) return elegida;
  const listas = suyas.filter((v) => v.estado === 'lista');
  return listas.length ? listas[listas.length - 1] : null;
}

/** «Me la quedo»: la canción entra en la biblioteca con esa versión. */
export function quedarme(cancion: Cancion, versionId: string, ahora = Date.now()): Cancion {
  return { ...cancion, guardada: true, versionElegida: versionId, actualizadaEn: ahora };
}

/** Una escucha más (cuenta para el Inicio y para «Tu año»). */
export function conEscucha(cancion: Cancion, ahora = Date.now()): Cancion {
  return { ...cancion, escuchas: cancion.escuchas + 1, ultimaEscucha: ahora };
}

/** Los borradores que llevan 30 días sin tocarse y no están en ninguna playlist. */
export function borradoresCaducados(
  canciones: Cancion[],
  enPlaylists: ReadonlySet<string>,
  ahora = Date.now(),
): Cancion[] {
  return canciones.filter(
    (c) => !c.guardada && !enPlaylists.has(c.id) && ahora - c.actualizadaEn > DIAS_BORRADOR * DIA_MS,
  );
}

/** Las de la biblioteca (guardadas), lo último tocado primero. */
export function guardadasRecientes(canciones: Cancion[]): Cancion[] {
  return canciones
    .filter((c) => c.guardada)
    .sort((a, b) => (b.ultimaEscucha ?? b.actualizadaEn) - (a.ultimaEscucha ?? a.actualizadaEn));
}

/**
 * Borra una canción con TODO lo suyo: versiones y audios. Un audio huérfano
 * ocupa el móvil para siempre sin que nadie lo vea.
 */
export async function borrarCancionEntera(almacen: Almacen, cancionId: string): Promise<void> {
  const versiones = (await almacen.versiones.todos()).filter((v) => v.cancionId === cancionId);
  for (const v of versiones) {
    if (v.audioId) await almacen.audios.borrar(v.audioId);
    await almacen.versiones.borrar(v.id);
  }
  await almacen.canciones.borrar(cancionId);
}
