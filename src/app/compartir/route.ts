/**
 * `/compartir` en el servidor. Normalmente el POST de «Compartir» de Android
 * lo recoge el service worker y no llega aquí (ver `src/lib/pwa/compartir.ts`).
 * Si llega es que el worker aún no manda (la app recién instalada y sin abrir):
 * se abre la app y se avisa de que hay que volver a compartir, en vez de un 405.
 */

export function POST(request: Request) {
  return Response.redirect(new URL('/?compartido=sin-app', request.url), 303);
}

export function GET(request: Request) {
  return Response.redirect(new URL('/', request.url), 303);
}
