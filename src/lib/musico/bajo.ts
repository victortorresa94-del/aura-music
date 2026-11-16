/**
 * El bajista.
 *
 * Recibe la progresión que ha oído y el pulso, y escribe la línea nota a
 * nota, como lo haría un músico de sesión al que le pasas la toma: no se
 * inventa la armonía, la sigue. Escribe NOTAS, no audio. Así cuadra al
 * milisegundo con tu pulso, se puede cambiar de estilo sin volver a pedir
 * nada a nadie y funciona sin cobertura.
 */

import type { AcordeEnTiempo } from './acordes';
import { aleatorio, claseDeNota, mismoAcorde, notasDelAcorde, raizEnElBajo, type Acorde } from './teoria';

export type EstiloBajo = 'raiz' | 'negras' | 'raiz-quinta' | 'caminante' | 'compas';

export interface InfoEstilo {
  id: EstiloBajo;
  nombre: string;
  descripcion: string;
}

export const ESTILOS: InfoEstilo[] = [
  { id: 'raiz-quinta', nombre: 'Raíz y quinta', descripcion: 'El pop y el country de toda la vida. Firme, nunca estorba.' },
  { id: 'negras', nombre: 'A negras', descripcion: 'Un golpe por pulso sobre la raíz. Empuja sin adornos.' },
  { id: 'raiz', nombre: 'Raíz larga', descripcion: 'Una nota por acorde, que suena hasta el siguiente. Para baladas.' },
  { id: 'caminante', nombre: 'Caminante', descripcion: 'Pasa por las notas del acorde y llega al siguiente por semitono.' },
  { id: 'compas', nombre: 'Al compás', descripcion: 'Golpea en los acentos del ciclo. En doce, en el 12, 3, 6, 8 y 10.' },
];

export interface Nota {
  /** Segundos desde el principio del audio analizado. */
  inicio: number;
  duracion: number;
  /** Altura MIDI. */
  midi: number;
  /** 0..1 */
  velocidad: number;
}

export interface CicloBajo {
  /** Pulsos del ciclo. 4 en un 4/4, 12 en una bulería. */
  pulsos: number;
  /** Pulsos acentuados, contando desde 1. */
  acentos: number[];
}

export interface OpcionesBajo {
  bpm: number;
  /** Segundo del primer pulso. */
  fase: number;
  /** Duración del audio que acompaña. Nada suena después. */
  duracion: number;
  estilo: EstiloBajo;
  ciclo?: CicloBajo;
  semilla?: number;
  /** 0 = máquina, 1 = un músico con un día normal. */
  humano?: number;
}

const GRAVE = 28; // Mi1
const AGUDO = 50; // Re3

/** La nota de esa clase más cercana a la anterior, dentro del mástil. */
function cerca(clase: number, previa: number): number {
  let mejor = GRAVE + ((claseDeNota(clase) - GRAVE % 12 + 12) % 12);
  for (let midi = mejor; midi <= AGUDO; midi += 12) {
    if (Math.abs(midi - previa) < Math.abs(mejor - previa)) mejor = midi;
  }
  return mejor;
}

/** La quinta, por arriba si cabe y si no por abajo. */
function quinta(raiz: number): number {
  return raiz + 7 <= 43 ? raiz + 7 : raiz - 5;
}

function acordeEn(acordes: AcordeEnTiempo[], t: number): Acorde | null {
  for (const a of acordes) if (t >= a.inicio - 1e-6 && t < a.fin - 1e-6) return a.acorde;
  return null;
}

