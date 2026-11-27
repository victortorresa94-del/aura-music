'use client';

import { useBolsillo } from '../contexto';
import { Cabecera, Vacio } from '../kit';

/** Un paisaje largo con sus capas (tono, ruido, binaural). Lo monta el agente de Paisajes (ola 1). */
export function PantallaPaisaje({ cancionId }: { cancionId?: string }) {
  const { nav } = useBolsillo();
  return (
    <>
      <Cabecera titulo="Paisaje" onAtras={nav.atras} />
      <Vacio texto={cancionId ? 'Aquí se alarga esta canción.' : 'Aquí se hace un paisaje largo.'} />
    </>
  );
}
