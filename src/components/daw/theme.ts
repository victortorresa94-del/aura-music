'use client';

/**
 * Tema del estudio.
 *
 * Los componentes no escriben colores literales: escriben variables CSS. Así
 * el mismo árbol sirve para claro y oscuro sin duplicar estilos ni volver a
 * renderizar nada al cambiar de tema.
 *
 * Criterio de color (panel de neurodiseño, lente Weinschenk + Anya Petrov):
 * la pantalla es casi monocroma a propósito. En una herramienta de creación,
 * el color es información, no decoración. Solo hay dos acentos y los dos
 * significan algo:
 *   · rojo   = está entrando audio, esto se está grabando
 *   · verde  = esto lo ha puesto Aura, no lo has tocado tú. Es el verde de
 *              marca de Aura (#5DBB9C); en claro va oscurecido a #1C7A5B
 *              para que como texto llegue a 4,5:1 sobre blanco.
 * Todo lo demás es gris para que el ojo encuentre esos dos al instante.
 *
 * El claro es el de casa (Aura Music es de la familia Aura) y el que sale por
 * defecto: casi todos los DAW son oscuros y este no quiere parecerse a ellos.
 * El oscuro queda en Ajustes.
 *
 * Profundidad: una sola luz, arriba a la izquierda, para toda la app, y
 * cuatro alturas:
 *   0 · a ras      la página y las calles de la línea de tiempo
 *   1 · apoyado    cabecera, columna de pistas, el dock del transporte
 *   2 · flotante   chips, el aviso, la barra del oído, el clip que arrastras
 *   3 · hoja       los paneles que suben desde abajo
 * En claro casi todo es papel blanco y la altura la cuentan un filo de 1 px
 * y sombras muy suaves teñidas del verde del suelo. En oscuro la cuentan
 * superficies más claras (#0B0B0A → #141413 → #1C1C1A → #1F1F1D).
 */

export type ThemeMode = 'dark' | 'light' | 'system';

/* Clave nueva con el nombre nuevo: quien eligió «Oscuro» cuando el estudio
   era oscuro por defecto vuelve a ver el claro una vez y decide otra vez. */
export const THEME_STORAGE_KEY = 'aura-music:tema';
export const DEFAULT_THEME: ThemeMode = 'light';

/** Referencias a variables CSS. Se usan tal cual en estilos inline. */
export const T = {
  // Superficies, de abajo arriba
  bg: 'var(--daw-bg)',
  surface: 'var(--daw-surface)',
  raised: 'var(--daw-raised)',
  sheet: 'var(--daw-sheet)',
  /** Relleno translúcido de un control: vale sobre cualquier superficie. */
  fill: 'var(--daw-fill)',
  fillStrong: 'var(--daw-fill-strong)',
  /** El «botón» que se mueve dentro de un control segmentado. */
  thumb: 'var(--daw-thumb)',
  /** La bola de un deslizador o de un interruptor encendido. */
  knob: 'var(--daw-knob)',
  /** La sombra de esa bola: tres capas, teñidas del fondo. */
  knobShadow: 'var(--daw-knob-shadow)',
  clip: 'var(--daw-clip)',
  clipAi: 'var(--daw-clip-ai)',
  // Líneas
  border: 'var(--daw-border)',
  borderStrong: 'var(--daw-border-strong)',
  rowLine: 'var(--daw-row-line)',
  // Texto
  text: 'var(--daw-text)',
  dim: 'var(--daw-dim)',
  faint: 'var(--daw-faint)',
  inverse: 'var(--daw-inverse)',
  // Los dos únicos acentos
  rec: 'var(--daw-rec)',
  recSoft: 'var(--daw-rec-soft)',
  /** Rojo de relleno, un punto más oscuro para que el texto encima se lea. */
  recFill: 'var(--daw-rec-fill)',
  onRec: 'var(--daw-on-rec)',
  ai: 'var(--daw-ai)',
  aiSoft: 'var(--daw-ai-soft)',
  // Línea de tiempo
  wave: 'var(--daw-wave)',
  waveStrong: 'var(--daw-wave-strong)',
  grid: 'var(--daw-grid)',
  gridBar: 'var(--daw-grid-bar)',
  // Profundidad
  shadow: 'var(--daw-shadow)',
  rim: 'var(--daw-rim)',
  elev1: 'var(--daw-elev-1)',
  elev2: 'var(--daw-elev-2)',
  elev3: 'var(--daw-elev-3)',
  scrim: 'var(--daw-scrim)',
  glass: 'var(--daw-glass)',
  focus: 'var(--daw-focus)',
  // Movimiento: salida rápida que se asienta, y la curva de los cajones de iOS.
  easeOut: 'cubic-bezier(0.23, 1, 0.32, 1)',
  easeDrawer: 'cubic-bezier(0.32, 0.72, 0, 1)',
  // Hereda la tipografía de la web en la que vive; si no la encuentra, cae
  // en algo razonable en vez de en Times New Roman.
  fontDisplay: "var(--font-display, 'Playfair Display', Georgia, serif)",
  fontBody: "var(--font-body, 'Inter', system-ui, sans-serif)",
  fontMono: "var(--font-mono, 'IBM Plex Mono', ui-monospace, monospace)",
} as const;

