import { describe, expect, it } from 'vitest';
import { combinar, moverCancion, sinCancion } from '../playlists/editar';
import { nuevaPlaylist } from '../playlists/playlist';
import { OCASIONES, conversacionVacia, decir, planDe, recetaDe, responder, siguientePregunta } from './conversacion';

function conOcasion(id: string) {
  const o = OCASIONES.find((x) => x.id === id)!;
  return decir(conversacionVacia(), o.frase, o.quiere);
}

describe('la conversación de crear', () => {
  it('«Créame una canción» pregunta el momento y la voz, y luego se puede hacer', () => {
    let e = conOcasion('cancion');
    expect(siguientePregunta(e)?.id).toBe('momento');
    e = responder(e, 'momento', 'desconectar');
    expect(siguientePregunta(e)?.id).toBe('voz');
    e = responder(e, 'voz', 'sin');
    expect(siguientePregunta(e)).toBeNull();
    const r = recetaDe(e, { falso: true });
    expect(r.tipo).toBe('cancion');
    expect(r.conVoz).toBe(false);
  });

  it('nunca pregunta más de tres cosas', () => {
    let e = decir(conversacionVacia(), 'hazme algo', 'paisaje');
    for (let i = 0; i < 6; i++) {
      const p = siguientePregunta(e);
      if (!p) break;
      e = responder(e, p.id, p.opciones[0].valor);
    }
    expect(e.respondidas.length).toBeLessThanOrEqual(3);
    expect(siguientePregunta(e)).toBeNull();
  });

  it('la de la migraña sale como paisaje de una hora con el tono de 142 Hz, lenta y sin voz', () => {
    let e = conOcasion('migrana');
    while (siguientePregunta(e)) {
      const p = siguientePregunta(e)!;
      e = responder(e, p.id, p.opciones[0].valor);
    }
    const r = recetaDe(e, { falso: true });
    expect(r.tipo).toBe('paisaje');
    expect(r.duracionSeg).toBe(3600);
    expect(r.capas?.tono?.hz).toBe(142);
    expect(r.conVoz).toBe(false);
  });

  it.each(['sofa', 'recoger', 'domingo', 'correr'])('«%s» es una playlist con su plan y su precio', (id) => {
    let e = conOcasion(id);
    expect(e.quiere).toBe('playlist');
    while (siguientePregunta(e)) {
      const p = siguientePregunta(e)!;
      e = responder(e, p.id, p.id === 'tamano' ? '4' : p.opciones[0].valor);
    }
    const plan = planDe(e, { falso: true });
    expect(plan.entradas.length).toBeGreaterThanOrEqual(4);
    expect(plan.imitacion).toBeNull();
  });

  it('«Funky con rollo jazz» lleva el funk y el jazz al estilo', () => {
    const e = conOcasion('funky-jazz');
    expect(e.parcial.estilo).toMatch(/funk/);
    expect(e.parcial.estilo).toMatch(/jazz/);
  });

  it('recoger y domingo contento piden energía; sofá chill, calma', () => {
    expect(conOcasion('recoger').parcial.energia).toBeGreaterThanOrEqual(0.6);
    expect(conOcasion('domingo').parcial.energia).toBeGreaterThanOrEqual(0.6);
    expect(conOcasion('sofa').parcial.momento).toBe('desconectar');
  });

  it('si pide parecerse a alguien real, no pregunta: se para', () => {
    const e = decir(conversacionVacia(), 'una canción que suene como Rosalía');
    expect(e.imitacion).toBe('Rosalía');
    expect(siguientePregunta(e)).toBeNull();
  });
});

describe('cambiar y combinar playlists', () => {
  const a = nuevaPlaylist({ nombre: 'Sofá', cancionIds: ['1', '2', '3'], porques: { '1': 'abre suave' } }, { id: 'a', ahora: 1 });
  const b = nuevaPlaylist({ nombre: 'Domingo', cancionIds: ['4', '2', '5'] }, { id: 'b', ahora: 1 });

  it('combinar mezcla una de cada, sin repetir, y no toca las de origen', () => {
    const c = combinar([a, b], undefined, 2);
    expect(c.cancionIds).toEqual(['1', '4', '2', '3', '5']);
    expect(c.nombre).toBe('Sofá + Domingo');
    expect(c.porques?.['1']).toBe('abre suave');
    expect(a.cancionIds).toEqual(['1', '2', '3']);
  });

  it('quitar y mover', () => {
    expect(sinCancion(a, '2').cancionIds).toEqual(['1', '3']);
    expect(moverCancion(a, '3', -1).cancionIds).toEqual(['1', '3', '2']);
    expect(moverCancion(a, '1', -1).cancionIds).toEqual(['1', '2', '3']);
  });
});
