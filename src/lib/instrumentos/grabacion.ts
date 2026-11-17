/**
 * De lo que tocas a una pista de notas.
 *
 * Al tocar se apuntan eventos con su instante en segundos de la línea de
 * tiempo. Aquí se pasan a pulsos, se decide dónde empieza el clip (en el
 * compás del primer golpe, para que el clip encaje en la rejilla y se pueda
 * repetir) y cuánto dura (compases enteros).
 *
 * Todo es puro y sin audio: se prueba con tests.
 */

import type { Golpe, InstrumentoId } from './tipos';

export interface EventoTocado {
  instrumento: InstrumentoId;
  nota: number;
  /** 1..127 */
  vel: number;
  /** Instante en el reloj de audio, ya corregido con la calibración del toque. */
  t: number;
  /** Segundos que estuvo pulsado; null si todavía no se ha soltado. */
  dur: number | null;
  /** Posición de la línea de tiempo (s) si el transporte sonaba; null si no. */
  pos: number | null;
}

export interface ClipDeNotas {
  /** Segundo de la línea de tiempo donde empieza el clip. */
  inicio: number;
  /** Golpes en pulsos desde el inicio del clip. */
  golpes: Golpe[];
  /** Duración del clip en pulsos: compases enteros. */
  pulsos: number;
}

/** Duración por defecto de lo que se suelta al momento o no se ha soltado. */
const DUR_MINIMA = 0.08;

/**
 * Coloca una tanda de eventos en la rejilla.
 *
 * - `posiciones`: segundo de la línea de tiempo de cada evento (el mismo orden).
 * - El clip empieza en el compás del primer golpe, nunca antes del cero.
 * - Dura compases enteros hasta el final del último golpe; las notas con cola
 *   (teclas, cuerdas) se dejan un pulso más para que la última no se corte.
 */
export function colocarEnRejilla(
  eventos: EventoTocado[],
  posiciones: number[],
  o: { bpm: number; pulsosPorCompas: number; cola: boolean },
): ClipDeNotas | null {
  if (eventos.length === 0) return null;
  const pulso = 60 / o.bpm;
  const compas = o.pulsosPorCompas;
  const primero = Math.min(...posiciones);
  const compasInicio = Math.max(0, Math.floor(primero / pulso / compas + 1e-6));
  const inicioBeat = compasInicio * compas;
  const inicio = inicioBeat * pulso;

  const golpes: Golpe[] = eventos
    .map((evento, i) => ({
      beat: Math.max(0, posiciones[i] / pulso - inicioBeat),
      dur: Math.max(DUR_MINIMA, (evento.dur ?? DUR_MINIMA * pulso) / pulso),
      nota: evento.nota,
      vel: Math.max(1, Math.min(127, Math.round(evento.vel))),
    }))
    .sort((a, b) => a.beat - b.beat || a.nota - b.nota);

  const fin = Math.max(...golpes.map((g) => g.beat + (o.cola ? g.dur : 0))) + (o.cola ? 1 : 0.05);
  const pulsos = Math.max(compas, Math.ceil(fin / compas - 1e-6) * compas);
  return { inicio, golpes, pulsos };
}

/**
 * Lo último que tocaste sin grabar: los eventos desde el último silencio de
 * más de `pausa` segundos. Si todos tienen posición (sonaba el transporte), se
 * usa; si no, se colocan a partir de `cursor` respetando sus distancias, con
 * el primero en el pulso más cercano al cursor.
 */
export function recuperarFrase(
  captura: EventoTocado[],
  o: { pausa?: number; cursor: number; bpm: number },
): { eventos: EventoTocado[]; posiciones: number[] } | null {
  if (captura.length === 0) return null;
  const pausa = o.pausa ?? 4;
  let desde = captura.length - 1;
  while (desde > 0) {
    const anterior = captura[desde - 1];
    const finAnterior = anterior.t + (anterior.dur ?? 0);
    if (captura[desde].t - Math.max(anterior.t, finAnterior) > pausa) break;
    desde--;
  }
  const eventos = captura.slice(desde);
  if (eventos.every((e) => e.pos !== null)) {
    return { eventos, posiciones: eventos.map((e) => e.pos as number) };
  }
  const pulso = 60 / o.bpm;
  const ancla = Math.max(0, Math.round(o.cursor / pulso) * pulso);
  const t0 = eventos[0].t;
  return { eventos, posiciones: eventos.map((e) => ancla + (e.t - t0)) };
}

/** Agrupa por instrumento: una pista por instrumento tocado en la misma toma. */
export function porInstrumento(eventos: EventoTocado[], posiciones: number[]) {
  const grupos = new Map<InstrumentoId, { eventos: EventoTocado[]; posiciones: number[] }>();
  eventos.forEach((evento, i) => {
    const grupo = grupos.get(evento.instrumento) ?? { eventos: [], posiciones: [] };
    grupo.eventos.push(evento);
    grupo.posiciones.push(posiciones[i]);
    grupos.set(evento.instrumento, grupo);
  });
  return grupos;
}
