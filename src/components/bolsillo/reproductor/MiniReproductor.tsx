'use client';

import { useBolsillo } from '../contexto';

/** El mini reproductor, fijo encima de la barra. Lo monta el agente de Escuchar (ola 1). */
export function MiniReproductor({ onAbrir }: { onAbrir: () => void }) {
  const { reproductor } = useBolsillo();
  if (!reproductor.actual) return null;
  return (
    <button type="button" onClick={onAbrir} style={{ appearance: 'none', border: 'none', background: 'none', padding: 8 }}>
      {reproductor.actual.cancion.titulo}
    </button>
  );
}
