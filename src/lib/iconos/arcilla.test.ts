import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { INSTRUMENTOS } from '@/lib/instrumentos/registro';
import { ARCILLA_DE_FAMILIA, ARCILLA_DE_INSTRUMENTO, IDS_ARCILLA, arcillaDe, urlArcilla } from './arcilla';

describe('iconos de arcilla', () => {
  it('cada id tiene su webp en public, ligero', () => {
    for (const id of IDS_ARCILLA) {
      const ruta = join(process.cwd(), 'public', urlArcilla(id));
      expect(existsSync(ruta), id).toBe(true);
      expect(statSync(ruta).size).toBeLessThan(30_000);
    }
  });

  it('cada instrumento y cada familia de «Tocar» tiene icono', () => {
    for (const def of INSTRUMENTOS) expect(IDS_ARCILLA).toContain(ARCILLA_DE_INSTRUMENTO[def.id]);
    for (const id of Object.values(ARCILLA_DE_FAMILIA)) expect(IDS_ARCILLA).toContain(id);
    expect(arcillaDe('no-existe')).toBe('altavoz');
  });
});
