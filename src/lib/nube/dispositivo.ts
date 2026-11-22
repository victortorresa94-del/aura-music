/**
 * Cómo se llama este dispositivo para las personas, y su id.
 *
 * El nombre sale en el aviso de «ha cambiado en el iPhone» y en las copias de
 * un choque («copia del PC»). Corto y reconocible: nadie sabe qué es
 * «Chrome 142 en Windows NT 10.0».
 */

import type { Dispositivo } from './tipos';

const CLAVE_ID = 'aura-music:dispositivo';

export function nombreDelDispositivo(ua: string, puntosTactiles = 0): string {
  if (/iPhone|iPod/.test(ua)) return 'iPhone';
  // iPadOS se presenta como un Mac; se delata por la pantalla táctil.
  if (/iPad/.test(ua) || (/Macintosh/.test(ua) && puntosTactiles > 1)) return 'iPad';
  if (/Android/.test(ua)) return /Mobile/.test(ua) ? 'móvil Android' : 'tableta Android';
  if (/Macintosh|Mac OS X/.test(ua)) return 'Mac';
  if (/Windows|Linux|CrOS/.test(ua)) return 'PC';
  return 'otro dispositivo';
}

export function esteDispositivo(): Dispositivo {
  const nombre =
    typeof navigator === 'undefined' ? 'otro dispositivo' : nombreDelDispositivo(navigator.userAgent, navigator.maxTouchPoints);
  let id = '';
  try {
    id = window.localStorage.getItem(CLAVE_ID) ?? '';
    if (!id) {
      id = `dsp_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
      window.localStorage.setItem(CLAVE_ID, id);
    }
  } catch {
    id = id || 'dsp_sin_almacen';
  }
  return { id, nombre };
}
