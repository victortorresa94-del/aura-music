import { describe, expect, it } from 'vitest';
import { diagnosticoDeMicro, microImposible } from './errores';

const bien = { seguro: true, hayApi: true, conEntradaElegida: false };
const fallo = (name: string) => Object.assign(new Error(name), { name });

describe('el micro, dicho claro', () => {
  it('por http no se puede ni intentar (el enlace del ordenador en casa)', () => {
    expect(microImposible({ ...bien, seguro: false })).toContain('https');
    expect(microImposible({ ...bien, hayApi: false })).toContain('navegador');
    expect(microImposible(bien)).toBeNull();
  });

  it('sin permiso, dice dónde se da en el iPhone', () => {
    const d = diagnosticoDeMicro(fallo('NotAllowedError'), bien);
    expect(d.denegado).toBe(true);
    expect(d.mensaje).toContain('Ajustes › Safari › Micrófono');
  });

  it('una entrada elegida que ya no existe: se vuelve a probar con la de siempre', () => {
    expect(diagnosticoDeMicro(fallo('OverconstrainedError'), { ...bien, conEntradaElegida: true }).reintentarConLaDeSiempre).toBe(true);
    expect(diagnosticoDeMicro(fallo('NotFoundError'), bien)).toMatchObject({ reintentarConLaDeSiempre: false, mensaje: 'No encuentro ningún micro conectado.' });
  });

  it('el micro ocupado por una llamada', () => {
    expect(diagnosticoDeMicro(fallo('NotReadableError'), bien).mensaje).toContain('ocupado');
  });

  it('por http, el motivo es ese aunque el error sea otro', () => {
    expect(diagnosticoDeMicro(new TypeError('undefined'), { ...bien, seguro: false }).mensaje).toContain('https');
  });
});
