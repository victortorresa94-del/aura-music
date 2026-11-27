'use client';

import { useBolsillo } from '../contexto';
import { Cabecera, Vacio } from '../kit';

/** Tu cuenta de aura, el saldo e importar de aura Studio. La monta el agente de Cuenta (ola 1). */
export function PantallaCuenta() {
  const { nav } = useBolsillo();
  return (
    <>
      <Cabecera titulo="Tu cuenta" onAtras={nav.atras} />
      <Vacio texto="Pronto." />
    </>
  );
}
