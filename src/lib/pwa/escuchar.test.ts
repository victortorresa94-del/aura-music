import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { esRutaEscuchar, URL_APP_GUARDADA, URL_ESCUCHAR_GUARDADA } from './caches';

/**
 * `/escuchar` (aura Music de bolsillo) abre sin red con SU copia, no con la
 * del estudio. Nada de esto da error si se rompe: sin red, simplemente se abre
 * otra app o la página de «sin conexión» del navegador.
 */

const RAIZ = join(__dirname, '..', '..', '..');
const PUBLICO = join(RAIZ, 'public');
const leer = (ruta: string) => readFileSync(join(RAIZ, ruta), 'utf8');

function medidasPng(ruta: string): string {
  const bytes = readFileSync(ruta);
  return `${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`;
}

describe('esRutaEscuchar', () => {
  it('reconoce bolsillo y nada más', () => {
    expect(esRutaEscuchar('/escuchar')).toBe(true);
    expect(esRutaEscuchar('/escuchar/')).toBe(true);
    expect(esRutaEscuchar('/escuchar?app=guardada')).toBe(true);
    expect(esRutaEscuchar('/Escuchar')).toBe(true);
    expect(esRutaEscuchar('/')).toBe(false);
    expect(esRutaEscuchar('/escucharte')).toBe(false);
    expect(esRutaEscuchar('/compartir')).toBe(false);
  });
});

describe('la copia de bolsillo para abrir sin red', () => {
  it('se guarda al instalar, junto a la del estudio', () => {
    const config = leer('next.config.ts');
    expect(config).toContain(`url: '${URL_APP_GUARDADA}'`);
    expect(config).toContain(`url: '${URL_ESCUCHAR_GUARDADA}'`);
  });

  it('el worker la sirve a /escuchar antes que la del estudio', () => {
    const sw = leer('src/app/sw.ts');
    const bloque = sw.slice(sw.indexOf('fallbacks:'));
    const deBolsillo = bloque.indexOf('url: URL_ESCUCHAR_GUARDADA');
    const delEstudio = bloque.indexOf('url: URL_APP_GUARDADA');
    expect(deBolsillo).toBeGreaterThan(-1);
    expect(delEstudio).toBeGreaterThan(deBolsillo);
    expect(bloque.slice(deBolsillo, delEstudio)).toContain('esRutaEscuchar');
  });
});

describe('el atajo «Escuchar» del icono', () => {
  const manifest = JSON.parse(readFileSync(join(PUBLICO, 'manifest.webmanifest'), 'utf8')) as {
    shortcuts: { short_name: string; url: string; icons: { src: string; sizes: string }[] }[];
  };

  it('abre bolsillo y tiene icono de verdad', () => {
    const atajo = manifest.shortcuts.find((a) => a.url === '/escuchar');
    expect(atajo?.short_name).toBe('Escuchar');
    expect(atajo?.icons.length).toBeGreaterThan(0);
    for (const icono of atajo!.icons) expect(medidasPng(join(PUBLICO, icono.src))).toBe(icono.sizes);
  });

  it('el de grabar sigue ahí', () => {
    expect(manifest.shortcuts.some((a) => a.url === '/?grabar=1')).toBe(true);
  });
});
