/**
 * La conversación de Crear, pura: de lo que dices y lo que eliges con un
 * toque a una receta (una canción o un paisaje) o a un plan de playlist.
 *
 * Reglas (plan, 3.2): no es una caja en blanco; empieza con ocasiones de un
 * toque; pregunta como mucho TRES cosas, cada una con chips; y cuando no
 * queda nada que preguntar, enseña la receta en una frase y su precio.
 *
 * Las ocasiones salen de cómo lo pide Víctor (28-nov-2026): «créame una
 * canción», una playlist para «noche de sofá chill», «para recoger»,
 * «domingo contento» o «funky pero con un rollo jazz».
 */

import { MOMENTOS, type Momento, type Receta, type TipoPieza } from '../tipos';
import { ETIQUETA_MOMENTO, planDePlaylist, tamanoDePlan, type PlanDePlaylist } from '../playlists/plan';
import { interpretar, mezclar, type RecetaParcial } from './interpretar';
import { completarReceta, tipoProbable, vozProbable } from './receta';
import { elegirMotor } from '../motores';
import type { Artista, MotorId } from '../tipos';

export type Quiere = TipoPieza | 'playlist';

export interface Ocasion {
  id: string;
  etiqueta: string;
  frase: string;
  quiere: Quiere;
}

/** Los atajos de la primera pantalla. Un toque y aura ya sabe casi todo. */
export const OCASIONES: readonly Ocasion[] = [
  { id: 'cancion', etiqueta: 'Créame una canción', frase: 'Créame una canción', quiere: 'cancion' },
  { id: 'sofa', etiqueta: 'Noche de sofá chill', frase: 'Una playlist para una noche de sofá, chill y tranquila', quiere: 'playlist' },
  { id: 'recoger', etiqueta: 'Para recoger la casa', frase: 'Una playlist alegre y con ritmo para recoger la casa', quiere: 'playlist' },
  { id: 'domingo', etiqueta: 'Domingo contento', frase: 'Una playlist de domingo contento, alegre y luminosa', quiere: 'playlist' },
  { id: 'funky-jazz', etiqueta: 'Funky con rollo jazz', frase: 'Una canción funky pero con un rollo jazz', quiere: 'cancion' },
  { id: 'migrana', etiqueta: 'Para bajar el ritmo, 1 h', frase: 'Para bajar el ritmo, lenta, sin voz, una hora, con un tono de 142 Hz', quiere: 'paisaje' },
  { id: 'dormir', etiqueta: 'Para dormir', frase: 'Para dormir, muy lenta y sin voz, una hora', quiere: 'paisaje' },
  { id: 'correr', etiqueta: 'Para correr', frase: 'Una playlist con energía para correr', quiere: 'playlist' },
];

export type IdPregunta = 'momento' | 'voz' | 'duracion' | 'tamano' | 'capas';

export interface OpcionChip {
  valor: string;
  etiqueta: string;
}

export interface PreguntaChat {
  id: IdPregunta;
  texto: string;
  opciones: OpcionChip[];
}

export interface EstadoConversacion {
  quiere?: Quiere;
  parcial: RecetaParcial;
  frases: string[];
  /** Cuántas canciones si es playlist. */
  n?: number;
  respondidas: IdPregunta[];
  imitacion: string | null;
}

export const MAX_PREGUNTAS = 3;

export function conversacionVacia(): EstadoConversacion {
  return { parcial: {}, frases: [], respondidas: [], imitacion: null };
}

const QUIERE_PLAYLIST = /\b(playlist|lista|listas|varias canciones|unas canciones|canciones para)\b/i;

/** Lo que pide: una canción, un paisaje o una playlist. */
export function queQuiere(texto: string, parcial: RecetaParcial): Quiere | undefined {
  if (QUIERE_PLAYLIST.test(texto)) return 'playlist';
  return tipoProbable(parcial);
}

/** Lo que se le dice a aura: suma la frase a lo que ya sabía (lo nuevo manda). */
export function decir(estado: EstadoConversacion, texto: string, quiere?: Quiere): EstadoConversacion {
  const limpio = texto.trim();
  if (!limpio) return estado;
  const { parcial, imitacion } = interpretar(limpio);
  const junto = mezclar(estado.parcial, parcial);
  const deseo = quiere ?? queQuiere(limpio, junto) ?? estado.quiere;
  const n = deseo === 'playlist' ? estado.n ?? numeroDeCanciones(limpio) : estado.n;
  return {
    ...estado,
    quiere: deseo,
    parcial: deseo === 'paisaje' ? { ...junto, tipo: 'paisaje' } : deseo === 'cancion' && junto.tipo === 'paisaje' && !junto.duracionSeg ? { ...junto, tipo: 'cancion' } : junto,
    frases: [...estado.frases, limpio],
    ...(n ? { n } : {}),
    imitacion: imitacion ?? null,
  };
}

