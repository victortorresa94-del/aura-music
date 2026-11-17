/**
 * «La IA lo graba bien».
 *
 * Lo que tocas en la pantalla entra con tus fallos: el dedo que rebota, el
 * golpe que llega tarde, el charles que corre. Aquí se arregla, SIN TOCAR lo
 * grabado: cada función recibe los golpes en bruto y devuelve una copia
 * nueva. La pista guarda el original y los ajustes, y lo que suena es siempre
 * `procesarGolpes(bruto, ajustes)`; así quitar el cuadrado o cambiar el swing
 * no pierde nada y deshacer funciona siempre.
 *
 * Todo es TypeScript puro, sin audio y sin azar escondido (la semilla manda),
 * para poder probarlo con tests.
 *
 * Fuentes de las cifras: cuantizar con fuerza, swing y ventana de captura como
 * el «Quantize» de Ableton Live y de Logic; humanizar con ruido 1/f según
 * Hennig y otros (PLoS ONE, 2011); los 30 ms de doble golpe, del plan
 * (`docs/PLAN-MAESTRO.md`, pilar B).
 */

import type { AjusteCuadrar, AjusteHumanizar, AjustesGroove, Golpe } from '@/lib/instrumentos/tipos';
import datos from './plantillas.json';
import { ruidoRosa } from './ruido';

export interface PlantillaGroove {
  id: string;
  nombre: string;
  descripcion: string;
  /** Paso de la rejilla para la que está hecha, en pulsos. */
  rejilla: number;
  /** Desvío de cada paso, en fracciones de paso. */
  desfase: number[];
  /** Fuerza relativa de cada paso. */
  vel: number[];
}

export const PLANTILLAS: PlantillaGroove[] = datos.plantillas;

export function getPlantilla(id: string | null | undefined): PlantillaGroove | null {
  if (!id) return null;
  return PLANTILLAS.find((p) => p.id === id) ?? null;
}

export interface ContextoGroove {
  bpm: number;
  /**
   * Pulso absoluto (desde el principio del proyecto) donde empieza el clip.
   * La rejilla es la del proyecto, no la del clip: si arrastras el clip medio
   * pulso, cuadrar lo lleva a la rejilla de verdad.
   */
  inicioBeat: number;
}

const segundosAPulsos = (s: number, bpm: number) => (s * bpm) / 60;
const clampVel = (v: number) => Math.max(1, Math.min(127, Math.round(v)));
const ordenar = (golpes: Golpe[]) => [...golpes].sort((a, b) => a.beat - b.beat || a.nota - b.nota);

/* -------------------------------------------------------------------------- */
/* Limpiar                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Quita los dobles golpes: la misma nota dos veces en menos de `ventanaMs`.
 * En una pantalla de cristal pasa constantemente (el dedo rebota, o el
 * navegador ve dos contactos en un golpe con la yema). Se queda el primero,
 * con la fuerza del más fuerte de los dos.
 */
export function quitarDobles(golpes: Golpe[], bpm: number, ventanaMs = 30): Golpe[] {
  const ventana = segundosAPulsos(ventanaMs / 1000, bpm);
  const ultimo = new Map<number, Golpe>();
  const salida: Golpe[] = [];
  for (const golpe of ordenar(golpes)) {
    const previo = ultimo.get(golpe.nota);
    if (previo && golpe.beat - previo.beat < ventana) {
      previo.vel = Math.max(previo.vel, golpe.vel);
      continue;
    }
    const copia = { ...golpe };
    ultimo.set(golpe.nota, copia);
    salida.push(copia);
  }
  return salida;
}

/* -------------------------------------------------------------------------- */
/* Cuadrar                                                                     */
/* -------------------------------------------------------------------------- */

/** Dónde cae el paso `k` de la rejilla, con swing o con plantilla. */
function posicionDelPaso(k: number, paso: number, swing: number, plantilla: PlantillaGroove | null): number {
  if (plantilla) {
    const n = plantilla.desfase.length;
    const i = ((k % n) + n) % n;
    return (k + plantilla.desfase[i]) * paso;
  }
  // Swing: los pasos impares se retrasan. A 1, un tercio de paso: el par de
  // pasos queda en 2:1, que es el tresillo.
  const impar = ((k % 2) + 2) % 2 === 1;
  return (k + (impar ? swing / 3 : 0)) * paso;
}

/**
 * Cuantiza con fuerza, swing y ventana de captura.
 *
 * - `fuerza` mueve cada golpe ese porcentaje del camino hacia su paso: al 70 %
 *   el que llegaba 20 ms tarde se queda a 6 ms, que sigue sonando a mano.
 * - `ventana` deja quietos los que caen lejos de cualquier paso: una nota a
 *   mitad de camino entre dos semicorcheas es una decisión, no un error.
 * - Con plantilla, la rejilla es la de la plantilla y cada paso tiene su
 *   desvío y su fuerza propios.
 */
