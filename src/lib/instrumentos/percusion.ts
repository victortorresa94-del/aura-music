/**
 * La percusión de verdad para lo que no se toca con el dedo: los ritmos de la
 * hoja «Ritmos», los sonidos y los ritmos de fondo de la claqueta, los ritmos
 * que se convierten en pista (estudio y músico) y las piezas que le faltan a
 * un kit de «Tocar» (al cajón le faltaban los bongós, por ejemplo).
 *
 * Antes todo eso salía de `rhythm/kit.ts`, ruido filtrado y senos: el dueño,
 * 22-nov-2026, «el bolero suena hiper digital, 0 real, y muchas percusiones
 * en general». Ahora cada voz del kit (bombo, caja, palmas, bongós...) toca
 * una muestra grabada de los paquetes CC0 que ya usa «Tocar»: la Big Rusty
 * Drums de Karoryfer, la VCSL de Versilian, el cajón y las palmas de
 * Smolken. Con su capa de fuerza y alternando los golpes (round robin), que
 * es lo que hace que un martillo de bongó no suene a metralleta.
 *
 * La síntesis se queda solo de reserva (sin red y sin las muestras
 * guardadas) y para la 808 y la 909, que se eligen a propósito por cómo
 * suenan.
 *
 * Se toca con un `AudioBufferSourceNode` y nada más: sin esperas, para que el
 * motor pueda programar un golpe en el mismo tic en que lo pide, igual en
 * directo que en un OfflineAudioContext.
 */

import { CLAQUETA_POR_DEFECTO, SONIDOS, SUBDIVISIONES, golpesDelPaso } from '@/lib/daw/claqueta/claqueta';
import { GROOVES } from '@/lib/daw/rhythm/grooves';
import type { VoiceId } from '@/lib/daw/rhythm/kit';
import { getPaquete, urlDeMuestra, type ArchivoMuestra, type PaqueteId } from './packs';
import { muestrasListas, obtenerMuestra, recortarInicio } from './muestras';
import { nombreDeMuestra } from './preset';

interface Fuente {
  paquete: PaqueteId;
  /** La nota General MIDI de la muestra dentro del paquete. */
  nota: number;
  /** Ganancia propia, para que se oiga como la voz sintetizada a la que sustituye. */
  ganancia: number;
}

const f = (paquete: PaqueteId, nota: number, ganancia = 1): Fuente => ({ paquete, nota, ganancia });

/**
 * Qué muestra suena para cada voz. Las de la 808 y la 909 no están: esas se
 * sintetizan siempre, que es lo que son.
 */
export const MUESTRA_DE_VOZ: Partial<Record<VoiceId, Fuente>> = {
  // Batería (Karoryfer, Big Rusty Drums).
  bombo: f('bateria-acustica', 36),
  caja: f('bateria-acustica', 38),
  charles: f('bateria-acustica', 42),
  charles_pedal: f('bateria-acustica', 44),
  charles_abierto: f('bateria-acustica', 46),
  // El «nudillos» de los ritmos es el golpe de aro (side stick) de la bossa.
  nudillos: f('bateria-acustica', 37),
  platillo: f('bateria-acustica', 49),
  ride: f('bateria-acustica', 51),
  tom_grave: f('bateria-acustica', 45),
  tom_medio: f('bateria-acustica', 47),
  tom_agudo: f('bateria-acustica', 50),
  // Cajón (VCSL) y palmas y pitos (D. Smolken).
  cajon_grave: f('cajon', 36),
  cajon_ghost: f('cajon', 37),
  cajon_slap: f('cajon', 38),
  palma_seca: f('cajon', 39),
  palma_sorda: f('cajon', 42),
  chasquido: f('cajon', 46),
  // Percusión latina (VCSL y los timbales de Virtuosity Drums).
  bongo_agudo: f('percusion-latina', 60),
  bongo_grave: f('percusion-latina', 61),
  // La VCSL no trae slap de conga: el golpe apagado del quinto es lo más cercano.
  conga_slap: f('percusion-latina', 62),
  conga_abierta: f('percusion-latina', 63),
  conga_grave: f('percusion-latina', 64),
  timbal_agudo: f('percusion-latina', 65),
  timbal_grave: f('percusion-latina', 66),
  shaker: f('percusion-latina', 70),
  guiro: f('percusion-latina', 73),
  clave: f('percusion-latina', 75),
  pandereta: f('percusion-latina', 54),
  cencerro: f('percusion-latina', 56),
};

export function fuenteDe(voz: VoiceId): Fuente | null {
  return MUESTRA_DE_VOZ[voz] ?? null;
}

/** Los ficheros de una voz: todas sus capas y golpes alternos. */
export function archivosDe(voz: VoiceId): ArchivoMuestra[] {
  const fuente = fuenteDe(voz);
  const paquete = fuente ? getPaquete(fuente.paquete) : null;
  return fuente && paquete ? paquete.archivos.filter((a) => a.midi === fuente.nota) : [];
}

/** De 0..1 (lo que usan los ritmos) a fuerza MIDI 1..127. */
const fuerzaMidi = (vel: number) => Math.max(1, Math.min(127, Math.round(vel * 127)));

