/**
 * De notas a audio, con los mismos instrumentos que suenan al tocar, en un
 * OfflineAudioContext.
 *
 * El resultado se guarda como el audio de la pista (como cualquier toma) y
 * es lo que suena al reproducir y lo que va al WAV: el motor y la exportación
 * no tienen que saber que esta pista empezó siendo notas. Las notas se
 * quedan al lado, en `Track.notas`, y cuando cambian (cuadrar, humanizar,
 * otro sonido, otro tempo) el audio se rehace.
 */

import { cargarPaquete, muestrasListas } from './muestras';
import { getPaquete } from './packs';
import { getInstrumento, type DefInstrumento } from './registro';
import type { Golpe, InstrumentoId } from './tipos';
import { crearVoz } from './voz';

/** Lo que se deja sonar después del último golpe, según el instrumento. */
const COLA: Record<DefInstrumento['familia'], number> = { bateria: 1.6, teclas: 2.6, guitarra: 3.2, bajo: 1.6 };

export interface PistaRenderizada {
  samples: Float32Array;
  sampleRate: number;
  sonido: 'muestras' | 'sintesis';
}

/**
 * Los rasgueos se reconocen en las notas (tres o más en menos de 150 ms): al
 * empezar uno, la mano apaga lo que sonaba, igual que al tocar en directo.
 */
export function iniciosDeRasgueo(golpes: Golpe[], bpm: number): Set<number> {
  const ventana = (0.15 * bpm) / 60;
  const inicios = new Set<number>();
  let i = 0;
  while (i < golpes.length) {
    let j = i;
    while (j + 1 < golpes.length && golpes[j + 1].beat - golpes[i].beat <= ventana) j++;
    if (j - i + 1 >= 3) inicios.add(i);
    i = j + 1;
  }
  return inicios;
}

export async function renderizarNotas(o: {
  golpes: Golpe[];
  instrumento: InstrumentoId;
  bpm: number;
  sampleRate: number;
  /** Contexto con el que decodificar las muestras si aún no están (el de directo). */
  decodificador?: BaseAudioContext | null;
}): Promise<PistaRenderizada> {
  const def = getInstrumento(o.instrumento);
  const pulso = 60 / o.bpm;
  const fin = o.golpes.reduce((max, g) => Math.max(max, (g.beat + (def.pads ? 0 : g.dur)) * pulso), 0);
  const duracion = Math.max(0.5, fin + COLA[def.familia]);
  const offline = new OfflineAudioContext(1, Math.ceil(duracion * o.sampleRate), o.sampleRate);

  // Las muestras, si el instrumento las tiene y se pueden conseguir. Sin red
  // la primera vez, suena la síntesis: mejor una pista con otro sonido que
  // ninguna pista.
  let muestras = muestrasListas(def.paquete);
  if (!muestras && getPaquete(def.paquete) && def.paquete) {
    try {
      muestras = await cargarPaquete(def.paquete, o.decodificador ?? offline);
    } catch {
      muestras = null;
    }
  }

  const salida = offline.createGain();
  salida.gain.value = 0.85;
  salida.connect(offline.destination);
  const voz = crearVoz(def, offline, salida, muestras);
  await voz.lista;

  const ordenados = [...o.golpes].sort((a, b) => a.beat - b.beat);
  const rasgueos = def.familia === 'guitarra' ? iniciosDeRasgueo(ordenados, o.bpm) : new Set<number>();
  ordenados.forEach((golpe, i) => {
    const cuando = golpe.beat * pulso;
    if (rasgueos.has(i)) voz.ahogar(cuando);
    // Lo que se sostiene (teclas, cuerdas, bajo) se suelta a su hora; lo
    // pulsado o golpeado (guitarra, batería) suena entero, como al tocarlo.
    voz.tocar(golpe.nota, golpe.vel, cuando, def.sostiene ? golpe.dur * pulso : undefined);
  });

  const buffer = await offline.startRendering();
  voz.dispose();
  const samples = new Float32Array(buffer.getChannelData(0));
  // Si la suma de muchas notas pasa de 1, se baja entera: un recorte digital
  // en la pista se oiría en cada repetición.
  let pico = 0;
  for (let i = 0; i < samples.length; i++) pico = Math.max(pico, Math.abs(samples[i]));
  if (pico > 0.97) {
    const escala = 0.97 / pico;
    for (let i = 0; i < samples.length; i++) samples[i] *= escala;
  }
  return { samples, sampleRate: o.sampleRate, sonido: voz.conMuestras ? 'muestras' : 'sintesis' };
}
