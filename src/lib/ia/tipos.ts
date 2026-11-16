/**
 * El contrato de los músicos de sesión que viven en la nube.
 *
 * Compás no se casa con ningún modelo. Cada proveedor (ACE-Step hoy; Stable
 * Audio, ElevenLabs o la API de Suno cuando la abran) implementa estas tres
 * operaciones y el resto de la app no sabe quién está tocando. Así, cambiar
 * de modelo es cambiar una variable de entorno, no reescribir el estudio.
 *
 * El trabajo es asíncrono a propósito: generar tarda de 10 a 60 segundos y
 * ninguna petición web debería quedarse colgada tanto tiempo.
 */

export type Instrumento =
  | 'bajo'
  | 'bateria'
  | 'guitarra'
  | 'teclado'
  | 'cuerdas'
  | 'metales'
  | 'percusion'
  | 'sinte';

export const INSTRUMENTOS: readonly Instrumento[] = [
  'bajo',
  'bateria',
  'guitarra',
  'teclado',
  'cuerdas',
  'metales',
  'percusion',
  'sinte',
];

/** Una canción entera desde cero, sin toma: la pide el productor. */
export interface PeticionCancion {
  /** Cómo suena, en inglés, como lo entienden los modelos. */
  descripcion: string;
  /** Con letra canta; sin letra es instrumental. */
  letra?: string;
  segundos: number;
  bpm?: number;
  /** En inglés: «A minor». */
  tonalidad?: string;
  pulsosPorCompas?: number;
  semilla?: number;
}

export interface PeticionPista {
  /** La toma sobre la que se toca, en WAV. */
  audio: Blob;
  instrumento: Instrumento;
  bpm: number;
  /** En inglés, como lo entienden los modelos: «E minor». */
  tonalidad?: string;
  /** Pulsos por compás: 3, 4, 6… */
  pulsosPorCompas?: number;
  /** Lo que se le pide, con palabras: «bajo de dedos, funky, que respire». */
  descripcion?: string;
  duracion: number;
  semilla?: number;
}

export type EstadoTarea = 'en-cola' | 'generando' | 'listo' | 'fallo';

export interface Tarea {
  id: string;
  estado: EstadoTarea;
  /** Ruta interna del audio, cuando está listo. Se descarga por el proxy. */
  archivo?: string;
  error?: string;
}

/** Lo que se sabe del servidor ahora mismo, sin pedirle ningún trabajo. */
export interface SaludProveedor {
  /** Responde, es quien dice ser y acepta la clave. */
  conectado: boolean;
  /** Es un servidor de prueba (no es IA): la app no debe venderlo como tal. */
  prueba: boolean;
  /** Para quien lo configura: qué servidor es o por qué no se conecta. */
  detalle?: string;
}

export interface ProveedorDePistas {
  id: string;
  nombre: string;
  iniciar(peticion: PeticionPista): Promise<Tarea>;
  /** Canción entera sin toma. Opcional: no todos los modelos saben. */
  iniciarCancion?(peticion: PeticionCancion): Promise<Tarea>;
  consultar(id: string): Promise<Tarea>;
  descargar(archivo: string): Promise<Response>;
  /** Comprobación rápida y barata. Nunca lanza: si algo falla, `conectado: false`. */
  salud?(): Promise<SaludProveedor>;
}

/** Fallo que se puede enseñar tal cual a quien está tocando. */
export class ErrorDeProveedor extends Error {
  constructor(
    message: string,
    readonly status = 502,
  ) {
    super(message);
    this.name = 'ErrorDeProveedor';
  }
}
