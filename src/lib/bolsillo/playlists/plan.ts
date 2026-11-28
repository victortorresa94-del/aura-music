/**
 * El plan de una playlist con canciones nuevas (plan, parte 3.5), puro.
 *
 * Como la skill de playlists de MiniMax (MIT): UNA pregunta (el momento), y
 * antes de gastar se enseña el plan con dos líneas por canción (título y por
 * qué está) y el precio total en el botón. Como Prompted Playlist de Spotify:
 * cada canción dice por qué está.
 *
 * Las canciones del plan son variadas y siguen un arco de energía: empiezan a
 * media altura, suben y se asientan. Para dormir, solo bajan. El tempo sale
 * de esa energía, dentro del rango del momento o del artista.
 *
 * Por defecto son 8 (4, 8 o 12): menos que las 30 de Discover Weekly, porque
 * aquí cada una se paga y se escucha entera. Nada de «generar 10 más».
 *
 * Todo es determinista: la misma petición da el mismo plan (lo que enseña la
 * pantalla es lo que se genera). Para que cada renovación de una playlist
 * viva traiga algo distinto se pasa una `semilla` nueva.
 */

import { semillaDe } from '../biblioteca';
import { creditosDeReceta } from '../precios';
import type { Artista, Momento, MotorId, Receta } from '../tipos';
import { imitaA, recetaDeArtista, soloReceta } from '../artistas/adn';

export const TAMANOS = [4, 8, 12] as const;
export const TAMANO_POR_DEFECTO = 8;
export const MAX_CANCIONES_PLAN = 12;
export const DURACION_CANCION_SEG = 150;

export const ETIQUETA_MOMENTO: Record<Momento, string> = {
  concentrarme: 'Concentrarme',
  dormir: 'Dormir',
  desconectar: 'Desconectar',
  correr: 'Correr',
  'para-alguien': 'Para alguien',
  sorprendeme: 'Sorpréndeme',
};

/** «para …»: cómo se nombra el momento dentro de una frase. */
const PARA_MOMENTO: Record<Momento, string> = {
  concentrarme: 'concentrarte',
  dormir: 'dormir',
  desconectar: 'desconectar',
  correr: 'correr',
  'para-alguien': 'dedicar',
  sorprendeme: 'sorprenderte',
};

const NOMBRE_POR_DEFECTO: Record<Momento, string> = {
  concentrarme: 'Para concentrarte',
  dormir: 'Para dormir',
  desconectar: 'Para desconectar',
  correr: 'Para correr',
  'para-alguien': 'Para alguien',
  sorprendeme: 'Para sorprenderte',
};

const FRASE_POR_DEFECTO: Record<Momento, string> = {
  concentrarme: 'Música para concentrarme',
  dormir: 'Música para dormir',
  desconectar: 'Música para desconectar',
  correr: 'Música para correr',
  'para-alguien': 'Una canción para alguien',
  sorprendeme: 'Sorpréndeme',
};

/** El arco: dónde empieza, a dónde sube y dónde se asienta (0 = calma, 1 = todo). */
const ARCO: Record<Momento, { inicio: number; pico: number; final: number }> = {
  concentrarme: { inicio: 0.45, pico: 0.62, final: 0.5 },
  dormir: { inicio: 0.4, pico: 0.4, final: 0.1 },
  desconectar: { inicio: 0.45, pico: 0.6, final: 0.35 },
  correr: { inicio: 0.6, pico: 0.95, final: 0.7 },
  'para-alguien': { inicio: 0.5, pico: 0.85, final: 0.55 },
  sorprendeme: { inicio: 0.5, pico: 0.85, final: 0.55 },
};

/** El tempo de cada momento cuando no lo decide un artista: de la calma al máximo. */
const BPM: Record<Momento, { min: number; max: number }> = {
  concentrarme: { min: 70, max: 100 },
  dormir: { min: 55, max: 72 },
  desconectar: { min: 65, max: 95 },
  correr: { min: 145, max: 172 },
  'para-alguien': { min: 80, max: 124 },
  sorprendeme: { min: 75, max: 128 },
};

/** ¿Canta? Lo de concentrarse, dormir y desconectar, por defecto sin voz. */
const CON_VOZ: Record<Momento, boolean | 'alterna'> = {
  concentrarme: false,
  dormir: false,
  desconectar: false,
  correr: true,
  'para-alguien': true,
  sorprendeme: 'alterna',
};