export function cuantizar(golpes: Golpe[], ajuste: AjusteCuadrar, contexto: ContextoGroove): Golpe[] {
  const plantilla = getPlantilla(ajuste.plantilla);
  const paso = plantilla?.rejilla ?? ajuste.rejilla;
  if (!(paso > 0)) return golpes.map((g) => ({ ...g }));
  const fuerza = Math.max(0, Math.min(1, ajuste.fuerza));
  const swing = Math.max(0, Math.min(1, ajuste.swing));
  const ventana = Math.max(0, Math.min(1, ajuste.ventana));

  return ordenar(
    golpes.map((golpe) => {
      const absoluto = contexto.inicioBeat + golpe.beat;
      // El paso más cercano, mirando también los vecinos: con swing, el paso
      // impar se ha movido y el redondeo simple puede no ser el más cercano.
      const k0 = Math.round(absoluto / paso);
      let mejorK = k0;
      let mejor = posicionDelPaso(k0, paso, swing, plantilla);
      for (const k of [k0 - 1, k0 + 1]) {
        const p = posicionDelPaso(k, paso, swing, plantilla);
        if (Math.abs(p - absoluto) < Math.abs(mejor - absoluto)) {
          mejor = p;
          mejorK = k;
        }
      }
      if (Math.abs(mejor - absoluto) > (ventana * paso) / 2 + 1e-9) return { ...golpe };

      const beat = absoluto + (mejor - absoluto) * fuerza - contexto.inicioBeat;
      let vel = golpe.vel;
      if (plantilla) {
        const n = plantilla.vel.length;
        const factor = plantilla.vel[((mejorK % n) + n) % n] ?? 1;
        vel = clampVel(vel * (1 + (factor - 1) * fuerza));
      }
      return { ...golpe, beat, vel };
    }),
  );
}

/* -------------------------------------------------------------------------- */
/* Humanizar                                                                   */
/* -------------------------------------------------------------------------- */

/** Desvío máximo (a cantidad 1) en tiempo y en fuerza. */
export const HUMANO_MS = 12;
export const HUMANO_VEL = 12;

/**
 * Humaniza con ruido 1/f. Los golpes que caen a la vez (un acorde, bombo y
 * charles juntos) se mueven juntos: un acorde humanizado nota a nota suena a
 * arpa desafinada, no a mano.
 */
export function humanizar(golpes: Golpe[], ajuste: AjusteHumanizar, contexto: Pick<ContextoGroove, 'bpm'>): Golpe[] {
  const cantidad = Math.max(0, Math.min(1, ajuste.cantidad));
  const ordenados = ordenar(golpes).map((g) => ({ ...g }));
  if (cantidad === 0 || ordenados.length === 0) return ordenados;

  // Agrupar por instante: 20 ms de margen.
  const juntos = segundosAPulsos(0.02, contexto.bpm);
  const grupos: number[] = [];
  let grupo = -1;
  let inicioGrupo = -Infinity;
  for (const golpe of ordenados) {
    if (golpe.beat - inicioGrupo > juntos) {
      grupo++;
      inicioGrupo = golpe.beat;
    }
    grupos.push(grupo);
  }

  const tiempo = ruidoRosa(grupo + 1, ajuste.semilla);
  const fuerza = ruidoRosa(ordenados.length, ajuste.semilla * 31 + 7);
  const msAPulsos = (ms: number) => segundosAPulsos(ms / 1000, contexto.bpm);

  return ordenar(
    ordenados.map((golpe, i) => ({
      ...golpe,
      beat: Math.max(0, golpe.beat + msAPulsos(tiempo[grupos[i]] * HUMANO_MS * cantidad)),
      vel: clampVel(golpe.vel + fuerza[i] * HUMANO_VEL * cantidad),
    })),
  );
}

/* -------------------------------------------------------------------------- */
/* Todo junto                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Lo que suena: el bruto, limpio, cuadrado y humanizado, en ese orden.
 * Humanizar va lo último a propósito: cuadrar después lo desharía.
 */
export function procesarGolpes(bruto: Golpe[], ajustes: AjustesGroove, contexto: ContextoGroove): Golpe[] {
  let golpes = bruto.map((g) => ({ ...g }));
  if (ajustes.limpiar) golpes = quitarDobles(golpes, contexto.bpm);
  if (ajustes.cuadrar) golpes = cuantizar(golpes, ajustes.cuadrar, contexto);
  if (ajustes.humanizar) golpes = humanizar(golpes, ajustes.humanizar, contexto);
  return ordenar(golpes.map((g) => ({ ...g, beat: Math.max(0, g.beat) })));
}

/* -------------------------------------------------------------------------- */
/* Qué rejilla y cómo vas                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Rejillas que se prueban, de la más gruesa a la más fina. Nada por debajo de
 * la semicorchea: con una rejilla muy fina todo «cae en su sitio» y cuadrar
 * no arreglaría nada.
 */
const REJILLAS = [1, 0.5, 1 / 3, 0.25] as const;

