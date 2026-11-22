/**
 * El puente entre el estudio y la nube para una sola cosa: al abrir una idea,
 * bajar el audio que no esté en este dispositivo antes de cargarlo en el
 * motor de audio. Sin cuenta no hay motor activo y no hace nada.
 *
 * Es un módulo y no una prop porque `useStudio` no debe saber nada de la
 * cuenta: le basta con preguntar aquí (un enganche de dos líneas).
 */

import type { Project } from '@/lib/daw/types';
import type { MotorNube } from './motor';

let activo: MotorNube | null = null;

export function ponerMotorActivo(motor: MotorNube | null): void {
  activo = motor;
}

/**
 * Baja lo que falte. `alEmpezar` se llama solo si hay algo que bajar (para
 * enseñar «Bajando el audio…»). Devuelve si había algo que bajar.
 */
export async function asegurarAudioDeLaNube(proyecto: Project, alEmpezar?: () => void): Promise<boolean> {
  if (!activo) return false;
  try {
    return (await activo.asegurarAudio(proyecto, alEmpezar)) > 0;
  } catch {
    return false;
  }
}
