/**
 * Los comandos de la idea: una sola tabla para la barra de menús del PC, el
 * menú que sale del nombre en el móvil y los atajos de teclado. Así un atajo
 * que se enseña en el menú es siempre el que funciona, y no hay dos listas que
 * se desincronicen.
 *
 * Aquí solo hay datos y funciones puras (se prueban sin navegador). Qué hace
 * cada comando lo decide `useArchivo` (y, los de edición de la línea de
 * tiempo, `useEdicion`).
 */

export type IdComando =
  | 'nueva'
  | 'abrir'
  | 'guardar'
  | 'guardarCopia'
  | 'renombrar'
  | 'exportarWav'
  | 'exportarPistas'
  | 'exportarZip'
  | 'importarAudio'
  | 'importarIdea'
  | 'compartir'
  | 'cerrar'
  | 'borrar'
  | 'deshacer'
  | 'rehacer'
  | 'ajustes'
  | 'tocar'
  | 'loops'
  | 'opcionesPista'
  | 'duplicarPista'
  | 'silenciarPista'
  | 'soloPista'
  | 'borrarPista'
  | 'mezclador'
  | 'productor'
  | 'temaClaro'
  | 'temaOscuro'
  | 'temaSistema'
  | 'atajos'
  | 'latencia'
  | 'intro'
  // Lo de siempre de un DAW: transporte, portapapeles y la línea de tiempo.
  | 'reproducir'
  | 'grabar'
  | 'irAlPrincipio'
  | 'irAlFinal'
  | 'compasAtras'
  | 'compasAdelante'
  | 'copiarPista'
  | 'cortarPista'
  | 'pegarPista'
  | 'dividirClip'
  | 'pistaArriba'
  | 'pistaAbajo'
  | 'soltarPista'
  | 'acercar'
  | 'alejar';

/**
 * Un atajo: la tecla (en minúscula, como `KeyboardEvent.key`: «z», « »,
 * «delete», «arrowup») y los modificadores. `mod` es Ctrl en Windows y
 * Linux, ⌘ en Mac.
 */
export interface Atajo {
  tecla: string;
  mod?: boolean;
  shift?: boolean;
}

/**
 * Los atajos de siempre. Ojo: en una pestaña normal, Chrome se queda Ctrl+N y
 * Ctrl+W (abren y cierran ventanas) y la página no se entera; con la app
 * instalada sí llegan. Por eso se enseñan igual: es donde se van a usar.
 *
 * Ctrl+S y Ctrl+R siguen siendo Guardar y del navegador: S y R solas cortan
 * y graban, sin modificador, como en cualquier DAW.
 */
export const ATAJOS: Partial<Record<IdComando, Atajo[]>> = {
  nueva: [{ tecla: 'n', mod: true }],
  abrir: [{ tecla: 'o', mod: true }],
  guardar: [{ tecla: 's', mod: true }],
  guardarCopia: [{ tecla: 's', mod: true, shift: true }],
  cerrar: [{ tecla: 'w', mod: true }],
  deshacer: [{ tecla: 'z', mod: true }],
  // Ctrl+Y es el rehacer de Windows; Ctrl+Mayús+Z, el de todos los demás.
  rehacer: [
    { tecla: 'z', mod: true, shift: true },
    { tecla: 'y', mod: true },
  ],
  ajustes: [{ tecla: ',', mod: true }],

  cortarPista: [{ tecla: 'x', mod: true }],
  copiarPista: [{ tecla: 'c', mod: true }],
  pegarPista: [{ tecla: 'v', mod: true }],
  duplicarPista: [{ tecla: 'd', mod: true }],
  dividirClip: [{ tecla: 's' }],
  borrarPista: [{ tecla: 'delete' }, { tecla: 'backspace' }],

  reproducir: [{ tecla: ' ' }],
  grabar: [{ tecla: 'r' }],
  irAlPrincipio: [{ tecla: 'home' }],
  irAlFinal: [{ tecla: 'end' }],
  compasAtras: [{ tecla: 'arrowleft' }],
  compasAdelante: [{ tecla: 'arrowright' }],

  silenciarPista: [{ tecla: 'm' }],
  soloPista: [{ tecla: 's', shift: true }],
  pistaArriba: [{ tecla: 'arrowup' }],
  pistaAbajo: [{ tecla: 'arrowdown' }],
  soltarPista: [{ tecla: 'escape' }],

  // El + está en una tecla distinta en cada teclado: en el español va
  // solo; en el inglés, con Mayús sobre el «=».
  acercar: [{ tecla: '+' }, { tecla: '+', shift: true }, { tecla: '=' }],
  alejar: [{ tecla: '-' }, { tecla: '_', shift: true }],
};

