/**
 * Las playlists vivas: se renuevan solas cada día o cada semana, como daylist
 * y Prompted Playlist de Spotify, pero aquí cada canción cuesta créditos, así
 * que SIEMPRE con un tope al mes que se elige al activarla y que se ve en la
 * playlist (plan, parte 3.5; asientos 4, 10 y 11 del equipo Spotify).
 *
 * Reglas, puras y con tests:
 * - Se renueva una vez por periodo: por día natural, o por semana de lunes a
 *   domingo (como Discover Weekly, que llega los lunes).
 * - Lo gastado se cuenta por mes («2026-11») y al cambiar de mes vuelve a 0.
 * - Nunca pasa del tope: si no cabe una canción entera, no se hace.
 *
 * Las fechas van en la hora del móvil: el lunes es el lunes de quien escucha.
 */

import { creditosDeReceta, textoCreditos } from '../precios';
import type { Artista, MotorId, Playlist, PlaylistViva, Receta } from '../tipos';
import { recetaDeArtista, soloReceta } from '../artistas/adn';
import { nuevoId, portadaGenerativa } from '../biblioteca';
import { DURACION_CANCION_SEG } from './plan';

const DIA_MS = 24 * 60 * 60 * 1000;

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

/** «2026-11»: el mes de una fecha, en la hora del móvil. */
export function mesDe(ahora: number): string {
  const d = new Date(ahora);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** El principio del día de una fecha (00:00 en la hora del móvil). */
function inicioDelDia(t: number): number {
  const d = new Date(t);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** El lunes a las 00:00 de la semana de una fecha. */
function inicioDeLaSemana(t: number): number {
  const d = new Date(t);
  const desdeLunes = (d.getDay() + 6) % 7;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - desdeLunes).getTime();
}

function inicioDelPeriodo(cada: PlaylistViva['cada'], t: number): number {
  return cada === 'dia' ? inicioDelDia(t) : inicioDeLaSemana(t);
}

/** ¿Toca renovarla? Si nunca se renovó, o si ya estamos en otro día (o en otra semana). */
export function debeRenovar(viva: PlaylistViva, ahora: number): boolean {
  if (viva.ultimaRenovacion === undefined) return true;
  return inicioDelPeriodo(viva.cada, ahora) > inicioDelPeriodo(viva.cada, viva.ultimaRenovacion);
}

/** Lo gastado este mes: si el apunte es de otro mes, este mes va a cero. */
export function gastadoEsteMes(viva: PlaylistViva, ahora: number): number {
  return viva.mes === mesDe(ahora) ? Math.max(0, viva.gastadoMes) : 0;
}

/** Cuánto le queda este mes antes del tope. Nunca negativo. */
export function cuantoPuedeGastar(viva: PlaylistViva, ahora: number): number {
  return Math.max(0, Math.max(0, viva.topeCreditosMes) - gastadoEsteMes(viva, ahora));
}

/** Lo que cuesta cada canción nueva de esta playlist. */
export function costePorCancion(viva: PlaylistViva): number {
  return creditosDeReceta(viva.receta);
}

/**
 * Cuántas canciones caben en esta renovación: las que pide, o menos si el
 * tope no da. Una canción que no cabe entera no se hace.
 */
export function cuantasCaben(viva: PlaylistViva, ahora: number): number {
  const coste = costePorCancion(viva);
  const nuevas = Math.max(0, Math.round(viva.nuevas));
  if (coste <= 0) return nuevas;
  return Math.min(nuevas, Math.floor(cuantoPuedeGastar(viva, ahora) / coste));
}

/**
 * La viva después de renovarse: apunta lo gastado en el mes de `ahora` (si
 * el apunte era de otro mes, empieza de cero) y la fecha de la renovación.
 * Lo gastado nunca pasa del tope.
 */
export function trasRenovar(viva: PlaylistViva, gastado: number, ahora: number): PlaylistViva {
  const antes = gastadoEsteMes(viva, ahora);
  const tope = Math.max(0, viva.topeCreditosMes);
  return {
    ...viva,
    mes: mesDe(ahora),
    gastadoMes: Math.min(tope, antes + Math.max(0, Math.round(gastado))),
    ultimaRenovacion: ahora,
  };
}

/** Cuántas renovaciones caben como mucho en un mes: 31 días, o 5 lunes. */
export function renovacionesMaxAlMes(cada: PlaylistViva['cada']): number {
  return cada === 'dia' ? 31 : 5;
}

/** El tope que se propone al activarla: lo justo para no saltarse ninguna renovación. */
export function topeSugerido(cada: PlaylistViva['cada'], nuevas: number, receta: Pick<Receta, 'tipo' | 'duracionSeg' | 'motor'>): number {
  return renovacionesMaxAlMes(cada) * Math.max(1, Math.round(nuevas)) * creditosDeReceta(receta);
}

export function nuevaViva(
  datos: { cada: PlaylistViva['cada']; nuevas: number; receta: Receta; topeCreditosMes?: number },
  ahora: number,
): PlaylistViva {
  return {
    cada: datos.cada,
    nuevas: Math.max(1, Math.round(datos.nuevas)),
    topeCreditosMes: Math.max(0, Math.round(datos.topeCreditosMes ?? topeSugerido(datos.cada, datos.nuevas, datos.receta))),
    gastadoMes: 0,
    mes: mesDe(ahora),
    receta: datos.receta,
  };
}

/* ── Textos (los que se ven siempre en la playlist) ───────────────────── */

/** «Una canción nueva cada lunes», «2 canciones nuevas cada día». */
export function textoRitmo(viva: PlaylistViva): string {
  const cuantas = viva.nuevas === 1 ? 'Una canción nueva' : `${viva.nuevas} canciones nuevas`;
  return `${cuantas} ${viva.cada === 'dia' ? 'cada día' : 'cada lunes'}`;
}

/** «Quedan 24 créditos este mes», siempre a la vista. */
export function textoQuedan(viva: PlaylistViva, ahora: number): string {
  const quedan = cuantoPuedeGastar(viva, ahora);
  if (quedan <= 0) return 'No quedan créditos este mes';
  return `${quedan === 1 ? 'Queda' : 'Quedan'} ${textoCreditos(quedan)} este mes`;
}

/** «Tope: 30 créditos al mes». */
export function textoTope(viva: PlaylistViva): string {
  return `Tope: ${textoCreditos(viva.topeCreditosMes)} al mes`;
}

/** Cuándo llega la siguiente, o por qué no va a llegar este mes. */
export function textoProxima(viva: PlaylistViva, ahora: number): string {
  if (debeRenovar(viva, ahora)) {
    return cuantasCaben(viva, ahora) > 0 ? 'Se renueva al abrir aura Music' : textoSinTope(ahora);
  }
  const siguiente = viva.cada === 'dia' ? inicioDelDia(ahora) + DIA_MS : inicioDeLaSemana(ahora) + 7 * DIA_MS;
  if (cuantasCaben(viva, siguiente) <= 0) return textoSinTope(ahora);
  return viva.cada === 'dia' ? 'La próxima, mañana' : 'La próxima, el lunes';
}

function textoSinTope(ahora: number): string {
  const d = new Date(ahora);
  const mesQueViene = MESES[(d.getMonth() + 1) % 12];
  return `Ya no caben más este mes: vuelve en ${mesQueViene}`;
}

/* ── «Tu semana con…» ─────────────────────────────────────────────────── */

/** La receta de cada canción nueva de un artista. */
export function recetaSemanal(artista: Pick<Artista, 'id' | 'nombre' | 'adn'>, motor: MotorId = 'lyria3'): Receta {
  return {
    tipo: 'cancion',
    duracionSeg: DURACION_CANCION_SEG,
    motor,
    ...soloReceta(recetaDeArtista(artista)),
  };
}

/**
 * «Tu semana con <nombre>»: una playlist viva de una canción nueva cada lunes,
 * con el tope justo para los lunes del mes (cinco como mucho).
 */
export function semanaCon(
  artista: Pick<Artista, 'id' | 'nombre' | 'adn'>,
  datos: { ahora?: number; motor?: MotorId; id?: string } = {},
): Playlist {
  const ahora = datos.ahora ?? Date.now();
  const id = datos.id ?? nuevoId('pl', ahora);
  const nombre = `Tu semana con ${artista.nombre}`;
  return {
    id,
    nombre,
    porque: `Cada lunes, una canción nueva de ${artista.nombre}.`,
    cancionIds: [],
    porques: {},
    portada: portadaGenerativa(`${id}:${nombre}`),
    viva: nuevaViva({ cada: 'semana', nuevas: 1, receta: recetaSemanal(artista, datos.motor) }, ahora),
    creadaEn: ahora,
    actualizadaEn: ahora,
  };
}

/** La playlist viva semanal de un artista, si la tiene. */
export function semanaDe<T extends Pick<Playlist, 'viva'>>(playlists: T[], artistaId: string): T | undefined {
  return playlists.find((p) => p.viva?.cada === 'semana' && p.viva.receta.artistaId === artistaId);
}