function numeroDeCanciones(texto: string): number | undefined {
  const m = texto.match(/\b(\d{1,2})\s+canciones\b/i);
  return m ? tamanoDePlan(Number(m[1])) : undefined;
}

const MOMENTO_CHIPS: OpcionChip[] = MOMENTOS.map((m) => ({ valor: m, etiqueta: ETIQUETA_MOMENTO[m] }));

/** La siguiente pregunta, o null si ya se puede hacer. Como mucho tres. */
export function siguientePregunta(estado: EstadoConversacion): PreguntaChat | null {
  if (estado.imitacion) return null;
  if (estado.respondidas.length >= MAX_PREGUNTAS) return null;
  const p = estado.parcial;
  const ya = (id: IdPregunta) => estado.respondidas.includes(id);
  const quiere = estado.quiere ?? 'cancion';

  if (!ya('momento') && !p.momento && !p.estilo && !p.sorpresa && !p.parecido) {
    return { id: 'momento', texto: '¿Para qué momento es?', opciones: MOMENTO_CHIPS };
  }
  if (quiere === 'cancion' && !ya('voz') && vozProbable(p) === undefined) {
    return {
      id: 'voz',
      texto: '¿Con voz o sin voz?',
      opciones: [
        { valor: 'con', etiqueta: 'Con voz' },
        { valor: 'sin', etiqueta: 'Sin voz' },
      ],
    };
  }
  if (quiere === 'playlist' && !ya('tamano') && !estado.n) {
    return {
      id: 'tamano',
      texto: '¿Cuántas canciones?',
      opciones: [
        { valor: '4', etiqueta: '4' },
        { valor: '8', etiqueta: '8' },
        { valor: '12', etiqueta: '12' },
      ],
    };
  }
  if (quiere === 'paisaje' && !ya('duracion') && p.duracionSeg === undefined) {
    return {
      id: 'duracion',
      texto: '¿Cuánto quieres que dure?',
      opciones: [
        { valor: '1200', etiqueta: '20 min' },
        { valor: '3600', etiqueta: '1 h' },
        { valor: '7200', etiqueta: '2 h' },
        { valor: '28800', etiqueta: 'Hasta que la pare' },
      ],
    };
  }
  if (quiere === 'paisaje' && !ya('capas') && !p.capas) {
    return {
      id: 'capas',
      texto: '¿Le pongo algo encima?',
      opciones: [
        { valor: 'tono', etiqueta: 'Un tono de 142 Hz' },
        { valor: 'ruido', etiqueta: 'Ruido suave' },
        { valor: 'nada', etiqueta: 'Nada' },
      ],
    };
  }
  return null;
}

/** Contestar con un chip. */
export function responder(estado: EstadoConversacion, id: IdPregunta, valor: string): EstadoConversacion {
  const p = { ...estado.parcial };
  let n = estado.n;
  if (id === 'momento' && (MOMENTOS as readonly string[]).includes(valor)) p.momento = valor as Momento;
  if (id === 'voz') p.conVoz = valor === 'con';
  if (id === 'duracion') p.duracionSeg = Number(valor) || 3600;
  if (id === 'tamano') n = tamanoDePlan(Number(valor));
  if (id === 'capas') {
    if (valor === 'tono') p.capas = { ...(p.capas ?? {}), tono: { hz: 142, nivel: 0.15 } };
    else if (valor === 'ruido') p.capas = { ...(p.capas ?? {}), ruido: { color: 'marron', nivel: 0.3 } };
    else p.capas = {};
  }
  return { ...estado, parcial: p, ...(n ? { n } : {}), respondidas: [...estado.respondidas, id] };
}

export interface Resultado {
  tipo: 'receta';
  receta: Receta;
}

/** La receta de una canción o un paisaje con lo que se sabe. */
export function recetaDe(estado: EstadoConversacion, opciones: { falso?: boolean; artista?: Artista; motor?: MotorId } = {}): Receta {
  const p = estado.quiere === 'paisaje' ? { ...estado.parcial, tipo: 'paisaje' as const } : estado.parcial;
  const motor = opciones.motor ?? elegirMotor({ tipo: p.tipo ?? 'cancion', conVoz: !!vozProbable(p), letra: p.letra }, { falso: opciones.falso });
  return completarReceta(p, { motor, frase: estado.frases.join('. '), artista: opciones.artista });
}

/** El plan de una playlist con lo que se sabe. */
export function planDe(estado: EstadoConversacion, opciones: { falso?: boolean } = {}): PlanDePlaylist {
  return planDePlaylist({
    momento: estado.parcial.momento ?? 'sorprendeme',
    frase: estado.frases.join('. '),
    n: estado.n ?? 8,
    ...(opciones.falso ? { motor: 'falso' as const } : {}),
  });
}
