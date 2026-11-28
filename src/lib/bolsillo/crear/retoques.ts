/**
 * Retocar una canción hasta que te guste: cada retoque es una receta nueva,
 * una frase de qué cambia y su precio. Puro.
 *
 * «Prueba con otro motor» es un retoque más: la misma receta con otro de los
 * motores que pueden hacerla (`motores.ts`). Así una canción puede tener
 * versiones de Lyria, de Stable Audio o de MiniMax para compararlas.
 */

import { alternativas, motor } from '../motores';
import { creditosDeReceta } from '../precios';
import type { MotorId, Receta } from '../tipos';

export interface Retoque {
  id: string;
  etiqueta: string;
  /** La frase que queda en la versión: qué cambió. */
  cambio: string;
  receta: Receta;
  creditos: number;
}

const acotar = (x: number) => Math.max(0, Math.min(1, x));

export function retoquesDe(receta: Receta, opciones: { falso?: boolean } = {}): Retoque[] {
  const lista: Omit<Retoque, 'creditos'>[] = [];
  const bpm = receta.bpm;
  const energia = receta.energia ?? 0.5;
  lista.push({
    id: 'lenta',
    etiqueta: 'Más lenta',
    cambio: 'Más lenta',
    receta: { ...receta, ...(bpm ? { bpm: Math.max(50, Math.round(bpm * 0.82)) } : {}), energia: acotar(energia - 0.2) },
  });
  lista.push({ id: 'tranquila', etiqueta: 'Más tranquila', cambio: 'Más tranquila', receta: { ...receta, energia: acotar(energia - 0.25) } });
  lista.push({
    id: 'ritmo',
    etiqueta: 'Con más ritmo',
    cambio: 'Con más ritmo',
    receta: { ...receta, ...(bpm ? { bpm: Math.min(180, Math.round(bpm * 1.15)) } : {}), energia: acotar(energia + 0.25) },
  });
  if (receta.tipo === 'cancion') {
    lista.push(
      receta.conVoz
        ? { id: 'sin-voz', etiqueta: 'Sin voz', cambio: 'Sin voz', receta: { ...receta, conVoz: false, letra: undefined } }
        : { id: 'con-voz', etiqueta: 'Con voz', cambio: 'Con voz', receta: { ...receta, conVoz: true, idioma: receta.idioma ?? 'es' } },
    );
  }
  lista.push({ id: 'otra', etiqueta: 'Otra parecida', cambio: 'Otra parecida', receta });
  const conMotor = (m: MotorId) => ({ ...receta, motor: m });
  for (const m of alternativas(receta).slice(0, 3)) {
    lista.push({ id: `motor-${m.id}`, etiqueta: `Con ${m.nombre}`, cambio: `Hecha con ${m.nombre}`, receta: conMotor(m.id) });
  }
  return lista
    .map((r) => (opciones.falso ? { ...r, receta: { ...r.receta, motor: 'falso' as const } } : r))
    .map((r) => ({ ...r, creditos: creditosDeReceta(r.receta) }));
}

/** El nombre del motor de una versión, para enseñarlo. */
export function nombreDeMotor(id: MotorId): string {
  return motor(id).nombre;
}
