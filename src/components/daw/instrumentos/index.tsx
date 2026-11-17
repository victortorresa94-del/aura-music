'use client';

/**
 * Pilar B · instrumentos. Lo que usan los ficheros comunes del estudio
 * (StudioApp, Timeline, TrackPanel, SettingsSheet), en un solo sitio.
 */

export { AjustesDeNotas } from './AjustesDeNotas';
export { CreditosDeSonidos } from './Creditos';
export { NotasClip } from './NotasClip';
export { TocarPantalla } from './TocarPantalla';

/** Un teclado con dos negras: «tocar». Mismo trazo que el resto de iconos (1,75). */
export const IconTocar = ({ size = 18, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden focusable={false}>
    <rect x="3" y="5" width="18" height="14" rx="2.5" stroke={color} strokeWidth={1.75} />
    <path d="M9 19v-5M15 19v-5" stroke={color} strokeWidth={1.75} strokeLinecap="round" />
    <rect x="7.6" y="5" width="2.8" height="8" rx="0.8" fill={color} />
    <rect x="13.6" y="5" width="2.8" height="8" rx="0.8" fill={color} />
  </svg>
);