/** Las capas que cubren esa fuerza; si ninguna, la más cercana. */
export function capaPara(archivos: ArchivoMuestra[], vel: number): ArchivoMuestra[] {
  const midi = fuerzaMidi(vel);
  const dentro = archivos.filter((a) => !a.vel || (midi >= a.vel[0] && midi <= a.vel[1]));
  if (dentro.length) return dentro;
  let mejor = Infinity;
  let cerca: ArchivoMuestra[] = [];
  for (const a of archivos) {
    const d = a.vel ? Math.min(Math.abs(midi - a.vel[0]), Math.abs(midi - a.vel[1])) : 0;
    if (d < mejor) {
      mejor = d;
      cerca = [a];
    } else if (d === mejor) cerca.push(a);
  }
  return cerca;
}

/* -------------------------------------------------------------------------- */
/* Carga                                                                       */
/* -------------------------------------------------------------------------- */

/** Lo decodificado de cada fichero, por su URL. Los AudioBuffer valen para cualquier contexto. */
const decodificadas = new Map<string, AudioBuffer>();
const cargando = new Map<string, Promise<void>>();
let decodificador: BaseAudioContext | null = null;

/**
 * Un contexto solo para decodificar: no necesita permiso para sonar ni que
 * el usuario haya tocado nada, y lo decodificado sirve luego en el de
 * directo y en los de exportar.
 */
function contextoDeDecodificar(): BaseAudioContext | null {
  if (decodificador) return decodificador;
  if (typeof OfflineAudioContext === 'undefined') return null;
  decodificador = new OfflineAudioContext(1, 1, 44100);
  return decodificador;
}

function bufferDe(paquete: PaqueteId, archivo: ArchivoMuestra): AudioBuffer | null {
  // Si «Tocar» ya tiene el paquete entero, se usa ese (mismo fichero, ya en memoria).
  const delPaquete = muestrasListas(paquete)?.get(nombreDeMuestra(archivo.nombre));
  if (delPaquete) return delPaquete;
  const p = getPaquete(paquete);
  return p ? (decodificadas.get(urlDeMuestra(p, archivo)) ?? null) : null;
}

/** ¿Tiene ya esa voz todas sus muestras en memoria? */
export function vozLista(voz: VoiceId): boolean {
  const fuente = fuenteDe(voz);
  if (!fuente) return false;
  const archivos = archivosDe(voz);
  return archivos.length > 0 && archivos.every((a) => bufferDe(fuente.paquete, a));
}

/**
 * Baja (o saca de Cache Storage) y decodifica las muestras de esas voces.
 * Sin voces, todas. Se puede llamar las veces que haga falta. Si algo
 * falla (sin red la primera vez), esa voz sigue con la síntesis y se
 * reintenta la próxima vez que se pida.
 */
export async function prepararPercusion(voces?: Iterable<VoiceId>): Promise<void> {
  const ctx = contextoDeDecodificar();
  if (!ctx) return;
  const lista = voces ? [...new Set(voces)] : (Object.keys(MUESTRA_DE_VOZ) as VoiceId[]);
  const trabajos: Promise<void>[] = [];
  for (const voz of lista) {
    const fuente = fuenteDe(voz);
    const paquete = fuente ? getPaquete(fuente.paquete) : null;
    if (!fuente || !paquete) continue;
    for (const archivo of archivosDe(voz)) {
      if (bufferDe(fuente.paquete, archivo)) continue;
      const url = urlDeMuestra(paquete, archivo);
      let trabajo = cargando.get(url);
      if (!trabajo) {
        trabajo = (async () => {
          const bytes = await obtenerMuestra(url);
          const buffer = await ctx.decodeAudioData(bytes);
          decodificadas.set(url, recortarInicio(buffer, ctx));
        })();
        cargando.set(url, trabajo);
        trabajo.catch(() => undefined).finally(() => cargando.delete(url));
      }
      trabajos.push(trabajo.catch(() => undefined));
    }
  }
  await Promise.all(trabajos);
}

/**
 * Las voces que suenan sin abrir «Tocar»: las de los ritmos de la hoja (y de
 * fondo) y las de los sonidos de la claqueta. Salen de los propios datos, así
 * que un ritmo o un sonido nuevo entra solo en la precarga.
 */
export function vocesDeRitmos(): VoiceId[] {
  const voces = new Set<VoiceId>(GROOVES.flatMap((g) => g.hits.map((h) => h.voz)));
  for (const { id: sonido } of SONIDOS) {
    for (const { id: subdivision } of SUBDIVISIONES) {
      for (let paso = 0; paso < 12; paso++) {
        for (const g of golpesDelPaso({ ...CLAQUETA_POR_DEFECTO, sonido, subdivision }, paso, 4)) {
          if (g.voz.tipo === 'kit') voces.add(g.voz.voz);
        }
      }
    }
  }
  return [...voces].filter((v) => fuenteDe(v));
}

let precargaProgramada = false;

