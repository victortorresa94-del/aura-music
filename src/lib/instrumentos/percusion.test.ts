import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

// «Tocar» tiene los tres paquetes de percusión ya en memoria: buffers de
// mentira con el nombre del fichero, para ver cuál suena.
vi.mock('./muestras', async () => {
  const { getPaquete } = await import('./packs');
  const { nombreDeMuestra } = await import('./preset');
  return {
    muestrasListas: (id: string) => {
      const p = getPaquete(id as never);
      return p ? new Map(p.archivos.map((a) => [nombreDeMuestra(a.nombre), { nombre: a.nombre } as unknown as AudioBuffer])) : null;
    },
    obtenerMuestra: vi.fn(),
    recortarInicio: (b: AudioBuffer) => b,
  };
});

import { golpesDelPaso, type AjustesClaqueta } from '@/lib/daw/claqueta/claqueta';
import { VOICE_NAMES, type VoiceId } from '@/lib/daw/rhythm/kit';
import { GROOVES } from '@/lib/daw/rhythm/grooves';
import { getPaquete } from './packs';
import { archivosDe, capaPara, fuenteDe, MUESTRA_DE_VOZ, tocarMuestra, vocesDeRitmos, vozLista } from './percusion';
import { INSTRUMENTOS } from './registro';

const TODAS = Object.keys(VOICE_NAMES) as VoiceId[];
const DE_MAQUINA = TODAS.filter((v) => /_(808|909)$/.test(v));
const ACUSTICAS = TODAS.filter((v) => !DE_MAQUINA.includes(v));

describe('percusión de verdad', () => {
  it('cada voz acústica tiene su muestra CC0, y el fichero está en disco', () => {
    for (const voz of ACUSTICAS) {
      const fuente = fuenteDe(voz);
      expect(fuente, `${voz} sin muestra: sonaría sintetizada`).not.toBeNull();
      const paquete = getPaquete(fuente!.paquete)!;
      expect(paquete.licencia).toBe('CC0-1.0');
      const archivos = archivosDe(voz);
      expect(archivos.length, `${voz}: el paquete ${paquete.id} no tiene la nota ${fuente!.nota}`).toBeGreaterThan(0);
      for (const a of archivos) expect(existsSync(join(process.cwd(), 'public', 'samples', paquete.id, a.nombre)), a.nombre).toBe(true);
    }
  });

  it('la 808 y la 909 siguen siendo síntesis: se eligen por cómo suenan', () => {
    for (const voz of DE_MAQUINA) expect(MUESTRA_DE_VOZ[voz]).toBeUndefined();
  });

  it('todo lo que tocan los ritmos y la claqueta tiene muestra', () => {
    const usadas = new Set<VoiceId>(GROOVES.flatMap((g) => g.hits.map((h) => h.voz)));
    const sonidos: AjustesClaqueta['sonido'][] = ['bombo', 'bombo-caja', 'shaker', 'palmas', 'baqueta'];
    for (const sonido of sonidos) {
      for (let paso = 0; paso < 8; paso++) {
        const ajustes = { sonido, subdivision: 'corcheas', acento: true } as unknown as AjustesClaqueta;
        for (const g of golpesDelPaso(ajustes, paso, 4)) if (g.voz.tipo === 'kit') usadas.add(g.voz.voz);
      }
    }
    for (const voz of usadas) expect(fuenteDe(voz), voz).not.toBeNull();
  });

  it('la precarga trae solo lo de los ritmos y la claqueta, y pesa poco', () => {
    const voces = vocesDeRitmos();
    for (const v of ['bombo', 'caja', 'charles', 'palma_seca', 'bongo_agudo', 'clave', 'shaker'] as VoiceId[]) expect(voces).toContain(v);
    // Platillos y toms solo los usan los kits de «Tocar», que los piden al abrirse.
    for (const v of ['platillo', 'ride', 'tom_grave', 'timbal_agudo'] as VoiceId[]) expect(voces).not.toContain(v);
    const bytes = voces.flatMap(archivosDe).reduce((s, a) => s + a.bytes, 0);
    expect(bytes).toBeLessThan(600_000);
  });

  it('en los kits con muestras no queda ningún pad sintetizado', () => {
    for (const def of INSTRUMENTOS.filter((d) => d.pads && d.paquete)) {
      const propias = new Set(getPaquete(def.paquete)!.archivos.map((a) => a.midi));
      for (const pad of def.pads!) {
        const cubierto = propias.has(pad.nota) || archivosDe(pad.voz).length > 0;
        expect(cubierto, `${def.id}: «${pad.nombre}» (${pad.nota}) sonaría sintetizado`).toBe(true);
      }
    }
  });

  it('la fuerza elige la capa: suave, media o fuerte', () => {
    const bombo = archivosDe('bombo');
    expect(capaPara(bombo, 0.2).every((a) => a.vel![1] === 48)).toBe(true);
    expect(capaPara(bombo, 0.6).every((a) => a.vel![0] === 49)).toBe(true);
    expect(capaPara(bombo, 1).every((a) => a.vel![0] === 97)).toBe(true);
    // Dos golpes alternos en cada capa.
    expect(capaPara(bombo, 1)).toHaveLength(2);
  });

  it('los golpes seguidos se alternan (round robin) y suenan con su fuerza', () => {
    type Falsa = { buffer: { nombre: string } | null; cuando?: number; connect: () => void; start: (t: number) => void; onended: null };
    const fuentes: Falsa[] = [];
    const ganancias: number[] = [];
    const ctx = {
      createBufferSource: () => {
        const f: Falsa = { buffer: null, connect: () => undefined, start: (t) => (f.cuando = t), onended: null };
        fuentes.push(f);
        return f;
      },
      createGain: () => {
        const g = { gain: { value: 1 }, connect: () => undefined, disconnect: () => undefined };
        queueMicrotask(() => ganancias.push(g.gain.value));
        return g;
      },
    } as unknown as BaseAudioContext;
    expect(vozLista('bongo_agudo')).toBe(true);
    for (let i = 0; i < 4; i++) expect(tocarMuestra('bongo_agudo', ctx, {} as AudioNode, 1 + i * 0.25, 0.9)).toBe(true);
    const nombres = fuentes.map((f) => f.buffer!.nombre);
    expect(nombres[0]).not.toBe(nombres[1]);
    expect(nombres[0]).toBe(nombres[2]);
    expect(nombres.every((n) => n.startsWith('60-v3'))).toBe(true);
    expect(fuentes.map((f) => f.cuando)).toEqual([1, 1.25, 1.5, 1.75]);
    // Una voz de caja de ritmos no tiene muestra: la toca la síntesis.
    expect(tocarMuestra('bombo_808', ctx, {} as AudioNode, 0, 1)).toBe(false);
  });
});
