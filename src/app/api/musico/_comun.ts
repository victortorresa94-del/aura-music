import { ErrorDeProveedor } from '@/lib/ia/tipos';

/**
 * Solo responde a la propia app. No es una cerradura —para eso hacen falta
 * cuentas y un límite por persona, y está en la hoja de ruta—, pero evita que
 * cualquier web ajena use nuestra GPU colgándose de estas rutas.
 */
export function mismoOrigen(request: Request): boolean {
  const origen = request.headers.get('origin');
  if (!origen) return request.headers.get('sec-fetch-site') !== 'cross-site';
  try {
    return new URL(origen).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

export function fallo(error: unknown): Response {
  if (error instanceof ErrorDeProveedor) return json({ error: error.message }, error.status);
  return json({ error: 'Algo ha fallado al hablar con el músico de la nube.' }, 500);
}
