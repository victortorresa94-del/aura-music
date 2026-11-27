/**
 * Renderizar un paisaje: el trozo generado (o nada) más las capas que hace el
 * móvil (tono, binaural, ruido, pulso), como UN fichero que se repite sin
 * costuras. CONTRATO: lo implementa el agente de Paisajes (ola 1).
 *
 * Por qué un fichero y no Web Audio en vivo: en el iPhone el AudioContext se
 * calla al bloquear la pantalla y un <audio> sigue sonando (plan, parte 3.6).
 */

import type { CapasPaisaje } from '../tipos';

export interface OpcionesRender {
  /** Lo que dura una vuelta del bucle. Por defecto, lo que dura la base (o 60 s sin base). */
  segundosBucle?: number;
  /** Volumen bajo y sin picos para dormir o dolor de cabeza. */
  cuidado?: boolean;
  alAvanzar?: (progreso: number) => void;
}

export async function renderizarPaisaje(
  _base: Blob | null,
  _capas: CapasPaisaje,
  _opciones: OpcionesRender = {},
): Promise<Blob> {
  throw new Error('Los paisajes todavía no están montados.');
}
