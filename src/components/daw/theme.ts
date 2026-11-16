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
 *   · ámbar  = esto lo ha generado la IA, no lo has tocado tú
 * Todo lo demás es gris para que el ojo encuentre esos dos al instante.
 *
 * Profundidad (acabado premium): una sola luz, arriba a la izquierda, para
 * toda la app, y cuatro alturas:
 *   0 · a ras      la página y las calles de la línea de tiempo
 *   1 · apoyado    cabecera, columna de pistas, el dock del transporte
 *   2 · flotante   chips, el aviso, la barra del oído, el clip que arrastras
 *   3 · hoja       los paneles que suben desde abajo
 * En oscuro la altura se cuenta sobre todo con superficies más claras
 * (#0B0B0A → #141413 → #1C1C1A → #1F1F1D); las sombras van en tres capas
 * teñidas del fondo, nunca negro puro, y cada superficie lleva un filo de
 * luz de 1 px arriba (inset 0 1px 0).
 */

export type ThemeMode = 'dark' | 'light' | 'system';

export const THEME_STORAGE_KEY = 'compas:theme';

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
 *   oscuro · ámbar #CDA42B sobre #0B0B0A →  8.4
 *   claro  · texto #17160F sobre #F1F0EA → 15.9
 *   claro  · dim   #57564F sobre #F1F0EA →  6.5
 *   claro  · faint #6E6D66 sobre #F1F0EA →  4.6
 *   claro  · rojo  #B03127 sobre #F1F0EA →  5.6 · ámbar #7F640A → 4.9
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
  --daw-clip-ai: #221E13;
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
  --daw-ai: #CDA42B;
  --daw-ai-soft: rgba(205,164,43,0.16);
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
  --daw-bg: #F1F0EA;
  --daw-surface: #F9F8F4;
  --daw-raised: #FFFEFA;
  --daw-sheet: #FAF9F5;
  --daw-fill: rgba(23,22,15,0.05);
  --daw-fill-strong: rgba(23,22,15,0.095);
  --daw-thumb: #FFFEFA;
  --daw-knob: #FFFEFA;
  --daw-knob-shadow: 0 0 0 0.5px rgba(23,22,15,0.16), 0 1px 2px rgba(60,52,30,0.14), 1px 3px 8px rgba(60,52,30,0.12);
  --daw-clip: #E9E6DC;
  --daw-clip-ai: #F0E7CF;
  --daw-border: rgba(23,22,15,0.11);
  --daw-border-strong: rgba(23,22,15,0.3);
  --daw-row-line: rgba(23,22,15,0.07);
  --daw-text: #17160F;
  --daw-dim: #57564F;
  --daw-faint: #6E6D66;
  --daw-inverse: #FAF9F5;
  --daw-rec: #B03127;
  --daw-rec-soft: rgba(176,49,39,0.1);
  --daw-rec-fill: #B03127;
  --daw-on-rec: #FFF7F3;
  --daw-ai: #7F640A;
  --daw-ai-soft: rgba(127,100,10,0.13);
  --daw-wave: rgba(23,22,15,0.5);
  --daw-wave-strong: rgba(23,22,15,0.85);
  --daw-grid: rgba(23,22,15,0.045);
  --daw-grid-bar: rgba(23,22,15,0.11);
  --daw-shadow: rgba(60,52,30,0.16);
  --daw-rim: rgba(255,255,252,0.85);
  --daw-elev-1: inset 0 1px 0 var(--daw-rim), 0 0 0 1px rgba(23,22,15,0.06), 0.5px 1px 1px rgba(60,52,30,0.07), 1px 2px 5px rgba(60,52,30,0.06);
  --daw-elev-2: inset 0 1px 0 var(--daw-rim), 0 0 0 1px rgba(23,22,15,0.07), 1px 3px 6px rgba(60,52,30,0.08), 4px 12px 28px rgba(60,52,30,0.12);
  --daw-elev-3: inset 0 1px 0 var(--daw-rim), 0 0 0 1px rgba(23,22,15,0.06), 0 -4px 16px rgba(60,52,30,0.08), 0 -16px 48px rgba(60,52,30,0.1);
  --daw-scrim: rgba(23,22,15,0.28);
  --daw-glass: rgba(255,254,250,0.76);
  --daw-focus: rgba(23,22,15,0.75);
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
