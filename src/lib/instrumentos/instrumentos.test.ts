import { describe, expect, it } from 'vitest';
import {
  notasDeEscala,
  patronAuto,
  posturaDeGuitarra,
  posturaDeTeclas,
  rasgueo,
  RASGUEO_MAX_MS,
  RASGUEO_MIN_MS,
  separacionDeRasgueo,
  tirasDeAcordes,
} from './acordes';
import { colocarEnRejilla, porInstrumento, recuperarFrase, type EventoTocado } from './grabacion';
import { INSTRUMENTOS, getInstrumento } from './registro';
import { medirToque } from './toque';

const ev = (t: number, nota = 36, extra: Partial<EventoTocado> = {}): EventoTocado => ({
  instrumento: 'bateria-808',
  nota,
  vel: 100,
  t,
  dur: null,
  pos: null,
  ...extra,
});

describe('tiras de acordes', () => {
  it('Do mayor da ocho tiras con los diatónicos, Si bemol y Sol7', () => {
    const tiras = tirasDeAcordes({ tonica: 0, modo: 'mayor' });
    expect(tiras.map((t) => t.nombre)).toEqual(['Do', 'Re m', 'Mi m', 'Fa', 'Sol', 'La m', 'Sib', 'Sol7']);
    expect(tiras[7].clases).toEqual([7, 11, 2, 5]);
  });

  it('Mi frigio da la cadencia andaluza', () => {
    const nombres = tirasDeAcordes({ tonica: 4, modo: 'frigio' }).map((t) => t.nombre);
    expect(nombres.slice(0, 4)).toEqual(['Mi', 'Fa', 'Sol', 'La m']);
    expect(nombres).toHaveLength(8);
  });

  it('las posturas de guitarra salen como en primera posición', () => {
    const [mi] = tirasDeAcordes({ tonica: 4, modo: 'mayor' });
    expect(posturaDeGuitarra(mi)).toEqual([40, 47, 52, 56, 59, 64]);
    const doMayor = tirasDeAcordes({ tonica: 0, modo: 'mayor' })[0];
    expect(posturaDeGuitarra(doMayor)).toEqual([null, 48, 52, 55, 60, 64]);
    const reMenor = tirasDeAcordes({ tonica: 0, modo: 'mayor' })[1];
    expect(posturaDeGuitarra(reMenor)).toEqual([null, null, 50, 57, 62, 65]);
  });

  it('todas las posturas tocan solo notas del acorde, con la raíz abajo', () => {
    for (const modo of ['mayor', 'menor', 'frigio'] as const) {
      for (let tonica = 0; tonica < 12; tonica++) {
        for (const acorde of tirasDeAcordes({ tonica, modo })) {
          const notas = posturaDeGuitarra(acorde).filter((n): n is number => n !== null);
          expect(notas.length).toBeGreaterThanOrEqual(4);
          expect(notas[0] % 12).toBe(acorde.raiz);
          expect(notas.every((n) => acorde.clases.includes(n % 12))).toBe(true);
        }
      }
    }
  });

  it('el piano enlaza las voces: del Do al Fa la mano casi no se mueve', () => {
    const [doM, , , fa] = tirasDeAcordes({ tonica: 0, modo: 'mayor' });
    const primero = posturaDeTeclas(doM, null, false);
    const segundo = posturaDeTeclas(fa, primero, false);
    const centro = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;
    expect(Math.abs(centro(segundo) - centro(primero))).toBeLessThan(3);
    expect(posturaDeTeclas(fa, primero, true)[0]).toBe(41);
  });

  it('la escala de La menor en una octava', () => {
    expect(notasDeEscala({ tonica: 9, modo: 'menor' }, 57, 69)).toEqual([57, 59, 60, 62, 64, 65, 67, 69]);
  });
});

