'use client';

import { useBolsillo } from '../contexto';
import { Cabecera, Vacio } from '../kit';

/** Una canción con sus versiones y retoques. La monta el agente de Crear (ola 1). */
export function PantallaCancion({ id }: { id: string }) {
  const { biblioteca, nav } = useBolsillo();
  const cancion = biblioteca.cancion(id);
  return (
    <>
      <Cabecera titulo={cancion?.titulo ?? 'Canción'} onAtras={nav.atras} />
      <Vacio texto="Aquí saldrán sus versiones y los retoques." />
    </>
  );
}