/** Cómo suena cada una cuando no hay artista: lo que hace que no sean ocho iguales. */
const TEXTURAS: Record<Momento, string[]> = {
  concentrarme: [
    'piano suave y un pad cálido',
    'guitarra limpia y un pulso de sintetizador',
    'rhodes y una percusión muy discreta',
    'cuerdas lentas y un bajo redondo',
    'marimba suave y un fondo de ambiente',
    'sintetizadores cálidos sin sobresaltos',
    'arpa y un pad que respira',
    'piano eléctrico y un ritmo constante',
  ],
  dormir: [
    'piano muy lento y mucho aire',
    'pad cálido y cuerdas lejanas',
    'guitarra acústica casi susurrada',
    'celesta y un ruido suave de fondo',
    'arpa lenta y graves blandos',
    'un sintetizador tenue que no cambia de golpe',
    'cuerdas muy lentas y nada de percusión',
    'piano lejano y un pad que se apaga',
  ],
  desconectar: [
    'guitarra acústica y un ritmo de mecedora',
    'lo-fi con piano y crujido de vinilo',
    'bossa tranquila con guitarra',
    'rhodes y un bajo cálido',
    'ambiente con sonido de agua',
    'trompeta suave y escobillas',
    'ukelele y palmas suaves',
    'pad cálido y una melodía sencilla',
  ],
  correr: [
    'electrónica con un bombo firme',
    'pop con guitarras y mucha energía',
    'funk con un bajo que empuja',
    'house con piano',
    'rock ligero con la batería abierta',
    'drum and bass suave',
    'synth pop brillante',
    'percusión latina y bajo',
  ],
  'para-alguien': [
    'pop acústico con guitarra',
    'rumba con palmas',
    'balada de piano',
    'soul con coros',
    'guitarra y voz, muy cercana',
    'pop luminoso con cuerdas',
    'folk con armónica',
    'swing con piano',
  ],
  sorprendeme: [
    'bossa con un giro electrónico',
    'cumbia lenta con sintetizadores',
    'jazz con ritmo de hip hop',
    'flamenco con pads de ambiente',
    'pop de los ochenta con cajón',
    'ambiente con guitarra española',
    'funk con cuerdas',
    'reggae con piano',
  ],
};

const TITULOS: Record<Momento, string[]> = {
  concentrarme: [
    'Mesa limpia', 'Una cosa cada vez', 'Café a media mañana', 'Lápiz y papel', 'Sin notificaciones',
    'Ventana abierta', 'Hilo fino', 'La lista en orden', 'Ritmo de biblioteca', 'Lo que queda por hacer',
    'Cinco minutos más', 'Luz de flexo', 'Tarde larga', 'Página en blanco',
  ],
  dormir: [
    'Luz apagada', 'Sábanas frías', 'Respira despacio', 'La casa duerme', 'Persiana bajada', 'Última vuelta',
    'Nada que hacer', 'Almohada', 'Lejos del ruido', 'Hasta mañana', 'Noche quieta', 'Ojos cerrados',
    'Lluvia en el tejado', 'Silencio de casa',
  ],
  desconectar: [
    'Domingo sin planes', 'Terraza a las siete', 'Pies descalzos', 'El móvil en el cajón', 'Té en la ventana',
    'Paseo largo', 'Sofá y manta', 'Tarde de nada', 'Agua quieta', 'Sin reloj', 'Sombra de pino',
    'Vuelta a casa', 'Hamaca', 'Ropa tendida',
  ],
  correr: [
    'Primer kilómetro', 'Zancada', 'Cuesta arriba', 'El parque a las ocho', 'Segundo aire', 'Ritmo de calle',
    'Sin parar', 'Meta a la vista', 'Último esprint', 'Paso firme', 'Asfalto', 'Viento de cara',
    'Vuelta al río', 'Pulso alto',
  ],
  'para-alguien': [
    'Para ti', 'La de los dos', 'Te acuerdas', 'Cena en casa', 'Mesa larga', 'Brindis', 'Desde el principio',
    'Tu risa', 'Volver a verte', 'La foto de la nevera', 'Sobremesa', 'Cumpleaños', 'Abrazo largo', 'Hasta luego',
  ],
  sorprendeme: [
    'Giro inesperado', 'Por si acaso', 'Otra cosa', 'Mapa al revés', 'Tecla nueva', 'Puerta lateral',
    'Ni idea', 'Esquina', 'Ruta corta', 'Cosa rara', 'Chispa', 'Lo que salga', 'De repente', 'Media vuelta',
  ],
};

/** Con un artista, el matiz de cada canción sale de su energía. */
function matiz(energia: number): string {
  if (energia < 0.3) return 'lenta y con mucho aire';
  if (energia < 0.5) return 'tranquila, con un pulso suave';
  if (energia < 0.7) return 'a media altura';
  if (energia < 0.85) return 'con más pulso';
  return 'con toda la energía';
}