export function escribirBajo(acordes: AcordeEnTiempo[], o: OpcionesBajo): Nota[] {
  const { bpm, duracion, estilo } = o;
  if (bpm <= 0 || acordes.length === 0) return [];
  const T = 60 / bpm;
  const fase = ((o.fase % T) + T) % T;
  const ciclo = o.ciclo ?? { pulsos: 4, acentos: [1] };
  const acentos = new Set(ciclo.acentos.map((a) => (a - 1 + ciclo.pulsos) % ciclo.pulsos));
  const azar = aleatorio(o.semilla ?? 7);
  const humano = o.humano ?? 0.5;

  const pulsos: number[] = [];
  for (let t = fase; t < duracion - 0.02; t += T) pulsos.push(t);

  const notas: Nota[] = [];
  let previa = 33; // La1: un sitio cómodo para empezar
  const tocar = (inicio: number, largo: number, midi: number, velocidad: number) => {
    if (inicio >= duracion) return;
    const fin = Math.min(duracion, inicio + largo);
    notas.push({ inicio, duracion: Math.max(0.03, fin - inicio), midi, velocidad });
    previa = midi;
  };

  pulsos.forEach((t, k) => {
    const acorde = acordeEn(acordes, t + 0.01);
    if (!acorde) return;
    const pos = k % ciclo.pulsos;
    const anterior = k > 0 ? acordeEn(acordes, pulsos[k - 1] + 0.01) : null;
    const cambia = !mismoAcorde(anterior, acorde);
    const siguiente = k + 1 < pulsos.length ? acordeEn(acordes, pulsos[k + 1] + 0.01) : acorde;
    const raiz = estilo === 'caminante' ? cerca(acorde.raiz, previa) : raizEnElBajo(acorde.raiz);
    const fuerte = pos === 0 || acentos.has(pos);

    switch (estilo) {
      case 'raiz': {
        if (!cambia && pos !== 0) return;
        // Suena hasta el próximo cambio o el próximo compás, lo que llegue antes.
        let fin = t + T;
        for (let j = k + 1; j < pulsos.length; j++) {
          if (j % ciclo.pulsos === 0 || !mismoAcorde(acordeEn(acordes, pulsos[j] + 0.01), acorde)) break;
          fin = pulsos[j] + T;
        }
        tocar(t, fin - t - 0.04, raiz, 0.9);
        return;
      }
      case 'negras':
        tocar(t, T * 0.86, raiz, fuerte ? 0.95 : 0.72);
        return;
      case 'raiz-quinta': {
        const nota = cambia || pos % 2 === 0 ? raiz : quinta(raiz);
        tocar(t, T * 0.9, nota, fuerte ? 0.95 : 0.78);
        return;
      }
      case 'caminante': {
        if (cambia || pos === 0) {
          tocar(t, T * 0.92, raiz, 0.92);
          return;
        }
        if (siguiente && !mismoAcorde(siguiente, acorde)) {
          // Aproximación cromática: medio tono por debajo de lo que viene.
          const destino = cerca(siguiente.raiz, previa);
          tocar(t, T * 0.92, destino - 1 >= GRAVE ? destino - 1 : destino + 1, 0.74);
          return;
        }
        const [, tercera, q] = notasDelAcorde(acorde);
        tocar(t, T * 0.92, cerca(pos % 2 === 1 ? tercera : q, previa), 0.76);
        return;
      }
      case 'compas': {
        const ciclosConAcentos = acentos.size >= 2;
        if (ciclosConAcentos) {
          if (!acentos.has(pos) && !cambia) return;
          // Dura hasta el siguiente acento, sin pasar de dos pulsos.
          let siguienteGolpe = t + T;
          for (let j = k + 1; j < pulsos.length && j <= k + 2; j++) {
            siguienteGolpe = pulsos[j];
            if (acentos.has(j % ciclo.pulsos)) break;
          }
          tocar(t, Math.min(2 * T, siguienteGolpe - t) * 0.9, raiz, acentos.has(pos) ? 0.96 : 0.7);
          return;
        }
        // Ciclos sin acentos marcados (4/4, 3/4): uno, el «y» del dos, tres.
        if (pos === 0) tocar(t, T * 1.4, raiz, 0.95);
        if (pos === 1) tocar(t + T / 2, T * 0.45, raiz, 0.7);
        if (pos === 2 && ciclo.pulsos >= 4) tocar(t, T * 0.9, quinta(raiz), 0.82);
        return;
      }
    }
  });

  // Humanizar: un músico no cae en el milisegundo, ni golpea siempre igual.
  for (const nota of notas) {
    nota.inicio = Math.max(0, nota.inicio + (azar() - 0.5) * 0.012 * humano);
    nota.velocidad = Math.max(0.3, Math.min(1, nota.velocidad + (azar() - 0.5) * 0.12 * humano));
  }
  return notas;
}
