/**
 * Qué hacer con cada idea: subirla, bajarla, borrarla o resolver un choque.
 *
 * Se decide con tres datos: cómo está aquí, cómo está en la nube y la «base»,
 * la versión en la que los dos estuvieron de acuerdo la última vez. Con la
 * base se sabe QUIÉN ha cambiado: si solo uno, gana ese sin discusión; si los
 * dos, es un choque y gana la modificación más reciente.
 *
 * Lo que no se negocia: perder una toma. Por eso
 *   · si la versión que pierde un choque tenía audios que la ganadora no
 *     tiene, se guarda aparte como copia («Bulería · copia del iPhone»);
 *   · un borrado que llega de otro dispositivo no se lleva por delante
 *     cambios de aquí que aún no han subido: la idea vuelve;
 *   · un audio de la nube que ya no usa nadie no se borra hasta pasados 30
 *     días (por si un dispositivo que estaba sin red vuelve con él).
 *
 * Todo puro, con tests en `nube.test.ts`.
 */

import { audiosDePista } from '@/lib/daw/cuadrar/toma';
import type { Project } from '@/lib/daw/types';

/** Lo que importa de una versión para decidir. */
export interface Version {
  updatedAt: number;
  buffers: string[];
}

export interface VersionRemota extends Version {
  borrado: boolean;
}

export type Accion =
  | { tipo: 'nada' }
  | { tipo: 'subir' }
  | { tipo: 'bajar' }
  | { tipo: 'borrar-local' }
  | { tipo: 'subir-borrado' }
  | { tipo: 'choque'; gana: 'local' | 'remoto'; copia: boolean };

/**
 * Los audios de una idea, sin repetir (dos pistas pueden compartir uno). Con
 * los de una toma cuadrada al tempo, también la versión que no suena: la
 * original no se borra nunca (`cuadrar/toma.ts`) y tiene que viajar con la idea.
 */
export function buffersDe(proyecto: Pick<Project, 'tracks'>): string[] {
  return [...new Set(proyecto.tracks.flatMap((pista) => audiosDePista(pista)))];
}

/** ¿Tiene `a` algún audio que `b` no tiene? */
export function tieneAudiosPropios(a: Version, b: Version | null): boolean {
  if (!b) return a.buffers.length > 0;
  const deB = new Set(b.buffers);
  return a.buffers.some((id) => !deB.has(id));
}

/**
 * La decisión para una idea.
 *
 * @param local      cómo está en este dispositivo (`null` si no está).
 * @param borradoAqui hora a la que se borró aquí, si el borrado aún no ha subido.
 * @param remoto     cómo está en la nube (`null` si no está).
 * @param base       la `updatedAt` en la que coincidieron por última vez.
 */
export function decidir(
  local: Version | null,
  borradoAqui: number | null,
  remoto: VersionRemota | null,
  base: number | undefined,
): Accion {
  if (!local) {
    if (borradoAqui !== null) {
      // La borraste aquí. Si en otro sitio la tocaron DESPUÉS, gana lo más
      // reciente: vuelve, con lo que hicieran allí.
      if (remoto && !remoto.borrado && remoto.updatedAt > borradoAqui) return { tipo: 'bajar' };
      if (remoto?.borrado) return { tipo: 'nada' };
      return remoto ? { tipo: 'subir-borrado' } : { tipo: 'nada' };
    }
    if (!remoto || remoto.borrado) return { tipo: 'nada' };
    return { tipo: 'bajar' };
  }

  if (!remoto) return { tipo: 'subir' };

  const cambioLocal = base === undefined || local.updatedAt !== base;

  if (remoto.borrado) {
    // Borrada en otro dispositivo. Si aquí tiene cambios que no han subido,
    // vuelve a la nube con ellos; si no, se borra también aquí.
    if (cambioLocal) return { tipo: 'subir' };
    return remoto.updatedAt >= local.updatedAt ? { tipo: 'borrar-local' } : { tipo: 'subir' };
  }

  if (local.updatedAt === remoto.updatedAt) return { tipo: 'nada' };

  const cambioRemoto = base === undefined || remoto.updatedAt !== base;
  if (cambioLocal && !cambioRemoto) return { tipo: 'subir' };
  if (!cambioLocal && cambioRemoto) return { tipo: 'bajar' };

  // Las dos han cambiado: gana la última modificación.
  const gana = local.updatedAt >= remoto.updatedAt ? 'local' : 'remoto';
  const perdedora = gana === 'local' ? remoto : local;
  const ganadora = gana === 'local' ? local : remoto;
  return { tipo: 'choque', gana, copia: tieneAudiosPropios(perdedora, ganadora) };
}

/** «iPhone» → «Bulería · copia del iPhone». */
export function nombreDeCopia(nombre: string, dispositivo: string): string {
  const limpio = nombre.replace(/ · copia del .+$/, '');
  return `${limpio} · copia del ${dispositivo}`.slice(0, 80);
}

/**
 * La versión que pierde un choque, guardada aparte con otro id. Comparte los
 * audios con la ganadora: un audio solo se borra cuando no lo usa ninguna
 * idea (ver `storage.deleteProject`).
 */
export function copiaDeLaPerdedora(
  perdedora: Project,
  dispositivo: string,
  ahora: number,
  nuevoId: () => string,
): Project {
  return { ...perdedora, id: nuevoId(), name: nombreDeCopia(perdedora.name, dispositivo), updatedAt: ahora };
}

/* -------------------------------------------------------------------------- */
/* Limpieza del audio de la nube                                               */
/* -------------------------------------------------------------------------- */

/** Un audio que nadie usa se queda este tiempo antes de borrarse. */
export const ESPERA_ANTES_DE_BORRAR = 30 * 24 * 60 * 60 * 1000;

export interface Limpieza {
  /** Los huérfanos que quedan apuntados (con su hora), para escribirlos en la idea. */
  huerfanos: Record<string, number>;
  /** Los que ya se pueden borrar. */
  borrar: string[];
  /** Ha cambiado lo apuntado y hay que escribirlo. */
  cambia: boolean;
}

/**
 * La carpeta de una idea en la nube. `enLaCarpeta`: lo que hay en Storage;
 * `enUso`: los audios que usa CUALQUIER idea que conozcamos (de aquí o de la
 * nube). Un audio sin uso se apunta como huérfano; si vuelve a usarse, se
 * desapunta; y solo se borra si lleva 30 días huérfano.
 */
export function decidirLimpieza(
  enLaCarpeta: string[],
  enUso: Set<string>,
  huerfanos: Record<string, number>,
  ahora: number,
): Limpieza {
  const siguen: Record<string, number> = {};
  const borrar: string[] = [];
  for (const id of enLaCarpeta) {
    if (enUso.has(id)) continue;
    const desde = huerfanos[id] ?? ahora;
    if (ahora - desde >= ESPERA_ANTES_DE_BORRAR) borrar.push(id);
    else siguen[id] = desde;
  }
  const antes = Object.keys(huerfanos).sort().join('|');
  const despues = Object.keys(siguen).sort().join('|');
  return { huerfanos: siguen, borrar, cambia: antes !== despues || borrar.length > 0 };
}

/** ¿El audio de una idea borrada ya se puede quitar de la nube? */
export function sePuedeVaciar(remoto: Pick<VersionRemota, 'borrado' | 'updatedAt'> & { audioBorrado: boolean }, ahora: number): boolean {
  return remoto.borrado && !remoto.audioBorrado && ahora - remoto.updatedAt >= ESPERA_ANTES_DE_BORRAR;
}