export interface EntradaPlan {
  titulo: string;
  /** Por qué está, en una frase (la segunda línea de la canción). */
  porque: string;
  receta: Receta;
}

export interface PlanDePlaylist {
  momento: Momento;
  /** La frase de quien pide, tal cual (puede ir vacía). */
  frase: string;
  nombre: string;
  porque: string;
  artistaId?: string;
  entradas: EntradaPlan[];
  /** Lo que cuesta todo el plan. Es lo que dice el botón. */
  total: number;
  /** Si la frase pide parecerse a alguien real, a quién. Con esto no se genera. */
  imitacion: string | null;
}

export interface PeticionPlan {
  momento: Momento;
  frase?: string;
  /** Cuántas canciones: 4, 8 o 12 en la pantalla (una renovación puede pedir 1). */
  n?: number;
  artistaId?: string;
  /** El artista entero: su ADN decide estilo, voz, idioma y tempo. */
  artista?: Pick<Artista, 'id' | 'nombre' | 'adn'>;
  motor?: MotorId;
  /** Para variar: cada renovación de una playlist viva pasa una distinta. */
  semilla?: string;
  /** Títulos que ya están en la playlist, para no repetirlos. */
  evitarTitulos?: string[];
  /** Una renovación de una playlist viva: «La de hoy», «La de esta semana». */
  renovacion?: 'dia' | 'semana';
}

