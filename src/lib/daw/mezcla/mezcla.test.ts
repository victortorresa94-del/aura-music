import { describe, expect, it } from 'vitest';
import type { Project } from '../types';
import { aplicarCambio, conMezcla, conPreajusteEn, conVolumen } from './acciones';
import { curvaCompresor, curvaSaturacion, gananciaDeEnvio, indiceDelPico, MARGEN_SATURACION, parametrosCompresor, saturar, segundosDeEco, subidaAutomaticaDb } from './efectos';
import { estadoDeMezcla, pistasQueSuenan } from './grafo';
import { dbDePosicion, posicionDeDb, posicionDeVolumen, textoDb, textoPanorama, textoVolumen, volumenDePosicion } from './escala';
import { respuestaDeSala, rt60De } from './sala';
import {
  conPreajuste,
  MASTER_POR_DEFECTO,
  masterDe,
  MEZCLA_NEUTRA,
  mezclaDe,
  preajuste,
  preajusteActual,
  PREAJUSTES,
  tieneEfectos,
} from './tipos';

describe('modelo de mezcla', () => {
  it('una pista guardada antes del mezclador sale neutra', () => {
    expect(mezclaDe({})).toEqual(MEZCLA_NEUTRA);
    expect(tieneEfectos(mezclaDe({}))).toBe(false);
    expect(masterDe({})).toEqual(MASTER_POR_DEFECTO);
  });

  it('lo que venga mal de disco o de Claude se queda en su rango', () => {
    const m = mezclaDe({ mezcla: { panorama: 3, graves: -40, reverb: Number.NaN, compresor: 0.4 } });
    expect(m).toMatchObject({ panorama: 1, graves: -12, reverb: 0, compresor: 0.4 });
    const master = masterDe({ master: { espacio: 'iglesia' as never, repeticiones: 2, limitador: 'sí' as never } });
    expect(master).toMatchObject({ espacio: 'sala', repeticiones: 0.85, limitador: true });
  });

  it('un preajuste no mueve el panorama y se reconoce después', () => {
    const voz = preajuste('voz-calida')!;
    const puesta = conPreajuste({ ...MEZCLA_NEUTRA, panorama: -0.3 }, voz);
    expect(puesta.panorama).toBe(-0.3);
    expect(preajusteActual(puesta, 'sala')).toBe('voz-calida');
    expect(preajusteActual({ ...puesta, agudos: 5 }, 'sala')).toBeNull();
    expect(preajusteActual(MEZCLA_NEUTRA, 'sala')).toBe('seco');
  });

  it('«Catedral» solo se reconoce con la reverb compartida en la catedral', () => {
    const catedral = conPreajuste(MEZCLA_NEUTRA, preajuste('catedral')!);
    expect(preajusteActual(catedral, 'catedral')).toBe('catedral');
    expect(preajusteActual(catedral, 'sala')).toBeNull();
  });

  it('están los seis preajustes que se piden', () => {
    expect(PREAJUSTES.map((p) => p.nombre)).toEqual([
      'Seco',
      'Voz cálida',
      'Guitarra flamenca',
      'Batería con pegada',
      'Sala',
      'Catedral',
    ]);
  });
});

describe('escala del fader', () => {
  it('ida y vuelta entre decibelios y altura', () => {
    for (const db of [-50, -30, -12, -6, -1, 0, 2, 6]) {
      expect(dbDePosicion(posicionDeDb(db))).toBeCloseTo(db, 6);
    }
    expect(posicionDeDb(0)).toBeCloseTo(0.78, 6);
    expect(dbDePosicion(0)).toBe(-Infinity);
    expect(posicionDeDb(-Infinity)).toBe(0);
  });

  it('es monótona: subir el fader nunca baja el volumen', () => {
    let anterior = -Infinity;
    for (let p = 0; p <= 1; p += 0.01) {
      const v = volumenDePosicion(p);
      expect(v).toBeGreaterThanOrEqual(anterior);
      anterior = v;
    }
    expect(posicionDeVolumen(1)).toBeCloseTo(0.78, 6);
  });

  it('se lee como un técnico', () => {
    expect(textoDb(-6)).toBe('−6,0');
    expect(textoDb(3)).toBe('+3,0');
    expect(textoDb(0.01)).toBe('0,0');
    expect(textoDb(-Infinity)).toBe('−∞');
    expect(textoVolumen(0.5)).toBe('−6,0 dB');
    expect(textoPanorama(0)).toBe('C');
    expect(textoPanorama(-0.4)).toBe('I 40');
    expect(textoPanorama(0.25)).toBe('D 25');
  });
});

