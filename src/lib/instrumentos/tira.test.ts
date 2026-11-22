import { describe, expect, it } from 'vitest';
import type { Track } from '@/lib/daw/types';
import { bloquesDeAudio, compasAnterior, compasDe, compasesVisibles, notasEnVentana, paginaDe, plegar } from './tira';

const pista = (o: Partial<Track> & { clip: Track['clip'] }): Track =>
  ({ id: 'x', name: 'x', volume: 1, muted: false, soloed: false, sourceDuration: 10, createdAt: 0, ...o }) as Track;

describe('la tira de tiempo de «Tocar»', () => {
  it('caben unos 28 px por compás, de cuatro en cuatro a partir de ocho', () => {
    expect(compasesVisibles(100)).toBe(4);
    expect(compasesVisibles(190)).toBe(6);
    // La tira de un móvil de 375 px mide unos 231: ocho compases, una frase.
    expect(compasesVisibles(231)).toBe(8);
    expect(compasesVisibles(700)).toBe(24);
    expect(compasesVisibles(5000)).toBe(32);
  });

  it('el compás del cursor y el «atrás» de un reproductor', () => {
    // 120 BPM en 4/4: compás de 2 s, pulso de 0,5 s.
    expect(compasDe(0, 2)).toBe(0);
    expect(compasDe(3.99, 2)).toBe(1);
    expect(compasDe(4, 2)).toBe(2);
    // Entrado en el compás 2 (4,6 s): vuelve a su principio.
    expect(compasAnterior(4.6, 2, 0.5)).toBe(2);
    // En su principio (o casi): al anterior.
    expect(compasAnterior(4.05, 2, 0.5)).toBe(1);
    expect(compasAnterior(0, 2, 0.5)).toBe(0);
  });

  it('se ve por páginas, y el loop entero si lo hay', () => {
    expect(paginaDe(0, 8)).toBe(0);
    expect(paginaDe(9, 8)).toBe(8);
    expect(paginaDe(9, 8, { desdeCompas: 6, compases: 4 })).toBe(0);
  });

  it('lo tocado en un loop se pliega a sus compases', () => {
    const bucle = { desde: 4, largo: 2 };
    expect(plegar(4.5, bucle)).toBeCloseTo(4.5);
    expect(plegar(6.25, bucle)).toBeCloseTo(4.25);
    expect(plegar(9.9, bucle)).toBeCloseTo(5.9);
    expect(plegar(3, null)).toBe(3);
  });

  it('las notas de las pistas, con repeticiones y recorte, en su sitio', () => {
    // 120 BPM: un pulso = 0,5 s. Clip de 2 s que empieza en 2 s y se repite dos veces.
    const bajo = pista({
      clip: { bufferId: 'a', start: 2, offset: 0, duration: 2, repeats: 2 },
      notas: { instrumento: 'bajo-dedos', bruto: [], golpes: [{ beat: 0, dur: 1, nota: 40, vel: 100 }, { beat: 3, dur: 0.5, nota: 43, vel: 90 }], ajustes: { limpiar: true, cuadrar: null, humanizar: null }, bpm: 120, pulsosPorCompas: 4, sonido: 'muestras' },
    } as never);
    const piano = pista({
      clip: { bufferId: 'b', start: 0, offset: 0, duration: 4, repeats: 1 },
      notas: { instrumento: 'piano', bruto: [], golpes: [{ beat: 1, dur: 1, nota: 60, vel: 80 }], ajustes: { limpiar: true, cuadrar: null, humanizar: null }, bpm: 120, pulsosPorCompas: 4, sonido: 'muestras' },
    } as never);
    const silenciada = { ...piano, id: 'm', muted: true };
    const notas = notasEnVentana([bajo, piano, silenciada], 120, 0, 8, 'bajo-dedos');
    const propias = notas.filter((n) => n.tipo === 'propia').map((n) => [n.t, n.nota]);
    expect(propias).toEqual([
      [2, 40],
      [3.5, 43],
      [4, 40],
      [5.5, 43],
    ]);
    expect(notas.filter((n) => n.tipo === 'otra')).toEqual([{ t: 0.5, dur: 0.5, nota: 60, tipo: 'otra' }]);
    // Fuera de la ventana no entra nada.
    expect(notasEnVentana([bajo], 120, 6, 8, 'bajo-dedos')).toEqual([]);
  });

  it('el audio grabado se ve como bloques, recortados a lo que se ve', () => {
    const voz = pista({ clip: { bufferId: 'v', start: 1, offset: 0, duration: 3, repeats: 2 } });
    expect(bloquesDeAudio([voz], 0, 5)).toEqual([
      { desde: 1, hasta: 4 },
      { desde: 4, hasta: 5 },
    ]);
  });
});
