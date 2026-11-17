/**
 * Las tiras de acordes: ocho acordes de la tonalidad en botones, y cómo se
 * tocan en una guitarra, un piano o unas cuerdas.
 *
 * Los acordes y las escalas salen de `tonal` (MIT); las posturas de guitarra,
 * de una regla que cualquier guitarrista reconoce: el bajo en la raíz, en la
 * cuerda más grave que la alcanza en los cuatro primeros trastes, y en cada
 * cuerda la nota del acorde más baja a mano. Con eso salen solos el Mi, el
 * Do, el La m y el Re m de primera posición.
 */

import { Chord, Note, Scale } from 'tonal';
import type { Modo } from '@/lib/daw/analysis/key';
import { NOTAS, type Tonalidad } from '@/lib/musico/teoria';

export type TipoAcorde = 'M' | 'm' | 'dim' | '7';

export interface TiraDeAcorde {
  /** «La m», «Sol7», «Si dim»: como en un cancionero. */
  nombre: string;
  /** Grado en la tonalidad: «I», «vi», «♭VII». */
  grado: string;
  raiz: number;
  tipo: TipoAcorde;
  /** Clases de nota del acorde, empezando por la raíz. */
  clases: number[];
}

const NOMBRE_TONAL = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'] as const;

export function clasesDeAcorde(raiz: number, tipo: TipoAcorde): number[] {
  const nombre = NOMBRE_TONAL[((raiz % 12) + 12) % 12];
  const acorde = Chord.getChord(tipo, nombre);
  return acorde.notes.map((n) => Note.chroma(n) ?? 0);
}

function tira(tonica: number, grado: number, tipo: TipoAcorde, etiqueta: string): TiraDeAcorde {
  const raiz = (tonica + grado + 12) % 12;
  const sufijo = tipo === 'm' ? ' m' : tipo === 'dim' ? ' dim' : tipo === '7' ? '7' : '';
  return { nombre: `${NOTAS[raiz]}${sufijo}`, grado: etiqueta, raiz, tipo, clases: clasesDeAcorde(raiz, tipo) };
}

/**
 * Las ocho tiras de una tonalidad. En mayor: los seis acordes diatónicos más
 * el ♭VII y el V7, los dos préstamos más tocados del pop. En menor, con el V
 * mayor de la armónica (el que se toca de verdad) y el v natural. En frigio
 * flamenco, la cadencia andaluza entera y los dos séptimas que la empujan.
 */
export function tirasDeAcordes(t: Tonalidad): TiraDeAcorde[] {
  const k = t.tonica;
  const porModo: Record<Modo, TiraDeAcorde[]> = {
    mayor: [
      tira(k, 0, 'M', 'I'),
      tira(k, 2, 'm', 'ii'),
      tira(k, 4, 'm', 'iii'),
      tira(k, 5, 'M', 'IV'),
      tira(k, 7, 'M', 'V'),
      tira(k, 9, 'm', 'vi'),
      tira(k, 10, 'M', '♭VII'),
      tira(k, 7, '7', 'V7'),
    ],
    menor: [
      tira(k, 0, 'm', 'i'),
      tira(k, 2, 'dim', 'ii°'),
      tira(k, 3, 'M', 'III'),
      tira(k, 5, 'm', 'iv'),
      tira(k, 7, 'M', 'V'),
      tira(k, 8, 'M', 'VI'),
      tira(k, 10, 'M', 'VII'),
      tira(k, 7, 'm', 'v'),
    ],
    frigio: [
      tira(k, 0, 'M', 'I'),
      tira(k, 1, 'M', '♭II'),
      tira(k, 3, 'M', '♭III'),
      tira(k, 5, 'm', 'iv'),
      tira(k, 8, 'M', '♭VI'),
      tira(k, 10, 'm', '♭vii'),
      tira(k, 3, '7', '♭III7'),
      tira(k, 0, '7', 'I7'),
    ],
  };
  return porModo[t.modo];
}

