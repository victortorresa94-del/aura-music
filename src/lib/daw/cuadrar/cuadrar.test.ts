import { describe, expect, it } from 'vitest';
import { detectarGolpes } from '../analysis/retraso';
import type { Project, Track } from '../types';
import { aplicarCuadre, ANTES_DEL_GOLPE, cuadrarMuestras, planDeCuadre, wsola, type AjustesCuadreToma } from './cuadrar';
import { audiosDePista, conCuadre, escucharVersion, regionOriginal, sinCuadre, type CuadreDeToma } from './toma';

const SR = 48000;
const BPM = 120; // una corchea = 0,25 s
const CORCHEA = 0.25;

/**
 * Una toma de guitarra de juguete: rasgueos que atacan seco y caen, sobre
 * un bordón que no para (si al cuadrar quedara un hueco, se vería en el
 * bordón). Los golpes van un poco fuera de la rejilla, como tocando a mano.
 */
function toma(golpes: number[], segundos: number, bordon = 0.15): Float32Array {
  const n = Math.round(segundos * SR);
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) x[i] = bordon * Math.sin((2 * Math.PI * 110 * i) / SR);
  for (const g of golpes) {
    const desde = Math.round(g * SR);
    for (let i = desde; i < n; i++) {
      const t = (i - desde) / SR;
      x[i] += 0.6 * Math.exp(-t / 0.06) * (Math.sin(2 * Math.PI * 330 * t) + 0.5 * Math.sin(2 * Math.PI * 495 * t));
    }
  }
  return x;
}

const DESVIOS = [0.018, -0.022, 0.03, -0.012, 0.025, -0.028, 0.015, -0.02];
const GOLPES = DESVIOS.map((d, i) => 0.5 + i * CORCHEA * 2 + d); // a negras, desviados
const ajustes = (cambio: Partial<AjustesCuadreToma> = {}): AjustesCuadreToma => ({ fuerza: 1, rejilla: 0.5, estirar: true, ...cambio });

const distanciaARejilla = (t: number) => Math.abs(t - Math.round(t / CORCHEA) * CORCHEA);

describe('plan de cuadre', () => {
  it('a fuerza 1 cada golpe va a su paso de la rejilla; a 0,5, a mitad de camino', () => {
    const lleno = planDeCuadre(GOLPES, { inicio: 0, bpm: BPM, duracion: 5 }, ajustes());
    expect(lleno.golpes).toBe(GOLPES.length);
    for (const a of lleno.anclas.slice(1)) expect(distanciaARejilla(a.destino + ANTES_DEL_GOLPE)).toBeLessThan(1e-9);
    expect(lleno.despues).toBeLessThan(1e-9);

    const medio = planDeCuadre(GOLPES, { inicio: 0, bpm: BPM, duracion: 5 }, ajustes({ fuerza: 0.5 }));
    expect(medio.despues).toBeCloseTo(medio.antes / 2, 9);
  });

  it('la rejilla es la del proyecto: cuenta dónde empieza la toma', () => {
    // La toma empieza a 0,1 s: su golpe en 0,15 cae en 0,25 del proyecto, justo en la rejilla.
    const plan = planDeCuadre([0.15], { inicio: 0.1, bpm: BPM, duracion: 1 }, ajustes());
    expect(plan.movidos).toBe(0);
  });

  it('lo que cae lejos de la rejilla se queda quieto', () => {
    // 0,375 está justo entre dos corcheas: una decisión, no un error.
    const plan = planDeCuadre([0.375], { inicio: 0, bpm: BPM, duracion: 1 }, ajustes());
    expect(plan.movidos).toBe(0);
    expect(plan.anclas[1].destino).toBeCloseTo(plan.anclas[1].origen, 9);
  });

  it('nunca cruza ni junta dos cortes', () => {
    // Dos golpes muy cerca que irían al mismo paso.
    const plan = planDeCuadre([0.49, 0.53, 0.61], { inicio: 0, bpm: BPM, duracion: 1 }, ajustes());
    for (let i = 1; i < plan.anclas.length; i++) {
      expect(plan.anclas[i].destino - plan.anclas[i - 1].destino).toBeGreaterThanOrEqual(0.03 - 1e-9);
      expect(plan.anclas[i].origen).toBeGreaterThan(plan.anclas[i - 1].origen);
    }
  });
});

