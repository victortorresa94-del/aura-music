'use client';

import type { Biblioteca } from './useBiblioteca';
import type { Receta, TipoPieza } from '@/lib/bolsillo/tipos';

/**
 * El chat de crear. CONTRATO: lo implementa el agente de Crear (ola 1).
 *
 * Reglas (plan, parte 3.2): no es una caja en blanco; pregunta como mucho
 * tres cosas, cada una con chips; enseña la receta en una frase y el precio
 * antes de gastar; el botón lleva el precio y es el sí.
 */
export interface Opcion {
  valor: string;
  etiqueta: string;
}

export interface Pregunta {
  id: 'momento' | 'voz' | 'duracion' | 'parecido' | 'capas' | 'letra';
  texto: string;
  opciones: Opcion[];
  /** Se puede contestar también escribiendo. */
  libre?: boolean;
}

export interface MensajeCrear {
  id: string;
  de: 'aura' | 'tu';
  texto: string;
}

export type EstadoCrear = 'preguntando' | 'pensando' | 'lista' | 'generando' | 'hecho' | 'error';

export interface Crear {
  mensajes: MensajeCrear[];
  pregunta: Pregunta | null;
  /** La receta cuando ya no queda nada que preguntar. */
  receta: Receta | null;
  /** La receta en una frase, para enseñarla antes de gastar. */
  resumen: string | null;
  creditos: number;
  creditosBoceto: number;
  estado: EstadoCrear;
  error: string | null;
  /** La canción que ha salido, para abrirla. */
  cancionId: string | null;
  empezar(desde?: { artistaId?: string; tipo?: TipoPieza; frase?: string }): void;
  escribir(texto: string): Promise<void>;
  responder(valor: string): void;
  generar(opciones?: { boceto?: boolean }): Promise<void>;
}

export function useCrear(_biblioteca: Biblioteca): Crear {
  return {
    mensajes: [],
    pregunta: null,
    receta: null,
    resumen: null,
    creditos: 0,
    creditosBoceto: 0,
    estado: 'preguntando',
    error: null,
    cancionId: null,
    empezar() {},
    async escribir() {},
    responder() {},
    async generar() {},
  };
}