/** Las notas de la escala en un registro, para el teclado «sin fallar». */
export function notasDeEscala(t: Tonalidad, desde: number, hasta: number): number[] {
  const modo = t.modo === 'frigio' ? 'phrygian dominant' : t.modo === 'mayor' ? 'major' : 'minor';
  const escala = Scale.get(`${NOMBRE_TONAL[t.tonica]} ${modo}`);
  const clases = new Set(escala.notes.map((n) => Note.chroma(n) ?? 0));
  // El frigio flamenco suena con las dos terceras: se añade la menor.
  if (t.modo === 'frigio') clases.add((t.tonica + 3) % 12);
  const salida: number[] = [];
  for (let midi = desde; midi <= hasta; midi++) if (clases.has(((midi % 12) + 12) % 12)) salida.push(midi);
  return salida;
}

/* -------------------------------------------------------------------------- */
/* Posturas                                                                    */
/* -------------------------------------------------------------------------- */

/** Afinación estándar, de la sexta (Mi grave) a la prima. */
export const CUERDAS_AL_AIRE = [40, 45, 50, 55, 59, 64] as const;

/**
 * Postura de guitarra: una nota por cuerda, `null` en las que no se tocan.
 * Bajo en la raíz; el resto, la nota del acorde más baja hasta el traste 4
 * (5 si no hay otra), como se toca en primera posición.
 */
export function posturaDeGuitarra(acorde: TiraDeAcorde): (number | null)[] {
  const clases = new Set(acorde.clases);
  const salida: (number | null)[] = [];
  let bajo = -1;
  for (let cuerda = 0; cuerda < CUERDAS_AL_AIRE.length; cuerda++) {
    const aire = CUERDAS_AL_AIRE[cuerda];
    if (bajo < 0) {
      const traste = (acorde.raiz - aire + 120) % 12;
      // Las tres cuerdas graves pueden llevar el bajo; si ninguna lo alcanza,
      // lo lleva la cuarta al aire o donde caiga.
      if (traste <= 4 || cuerda === 2) {
        bajo = aire + traste;
        salida.push(bajo);
      } else {
        salida.push(null);
      }
      continue;
    }
    // Hasta el traste 4; un acorde disminuido puede dejar un hueco de seis
    // semitonos y entonces se estira hasta el 6.
    let nota: number | null = null;
    for (let traste = 0; traste <= 6 && nota === null; traste++) {
      if (clases.has((aire + traste) % 12)) nota = aire + traste;
    }
    salida.push(nota);
  }
  return salida;
}

/**
 * Postura de teclas: la mano derecha entre Sol3 y Sol4, en la inversión que
 * menos se mueve desde el acorde anterior; con `bajo`, la raíz una octava
 * por debajo del Do central.
 */
export function posturaDeTeclas(acorde: TiraDeAcorde, previa: number[] | null, bajo = true): number[] {
  const opciones: number[][] = [];
  for (let inversion = 0; inversion < acorde.clases.length; inversion++) {
    const orden = [...acorde.clases.slice(inversion), ...acorde.clases.slice(0, inversion)];
    let nota = 55 + ((orden[0] - 55 + 1200) % 12);
    const voz = [nota];
    for (const clase of orden.slice(1)) {
      nota += ((clase - nota + 1200) % 12) || 12;
      voz.push(nota);
    }
    opciones.push(voz);
  }
  const centro = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;
  const referencia = previa && previa.length ? centro(previa) : 62;
  opciones.sort((a, b) => Math.abs(centro(a) - referencia) - Math.abs(centro(b) - referencia));
  const derecha = opciones[0];
  return bajo ? [36 + ((acorde.raiz - 36 + 120) % 12), ...derecha] : derecha;
}

/* -------------------------------------------------------------------------- */
/* Rasgueo                                                                     */
/* -------------------------------------------------------------------------- */

export const RASGUEO_MIN_MS = 8;
export const RASGUEO_MAX_MS = 25;

/**
 * Separación entre cuerdas según la velocidad del gesto (px/ms): un golpe de
 * muñeca rápido son 8 ms entre cuerdas; un rasgueo lento, 25.
 */
