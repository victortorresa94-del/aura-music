/**
 * «Traer mis canciones de aura Studio»: lee tus pistas de Music Studio, mete
 * en la biblioteca las que no estaban y baja su audio al móvil para que
 * suenen sin red.
 *
 * - **No duplica.** Una canción traída lleva `idOrigen` (el id de la pista en
 *   aura Studio) y sus ids salen de la pista (`idsDePista`): traerla otra vez
 *   no hace nada, y dos «Traer» a la vez escriben lo mismo encima.
 * - **La canción se escribe la última.** Primero el audio, luego la versión y
 *   al final la canción, que es la que la hace aparecer y la que dice «ya
 *   está traída». Si la app se cierra a medias, la siguiente vez se termina.
 * - **El audio, si se deja.** Se baja con `fetch` desde el navegador; si el
 *   almacenamiento de aura no permite esta web (CORS, paso 2 de
 *   docs/CUENTA.md) o no hay sitio en el móvil, la canción entra igual con su
 *   enlace (`urlRemota`) y suena con red. Las que se quedaron así se vuelven a
 *   intentar en el siguiente «Traer».
 */

import type { DocDeAuraStudio } from '@/lib/nube/firebase';
import type { Almacen } from '../almacen';
import type { Version } from '../tipos';
import { TEXTO_SIN_RED } from '../cuenta';
import { cancionDePista, idsDePista, leerPista, tipoDeAudio } from './deAuraStudio';

/** Un documento de `users/{uid}/studioAudios`, crudo (`Conexion.leerPistasDeAuraStudio`). */
export type { DocDeAuraStudio };

/**
 * Baja un audio. Devuelve `null` si el servidor contesta pero no con audio;
 * LANZA si ni siquiera contesta (sin red, o el navegador lo bloquea por CORS).
 */
export type Bajar = (url: string) => Promise<Blob | null>;

export interface ResultadoImportar {
  /** Las que han entrado ahora en la biblioteca. */
  nuevas: number;
  /** Las que ya estaban de otra vez: no se repiten. */
  yaEstaban: number;
  /** Traídas (ahora o antes) que siguen sin audio en el móvil: suenan, pero solo con red. */
  soloConRed: number;
  /** Traídas antes sin audio que ahora sí se han bajado. */
  bajadasAhora: number;
  /** Si no se ha podido terminar, por qué. Lo que entró antes del fallo se queda. */
  error?: string;
}

export interface OpcionesImportar {
  almacen: Almacen;
  leer: () => Promise<DocDeAuraStudio[]>;
  bajar?: Bajar;
  ahora?: number;
  /** Para enseñar «Trayendo 2 de 5». */
  alAvanzar?: (hechas: number, total: number) => void;
}

/** Un audio de más de esto no se baja: se escucha con red. Una canción de Lyria son unos 4 MB. */
const MAX_BYTES = 80 * 1024 * 1024;

/** El `fetch` del navegador, con tope de tiempo y comprobando que lo que llega es audio. */
export async function bajarAudio(url: string, esperaMs = 90_000): Promise<Blob | null> {
  const corte = new AbortController();
  const reloj = setTimeout(() => corte.abort(), esperaMs);
  try {
    const r = await fetch(url, { mode: 'cors', credentials: 'omit', signal: corte.signal });
    if (!r.ok) return null;
    const largo = Number(r.headers.get('content-length'));
    if (Number.isFinite(largo) && largo > MAX_BYTES) return null;
    const blob = await r.blob();
    if (!blob.size || blob.size > MAX_BYTES) return null;
    // Una página de error con 200 no es una canción.
    if (/^(text\/|application\/json)/i.test(blob.type)) return null;
    const tipo = blob.type.startsWith('audio/') ? blob.type : tipoDeAudio(url);
    return blob.type === tipo ? blob : new Blob([blob], { type: tipo });
  } finally {
    clearTimeout(reloj);
  }
}

/** Por qué no se han podido leer tus pistas, para una persona. */
export function textoDelFalloAlLeer(error: unknown): string {
  const codigo = (error as { code?: string } | null)?.code ?? '';
  if (/permission-denied|unauthenticated/.test(codigo)) {
    return 'aura Studio no me deja leer tus canciones con esta cuenta. Sal y vuelve a entrar.';
  }
  const sinRed = typeof navigator !== 'undefined' && navigator.onLine === false;
  if (sinRed || /unavailable|deadline-exceeded|network/.test(codigo) || error instanceof TypeError) return TEXTO_SIN_RED;
  return 'No he podido leer tus canciones de aura Studio. Vuelve a probar en un rato.';
}

