import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RUTA_COMPARTIR } from './caches';
import { CAMPO_AUDIO } from './compartir';

/**
 * El manifest es lo que lee Android para instalar la app. Un icono que no
 * existe o un `share_target` que apunta a otra ruta no da error en ningún
 * sitio: simplemente la app no se instala bien o no sale al compartir.
 */

const PUBLICO = join(__dirname, '..', '..', '..', 'public');
const manifest = JSON.parse(readFileSync(join(PUBLICO, 'manifest.webmanifest'), 'utf8')) as {
  id: string;
  start_url: string;
  icons: { src: string; sizes: string; purpose: string }[];
  shortcuts: { url: string; icons: { src: string; sizes: string }[] }[];
  screenshots: { src: string; sizes: string; form_factor: string }[];
  share_target: { action: string; method: string; enctype: string; params: { files: { name: string }[] } };
};

/** Ancho y alto de un PNG, leídos de su cabecera IHDR. */
function medidasPng(ruta: string): string {
  const bytes = readFileSync(ruta);
  return `${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`;
}

describe('manifest', () => {
  it('tiene id propio y empieza en la raíz', () => {
    expect(manifest.id).toBe('/');
    expect(manifest.start_url).toBe('/');
  });

  it('trae iconos maskable de 192 y 512, y existen con esas medidas', () => {
    const maskable = manifest.icons.filter((icono) => icono.purpose === 'maskable');
    expect(maskable.map((icono) => icono.sizes).sort()).toEqual(['192x192', '512x512']);
    for (const icono of manifest.icons) {
      expect(medidasPng(join(PUBLICO, icono.src))).toBe(icono.sizes);
    }
  });

  it('el atajo de grabar tiene icono', () => {
    const grabar = manifest.shortcuts.find((atajo) => atajo.url === '/?grabar=1');
    expect(grabar?.icons.length).toBeGreaterThan(0);
    for (const icono of grabar!.icons) expect(medidasPng(join(PUBLICO, icono.src))).toBe(icono.sizes);
  });

  it('las capturas son de móvil y miden lo que dicen', () => {
    expect(manifest.screenshots.length).toBeGreaterThan(0);
    for (const captura of manifest.screenshots) {
      expect(captura.form_factor).toBe('narrow');
      const ruta = join(PUBLICO, captura.src);
      expect(existsSync(ruta)).toBe(true);
      expect(medidasPng(ruta)).toBe(captura.sizes);
    }
  });

  it('compartir apunta a la ruta que recoge el service worker', () => {
    expect(manifest.share_target.action).toBe(RUTA_COMPARTIR);
    expect(manifest.share_target.method).toBe('POST');
    expect(manifest.share_target.enctype).toBe('multipart/form-data');
    expect(manifest.share_target.params.files[0].name).toBe(CAMPO_AUDIO);
  });
});
