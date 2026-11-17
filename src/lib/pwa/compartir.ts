/**
 * Audios que llegan por «Compartir» desde otra app (Android).
 *
 * El manifest declara un `share_target`: al compartir una nota de voz de
 * WhatsApp, Android abre la app con un POST a `/compartir` y el audio dentro.
 * Ese POST no llega al servidor: lo recoge el service worker, guarda el
 * fichero en su caché y redirige a `/?compartido=1`. La app lo lee de ahí y
 * ofrece meterlo en la idea con un toque (el toque hace falta: sin él el
 * navegador no deja arrancar el audio para decodificarlo).
 *
 * En iPhone no existe: las webs instaladas no salen en la hoja de compartir.
 */

import { CACHES } from './caches';

/** Campo del formulario con los ficheros (igual que en el manifest). */
export const CAMPO_AUDIO = 'audio';

export type ResultadoCompartir = 'recibido' | 'vacio' | 'error' | 'sin-app';

/** Lee `?compartido=…` de la URL con la que se abre la app. */
export function leerCompartido(search: string): ResultadoCompartir | null {
  const valor = new URLSearchParams(search).get('compartido');
  if (valor === '1') return 'recibido';
  if (valor === 'vacio' || valor === 'error' || valor === 'sin-app') return valor;
  return null;
}

const CLAVE = (i: number) => `/compartido/${i}`;

/**
 * Lo que hace el service worker con el POST. Guarda los audios y redirige
 * con 303 para que la app se abra con un GET normal (y recargar no reenvíe).
 */
export async function recibirCompartido(request: Request): Promise<Response> {
  try {
    const datos = await request.formData();
    const ficheros = datos
      .getAll(CAMPO_AUDIO)
      .filter((valor): valor is File => typeof valor !== 'string' && valor.size > 0);
    const cache = await caches.open(CACHES.compartido);
    // Solo lo último que se compartió: lo de antes ya se metió o se descartó.
    for (const clave of await cache.keys()) await cache.delete(clave);
    for (const [i, fichero] of ficheros.entries()) {
      await cache.put(
        CLAVE(i),
        new Response(fichero, {
          headers: {
            'Content-Type': fichero.type || 'application/octet-stream',
            // Las cabeceras solo admiten ASCII: el nombre va codificado.
            'X-Nombre': encodeURIComponent(fichero.name || `audio-${i + 1}`),
          },
        }),
      );
    }
    return Response.redirect(ficheros.length > 0 ? '/?compartido=1' : '/?compartido=vacio', 303);
  } catch {
    return Response.redirect('/?compartido=error', 303);
  }
}

/** En la app: los audios que dejó el worker, como ficheros normales. */
export async function audiosCompartidos(): Promise<File[]> {
  if (typeof caches === 'undefined') return [];
  try {
    const cache = await caches.open(CACHES.compartido);
    const claves = await cache.keys();
    const ficheros: File[] = [];
    for (const clave of claves) {
      const respuesta = await cache.match(clave);
      if (!respuesta) continue;
      const blob = await respuesta.blob();
      const nombre = decodeURIComponent(respuesta.headers.get('X-Nombre') ?? 'audio');
      ficheros.push(new File([blob], nombre, { type: blob.type }));
    }
    return ficheros;
  } catch {
    return [];
  }
}

export async function olvidarCompartidos(): Promise<void> {
  if (typeof caches === 'undefined') return;
  try {
    await caches.delete(CACHES.compartido);
  } catch {
    /* si no se puede borrar, se pisa en el siguiente compartir */
  }
}
