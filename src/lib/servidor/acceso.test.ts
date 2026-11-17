import { describe, expect, it } from 'vitest';
import { accesoPermitido, CABECERA_CODIGO, hayCandado } from './acceso';

const peticion = (codigo?: string) =>
  new Request('https://aura.test/api/productor', {
    method: 'POST',
    headers: codigo === undefined ? {} : { [CABECERA_CODIGO]: codigo },
  });

describe('candado', () => {
  it('sin variable no hay candado y todo pasa', () => {
    expect(hayCandado({})).toBe(false);
    expect(hayCandado({ AURA_MUSIC_CODIGO: '   ' })).toBe(false);
    expect(accesoPermitido(peticion(), {})).toBe(true);
  });

  it('pide el código y rechaza el que no es', () => {
    const env = { AURA_MUSIC_CODIGO: 'Flamenco24' };
    expect(accesoPermitido(peticion(), env)).toBe(false);
    expect(accesoPermitido(peticion('otro'), env)).toBe(false);
    expect(accesoPermitido(peticion('Flamenco24'), env)).toBe(true);
  });

  it('da igual un espacio pegado en Vercel o una mayúscula del teclado del iPhone', () => {
    const env = { AURA_MUSIC_CODIGO: ' Flamenco24 \n' };
    expect(accesoPermitido(peticion('flamenco24'), env)).toBe(true);
    expect(accesoPermitido(peticion(encodeURIComponent(' FLAMENCO24 ')), env)).toBe(true);
  });

  it('acepta tildes y eñes, que viajan codificadas', () => {
    const env = { AURA_MUSIC_CODIGO: 'Señorío' };
    expect(accesoPermitido(peticion(encodeURIComponent('señorío')), env)).toBe(true);
    // La misma palabra escrita con la tilde como carácter aparte (NFD) también vale.
    expect(accesoPermitido(peticion(encodeURIComponent('señorío'.normalize('NFD'))), env)).toBe(true);
    expect(accesoPermitido(peticion(encodeURIComponent('senorio')), env)).toBe(false);
  });

  it('un código mal codificado no rompe nada', () => {
    expect(accesoPermitido(peticion('%E0%A4%A'), { AURA_MUSIC_CODIGO: 'x' })).toBe(false);
  });
});
