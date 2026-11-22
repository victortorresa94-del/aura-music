import { describe, expect, it } from 'vitest';
import type { Project, Track } from './types';
import { alPulso, compasVecino, cortarPista, nombreDeTrozo, pegarPista, pistaTrasBorrar, pistaVecina } from './edicion';

function pista(id: string, clip: Partial<Track['clip']> = {}, extra: Partial<Track> = {}): Track {
  return {
    id,
    name: id,
    clip: { bufferId: `buf_${id}`, start: 2, offset: 0.5, duration: 4, repeats: 1, ...clip },
    volume: 0.8,
    muted: false,
    soloed: false,
    sourceDuration: 10,
    createdAt: 0,
    ...extra,
  };
}

function idea(...tracks: Track[]): Project {
  return { id: 'p', name: 'Idea', bpm: 120, tracks, createdAt: 0, updatedAt: 0 };
}

describe('cortarPista', () => {
  it('parte el clip en dos pistas que suenan igual que antes', () => {
    const p = idea(pista('a'), pista('voz', {}, { mezcla: { panorama: -0.4 } as never, volume: 0.5 }), pista('c'));
    const corte = cortarPista(p, 'voz', 3.5)!;
    expect(corte).not.toBeNull();
    const [, izq, der] = corte.proyecto.tracks;
    expect(corte.proyecto.tracks.map((t) => t.id)).toEqual(['a', 'voz', corte.nuevaId, 'c']);
    expect(izq.clip).toMatchObject({ start: 2, offset: 0.5, duration: 1.5 });
    expect(der.clip).toMatchObject({ start: 3.5, offset: 2, duration: 2.5, bufferId: 'buf_voz' });
    // El final no se mueve, y la segunda mitad lleva la mezcla de la primera.
    expect(der.clip.start + der.clip.duration).toBeCloseTo(6);
    expect(der.volume).toBe(0.5);
    expect(der.mezcla).toEqual({ panorama: -0.4 });
    expect(der.name).toBe('voz (2)');
  });

  it('no corta fuera del clip ni pegado a un borde', () => {
    const p = idea(pista('a'));
    expect(cortarPista(p, 'a', 1)).toBeNull();
    expect(cortarPista(p, 'a', 2.01)).toBeNull();
    expect(cortarPista(p, 'a', 5.99)).toBeNull();
    expect(cortarPista(p, 'a', 7)).toBeNull();
    expect(cortarPista(p, 'nadie', 3)).toBeNull();
  });

  it('con repeticiones corta entre dos vueltas, la más cercana', () => {
    const p = idea(pista('loop', { start: 0, offset: 0, duration: 2, repeats: 4 }));
    const corte = cortarPista(p, 'loop', 4.7)!;
    expect(corte.ajustadoAVuelta).toBe(true);
    const [izq, der] = corte.proyecto.tracks;
    expect(izq.clip).toMatchObject({ start: 0, repeats: 2, duration: 2 });
    expect(der.clip).toMatchObject({ start: 4, repeats: 2, duration: 2, offset: 0 });
    // Justo en la frontera no hace falta ajustar.
    expect(cortarPista(p, 'loop', 6)!.ajustadoAVuelta).toBe(false);
    // Cerca del principio no hay vuelta que cortar.
    expect(cortarPista(p, 'loop', 0.6)).toBeNull();
  });

  it('la segunda mitad nunca sale en solo aunque la primera lo esté', () => {
    const p = idea(pista('a', {}, { soloed: true }));
    const corte = cortarPista(p, 'a', 3)!;
    expect(corte.proyecto.tracks[1].soloed).toBe(false);
  });
});

describe('nombreDeTrozo', () => {
  it('no repite un nombre que ya existe', () => {
    expect(nombreDeTrozo('Voz', [pista('Voz', {}, { name: 'Voz' })])).toBe('Voz (2)');
    expect(nombreDeTrozo('Voz (2)', [pista('x', {}, { name: 'Voz (2)' })])).toBe('Voz (3)');
  });
});

describe('pegarPista', () => {
  it('pega debajo de la elegida, con el clip en el cursor', () => {
    const p = idea(pista('a'), pista('b'));
    const { proyecto, nuevaId } = pegarPista(p, pista('a'), 9, 'a');
    expect(proyecto.tracks.map((t) => t.id)).toEqual(['a', nuevaId, 'b']);
    expect(proyecto.tracks[1].clip.start).toBe(9);
    expect(proyecto.tracks[1].clip.bufferId).toBe('buf_a');
  });

  it('sin elegida, al final', () => {
    const { proyecto, nuevaId } = pegarPista(idea(pista('a')), pista('a'), -3, null);
    expect(proyecto.tracks[1].id).toBe(nuevaId);
    expect(proyecto.tracks[1].clip.start).toBe(0);
  });
});

describe('pistaVecina y pistaTrasBorrar', () => {
  const p = idea(pista('a'), pista('b'), pista('c'));
  it('las flechas no se salen de la lista', () => {
    expect(pistaVecina(p, 'b', -1)).toBe('a');
    expect(pistaVecina(p, 'a', -1)).toBe('a');
    expect(pistaVecina(p, 'c', 1)).toBe('c');
    expect(pistaVecina(p, null, 1)).toBe('a');
    expect(pistaVecina(p, null, -1)).toBe('c');
    expect(pistaVecina(idea(), null, 1)).toBeNull();
  });
  it('al borrar, se elige la que ocupa su sitio', () => {
    expect(pistaTrasBorrar(p, 'b')).toBe('c');
    expect(pistaTrasBorrar(p, 'c')).toBe('b');
    expect(pistaTrasBorrar(idea(pista('a')), 'a')).toBeNull();
  });
});

describe('alPulso y compasVecino', () => {
  it('el imán solo pega lo que cae cerca', () => {
    expect(alPulso(1.05, 0.5, true)).toBe(1);
    expect(alPulso(1.2, 0.5, true)).toBe(1.2);
    expect(alPulso(1.05, 0.5, false)).toBe(1.05);
  });
  it('las flechas saltan de compás en compás', () => {
    expect(compasVecino(0, 2, 1)).toBe(2);
    expect(compasVecino(3, 2, 1)).toBe(4);
    expect(compasVecino(3, 2, -1)).toBe(2);
    expect(compasVecino(4, 2, -1)).toBe(2);
    expect(compasVecino(1, 2, -1)).toBe(0);
  });
});
