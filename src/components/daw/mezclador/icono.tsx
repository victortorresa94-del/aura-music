'use client';

import { T } from '../theme';

/**
 * Tres faders a distintas alturas: el dibujo de una mesa de mezclas, que es
 * lo que reconoce cualquiera que haya pisado un local de ensayo. Mismo
 * trazo que el resto de iconos (1,75 sobre 24).
 */
export function IconoMezclador({ size = 20, color = T.text }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden focusable={false}>
      <path d="M6 4v16M12 4v16M18 4v16" stroke={color} strokeWidth={1.75} strokeLinecap="round" />
      <rect x="3.6" y="12.2" width="4.8" height="3.6" rx="1.2" fill={T.surface} stroke={color} strokeWidth={1.75} />
      <rect x="9.6" y="6.2" width="4.8" height="3.6" rx="1.2" fill={T.surface} stroke={color} strokeWidth={1.75} />
      <rect x="15.6" y="14.2" width="4.8" height="3.6" rx="1.2" fill={T.surface} stroke={color} strokeWidth={1.75} />
    </svg>
  );
}
