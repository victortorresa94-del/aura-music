/**
 * El candado de las rutas que gastan dinero: la GPU de ACE-Step y Claude.
 *
 * La app vive en un enlace público. Sin candado, cualquiera que lo tuviera
 * podría generar pistas en tu GPU o gastar tu clave de Anthropic. Si existe
 * AURA_MUSIC_CODIGO en el servidor, cada petición tiene que traerlo en la
 * cabecera `x-aura-music-codigo`; el móvil lo pide una vez y lo guarda.
 * En local, sin la variable, no hay candado.
 *
 * No sustituye a las cuentas con límite por persona (en la hoja de ruta):
 * es lo mínimo para enseñar un enlace sin miedo.
 */

import { timingSafeEqual } from 'node:crypto';

export const CABECERA_CODIGO = 'x-aura-music-codigo';

type Entorno = Record<string, string | undefined>;

export function hayCandado(env: Entorno = process.env): boolean {
  return Boolean(env.AURA_MUSIC_CODIGO);
}

export function accesoPermitido(request: Request, env: Entorno = process.env): boolean {
  const esperado = env.AURA_MUSIC_CODIGO;
  if (!esperado) return true;
  const traido = request.headers.get(CABECERA_CODIGO) ?? '';
  const a = Buffer.from(traido);
  const b = Buffer.from(esperado);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** La respuesta que hace que el móvil pida el código. */
export function faltaCodigo(): Response {
  return Response.json(
    { error: 'Hace falta el código de acceso.', codigo: true },
    { status: 401, headers: { 'Cache-Control': 'no-store' } },
  );
}