/**
 * Deja las muestras de los ritmos y de la claqueta listas sin estorbar: tras
 * el primer toque o tecla (quien ni toca la app no se gasta datos) y cuando el
 * navegador esté desocupado. Son unos 500 KB la primera vez; luego salen de
 * Cache Storage. Platillos, toms y timbales no: solo los usan los kits de
 * «Tocar», que los piden al abrirse.
 */
export function programarPrecarga() {
  if (precargaProgramada || typeof window === 'undefined') return;
  precargaProgramada = true;
  const empezar = () => {
    window.removeEventListener('pointerdown', empezar, true);
    window.removeEventListener('keydown', empezar, true);
    const ocioso = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    const cargar = () => void prepararPercusion(vocesDeRitmos());
    if (ocioso) ocioso(cargar, { timeout: 1500 });
    else window.setTimeout(cargar, 300);
  };
  window.addEventListener('pointerdown', empezar, true);
  window.addEventListener('keydown', empezar, true);
}

/* -------------------------------------------------------------------------- */
/* Tocar                                                                       */
/* -------------------------------------------------------------------------- */

/** Por dónde va el golpe alterno de cada pieza y capa. */
const turno = new Map<string, number>();

/** Nivel de un golpe: el RMS de sus primeros 150 ms, que es donde está todo. */
const nivelDeBuffer = new WeakMap<AudioBuffer, number>();
function nivel(buffer: AudioBuffer): number {
  const guardado = nivelDeBuffer.get(buffer);
  if (guardado !== undefined) return guardado;
  if (typeof buffer.getChannelData !== 'function') return 1;
  const datos = buffer.getChannelData(0);
  const largo = Math.min(datos.length, Math.round(buffer.sampleRate * 0.15));
  let suma = 0;
  for (let i = 0; i < largo; i++) suma += datos[i] * datos[i];
  const n = Math.sqrt(suma / Math.max(1, largo));
  nivelDeBuffer.set(buffer, n);
  return n;
}

const compensaciones = new Map<string, number>();

/**
 * Cuánto hay que subir una capa suave para que su volumen dependa solo de la
 * fuerza. Las capas suaves están grabadas más flojas (es su gracia: suenan
 * más oscuras); si además se les bajara la ganancia por la fuerza, un ritmo
 * tocado suave se oiría el doble de suave. Así la capa pone el color y la
 * fuerza el volumen, como en un buen sampler. Con tope de ×4 (12 dB).
 */
function compensacion(voz: VoiceId, fuente: Fuente, capa: ArchivoMuestra[], buffers: AudioBuffer[]): number {
  const clave = `${voz}:${capa[0].vel?.[0] ?? 0}`;
  const guardada = compensaciones.get(clave);
  if (guardada !== undefined) return guardada;
  const archivos = archivosDe(voz);
  const tope = Math.max(...archivos.map((a) => a.vel?.[1] ?? 127));
  const arriba = archivos.filter((a) => (a.vel?.[1] ?? 127) === tope).map((a) => bufferDe(fuente.paquete, a));
  if (arriba.some((b) => !b)) return 1;
  const media = (bs: AudioBuffer[]) => bs.reduce((s, b) => s + nivel(b), 0) / bs.length;
  const c = Math.min(4, Math.max(1, media(arriba as AudioBuffer[]) / Math.max(1e-6, media(buffers))));
  compensaciones.set(clave, c);
  return c;
}

/**
 * Toca la muestra de `voz` en `cuando` con fuerza `vel` (0..1). Devuelve
 * false si esa voz no tiene muestra o aún no está en memoria: entonces quien
 * llama tira de la síntesis (y de paso se piden las muestras para la próxima).
 */
export function tocarMuestra(voz: VoiceId, ctx: BaseAudioContext, destino: AudioNode, cuando: number, vel = 1): boolean {
  const fuente = fuenteDe(voz);
  if (!fuente) return false;
  const capa = capaPara(archivosDe(voz), vel);
  const buffers = capa.map((a) => bufferDe(fuente.paquete, a));
  if (!capa.length || buffers.some((b) => !b)) {
    void prepararPercusion([voz]);
    return false;
  }
  const clave = `${voz}:${capa[0].vel?.[0] ?? 0}`;
  const n = turno.get(clave) ?? 0;
  turno.set(clave, n + 1);
  const buffer = buffers[n % buffers.length] as AudioBuffer;

  const fuenteSonido = ctx.createBufferSource();
  fuenteSonido.buffer = buffer;
  const ganancia = ctx.createGain();
  // La capa da el color; el volumen lo da la fuerza (y la capa suave se
  // compensa para no contarla dos veces).
  ganancia.gain.value =
    Math.max(0, Math.min(1.5, vel)) * fuente.ganancia * compensacion(voz, fuente, capa, buffers as AudioBuffer[]);
  fuenteSonido.connect(ganancia);
  ganancia.connect(destino);
  fuenteSonido.onended = () => {
    try {
      ganancia.disconnect();
    } catch {
      /* ya desconectada */
    }
  };
  fuenteSonido.start(Math.max(0, cuando));
  return true;
}
