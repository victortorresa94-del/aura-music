import { describe, expect, it } from 'vitest';
import { almacenEnMemoria } from '../almacen';
import { versionQueSuena } from '../biblioteca';
import { cancionDePista, idsDePista, leerPista, motorDeModelo, tituloDePista } from './deAuraStudio';
import { textoDelFalloAlLeer, textoDelResultado, traerDeAuraStudio, type DocDeAuraStudio } from './importar';

/**
 * Traer tus pistas de Music Studio: la parte pura (de documento a canción) y
 * que traer dos veces no duplica. La forma de los documentos es la que
 * escribe `aura-studio/src/services/studioAudioService.ts`.
 */

const AHORA = Date.UTC(2026, 10, 27, 18, 0);

function pista(id: string, datos: Partial<Record<string, unknown>> = {}): DocDeAuraStudio {
  return {
    id,
    datos: {
      id,
      kind: 'music',
      url: `https://firebasestorage.googleapis.com/v0/b/aura/o/marketing%2Fu1%2Faudios%2F${id}.mp3?alt=media&token=t`,
      prompt: 'Una lenta para la migraña de esta tarde, sin voz, con un tono de 142 Hz',
      durationSec: 120,
      model: 'lyria3',
      modo: 'sin',
      createdAt: AHORA - 60_000,
      archived: true,
      ...datos,
    },
  };
}

const audio = () => new Blob([new Uint8Array([0xff, 0xfb, 0x90, 0x00])], { type: 'audio/mpeg' });

describe('leerPista', () => {
  it('trae la música que se puede escuchar', () => {
    const p = leerPista('mus_1', pista('mus_1').datos, AHORA);
    expect(p).toMatchObject({ id: 'mus_1', model: 'lyria3', modo: 'sin', durationSec: 120 });
  });

  it('deja fuera voces, efectos, doblajes a medias, fallos y enlaces raros', () => {
    expect(leerPista('v', pista('v', { kind: 'voice' }).datos)).toBeNull();
    expect(leerPista('s', pista('s', { kind: 'sfx' }).datos)).toBeNull();
    expect(leerPista('d', pista('d', { url: '', pendiente: true }).datos)).toBeNull();
    expect(leerPista('f', pista('f', { estado: 'fallo' }).datos)).toBeNull();
    expect(leerPista('h', pista('h', { url: 'http://inseguro.test/a.mp3' }).datos)).toBeNull();
    expect(leerPista('j', pista('j', { url: 'javascript:alert(1)' }).datos)).toBeNull();
    expect(leerPista('k', pista('k', { kind: undefined }).datos)).toBeNull();
  });

  it('sin fecha, la de hoy; sin duración, ninguna', () => {
    const p = leerPista('x', pista('x', { createdAt: 'ayer', durationSec: -3 }).datos, AHORA);
    expect(p?.createdAt).toBe(AHORA);
    expect(p?.durationSec).toBeUndefined();
  });
});

describe('de pista a canción', () => {
  it('entra guardada, con su v1 lista, el enlace de aura Studio y sin coste', () => {
    const p = leerPista('mus_1', pista('mus_1').datos, AHORA)!;
    const { cancion, version } = cancionDePista(p);
    expect(cancion).toMatchObject({
      origen: 'aura-studio',
      idOrigen: 'mus_1',
      guardada: true,
      tipo: 'cancion',
      versionElegida: version.id,
      creadaEn: p.createdAt,
      escuchas: 0,
    });
    expect(version).toMatchObject({
      cancionId: cancion.id,
      n: 1,
      estado: 'lista',
      cambio: 'Hecha en aura Studio',
      creditos: 0,
      motor: 'lyria3',
      urlRemota: p.url,
      duracionSeg: 120,
    });
    expect(version.receta).toMatchObject({ tipo: 'cancion', conVoz: false, motor: 'lyria3', duracionSeg: 120 });
    expect(versionQueSuena(cancion, [version])?.id).toBe(version.id);
  });

  it('la frase se copia tal cual y no se deduce nada de ella', () => {
    const p = leerPista('mus_1', pista('mus_1').datos, AHORA)!;
    const { cancion, version } = cancionDePista(p);
    expect(version.receta.frase).toBe('Una lenta para la migraña de esta tarde, sin voz, con un tono de 142 Hz');
    expect(version.receta.momento).toBeUndefined();
    expect(version.receta.capas).toBeUndefined();
    expect(cancion.porque).toBeUndefined();
    expect(cancion.tipo).toBe('cancion');
  });

  it('con tu letra: canta y la letra pedida es la tuya; la de Lyria es solo lo que cantó', () => {
    const tuya = cancionDePista(leerPista('t', pista('t', { modo: 'tuya', model: 'minimax-music-3', letra: 'Feliz día, Carmen' }).datos)!);
    expect(tuya.version.receta).toMatchObject({ conVoz: true, letra: 'Feliz día, Carmen', motor: 'minimax-music-3' });
    expect(tuya.version.letra).toBe('Feliz día, Carmen');

    const lyria = cancionDePista(leerPista('l', pista('l', { modo: 'con', letra: '[00:01] La la la' }).datos)!);
    expect(lyria.version.receta.letra).toBeUndefined();
    expect(lyria.version.receta.conVoz).toBe(true);
    expect(lyria.version.letra).toBe('[00:01] La la la');

    // Una de antes, sin modo: canta si trae letra.
    const vieja = cancionDePista(leerPista('v', pista('v', { modo: undefined, letra: undefined }).datos)!);
    expect(vieja.version.receta.conVoz).toBe(false);
  });

  it('el motor sale del modelo; lo que bolsillo no tiene queda como Lyria 3 Pro', () => {
    expect(motorDeModelo('lyria-3.5')).toBe('lyria-3.5');
    expect(motorDeModelo('lyria3-base')).toBe('lyria3-base');
    expect(motorDeModelo('ace-step')).toBe('ace-step');
    expect(motorDeModelo('eleven-music')).toBe('lyria3');
    expect(motorDeModelo(undefined)).toBe('lyria3');
  });

  it('los ids salen de la pista: siempre los mismos', () => {
    const p = leerPista('mus/raro 1', pista('mus/raro 1').datos, AHORA)!;
    expect(idsDePista(p)).toEqual(idsDePista(p));
    expect(idsDePista(p).cancion).toMatch(/^can_[a-z0-9]+_as_musraro1$/);
    expect(idsDePista(p).version.replace(/^ver_/, '')).toBe(idsDePista(p).audio.replace(/^aud_/, ''));
  });
});

