/**
 * Bajar, guardar y decodificar las muestras de un paquete.
 *
 * Primero se mira en Cache Storage (`aura-samples-v1`); si no está, se pide a
 * nuestro servidor y se guarda. Así la segunda vez, con o sin red, abre al
 * momento. Lo decodificado se queda en memoria: los AudioBuffer no son de
 * ningún contexto, y los mismos sirven para tocar en directo y para hacer el
 * WAV en un OfflineAudioContext.
 */

import { getPaquete, urlDeMuestra, type Paquete, type PaqueteId } from './packs';
import { nombreDeMuestra } from './preset';

export const CACHE_MUESTRAS = 'aura-samples-v1';

const decodificados = new Map<PaqueteId, Promise<Map<string, AudioBuffer>>>();
const listos = new Map<PaqueteId, Map<string, AudioBuffer>>();

export { nombreDeMuestra } from './preset';

async function obtener(url: string): Promise<ArrayBuffer> {
  const conCache = typeof caches !== 'undefined';
  if (conCache) {
    try {
      const cache = await caches.open(CACHE_MUESTRAS);
      const guardado = await cache.match(url);
      if (guardado) return await guardado.arrayBuffer();
      const respuesta = await fetch(url);
      if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
      // Se guarda una copia antes de leerla: el cuerpo solo se puede leer una vez.
      await cache.put(url, respuesta.clone()).catch(() => undefined);
      return await respuesta.arrayBuffer();
    } catch (error) {
      // Cache Storage puede fallar (modo privado, cuota): se intenta sin él.
      if (error instanceof Error && error.message.startsWith('HTTP')) throw error;
    }
  }
  const respuesta = await fetch(url);
  if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
  return respuesta.arrayBuffer();
}

/**
 * Quita el silencio del principio. Un MP3 trae unos 25 ms de relleno del
 * codificador por delante (y no todos los navegadores lo quitan al
 * decodificar): sin esto, cada nota llegaría tarde y el piano arrastraría.
 */
export function recortarInicio(buffer: AudioBuffer, ctx: BaseAudioContext): AudioBuffer {
  const datos = buffer.getChannelData(0);
  let pico = 0;
  for (let i = 0; i < datos.length; i++) pico = Math.max(pico, Math.abs(datos[i]));
  if (pico === 0) return buffer;
  const umbral = Math.max(1e-4, pico * 0.004);
  let inicio = 0;
  while (inicio < datos.length && Math.abs(datos[inicio]) < umbral) inicio++;
  inicio = Math.max(0, inicio - Math.round(buffer.sampleRate * 0.0005));
  if (inicio < 8) return buffer;
  const largo = buffer.length - inicio;
  const nuevo = ctx.createBuffer(buffer.numberOfChannels, largo, buffer.sampleRate);
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    nuevo.getChannelData(c).set(buffer.getChannelData(c).subarray(inicio));
  }
  return nuevo;
}

export interface Progreso {
  cargadas: number;
  total: number;
}

/**
 * Baja y decodifica un paquete entero. Se puede llamar muchas veces: la
 * segunda devuelve la misma promesa. Si falla, se olvida para poder
 * reintentarlo cuando vuelva la red.
 */
export function cargarPaquete(
  id: PaqueteId,
  ctx: BaseAudioContext,
  alAvanzar?: (p: Progreso) => void,
): Promise<Map<string, AudioBuffer>> {
  const existente = decodificados.get(id);
  if (existente) return existente;
  const paquete = getPaquete(id);
  if (!paquete) return Promise.reject(new Error('Paquete sin muestras'));

  const promesa = (async () => {
    const mapa = new Map<string, AudioBuffer>();
    let cargadas = 0;
    alAvanzar?.({ cargadas, total: paquete.archivos.length });
    // De cuatro en cuatro: más en paralelo no acelera en el móvil y satura la red.
    const cola = [...paquete.archivos];
    const trabajador = async () => {
      for (let archivo = cola.shift(); archivo; archivo = cola.shift()) {
        const bytes = await obtener(urlDeMuestra(paquete, archivo));
        const buffer = await ctx.decodeAudioData(bytes);
        mapa.set(nombreDeMuestra(archivo.nombre), recortarInicio(buffer, ctx));
        cargadas++;
        alAvanzar?.({ cargadas, total: paquete.archivos.length });
      }
    };
    await Promise.all([trabajador(), trabajador(), trabajador(), trabajador()]);
    listos.set(id, mapa);
    return mapa;
  })();

  decodificados.set(id, promesa);
  promesa.catch(() => decodificados.delete(id));
  return promesa;
}

/** Las muestras ya decodificadas, si las hay (sin esperar a nada). */
export function muestrasListas(id: PaqueteId | undefined): Map<string, AudioBuffer> | null {
  if (!id) return null;
  return listos.get(id) ?? null;
}

/** ¿Está el paquete entero guardado en el móvil? Para decir «sin red» o «se bajará». */
export async function paqueteGuardado(paquete: Paquete): Promise<boolean> {
  if (typeof caches === 'undefined') return false;
  try {
    const cache = await caches.open(CACHE_MUESTRAS);
    for (const archivo of paquete.archivos) {
      if (!(await cache.match(urlDeMuestra(paquete, archivo)))) return false;
    }
    return true;
  } catch {
    return false;
  }
}
