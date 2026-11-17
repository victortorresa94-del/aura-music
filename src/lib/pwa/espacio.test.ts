import { describe, expect, it } from 'vitest';
import { esCuotaLlena, formatoBytes, nivelDeEspacio } from './espacio';

const MB = 1024 * 1024;
const GB = 1024 * MB;

describe('nivelDeEspacio', () => {
  it('holgado con sitio de sobra', () => {
    expect(nivelDeEspacio({ usado: 120 * MB, cuota: 2 * GB })).toBe('holgado');
  });

  it('casi lleno pasado el 90 %', () => {
    expect(nivelDeEspacio({ usado: 1.85 * GB, cuota: 2 * GB })).toBe('casi-lleno');
  });

  it('casi lleno si quedan menos de 80 MB aunque el porcentaje sea bajo', () => {
    expect(nivelDeEspacio({ usado: 40 * MB, cuota: 100 * MB })).toBe('casi-lleno');
  });

  it('lleno sin un byte libre, y holgado si no hay cuota que medir', () => {
    expect(nivelDeEspacio({ usado: 2 * GB, cuota: 2 * GB })).toBe('lleno');
    expect(nivelDeEspacio({ usado: 0, cuota: 0 })).toBe('holgado');
  });
});

describe('esCuotaLlena', () => {
  it('reconoce los nombres de cada navegador', () => {
    expect(esCuotaLlena({ name: 'QuotaExceededError' })).toBe(true);
    expect(esCuotaLlena({ name: 'NS_ERROR_DOM_QUOTA_REACHED' })).toBe(true);
    expect(esCuotaLlena({ name: 'UnknownError', message: 'Quota exceeded' })).toBe(true);
    expect(esCuotaLlena({ code: 22 })).toBe(true);
  });

  it('no confunde otros fallos con falta de sitio', () => {
    expect(esCuotaLlena({ name: 'AbortError', message: 'Transaction aborted' })).toBe(false);
    expect(esCuotaLlena(null)).toBe(false);
    expect(esCuotaLlena('quota')).toBe(false);
  });
});

describe('formatoBytes', () => {
  it('con coma decimal y las unidades de siempre', () => {
    expect(formatoBytes(512)).toBe('512 B');
    expect(formatoBytes(812 * 1024)).toBe('812 KB');
    expect(formatoBytes(8.44 * MB)).toBe('8,4 MB');
    expect(formatoBytes(84.3 * MB)).toBe('84 MB');
    expect(formatoBytes(2.13 * GB)).toBe('2,1 GB');
    expect(formatoBytes(10 * GB)).toBe('10 GB');
  });
});
