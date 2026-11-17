import { describe, expect, it } from 'vitest';
import { CACHES, cachesQueSobran } from './caches';

describe('cachesQueSobran', () => {
  it('nunca borra las muestras de los instrumentos', () => {
    const nombres = ['aura-samples-piano-v1', 'aura-samples-bateria', 'aura-samples-'];
    expect(cachesQueSobran(nombres)).toEqual([]);
  });

  it('borra la caché del service worker escrito a mano', () => {
    expect(cachesQueSobran(['aura-music-v3', CACHES.paginas])).toEqual(['aura-music-v3']);
  });

  it('respeta las vigentes y la copia de la app que lleva Serwist', () => {
    const nombres = [...Object.values(CACHES), 'serwist-precache-v2-https://music.aura.app/'];
    expect(cachesQueSobran(nombres)).toEqual([]);
  });

  it('no toca cachés de otros aunque se parezcan', () => {
    const nombres = ['workbox-precache-v2-x', 'aura-musica', 'compas-otra', 'mi-cache'];
    expect(cachesQueSobran(nombres)).toEqual([]);
  });

  it('borra una caché nuestra que ya no está en la lista', () => {
    expect(cachesQueSobran(['aura-music-fuentes-viejas', 'aura-samples-guitarra'])).toEqual([
      'aura-music-fuentes-viejas',
    ]);
  });
});
