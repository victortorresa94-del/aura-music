import { describe, expect, it } from 'vitest';
import type { PlaylistViva, Receta } from '../tipos';
import {
  cuantasCaben,
  cuantoPuedeGastar,
  debeRenovar,
  gastadoEsteMes,
  mesDe,
  nuevaViva,
  semanaCon,
  semanaDe,
  textoProxima,
  textoQuedan,
  textoRitmo,
  textoTope,
  topeSugerido,
  trasRenovar,
} from './viva';

const receta: Receta = { tipo: 'cancion', frase: 'Una nueva de Lola Niebla', conVoz: true, duracionSeg: 150, motor: 'lyria3' };
// Hora del móvil. El 30 de noviembre de 2026 es lunes.
const en = (dia: number, hora = 10, mes = 10, anio = 2026) => new Date(anio, mes, dia, hora).getTime();

function viva(datos: Partial<PlaylistViva> = {}): PlaylistViva {
  return { cada: 'semana', nuevas: 1, topeCreditosMes: 30, gastadoMes: 0, mes: '2026-11', receta, ...datos };
}

describe('cuándo se renueva', () => {
  it('nunca renovada: toca ya', () => {
    expect(debeRenovar(viva(), en(27))).toBe(true);
  });

  it('cada día: una vez por día natural', () => {
    const v = viva({ cada: 'dia', ultimaRenovacion: en(27, 9) });
    expect(debeRenovar(v, en(27, 23))).toBe(false);
    expect(debeRenovar(v, en(28, 0))).toBe(true);
  });

  it('cada semana: llega los lunes, como Discover Weekly', () => {
    const v = viva({ ultimaRenovacion: en(27) }); // viernes
    expect(debeRenovar(v, en(29, 23))).toBe(false); // domingo
    expect(debeRenovar(v, en(30, 0))).toBe(true); // lunes
    const lunes = viva({ ultimaRenovacion: en(30, 8) });
    expect(debeRenovar(lunes, en(30, 22))).toBe(false);
    expect(debeRenovar(lunes, en(6, 10, 11))).toBe(false); // domingo 6 de diciembre
    expect(debeRenovar(lunes, en(7, 10, 11))).toBe(true);
  });
});

describe('el tope al mes', () => {
  it('lo que queda: tope menos lo gastado, nunca negativo', () => {
    expect(cuantoPuedeGastar(viva({ gastadoMes: 12 }), en(27))).toBe(18);
    expect(cuantoPuedeGastar(viva({ gastadoMes: 50 }), en(27))).toBe(0);
  });

  it('al cambiar de mes, lo gastado vuelve a cero', () => {
    const v = viva({ gastadoMes: 30, mes: '2026-11' });
    expect(cuantoPuedeGastar(v, en(30))).toBe(0);
    expect(cuantoPuedeGastar(v, en(1, 10, 11))).toBe(30);
    expect(gastadoEsteMes(v, en(1, 10, 11))).toBe(0);
    expect(mesDe(en(1, 10, 0, 2027))).toBe('2027-01');
  });

  it('caben las que pide o menos; una que no cabe entera no se hace', () => {
    expect(cuantasCaben(viva({ nuevas: 2, gastadoMes: 0 }), en(27))).toBe(2);
    expect(cuantasCaben(viva({ nuevas: 2, gastadoMes: 20 }), en(27))).toBe(1); // quedan 10: una de 6
    expect(cuantasCaben(viva({ nuevas: 2, gastadoMes: 25 }), en(27))).toBe(0); // quedan 5
    expect(cuantasCaben(viva({ receta: { ...receta, motor: 'falso' }, gastadoMes: 30 }), en(27))).toBe(1);
  });

  it('tras renovar: apunta lo gastado en su mes y la fecha, y nunca pasa del tope', () => {
    const v = trasRenovar(viva({ gastadoMes: 24 }), 6, en(30));
    expect(v.gastadoMes).toBe(30);
    expect(v.ultimaRenovacion).toBe(en(30));
    expect(trasRenovar(viva({ gastadoMes: 24 }), 60, en(30)).gastadoMes).toBe(30);
    const otroMes = trasRenovar(viva({ gastadoMes: 30, mes: '2026-11' }), 6, en(7, 10, 11));
    expect(otroMes).toMatchObject({ mes: '2026-12', gastadoMes: 6 });
  });

  it('el tope sugerido cubre todas las renovaciones de un mes', () => {
    expect(topeSugerido('semana', 1, receta)).toBe(30); // 5 lunes × 6
    expect(topeSugerido('dia', 2, receta)).toBe(372);
    expect(nuevaViva({ cada: 'semana', nuevas: 1, receta }, en(27))).toMatchObject({ topeCreditosMes: 30, gastadoMes: 0, mes: '2026-11' });
  });
});

describe('lo que se ve siempre en una playlist viva', () => {
  it('el ritmo, lo que queda y el tope', () => {
    expect(textoRitmo(viva())).toBe('Una canción nueva cada lunes');
    expect(textoRitmo(viva({ cada: 'dia', nuevas: 2 }))).toBe('2 canciones nuevas cada día');
    expect(textoQuedan(viva({ gastadoMes: 6 }), en(27))).toBe('Quedan 24 créditos este mes');
    expect(textoQuedan(viva({ gastadoMes: 29 }), en(27))).toBe('Queda 1 crédito este mes');
    expect(textoQuedan(viva({ gastadoMes: 30 }), en(27))).toBe('No quedan créditos este mes');
    expect(textoTope(viva())).toBe('Tope: 30 créditos al mes');
  });

  it('cuándo llega la próxima, o por qué no llega', () => {
    expect(textoProxima(viva({ ultimaRenovacion: en(27) }), en(28))).toBe('La próxima, el lunes');
    expect(textoProxima(viva({ cada: 'dia', ultimaRenovacion: en(27) }), en(27, 12))).toBe('La próxima, mañana');
    expect(textoProxima(viva(), en(27))).toBe('Se renueva al abrir aura Music');
    // Sin sitio este mes y el próximo lunes sigue siendo noviembre.
    expect(textoProxima(viva({ ultimaRenovacion: en(16), gastadoMes: 30 }), en(17))).toBe(
      'Ya no caben más este mes: vuelve en diciembre',
    );
    // El próximo lunes ya es diciembre: vuelve a haber sitio.
    expect(textoProxima(viva({ ultimaRenovacion: en(30), gastadoMes: 30 }), en(30, 12))).toBe('La próxima, el lunes');
  });
});

describe('«Tu semana con…»', () => {
  const lola = {
    id: 'art_1',
    nombre: 'Lola Niebla',
    adn: { estilo: 'rumba lenta', instrumentos: ['cajón'], voz: 'grave', tempo: { min: 90, max: 110 } },
  };

  it('una canción nueva cada lunes, con el tope de los lunes del mes', () => {
    const p = semanaCon(lola, { ahora: en(27), id: 'pl_1' });
    expect(p.nombre).toBe('Tu semana con Lola Niebla');
    expect(p.cancionIds).toEqual([]);
    expect(p.viva).toMatchObject({ cada: 'semana', nuevas: 1, topeCreditosMes: 30, gastadoMes: 0, mes: '2026-11' });
    expect(p.viva?.receta).toMatchObject({ tipo: 'cancion', artistaId: 'art_1', conVoz: true, idioma: 'es', bpm: 100 });
    expect(p.viva?.ultimaRenovacion).toBeUndefined();
    expect(semanaDe([p], 'art_1')).toBe(p);
    expect(semanaDe([p], 'art_2')).toBeUndefined();
  });
});
