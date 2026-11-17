import { createHash, randomUUID } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import withSerwistInit from '@serwist/next';
import type { NextConfig } from 'next';

/*
  Service worker con Serwist (src/app/sw.ts). Cada compilación es una versión:
  la copia de la app que se guarda para abrir sin red lleva un identificador
  nuevo cada vez, porque apunta a los trozos de `_next/static` de esa
  compilación y no puede quedarse con los de la anterior.
*/
const version = randomUUID();

/*
  De public/, solo lo que la app necesita para abrir: iconos y manifest. Las
  capturas del manifest pesan y solo las mira el instalador. Van a mano
  porque Serwist deja de mirar public/ en cuanto se le pasa una entrada extra.
*/
function publicos(): { url: string; revision: string }[] {
  const iconos = existsSync('public/icons') ? readdirSync('public/icons').map((f) => `icons/${f}`) : [];
  return ['manifest.webmanifest', ...iconos].map((fichero) => ({
    url: `/${fichero}`,
    revision: createHash('md5').update(readFileSync(join('public', fichero))).digest('hex'),
  }));
}

const withSerwist = withSerwistInit({
  swSrc: 'src/app/sw.ts',
  swDest: 'public/sw.js',
  // Lo registramos nosotros (src/lib/pwa/actualizacion.ts) con updateViaCache: 'none'.
  register: false,
  // NUNCA recargar al volver la cobertura: cortaría la toma que estés grabando.
  reloadOnOnline: false,
  cacheOnNavigation: false,
  // En desarrollo no hay worker: serviría código viejo mientras editas.
  disable: process.env.NODE_ENV === 'development',
  additionalPrecacheEntries: [{ url: '/?app=guardada', revision: version }, ...publicos()],
});

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        // El service worker no se cachea: si no, una versión nueva tarda días en llegar.
        source: '/sw.js',
        headers: [{ key: 'Cache-Control', value: 'no-cache' }],
      },
    ];
  },
};

export default withSerwist(config);