/**
 * Contrastes comprobados sobre su fondo (WCAG AA para texto: 4.5:1).
 *   oscuro · texto #F2F1EC sobre #0B0B0A → 17.4 · sobre hoja #1F1F1D → 14.9
 *   oscuro · dim   #A3A29A sobre #0B0B0A →  7.7 · sobre hoja → 6.6
 *   oscuro · faint #8C8B83 sobre #0B0B0A →  5.6 · sobre hoja → 4.8
 *   oscuro · rojo  #DC5448 sobre #0B0B0A →  5.1 · texto sobre #BF3B31 → 5.1
 *   oscuro · verde #5DBB9C sobre #0B0B0A →  8.9
 *   claro  · texto #111114 sobre blanco → 18.9 · sobre el suelo #FAFBFA → 18.0
 *   claro  · dim   #5D5E63 sobre blanco →  6.5 · sobre el suelo → 6.2
 *   claro  · faint #6B6C71 sobre blanco →  5.2 · sobre el suelo → 5.0
 *   claro  · rojo  #C2362B sobre blanco →  5.5 · blanco sobre ese rojo → 5.5
 *   claro  · verde #1C7A5B sobre blanco →  5.3 · sobre el clip de Aura #E3F2EC → 4.6
 */
export const THEME_CSS = `
[data-daw-theme='dark'] {
  --daw-bg: #0B0B0A;
  --daw-surface: #141413;
  --daw-raised: #1C1C1A;
  --daw-sheet: #1F1F1D;
  --daw-fill: rgba(242,241,236,0.065);
  --daw-fill-strong: rgba(242,241,236,0.12);
  --daw-thumb: #3B3A36;
  --daw-knob: #F2F1EC;
  --daw-knob-shadow: 0 0 0 0.5px rgba(4,4,3,0.4), 0 1px 2px rgba(4,4,3,0.35), 1px 3px 8px rgba(4,4,3,0.3);
  --daw-clip: #1E1E1B;
  --daw-clip-ai: #12201B;
  --daw-border: rgba(242,241,236,0.09);
  --daw-border-strong: rgba(242,241,236,0.22);
  --daw-row-line: rgba(242,241,236,0.055);
  --daw-text: #F2F1EC;
  --daw-dim: #A3A29A;
  --daw-faint: #8C8B83;
  --daw-inverse: #0B0B0A;
  --daw-rec: #DC5448;
  --daw-rec-soft: rgba(220,84,72,0.15);
  --daw-rec-fill: #BF3B31;
  --daw-on-rec: #FFF7F3;
  --daw-ai: #5DBB9C;
  --daw-ai-soft: rgba(93,187,156,0.16);
  --daw-wave: rgba(242,241,236,0.55);
  --daw-wave-strong: rgba(242,241,236,0.92);
  --daw-grid: rgba(242,241,236,0.035);
  --daw-grid-bar: rgba(242,241,236,0.085);
  --daw-shadow: rgba(4,4,3,0.55);
  --daw-rim: rgba(242,241,236,0.055);
  --daw-elev-1: inset 0 1px 0 var(--daw-rim), 0.5px 1px 1px rgba(4,4,3,0.45), 1px 2px 4px rgba(4,4,3,0.3), 2px 4px 8px rgba(4,4,3,0.2);
  --daw-elev-2: inset 0 1px 0 rgba(242,241,236,0.07), 1px 2px 3px rgba(4,4,3,0.45), 3px 8px 16px rgba(4,4,3,0.38), 6px 18px 40px rgba(4,4,3,0.32);
  --daw-elev-3: inset 0 1px 0 rgba(242,241,236,0.07), 0 -1px 2px rgba(4,4,3,0.5), 0 -8px 24px rgba(4,4,3,0.4), 0 -24px 64px rgba(4,4,3,0.35);
  --daw-scrim: rgba(4,4,3,0.62);
  --daw-glass: rgba(28,28,26,0.74);
  --daw-focus: rgba(242,241,236,0.82);
  color-scheme: dark;
}

[data-daw-theme='light'] {
  /* El claro es el de Aura: papel blanco para el trabajo, un suelo apenas
     verde salvia debajo, tinta casi negra y sombras teñidas de ese verde (una
     sombra gris sobre un fondo con tinte se lee como suciedad). Los valores
     salen de aura-lite/src/styles/cristal.css. */
  --daw-bg: #FAFBFA;
  --daw-surface: #FFFFFF;
  --daw-raised: #FFFFFF;
  --daw-sheet: #FFFFFF;
  --daw-fill: rgba(20,40,33,0.045);
  --daw-fill-strong: rgba(20,40,33,0.085);
  --daw-thumb: #FFFFFF;
  --daw-knob: #FFFFFF;
  --daw-knob-shadow: 0 0 0 0.5px rgba(17,17,20,0.12), 0 1px 2px rgba(20,40,33,0.10), 0 3px 8px rgba(20,40,33,0.10);
  --daw-clip: #EEF2F0;
  --daw-clip-ai: #E3F2EC;
  --daw-border: rgba(17,17,20,0.08);
  --daw-border-strong: rgba(17,17,20,0.22);
  --daw-row-line: rgba(17,17,20,0.06);
  --daw-text: #111114;
  --daw-dim: #5D5E63;
  --daw-faint: #6B6C71;
  --daw-inverse: #FFFFFF;
  --daw-rec: #C2362B;
  --daw-rec-soft: rgba(194,54,43,0.09);
  --daw-rec-fill: #C2362B;
  --daw-on-rec: #FFFFFF;
  --daw-ai: #1C7A5B;
  --daw-ai-soft: rgba(93,187,156,0.16);
  --daw-wave: rgba(17,17,20,0.42);
  --daw-wave-strong: rgba(17,17,20,0.82);
  --daw-grid: rgba(17,17,20,0.035);
  --daw-grid-bar: rgba(17,17,20,0.08);
  --daw-shadow: rgba(20,40,33,0.12);
  --daw-rim: rgba(255,255,255,0.9);
  --daw-elev-1: 0 0 0 1px rgba(17,17,20,0.06), 0 1px 2px rgba(20,40,33,0.05), 0 2px 8px rgba(20,40,33,0.05);
  --daw-elev-2: 0 0 0 1px rgba(17,17,20,0.06), 0 1px 2px rgba(20,40,33,0.06), 0 8px 24px rgba(20,40,33,0.10), 0 24px 48px -16px rgba(20,40,33,0.16);
  --daw-elev-3: 0 0 0 1px rgba(17,17,20,0.05), 0 -8px 32px rgba(20,40,33,0.10), 0 -24px 64px -16px rgba(20,40,33,0.14);
  --daw-scrim: rgba(17,24,21,0.22);
  --daw-glass: rgba(255,255,255,0.72);
  --daw-focus: rgba(17,17,20,0.72);
  color-scheme: light;
}
`;

