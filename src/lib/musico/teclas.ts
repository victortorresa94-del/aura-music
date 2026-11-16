/**
 * El teclista.
 *
 * Igual que el bajista: recibe los acordes que ha oído y el pulso, y escribe
 * NOTAS. Lo que lo hace sonar a músico y no a máquina es el enlace de voces:
 * de un acorde al siguiente, cada dedo se mueve lo menos posible. Un La m que
 * pasa a Sol no salta la octava entera; baja la mano un tono y medio.
 */

import type { AcordeEnTiempo } from './acordes';
import type { CicloBajo, Nota } from './bajo';
import { aleatorio, claseDeNota, mismoAcorde, notasDelAcorde, type Acorde } from './teoria';

export type EstiloTeclas = 'colchon' | 'pulsos' | 'arpegio';

export const ESTILOS_TECLAS: { id: EstiloTeclas; nombre: string; descripcion: string }[] = [
  { id: 'colchon', nombre: 'Colchón', descripcion: 'El acorde entero y largo, por debajo de todo. Rellena sin pisar la voz.' },
  { id: 'pulsos', nombre: 'A golpes', descripcion: 'El acorde en cada pulso, corto. Empuja como un piano de pop.' },
  { id: 'arpegio', nombre: 'Arpegio', descripcion: 'Las notas del acorde de una en una, a corcheas.' },
];

export interface OpcionesTeclas {
  bpm: number;
  /** Segundo del primer pulso. */
  fase: number;
  duracion: number;
  estilo: EstiloTeclas;
  ciclo?: CicloBajo;
  semilla?: number;
  humano?: number;
}

/** La nota más grave de la mano derecha vive entre Sol3 y Sol4. */
const SUELO = 55;
const TECHO = 67;

/** Las tres posiciones del acorde (fundamental, primera y segunda inversión) en el registro. */
function posiciones(acorde: Acorde): number[][] {
  const [r, t, q] = notasDelAcorde(acorde).map(claseDeNota);
  const salida: number[][] = [];
  for (const orden of [
    [r, t, q],
    [t, q, r],
    [q, r, t],
  ]) {
    for (let base = SUELO; base <= TECHO; base++) {
      if (claseDeNota(base) !== orden[0]) continue;
      const voces = [base];
      for (const clase of orden.slice(1)) {
        let n = voces[voces.length - 1] + 1;
        while (claseDeNota(n) !== clase) n++;
        voces.push(n);
      }
      salida.push(voces);
    }
  }
  return salida;
}

/**
 * La posición del acorde más cercana a la anterior. Sin anterior, la que
 * queda más centrada (alrededor de Mi4), que es donde suena un piano de pop.
 */
export function enlazar(acorde: Acorde, previa: number[] | null): number[] {
  const candidatas = posiciones(acorde);
  const coste = (voces: number[]) =>
    previa
      ? voces.reduce((suma, n, i) => suma + Math.abs(n - previa[i]), 0)
      : Math.abs(voces.reduce((a, b) => a + b, 0) / voces.length - 64);
  return candidatas.reduce((mejor, c) => (coste(c) < coste(mejor) ? c : mejor));
}

function acordeEn(acordes: AcordeEnTiempo[], t: number): Acorde | null {
  for (const a of acordes) if (t >= a.inicio - 1e-6 && t < a.fin - 1e-6) return a.acorde;
  return null;
}

export function escribirTeclas(acordes: AcordeEnTiempo[], o: OpcionesTeclas): Nota[] {
  const { bpm, duracion, estilo } = o;
  if (bpm <= 0 || acordes.length === 0) return [];
  const T = 60 / bpm;
  const fase = ((o.fase % T) + T) % T;
  const ciclo = o.ciclo ?? { pulsos: 4, acentos: [1] };
  const acentos = new Set(ciclo.acentos.map((a) => (a - 1 + ciclo.pulsos) % ciclo.pulsos));
  const conAcentos = acentos.size >= 2;
  const azar = aleatorio(o.semilla ?? 11);
  const humano = o.humano ?? 0.5;

  const pulsos: number[] = [];
  for (let t = fase; t < duracion - 0.02; t += T) pulsos.push(t);

  const notas: Nota[] = [];
  let voces: number[] | null = null;
  const tocar = (inicio: number, largo: number, midi: number, velocidad: number) => {
    if (inicio >= duracion) return;
    const fin = Math.min(duracion, inicio + largo);
    notas.push({ inicio, duracion: Math.max(0.03, fin - inicio), midi, velocidad });
  };
  const acorde = (k: number) => acordeEn(acordes, pulsos[k] + 0.01);

  pulsos.forEach((t, k) => {
    const actual = acorde(k);
    if (!actual) return;
    const anterior = k > 0 ? acorde(k - 1) : null;
    const cambia = !mismoAcorde(anterior, actual);
    if (cambia || !voces) voces = enlazar(actual, voces);
    const pos = k % ciclo.pulsos;
    const fuerte = pos === 0 || acentos.has(pos);

    switch (estilo) {
      case 'colchon': {
        if (!cambia) return;
        let fin = t + T;
        for (let j = k + 1; j < pulsos.length && mismoAcorde(acorde(j), actual); j++) fin = pulsos[j] + T;
        for (const midi of voces) tocar(t, fin - t - 0.03, midi, 0.6);
        return;
      }
      case 'pulsos': {
        // En un ciclo con acentos (el doce flamenco) solo se golpea en ellos.
        if (conAcentos && !acentos.has(pos) && !cambia) return;
        for (const midi of voces) tocar(t, T * 0.42, midi, fuerte ? 0.78 : 0.6);
        return;
      }
      case 'arpegio': {
        const arriba = [...voces, voces[0] + 12];
        const orden = [0, 1, 2, 3];
        for (let medio = 0; medio < 2; medio++) {
          const i = orden[(pos * 2 + medio) % orden.length];
          tocar(t + (medio * T) / 2, T * 0.95, arriba[i], medio === 0 && fuerte ? 0.72 : 0.58);
        }
        return;
      }
    }
  });

  for (const nota of notas) {
    nota.inicio = Math.max(0, nota.inicio + (azar() - 0.5) * 0.01 * humano);
    nota.velocidad = Math.max(0.25, Math.min(1, nota.velocidad + (azar() - 0.5) * 0.1 * humano));
  }
  return notas;
}
