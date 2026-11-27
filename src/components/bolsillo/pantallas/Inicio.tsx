'use client';

import { useBolsillo } from '../contexto';
import { Cabecera, Vacio, BotonPrincipal } from '../kit';

/** Inicio. Lo monta el agente de Escuchar (ola 1): secciones por hora del día, «Seguir escuchando». */
export function PantallaInicio() {
  const { nav } = useBolsillo();
  return (
    <>
      <Cabecera titulo="Inicio" />
      <Vacio
        texto="Aquí saldrá tu música: lo último que escuchaste y lo que pega con esta hora del día."
        accion={<BotonPrincipal full={false} onClick={() => nav.pestana('crear')}>Haz tu primera canción</BotonPrincipal>}
      />
    </>
  );
}
