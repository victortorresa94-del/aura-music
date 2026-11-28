import { describe, expect, it } from 'vitest';
import { almacenEnMemoria } from '../almacen';
import { nuevaCancion } from '../biblioteca';
import { pareceImitacion } from '../reglas';
import type { AdnArtista, Receta } from '../tipos';
import {
  bpmDelArtista,
  comoSuena,
  evitarDelAdn,
  fraseParaElMotor,
  idDeTempo,
  nombresSugeridos,
  normalizarAdn,
  recetaDeArtista,
  tempoDe,
  tempoEnPalabras,
  validarArtista,
} from './adn';
import { artistaEditado, borrarArtistaSinPerder, nuevoArtista } from './artista';
import { semanaCon } from '../playlists/viva';

const rumba: AdnArtista = {
  estilo: 'rumba lenta',
  instrumentos: ['guitarra española', 'cajón', 'palmas'],
  voz: 'grave y cálida, casi hablada',
  idioma: 'es',
  tempo: { min: 90, max: 110 },
  temas: 'las noches de verano',
  nunca: 'autotune',
};

const piano: AdnArtista = { estilo: 'piano de noche', instrumentos: ['piano'], voz: '' };

describe('el ADN de un artista', () => {
  it('nombre y estilo son obligatorios, con una frase que dice qué hacer', () => {
    expect(validarArtista('', rumba)?.campo).toBe('nombre');
    expect(validarArtista('  ', rumba)?.motivo).toMatch(/sugerencia/);
    expect(validarArtista('Lola Niebla', { ...rumba, estilo: '   ' })?.campo).toBe('estilo');
    expect(validarArtista('x'.repeat(41), rumba)?.campo).toBe('nombre');
    expect(validarArtista('Lola Niebla', rumba)).toBeNull();
    expect(validarArtista('Teo Bruma', piano)).toBeNull();
  });

  it.each<[string, string, AdnArtista]>([
    ['estilo', 'Lola', { ...rumba, estilo: 'que suene como Rosalía' }],
    ['voz', 'Lola', { ...rumba, voz: 'con la voz de Camarón de la Isla' }],
    ['nombre', 'Rollo Estopa', rumba],
    ['instrumentos', 'Lola', { ...rumba, instrumentos: ['guitarra al estilo de Paco de Lucía'] }],
  ])('no guarda un artista que imita a alguien real (%s)', (campo, nombre, adn) => {
    const problema = validarArtista(nombre, adn);
    expect(problema?.campo).toBe(campo);
    expect(problema?.imitacion).toBeTruthy();
    expect(problema?.motivo).toMatch(/No hago canciones que imiten/);
  });

  it('se guarda limpio: sin espacios de más, sin instrumentos repetidos y con el tempo en orden', () => {
    const a = normalizarAdn({
      estilo: '  rumba   lenta ',
      instrumentos: ['Cajón', 'cajón', ' ', 'palmas'],
      voz: '',
      idioma: 'es',
      tempo: { min: 300, max: 10 },
      temas: '  ',
    });
    expect(a).toEqual({ estilo: 'rumba lenta', instrumentos: ['Cajón', 'palmas'], voz: '', tempo: { min: 40, max: 220 } });
    // Sin voz no hay idioma.
    expect(a.idioma).toBeUndefined();
  });

  it('el tempo va en palabras: quien escucha no sabe qué es un BPM', () => {
    expect(tempoEnPalabras(tempoDe('lento'))).toBe('Lento');
    expect(tempoEnPalabras({ min: 90, max: 110 })).toBe('Medio');
    expect(idDeTempo({ min: 135, max: 165 })).toBe('rapido');
    expect(tempoEnPalabras(undefined)).toBeNull();
  });
});

describe('nombres sugeridos', () => {
  it('deterministas: el mismo estilo, los mismos nombres; otro estilo, otros', () => {
    const a = nombresSugeridos('rumba lenta');
    expect(a).toEqual(nombresSugeridos('Rumba   lenta'));
    expect(a).toHaveLength(4);
    expect(new Set(a).size).toBe(4);
    expect(nombresSugeridos('techno de madrugada')).not.toEqual(a);
  });

  it('le pegan al estilo y ninguno parece imitar a nadie', () => {
    const rumbas = nombresSugeridos('rumba con palmas');
    expect(rumbas.some((n) => /Albero|Azahar|Candela|Clavel|Romero|Alhambra/.test(n))).toBe(true);
    for (const estilo of ['', 'jazz', 'pop de verano', 'piano', 'rock', 'lo-fi']) {
      for (const n of nombresSugeridos(estilo, 6)) expect(pareceImitacion(n)).toBeNull();
    }
  });
});