describe('montar la toma cuadrada', () => {
  it('sin mover nada sale idéntica: los fundidos suman uno', () => {
    const x = toma(GOLPES, 5);
    const plan = planDeCuadre(GOLPES, { inicio: 0, bpm: BPM, duracion: 5 }, ajustes({ fuerza: 0 }));
    expect(plan.anclas.length).toBeGreaterThan(3);
    const [y] = aplicarCuadre([x], SR, plan, { estirar: true });
    let error = 0;
    for (let i = 0; i < x.length; i++) error = Math.max(error, Math.abs(x[i] - y[i]));
    expect(error).toBeLessThan(1e-6);
  });

  it('los golpes acaban en la rejilla (medidos con el mismo oído)', () => {
    const x = toma(GOLPES, 5);
    const antes = detectarGolpes(x, SR).map((g) => distanciaARejilla(g.t));
    const { canales, plan } = cuadrarMuestras([x], SR, { inicio: 0, bpm: BPM }, ajustes());
    const despues = detectarGolpes(canales[0], SR).map((g) => distanciaARejilla(g.t));
    expect(plan.movidos).toBe(GOLPES.length);
    expect(Math.max(...antes)).toBeGreaterThan(0.01);
    expect(Math.max(...despues)).toBeLessThan(0.003);
    expect(canales[0].length).toBe(x.length);
  });

  it('estirando no quedan huecos: el bordón no se corta nunca (sin estirar, sí)', () => {
    const x = toma(GOLPES, 5);
    const rmsBordon = 0.15 / Math.SQRT2;
    const peorVentana = (y: Float32Array) => {
      // Energía en ventanas de 5 ms, saltando los bordes de la toma.
      const ventana = Math.round(0.005 * SR);
      let minimo = Infinity;
      for (let i = Math.round(0.1 * SR); i + ventana < y.length - SR * 0.1; i += ventana) {
        let s = 0;
        for (let j = i; j < i + ventana; j++) s += y[j] * y[j];
        minimo = Math.min(minimo, Math.sqrt(s / ventana));
      }
      return minimo;
    };
    const estirada = cuadrarMuestras([x], SR, { inicio: 0, bpm: BPM }, ajustes()).canales[0];
    const sinEstirar = cuadrarMuestras([x], SR, { inicio: 0, bpm: BPM }, ajustes({ estirar: false })).canales[0];
    // En el fundido de 4 ms entre trozos el bordón puede bajar a la mitad
    // (la cola estirada y el trozo siguiente no van en fase), justo antes de
    // un golpe que lo tapa. Un hueco es otra cosa: silencio de verdad.
    expect(peorVentana(estirada)).toBeGreaterThan(rmsBordon * 0.3);
    expect(peorVentana(sinEstirar)).toBeLessThan(rmsBordon * 0.1);
  });

  it('sin estirar, lo que no cabe se funde: ningún salto brusco entre muestras', () => {
    const x = toma(GOLPES, 5);
    const { canales } = cuadrarMuestras([x], SR, { inicio: 0, bpm: BPM }, ajustes({ estirar: false }));
    let maxEntrada = 0;
    for (let i = 1; i < x.length; i++) maxEntrada = Math.max(maxEntrada, Math.abs(x[i] - x[i - 1]));
    let maxSalida = 0;
    const y = canales[0];
    for (let i = 1; i < y.length; i++) maxSalida = Math.max(maxSalida, Math.abs(y[i] - y[i - 1]));
    // Un clic es un salto muy por encima de lo que sube la onda de verdad.
    expect(maxSalida).toBeLessThan(maxEntrada * 1.6);
  });

  it('en estéreo los dos canales se mueven igual', () => {
    const x = toma(GOLPES, 4);
    const { canales } = cuadrarMuestras([x, x.map((v) => v * 0.5)], SR, { inicio: 0, bpm: BPM }, ajustes());
    let error = 0;
    for (let i = 0; i < canales[0].length; i++) error = Math.max(error, Math.abs(canales[0][i] * 0.5 - canales[1][i]));
    expect(error).toBeLessThan(1e-5);
  });
});