export function separacionDeRasgueo(velocidad: number): number {
  const v = Math.max(0.12, Math.min(1.6, Math.abs(velocidad)));
  const k = Math.log(v / 0.12) / Math.log(1.6 / 0.12);
  return RASGUEO_MAX_MS - k * (RASGUEO_MAX_MS - RASGUEO_MIN_MS);
}

/** Fuerza del rasgueo según la velocidad del gesto: más rápido, más fuerte. */
export function fuerzaDeRasgueo(velocidad: number): number {
  const v = Math.max(0, Math.min(1.6, Math.abs(velocidad)));
  return Math.round(68 + (v / 1.6) * 54);
}

export interface NotaRasgueada {
  nota: number;
  /** Segundos desde el principio del rasgueo. */
  desfase: number;
  vel: number;
}

/**
 * Las notas de un rasgueo, en el orden en que las toca la mano. Hacia abajo
 * va de la grave a la aguda; hacia arriba, al revés, más flojo y sin las dos
 * graves (la mano que sube casi nunca llega a la sexta).
 */
export function rasgueo(postura: (number | null)[], direccion: 'abajo' | 'arriba', separacionMs: number, vel: number): NotaRasgueada[] {
  let notas = postura.filter((n): n is number => n !== null);
  if (direccion === 'arriba') notas = notas.slice(Math.min(2, Math.max(0, notas.length - 3))).reverse();
  return notas.map((nota, i) => ({
    nota,
    desfase: (i * separacionMs) / 1000,
    // La última cuerda que toca la púa suena un poco menos.
    vel: Math.max(1, Math.round((direccion === 'arriba' ? vel * 0.82 : vel) * (1 - i * 0.025))),
  }));
}

/* -------------------------------------------------------------------------- */
/* Modo automático                                                             */
/* -------------------------------------------------------------------------- */

export interface PasoAuto {
  /** Pulso dentro del compás. */
  beat: number;
  direccion: 'abajo' | 'arriba';
  vel: number;
  /** Solo el bajo (piano). */
  bajo?: boolean;
  /** Duración en pulsos (teclas y cuerdas). */
  dur?: number;
}

/**
 * Lo que toca solo el modo automático en un compás de 4. Guitarra: el
 * abajo-abajo-arriba-arriba-abajo-arriba de toda la vida. Piano: bajo en el 1
 * y el 3 y acorde en cada pulso. Cuerdas: el acorde entero, ligado.
 */
export function patronAuto(familia: 'guitarra' | 'teclas' | 'cuerdas', pulsos: number): PasoAuto[] {
  if (familia === 'cuerdas') return [{ beat: 0, direccion: 'abajo', vel: 92, dur: pulsos }];
  if (familia === 'teclas') {
    const pasos: PasoAuto[] = [];
    for (let b = 0; b < pulsos; b++) {
      if (b % 2 === 0) pasos.push({ beat: b, direccion: 'abajo', vel: 96, bajo: true, dur: 1.9 });
      pasos.push({ beat: b, direccion: 'abajo', vel: b === 0 ? 92 : 78, dur: 0.85 });
    }
    return pasos;
  }
  if (pulsos === 4) {
    return [
      { beat: 0, direccion: 'abajo', vel: 108 },
      { beat: 1, direccion: 'abajo', vel: 88 },
      { beat: 1.5, direccion: 'arriba', vel: 72 },
      { beat: 2.5, direccion: 'arriba', vel: 74 },
      { beat: 3, direccion: 'abajo', vel: 92 },
      { beat: 3.5, direccion: 'arriba', vel: 70 },
    ];
  }
  // En cualquier otro compás: abajo en cada pulso y arriba en el contratiempo.
  const pasos: PasoAuto[] = [];
  for (let b = 0; b < pulsos; b++) {
    pasos.push({ beat: b, direccion: 'abajo', vel: b === 0 ? 106 : 86 });
    pasos.push({ beat: b + 0.5, direccion: 'arriba', vel: 70 });
  }
  return pasos;
}
