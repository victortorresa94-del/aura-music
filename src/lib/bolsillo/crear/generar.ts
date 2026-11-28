/**
 * Generar una pieza: crea la canción (o la versión nueva de una que ya
 * existe) en el almacén, la pide al motor, guarda el audio en el móvil y la
 * marca como lista. Lo usan Crear, los retoques y las playlists.
 *
 * - La versión se escribe en estado `generando` ANTES de llamar al motor, con
 *   su `trabajo` en cuanto lo hay: si se cierra la app, se sabe qué se pidió.
 * - Si la receta es un paisaje, el trozo generado se alarga en el móvil
 *   (`renderizarPaisaje`) con sus capas antes de guardarse.
 * - El audio se guarda en el móvil además de su URL: perder una canción que
 *   te gusta es lo único que no se perdona.
 */

import { almacen } from '../almacen';
import { nuevaCancion, nuevaVersion } from '../biblioteca';
import { avisarSaldoCambiado } from '../cuenta';
import { motorDeBoceto, motorPara } from '../motor/motores';
import { ErrorDeMotor, type EstadoTrabajo } from '../motor/tipos';
import { renderizarPaisaje } from '../paisaje/render';
import { creditosDeBoceto, creditosDeReceta, segundosAGenerar } from '../precios';
import type { Artista, Receta, Version } from '../tipos';
import { descripcionEnIngles } from './receta';

export interface ResultadoGenerar {
  cancionId: string;
  versionId: string;
}

export interface DatosGenerar {
  titulo: string;
  porque?: string;
  /** Si viene, es una versión nueva de esa canción. */
  cancionId?: string;
  /** Qué cambia respecto a la anterior. */
  cambio?: string;
  /** Boceto de 30 s (Lyria 3) para comprobar el rumbo. */
  boceto?: boolean;
  artista?: Artista;
  paraQuien?: string;
  /** Para enseñar el avance: «En cola», «Generando», «Guardando». */
  alAvanzar?: (fase: string) => void;
}

const ESPERA_MAX_MS = 9 * 60_000;
const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

function textoDe(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return 'No ha salido. Prueba otra vez en un momento.';
}

export async function generarCancion(receta: Receta, datos: DatosGenerar): Promise<ResultadoGenerar> {
  const a = almacen();
  const ahora = Date.now();
  let cancion = datos.cancionId ? await a.canciones.leer(datos.cancionId) : null;
  if (datos.cancionId && !cancion) throw new Error('Esa canción ya no está en tu biblioteca.');
  if (!cancion) {
    cancion = nuevaCancion(receta, { titulo: datos.titulo, porque: datos.porque, ahora });
    await a.canciones.poner(cancion);
  }

  const motorId = datos.boceto ? motorDeBoceto() : receta.motor;
  const pedida: Receta = { ...receta, motor: motorId };
  const motor = motorPara(motorId);
  const creditos = motor.gratis ? 0 : datos.boceto ? creditosDeBoceto() : creditosDeReceta(pedida);
  let version: Version = nuevaVersion(cancion, await a.versiones.todos(), pedida, {
    cambio: datos.cambio ?? (datos.boceto ? 'Boceto de 30 segundos' : 'La primera'),
    creditos,
    ahora,
  });
  await a.versiones.poner(version);

  try {
    datos.alAvanzar?.('En cola');
    const segundos = datos.boceto ? 30 : segundosAGenerar(pedida);
    const inicio = await motor.iniciar({
      descripcion: descripcionEnIngles(pedida, { artista: datos.artista, paraQuien: datos.paraQuien }),
      segundos,
      motor: motorId,
      conVoz: pedida.conVoz,
      ...(pedida.letra ? { letra: pedida.letra } : {}),
      ...(pedida.bpm ? { bpm: pedida.bpm } : {}),
      ...(pedida.energia !== undefined ? { energia: pedida.energia } : {}),
      semilla: version.n * 7919 + cancion.creadaEn,
    });
    version = { ...version, trabajo: { referencia: inicio.referencia, lanzadoEn: Date.now() } };
    await a.versiones.poner(version);
    if (!motor.gratis) avisarSaldoCambiado();

    let estado: EstadoTrabajo = inicio.estado;
    const limite = Date.now() + ESPERA_MAX_MS;
    while (estado.estado === 'en-cola' || estado.estado === 'generando') {
      datos.alAvanzar?.(estado.estado === 'en-cola' ? 'En cola' : 'Generando');
      if (Date.now() > limite) throw new Error('Está tardando más de lo normal. Sigue en marcha: mírala en un rato.');
      await espera(motor.gratis ? 250 : 4000);
      estado = await motor.consultar(inicio.referencia);
    }
    if (estado.estado === 'fallo') throw new ErrorDeMotor(estado.error, 'otro');

    datos.alAvanzar?.('Guardando');
    let audio: Blob | null = estado.audio ?? null;
    if (!audio && estado.url) {
      try {
        const r = await fetch(estado.url);
        if (r.ok) audio = await r.blob();
      } catch {
        /* sin CORS: se queda con la URL, que el <audio> sí puede tocar */
      }
    }
    if (pedida.tipo === 'paisaje' && audio) {
      datos.alAvanzar?.('Alargándola en el móvil');
      const cuidado = pedida.momento === 'dormir' || pedida.momento === 'desconectar';
      audio = await renderizarPaisaje(audio, pedida.capas ?? {}, { cuidado });
    }
    const audioId = audio ? `aud_${version.id}` : undefined;
    if (audio && audioId) await a.audios.poner(audioId, audio);
    const { trabajo: _hecho, ...sinTrabajo } = version;
    version = {
      ...sinTrabajo,
      estado: 'lista',
      ...(audioId ? { audioId } : {}),
      ...(estado.url ? { urlRemota: estado.url } : {}),
      ...(estado.letra ? { letra: estado.letra } : {}),
      ...(pedida.tipo === 'paisaje' ? { bucle: true } : {}),
    };
    await a.versiones.poner(version);
    const fresca = await a.canciones.leer(cancion.id);
    if (fresca) await a.canciones.poner({ ...fresca, actualizadaEn: Date.now() });
    return { cancionId: cancion.id, versionId: version.id };
  } catch (error) {
    await a.versiones.poner({ ...version, estado: 'fallo', error: textoDe(error) });
    throw error;
  }
}
