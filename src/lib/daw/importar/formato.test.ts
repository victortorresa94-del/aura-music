import { describe, expect, it } from 'vitest';
import { ErrorDeImportar, formatoDe, mensajeDeImportar } from './formato';

describe('formatoDe', () => {
  it('reconoce lo que sale de un iPhone', () => {
    expect(formatoDe({ name: 'Nota de voz 12.m4a', type: 'audio/x-m4a' })).toMatchObject({ nombre: 'm4a', esVideo: false });
    expect(formatoDe({ name: 'IMG_0042.MOV', type: 'video/quicktime' })).toMatchObject({ nombre: 'vídeo .mov', esVideo: true });
    expect(formatoDe({ name: 'PTT-20261125.opus', type: '' })).toMatchObject({ nombre: 'opus', esVideo: false });
    expect(formatoDe({ name: 'toma.caf', type: 'audio/x-caf' }).nombre).toBe('caf');
  });

  it('un .webm de solo audio no es un vídeo', () => {
    expect(formatoDe({ name: 'grabacion.webm', type: 'audio/webm' }).esVideo).toBe(false);
    expect(formatoDe({ name: 'clip.webm', type: 'video/webm' }).esVideo).toBe(true);
  });

  it('sin extensión, tira del tipo', () => {
    expect(formatoDe({ name: 'audio', type: 'audio/mpeg' }).nombre).toBe('mp3');
    expect(formatoDe({ name: 'audio', type: '' }).nombre).toBe('fichero');
  });
});

describe('mensajeDeImportar', () => {
  it('dice qué formato era y qué hacer', () => {
    const mov = formatoDe({ name: 'IMG_1.mov', type: 'video/quicktime' });
    expect(mensajeDeImportar(mov, 'no-se-lee')).toBe('No he podido leer ese vídeo .mov. Prueba con un m4a, mp3 o wav.');
    expect(mensajeDeImportar(mov, 'sin-permiso-para-sonar')).toContain('vídeo .mov');
    const opus = formatoDe({ name: 'x.opus', type: '' });
    expect(mensajeDeImportar(opus, 'no-se-lee')).toContain('WhatsApp');
  });

  it('el error lleva el mensaje', () => {
    const error = new ErrorDeImportar(formatoDe({ name: 'a.flac', type: '' }), 'no-se-lee');
    expect(error.message).toBe('No he podido leer ese flac. Prueba con un m4a, mp3 o wav.');
  });
});
