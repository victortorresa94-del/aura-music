import { strToU8, unzipSync, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { floatToInt16, int16ToFloat } from '@/lib/daw/audio';
import type { Project } from '@/lib/daw/types';
import {
  codificarWav16,
  crearZipDeIdea,
  ErrorDeCopia,
  leerWav,
  leerZipDeIdea,
  nombreDelZip,
  prepararParaImportar,
  type AudioDeIdea,
} from './copia';

/**
 * Audio como lo devuelve el móvil: `storage.ts` guarda enteros de 16 bits y
 * los devuelve divididos entre 32768. Se fabrica igual que allí.
 */
function audioGuardado(muestras: number, canales = 1, sampleRate = 48000, semilla = 1): AudioDeIdea {
  const channels: Float32Array[] = [];
  let x = semilla;
  for (let c = 0; c < canales; c++) {
    const onda = new Float32Array(muestras);
    for (let i = 0; i < muestras; i++) {
      x = (x * 1103515245 + 12345) % 2147483648;
      onda[i] = Math.sin(i / (7 + c)) * 0.6 + (x / 2147483648 - 0.5) * 0.3;
    }
    // Los extremos también: el pico positivo y el negativo.
    onda[0] = 1;
    onda[1] = -1;
    channels.push(int16ToFloat(floatToInt16(onda)));
  }
  return { channels, sampleRate };
}

const proyecto: Project = {
  id: 'prj_idea1',
  name: 'Bulería de la cocina',
  bpm: 132,
  createdAt: 1_763_300_000_000,
  updatedAt: 1_763_300_500_000,
  tracks: [
    {
      id: 'trk_a',
      name: 'Guitarra',
      clip: { bufferId: 'buf_guitarra', start: 0.25, offset: 0.1, duration: 3.5, repeats: 2 },
      volume: 0.9,
      muted: false,
      soloed: false,
      sourceDuration: 4,
      createdAt: 1_763_300_100_000,
    },
    {
      id: 'trk_b',
      name: 'Bajo',
      clip: { bufferId: 'buf_bajo', start: 0, offset: 0, duration: 4, repeats: 1 },
      volume: 0.85,
      muted: true,
      soloed: false,
      sourceDuration: 4,
      createdAt: 1_763_300_200_000,
      ia: true,
    },
    // Duplicada: comparte audio con la guitarra y no tiene que ir dos veces.
    {
      id: 'trk_c',
      name: 'Guitarra copia',
      clip: { bufferId: 'buf_guitarra', start: 8, offset: 0.1, duration: 3.5, repeats: 1 },
      volume: 1,
      muted: false,
      soloed: true,
      sourceDuration: 4,
      createdAt: 1_763_300_300_000,
    },
  ],
};

const audios = new Map<string, AudioDeIdea>([
  ['buf_guitarra', audioGuardado(4800, 1, 48000, 7)],
  ['buf_bajo', audioGuardado(3000, 2, 44100, 3)],
]);

describe('copia de una idea en zip', () => {
  it('exportar e importar devuelve la misma idea, muestra a muestra', () => {
    const zip = crearZipDeIdea(proyecto, audios, new Date('2026-11-17T10:00:00Z'));
    const vuelta = leerZipDeIdea(zip);

    expect(vuelta.proyecto).toEqual(proyecto);
    expect(vuelta.exportadaEn).toBe('2026-11-17T10:00:00.000Z');
    expect([...vuelta.audios.keys()].sort()).toEqual(['buf_bajo', 'buf_guitarra']);
    for (const [id, original] of audios) {
      const leido = vuelta.audios.get(id)!;
      expect(leido.sampleRate).toBe(original.sampleRate);
      expect(leido.channels.length).toBe(original.channels.length);
      leido.channels.forEach((canal, c) => expect(canal).toEqual(original.channels[c]));
    }
  });

  it('mete cada audio una sola vez y el proyecto legible', () => {
    const zip = crearZipDeIdea(proyecto, audios);
    const ficheros = Object.keys(unzipSync(zip)).sort();
    expect(ficheros).toEqual(['audio/01-guitarra.wav', 'audio/02-bajo.wav', 'idea.json']);
  });

  it('conserva los campos que añadan otras partes de la app', () => {
    const conMezcla = {
      ...proyecto,
      tracks: proyecto.tracks.map((t) => ({ ...t, pan: -0.3, efectos: [{ tipo: 'reverb', mezcla: 0.2 }] })),
    } as Project;
    const vuelta = leerZipDeIdea(crearZipDeIdea(conMezcla, audios));
    expect(vuelta.proyecto).toEqual(conMezcla);
  });

  it('una pista sin audio guardado viaja igual, y vuelve muda', () => {
    const soloGuitarra = new Map([['buf_guitarra', audios.get('buf_guitarra')!]]);
    const vuelta = leerZipDeIdea(crearZipDeIdea(proyecto, soloGuitarra));
    expect(vuelta.proyecto.tracks).toHaveLength(3);
    expect(vuelta.audios.has('buf_bajo')).toBe(false);
  });

  it('dice qué pasa cuando el fichero no vale', () => {
    expect(() => leerZipDeIdea(strToU8('esto no es un zip'))).toThrow(ErrorDeCopia);
    expect(() => leerZipDeIdea(zipSync({ 'otra.txt': strToU8('hola') }))).toThrow(/no es una idea/);
    const futuro = zipSync({
      'idea.json': strToU8(
        JSON.stringify({ formato: 'aura-music-idea', version: 99, exportadaEn: '', proyecto, audios: [] }),
      ),
    });
    expect(() => leerZipDeIdea(futuro)).toThrow(/más nueva/);
  });
});

describe('el audio guardado en el móvil', () => {
  it('guardar otra vez lo ya guardado no le quita ni un bit', () => {
    const todos = new Int16Array(65536);
    for (let i = 0; i < todos.length; i++) todos[i] = i - 32768;
    expect(floatToInt16(int16ToFloat(todos))).toEqual(todos);
  });

  it('el tope positivo se queda en el tope', () => {
    expect([...floatToInt16(new Float32Array([1, 1.5, -1, -2]))]).toEqual([32767, 32767, -32768, -32768]);
  });
});

describe('WAV', () => {
  it('lee lo que escribe, en estéreo', () => {
    const audio = audioGuardado(1000, 2, 22050);
    const leido = leerWav(codificarWav16(audio));
    expect(leido.sampleRate).toBe(22050);
    expect(leido.channels[0]).toEqual(audio.channels[0]);
    expect(leido.channels[1]).toEqual(audio.channels[1]);
  });

  it('se salta bloques que meten otros editores', () => {
    const wav = codificarWav16(audioGuardado(100));
    // Un bloque LIST de 4 bytes entre fmt y data.
    const lista = new Uint8Array([0x4c, 0x49, 0x53, 0x54, 4, 0, 0, 0, 1, 2, 3, 4]);
    const retocado = new Uint8Array(wav.length + lista.length);
    retocado.set(wav.subarray(0, 36));
    retocado.set(lista, 36);
    retocado.set(wav.subarray(36), 36 + lista.length);
    expect(leerWav(retocado).channels[0]).toEqual(leerWav(wav).channels[0]);
  });
});

describe('prepararParaImportar', () => {
  let n = 0;
  const id = (prefijo: string) => `${prefijo}_nuevo${++n}`;

  it('estrena ids de audio y mantiene el del proyecto si no existe', () => {
    const { proyecto: p, audios: a } = prepararParaImportar(proyecto, audios, false, id);
    expect(p.id).toBe(proyecto.id);
    expect(p.name).toBe(proyecto.name);
    // Todas las pistas apuntan a un audio que existe, y las duplicadas siguen compartiéndolo.
    for (const pista of p.tracks) expect(a.has(pista.clip.bufferId)).toBe(true);
    expect(p.tracks[0].clip.bufferId).toBe(p.tracks[2].clip.bufferId);
    expect(p.tracks[0].clip.bufferId).not.toBe('buf_guitarra');
  });

  it('si la idea ya está en el móvil, entra como copia y no la pisa', () => {
    const { proyecto: p } = prepararParaImportar(proyecto, audios, true, id);
    expect(p.id).not.toBe(proyecto.id);
    expect(p.name).toBe('Bulería de la cocina (copia)');
  });
});

describe('nombreDelZip', () => {
  it('lleva el nombre de la idea y el día', () => {
    expect(nombreDelZip({ name: 'Bulería de la cocina' }, new Date('2026-11-17T10:00:00Z'))).toBe(
      'buleria-de-la-cocina-2026-11-17.zip',
    );
  });
});