const limpia = (s: string | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();
const redondea = (x: number) => Math.round(x * 100) / 100;

function azar(semilla: number) {
  let s = semilla >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

/** Baraja determinista (Fisher-Yates con la semilla). */
function barajar<T>(lista: readonly T[], r: () => number): T[] {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

/** Cuántas canciones: entre 1 y 12; si no se dice, 8. */
export function tamanoDePlan(n?: number): number {
  if (n === undefined || !Number.isFinite(n)) return TAMANO_POR_DEFECTO;
  return Math.max(1, Math.min(MAX_CANCIONES_PLAN, Math.round(n)));
}

/**
 * La energía de cada canción. Empieza a media altura, sube hasta el pico (a
 * un 60 % de la lista) y se asienta. Para dormir, solo baja.
 */
export function arcoDeEnergia(momento: Momento, n: number): number[] {
  const { inicio, pico, final } = ARCO[momento];
  const total = Math.max(1, Math.round(n));
  return Array.from({ length: total }, (_, i) => {
    const t = total === 1 ? 0 : i / (total - 1);
    if (momento === 'dormir') return redondea(inicio + (final - inicio) * t);
    const e = t <= 0.6 ? inicio + (pico - inicio) * (t / 0.6) : pico + (final - pico) * ((t - 0.6) / 0.4);
    return redondea(e);
  });
}

function rolEnElArco(momento: Momento, energias: number[], i: number): string {
  const n = energias.length;
  if (momento === 'dormir') {
    if (i === 0) return 'Para empezar a soltar';
    if (i === n - 1) return 'Para apagar la luz';
    return i < n / 2 ? 'Más despacio' : 'Más despacio todavía';
  }
  if (n === 1) return 'A media altura';
  if (i === 0) return 'Para empezar a media altura';
  if (i === n - 1) return 'Para cerrar con calma';
  const pico = energias.indexOf(Math.max(...energias));
  if (i === pico) return 'El momento con más pulso';
  return i < pico ? 'Sube un punto' : 'Baja un poco';
}

function conVozPorDefecto(momento: Momento, frase: string, i: number): boolean {
  if (/\b(sin voz|sin letra|instrumental)\b/i.test(frase)) return false;
  if (/\b(con voz|con letra|que cante|cantada)\b/i.test(frase)) return true;
  const v = CON_VOZ[momento];
  return v === 'alterna' ? i % 2 === 1 : v;
}

function nombreDePlan(peticion: PeticionPlan, frase: string): string {
  if (frase) {
    const corta = frase.length > 40 ? `${frase.slice(0, 40).replace(/\s+\S*$/, '')}…` : frase;
    return corta.charAt(0).toUpperCase() + corta.slice(1);
  }
  if (peticion.artista) return `${peticion.artista.nombre}, ${NOMBRE_POR_DEFECTO[peticion.momento].toLowerCase()}`;
  return NOMBRE_POR_DEFECTO[peticion.momento];
}

function porqueDePlan(momento: Momento, n: number, artista?: Pick<Artista, 'nombre'>): string {
  const cuantas = n === 1 ? 'Una canción nueva' : `${n} canciones nuevas`;
  const de = artista ? ` de ${artista.nombre}` : '';
  if (momento === 'dormir') return `${cuantas}${de} para dormir, cada una más lenta que la anterior.`;
  if (n === 1) return `${cuantas}${de} para ${PARA_MOMENTO[momento]}.`;
  return `${cuantas}${de} para ${PARA_MOMENTO[momento]}: empiezan a media altura, suben y se asientan.`;
}

/** Títulos sin repetir los de la playlist; si se acaban, el mismo con «II», «III». */
function titulos(momento: Momento, n: number, r: () => number, evitar: ReadonlySet<string>): string[] {
  const base = barajar(TITULOS[momento], r);
  const libres = base.filter((t) => !evitar.has(t.toLowerCase()));
  const salida: string[] = [];
  const usados = new Set(evitar);
  const romanos = ['II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
  for (let i = 0; i < n; i++) {
    let t = libres[i] ?? '';
    if (!t) {
      const raiz = base[i % base.length];
      t = romanos.map((rom) => `${raiz} ${rom}`).find((c) => !usados.has(c.toLowerCase())) ?? `${raiz} ${i + 1}`;
    }
    usados.add(t.toLowerCase());
    salida.push(t);
  }
  return salida;
}

/**
 * El plan de una playlist: N canciones variadas, cada una con su título, su
 * porqué y su receta, y el total de créditos. No genera nada.
 */
export function planDePlaylist(peticion: PeticionPlan): PlanDePlaylist {
  const momento = peticion.momento;
  const frase = limpia(peticion.frase);
  const n = tamanoDePlan(peticion.n);
  const motor: MotorId = peticion.motor ?? 'lyria3';
  const artista = peticion.artista;
  const artistaId = artista?.id ?? peticion.artistaId;
  const r = azar(semillaDe(`plan:${momento}:${frase.toLowerCase()}:${artistaId ?? ''}:${peticion.semilla ?? ''}`));

  // Una renovación de una sola canción no tiene arco: cada vez, una energía distinta.
  const energias = peticion.renovacion
    ? Array.from({ length: n }, () => redondea(0.3 + r() * 0.5))
    : arcoDeEnergia(momento, n);
  const texturas = barajar(TEXTURAS[momento], r);
  const losTitulos = titulos(momento, n, r, new Set((peticion.evitarTitulos ?? []).map((t) => t.toLowerCase())));
  const rango = BPM[momento];

  const entradas: EntradaPlan[] = energias.map((energia, i) => {
    let receta: Receta;
    let como: string;
    if (artista) {
      const deArtista = soloReceta(recetaDeArtista(artista, { frase: frase || undefined, energia }));
      receta = {
        tipo: 'cancion',
        momento,
        duracionSeg: DURACION_CANCION_SEG,
        motor,
        ...deArtista,
        bpm: deArtista.bpm ?? Math.round(rango.min + (rango.max - rango.min) * energia),
      };
      como = matiz(energia);
    } else {
      const textura = texturas[i % texturas.length];
      const conVoz = conVozPorDefecto(momento, frase, i);
      receta = {
        tipo: 'cancion',
        momento,
        frase: frase || FRASE_POR_DEFECTO[momento],
        estilo: textura,
        conVoz,
        duracionSeg: DURACION_CANCION_SEG,
        bpm: Math.round(rango.min + (rango.max - rango.min) * energia),
        energia,
        motor,
        ...(conVoz ? { idioma: 'es' } : {}),
        ...(artistaId ? { artistaId } : {}),
      };
      como = `con ${textura}${conVoz ? ' y voz' : ''}`;
    }
    const rol = peticion.renovacion
      ? peticion.renovacion === 'dia'
        ? 'La de hoy'
        : 'La de esta semana'
      : rolEnElArco(momento, energias, i);
    return { titulo: losTitulos[i], porque: `${rol}, ${como}.`, receta };
  });

  return {
    momento,
    frase,
    nombre: nombreDePlan(peticion, frase),
    porque: porqueDePlan(momento, n, artista),
    ...(artistaId ? { artistaId } : {}),
    entradas,
    total: entradas.reduce((suma, e) => suma + creditosDeReceta(e.receta), 0),
    imitacion: imitaA(frase),
  };
}

/** Lo que cuesta generar las entradas que faltan de un plan. */
export function creditosDeEntradas(entradas: readonly EntradaPlan[]): number {
  return entradas.reduce((suma, e) => suma + creditosDeReceta(e.receta), 0);
}
