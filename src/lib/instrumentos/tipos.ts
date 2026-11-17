/**
 * Pilar B · instrumentos que se tocan en la pantalla.
 *
 * Lo que tocas se guarda como NOTAS, no como audio: así se puede cuadrar,
 * humanizar o cambiar de sonido después sin volver a tocarlo. El audio que
 * suena en la línea de tiempo es una copia hecha a partir de esas notas (ver
 * `render.ts`), y se rehace cada vez que cambia algo.
 *
 * Las posiciones van en PULSOS (negras), no en segundos: si cambias el tempo
 * del proyecto, las notas siguen cayendo en su sitio de la rejilla.
 */

/** Un golpe de pad o una nota de teclado, tal como entró. */
export interface Golpe {
  /** Pulso donde empieza, contado desde el inicio del clip. */
  beat: number;
  /** Duración en pulsos. En la batería es simbólica: el golpe suena entero. */
  dur: number;
  /**
   * Nota MIDI. En la batería es el número de la nota General MIDI del pad
   * (36 bombo, 38 caja, 42 charles…): así cambiar de 808 a 909 o al cajón no
   * mueve ni un golpe, y el día que se exporte a MIDI cada pad cae en su sitio.
   */
  nota: number;
  /** Fuerza del golpe, 1..127 como en MIDI. */
  vel: number;
}

export type InstrumentoId =
  | 'bateria-808'
  | 'bateria-909'
  | 'cajon'
  | 'piano'
  | 'piano-electrico'
  | 'cuerdas'
  | 'guitarra'
  | 'bajo';

/** Cuadrar: llevar los golpes hacia la rejilla sin dejarlos de máquina. */
export interface AjusteCuadrar {
  /** Paso de la rejilla en pulsos: 0,25 = semicorchea, 0,5 = corchea. */
  rejilla: number;
  /** 0 = no se mueve nada, 1 = todo clavado a la rejilla. */
  fuerza: number;
  /** 0 = recto; 1 = tresillo entero en los pasos pares. */
  swing: number;
  /**
   * Solo se mueve lo que cae cerca: 1 = todo; 0,5 = lo que está a menos de
   * media distancia entre pasos. Lo demás se respeta como intención.
   */
  ventana: number;
  /** Plantilla de groove (`plantillas.json`), o null para la rejilla pura. */
  plantilla: string | null;
}

/** Humanizar: un desvío lento y con memoria, como el de una mano de verdad. */
export interface AjusteHumanizar {
  /** 0..1. A 1, unos ±12 ms y ±12 de fuerza. */
  cantidad: number;
  /** El mismo número da el mismo resultado: deshacer y rehacer no cambia nada. */
  semilla: number;
}

export interface AjustesGroove {
  /** Quitar los dobles golpes de menos de 30 ms (el dedo que rebota). */
  limpiar: boolean;
  cuadrar: AjusteCuadrar | null;
  humanizar: AjusteHumanizar | null;
}

export const AJUSTES_SIN_TOCAR: AjustesGroove = { limpiar: true, cuadrar: null, humanizar: null };

/** Lo que se guarda en una pista de notas, dentro de `Track.notas`. */
export interface PistaDeNotas {
  instrumento: InstrumentoId;
  /** Lo que tocaste, tal cual entró. No se modifica nunca. */
  bruto: Golpe[];
  /** Lo que suena: `bruto` pasado por `ajustes` (ver `musico/groove`). */
  golpes: Golpe[];
  ajustes: AjustesGroove;
  /** Tempo con el que se hizo el audio de la pista. Si cambia, se rehace. */
  bpm: number;
  /** Pulsos por compás de la rejilla con la que se tocó. */
  pulsosPorCompas: number;
  /**
   * Con qué sonó al hacer el audio: si las muestras no estaban (sin red la
   * primera vez), la pista suena con el sintetizado y se rehace sola cuando
   * llegan.
   */
  sonido: 'muestras' | 'sintesis';
}
