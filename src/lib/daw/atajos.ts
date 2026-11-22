/**
 * Los atajos de teclado del estudio: la lista (con su nombre en español,
 * para el menú Editar y para Ayuda → Atajos) y qué tecla es cada uno.
 *
 * Son los de toda la vida en cualquier DAW: Espacio reproduce, R graba,
 * Suprimir borra, Ctrl+Z deshace. Aquí solo se decide QUÉ atajo es una
 * pulsación; qué hace cada uno vive en `useAtajos`.
 *
 * Mientras escribes en un campo (renombrar la idea, el tempo) no cuenta
 * ninguno: ahí Retroceso borra una letra, no una pista.
 */

export type IdAtajo =
  | 'reproducir'
  | 'grabar'
  | 'deshacer'
  | 'rehacer'
  | 'copiar'
  | 'cortar'
  | 'pegar'
  | 'duplicar'
  | 'borrar'
  | 'dividir'
  | 'silenciar'
  | 'solo'
  | 'pista-arriba'
  | 'pista-abajo'
  | 'inicio'
  | 'fin'
  | 'compas-atras'
  | 'compas-adelante'
  | 'zoom-mas'
  | 'zoom-menos'
  | 'soltar';

export type GrupoAtajo = 'Transporte' | 'Editar' | 'Pistas' | 'Ver';

export interface Atajo {
  id: IdAtajo;
  /** Lo que dice el menú: «Deshacer», «Cortar el clip en el cursor». */
  nombre: string;
  grupo: GrupoAtajo;
  /** Las teclas como se escriben en Windows; `teclasVisibles` las pasa a Mac. */
  teclas: string[];
}

/** En el orden en que se enseñan. Cada `teclas` es una alternativa («Supr» o «Retroceso»). */
export const ATAJOS: readonly Atajo[] = [
  { id: 'reproducir', nombre: 'Reproducir o parar', grupo: 'Transporte', teclas: ['Espacio'] },
  { id: 'grabar', nombre: 'Grabar o parar', grupo: 'Transporte', teclas: ['R'] },
  { id: 'inicio', nombre: 'Ir al principio', grupo: 'Transporte', teclas: ['Inicio'] },
  { id: 'fin', nombre: 'Ir al final', grupo: 'Transporte', teclas: ['Fin'] },
  { id: 'compas-atras', nombre: 'Un compás atrás', grupo: 'Transporte', teclas: ['←'] },
  { id: 'compas-adelante', nombre: 'Un compás adelante', grupo: 'Transporte', teclas: ['→'] },

  { id: 'deshacer', nombre: 'Deshacer', grupo: 'Editar', teclas: ['Ctrl+Z'] },
  { id: 'rehacer', nombre: 'Rehacer', grupo: 'Editar', teclas: ['Ctrl+Mayús+Z', 'Ctrl+Y'] },
  { id: 'cortar', nombre: 'Cortar', grupo: 'Editar', teclas: ['Ctrl+X'] },
  { id: 'copiar', nombre: 'Copiar', grupo: 'Editar', teclas: ['Ctrl+C'] },
  { id: 'pegar', nombre: 'Pegar en el cursor', grupo: 'Editar', teclas: ['Ctrl+V'] },
  { id: 'duplicar', nombre: 'Duplicar', grupo: 'Editar', teclas: ['Ctrl+D'] },
  { id: 'dividir', nombre: 'Cortar el clip en el cursor', grupo: 'Editar', teclas: ['S'] },
  { id: 'borrar', nombre: 'Borrar la pista', grupo: 'Editar', teclas: ['Supr', 'Retroceso'] },

  { id: 'silenciar', nombre: 'Silenciar la pista (mute)', grupo: 'Pistas', teclas: ['M'] },
  { id: 'solo', nombre: 'Solo de la pista', grupo: 'Pistas', teclas: ['Mayús+S'] },
  { id: 'pista-arriba', nombre: 'Pista de arriba', grupo: 'Pistas', teclas: ['↑'] },
  { id: 'pista-abajo', nombre: 'Pista de abajo', grupo: 'Pistas', teclas: ['↓'] },
  { id: 'soltar', nombre: 'Dejar de elegir la pista', grupo: 'Pistas', teclas: ['Esc'] },

  { id: 'zoom-mas', nombre: 'Acercar', grupo: 'Ver', teclas: ['+'] },
  { id: 'zoom-menos', nombre: 'Alejar', grupo: 'Ver', teclas: ['−'] },
];

