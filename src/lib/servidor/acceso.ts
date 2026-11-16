/**
 * El candado de las rutas que gastan dinero: la GPU de ACE-Step y Claude.
 *
 * La app vive en un enlace público. Sin candado, cualquiera que lo tuviera
 * podría generar pistas en tu GPU o gastar tu clave de Anthropic. Si existe
 * AURA_MUSIC_CODIGO en el servidor, cada petición tiene que traerlo en la
 * cabecera `x-aura-music-codigo`; el móvil lo pide una vez y lo guarda.
 * En local, sin la variable, no hay candado.
 *
 * Tolerante a propósito (17-nov-2026, el dueño: «el mismo código que he
 * puesto en Vercel no funciona»): se ignoran los espacios de los extremos
 * (al pegar en Vercel se cuela uno con facilidad) y las mayúsculas (el
 * teclado del iPhone pone la primera sola). Y viaja codificado, porque una
 * cabecera HTTP no lleva tildes ni eñes tal cual: «Rumba» y «rumbá» llegaban
 * distintos. Pierde algo de entropía; para un candado de enlace compartido,
 * es el equilibrio bueno.
 *
 * No sustituye a las cuentas con límite por persona (en la hoja de ruta):
 * es lo mínimo para enseñar un enlace sin miedo.
 */

import { timingSafeEqual } from 'node:crypto';

export const CABECERA_CODIGO = 'x-aura-music-codigo';

type Entorno = Record<string, string | undefined>;

/** La forma en que se comparan los códigos: sin espacios en los bordes, sin mayúsculas, en NFC. */
export function normalizarCodigo(codigo: string): string {
  return codigo.normalize('NFC').trim().toLocaleLowerCase('es');
}

/** Lo que trae la petición. El móvil lo manda con encodeURIComponent; si no, se lee tal cual. */
function codigoTraido(request: Request): string {
  const crudo = request.headers.get(CABECERA_CODIGO) ?? '';
  try {
    return normalizarCodigo(decodeURIComponent(crudo));
  } catch {
    return normalizarCodigo(crudo);
  }
}

export function hayCandado(env: Entorno = process.env): boolean {
  return normalizarCodigo(env.AURA_MUSIC_CODIGO ?? '') !== '';
}

export function accesoPermitido(request: Request, env: Entorno = process.env): boolean {
  const esperado = normalizarCodigo(env.AURA_MUSIC_CODIGO ?? '');
  if (!esperado) return true;
  const a = Buffer.from(codigoTraido(request), 'utf8');
  const b = Buffer.from(esperado, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

/** La respuesta que hace que el móvil pida el código. */
export function faltaCodigo(): Response {
  return Response.json(
    { error: 'Hace falta el código de acceso.', codigo: true },
    { status: 401, headers: { 'Cache-Control': 'no-store' } },
  );
}
