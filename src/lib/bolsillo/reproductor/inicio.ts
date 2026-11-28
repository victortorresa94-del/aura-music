/**
 * Las secciones del Inicio, puras (plan, parte 3.1, asientos de daylist y de
 * Discover Weekly): el Inicio cambia con la hora y cada bloque lleva un nombre
 * que suena a ti, sacado de TUS canciones y no de un catálogo.
 *
 * Orden: «Seguir escuchando» arriba, después el bloque de este momento del día
 * («Tu jueves por la tarde»), tus paisajes, tus artistas y lo que tienes por
 * decidir. Una sección sin nada no sale: un Inicio con cajas vacías parece una
 * app rota.
 *
 * «Seguir escuchando» son atajos (la rejilla de arriba, como en Spotify) y
 * puede repetir lo de debajo. Las estanterías de debajo no se repiten entre
 * sí: con una biblioteca pequeña, la de las primeras semanas, el bloque de
 * ahora y «Tus paisajes» enseñarían las mismas dos canciones.
 */

import { DIAS_BORRADOR, versionQueSuena } from '../biblioteca';
import type { Artista, Cancion, Momento, Version } from '../tipos';

const DIA_MS = 24 * 60 * 60 * 1000;

export type Franja = 'manana' | 'tarde' | 'noche';

/**
 * Mañana de 6:00 a 13:59, tarde de 14:00 a 20:59 y noche de 21:00 a 5:59:
 * las horas de España, donde la tarde llega hasta la cena.
 */
export function franjaDe(fecha: Date): Franja {
  const h = fecha.getHours();
  if (h >= 6 && h < 14) return 'manana';
  if (h >= 14 && h < 21) return 'tarde';
  return 'noche';
}

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/**
 * El día al que pertenece este momento. La madrugada es todavía la noche de
 * ayer: a las dos de la mañana del viernes nadie dice «mi viernes por la
 * noche», dice que sigue siendo jueves.
 */
export function diaDeLaFranja(fecha: Date): string {
  const d = new Date(fecha.getTime());
  if (d.getHours() < 6) d.setDate(d.getDate() - 1);
  return DIAS[d.getDay()];
}

/** «Tu jueves por la tarde», como el nombre de una daylist. */
export function nombreDelBloque(fecha: Date): string {
  const franja = franjaDe(fecha);
  const parte = franja === 'manana' ? 'por la mañana' : franja === 'tarde' ? 'por la tarde' : 'por la noche';
  return `Tu ${diaDeLaFranja(fecha)} ${parte}`;
}

/** El saludo de arriba del Inicio. */
export function saludo(fecha: Date): string {
  const franja = franjaDe(fecha);
  return franja === 'manana' ? 'Buenos días' : franja === 'tarde' ? 'Buenas tardes' : 'Buenas noches';
}

/**
 * Qué pega con cada momento del día, de más a menos. Por la mañana lo de
 * arrancar; por la noche lo de dormir (plan, parte 3.1).
 */
export const MOMENTOS_DE_FRANJA: Record<Franja, readonly Momento[]> = {
  manana: ['correr', 'concentrarme'],
  tarde: ['concentrarme', 'desconectar', 'para-alguien'],
  noche: ['dormir', 'desconectar'],
};

const TEXTO_MOMENTO: Record<Momento, string> = {
  concentrarme: 'Para concentrarte',
  dormir: 'Para dormir',
  desconectar: 'Para desconectar',
  correr: 'Para correr',
  'para-alguien': 'Para alguien',
  sorprendeme: 'Sorpresa',
};

/** «Para dormir», «Para concentrarte»… lo que se dice de un momento. */
export function textoMomento(momento: Momento): string {
  return TEXTO_MOMENTO[momento];
}

/** «hoy», «ayer», «hace 3 días», «hace 2 semanas». */
export function haceCuanto(cuando: number, ahora: number): string {
  const hoy = new Date(ahora);
  hoy.setHours(0, 0, 0, 0);
  const aquel = new Date(cuando);
  aquel.setHours(0, 0, 0, 0);
  const dias = Math.round((hoy.getTime() - aquel.getTime()) / DIA_MS);
  if (dias <= 0) return 'hoy';
  if (dias === 1) return 'ayer';
  if (dias < 14) return `hace ${dias} días`;
  if (dias < 60) return `hace ${Math.floor(dias / 7)} semanas`;
  return `hace ${Math.floor(dias / 30)} meses`;
}

/* ── Las secciones ─────────────────────────────────────────────────────── */

export type IdSeccion = 'seguir' | 'franja' | 'paisajes' | 'artistas' | 'decidir';

export interface SeccionInicio {
  id: IdSeccion;
  titulo: string;
  /** Una línea debajo del título, si dice algo. */
  linea?: string;
  /** Las canciones de la sección, en orden (todas menos «Tus artistas»). */
  cancionIds: string[];
  /** Los artistas (solo «Tus artistas»). */
  artistaIds: string[];
}

export const TOPES = { seguir: 6, franja: 8, paisajes: 10, artistas: 10, decidir: 5 } as const;

/** El momento para el que se hizo una canción: el de la versión que suena, o el de la última que lo diga. */
export function momentoDe(cancion: Cancion, versiones: Version[]): Momento | undefined {
  const suena = versionQueSuena(cancion, versiones);
  if (suena?.receta.momento) return suena.receta.momento;
  const suyas = versiones.filter((v) => v.cancionId === cancion.id && v.receta.momento).sort((a, b) => b.n - a.n);
  return suyas[0]?.receta.momento;
}

