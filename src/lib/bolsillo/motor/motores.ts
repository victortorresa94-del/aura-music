/**
 * Quién hace la canción. Como `src/lib/ia/proveedores.ts` para el estudio:
 * para añadir un motor, un fichero que cumpla `MotorDeCanciones` y una línea
 * aquí. La app (crear, retoques, playlists) nunca elige modelo por su cuenta.
 *
 * - `falso` cuando se pide (`NEXT_PUBLIC_BOLSILLO_MOTOR=falso`), o sin Firebase
 *   en `next dev` o en una vista previa de Vercel (no hay cuenta con la que
 *   pagar). No gasta nada. En producción nunca por su cuenta: allí, sin
 *   Firebase, crear dice que entres con tu cuenta.
 * - aura Studio para todo lo demás: Lyria 3 Pro por defecto, Lyria 3 para el
 *   boceto de 30 s y MiniMax Music 3 cuando hay que cantar una letra literal.
 */

import { hayNube } from '@/lib/nube/config';
import { elegirMotor, motor as fichaDelMotor } from '../motores';
import type { MotorId, Receta } from '../tipos';
import { crearMotorAuraStudio } from './auraStudio';
import { crearMotorFalso } from './falso';
import type { MotorDeCanciones } from './tipos';

type Entorno = { motor?: string; entorno?: string; vercel?: string; nube: boolean };

function entornoActual(): Entorno {
  return {
    // Next solo mete en el código lo que se escribe entero.
    motor: process.env.NEXT_PUBLIC_BOLSILLO_MOTOR,
    entorno: process.env.NODE_ENV,
    // Vercel la pone sola en el build: 'production' | 'preview' | 'development'.
    vercel: process.env.NEXT_PUBLIC_VERCEL_ENV,
    nube: hayNube(),
  };
}

let forzado: boolean | null = null;

/** ¿Suena el motor falso? Sin gastar y sin cuenta. */
export function usaMotorFalso(e: Entorno = entornoActual()): boolean {
  if (forzado !== null) return forzado;
  if (e.motor?.trim() === 'falso') return true;
  return !e.nube && (e.entorno === 'development' || e.vercel?.trim() === 'preview');
}

/** El modelo de una canción entera para esta receta. */
export function motorPorDefecto(receta: Pick<Receta, 'letra'> = {}): MotorId {
  if (usaMotorFalso()) return 'falso';
  return elegirMotor({ tipo: 'cancion', conVoz: !!receta.letra?.trim(), letra: receta.letra });
}

/** El modelo del boceto de 30 s (Lyria 3, la mitad de precio que la Pro). */
export function motorDeBoceto(): MotorId {
  return usaMotorFalso() ? 'falso' : 'lyria3-base';
}

let falso: MotorDeCanciones | null = null;
let auraStudio: MotorDeCanciones | null = null;
let dePrueba: MotorDeCanciones | null = null;

/** Quién cumple un modelo concreto. */
export function motorPara(id: MotorId): MotorDeCanciones {
  if (dePrueba) return dePrueba;
  if (id === 'falso') return (falso ??= crearMotorFalso());
  return (auraStudio ??= crearMotorAuraStudio());
}

/** Solo para tests: un motor para todo, y forzar (o no) el falso. */
export function ponerMotorParaPruebas(motor: MotorDeCanciones | null, opciones: { falso?: boolean | null } = {}) {
  dePrueba = motor;
  forzado = opciones.falso ?? null;
}

/** El nombre del modelo para enseñarlo («Hecha con IA · Lyria 3 Pro»). Sale del catálogo (`../motores.ts`). */
export function nombreDelMotor(id: MotorId): string {
  return fichaDelMotor(id).nombre;
}
