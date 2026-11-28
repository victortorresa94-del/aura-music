/**
 * El motor de canciones de bolsillo: quien hace el audio cuando pides una
 * canción. La app no sabe qué modelo toca (regla 6 de CLAUDE.md): habla con
 * esta interfaz y el selector (`motores.ts`) decide quién la cumple.
 *
 * Por qué no es un `ProveedorDePistas` (src/lib/ia/tipos.ts): aquel vive en
 * el SERVIDOR de aura Music, con la clave de la GPU, y toca sobre una toma.
 * Este vive en el MÓVIL y paga con la cuenta de quien escucha: pide a
 * aura Studio con el token de Firebase, y aura Studio cobra del monedero de
 * aura y pone sus frenos. Ninguna clave pasa por aquí.
 *
 * Dos pasos, como la cola de aura Studio: `iniciar` encola (y es lo ÚNICO que
 * cobra: nunca se reintenta) y `consultar` mira cómo va (gratis: se puede
 * repetir las veces que haga falta).
 */

import type { MotorId } from '../tipos';

/** Lo que se le pide al motor, ya traducido a lo que entienden los modelos. */
export interface PeticionMotor {
  /** Cómo suena, en INGLÉS (los modelos lo siguen mejor). */
  descripcion: string;
  /** Lo que se le pide que dure (el modelo puede devolver algo distinto). */
  segundos: number;
  /** El modelo de aura Studio que toca. */
  motor: MotorId;
  conVoz: boolean;
  /** Letra literal, si la hay. Solo la cantan los que saben (MiniMax). */
  letra?: string;
  /** Para que el motor falso suene distinto en cada canción. */
  bpm?: number;
  energia?: number;
  semilla?: number;
}

/** Lo que devuelve el motor cuando la pieza está hecha. */
export interface PiezaLista {
  estado: 'lista';
  /** Dónde vive en la nube (http/https). */
  url?: string;
  /** El audio ya en la mano (el motor falso lo da sin red). */
  audio?: Blob;
  /** La letra que cantó, si la devuelve (Lyria por Google la da con tiempos). */
  letra?: string;
  /** Algo que hay que decir: «salió por otra ruta». En castellano. */
  aviso?: string;
  /** El modelo que la hizo de verdad, tal cual lo dice aura Studio. */
  modelo?: string;
}

export type EstadoTrabajo =
  | { estado: 'en-cola' }
  | { estado: 'generando' }
  | PiezaLista
  | { estado: 'fallo'; error: string };

/** Lo que devuelve `iniciar`: la referencia para retomarlo y cómo está ya. */
export interface TrabajoIniciado {
  /** Lo necesario para consultarlo otra vez, aunque se cierre la app. */
  referencia: Record<string, string>;
  /** Puede llegar ya hecho (Lyria por Google responde con el audio). */
  estado: EstadoTrabajo;
}

export interface MotorDeCanciones {
  id: string;
  /** No gasta créditos: es el de desarrollo. */
  gratis: boolean;
  iniciar(peticion: PeticionMotor): Promise<TrabajoIniciado>;
  consultar(referencia: Record<string, string>): Promise<EstadoTrabajo>;
}

export type TipoErrorMotor =
  | 'sin-cuenta'
  | 'sin-creditos'
  | 'limite'
  | 'bloqueado'
  | 'red'
  | 'servidor'
  | 'otro';

/**
 * Un fallo que se puede enseñar tal cual, en castellano.
 *
 * `reintentable` solo vale para `consultar`: mirar cómo va es gratis y se
 * puede repetir. `iniciar` no se reintenta NUNCA, falle como falle: si la
 * petición llegó y la red se cortó a la vuelta, repetirla sería cobrar dos
 * veces. Si `iniciar` falla, no hay trabajo en la cola que retomar.
 */
export class ErrorDeMotor extends Error {
  constructor(
    message: string,
    readonly tipo: TipoErrorMotor,
    readonly reintentable = false,
  ) {
    super(message);
    this.name = 'ErrorDeMotor';
  }
}
