/**
 * Los comandos de la idea: una sola tabla para la barra de menús del PC, el
 * menú que sale del nombre en el móvil y los atajos de teclado. Así un atajo
 * que se enseña en el menú es siempre el que funciona, y no hay dos listas que
 * se desincronicen.
 *
 * Aquí solo hay datos y funciones puras (se prueban sin navegador). Qué hace
 * cada comando lo decide `useArchivo`.
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
  | 'intro';

/** Un atajo: la tecla (en minúscula) y los modificadores. `mod` es Ctrl en Windows y Linux, ⌘ en Mac. */
export interface Atajo {
  tecla: string;
  mod?: boolean;
  shift?: boolean;
}

/**
 * Los atajos de siempre. Ojo: en una pestaña normal, Chrome se queda Ctrl+N y
 * Ctrl+W (abren y cierran ventanas) y la página no se entera; con la app
 * instalada sí llegan. Por eso se enseñan igual: es donde se van a usar.
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
};

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

/** El atajo escrito como lo espera cada sistema: «Ctrl+Mayús+S» o «⇧⌘S». Solo el primero si hay varios. */
export function textoAtajo(id: IdComando, mac: boolean): string | null {
  const atajo = ATAJOS[id]?.[0];
  if (!atajo) return null;
  const tecla = atajo.tecla.length === 1 ? atajo.tecla.toUpperCase() : atajo.tecla;
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

/** ¿El foco está escribiendo? Entonces los atajos de la idea no se meten (Ctrl+Z deshace lo escrito). */
export function escribiendo(objetivo: { tagName?: string; isContentEditable?: boolean } | null): boolean {
  if (!objetivo) return false;
  const tag = objetivo.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || !!objetivo.isContentEditable;
}