export function atajo(id: IdAtajo): Atajo {
  const encontrado = ATAJOS.find((item) => item.id === id);
  if (!encontrado) throw new Error(`Atajo desconocido: ${id}`);
  return encontrado;
}

/** Las teclas de un atajo listas para enseñar: «Ctrl+Z» en Windows, «⌘Z» en Mac. */
export function teclasVisibles(id: IdAtajo, mac = esMac()): string {
  const [primera] = atajo(id).teclas;
  if (!mac) return primera;
  return primera
    .replace('Ctrl+', '⌘')
    .replace('Mayús+', '⇧')
    .replace('Retroceso', '⌫')
    .replace('Supr', '⌦');
}

export function esMac(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent);
}

/** Lo que importa de una pulsación (un `KeyboardEvent` lo cumple). */
export interface Pulsacion {
  key: string;
  code?: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

/**
 * Qué atajo es esta pulsación, o null. Ctrl y ⌘ valen lo mismo: en Mac se
 * usa ⌘ y en Windows Ctrl, y nadie tiene que acordarse de cuál toca.
 */
export function atajoDe(e: Pulsacion): IdAtajo | null {
  if (e.altKey) return null;
  const mando = e.ctrlKey || e.metaKey;
  const tecla = e.key.length === 1 ? e.key.toLowerCase() : e.key;

  if (mando) {
    if (tecla === 'z') return e.shiftKey ? 'rehacer' : 'deshacer';
    if (e.shiftKey) return null;
    if (tecla === 'y') return 'rehacer';
    if (tecla === 'c') return 'copiar';
    if (tecla === 'x') return 'cortar';
    if (tecla === 'v') return 'pegar';
    if (tecla === 'd') return 'duplicar';
    return null;
  }

  // + y − del teclado normal (con o sin Mayús) y del numérico.
  if (tecla === '+' || tecla === '=') return 'zoom-mas';
  if (tecla === '-' || tecla === '_') return 'zoom-menos';

  if (e.shiftKey) {
    return tecla === 's' ? 'solo' : null;
  }

  switch (tecla) {
    case ' ':
      return 'reproducir';
    case 'r':
      return 'grabar';
    case 's':
      return 'dividir';
    case 'm':
      return 'silenciar';
    case 'Delete':
    case 'Backspace':
      return 'borrar';
    case 'ArrowUp':
      return 'pista-arriba';
    case 'ArrowDown':
      return 'pista-abajo';
    case 'ArrowLeft':
      return 'compas-atras';
    case 'ArrowRight':
      return 'compas-adelante';
    case 'Home':
      return 'inicio';
    case 'End':
      return 'fin';
    case 'Escape':
      return 'soltar';
    default:
      return null;
  }
}

/** Los que funcionan también con una hoja o el mezclador abiertos. */
export const ATAJOS_DE_TRANSPORTE: ReadonlySet<IdAtajo> = new Set(['reproducir', 'deshacer', 'rehacer']);

/** Lo mínimo de un elemento para saber dónde está el foco (un `HTMLElement` lo cumple). */
interface Objetivo {
  tagName?: string;
  isContentEditable?: boolean;
  getAttribute?: (nombre: string) => string | null;
  type?: string;
}

/** ¿Está el foco en un sitio donde se escribe? Ahí no cuenta ningún atajo. */
export function escribiendoEn(objetivo: unknown): boolean {
  const el = objetivo as Objetivo | null;
  if (!el || typeof el !== 'object') return false;
  const tag = el.tagName;
  if (tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable) return true;
  if (tag === 'INPUT') {
    // Un deslizador o una casilla no son para escribir, pero las flechas
    // ya las usan ellos: eso lo decide `teclaDelMando`.
    const tipo = (el.type ?? '').toLowerCase();
    return !['range', 'checkbox', 'radio', 'button', 'submit'].includes(tipo);
  }
  return false;
}

/**
 * ¿Es una tecla que el control enfocado ya usa? Un deslizador mueve su valor
 * con las flechas e Inicio; un botón se pulsa con Espacio. Ahí el atajo cede.
 */
export function teclaDelMando(objetivo: unknown, id: IdAtajo): boolean {
  const el = objetivo as Objetivo | null;
  if (!el || typeof el !== 'object') return false;
  const rol = el.getAttribute?.('role');
  const deslizador = rol === 'slider' || (el.tagName === 'INPUT' && (el.type ?? '').toLowerCase() === 'range');
  if (deslizador) {
    return ['pista-arriba', 'pista-abajo', 'compas-atras', 'compas-adelante', 'inicio', 'fin'].includes(id);
  }
  return false;
}
