import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';

/*
  Una sola sans para toda la interfaz y una mono para los números: la letra de
  titulares no tiene sitio en una herramienta, ni en sus datos ni en sus rótulos.
  Las dos son Geist, las de la familia Aura (aura-lite, design-system/tokens.css).

  Servidas desde casa, no desde Google. `next/font/google` descarga los
  ficheros al compilar, y en este equipo el servidor de desarrollo no llegaba:
  caía en silencio al Arial de respaldo, con la mono «ajustada» al 135 % (los
  números salían enormes). Además, si suena al tocar va en local, y la letra
  de la pantalla de una app que funciona sin cobertura también. Son los mismos
  .woff2 que usa Aura (solo el subset latin, que es todo el castellano).
*/
const body = localFont({
  src: [{ path: './fonts/geist.woff2', weight: '100 900', style: 'normal' }],
  variable: '--font-body',
  display: 'swap',
  fallback: ['system-ui', 'sans-serif'],
});
const mono = localFont({
  src: [{ path: './fonts/geist-mono.woff2', weight: '100 900', style: 'normal' }],
  variable: '--font-mono',
  display: 'swap',
  fallback: ['ui-monospace', 'monospace'],
});

export const metadata: Metadata = {
  title: 'Aura Music',
  description:
    'Graba una idea por capas desde el móvil, sin desfase, y ponle bajo, batería o teclas que tocan a tu tempo y en tu tonalidad.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Aura Music',
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
  // El estudio sale en claro aunque el sistema esté en oscuro: una sola barra blanca.
  themeColor: '#FFFFFF',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${body.variable} ${mono.variable}`}>
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
