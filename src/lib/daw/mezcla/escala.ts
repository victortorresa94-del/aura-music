/**
 * Escalas del mezclador: cómo se lee y cómo se mueve un fader.
 *
 * Un fader de mesa no es lineal ni en decibelios ni en ganancia: los últimos
 * diez decibelios (de −10 a 0) ocupan casi un tercio del recorrido, porque es
 * donde se mezcla de verdad, y de −40 para abajo se pasa rápido. Esta tabla
 * copia esa forma. El medidor de al lado usa la misma, así el nivel y el
 * fader se leen a la misma altura.
 */

/** [posición de 0 a 1, decibelios]. Por debajo del primer punto, silencio. */
const TABLA: ReadonlyArray<readonly [number, number]> = [
  [0.04, -60],
  [0.15, -40],
  [0.28, -30],
  [0.42, -20],
  [0.58, -10],
  [0.68, -5],
  [0.78, 0],
  [0.89, 3],
  [1, 6],
];

export const DB_MIN = -60;
export const DB_MAX = 6;
/** Altura del 0 dB en el recorrido del fader y del medidor. */
export const POSICION_0DB = 0.78;

export function linealADb(lineal: number): number {
  return lineal > 0 ? 20 * Math.log10(lineal) : -Infinity;
}

export function dbALineal(db: number): number {
  return Number.isFinite(db) ? 10 ** (db / 20) : 0;
}

/** De decibelios a altura en el fader (0 abajo, 1 arriba). */
export function posicionDeDb(db: number): number {
  if (!Number.isFinite(db) || db <= DB_MIN - 40) return 0;
  if (db >= DB_MAX) return 1;
  const [p0, d0] = TABLA[0];
  // Entre el silencio y −60 dB, el tramo de abajo del todo: se reparte en
  // ganancia para que el fader llegue a cero sin un salto.
  if (db < d0) return Math.max(0, p0 * (dbALineal(db) / dbALineal(d0)));
  for (let i = 1; i < TABLA.length; i++) {
    const [p1, d1] = TABLA[i];
    const [pa, da] = TABLA[i - 1];
    if (db <= d1) return pa + ((db - da) / (d1 - da)) * (p1 - pa);
  }
  return 1;
}

/** De altura en el fader a decibelios (−∞ abajo del todo). */
export function dbDePosicion(posicion: number): number {
  const p = Math.min(1, Math.max(0, posicion));
  const [p0, d0] = TABLA[0];
  if (p <= 0.002) return -Infinity;
  if (p < p0) return linealADb((p / p0) * dbALineal(d0));
  for (let i = 1; i < TABLA.length; i++) {
    const [p1, d1] = TABLA[i];
    const [pa, da] = TABLA[i - 1];
    if (p <= p1) return da + ((p - pa) / (p1 - pa)) * (d1 - da);
  }
  return DB_MAX;
}

export const posicionDeVolumen = (lineal: number) => posicionDeDb(linealADb(lineal));
export const volumenDePosicion = (posicion: number) => dbALineal(dbDePosicion(posicion));

/** El signo menos de verdad, no el guion: en tipografía numérica se nota. */
const MENOS = '−';

/** «−6,0», «+3,0», «0,0» o «−∞». Una cifra decimal, coma española. */
export function textoDb(db: number, decimales = 1): string {
  if (!Number.isFinite(db) || db <= DB_MIN - 30) return `${MENOS}∞`;
  const redondo = Number(db.toFixed(decimales));
  if (Math.abs(redondo) < 10 ** -decimales / 2) return (0).toFixed(decimales).replace('.', ',');
  const cifra = Math.abs(redondo).toLocaleString('es-ES', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  });
  return `${redondo < 0 ? MENOS : '+'}${cifra}`;
}

/** El volumen de una pista como lo diría un técnico: «−6,0 dB». */
export function textoVolumen(lineal: number): string {
  const texto = textoDb(linealADb(lineal));
  return texto.endsWith('∞') ? texto : `${texto} dB`;
}

/** «C», «I 40», «D 40»: lo que cabe debajo de un panorama en una tira estrecha. */
export function textoPanorama(panorama: number): string {
  const v = Math.round(panorama * 100);
  if (v === 0) return 'C';
  return `${v < 0 ? 'I' : 'D'} ${Math.abs(v)}`;
}

/** Lo mismo, con todas las letras, para el lector de pantalla. */
export function panoramaDicho(panorama: number): string {
  const v = Math.round(panorama * 100);
  if (v === 0) return 'Centro';
  return `${Math.abs(v)} a la ${v < 0 ? 'izquierda' : 'derecha'}`;
}

/** «+3 dB» o «−2,5 dB» para el ecualizador: sin decimales si no hacen falta. */
export function textoGanancia(db: number): string {
  const redondo = Math.round(db * 2) / 2;
  if (redondo === 0) return '0 dB';
  const cifra = Math.abs(redondo).toLocaleString('es-ES', { maximumFractionDigits: 1 });
  return `${redondo < 0 ? MENOS : '+'}${cifra} dB`;
}

/** «35 %». */
export function textoPorcentaje(valor: number): string {
  return `${Math.round(valor * 100)} %`;
}
