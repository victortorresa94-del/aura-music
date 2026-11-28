/**
 * La portada generativa como imagen, para la pantalla de bloqueo.
 *
 * Media Session necesita una imagen de verdad (un PNG), y la portada de
 * bolsillo es un SVG que pinta el kit (`Portada` en `components/bolsillo/kit.tsx`)
 * a partir de una semilla. Aquí está la MISMA cuenta (`manchasDePortada`) y un
 * dibujo en canvas que la imita: fondo, tres manchas de color apagado y su
 * desenfoque hecho con degradados (el `filter` del canvas no existe en todos
 * los Safari).
 *
 * ⚠️ El kit tiene su propia copia de la cuenta. Si cambia allí, cambia aquí, o
 * la pantalla de bloqueo enseñará otra portada que la app (lo vigila el test
 * comparando con los valores del kit).
 */

import type { Portada } from '../tipos';

/** El mismo generador que el kit: la misma semilla, la misma portada. */
function azar(semilla: number) {
  let s = semilla >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 10000) / 10000;
  };
}

export interface Mancha {
  /** Centro y radio en un lienzo de 100 × 100. */
  x: number;
  y: number;
  r: number;
  h: number;
  s: number;
  l: number;
}

export interface DibujoPortada {
  fondo: { h: number; s: number; l: number };
  manchas: Mancha[];
}

/** La cuenta del kit, en datos: el tono del fondo y las tres manchas. */
export function manchasDePortada(semilla: number): DibujoPortada {
  const a = azar(semilla);
  const tono = Math.floor(a() * 360);
  const manchas = [0, 1, 2].map((i) => {
    const x = 15 + a() * 70;
    const y = 15 + a() * 70;
    const r = 28 + a() * 34;
    const h = (tono + 40 * i + Math.floor(a() * 60)) % 360;
    const s = 22 + a() * 18;
    const l = 48 + a() * 22;
    return { x, y, r, h, s, l };
  });
  return { fondo: { h: tono, s: 18, l: 86 }, manchas };
}

/** Desviación del desenfoque del kit (`stdDeviation="9"` sobre 100). */
const DESENFOQUE = 9;
const OPACIDAD = 0.85;

const cache = new Map<string, string>();

/**
 * La portada como PNG (`data:`), lista para `MediaMetadata.artwork`. Una
 * portada de imagen se devuelve tal cual. Sin canvas (fuera del navegador),
 * null.
 */
export function portadaComoPng(portada: Portada, tam = 512): string | null {
  if (portada.tipo === 'imagen') return portada.url;
  const clave = `${portada.semilla}:${tam}`;
  const ya = cache.get(clave);
  if (ya) return ya;
  if (typeof document === 'undefined') return null;
  try {
    const lienzo = document.createElement('canvas');
    lienzo.width = tam;
    lienzo.height = tam;
    const ctx = lienzo.getContext('2d');
    if (!ctx) return null;
    const { fondo, manchas } = manchasDePortada(portada.semilla);
    const k = tam / 100;
    ctx.fillStyle = `hsl(${fondo.h} ${fondo.s}% ${fondo.l}%)`;
    ctx.fillRect(0, 0, tam, tam);
    for (const m of manchas) {
      // Un círculo desenfocado: lleno hasta 2σ antes del borde y nada a 2σ fuera.
      const dentro = Math.max(0, m.r - 2 * DESENFOQUE) * k;
      const fuera = (m.r + 2 * DESENFOQUE) * k;
      const g = ctx.createRadialGradient(m.x * k, m.y * k, dentro, m.x * k, m.y * k, fuera);
      const color = (alfa: number) => `hsla(${m.h}, ${m.s}%, ${m.l}%, ${alfa})`;
      g.addColorStop(0, color(OPACIDAD));
      g.addColorStop(0.5, color(OPACIDAD / 2));
      g.addColorStop(1, color(0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, tam, tam);
    }
    const url = lienzo.toDataURL('image/png');
    cache.set(clave, url);
    return url;
  } catch {
    return null;
  }
}