describe('efectos', () => {
  it('el compresor a cero no comprime ni sube nada', () => {
    const p = parametrosCompresor(0);
    expect(p.ratio).toBe(1);
    expect(p.compensacion).toBe(1);
    for (const x of [0.01, 0.3, 1, 1.5]) expect(curvaCompresor(x, 0, 0, 1)).toBeCloseTo(x, 9);
  });

  it('la curva del compresor baja lo que pasa del umbral', () => {
    // Por debajo del umbral, intacta; muy por encima, la pendiente es 1/ratio.
    expect(curvaCompresor(0.01, -20, 6, 4)).toBeCloseTo(0.01, 9);
    const a = 20 * Math.log10(curvaCompresor(10 ** (-6 / 20), -20, 6, 4));
    const b = 20 * Math.log10(curvaCompresor(1, -20, 6, 4));
    expect((b - a) / 6).toBeCloseTo(0.25, 2);
    expect(subidaAutomaticaDb(-20, 6, 4)).toBeGreaterThan(5);
  });

  it('con más cantidad, más compresión, y la subida automática se compensa', () => {
    const suave = parametrosCompresor(0.2);
    const fuerte = parametrosCompresor(0.9);
    expect(fuerte.ratio).toBeGreaterThan(suave.ratio);
    expect(fuerte.umbral).toBeLessThan(suave.umbral);
    // A 0 dBFS, compresor + compensación: más bajo que la entrada, nunca un salto arriba.
    for (const p of [suave, fuerte]) {
      const salida = curvaCompresor(1, p.umbral, p.rodilla, p.ratio) * 10 ** (subidaAutomaticaDb(p.umbral, p.rodilla, p.ratio) / 20) * p.compensacion;
      expect(salida).toBeLessThan(1.01);
    }
  });

  it('la saturación a cero es una recta y no recorta hasta +12 dBFS', () => {
    const curva = curvaSaturacion(0);
    expect(curva[0]).toBeCloseTo(-MARGEN_SATURACION, 6);
    expect(curva[curva.length - 1]).toBeCloseTo(MARGEN_SATURACION, 6);
    expect(curva[(curva.length - 1) / 2]).toBeCloseTo(0, 9);
    expect(saturar(0.5, 0)).toBe(0.5);
  });

  it('la saturación deja igual lo flojo y redondea los picos', () => {
    expect(saturar(0.001, 0.6) / 0.001).toBeCloseTo(1, 3);
    expect(saturar(1, 0.6)).toBeLessThan(0.75);
    expect(saturar(-1, 0.6)).toBeCloseTo(-saturar(1, 0.6), 9);
  });

  it('el eco va a tempo', () => {
    expect(segundosDeEco(100, '1/4')).toBeCloseTo(0.6, 9);
    expect(segundosDeEco(100, '1/8')).toBeCloseTo(0.3, 9);
    expect(segundosDeEco(120, '1/4.')).toBeCloseTo(0.75, 9);
    expect(segundosDeEco(30, '1/4.')).toBeLessThanOrEqual(2.9);
  });

  it('un envío a cero no envía nada, y uno flojo ya se oye', () => {
    expect(gananciaDeEnvio(0)).toBe(0);
    expect(gananciaDeEnvio(1)).toBe(1);
    // El 22 % de «Voz cálida» queda a unos −10 dB, no a −26.
    expect(20 * Math.log10(gananciaDeEnvio(0.22))).toBeGreaterThan(-11);
  });
});

describe('respuesta de sala', () => {
  const sr = 48000;
  const rms = (datos: Float32Array, desde: number, hasta: number) => {
    let s = 0;
    for (let i = desde; i < hasta; i++) s += datos[i] * datos[i];
    return Math.sqrt(s / Math.max(1, hasta - desde));
  };

  it('es la misma cada vez: la semilla es fija', () => {
    const a = respuestaDeSala('sala', 0.5, sr);
    const b = respuestaDeSala('sala', 0.5, sr);
    // toEqual con 70 000 muestras tarda segundos: se compara a mano.
    const iguales = (x: Float32Array, y: Float32Array) => x.length === y.length && x.every((v, i) => v === y[i]);
    expect(iguales(a[0], b[0])).toBe(true);
    expect(iguales(a[1], b[1])).toBe(true);
    // Y los dos canales son distintos: la cola se abre en estéreo.
    expect(iguales(a[0], a[1])).toBe(false);
  });

  it('cae: al final hay mucha menos energía que al principio', () => {
    const [izq] = respuestaDeSala('sala', 0.5, sr);
    const decimo = Math.floor(izq.length / 10);
    expect(rms(izq, izq.length - decimo, izq.length)).toBeLessThan(rms(izq, 0, decimo * 2) / 100);
  });

  it('una catedral dura más que una sala, y una sala más que un estudio', () => {
    const largo = (espacio: 'estudio' | 'sala' | 'catedral') => respuestaDeSala(espacio, 0.5, sr)[0].length;
    expect(largo('catedral')).toBeGreaterThan(largo('sala'));
    expect(largo('sala')).toBeGreaterThan(largo('estudio'));
    expect(rt60De('sala', 1)).toBeGreaterThan(rt60De('sala', 0));
    expect(largo('catedral')).toBeLessThanOrEqual(5.5 * sr);
  });
});

