/**
 * El tiempo del reproductor, puro: dónde va un paisaje que suena en bucle,
 * cuándo se para (por su duración o por el temporizador), el fundido de
 * salida y cuándo cuenta una escucha.
 *
 * Un paisaje es un trozo de 2-3 minutos que el <audio> repite con `loop`. Lo
 * que se enseña y lo que se compara con su duración es el tiempo TOTAL que
 * lleva sonando, no la vuelta: una hora de paisaje marca «12:30» a los doce
 * minutos y medio aunque el fichero vaya por su quinta vuelta.
 */

import type { Momento, TipoPieza } from '../tipos';

/** Segundos de fundido antes de pararse solo (fin del paisaje o del temporizador). */
export const FUNDIDO_SEG = 8;

/** A partir de cuánto sonando cuenta una escucha (como en Spotify). */
export const ESCUCHA_SEG = 30;

/** El volumen del modo cuidado donde se puede tocar el volumen (en el iPhone no: ver el hook). */
export const VOLUMEN_CUIDADO = 0.5;

/* ── Bucle ─────────────────────────────────────────────────────────────── */

/**
 * Lo que dura todo lo que se escucha: la duración pedida en un paisaje (el
 * bucle se para ahí) y nada en una canción (manda el fichero). Un paisaje sin
 * duración válida suena hasta que lo paras.
 */
export function limiteDe(version: { bucle?: boolean; receta: { duracionSeg: number } }): number | null {
  if (!version.bucle) return null;
  const d = version.receta.duracionSeg;
  return Number.isFinite(d) && d > 0 ? d : null;
}

/**
 * El tiempo total de un bucle a partir de lo que marca el <audio> (la vuelta)
 * y de lo que se esperaba por el reloj (`totalEstimado`, lo último conocido
 * más lo que ha pasado desde entonces).
 *
 * Por qué así y no contando vueltas: con la pantalla bloqueada el navegador
 * puede dejar de avisar un rato y saltarse varias vueltas seguidas. El reloj
 * dice cuántas han pasado; el <audio>, en qué punto exacto de la vuelta está.
 * Se redondea al número de vueltas que mejor casa con las dos cosas.
 */
export function totalEnBucle(tiempoVuelta: number, duracionVuelta: number, totalEstimado: number): number {
  const t = Math.max(0, tiempoVuelta);
  if (!(duracionVuelta > 0) || !Number.isFinite(duracionVuelta)) return Math.max(t, totalEstimado);
  const vueltas = Math.max(0, Math.round((totalEstimado - t) / duracionVuelta));
  return vueltas * duracionVuelta + t;
}

/** Dónde poner el <audio> para un tiempo total: qué vuelta y en qué segundo de ella. */
export function situarEnBucle(total: number, duracionVuelta: number): { vuelta: number; tiempo: number } {
  const t = Math.max(0, total);
  if (!(duracionVuelta > 0) || !Number.isFinite(duracionVuelta)) return { vuelta: 0, tiempo: t };
  const vuelta = Math.floor(t / duracionVuelta);
  return { vuelta, tiempo: t - vuelta * duracionVuelta };
}

/* ── Pararse solo ──────────────────────────────────────────────────────── */

export type MotivoParada = 'final' | 'temporizador';

export interface Parada {
  parar: boolean;
  /** Factor de volumen del fundido, de 1 (nada) a 0 (parado). */
  volumen: number;
  /** Qué está acabando (o ha acabado), si algo. */
  motivo: MotivoParada | null;
}

/**
 * Si hay que pararse y cuánto bajar el volumen antes. Manda lo que acabe
 * antes: el final del paisaje o el temporizador. El fundido es cuadrático
 * (baja despacio al principio y rápido al final): suena más natural que una
 * recta.
 */
export function decidirParada(datos: {
  total: number;
  limite: number | null;
  ahora: number;
  apagaEn: number | null;
  fundidoSeg?: number;
}): Parada {
  const fundido = datos.fundidoSeg ?? FUNDIDO_SEG;
  const restanFinal = datos.limite === null ? Infinity : datos.limite - datos.total;
  const restanTemporizador = datos.apagaEn === null ? Infinity : (datos.apagaEn - datos.ahora) / 1000;
  const restan = Math.min(restanFinal, restanTemporizador);
  if (restan === Infinity) return { parar: false, volumen: 1, motivo: null };
  const motivo: MotivoParada = restanTemporizador <= restanFinal ? 'temporizador' : 'final';
  if (restan <= 0) return { parar: true, volumen: 0, motivo };
  if (fundido <= 0 || restan >= fundido) return { parar: false, volumen: 1, motivo: null };
  const f = restan / fundido;
  return { parar: false, volumen: f * f, motivo };
}

/** Cuándo se apaga (ms de época) si se pone el temporizador ahora. `null` lo quita. */
export function apagaEnDe(minutos: number | null, ahora: number): number | null {
  if (minutos === null || !Number.isFinite(minutos) || minutos <= 0) return null;
  return ahora + Math.round(minutos * 60_000);
}

/* ── Escuchas ──────────────────────────────────────────────────────────── */

/**
 * Los segundos a partir de los que cuenta una escucha: 30, o casi entera si
 * la pieza dura menos (un boceto de 30 s cuenta al llegar al final, no nunca).
 */
export function umbralEscucha(duracionSeg?: number | null): number {
  if (duracionSeg === undefined || duracionSeg === null || !Number.isFinite(duracionSeg) || duracionSeg <= 0) {
    return ESCUCHA_SEG;
  }
  return Math.min(ESCUCHA_SEG, Math.max(1, duracionSeg - 1));
}

/**
 * Lo que suma a lo escuchado un paso natural del tiempo (no un salto del
 * deslizador: esos los pone el reproductor a cero antes de medir).
 */
export function sumarSonado(sonado: number, totalAntes: number, totalAhora: number): number {
  const paso = totalAhora - totalAntes;
  return paso > 0 && Number.isFinite(paso) ? sonado + paso : sonado;
}

/* ── Modo cuidado ──────────────────────────────────────────────────────── */

/**
 * Si el modo cuidado empieza encendido al tocar algo. Lo que tú elegiste manda
 * siempre; si no has elegido, se enciende solo en los paisajes para dormir
 * (plan, parte 8, asiento del oyente). No se deduce nada más: aura no
 * etiqueta para qué la usas.
 */
export function cuidadoAlTocar(pieza: { tipo: TipoPieza; momento?: Momento }, elegido: boolean | null): boolean {
  if (elegido !== null) return elegido;
  return pieza.tipo === 'paisaje' && pieza.momento === 'dormir';
}

/* ── Lo que se enseña ──────────────────────────────────────────────────── */

/** «1:05», «12:30», «1:02:03»: el tiempo de un reproductor, sin redondear minutos. */
export function reloj(segundos: number): string {
  const s = Math.max(0, Math.floor(Number.isFinite(segundos) ? segundos : 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}