/** Resuelve una variable CSS a color real: el canvas no entiende var(). */
export function cssColor(variable: string, fallback = '#888'): string {
  if (typeof window === 'undefined') return fallback;
  // Ya es un color literal (p. ej. el tinte de una pista, "hsl(...)"): no hay
  // nada que resolver, se devuelve tal cual.
  if (!variable.startsWith('var(') && !variable.startsWith('--')) return variable;
  const name = variable.startsWith('var(') ? variable.slice(4, -1) : variable;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name.trim());
  return value.trim() || fallback;
}

export function resolveTheme(mode: ThemeMode): 'dark' | 'light' {
  if (mode !== 'system') return mode;
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

/**
 * Los matices de las pistas, por orden de creación.
 *
 * Un vistazo tiene que bastar para distinguir seis pistas sin leer el nombre
 * de cada una, pero ninguna puede parecerse a los dos colores que significan
 * algo: el rojo (grabando) y el ámbar (lo ha tocado la máquina). Antes salían
 * del ángulo áureo empezando en 0°, y la primera pista, la guitarra de casi
 * todos los proyectos, salía rosa: un rojo lavado justo al lado del botón de
 * grabar. Fuera de la franja del rojo (330°–20°) y la del ámbar (25°–70°)
 * caben cuatro matices bien separados (azul, oliva, violeta, verde); de la
 * quinta pista en adelante se repiten girados un poco y con otra luz, en vez
 * de meter un quinto matiz que acabaría en rosa.
 */
const MATICES = [205, 95, 270, 150];
const LUZ_OSCURO = [68, 56, 78];
const LUZ_CLARO = [38, 50, 30];

/**
 * El tinte de cada pista. La saturación se queda deliberadamente baja: esto
 * es una herramienta de música, no un gráfico, y CLAUDE.md prohíbe los
 * acentos llamativos. El resultado se nota, no grita.
 */
export function trackTint(index: number, theme: 'dark' | 'light'): string {
  const i = Math.max(0, Math.floor(index));
  const vuelta = Math.floor(i / MATICES.length) % LUZ_OSCURO.length;
  const hue = MATICES[i % MATICES.length] + vuelta * 18;
  const sat = theme === 'dark' ? 28 : 30;
  const light = (theme === 'dark' ? LUZ_OSCURO : LUZ_CLARO)[vuelta];
  return `hsl(${hue} ${sat}% ${light}%)`;
}

/** Vibración corta. Confirma sin mirar la pantalla, que es de lo que se trata. */
export function haptic(pattern: number | number[] = 12) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* el navegador puede no permitirlo */
  }
}
