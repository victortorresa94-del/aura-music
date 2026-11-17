/**
 * Mezcla: lo que se guarda de cada pista y del master.
 *
 * Todo es opcional en el proyecto guardado. Una idea grabada antes de que
 * existiera el mezclador no trae nada de esto, y tiene que abrir y sonar
 * exactamente igual que antes: por eso cada valor por defecto es neutro (el
 * ecualizador a 0 dB, el compresor y la saturación a cero, sin envíos) y los
 * ajustes del master por defecto reproducen el limitador que ya había.
 */

export type Espacio = 'estudio' | 'sala' | 'catedral';
export type DivisionEco = '1/8' | '1/4' | '1/4.';
/** Cómo sale el WAV: sin tocar, a −14 LUFS (plataformas) o a −16 LUFS (para el móvil). */
export type ObjetivoMaster = 'no' | 'plataformas' | 'movil';

export interface MezclaPista {
  /** De −1 (izquierda) a 1 (derecha). */
  panorama: number;
  /** Ecualizador de tres bandas, en dB, de −12 a +12. */
  graves: number;
  medios: number;
  agudos: number;
  /** Cuánto comprime, de 0 (nada) a 1. */
  compresor: number;
  /** De 0 (limpio) a 1. */
  saturacion: number;
  /** Envíos a los dos buses compartidos, de 0 a 1. Salen después del fader. */
  reverb: number;
  eco: number;
}

export interface AjustesMaster {
  /** Ganancia lineal del master. 1 = tal cual. */
  volumen: number;
  /** El sitio donde suena la reverb compartida. */
  espacio: Espacio;
  /** De 0 a 1: alarga o acorta la cola de ese sitio. */
  tamano: number;
  /** El eco va siempre a tempo: corchea, negra o negra con puntillo. */
  division: DivisionEco;
  /** Cuánto vuelve el eco sobre sí mismo, de 0 a 0,85. */
  repeticiones: number;
  limitador: boolean;
  /** Se aplica al exportar la mezcla entera. */
  masterizado: ObjetivoMaster;
}

export const MEZCLA_NEUTRA: MezclaPista = {
  panorama: 0,
  graves: 0,
  medios: 0,
  agudos: 0,
  compresor: 0,
  saturacion: 0,
  reverb: 0,
  eco: 0,
};

export const MASTER_POR_DEFECTO: AjustesMaster = {
  volumen: 1,
  espacio: 'sala',
  tamano: 0.5,
  division: '1/4',
  repeticiones: 0.35,
  // El limitador ya estaba siempre puesto: quitarlo cambiaría cómo suenan
  // las ideas de antes.
  limitador: true,
  masterizado: 'no',
};

export const LIMITES = {
  ecualizador: 12,
  /** +6 dB arriba del todo del fader, como en una mesa. */
  volumenMax: 10 ** (6 / 20),
  repeticionesMax: 0.85,
} as const;

const ESPACIOS: readonly Espacio[] = ['estudio', 'sala', 'catedral'];
const DIVISIONES: readonly DivisionEco[] = ['1/8', '1/4', '1/4.'];
const OBJETIVOS: readonly ObjetivoMaster[] = ['no', 'plataformas', 'movil'];

/** Un número que viene de disco o de Claude: si no es un número, el neutro. */
function num(valor: unknown, neutro: number, min: number, max: number): number {
  return typeof valor === 'number' && Number.isFinite(valor) ? Math.min(max, Math.max(min, valor)) : neutro;
}

function de<T extends string>(valor: unknown, opciones: readonly T[], neutro: T): T {
  return opciones.includes(valor as T) ? (valor as T) : neutro;
}

/** La mezcla completa de una pista, con lo que falte puesto a neutro y todo en su rango. */
export function mezclaDe(pista: { mezcla?: Partial<MezclaPista> | null }): MezclaPista {
  const m = pista.mezcla ?? {};
  const eq = LIMITES.ecualizador;
  return {
    panorama: num(m.panorama, 0, -1, 1),
    graves: num(m.graves, 0, -eq, eq),
    medios: num(m.medios, 0, -eq, eq),
    agudos: num(m.agudos, 0, -eq, eq),
    compresor: num(m.compresor, 0, 0, 1),
    saturacion: num(m.saturacion, 0, 0, 1),
    reverb: num(m.reverb, 0, 0, 1),
    eco: num(m.eco, 0, 0, 1),
  };
}

/** Los ajustes del master, con lo que falte puesto por defecto. */
export function masterDe(proyecto: { master?: Partial<AjustesMaster> | null }): AjustesMaster {
  const m = proyecto.master ?? {};
  const d = MASTER_POR_DEFECTO;
  return {
    volumen: num(m.volumen, d.volumen, 0, LIMITES.volumenMax),
    espacio: de(m.espacio, ESPACIOS, d.espacio),
    tamano: num(m.tamano, d.tamano, 0, 1),
    division: de(m.division, DIVISIONES, d.division),
    repeticiones: num(m.repeticiones, d.repeticiones, 0, LIMITES.repeticionesMax),
    limitador: typeof m.limitador === 'boolean' ? m.limitador : d.limitador,
    masterizado: de(m.masterizado, OBJETIVOS, d.masterizado),
  };
}