function reciente(c: Cancion): number {
  return c.ultimaEscucha ?? c.actualizadaEn;
}

export function seccionesDelInicio(datos: {
  canciones: Cancion[];
  versiones: Version[];
  artistas: Artista[];
  ahora: number;
}): SeccionInicio[] {
  const { canciones, versiones, artistas, ahora } = datos;
  const fecha = new Date(ahora);
  const franja = franjaDe(fecha);
  const guardadas = canciones.filter((c) => c.guardada);
  const usadas = new Set<string>();
  const secciones: SeccionInicio[] = [];
  const tomar = (lista: Cancion[], tope: number) => {
    const ids = lista.filter((c) => !usadas.has(c.id)).slice(0, tope).map((c) => c.id);
    for (const id of ids) usadas.add(id);
    return ids;
  };

  // 1. Seguir escuchando: lo último que sonó. Son atajos: no apartan nada de lo de debajo.
  const seguir = guardadas
    .filter((c) => c.ultimaEscucha !== undefined)
    .sort((a, b) => (b.ultimaEscucha ?? 0) - (a.ultimaEscucha ?? 0))
    .slice(0, TOPES.seguir)
    .map((c) => c.id);
  if (seguir.length) secciones.push({ id: 'seguir', titulo: 'Seguir escuchando', cancionIds: seguir, artistaIds: [] });

  // 2. El bloque de ahora: lo hecho para este momento y lo que sueles poner a esta hora.
  const preferidos = MOMENTOS_DE_FRANJA[franja];
  const puntuadas = guardadas
    .map((c) => {
      const momento = momentoDe(c, versiones);
      const porMomento = momento ? preferidos.indexOf(momento) : -1;
      const aEstaHora = c.ultimaEscucha !== undefined && franjaDe(new Date(c.ultimaEscucha)) === franja;
      // El momento pesa más que la costumbre, y el primero de la franja más que el segundo.
      const puntos = (porMomento >= 0 ? 4 - porMomento : 0) + (aEstaHora ? 1 : 0);
      return { c, momento: porMomento >= 0 ? momento : undefined, puntos };
    })
    .filter((p) => p.puntos > 0)
    .sort((a, b) => b.puntos - a.puntos || reciente(b.c) - reciente(a.c));
  const franjaIds = tomar(
    puntuadas.map((p) => p.c),
    TOPES.franja,
  );
  if (franjaIds.length) {
    const momentos = preferidos.filter((m) => puntuadas.some((p) => p.momento === m && franjaIds.includes(p.c.id)));
    secciones.push({
      id: 'franja',
      titulo: nombreDelBloque(fecha),
      linea: momentos.length ? lineaDeMomentos(momentos) : 'Lo que sueles poner a esta hora',
      cancionIds: franjaIds,
      artistaIds: [],
    });
  }

  // 3. Tus paisajes.
  const paisajes = tomar(
    guardadas.filter((c) => c.tipo === 'paisaje').sort((a, b) => reciente(b) - reciente(a)),
    TOPES.paisajes,
  );
  if (paisajes.length) secciones.push({ id: 'paisajes', titulo: 'Tus paisajes', cancionIds: paisajes, artistaIds: [] });

  // 4. Tus artistas: primero los que más se han movido (una canción suya nueva o escuchada).
  const actividad = new Map<string, number>();
  for (const c of canciones) {
    if (!c.artistaId) continue;
    actividad.set(c.artistaId, Math.max(actividad.get(c.artistaId) ?? 0, reciente(c)));
  }
  const artistaIds = [...artistas]
    .sort(
      (a, b) =>
        Math.max(actividad.get(b.id) ?? 0, b.actualizadoEn) - Math.max(actividad.get(a.id) ?? 0, a.actualizadoEn),
    )
    .slice(0, TOPES.artistas)
    .map((a) => a.id);
  if (artistaIds.length) secciones.push({ id: 'artistas', titulo: 'Tus artistas', cancionIds: [], artistaIds });

  // 5. Por decidir: los borradores que aún no te has quedado (y que no van a limpiarse ya).
  const decidir = tomar(
    canciones
      .filter((c) => !c.guardada && ahora - c.actualizadaEn <= DIAS_BORRADOR * DIA_MS)
      .sort((a, b) => b.actualizadaEn - a.actualizadaEn),
    TOPES.decidir,
  );
  if (decidir.length) {
    secciones.push({
      id: 'decidir',
      titulo: 'Por decidir',
      linea: 'Lo que aún no te has quedado',
      cancionIds: decidir,
      artistaIds: [],
    });
  }

  return secciones;
}

/** «Para dormir y desconectar», «Para concentrarte, desconectar y para alguien». */
function lineaDeMomentos(momentos: readonly Momento[]): string {
  const textos = momentos.map((m, i) => {
    if (i === 0) return textoMomento(m);
    return m === 'para-alguien' ? 'para alguien' : textoMomento(m).replace(/^Para /, '').toLowerCase();
  });
  if (textos.length === 1) return textos[0];
  return `${textos.slice(0, -1).join(', ')} y ${textos[textos.length - 1]}`;
}