describe('WSOLA', () => {
  const pasos = (x: Float32Array) => {
    let cruces = 0;
    for (let i = 1; i < x.length; i++) if (x[i - 1] < 0 && x[i] >= 0) cruces++;
    return cruces;
  };

  it('estira un 25 % sin cambiar el tono', () => {
    const n = Math.round(0.5 * SR);
    const x = new Float32Array(n).map((_, i) => 0.5 * Math.sin((2 * Math.PI * 440 * i) / SR));
    const [y] = wsola([x], Math.round(n * 1.25), SR);
    expect(y.length).toBe(Math.round(n * 1.25));
    // Mismo tono: los cruces por cero por segundo se mantienen.
    const hzEntrada = pasos(x) / (x.length / SR);
    const hzSalida = pasos(y) / (y.length / SR);
    expect(Math.abs(hzSalida - hzEntrada) / hzEntrada).toBeLessThan(0.02);
    // Y no se cae de nivel por los solapes.
    let pico = 0;
    for (let i = SR * 0.05; i < y.length - SR * 0.05; i++) pico = Math.max(pico, Math.abs(y[i]));
    expect(pico).toBeGreaterThan(0.45);
  });

  it('la primera media ventana sale tal cual: el ataque no se toca', () => {
    const x = toma([0], 0.4, 0);
    const [y] = wsola([x], Math.round(x.length * 1.2), SR);
    for (let i = 0; i < 400; i++) expect(Math.abs(y[i] - x[i])).toBeLessThan(1e-4);
  });
});

describe('cuadrar sin destruir', () => {
  const pista = (): Track => ({
    id: 'g',
    name: 'Guitarra',
    clip: { bufferId: 'original', start: 2, offset: 0.5, duration: 8, repeats: 2 },
    volume: 1,
    muted: false,
    soloed: false,
    sourceDuration: 10,
    createdAt: 0,
  });
  const proyecto = (): Project => ({ id: 'p', name: 'Idea', bpm: 120, createdAt: 0, updatedAt: 0, tracks: [pista()] });
  const cuadre: CuadreDeToma = {
    original: { bufferId: 'original', offset: 0.5, duration: 8, sourceDuration: 10 },
    cuadrado: { bufferId: 'cuadrada', offset: 0, duration: 8, sourceDuration: 8 },
    ajustes: { fuerza: 0.7, rejilla: 0.5, estirar: true },
    escuchando: 'cuadrado',
    movidos: 12,
    golpes: 14,
    antesMs: 18,
    despuesMs: 5,
  };

  it('suena la cuadrada, en el mismo sitio y con las mismas repeticiones', () => {
    const t = conCuadre(proyecto(), 'g', cuadre).tracks[0];
    expect(t.clip).toEqual({ bufferId: 'cuadrada', start: 2, offset: 0, duration: 8, repeats: 2 });
    expect(t.sourceDuration).toBe(8);
    expect(t.cuadre?.original.bufferId).toBe('original');
  });

  it('antes y después sin perder ninguna', () => {
    const p = conCuadre(proyecto(), 'g', cuadre);
    const antes = escucharVersion(p, 'g', 'original').tracks[0];
    expect(antes.clip).toMatchObject({ bufferId: 'original', offset: 0.5, duration: 8 });
    expect(antes.cuadre?.escuchando).toBe('original');
    expect(escucharVersion(escucharVersion(p, 'g', 'original'), 'g', 'cuadrado').tracks[0].clip.bufferId).toBe('cuadrada');
  });

  it('se cuadra siempre desde la original, aunque ya esté cuadrada', () => {
    expect(regionOriginal(pista())).toEqual({ bufferId: 'original', offset: 0.5, duration: 8, sourceDuration: 10 });
    expect(regionOriginal(conCuadre(proyecto(), 'g', cuadre).tracks[0]).bufferId).toBe('original');
  });

  it('«dejar como lo toqué» vuelve a la original y olvida el cuadre', () => {
    const t = sinCuadre(conCuadre(proyecto(), 'g', cuadre), 'g').tracks[0];
    expect(t).toEqual(pista());
  });

  it('la original no se borra: cuenta como audio vivo de la pista', () => {
    expect(audiosDePista(conCuadre(proyecto(), 'g', cuadre).tracks[0]).sort()).toEqual(['cuadrada', 'original']);
    expect(audiosDePista(pista())).toEqual(['original']);
  });
});