/** ¿Lleva algo puesto? Para decir «Efectos» o el nombre de lo que hay. */
export function tieneEfectos(m: MezclaPista): boolean {
  return (
    m.graves !== 0 ||
    m.medios !== 0 ||
    m.agudos !== 0 ||
    m.compresor > 0 ||
    m.saturacion > 0 ||
    m.reverb > 0 ||
    m.eco > 0
  );
}

/* -------------------------------------------------------------------------- */
/* Preajustes                                                                  */
/* -------------------------------------------------------------------------- */

export type IdPreajuste = 'seco' | 'voz-calida' | 'guitarra-flamenca' | 'bateria-pegada' | 'sala' | 'catedral';

export interface Preajuste {
  id: IdPreajuste;
  nombre: string;
  /** Lo que hace, en una frase corta. */
  descripcion: string;
  /** Todo menos el panorama: un preajuste no te mueve la pista de sitio. */
  mezcla: Omit<MezclaPista, 'panorama'>;
  /**
   * La reverb es una para toda la mezcla. «Sala» y «Catedral» la cambian de
   * sitio, y la hoja lo dice antes de tocarlo.
   */
  espacio?: Espacio;
}

/*
 * Pensados para lo que se graba con un móvil: tomas con algo de retumbe de
 * la habitación, guitarras con el micro cerca de la boca y cajas que suenan
 * a caja de cartón. Moves pequeños; nada que haya que deshacer después.
 */
export const PREAJUSTES: readonly Preajuste[] = [
  {
    id: 'seco',
    nombre: 'Seco',
    descripcion: 'Tal como se grabó, sin efectos.',
    mezcla: { graves: 0, medios: 0, agudos: 0, compresor: 0, saturacion: 0, reverb: 0, eco: 0 },
  },
  {
    id: 'voz-calida',
    nombre: 'Voz cálida',
    descripcion: 'Cuerpo abajo, aire arriba y un compresor que la sujeta delante.',
    mezcla: { graves: 2, medios: -1.5, agudos: 2.5, compresor: 0.55, saturacion: 0.15, reverb: 0.22, eco: 0.08 },
  },
  {
    id: 'guitarra-flamenca',
    nombre: 'Guitarra flamenca',
    descripcion: 'Sin el retumbe de la caja, con brillo en el rasgueo y algo de sala.',
    mezcla: { graves: -2.5, medios: 1.5, agudos: 3, compresor: 0.35, saturacion: 0.05, reverb: 0.18, eco: 0 },
  },
  {
    id: 'bateria-pegada',
    nombre: 'Batería con pegada',
    descripcion: 'Bombo con peso, menos cartón y el golpe por delante.',
    mezcla: { graves: 3, medios: -2.5, agudos: 2, compresor: 0.75, saturacion: 0.3, reverb: 0.1, eco: 0 },
  },
  {
    id: 'sala',
    nombre: 'Sala',
    descripcion: 'Como tocando en una sala pequeña con buena acústica.',
    mezcla: { graves: 0, medios: 0, agudos: 0, compresor: 0.15, saturacion: 0, reverb: 0.35, eco: 0 },
    espacio: 'sala',
  },
  {
    id: 'catedral',
    nombre: 'Catedral',
    descripcion: 'Una cola larga y oscura, de piedra.',
    mezcla: { graves: 0, medios: 0, agudos: -1, compresor: 0, saturacion: 0, reverb: 0.55, eco: 0 },
    espacio: 'catedral',
  },
];

export const IDS_PREAJUSTES = PREAJUSTES.map((p) => p.id) as [IdPreajuste, ...IdPreajuste[]];

export function preajuste(id: string): Preajuste | null {
  return PREAJUSTES.find((p) => p.id === id) ?? null;
}

/** La mezcla de una pista con un preajuste puesto (conserva su panorama). */
export function conPreajuste(actual: MezclaPista, p: Preajuste): MezclaPista {
  return { ...p.mezcla, panorama: actual.panorama };
}

/**
 * El preajuste que coincide con lo que hay ahora, o null si lo has tocado a
 * tu manera. «Sala» y «Catedral» solo cuentan si la reverb compartida está
 * en ese sitio.
 */
export function preajusteActual(m: MezclaPista, espacio: Espacio): IdPreajuste | null {
  const casi = (a: number, b: number) => Math.abs(a - b) < 0.005;
  for (const p of PREAJUSTES) {
    if (p.espacio && p.espacio !== espacio) continue;
    const q = p.mezcla;
    if (
      casi(m.graves, q.graves) &&
      casi(m.medios, q.medios) &&
      casi(m.agudos, q.agudos) &&
      casi(m.compresor, q.compresor) &&
      casi(m.saturacion, q.saturacion) &&
      casi(m.reverb, q.reverb) &&
      casi(m.eco, q.eco)
    ) {
      return p.id;
    }
  }
  return null;
}

export const NOMBRE_ESPACIO: Record<Espacio, string> = {
  estudio: 'Estudio',
  sala: 'Sala',
  catedral: 'Catedral',
};

export const NOMBRE_DIVISION: Record<DivisionEco, string> = {
  '1/8': 'Corchea',
  '1/4': 'Negra',
  '1/4.': 'Negra con puntillo',
};
