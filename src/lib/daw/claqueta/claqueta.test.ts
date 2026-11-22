import { describe, expect, it } from 'vitest';
import { golpesEntre } from '../rhythm/player';
import {
  CLAQUETA_POR_DEFECTO,
  claquetaDe,
  FONDOS,
  fondoDe,
  golpesDeCuenta,
  golpesDelPaso,
  lugarDelPaso,
  primerPaso,
  suenaElClic,
  type AjustesClaqueta,
  type GolpeClaqueta,
} from './claqueta';

const con = (cambio: Partial<AjustesClaqueta>): AjustesClaqueta => ({ ...CLAQUETA_POR_DEFECTO, ...cambio });
const voz = (g: GolpeClaqueta[]) => g.map((x) => (x.voz.tipo === 'tic' ? (x.voz.agudo ? 'tic-agudo' : 'tic') : x.voz.voz));

describe('ajustes de la claqueta', () => {
  it('sin nada guardado es el tic-tac de siempre, a negras y con acento', () => {
    expect(claquetaDe({})).toEqual(CLAQUETA_POR_DEFECTO);
    expect(CLAQUETA_POR_DEFECTO).toMatchObject({ sonido: 'tictac', subdivision: 'negras', acento: true, volumen: 0.8, fondo: null });
  });

  it('lo que venga raro de disco se queda en su sitio', () => {
    const c = claquetaDe({ claqueta: { sonido: 'cencerro' as never, volumen: 9, fondo: 'reguetón' as never } });
    expect(c).toMatchObject({ sonido: 'tictac', volumen: 1.5, fondo: null });
  });

  it('con ritmo de fondo el clic calla, salvo que se pida encima', () => {
    expect(suenaElClic(con({}))).toBe(true);
    expect(suenaElClic(con({ fondo: 'rumba-suave' }))).toBe(false);
    expect(suenaElClic(con({ fondo: 'rumba-suave', clicConFondo: true }))).toBe(true);
  });
});