describe('tituloDePista', () => {
  it('el principio de la frase, sin partir palabras', () => {
    expect(tituloDePista({ prompt: 'Una lenta para la migraña de esta tarde, sin voz, con un tono de 142 Hz' })).toBe(
      'Una lenta para la migraña de esta tarde, sin…',
    );
    expect(tituloDePista({ prompt: 'rumba para mi madre. Que diga Carmen.' })).toBe('Rumba para mi madre');
    expect(tituloDePista({ prompt: 'Tono de 142.5 Hz para dormir' })).toBe('Tono de 142.5 Hz para dormir');
  });

  it('si tiene nombre, el nombre; sin nada, uno de aura Studio', () => {
    expect(tituloDePista({ nombre: 'La de las tardes', prompt: 'otra cosa' })).toBe('La de las tardes');
    expect(tituloDePista({ prompt: '   ' })).toBe('Canción de aura Studio');
  });
});

describe('traerDeAuraStudio', () => {
  it('mete las nuevas con su audio en el móvil', async () => {
    const a = almacenEnMemoria();
    const bajadas: string[] = [];
    const r = await traerDeAuraStudio({
      almacen: a,
      leer: async () => [pista('mus_1'), pista('voz_1', { kind: 'voice' }), pista('mus_2', { createdAt: AHORA - 1000 })],
      bajar: async (url) => {
        bajadas.push(url);
        return audio();
      },
      ahora: AHORA,
    });
    expect(r).toEqual({ nuevas: 2, yaEstaban: 0, soloConRed: 0, bajadasAhora: 0 });
    const canciones = await a.canciones.todos();
    expect(canciones.map((c) => c.idOrigen).sort()).toEqual(['mus_1', 'mus_2']);
    const versiones = await a.versiones.todos();
    expect(versiones).toHaveLength(2);
    for (const v of versiones) {
      expect(v.audioId).toBeTruthy();
      expect(await a.audios.leer(v.audioId!)).not.toBeNull();
    }
    expect(bajadas).toHaveLength(2);
  });

  it('traer otra vez no duplica nada', async () => {
    const a = almacenEnMemoria();
    const leer = async () => [pista('mus_1'), pista('mus_2')];
    await traerDeAuraStudio({ almacen: a, leer, bajar: async () => audio(), ahora: AHORA });
    const segunda = await traerDeAuraStudio({ almacen: a, leer: async () => [pista('mus_1'), pista('mus_2'), pista('mus_3')], bajar: async () => audio(), ahora: AHORA });
    expect(segunda).toEqual({ nuevas: 1, yaEstaban: 2, soloConRed: 0, bajadasAhora: 0 });
    expect(await a.canciones.todos()).toHaveLength(3);
    expect(await a.versiones.todos()).toHaveLength(3);
  });

  it('dos «Traer» a la vez escriben lo mismo encima, no el doble', async () => {
    const a = almacenEnMemoria();
    const leer = async () => [pista('mus_1')];
    await Promise.all([
      traerDeAuraStudio({ almacen: a, leer, bajar: async () => audio(), ahora: AHORA }),
      traerDeAuraStudio({ almacen: a, leer, bajar: async () => audio(), ahora: AHORA }),
    ]);
    expect(await a.canciones.todos()).toHaveLength(1);
    expect(await a.versiones.todos()).toHaveLength(1);
  });

  it('si el CORS no deja, entra con su enlace y suena con red; y no se vuelve a probar ese sitio', async () => {
    const a = almacenEnMemoria();
    let intentos = 0;
    const r = await traerDeAuraStudio({
      almacen: a,
      leer: async () => [pista('mus_1'), pista('mus_2'), pista('mus_3')],
      bajar: async () => {
        intentos += 1;
        throw new TypeError('Failed to fetch');
      },
      ahora: AHORA,
    });
    expect(r).toEqual({ nuevas: 3, yaEstaban: 0, soloConRed: 3, bajadasAhora: 0 });
    expect(intentos).toBe(1);
    const versiones = await a.versiones.todos();
    expect(versiones.every((v) => !v.audioId && v.urlRemota?.startsWith('https://'))).toBe(true);
    expect(textoDelResultado(r)).toBe('He traído 3 canciones. 3 suenan solo con red: no he podido bajarlas al móvil.');
  });

  it('las que se quedaron sin audio se bajan en el siguiente «Traer»', async () => {
    const a = almacenEnMemoria();
    const leer = async () => [pista('mus_1')];
    await traerDeAuraStudio({ almacen: a, leer, bajar: async () => null, ahora: AHORA });
    expect((await a.versiones.todos())[0].audioId).toBeUndefined();
    const r = await traerDeAuraStudio({ almacen: a, leer, bajar: async () => audio(), ahora: AHORA });
    expect(r).toEqual({ nuevas: 0, yaEstaban: 1, soloConRed: 0, bajadasAhora: 1 });
    const v = (await a.versiones.todos())[0];
    expect(v.audioId).toBeTruthy();
    expect(await a.audios.leer(v.audioId!)).not.toBeNull();
    expect(textoDelResultado(r)).toBe('Ya tenías todas tus canciones de aura Studio. Y 1 que ya tenías ahora suena sin red.');
  });

  it('si el móvil no tiene sitio para el audio, la canción entra igual con su enlace', async () => {
    const a = almacenEnMemoria();
    a.audios.poner = async () => {
      throw new DOMException('lleno', 'QuotaExceededError');
    };
    const r = await traerDeAuraStudio({ almacen: a, leer: async () => [pista('mus_1')], bajar: async () => audio(), ahora: AHORA });
    expect(r).toEqual({ nuevas: 1, yaEstaban: 0, soloConRed: 1, bajadasAhora: 0 });
    expect(await a.canciones.todos()).toHaveLength(1);
  });

  it('la canción se escribe después de su versión: nunca una canción sin nada que sonar', async () => {
    const a = almacenEnMemoria();
    const orden: string[] = [];
    a.suscribir((c) => orden.push(c.coleccion));
    await traerDeAuraStudio({ almacen: a, leer: async () => [pista('mus_1')], bajar: async () => audio(), ahora: AHORA });
    expect(orden).toEqual(['audios', 'versiones', 'canciones']);
  });

  it('si no se pueden leer, el motivo y nada escrito', async () => {
    const a = almacenEnMemoria();
    const r = await traerDeAuraStudio({
      almacen: a,
      leer: async () => {
        throw Object.assign(new Error('denied'), { code: 'permission-denied' });
      },
      ahora: AHORA,
    });
    expect(r.nuevas).toBe(0);
    expect(r.error).toMatch(/no me deja leer tus canciones/);
    expect(await a.canciones.todos()).toHaveLength(0);
  });

  it('avisa del avance', async () => {
    const pasos: string[] = [];
    await traerDeAuraStudio({
      almacen: almacenEnMemoria(),
      leer: async () => [pista('mus_1'), pista('mus_2')],
      bajar: async () => audio(),
      ahora: AHORA,
      alAvanzar: (h, t) => pasos.push(`${h}/${t}`),
    });
    expect(pasos).toEqual(['0/2', '1/2', '2/2']);
  });
});

describe('textos', () => {
  it('lo que se dice al terminar', () => {
    expect(textoDelResultado({ nuevas: 1, yaEstaban: 0, soloConRed: 0, bajadasAhora: 0 })).toBe('He traído 1 canción.');
    expect(textoDelResultado({ nuevas: 0, yaEstaban: 0, soloConRed: 0, bajadasAhora: 0 })).toBe('No hay canciones tuyas en Music Studio todavía.');
  });

  it('el fallo al leer, para una persona', () => {
    expect(textoDelFalloAlLeer(Object.assign(new Error('x'), { code: 'unavailable' }))).toMatch(/Sin conexión/);
    expect(textoDelFalloAlLeer(new Error('raro'))).toMatch(/No he podido leer/);
  });
});
