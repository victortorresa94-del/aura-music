import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';

/*
  Una sola sans para toda la interfaz y una mono para los números: la letra de
  titulares no tiene sitio en una herramienta, ni en sus datos ni en sus rótulos.

  Servidas desde casa, no desde Google. `next/font/google` descarga los
  ficheros al compilar, y en este equipo el servidor de desarrollo no llegaba:
  caía en silencio al Arial de respaldo, con la mono «ajustada» al 135 % (los
  números salían enormes). Además, si suena al tocar va en local, y la letra
  de la pantalla de una app que funciona sin cobertura también. Son los mismos
  .woff2 que usa web-aether (solo el subset latin, que es todo el castellano).
*/
const body = localFont({
  src: [{ path: './fonts/inter.woff2', weight: '100 900', style: 'normal' }],
  variable: '--font-body',
  display: 'swap',
  fallback: ['system-ui', 'sans-serif'],
});
const mono = localFont({
  src: [
    { path: './fonts/ibm-plex-mono-400.woff2', weight: '400', style: 'normal' },
    { path: './fonts/ibm-plex-mono-500.woff2', weight: '500', style: 'normal' },
  ],
  variable: '--font-mono',
  display: 'swap',
  fallback: ['ui-monospace', 'monospace'],
});

export const metadata: Metadata = {
  title: 'Compás',
  description:
    'Graba una idea por capas desde el móvil, sin desfase, y ponle un bajo que toca a tu tempo y en tu tonalidad.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Compás',
    startupImage: ['/icons/icon-512.png'],
  },
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#0B0B0A' },
    { media: '(prefers-color-scheme: light)', color: '#F1F0EA' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${body.variable} ${mono.variable}`}>
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
