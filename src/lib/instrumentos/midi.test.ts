import { describe, expect, it } from 'vitest';
import { leerMidi, notaParaInstrumento, velocidad } from './midi';

describe('teclado MIDI', () => {
  it('entiende notas, sueltas y el pedal', () => {
    expect(leerMidi([0x90, 60, 100])).toMatchObject({ tipo: 'nota', nota: 60, canal: 0 });
    expect(leerMidi([0x80, 60, 40])).toEqual({ tipo: 'suelta', nota: 60, canal: 0 });
    // Muchos teclados sueltan con «nota a fuerza 0».
    expect(leerMidi([0x90, 60, 0])).toEqual({ tipo: 'suelta', nota: 60, canal: 0 });
    expect(leerMidi([0xb0, 64, 127])).toEqual({ tipo: 'pedal', abajo: true, canal: 0 });
    expect(leerMidi([0xb0, 64, 0])).toEqual({ tipo: 'pedal', abajo: false, canal: 0 });
    expect(leerMidi([0x99, 36, 90])).toMatchObject({ tipo: 'nota', nota: 36, canal: 9 });
  });

  it('ignora lo que no es tocar (reloj, programa, rueda)', () => {
    expect(leerMidi([0xf8])).toEqual({ tipo: 'otro' });
    expect(leerMidi([0xc0, 5])).toEqual({ tipo: 'otro' });
    expect(leerMidi([0xe0, 0, 64])).toEqual({ tipo: 'otro' });
  });

  it('la fuerza crece con la tecla y nunca es 0', () => {
    expect(velocidad(1)).toBeGreaterThan(0);
    expect(velocidad(64)).toBeGreaterThan(velocidad(32));
    expect(velocidad(127)).toBe(1);
  });

  it('en la batería, cada tecla toca un pad', () => {
    const pads = [36, 37, 38, 39].map((nota) => ({ nota }));
    const kit = { pads, rango: [36, 75] as [number, number] };
    expect(notaParaInstrumento(kit, 38)).toBe(38);
    expect(notaParaInstrumento(kit, 40)).toBe(36);
    expect(notaParaInstrumento(kit, 35)).toBe(39);
  });

  it('en lo melódico, la nota se lleva a su registro por octavas', () => {
    const bajo = { rango: [28, 60] as [number, number] };
    expect(notaParaInstrumento(bajo, 40)).toBe(40);
    expect(notaParaInstrumento(bajo, 72)).toBe(60);
    expect(notaParaInstrumento(bajo, 70)).toBe(58);
    expect(notaParaInstrumento(bajo, 16)).toBe(28);
  });
});