describe('cambios de mezcla sobre el proyecto', () => {
  const proyecto = (): Project => ({
    id: 'p',
    name: 'Idea',
    bpm: 100,
    createdAt: 0,
    updatedAt: 0,
    tracks: [
      { id: 'a', name: 'Voz', clip: { bufferId: 'b1', start: 0, offset: 0, duration: 4, repeats: 1 }, volume: 1, muted: false, soloed: false, sourceDuration: 4, createdAt: 0 },
      { id: 'b', name: 'Guitarra', clip: { bufferId: 'b2', start: 0, offset: 0, duration: 4, repeats: 1 }, volume: 0.5, muted: true, soloed: false, sourceDuration: 4, createdAt: 0 },
    ],
  });

  it('cambia solo la pista que toca y no muta el original', () => {
    const p = proyecto();
    const q = conMezcla(p, 'a', { reverb: 0.4 });
    expect(mezclaDe(q.tracks[0]).reverb).toBe(0.4);
    expect(q.tracks[1]).toBe(p.tracks[1]);
    expect(p.tracks[0].mezcla).toBeUndefined();
  });

  it('el preajuste «Catedral» lleva la reverb compartida a la catedral', () => {
    const q = conPreajusteEn(proyecto(), 'b', 'catedral');
    expect(masterDe(q).espacio).toBe('catedral');
    expect(preajusteActual(mezclaDe(q.tracks[1]), masterDe(q).espacio)).toBe('catedral');
  });

  it('lo que pide el productor: preajuste y encima lo concreto', () => {
    const q = aplicarCambio(proyecto(), 'a', { preajuste: 'voz-calida', reverb: 50, volumenDb: 3, panorama: -20, graves: null });
    const m = mezclaDe(q.tracks[0]);
    expect(m.reverb).toBe(0.5);
    expect(m.compresor).toBe(preajuste('voz-calida')!.mezcla.compresor);
    expect(m.panorama).toBe(-0.2);
    expect(q.tracks[0].volume).toBeCloseTo(10 ** (3 / 20), 6);
  });

  it('el volumen no pasa de +6 dB', () => {
    expect(conVolumen(proyecto(), 'a', 9).tracks[0].volume).toBeCloseTo(10 ** (6 / 20), 6);
    expect(aplicarCambio(proyecto(), 'a', { volumenDb: 20 }).tracks[0].volume).toBeCloseTo(10 ** (6 / 20), 6);
  });

  it('con un solo puesto solo suena esa; sin solo, todas menos las silenciadas', () => {
    const p = proyecto();
    expect([...pistasQueSuenan(p.tracks)]).toEqual(['a']);
    const conSolo = { ...p, tracks: p.tracks.map((t) => (t.id === 'b' ? { ...t, soloed: true } : t)) };
    expect([...pistasQueSuenan(conSolo.tracks)]).toEqual(['b']);
  });

  it('el estado del grafo trae la mezcla neutra en una idea de antes', () => {
    const e = estadoDeMezcla(proyecto(), () => 1);
    expect(e.pistas[0]).toMatchObject({ id: 'a', canales: 1, volumen: 1, suena: true, mezcla: MEZCLA_NEUTRA });
    expect(e.pistas[1].suena).toBe(false);
    expect(e.master).toEqual(MASTER_POR_DEFECTO);
    // Una pista suelta para exportar suena aunque esté silenciada en la mezcla.
    expect(estadoDeMezcla(proyecto(), () => 1, [proyecto().tracks[1]]).pistas).toMatchObject([{ id: 'b', suena: true }]);
  });

  it('la latencia de la cadena es donde cae el golpe', () => {
    const r = new Float32Array(1000);
    r[288] = 0.5;
    r[289] = -0.3;
    expect(indiceDelPico(r)).toBe(288);
  });
});