/** El nombre de cada comando con atajo, para la chuleta de Ayuda → Atajos. */
export const NOMBRES_DE_COMANDOS: Partial<Record<IdComando, string>> = {
  nueva: 'Nueva idea',
  abrir: 'Abrir',
  guardar: 'Guardar',
  guardarCopia: 'Guardar como copia',
  cerrar: 'Cerrar idea',
  deshacer: 'Deshacer',
  rehacer: 'Rehacer',
  ajustes: 'Ajustes',
  cortarPista: 'Cortar la pista',
  copiarPista: 'Copiar la pista',
  pegarPista: 'Pegar en el cursor',
  duplicarPista: 'Duplicar la pista',
  dividirClip: 'Cortar el clip en el cursor',
  borrarPista: 'Borrar la pista',
  reproducir: 'Reproducir o parar',
  grabar: 'Grabar o parar',
  irAlPrincipio: 'Ir al principio',
  irAlFinal: 'Ir al final',
  compasAtras: 'Un compás atrás',
  compasAdelante: 'Un compás adelante',
  silenciarPista: 'Silenciar la pista',
  soloPista: 'Solo de la pista',
  pistaArriba: 'Pista de arriba',
  pistaAbajo: 'Pista de abajo',
  soltarPista: 'Dejar de elegir la pista',
  acercar: 'Acercar',
  alejar: 'Alejar',
};

/** La chuleta de atajos, por apartados y en el orden en que se enseña. */
export const SECCIONES_DE_ATAJOS: { titulo: string; ids: IdComando[] }[] = [
  { titulo: 'Tocar', ids: ['reproducir', 'grabar', 'irAlPrincipio', 'irAlFinal', 'compasAtras', 'compasAdelante'] },
  {
    titulo: 'Editar',
    ids: ['deshacer', 'rehacer', 'cortarPista', 'copiarPista', 'pegarPista', 'duplicarPista', 'dividirClip', 'borrarPista'],
  },
  { titulo: 'Pistas', ids: ['silenciarPista', 'soloPista', 'pistaArriba', 'pistaAbajo', 'soltarPista'] },
  { titulo: 'Ver', ids: ['acercar', 'alejar'] },
  { titulo: 'Archivo', ids: ['nueva', 'abrir', 'guardar', 'guardarCopia', 'cerrar', 'ajustes'] },
];

/**
 * Los atajos que editan la línea de tiempo con teclas sueltas. Con una hoja
 * o el mezclador encima no cuentan (borrar una pista que no ves, no), y con
 * «Tocar» abierto tampoco: ahí el teclado toca notas.
 */
const DE_LA_LINEA_DE_TIEMPO: ReadonlySet<IdComando> = new Set<IdComando>([
  'grabar',
  'irAlPrincipio',
  'irAlFinal',
  'compasAtras',
  'compasAdelante',
  'copiarPista',
  'cortarPista',
  'pegarPista',
  'duplicarPista',
  'dividirClip',
  'borrarPista',
  'silenciarPista',
  'soloPista',
  'pistaArriba',
  'pistaAbajo',
  'soltarPista',
  'acercar',
  'alejar',
]);

/** Dónde está la pantalla: el estudio a la vista, una hoja encima o «Tocar» abierto. */
export type ModoTeclado = 'estudio' | 'hoja' | 'tocar';

/** ¿Vale este atajo con la pantalla así? Espacio, en «Tocar», es de «Tocar» (escucha lo grabado). */
export function atajoPermitido(id: IdComando, modo: ModoTeclado): boolean {
  if (modo === 'estudio') return true;
  if (DE_LA_LINEA_DE_TIEMPO.has(id)) return false;
  return !(modo === 'tocar' && id === 'reproducir');
}

/** Los que se repiten dejando la tecla pulsada (las flechas y el zoom). El resto, una vez. */
export const SE_REPITEN: ReadonlySet<IdComando> = new Set<IdComando>([
  'compasAtras',
  'compasAdelante',
  'pistaArriba',
  'pistaAbajo',
  'acercar',
  'alejar',
]);

