import { describe, expect, it } from 'vitest';
import { almacenEnMemoria } from './almacen';
import {
  borradoresCaducados,
  borrarCancionEntera,
  guardadasRecientes,
  nuevaCancion,
  nuevaVersion,
  quedarme,
  semillaDe,
  versionQueSuena,
} from './biblioteca';
import type { Receta, Version } from './tipos';

const receta: Receta = { tipo: 'cancion', frase: 'una para la migraña', conVoz: false, duracionSeg: 150, motor: 'lyria3' };
const DIA = 24 * 60 * 60 * 1000;

function lista(v: Version): Version {
  return { ...v, estado: 'lista', audioId: `aud_${v.id}` };
}

describe('biblioteca de bolsillo', () => {
  it('una canción nace como borrador, con su portada estable', () => {
    const c = nuevaCancion(receta, { titulo: 'Tarde tranquila', ahora: 1000, id: 'can_1' });
    expect(c.guardada).toBe(false);
    expect(c.portada).toEqual({ tipo: 'generativa', semilla: semillaDe('can_1:Tarde tranquila') });
    expect(nuevaCancion(receta, { titulo: '  ', id: 'x' }).titulo).toBe('Sin título');
  });

  it('las versiones se numeran solas y un paisaje suena en bucle', () => {
    const c = nuevaCancion(receta, { titulo: 'A', id: 'can_1' });
    const v1 = nuevaVersion(c, [], receta, { cambio: 'Primera', creditos: 6, id: 'v1' });
    const v2 = nuevaVersion(c, [v1], receta, { cambio: 'Más lenta', creditos: 6, id: 'v2' });
    expect([v1.n, v2.n]).toEqual([1, 2]);
    expect(v1.estado).toBe('generando');
    const paisaje = nuevaVersion(c, [], { ...receta, tipo: 'paisaje', duracionSeg: 3600 }, { cambio: 'x', creditos: 6 });
    expect(paisaje.bucle).toBe(true);
  });

  it('suena la elegida; si no hay, la última lista; nunca una que se está generando', () => {
    const c = nuevaCancion(receta, { titulo: 'A', id: 'can_1' });
    const v1 = lista(nuevaVersion(c, [], receta, { cambio: '1', creditos: 6, id: 'v1' }));
    const v2 = lista(nuevaVersion(c, [v1], receta, { cambio: '2', creditos: 6, id: 'v2' }));
    const v3 = nuevaVersion(c, [v1, v2], receta, { cambio: '3', creditos: 6, id: 'v3' });
    expect(versionQueSuena(c, [v1, v2, v3])?.id).toBe('v2');
    const guardada = quedarme(c, 'v1');
    expect(guardada.guardada).toBe(true);
    expect(versionQueSuena(guardada, [v1, v2, v3])?.id).toBe('v1');
    expect(versionQueSuena(c, [v3])).toBeNull();
  });

  it('los borradores se limpian a los 30 días, salvo los que están en una playlist', () => {
    const vieja = { ...nuevaCancion(receta, { titulo: 'v', id: 'vieja', ahora: 0 }) };
    const enLista = { ...nuevaCancion(receta, { titulo: 'l', id: 'en-lista', ahora: 0 }) };
    const nueva = nuevaCancion(receta, { titulo: 'n', id: 'nueva', ahora: 29 * DIA });
    const guardada = quedarme(nuevaCancion(receta, { titulo: 'g', id: 'g', ahora: 0 }), 'v', 0);
    const caducadas = borradoresCaducados([vieja, enLista, nueva, guardada], new Set(['en-lista']), 31 * DIA);
    expect(caducadas.map((c) => c.id)).toEqual(['vieja']);
  });

  it('la biblioteca enseña solo las guardadas, lo último escuchado primero', () => {
    const a = { ...quedarme(nuevaCancion(receta, { titulo: 'a', id: 'a', ahora: 1 }), 'v', 1), ultimaEscucha: 50 };
    const b = quedarme(nuevaCancion(receta, { titulo: 'b', id: 'b', ahora: 2 }), 'v', 100);
    const borrador = nuevaCancion(receta, { titulo: 'c', id: 'c', ahora: 200 });
    expect(guardadasRecientes([a, b, borrador]).map((c) => c.id)).toEqual(['b', 'a']);
  });

  it('borrar una canción se lleva sus versiones y sus audios', async () => {
    const almacen = almacenEnMemoria();
    const c = nuevaCancion(receta, { titulo: 'A', id: 'can_1' });
    const v1 = lista(nuevaVersion(c, [], receta, { cambio: '1', creditos: 6, id: 'v1' }));
    const otra = lista(nuevaVersion({ ...c, id: 'can_2' }, [], receta, { cambio: '1', creditos: 6, id: 'v9' }));
    await almacen.canciones.poner(c);
    await almacen.versiones.poner(v1);
    await almacen.versiones.poner(otra);
    await almacen.audios.poner('aud_v1', new Blob(['x']));
    await almacen.audios.poner('aud_v9', new Blob(['y']));
    const cambios: string[] = [];
    almacen.suscribir((cambio) => cambios.push(`${cambio.coleccion}:${cambio.id}`));

    await borrarCancionEntera(almacen, 'can_1');

    expect(await almacen.canciones.leer('can_1')).toBeNull();
    expect(await almacen.versiones.leer('v1')).toBeNull();
    expect(await almacen.audios.leer('aud_v1')).toBeNull();
    expect(await almacen.audios.leer('aud_v9')).not.toBeNull();
    expect(cambios).toContain('canciones:can_1');
  });
});
