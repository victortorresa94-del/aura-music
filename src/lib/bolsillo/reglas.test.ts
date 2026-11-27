import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PROMESAS_DE_SALUD, pareceImitacion } from './reglas';

function ficheros(dir: string): string[] {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre);
    return statSync(ruta).isDirectory() ? ficheros(ruta) : /\.(tsx?|css)$/.test(nombre) ? [ruta] : [];
  });
}

describe('nada que imite a un artista real', () => {
  it.each([
    ['que suene como Rosalía', 'Rosalía'],
    ['una canción al estilo de Bad Bunny', 'Bad Bunny'],
    ['con la voz de Camarón de la Isla', 'Camarón de la Isla'],
    ['make it sound like Taylor Swift', 'Taylor Swift'],
    ['rollo Estopa pero más lento', 'Estopa'],
  ])('«%s» → %s', (texto, nombre) => {
    expect(pareceImitacion(texto)).toBe(nombre);
  });

  it.each([
    'una para la migraña, lenta y sin voz',
    'como de domingo por la mañana',
    'algo como Dios manda, con guitarra',
    'rumba para la cena del sábado',
    'que suene a verano',
  ])('«%s» no es imitar a nadie', (texto) => {
    expect(pareceImitacion(texto)).toBeNull();
  });
});

describe('ninguna promesa de salud en la interfaz', () => {
  it('ningún texto de src/components/bolsillo promete curar o aliviar', () => {
    const raiz = join(__dirname, '../../components/bolsillo');
    const culpables = ficheros(raiz).flatMap((ruta) => {
      const texto = readFileSync(ruta, 'utf8')
        // Los comentarios pueden NOMBRAR lo prohibido para prohibirlo.
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(^|[^:])\/\/.*$/gm, '$1');
      const m = texto.match(PROMESAS_DE_SALUD);
      return m ? [`${ruta}: «${m[0]}»`] : [];
    });
    expect(culpables).toEqual([]);
  });

  it('la regla caza lo que tiene que cazar', () => {
    expect(PROMESAS_DE_SALUD.test('Alivia la migraña en minutos')).toBe(true);
    expect(PROMESAS_DE_SALUD.test('Frecuencias sanadoras')).toBe(true);
    expect(PROMESAS_DE_SALUD.test('Para bajar el ritmo y desconectar')).toBe(false);
  });
});