describe('qué suena en cada paso', () => {
  it('tic-tac a negras en 4/4: agudo en el 1 y grave en el resto, como antes', () => {
    const compas = [0, 1, 2, 3, 4].map((k) => voz(golpesDelPaso(con({}), k, 4))[0]);
    expect(compas).toEqual(['tic-agudo', 'tic', 'tic', 'tic', 'tic-agudo']);
    // Los pulsos suenan a tope, igual que el metrónomo de antes.
    expect(golpesDelPaso(con({}), 1, 4)[0].vel).toBe(1);
  });

  it('sin acento, el 1 suena como los demás', () => {
    expect(voz(golpesDelPaso(con({ acento: false }), 0, 4))).toEqual(['tic']);
    expect(golpesDelPaso(con({ sonido: 'bombo', acento: false }), 0, 4)[0].vel).toBe(golpesDelPaso(con({ sonido: 'bombo', acento: false }), 1, 4)[0].vel);
  });

  it('modo bombo a negras: un bombo por pulso, más fuerte en el 1', () => {
    const golpes = [0, 1, 2, 3].map((k) => golpesDelPaso(con({ sonido: 'bombo' }), k, 4)[0]);
    expect(golpes.every((g) => g.voz.tipo === 'kit' && g.voz.voz === 'bombo')).toBe(true);
    expect(golpes[0].vel).toBeGreaterThan(golpes[1].vel);
  });

  it('bombo y caja: bombo en el 1 y el 3, caja en el 2 y el 4', () => {
    const compas = [0, 1, 2, 3].map((k) => voz(golpesDelPaso(con({ sonido: 'bombo-caja' }), k, 4))[0]);
    expect(compas).toEqual(['bombo', 'caja', 'bombo', 'caja']);
  });

  it('a corcheas, entre pulso y pulso suena más flojo (y en bombo y caja, un charles)', () => {
    const pulso = golpesDelPaso(con({ sonido: 'shaker', subdivision: 'corcheas' }), 2, 4)[0];
    const entre = golpesDelPaso(con({ sonido: 'shaker', subdivision: 'corcheas' }), 3, 4)[0];
    expect(entre.vel).toBeLessThan(pulso.vel);
    expect(voz(golpesDelPaso(con({ sonido: 'bombo-caja', subdivision: 'corcheas' }), 1, 4))).toEqual(['charles']);
  });

  it('tresillos: tres golpes por pulso y el acento sigue en el 1', () => {
    expect(lugarDelPaso('tresillos', 3, 4)).toMatchObject({ esPulso: true, esUno: false });
    expect(lugarDelPaso('tresillos', 12, 4)).toMatchObject({ esPulso: true, esUno: true });
    expect(lugarDelPaso('tresillos', 4, 4).esPulso).toBe(false);
  });

  it('blancas en 4/4: dos golpes por compás, el primero con acento', () => {
    expect(voz(golpesDelPaso(con({ subdivision: 'blancas' }), 0, 4))).toEqual(['tic-agudo']);
    expect(voz(golpesDelPaso(con({ subdivision: 'blancas' }), 1, 4))).toEqual(['tic']);
    expect(voz(golpesDelPaso(con({ subdivision: 'blancas' }), 2, 4))).toEqual(['tic-agudo']);
  });

  it('en 3/4 el 1 vuelve cada tres pulsos', () => {
    const compas = [0, 1, 2, 3].map((k) => voz(golpesDelPaso(con({}), k, 3))[0]);
    expect(compas).toEqual(['tic-agudo', 'tic', 'tic', 'tic-agudo']);
  });

  it('la cuenta atrás usa el mismo sonido, siempre a negras y con el 1 marcado', () => {
    const ajustes = con({ sonido: 'palmas', subdivision: 'corcheas', acento: false });
    expect(voz(golpesDeCuenta(ajustes, 0, 4))).toEqual(['palma_seca']);
    expect(golpesDeCuenta(ajustes, 0, 4)[0].vel).toBeGreaterThan(golpesDeCuenta(ajustes, 1, 4)[0].vel);
  });

  it('el primer paso tras una posición, según la subdivisión', () => {
    // A 120 BPM, una negra son 0,5 s y una corchea 0,25.
    expect(primerPaso(0, 120, 'negras')).toEqual({ paso: 0, segundos: 0 });
    expect(primerPaso(1.1, 120, 'negras')).toEqual({ paso: 3, segundos: 1.5 });
    expect(primerPaso(1.1, 120, 'corcheas')).toEqual({ paso: 5, segundos: 1.25 });
    expect(primerPaso(1, 120, 'negras').paso).toBe(2);
  });
});

describe('ritmos de fondo', () => {
  it('existen los cinco y van flojos, con poco relleno', () => {
    expect(FONDOS.map((f) => f.nombre)).toEqual(['Rumba suave', 'Pop', 'Balada', 'Bulería', 'Bossa']);
    for (const f of FONDOS) {
      expect(fondoDe(f.id)).not.toBeNull();
      expect(f.opciones.fuerza).toBeLessThanOrEqual(0.6);
      expect(f.opciones.complejidad).toBeLessThanOrEqual(0.5);
    }
  });

  it('la rumba suave lleva menos golpes que la rumba entera de la hoja de Ritmos', () => {
    const rumba = fondoDe('rumba-suave')!;
    const suave = golpesEntre(rumba.groove, 108, 0, 8, rumba.opciones);
    const entera = golpesEntre(rumba.groove, 108, 0, 8, { complejidad: 1, fuerza: 0.8, humano: 0.25 });
    expect(suave.length).toBeGreaterThan(0);
    expect(suave.length).toBeLessThan(entera.length);
    expect(Math.max(...suave.map((g) => g.vel))).toBeLessThan(0.6);
  });
});