describe('rasgueo', () => {
  it('la separación va de 25 ms (lento) a 8 ms (rápido)', () => {
    expect(separacionDeRasgueo(0.05)).toBeCloseTo(RASGUEO_MAX_MS, 6);
    expect(separacionDeRasgueo(5)).toBeCloseTo(RASGUEO_MIN_MS, 6);
    expect(separacionDeRasgueo(0.5)).toBeGreaterThan(RASGUEO_MIN_MS);
    expect(separacionDeRasgueo(0.5)).toBeLessThan(RASGUEO_MAX_MS);
  });

  it('hacia abajo va de grave a agudo; hacia arriba al revés y sin las graves', () => {
    const postura = [40, 47, 52, 56, 59, 64];
    const abajo = rasgueo(postura, 'abajo', 10, 100);
    expect(abajo.map((n) => n.nota)).toEqual(postura);
    expect(abajo[5].desfase).toBeCloseTo(0.05, 9);
    const arriba = rasgueo(postura, 'arriba', 10, 100);
    expect(arriba[0].nota).toBe(64);
    expect(arriba.length).toBe(4);
    expect(arriba[0].vel).toBeLessThan(abajo[0].vel);
  });

  it('el patrón automático de guitarra cabe en el compás', () => {
    const pasos = patronAuto('guitarra', 4);
    expect(pasos.every((p) => p.beat >= 0 && p.beat < 4)).toBe(true);
    expect(patronAuto('guitarra', 3).every((p) => p.beat < 3)).toBe(true);
  });
});

describe('grabación', () => {
  const bpm = 120; // pulso = 0,5 s; compás de 4 = 2 s

  it('el clip empieza en el compás del primer golpe y dura compases enteros', () => {
    const eventos = [ev(0), ev(0), ev(0)];
    const clip = colocarEnRejilla(eventos, [2.1, 2.6, 3.0], { bpm, pulsosPorCompas: 4, cola: false });
    expect(clip?.inicio).toBeCloseTo(2, 9);
    expect(clip?.golpes[0].beat).toBeCloseTo(0.2, 9);
    expect(clip?.pulsos).toBe(4);
  });

  it('las notas con cola se dejan un pulso más para que no se corten', () => {
    const clip = colocarEnRejilla([ev(0, 60, { dur: 0.5 })], [3.4], { bpm, pulsosPorCompas: 4, cola: true });
    // Empieza en el pulso 6,8 del proyecto, el 2,8 del clip; con el pulso de cola llega al 4,8.
    expect(clip?.pulsos).toBe(8);
  });

  it('recupera la última frase después de un silencio', () => {
    const captura = [ev(1), ev(1.5), ev(10), ev(10.25), ev(10.5)];
    const frase = recuperarFrase(captura, { cursor: 4.1, bpm });
    expect(frase?.eventos).toHaveLength(3);
    // Sin transporte: el primero cae en el pulso más cercano al cursor.
    expect(frase?.posiciones[0]).toBeCloseTo(4, 9);
    expect(frase?.posiciones[2]).toBeCloseTo(4.5, 9);
  });

  it('si sonaba el transporte, usa las posiciones de verdad', () => {
    const captura = [ev(10, 36, { pos: 3 }), ev(10.5, 36, { pos: 3.5 })];
    expect(recuperarFrase(captura, { cursor: 0, bpm })?.posiciones).toEqual([3, 3.5]);
  });

  it('una pista por instrumento', () => {
    const grupos = porInstrumento([ev(0), ev(0.1, 60, { instrumento: 'piano' }), ev(0.2)], [0, 0.1, 0.2]);
    expect(grupos.get('bateria-808')?.eventos).toHaveLength(2);
    expect(grupos.get('piano')?.posiciones).toEqual([0.1]);
  });
});

describe('calibración del toque', () => {
  it('la mediana de los desvíos, sin dejarse engañar por un toque despistado', () => {
    const clicks = Array.from({ length: 12 }, (_, i) => i * 0.6);
    const toques = [0.04, 0.64, 1.24, 1.83, 2.45, 3.04, 3.64, 4.2 + 0.18];
    expect(medirToque(toques, clicks)).toBe(40);
  });

  it('con menos de seis toques no hay medida', () => {
    expect(medirToque([0.04, 0.64], [0, 0.6])).toBeNull();
  });
});

describe('registro', () => {
  it('los kits tienen 16 pads con las mismas notas General MIDI', () => {
    // La percusión latina tiene sus propias notas (congas, bongós, timbales).
    const kits = INSTRUMENTOS.filter((i) => i.pads && i.id !== 'percusion-latina');
    expect(kits.length).toBe(4);
    const notas = kits[0].pads?.map((p) => p.nota);
    for (const k of kits) {
      expect(k.pads).toHaveLength(16);
      expect(k.pads?.map((p) => p.nota)).toEqual(notas);
    }
    expect(getInstrumento('bateria-909').pads?.find((p) => p.nota === 36)?.voz).toBe('bombo_909');
  });
});