export interface Tecla {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

/**
 * Qué comando pide una pulsación, o null. En Mac el modificador es ⌘ y Ctrl
 * se deja en paz (Ctrl+letra mueve el cursor en los campos de texto); en el
 * resto, al revés. Con Alt no se dispara nada: Alt+letra escribe caracteres
 * en muchos teclados (la @ en el español de Mac, por ejemplo).
 */
export function comandoDeTecla(tecla: Tecla, mac: boolean): IdComando | null {
  if (tecla.altKey) return null;
  const mod = mac ? tecla.metaKey : tecla.ctrlKey;
  const otro = mac ? tecla.ctrlKey : tecla.metaKey;
  if (otro) return null;
  const key = tecla.key.toLowerCase();
  for (const [id, atajos] of Object.entries(ATAJOS) as [IdComando, Atajo[]][]) {
    for (const atajo of atajos) {
      if (atajo.tecla === key && !!atajo.mod === mod && !!atajo.shift === tecla.shiftKey) return id;
    }
  }
  return null;
}

/** Cómo se escribe cada tecla que no es una letra. */
const NOMBRE_DE_TECLA: Record<string, { pc: string; mac: string }> = {
  ' ': { pc: 'Espacio', mac: 'Espacio' },
  delete: { pc: 'Supr', mac: '⌦' },
  backspace: { pc: 'Retroceso', mac: '⌫' },
  arrowup: { pc: '↑', mac: '↑' },
  arrowdown: { pc: '↓', mac: '↓' },
  arrowleft: { pc: '←', mac: '←' },
  arrowright: { pc: '→', mac: '→' },
  home: { pc: 'Inicio', mac: '↖' },
  end: { pc: 'Fin', mac: '↘' },
  escape: { pc: 'Esc', mac: 'Esc' },
  '-': { pc: '−', mac: '−' },
};

/** El atajo escrito como lo espera cada sistema: «Ctrl+Mayús+S» o «⇧⌘S». Solo el primero si hay varios. */
export function textoAtajo(id: IdComando, mac: boolean): string | null {
  const atajo = ATAJOS[id]?.[0];
  if (!atajo) return null;
  const nombre = NOMBRE_DE_TECLA[atajo.tecla];
  const tecla = nombre ? (mac ? nombre.mac : nombre.pc) : atajo.tecla.toUpperCase();
  if (mac) return `${atajo.shift ? '⇧' : ''}${atajo.mod ? '⌘' : ''}${tecla}`;
  return [atajo.mod ? 'Ctrl' : null, atajo.shift ? 'Mayús' : null, tecla].filter(Boolean).join('+');
}

/**
 * «Guardado hace 3 s». Lo que importa es que se vea que está a salvo y desde
 * cuándo, no la hora exacta: segundos el primer minuto, luego minutos, luego
 * horas, y a partir de un día, la fecha.
 */
export function haceCuanto(desde: number, ahora: number): string {
  const s = Math.max(0, Math.floor((ahora - desde) / 1000));
  if (s < 2) return 'ahora mismo';
  if (s < 60) return `hace ${s} s`;
  const min = Math.floor(s / 60);
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return h === 1 ? 'hace 1 hora' : `hace ${h} horas`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'ayer' : `hace ${d} días`;
}

/** Lo mínimo de un elemento para saber dónde está el foco (un `HTMLElement` lo cumple). */
interface Foco {
  tagName?: string;
  isContentEditable?: boolean;
  type?: string;
  getAttribute?: (nombre: string) => string | null;
}

/**
 * ¿El foco está escribiendo? Entonces los atajos de la idea no se meten
 * (Ctrl+Z deshace lo escrito, Retroceso borra una letra). Un deslizador o una
 * casilla no son para escribir: ahí los atajos siguen valiendo.
 */
export function escribiendo(objetivo: Foco | null): boolean {
  if (!objetivo) return false;
  const tag = objetivo.tagName;
  if (tag === 'TEXTAREA' || tag === 'SELECT' || objetivo.isContentEditable) return true;
  if (tag !== 'INPUT') return false;
  const tipo = (objetivo.type ?? 'text').toLowerCase();
  return !['range', 'checkbox', 'radio', 'button', 'submit', 'color', 'file'].includes(tipo);
}

/**
 * ¿Es una tecla que el control enfocado ya usa? Un deslizador (el volumen,
 * el panorama) se mueve con las flechas, Inicio y Fin: ahí el atajo cede.
 */
export function teclaDelMando(objetivo: Foco | null, id: IdComando): boolean {
  if (!objetivo) return false;
  const deslizador =
    objetivo.getAttribute?.('role') === 'slider' ||
    (objetivo.tagName === 'INPUT' && (objetivo.type ?? '').toLowerCase() === 'range');
  if (!deslizador) return false;
  return ['pistaArriba', 'pistaAbajo', 'compasAtras', 'compasAdelante', 'irAlPrincipio', 'irAlFinal'].includes(id);
}
