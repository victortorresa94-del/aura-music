/**
 * Del paquete de muestras al preset de smplr.
 *
 * - Instrumentos melódicos: cada muestra cubre hasta medio camino de sus
 *   vecinas (se transporta un poco), con sus capas de fuerza.
 * - Percusión: cada muestra suena solo en su nota, sin transportar; los golpes
 *   alternos de una misma capa se turnan (round robin), para que un redoble
 *   no suene a ametralladora; y el charles cerrado o de pedal apaga el
 *   abierto, como el pie en el pedal.
 *
 * Puro y sin audio: se prueba con tests.
 */

import type { SmplrGroup, SmplrPreset, SmplrRegion } from 'smplr';
import type { ArchivoMuestra, Paquete } from './packs';

/** El nombre de la muestra en el preset: el fichero sin extensión. */
export function nombreDeMuestra(nombre: string): string {
  return nombre.replace(/\.[a-z0-9]+$/i, '');
}

/** Notas General MIDI del charles: cerrado y pedal apagan el abierto. */
const CHARLES_ABIERTO = 46;
const CHARLES_QUE_CIERRAN = new Set([42, 44]);
const GRUPO_CHARLES = 1;

/** El tramo de fuerza de una muestra, en cualquiera de los dos formatos. */
export function tramoDeFuerza(archivo: ArchivoMuestra): [number, number] {
  if (archivo.vel) return [Math.max(1, archivo.vel[0]), Math.min(127, archivo.vel[1])];
  if (archivo.capa === 'p') return [1, 84];
  if (archivo.capa === 'f') return [85, 127];
  return [1, 127];
}

function presetDePercusion(paquete: Paquete): SmplrGroup[] {
  // Un grupo por nota y capa; dentro, las alternas se turnan.
  const grupos = new Map<string, ArchivoMuestra[]>();
  for (const archivo of paquete.archivos) {
    const [lo, hi] = tramoDeFuerza(archivo);
    const clave = `${archivo.midi}:${lo}:${hi}`;
    grupos.set(clave, [...(grupos.get(clave) ?? []), archivo]);
  }
  return [...grupos.values()].map((archivos) => {
    const { midi } = archivos[0];
    const velRange = tramoDeFuerza(archivos[0]);
    const alternas = [...archivos].sort((a, b) => (a.rr ?? 1) - (b.rr ?? 1));
    const regiones: SmplrRegion[] = alternas.map((archivo, i) => ({
      sample: nombreDeMuestra(archivo.nombre),
      pitch: midi,
      keyRange: [midi, midi],
      velRange,
      ...(alternas.length > 1 ? { seqPosition: i + 1 } : {}),
      ...(midi === CHARLES_ABIERTO ? { group: GRUPO_CHARLES } : {}),
      ...(CHARLES_QUE_CIERRAN.has(midi) ? { offBy: GRUPO_CHARLES } : {}),
    }));
    return {
      keyRange: [midi, midi] as [number, number],
      velRange,
      ...(alternas.length > 1 ? { seqLength: alternas.length } : {}),
      regions: regiones,
    };
  });
}

function presetMelodico(paquete: Paquete): SmplrGroup[] {
  const raices = [...new Set(paquete.archivos.map((a) => a.midi))].sort((a, b) => a - b);
  const rango = (midi: number): [number, number] => {
    const i = raices.indexOf(midi);
    const lo = i === 0 ? 0 : Math.floor((raices[i - 1] + midi) / 2) + 1;
    const hi = i === raices.length - 1 ? 127 : Math.floor((midi + raices[i + 1]) / 2);
    return [lo, hi];
  };
  const bucle = paquete.bucle;
  return [
    {
      regions: paquete.archivos.map((archivo) => ({
        sample: nombreDeMuestra(archivo.nombre),
        pitch: archivo.midi,
        keyRange: rango(archivo.midi),
        velRange: tramoDeFuerza(archivo),
        ...(bucle ? { loop: true, loopAuto: { startRatio: bucle.inicio, endRatio: bucle.fin } } : {}),
      })),
    },
  ];
}

export function presetDe(paquete: Paquete): SmplrPreset {
  return {
    meta: { name: paquete.nombre, license: paquete.licencia, source: paquete.origen },
    samples: { baseUrl: `/samples/${paquete.id}`, formats: ['mp3'] },
    defaults: { ampAttack: paquete.sonido.ataque, ampRelease: paquete.sonido.suelta },
    groups: paquete.percusion ? presetDePercusion(paquete) : presetMelodico(paquete),
  };
}

/** Las notas que tienen muestra en un paquete de percusión. */
export function notasConMuestra(paquete: Paquete): Set<number> {
  return new Set(paquete.archivos.map((a) => a.midi));
}