describe('del ADN a la receta', () => {
  const lola = { id: 'art_1', nombre: 'Lola Niebla', adn: rumba };

  it('con voz: estilo con instrumentos y voz, idioma, tempo dentro de su rango', () => {
    const r = recetaDeArtista(lola, { energia: 0 });
    expect(r.artistaId).toBe('art_1');
    expect(r.conVoz).toBe(true);
    expect(r.idioma).toBe('es');
    expect(r.bpm).toBe(90);
    expect(recetaDeArtista(lola, { energia: 1 }).bpm).toBe(110);
    expect(recetaDeArtista(lola).bpm).toBe(100);
    expect(r.estilo).toBe('rumba lenta, con guitarra española, cajón y palmas, voz grave y cálida, casi hablada');
    expect(r.frase).toBe('Una nueva de Lola Niebla, sobre las noches de verano');
  });

  it('sin voz: instrumental y sin idioma; sin tempo, sin BPM', () => {
    const r = recetaDeArtista({ id: 'a', nombre: 'Teo Bruma', adn: piano });
    expect(r.conVoz).toBe(false);
    expect(r.idioma).toBeUndefined();
    expect(r.bpm).toBeUndefined();
    expect(r.paraElMotor).toContain('Instrumental, sin voz');
    expect(bpmDelArtista(piano)).toBeUndefined();
  });

  it('la frase del motor cuenta lo que ES, sin el nombre ni lo que no hace nunca', () => {
    const frase = fraseParaElMotor(rumba, { frase: 'para la cena del sábado', bpm: 100 });
    expect(frase).toBe(
      'para la cena del sábado. rumba lenta, con guitarra española, cajón y palmas. Voz grave y cálida, casi hablada, cantando en castellano. Habla de las noches de verano. Hacia 100 BPM.',
    );
    expect(frase).not.toContain('autotune');
    expect(frase).not.toContain('Lola');
    expect(evitarDelAdn(rumba)).toBe('autotune');
    expect(recetaDeArtista(lola).evitar).toBe('autotune');
  });

  it('cómo suena, en una línea', () => {
    expect(comoSuena(piano)).toBe('piano de noche, con piano, sin voz');
  });

  it('la receta del artista encaja en una Receta (los campos de más se quedan fuera)', () => {
    const { paraElMotor: _a, evitar: _b, ...parcial } = recetaDeArtista(lola);
    const receta: Receta = { tipo: 'cancion', duracionSeg: 150, motor: 'lyria3', ...parcial };
    expect(receta.artistaId).toBe('art_1');
  });
});

describe('guardar y borrar un artista', () => {
  it('nace con su ADN limpio y su portada; editarlo no le cambia la cara', () => {
    const a = nuevoArtista('  Lola   Niebla ', { ...rumba, instrumentos: ['cajón', 'Cajón'] }, { ahora: 5, id: 'art_x' });
    expect(a.nombre).toBe('Lola Niebla');
    expect(a.adn.instrumentos).toEqual(['cajón']);
    expect(a.portada.tipo).toBe('generativa');
    const b = artistaEditado(a, 'Lola Bruma', piano, 9);
    expect(b.portada).toEqual(a.portada);
    expect(b.adn.voz).toBe('');
    expect(b.actualizadoEn).toBe(9);
  });

  it('borrar un artista deja sus canciones (sin artista) y apaga su «Tu semana con…»', async () => {
    const almacen = almacenEnMemoria();
    const lola = nuevoArtista('Lola Niebla', rumba, { id: 'art_1' });
    await almacen.artistas.poner(lola);
    const receta: Receta = { tipo: 'cancion', frase: 'x', conVoz: true, duracionSeg: 150, motor: 'lyria3', artistaId: 'art_1' };
    await almacen.canciones.poner(nuevaCancion(receta, { titulo: 'Suya', id: 'can_1' }));
    const semana = semanaCon(lola, { id: 'pl_1', ahora: 0 });
    await almacen.playlists.poner({ ...semana, cancionIds: ['can_1'] });

    await borrarArtistaSinPerder(almacen, 'art_1');

    expect(await almacen.artistas.leer('art_1')).toBeNull();
    const cancion = await almacen.canciones.leer('can_1');
    expect(cancion).not.toBeNull();
    expect(cancion?.artistaId).toBeUndefined();
    const playlist = await almacen.playlists.leer('pl_1');
    expect(playlist?.viva).toBeUndefined();
    expect(playlist?.cancionIds).toEqual(['can_1']);
  });
});
