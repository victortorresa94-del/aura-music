'use client';

/**
 * Tu cuenta de aura dentro de bolsillo. CONTRATO: lo implementa el agente de
 * Cuenta e importar (ola 1).
 *
 * Crear gasta créditos del monedero de aura, así que pide cuenta; escuchar lo
 * que ya está en el móvil, no.
 */
export interface UsuarioBolsillo {
  uid: string;
  nombre: string | null;
  correo: string | null;
  foto: string | null;
}

export interface CuentaBolsillo {
  /** Hay Firebase configurado. Sin él no se puede crear (no hay con qué pagar). */
  hayNube: boolean;
  cargando: boolean;
  usuario: UsuarioBolsillo | null;
  /** Créditos que quedan en el monedero de aura; null si no se sabe o no paga (admin). */
  saldo: number | null;
  /** La cuenta no paga (dueños de aura): crear no descuenta. */
  sinCobro: boolean;
  error: string | null;
  entrarConGoogle(): Promise<void>;
  salir(): Promise<void>;
  refrescarSaldo(): Promise<void>;
  /** Trae tus canciones de Music Studio de aura Studio a la biblioteca. */
  importarDeAuraStudio(): Promise<{ nuevas: number }>;
  importando: boolean;
}

export function useCuentaBolsillo(): CuentaBolsillo {
  return {
    hayNube: false,
    cargando: false,
    usuario: null,
    saldo: null,
    sinCobro: false,
    error: null,
    async entrarConGoogle() {},
    async salir() {},
    async refrescarSaldo() {},
    async importarDeAuraStudio() {
      return { nuevas: 0 };
    },
    importando: false,
  };
}
