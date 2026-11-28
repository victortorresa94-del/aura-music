/// <reference lib="webworker" />
/**
 * Service worker de Aura Music (Serwist).
 *
 * La regla de la casa es que lo que suena al tocar va en local; este worker
 * hace que también la app entera abra sin cobertura una vez visitada, que es
 * justo cuando más falta hace poder grabar una idea.
 *
 *   · La app y sus trozos de `_next/static` se guardan al instalar (precache
 *     con versión: cada compilación trae su lista).
 *   · Páginas: red primero, con 3 s de margen; si no llega, la última copia, y
 *     si no hay, la app guardada al instalar: la del estudio para `/` y la de
 *     bolsillo para `/escuchar` (son dos apps; ver `esRutaEscuchar`).
 *   · Estáticos, letras e iconos: caché primero.
 *   · `/api/*`: siempre red. El músico y el productor responden en vivo.
 *
 * Sin `skipWaiting` automático: la versión nueva espera a que la app diga
 * «Actualizar» (ver `src/lib/pwa/actualizacion.ts`).
 */

import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist';
import { CacheFirst, ExpirationPlugin, NetworkFirst, NetworkOnly, Serwist } from 'serwist';
import { CACHES, cachesQueSobran, esRutaEscuchar, RUTA_COMPARTIR, URL_APP_GUARDADA, URL_ESCUCHAR_GUARDADA } from '../lib/pwa/caches';
import { recibirCompartido } from '../lib/pwa/compartir';

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const DIA = 24 * 60 * 60;

/**
 * Las páginas se guardan por su ruta, sin parámetros: `/?grabar=1` (el atajo
 * del icono) tiene que abrir sin red aunque nunca se haya abierto así.
 */
const sinParametros = {
  cacheKeyWillBeUsed: async ({ request }: { request: Request }) => {
    const url = new URL(request.url);
    return `${url.origin}${url.pathname}`;
  },
};

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  precacheOptions: { cleanupOutdatedCaches: true },
  skipWaiting: false,
  clientsClaim: true,
  navigationPreload: true,
  disableDevLogs: true,
  runtimeCaching: [
    {
      matcher: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith('/api/'),
      handler: new NetworkOnly(),
    },
    {
      // Cuenta (pilar D): las páginas de entrar con Google (`/__/auth/*`, el
      // proxy a Firebase de next.config.ts) van siempre a la red y no se guardan.
      matcher: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith('/__/'),
      handler: new NetworkOnly(),
    },
    {
      matcher: ({ request, sameOrigin }) => sameOrigin && request.mode === 'navigate',
      handler: new NetworkFirst({
        cacheName: CACHES.paginas,
        networkTimeoutSeconds: 3,
        plugins: [sinParametros, new ExpirationPlugin({ maxEntries: 8 })],
      }),
    },
    {
      matcher: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith('/_next/static/'),
      handler: new CacheFirst({
        cacheName: CACHES.estaticos,
        plugins: [new ExpirationPlugin({ maxEntries: 300, maxAgeSeconds: 60 * DIA })],
      }),
    },
    {
      matcher: ({ request }) => request.destination === 'font',
      handler: new CacheFirst({
        cacheName: CACHES.letras,
        plugins: [new ExpirationPlugin({ maxEntries: 12, maxAgeSeconds: 365 * DIA })],
      }),
    },
    {
      matcher: ({ request, url, sameOrigin }) =>
        sameOrigin && (request.destination === 'image' || url.pathname.startsWith('/icons/')),
      handler: new CacheFirst({
        cacheName: CACHES.imagenes,
        plugins: [new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 60 * DIA })],
      }),
    },
  ],
  // Sin red y sin copia de esa página: la app guardada al instalar. Gana la
  // primera que encaje: `/escuchar` abre bolsillo, no el estudio. Si la de
  // bolsillo aún no está guardada (un worker de antes), cae en la del estudio.
  fallbacks: {
    entries: [
      {
        url: URL_ESCUCHAR_GUARDADA,
        matcher: ({ request }) => request.mode === 'navigate' && esRutaEscuchar(new URL(request.url).pathname),
      },
      { url: URL_APP_GUARDADA, matcher: ({ request }) => request.mode === 'navigate' },
    ],
  },
});

/* Compartir desde otra app (Android): el POST lo recoge el worker y no llega
   al servidor. Se registra antes que los oyentes de Serwist. */
serwist.registerCapture(({ url }) => url.pathname === RUTA_COMPARTIR, ({ request }) => recibirCompartido(request), 'POST');

/* Al estrenar versión, fuera las cachés nuestras que ya no se usan (la del
   worker escrito a mano, `aura-music-v3`). Las muestras de los instrumentos
   (`aura-samples-*`) y las de otros no se tocan nunca. */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((nombres) => Promise.all(cachesQueSobran(nombres).map((nombre) => caches.delete(nombre)))),
  );
});

serwist.addEventListeners();
