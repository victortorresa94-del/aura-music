import { describe, expect, it } from 'vitest';
import type { Paquete } from './packs';
import { notasConMuestra, presetDe, tramoDeFuerza } from './preset';
import { INSTRUMENTOS, instrumentosDe, instrumentosDeAcordes } from './registro';

const base: Omit<Paquete, 'archivos' | 'id'> = {
  nombre: 'Prueba',
  obra: 'Prueba',
  autor: 'Nadie',
  origen: 'https://example.org',
  licencia: 'CC0-1.0',
  urlLicencia: 'https://creativecommons.org/publicdomain/zero/1.0/',
  creditos: '',
  sonido: { ataque: 0.001, suelta: 0.2 },
};

describe('preset de percusión', () => {
  const kit: Paquete = {
    ...base,
    id: 'bateria-acustica',
    percusion: true,
    archivos: [
      { nombre: '36-v1-r1.mp3', midi: 36, vel: [1, 70], rr: 1, bytes: 1 },
      { nombre: '36-v1-r2.mp3', midi: 36, vel: [1, 70], rr: 2, bytes: 1 },
      { nombre: '36-v2-r1.mp3', midi: 36, vel: [71, 127], rr: 1, bytes: 1 },
      { nombre: '42-v1-r1.mp3', midi: 42, vel: [1, 127], rr: 1, bytes: 1 },
      { nombre: '46-v1-r1.mp3', midi: 46, vel: [1, 127], rr: 1, bytes: 1 },
    ],
  };
  const preset = presetDe(kit);

  it('un grupo por nota y capa, sin transportar', () => {
    expect(preset.groups).toHaveLength(4);
    for (const grupo of preset.groups) {
      for (const region of grupo.regions) {
        expect(region.keyRange?.[0]).toBe(region.pitch);
        expect(region.keyRange?.[1]).toBe(region.pitch);
      }
    }
  });

  it('los golpes alternos se turnan', () => {
    const suave = preset.groups.find((g) => g.regions[0].sample === '36-v1-r1');
    expect(suave?.seqLength).toBe(2);
    expect(suave?.regions.map((r) => r.seqPosition)).toEqual([1, 2]);
    const fuerte = preset.groups.find((g) => g.regions[0].sample === '36-v2-r1');
    expect(fuerte?.seqLength).toBeUndefined();
    expect(fuerte?.velRange).toEqual([71, 127]);
  });

  it('el charles cerrado apaga el abierto', () => {
    const abierto = preset.groups.find((g) => g.regions[0].pitch === 46)?.regions[0];
    const cerrado = preset.groups.find((g) => g.regions[0].pitch === 42)?.regions[0];
    expect(abierto?.group).toBe(1);
    expect(cerrado?.offBy).toBe(1);
  });

  it('sabe qué notas tienen muestra', () => {
    expect([...notasConMuestra(kit)].sort()).toEqual([36, 42, 46]);
  });
});

describe('preset melódico', () => {
  it('cada muestra cubre hasta medio camino de las vecinas, con sus capas', () => {
    const preset = presetDe({
      ...base,
      id: 'bajo-dedos',
      archivos: [
        { nombre: '28-v1.mp3', midi: 28, vel: [1, 90], bytes: 1 },
        { nombre: '28-v2.mp3', midi: 28, vel: [91, 127], bytes: 1 },
        { nombre: '31.mp3', midi: 31, bytes: 1 },
      ],
    });
    const regiones = preset.groups[0].regions;
    expect(regiones[0].keyRange).toEqual([0, 29]);
    expect(regiones[2].keyRange).toEqual([30, 127]);
    expect(regiones[1].velRange).toEqual([91, 127]);
    expect(regiones[2].velRange).toEqual([1, 127]);
  });

  it('con bucle, la nota sostenida da vueltas sobre su parte quieta', () => {
    const preset = presetDe({ ...base, id: 'organo', bucle: { inicio: 0.35, fin: 0.86 }, archivos: [{ nombre: '60.mp3', midi: 60, bytes: 1 }] });
    expect(preset.groups[0].regions[0]).toMatchObject({ loop: true, loopAuto: { startRatio: 0.35, endRatio: 0.86 } });
    const sinBucle = presetDe({ ...base, id: 'piano', archivos: [{ nombre: '60.mp3', midi: 60, bytes: 1 }] });
    expect(sinBucle.groups[0].regions[0].loop).toBeUndefined();
  });

  it('entiende las capas del primer formato', () => {
    expect(tramoDeFuerza({ nombre: '60-p.mp3', midi: 60, capa: 'p', bytes: 1 })).toEqual([1, 84]);
    expect(tramoDeFuerza({ nombre: '60-f.mp3', midi: 60, capa: 'f', bytes: 1 })).toEqual([85, 127]);
  });
});

describe('registro v2', () => {
  it('hay seis bajos para elegir y el de antes queda solo para pistas viejas', () => {
    const bajos = instrumentosDe('bajo').map((d) => d.id);
    expect(bajos).toEqual(['bajo-dedos', 'bajo-pua', 'contrabajo', 'bajo-sub', 'bajo-808', 'bajo-analogico']);
    expect(INSTRUMENTOS.find((d) => d.id === 'bajo')?.oculto).toBe(true);
  });

  it('las tiras de acordes empiezan por Española, Piano y Cuerdas, como siempre', () => {
    const acordes = instrumentosDeAcordes().map((d) => d.id);
    expect(acordes.slice(0, 3)).toEqual(['guitarra', 'piano', 'cuerdas']);
    expect(acordes).toContain('guitarra-acero');
  });

  it('todos tienen icono, detalle y nombre corto', () => {
    for (const def of INSTRUMENTOS) {
      expect(def.icono).toBeTruthy();
      expect(def.detalle.length).toBeGreaterThan(2);
      expect(def.corto.length).toBeLessThanOrEqual(11);
    }
  });

  it('los kits nuevos tienen 16 pads sin notas repetidas', () => {
    for (const kit of instrumentosDe('bateria')) {
      expect(kit.pads).toHaveLength(16);
      expect(new Set(kit.pads?.map((p) => p.nota)).size).toBe(16);
    }
  });
});
