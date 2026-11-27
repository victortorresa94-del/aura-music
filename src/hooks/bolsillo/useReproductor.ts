'use client';

import type { Biblioteca } from './useBiblioteca';
import type { Pista } from '@/lib/bolsillo/tipos';

/**
 * El reproductor de bolsillo. CONTRATO: lo implementa el agente de Escuchar
 * (ola 1). Hasta entonces es un reproductor que no suena.
 *
 * Reglas que tiene que cumplir quien lo implemente (plan, parte 3.1 y 3.6):
 * - Suena con un <audio>, no con Web Audio: en el iPhone el AudioContext se
 *   calla con la pantalla bloqueada.
 * - Media Session: título, portada y controles en la pantalla de bloqueo.
 * - Una versión con `bucle` suena en bucle hasta `receta.duracionSeg` o hasta
 *   el temporizador, con fundido de salida.
 * - `modoCuidado`: volumen bajo y sin picos; la pantalla grande se oscurece.
 */
export interface Reproductor {
  actual: Pista | null;
  /** Ids de canción en orden. */
  cola: string[];
  sonando: boolean;
  cargando: boolean;
  /** Segundos. En un paisaje, lo que lleva sonando en total, no la vuelta del bucle. */
  posicion: number;
  duracion: number;
  /** Cuándo se apaga solo (ms de época), o null. */
  apagaEn: number | null;
  modoCuidado: boolean;
  error: string | null;
  tocar(cancionId: string, opciones?: { versionId?: string; cola?: string[] }): Promise<void>;
  alternar(): void;
  pausar(): void;
  siguiente(): void;
  anterior(): void;
  buscar(segundos: number): void;
  ponerTemporizador(minutos: number | null): void;
  ponerModoCuidado(activo: boolean): void;
}

export function useReproductor(_biblioteca: Biblioteca): Reproductor {
  return {
    actual: null,
    cola: [],
    sonando: false,
    cargando: false,
    posicion: 0,
    duracion: 0,
    apagaEn: null,
    modoCuidado: false,
    error: null,
    async tocar() {},
    alternar() {},
    pausar() {},
    siguiente() {},
    anterior() {},
    buscar() {},
    ponerTemporizador() {},
    ponerModoCuidado() {},
  };
}
