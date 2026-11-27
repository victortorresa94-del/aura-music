'use client';

import { Cabecera, Vacio } from '../kit';

/** Crear: el chat que pregunta. Lo monta el agente de Crear (ola 1). */
export function PantallaCrear() {
  return (
    <>
      <Cabecera titulo="Crear" />
      <Vacio texto="¿Para qué momento quieres tu canción?" />
    </>
  );
}