/**
 * La rejilla más gruesa que explica lo que has tocado. Es lo que haría un
 * músico al escucharte: si todo cae en corcheas, no cuadra a semicorcheas (que
 * dejaría pasar los fallos de media corchea), y si hay tresillos, no los mete
 * en una rejilla binaria.
 */
export function rejillaSugerida(golpes: Golpe[], inicioBeat: number): number {
  // Con tres golpes cualquier rejilla parece buena: se va a lo seguro.
  if (golpes.length < 4) return 0.25;
  for (const paso of REJILLAS) {
    // Error medio en fracción de paso; con ruido humano normal ronda 0,1.
    let suma = 0;
    for (const golpe of golpes) {
      const absoluto = inicioBeat + golpe.beat;
      suma += Math.abs(absoluto / paso - Math.round(absoluto / paso));
    }
    const medio = suma / golpes.length;
    // 0,16 de paso: en corcheas a 100 BPM son unos 50 ms de error medio.
    // Más que eso ya no es fallo de mano, es que tocabas más fino.
    if (medio * paso < 0.07 && medio < 0.16) return paso;
  }
  return 0.25;
}

/**
 * Los ajustes de «Cuadrar» a partir de lo que pide alguien (el botón de la
 * pista o el productor): la rejilla la elige la escucha, la fuerza y el swing
 * vienen de fuera, y lo demás que hubiera se respeta.
 */
export function ajustesParaCuadrar(
  bruto: Golpe[],
  actuales: AjustesGroove,
  o: { fuerza: number; swing: number; humanizar: boolean; inicioBeat: number; semilla?: number },
): AjustesGroove {
  const entre0y1 = (v: number) => Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0));
  return {
    ...actuales,
    cuadrar: {
      rejilla: rejillaSugerida(bruto, o.inicioBeat),
      fuerza: entre0y1(o.fuerza),
      swing: entre0y1(o.swing),
      ventana: 1,
      plantilla: null,
    },
    humanizar: o.humanizar ? { cantidad: 0.45, semilla: o.semilla ?? 1 } : actuales.humanizar,
  };
}

export interface Diagnostico {
  /** Desvío medio con signo frente a la rejilla, en ms (+ = tarde). */
  desvioMs: number;
  /** Desvío medio sin signo, en ms. */
  irregularidadMs: number;
  /** Pulso del compás (1..N) donde más te vas, y cuánto. */
  peorPulso: { pulso: number; ms: number } | null;
}

/**
 * Cómo has tocado, en palabras de músico: si vas por delante o por detrás,
 * cuánto bailas y en qué pulso arrastras. Es lo que necesita el productor
 * para decir «lo has tocado bien pero arrastras en el 3».
 */
export function diagnosticar(
  golpes: Golpe[],
  contexto: ContextoGroove & { pulsosPorCompas: number; rejilla?: number },
): Diagnostico {
  const paso = contexto.rejilla ?? rejillaSugerida(golpes, contexto.inicioBeat);
  const msPorPulso = 60_000 / contexto.bpm;
  const porPulso = new Map<number, number[]>();
  let suma = 0;
  let sumaAbs = 0;
  for (const golpe of golpes) {
    const absoluto = contexto.inicioBeat + golpe.beat;
    const objetivo = Math.round(absoluto / paso) * paso;
    const ms = (absoluto - objetivo) * msPorPulso;
    suma += ms;
    sumaAbs += Math.abs(ms);
    const pulso = (((Math.round(objetivo) % contexto.pulsosPorCompas) + contexto.pulsosPorCompas) % contexto.pulsosPorCompas) + 1;
    const lista = porPulso.get(pulso) ?? [];
    lista.push(ms);
    porPulso.set(pulso, lista);
  }
  const n = Math.max(1, golpes.length);
  let peorPulso: Diagnostico['peorPulso'] = null;
  for (const [pulso, lista] of porPulso) {
    if (lista.length < 2) continue;
    const media = lista.reduce((a, b) => a + b, 0) / lista.length;
    if (!peorPulso || Math.abs(media) > Math.abs(peorPulso.ms)) peorPulso = { pulso, ms: Math.round(media) };
  }
  return { desvioMs: Math.round(suma / n), irregularidadMs: Math.round(sumaAbs / n), peorPulso };
}

/** El diagnóstico en una frase de músico: «vas 12 ms por detrás, con 18 ms de baile; donde más, en el 3 (+28 ms)». */
export function describirDiagnostico(d: Diagnostico): string {
  const lado =
    d.desvioMs > 4 ? `vas ${d.desvioMs} ms por detrás` : d.desvioMs < -4 ? `vas ${-d.desvioMs} ms por delante` : 'vas a tiempo';
  const peor =
    d.peorPulso && Math.abs(d.peorPulso.ms) >= 12
      ? `; donde más te vas es en el ${d.peorPulso.pulso} (${d.peorPulso.ms > 0 ? '+' : '−'}${Math.abs(d.peorPulso.ms)} ms)`
      : '';
  return `${lado}, con ${d.irregularidadMs} ms de baile de media${peor}`;
}
