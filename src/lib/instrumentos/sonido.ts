/**
 * El panel «Sonido» de «Tocar»: volumen, reverb y brillo de cada instrumento.
 *
 * No es un efecto aparte: son tres cosas que el mezclador ya sabe hacer con
 * una pista (su volumen, su envío a la reverb compartida y sus agudos en
 * estantería a 6 kHz). En directo, el atril monta esa misma cadena para que
 * suene igual mientras tocas; al grabar, la pista nueva sale con esos
 * valores puestos en su mezcla. Lo que oyes al tocar es lo que queda, y se
 * puede retocar después en el mezclador como cualquier otra pista.
 *
 * Se recuerda por instrumento en este navegador.
 */

import { LIMITES, MEZCLA_NEUTRA, type MezclaPista } from '@/lib/daw/mezcla/tipos';
import type { InstrumentoId } from './tipos';

export interface AjustesSonido {
  /** Ganancia lineal, como el volumen de una pista (0,9 es lo de siempre). */
  volumen: number;
  /** Envío a la reverb compartida, de 0 a 1. */
  reverb: number;
  /** Agudos en dB (la banda de 6 kHz del mezclador), de −12 a +12. */
  brillo: number;
}

/** Lo de antes de que hubiera panel: así una pista nueva suena igual que siempre. */
export const SONIDO_POR_DEFECTO: AjustesSonido = { volumen: 0.9, reverb: 0, brillo: 0 };

/** Tope de volumen: unos +3 dB sobre lo normal, para un instrumento flojo. */
export const VOLUMEN_MAXIMO = 1.25;

const clave = (id: InstrumentoId) => `aura-music:sonido:${id}`;

const recortar = (x: unknown, min: number, max: number, defecto: number) =>
  typeof x === 'number' && Number.isFinite(x) ? Math.max(min, Math.min(max, x)) : defecto;

/** Normaliza lo guardado (puede venir de otra versión o a medias). */
export function sonidoDe(crudo: Partial<AjustesSonido> | null | undefined): AjustesSonido {
  const c = crudo ?? {};
  return {
    volumen: recortar(c.volumen, 0, VOLUMEN_MAXIMO, SONIDO_POR_DEFECTO.volumen),
    reverb: recortar(c.reverb, 0, 1, SONIDO_POR_DEFECTO.reverb),
    brillo: recortar(c.brillo, -LIMITES.ecualizador, LIMITES.ecualizador, SONIDO_POR_DEFECTO.brillo),
  };
}

export function leerSonido(id: InstrumentoId): AjustesSonido {
  try {
    const crudo = typeof window !== 'undefined' ? window.localStorage.getItem(clave(id)) : null;
    return sonidoDe(crudo ? (JSON.parse(crudo) as Partial<AjustesSonido>) : null);
  } catch {
    return { ...SONIDO_POR_DEFECTO };
  }
}

export function guardarSonido(id: InstrumentoId, ajustes: AjustesSonido) {
  try {
    window.localStorage.setItem(clave(id), JSON.stringify(sonidoDe(ajustes)));
  } catch {
    /* sin almacenamiento: vale para esta sesión */
  }
}

/**
 * La mezcla con la que sale una pista grabada con estos ajustes. Si no se ha
 * tocado nada, ninguna: la pista queda neutra, como antes.
 */
export function mezclaDeSonido(ajustes: AjustesSonido): MezclaPista | null {
  const a = sonidoDe(ajustes);
  if (a.reverb === 0 && a.brillo === 0) return null;
  return { ...MEZCLA_NEUTRA, reverb: a.reverb, agudos: a.brillo };
}