function hostDe(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

export async function traerDeAuraStudio(opciones: OpcionesImportar): Promise<ResultadoImportar> {
  const { almacen } = opciones;
  const bajar = opciones.bajar ?? ((url: string) => bajarAudio(url));
  const ahora = opciones.ahora ?? Date.now();
  const resultado: ResultadoImportar = { nuevas: 0, yaEstaban: 0, soloConRed: 0, bajadasAhora: 0 };

  let docs: DocDeAuraStudio[];
  try {
    docs = await opciones.leer();
  } catch (error) {
    return { ...resultado, error: textoDelFalloAlLeer(error) };
  }

  // De la más vieja a la más nueva: si se corta a medias, lo que falta es lo último.
  const pistas = docs
    .map((d) => leerPista(d.id, d.datos, ahora))
    .filter((p): p is NonNullable<typeof p> => p !== null)
    .sort((a, b) => a.createdAt - b.createdAt);

  // Un CORS que falla falla para todo lo de ese sitio: se deja de probar allí,
  // en vez de esperar a cada canción para saber lo mismo.
  const sitiosQueNoDejan = new Set<string>();
  const bajarUno = async (url: string): Promise<Blob | null> => {
    const sitio = hostDe(url);
    if (sitiosQueNoDejan.has(sitio)) return null;
    try {
      return await bajar(url);
    } catch {
      sitiosQueNoDejan.add(sitio);
      return null;
    }
  };
  /** Guarda el audio en el móvil; si no hay sitio, la canción se queda con su enlace. */
  const guardarAudio = async (id: string, blob: Blob): Promise<boolean> => {
    try {
      await almacen.audios.poner(id, blob);
      return true;
    } catch {
      return false;
    }
  };

  try {
    const traidas = new Map<string, { versionElegida?: string }>();
    for (const c of await almacen.canciones.todos()) {
      if (c.origen === 'aura-studio' && c.idOrigen) traidas.set(c.idOrigen, c);
    }

    const nuevas = pistas.filter((p) => !traidas.has(p.id));
    resultado.yaEstaban = pistas.length - nuevas.length;

    // Las traídas antes que se quedaron sin audio: otra oportunidad (quizá ya está el CORS).
    const sinAudio: Version[] = [];
    for (const p of pistas) {
      const traida = traidas.get(p.id);
      if (!traida?.versionElegida) continue;
      const v = await almacen.versiones.leer(traida.versionElegida);
      if (v && v.estado === 'lista' && !v.audioId && v.urlRemota) sinAudio.push(v);
    }

    const total = nuevas.length + sinAudio.length;
    let hechas = 0;
    opciones.alAvanzar?.(hechas, total);

    for (const pista of nuevas) {
      const { cancion, version } = cancionDePista(pista);
      const blob = await bajarUno(pista.url);
      const conAudio = blob ? await guardarAudio(idsDePista(pista).audio, blob) : false;
      const lista: Version = conAudio ? { ...version, audioId: idsDePista(pista).audio } : version;
      await almacen.versiones.poner(lista);
      await almacen.canciones.poner(cancion);
      resultado.nuevas += 1;
      if (!conAudio) resultado.soloConRed += 1;
      opciones.alAvanzar?.(++hechas, total);
    }

    for (const v of sinAudio) {
      const audioId = `aud_${v.id.replace(/^ver_/, '')}`;
      const blob = await bajarUno(v.urlRemota!);
      if (blob && (await guardarAudio(audioId, blob))) {
        await almacen.versiones.poner({ ...v, audioId });
        resultado.bajadasAhora += 1;
      } else {
        resultado.soloConRed += 1;
      }
      opciones.alAvanzar?.(++hechas, total);
    }
  } catch {
    // Lo que falla aquí es el almacén del móvil (sin sitio, o bloqueado por otra pestaña).
    return { ...resultado, error: 'No he podido guardar en el móvil. Libera espacio o cierra otras pestañas de aura Music.' };
  }

  return resultado;
}

/** Lo que se dice al terminar: «He traído 3 canciones», y si alguna solo suena con red. */
export function textoDelResultado(r: ResultadoImportar): string {
  const partes: string[] = [];
  if (r.nuevas > 0) partes.push(r.nuevas === 1 ? 'He traído 1 canción.' : `He traído ${r.nuevas} canciones.`);
  else if (r.yaEstaban > 0) partes.push('Ya tenías todas tus canciones de aura Studio.');
  else if (!r.error) partes.push('No hay canciones tuyas en Music Studio todavía.');
  if (r.bajadasAhora > 0) {
    partes.push(r.bajadasAhora === 1 ? 'Y 1 que ya tenías ahora suena sin red.' : `Y ${r.bajadasAhora} que ya tenías ahora suenan sin red.`);
  }
  if (r.soloConRed > 0) {
    partes.push(
      r.soloConRed === 1
        ? '1 suena solo con red: no he podido bajarla al móvil.'
        : `${r.soloConRed} suenan solo con red: no he podido bajarlas al móvil.`,
    );
  }
  if (r.error) partes.push(r.error);
  return partes.join(' ');
}
