'use client';

import { createContext, useContext } from 'react';
import type { Biblioteca } from '@/hooks/bolsillo/useBiblioteca';
import type { CuentaBolsillo } from '@/hooks/bolsillo/useCuentaBolsillo';
import type { Reproductor } from '@/hooks/bolsillo/useReproductor';
import type { Navegacion } from '@/lib/bolsillo/tipos';

/**
 * Lo que comparte toda la app de bolsillo: UNA biblioteca, UN reproductor y
 * UNA cuenta (montados una vez en BolsilloApp) y la navegación. Las pantallas
 * lo leen con `useBolsillo()`; no montan los suyos.
 */
export interface Bolsillo {
  biblioteca: Biblioteca;
  reproductor: Reproductor;
  cuenta: CuentaBolsillo;
  nav: Navegacion;
}

export const ContextoBolsillo = createContext<Bolsillo | null>(null);

export function useBolsillo(): Bolsillo {
  const valor = useContext(ContextoBolsillo);
  if (!valor) throw new Error('useBolsillo fuera de BolsilloApp.');
  return valor;
}
