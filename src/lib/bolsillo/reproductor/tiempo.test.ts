import { describe, expect, it } from 'vitest';
import {
  ESCUCHA_SEG,
  FUNDIDO_SEG,
  apagaEnDe,
  cuidadoAlTocar,
  decidirParada,
  limiteDe,
  reloj,
  situarEnBucle,
  sumarSonado,
  totalEnBucle,
  umbralEscucha,
} from './tiempo';

const receta = (duracionSeg: number) => ({ duracionSeg });

describe('un paisaje en bucle', () => {
  it('su límite es la duración pedida; una canción no tiene límite propio', () => {
    expect(limiteDe({ bucle: true, receta: receta(3600) })).toBe(3600);
    expect(limiteDe({ receta: receta(150) })).toBeNull();
    expect(limiteDe({ bucle: true, receta: receta(0) })).toBeNull();
    expect(limiteDe({ bucle: true, receta: receta(Number.NaN) })).toBeNull();
  });

  it('el total sigue subiendo aunque el fichero vuelva a empezar', () => {
    // Vuelta de 150 s. Iba por 149,9 y el <audio> ya marca 0,2: es la segunda vuelta.
    expect(totalEnBucle(0.2, 150, 150.15)).toBeCloseTo(150.2, 5);
    // Antes de dar la vuelta, la primera.
    expect(totalEnBucle(149.8, 150, 149.75)).toBeCloseTo(149.8, 5);
    // En la tercera vuelta.
    expect(totalEnBucle(10, 150, 310.3)).toBeCloseTo(310, 5);
  });

  it('cuadra las vueltas que se perdieron con la pantalla bloqueada', () => {
    // El navegador no avisó en diez minutos: el reloj dice ~760 s, el <audio> está en el segundo 10 de su vuelta.
    expect(totalEnBucle(10, 150, 761.5)).toBeCloseTo(760, 5);
  });

  it('se corrige con lo que marca el <audio>, no con el reloj', () => {
    // El reloj se ha adelantado un segundo y medio: manda el audio.
    expect(totalEnBucle(40, 150, 41.5)).toBe(40);
  });

  it('sin duración de vuelta conocida no se inventa vueltas', () => {
    expect(totalEnBucle(12, 0, 30)).toBe(30);
    expect(totalEnBucle(12, Number.NaN, 5)).toBe(12);
  });

  it('para saltar a un punto total: qué vuelta y qué segundo', () => {
    expect(situarEnBucle(320, 150)).toEqual({ vuelta: 2, tiempo: 20 });
    expect(situarEnBucle(0, 150)).toEqual({ vuelta: 0, tiempo: 0 });
    expect(situarEnBucle(-5, 150)).toEqual({ vuelta: 0, tiempo: 0 });
    expect(situarEnBucle(40, 0)).toEqual({ vuelta: 0, tiempo: 40 });
  });
});

describe('pararse solo', () => {
  const ahora = 1_000_000;

  it('sin final ni temporizador, sigue', () => {
    expect(decidirParada({ total: 9999, limite: null, ahora, apagaEn: null })).toEqual({
      parar: false,
      volumen: 1,
      motivo: null,
    });
  });

  it('un paisaje se para al llegar a su duración, con fundido antes', () => {
    expect(decidirParada({ total: 3600, limite: 3600, ahora, apagaEn: null })).toEqual({
      parar: true,
      volumen: 0,
      motivo: 'final',
    });
    const fundiendo = decidirParada({ total: 3600 - FUNDIDO_SEG / 2, limite: 3600, ahora, apagaEn: null });
    expect(fundiendo.parar).toBe(false);
    expect(fundiendo.motivo).toBe('final');
    expect(fundiendo.volumen).toBeCloseTo(0.25, 5); // cuadrático: a mitad de fundido, un cuarto
    expect(decidirParada({ total: 100, limite: 3600, ahora, apagaEn: null }).volumen).toBe(1);
  });

  it('el temporizador manda si acaba antes', () => {
    const p = decidirParada({ total: 100, limite: 3600, ahora, apagaEn: ahora + 2_000 });
    expect(p.motivo).toBe('temporizador');
    expect(p.volumen).toBeCloseTo((2 / FUNDIDO_SEG) ** 2, 5);
    expect(decidirParada({ total: 100, limite: null, ahora, apagaEn: ahora - 1 })).toMatchObject({
      parar: true,
      motivo: 'temporizador',
    });
  });

  it('el final del paisaje manda si acaba antes que el temporizador', () => {
    expect(decidirParada({ total: 3599, limite: 3600, ahora, apagaEn: ahora + 60_000 }).motivo).toBe('final');
  });

  it('el temporizador se pone en minutos y se quita con null', () => {
    expect(apagaEnDe(30, ahora)).toBe(ahora + 30 * 60_000);
    expect(apagaEnDe(null, ahora)).toBeNull();
    expect(apagaEnDe(0, ahora)).toBeNull();
    expect(apagaEnDe(-5, ahora)).toBeNull();
  });
});

describe('las escuchas', () => {
  it('cuenta a los 30 s, o casi al final si la pieza es más corta', () => {
    expect(umbralEscucha(180)).toBe(ESCUCHA_SEG);
    expect(umbralEscucha(30)).toBe(29);
    expect(umbralEscucha(12)).toBe(11);
    expect(umbralEscucha(0.5)).toBe(1);
    expect(umbralEscucha(undefined)).toBe(ESCUCHA_SEG);
    expect(umbralEscucha(Number.POSITIVE_INFINITY)).toBe(ESCUCHA_SEG);
  });

  it('suma lo que avanza solo y nada de lo que retrocede', () => {
    expect(sumarSonado(10, 40, 40.25)).toBeCloseTo(10.25, 5);
    expect(sumarSonado(10, 40, 12)).toBe(10);
    expect(sumarSonado(10, 40, Number.NaN)).toBe(10);
  });
});

describe('el modo cuidado al tocar', () => {
  it('se enciende solo en los paisajes para dormir', () => {
    expect(cuidadoAlTocar({ tipo: 'paisaje', momento: 'dormir' }, null)).toBe(true);
    expect(cuidadoAlTocar({ tipo: 'paisaje', momento: 'concentrarme' }, null)).toBe(false);
    expect(cuidadoAlTocar({ tipo: 'cancion', momento: 'dormir' }, null)).toBe(false);
    expect(cuidadoAlTocar({ tipo: 'paisaje' }, null)).toBe(false);
  });

  it('lo que eligió la persona manda siempre', () => {
    expect(cuidadoAlTocar({ tipo: 'paisaje', momento: 'dormir' }, false)).toBe(false);
    expect(cuidadoAlTocar({ tipo: 'cancion' }, true)).toBe(true);
  });
});

describe('el reloj del reproductor', () => {
  it('minutos y segundos, y horas si las hay', () => {
    expect(reloj(0)).toBe('0:00');
    expect(reloj(65.9)).toBe('1:05');
    expect(reloj(750)).toBe('12:30');
    expect(reloj(3723)).toBe('1:02:03');
    expect(reloj(-3)).toBe('0:00');
    expect(reloj(Number.NaN)).toBe('0:00');
  });
});
