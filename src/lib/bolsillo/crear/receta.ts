/**
 * De la receta a medias a la receta entera, y de la receta a lo que se le
 * dice al modelo (en INGLÉS) y a lo que se le enseña a la persona (en
 * castellano, una frase, ANTES de gastar).
 *
 * La descripción sigue las dimensiones de la guía de escritura de ACE-Step
 * (`ace-step/acestep-songwriting`, MIT): género, ánimo, instrumentos, textura,
 * producción, tempo y voz, sin contradicciones entre ellas. Un paisaje se pide
 * estable y sin principio ni final: lo alarga el móvil (plan, 3.6).
 *
 * Nada de salud ni de artistas reales llega al modelo: la frase va sin
 * palabras de salud (`sinDatosDeSalud`) y una imitación no llega a la receta.
 */

import { pareceImitacion } from '../reglas';
import type { Artista, Momento, MotorId, Receta } from '../tipos';
import { enLista, normalizar, PALABRAS_DE_ESTILO, sinDatosDeSalud, type RecetaParcial } from './interpretar';

export const DURACION_CANCION = 150;
/** «Hasta que la pare»: el reproductor la repite hasta el temporizador o hasta pararla. */
export const DURACION_SIN_FIN = 8 * 3600;

interface PorMomento {
  bpm?: number;
  energia: number;
  estilo?: string;
  /** Si el momento ya dice si lleva voz (dormir y concentrarse, sin; para alguien, con). */
  conVoz?: boolean;
  generoEn?: string;
  animoEn: string;
  instrumentosEn?: string;
}

export const POR_MOMENTO: Record<Momento, PorMomento> = {
  concentrarme: {
    bpm: 80, energia: 0.35, estilo: 'lo-fi tranquilo con piano', conVoz: false,
    generoEn: 'lo-fi instrumental', animoEn: 'focused, steady, unobtrusive', instrumentosEn: 'mellow electric piano, soft brushed drums, warm bass',
  },
  dormir: {
    bpm: 60, energia: 0.1, estilo: 'piano suave y pad cálido', conVoz: false,
    generoEn: 'ambient lullaby', animoEn: 'sleepy, soothing, tender', instrumentosEn: 'soft felt piano, warm pad, gentle strings',
  },
  desconectar: {
    bpm: 70, energia: 0.2, estilo: 'piano y pad cálido',
    generoEn: 'calm ambient', animoEn: 'calm, gentle, unhurried', instrumentosEn: 'soft piano, warm pad',
  },
  correr: {
    bpm: 160, energia: 0.85, estilo: 'electrónica con pulso firme',
    generoEn: 'upbeat electronic', animoEn: 'driving, upbeat, motivating', instrumentosEn: 'punchy drums, synth bass, bright synths',
  },
  'para-alguien': {
    bpm: 100, energia: 0.6, estilo: 'pop acústico', conVoz: true,
    generoEn: 'acoustic pop', animoEn: 'warm, heartfelt, celebratory', instrumentosEn: 'acoustic guitar, piano, light percussion',
  },
  sorprendeme: { energia: 0.5, animoEn: 'characterful and surprising' },
};

/** Más de tres palabras o varias líneas: es una letra de verdad (la canta MiniMax). Si no, es un nombre que tiene que salir. */
export function esLetraLiteral(letra: string | undefined): boolean {
  const l = letra?.trim();
  if (!l) return false;
  return /\n/.test(l) || l.split(/\s+/).length > 3;
}

/** El tipo que va a salir con lo que se sabe: capas o más de 5 min, paisaje. */
export function tipoProbable(p: RecetaParcial): Receta['tipo'] | undefined {
  if (p.tipo) return p.tipo;
  if (p.capas && Object.keys(p.capas).length) return 'paisaje';
  if (p.duracionSeg !== undefined) return p.duracionSeg > 300 ? 'paisaje' : 'cancion';
  return undefined;
}

/** Con voz o sin voz, con lo que se sabe (lo dicho, el artista, el momento). Sin decidir aún: undefined. */
export function vozProbable(p: RecetaParcial): boolean | undefined {
  if (tipoProbable(p) === 'paisaje') return false;
  if (p.conVoz !== undefined) return p.conVoz;
  if (p.momento) return POR_MOMENTO[p.momento].conVoz;
  return undefined;
}

export interface OpcionesReceta {
  motor: MotorId;
  /** El texto con el que se pidió (las frases de la persona). */
  frase: string;
  artista?: Artista;
}

/** La receta entera: lo que no se dijo sale del momento, del artista o del sentido común. */
export function completarReceta(p: RecetaParcial, o: OpcionesReceta): Receta {
  const base = p.momento ? POR_MOMENTO[p.momento] : undefined;
  const adn = o.artista?.adn;
  const tipo = tipoProbable(p) ?? 'cancion';
  const conVoz = tipo === 'paisaje' ? false : (vozProbable(p) ?? (adn ? !!adn.voz.trim() : false));
  const tempoArtista = adn?.tempo ? Math.round((adn.tempo.min + adn.tempo.max) / 2) : undefined;
  const estilo = [p.estilo ?? (adn ? [adn.estilo, enLista(adn.instrumentos)].filter(Boolean).join(', ') : undefined) ?? (p.sorpresa ? undefined : base?.estilo), p.parecido ? `suena ${p.parecido}` : undefined]
    .filter(Boolean)
    .join(', ');
  const capas = tipo === 'paisaje' && p.capas && Object.keys(p.capas).length ? p.capas : undefined;
  const duracionSeg = tipo === 'paisaje'
    ? Math.max(DURACION_CANCION, p.duracionSeg ?? 3600)
    : Math.max(30, Math.min(180, p.duracionSeg ?? DURACION_CANCION));
  const letra = conVoz ? p.letra?.trim() || undefined : undefined;
  return {
    tipo,
    ...(p.momento ? { momento: p.momento } : {}),
    frase: o.frase.trim(),
    ...(estilo ? { estilo } : {}),
    conVoz,
    ...(conVoz ? { idioma: p.idioma ?? adn?.idioma ?? 'es' } : {}),
    ...(letra ? { letra } : {}),
    duracionSeg,
    ...((p.bpm ?? tempoArtista ?? base?.bpm) ? { bpm: p.bpm ?? tempoArtista ?? base?.bpm } : {}),
    energia: p.energia ?? base?.energia ?? 0.5,
    ...(p.artistaId ?? o.artista?.id ? { artistaId: p.artistaId ?? o.artista?.id } : {}),
    ...(capas ? { capas } : {}),
    motor: o.motor,
  };
}

/* ── Para el modelo, en inglés ───────────────────────────────────────── */

const IDIOMA_EN: Record<string, string> = {
  es: 'Spanish from Spain', en: 'English', ca: 'Catalan', fr: 'French', it: 'Italian', pt: 'Portuguese',
  eu: 'Basque', gl: 'Galician', de: 'German',
};

function estiloEnIngles(estilo: string | undefined): string[] {
  if (!estilo) return [];
  const n = normalizar(estilo);
  return [...new Set(PALABRAS_DE_ESTILO.filter((p) => p.clave.test(n)).map((p) => p.en))];
}

function tempoEn(bpm: number | undefined, energia: number): string {
  const palabra = energia < 0.3 ? 'slow and relaxed' : energia < 0.6 ? 'moderate' : 'energetic';
  return bpm ? `around ${bpm} BPM, ${palabra}` : palabra;
}

/**
 * La frase de la persona tal cual (los modelos la entienden en castellano),
 * sin salud, sin artistas y sin lo que hace el móvil (Hz, ruido, duración):
 * un modelo que lee «142 Hz» mete un zumbido que nadie ha pedido.
 */
export function fraseParaElModelo(frase: string): string {
  let s = sinDatosDeSalud(frase);
  s = s
    .replace(/[^,.;·]*\b\d+(?:[.,]\d+)?\s*(?:hz|hercios|herzios|herz)\b[^,.;·]*/giu, '')
    .replace(/[^,.;·]*\b(?:binaural\w*|ruido(?:\s+\p{L}+)?|isocr[oó]nic\w*)\b[^,.;·]*/giu, '')
    .replace(/[^,.;·]*\b(?:\d+|una?|dos|tres|media|veinte|treinta|cuarenta|diez|quince)\s*(?:horas?|minutos?|mins?|h)\b[^,.;·]*/giu, '')
    .replace(/[^,.;·]*\b(?:toda la noche|hasta que la pare)\b[^,.;·]*/giu, '');
  if (pareceImitacion(s)) return '';
  return s
    .replace(/\s*[,;·]\s*(?=[,;·]|$)/g, '')
    .replace(/^[\s,;·]+/, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function descripcionEnIngles(r: Receta, extra: { paraQuien?: string; artista?: Artista } = {}): string {
  const base = r.momento ? POR_MOMENTO[r.momento] : undefined;
  const estiloEn = estiloEnIngles(r.estilo);
  const generos = estiloEn.filter((e) => !/piano|guitar|violin|cello|strings|synthesizer|pad|choir|flute|saxophone|trumpet|drums|percussion|handclaps|cajón|ukulele|harp|organ/.test(e));
  const instrumentos = estiloEn.filter((e) => !generos.includes(e));
  const genero = generos.length ? generos.join(' and ') : base?.generoEn ?? (r.tipo === 'paisaje' ? 'ambient' : 'contemporary');
  const animo = r.energia !== undefined && r.energia >= 0.7 && base && !/energetic|upbeat/.test(base.animoEn)
    ? `${base.animoEn}, energetic`
    : base?.animoEn ?? (r.energia !== undefined && r.energia < 0.3 ? 'calm, gentle' : 'warm, expressive');
  const partes: string[] = [];
  partes.push(`${genero.charAt(0).toUpperCase()}${genero.slice(1)} ${r.tipo === 'paisaje' ? 'soundscape' : 'song'}.`);
  partes.push(`Mood: ${animo}.`);
  partes.push(`Instruments: ${instrumentos.length ? instrumentos.join(', ') : base?.instrumentosEn ?? 'chosen to fit the mood'}.`);
  partes.push(`Texture: ${(r.energia ?? 0.5) < 0.4 ? 'soft, warm, intimate, airy' : 'clear, warm, full'}.`);
  partes.push(`Production: clean modern mix${(r.energia ?? 0.5) < 0.4 ? ', gentle dynamics, no harsh peaks' : ', punchy but balanced'}.`);
  partes.push(`Tempo: ${tempoEn(r.bpm, r.energia ?? 0.5)}.`);

  if (r.tipo === 'paisaje') {
    partes.push(
      'Steady, seamless and loopable: no intro, no ending, no build-ups or drops, consistent energy from start to finish, no vocals, no strong percussion.',
    );
  } else if (r.conVoz) {
    partes.push(`Vocals: warm lead vocal singing in ${IDIOMA_EN[r.idioma ?? 'es'] ?? 'Spanish from Spain'}, clear diction.`);
    partes.push('Structure: verse and chorus, with a short intro and a clean ending.');
    if (r.letra && !esLetraLiteral(r.letra)) partes.push(`The lyrics must mention the name "${r.letra}".`);
  } else {
    partes.push('Instrumental, no vocals.');
  }
  const adn = extra.artista?.adn;
  if (adn) {
    if (adn.voz.trim() && r.conVoz) partes.push(`Vocal character (described): ${adn.voz}.`);
    if (adn.temas?.trim()) partes.push(`Themes (in Spanish): ${adn.temas}.`);
    if (adn.nunca?.trim()) partes.push(`Keep away from (in Spanish): ${adn.nunca}.`);
  }
  if (extra.paraQuien && r.tipo !== 'paisaje') partes.push(`It is a song dedicated to someone (in Spanish): "para ${extra.paraQuien}".`);
  const frase = fraseParaElModelo(r.frase);
  if (frase) partes.push(`The listener asked, in Spanish: "${frase}".`);
  return partes.join(' ');
}

/* ── Para la persona, en castellano ──────────────────────────────────── */

/** «1 hora», «20 min», «hasta que la pares». */
export function duracionEnPalabras(segundos: number): string {
  if (segundos >= DURACION_SIN_FIN) return 'hasta que la pares';
  const h = Math.floor(segundos / 3600);
  const min = Math.round((segundos % 3600) / 60);
  if (h && min === 30) return `${h === 1 ? '1 hora' : `${h} horas`} y media`;
  if (h && min) return `${h} h ${min} min`;
  if (h) return h === 1 ? '1 hora' : `${h} horas`;
  if (segundos >= 60) return `${Math.round(segundos / 60)} min`;
  return `${Math.round(segundos)} s`;
}

const IDIOMA_ES: Record<string, string> = {
  es: 'en castellano', en: 'en inglés', ca: 'en catalán', fr: 'en francés', it: 'en italiano',
  pt: 'en portugués', eu: 'en euskera', gl: 'en gallego', de: 'en alemán',
};

function tempoEnPalabras(r: Pick<Receta, 'energia' | 'bpm'>): string | undefined {
  const e = r.energia ?? 0.5;
  if (e <= 0.25) return r.bpm && r.bpm <= 72 ? 'lenta' : 'tranquila';
  if (e >= 0.75) return 'con energía';
  return undefined;
}

function capasEnPalabras(r: Receta): string[] {
  const c = r.capas;
  if (!c) return [];
  const t: string[] = [];
  if (c.tono) t.push(`tono de ${c.tono.hz} Hz muy bajo`);
  if (c.binaural) t.push(`binaural a ${c.binaural.difHz} Hz (con auriculares)`);
  if (c.ruido) t.push(`ruido ${c.ruido.color === 'marron' ? 'marrón' : c.ruido.color} suave`);
  if (c.pulso) t.push('pulso suave');
  return t;
}

/** La receta en una frase, para enseñarla antes de gastar. Sin el precio: el precio va en el botón. */
export function resumenDe(r: Receta, extra: { paraQuien?: string } = {}): string {
  const cabeza = [r.tipo === 'paisaje' ? 'Paisaje' : 'Canción', tempoEnPalabras(r)].filter(Boolean).join(' ');
  const voz = r.conVoz ? `con voz ${IDIOMA_ES[r.idioma ?? 'es'] ?? ''}`.trim() : 'sin voz';
  const primera = [cabeza, voz, r.estilo].filter(Boolean).join(', ');
  const trozos = [primera];
  if (extra.paraQuien && r.tipo !== 'paisaje') trozos.push(`para ${extra.paraQuien}`);
  if (r.letra) trozos.push(esLetraLiteral(r.letra) ? 'canta tu letra' : `con el nombre de ${r.letra}`);
  if (r.tipo === 'paisaje') trozos.push(`${duracionEnPalabras(r.duracionSeg)} (se repite sin cortes)`);
  trozos.push(...capasEnPalabras(r));
  return trozos.join(' · ');
}

const FRANJAS = ['mañana', 'mediodía', 'tarde', 'noche'] as const;
type Franja = (typeof FRANJAS)[number];

function franjaDe(frase: string, ahora: number): Franja {
  const n = normalizar(frase);
  if (/\besta noche|por la noche|de noche\b/.test(n)) return 'noche';
  if (/\besta tarde|por la tarde|de tarde\b/.test(n)) return 'tarde';
  if (/\besta manana|por la manana\b/.test(n)) return 'mañana';
  const h = new Date(ahora).getHours();
  if (h >= 6 && h < 12) return 'mañana';
  if (h >= 12 && h < 15) return 'mediodía';
  if (h >= 15 && h < 21) return 'tarde';
  return 'noche';
}

const deLa = (f: Franja) => (f === 'mediodía' ? 'del mediodía' : `de la ${f}`);
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Un título que suena a ti, en castellano y sin etiquetas de salud. */
export function tituloDe(r: Receta, extra: { paraQuien?: string; ahora?: number; artista?: Artista } = {}): string {
  const franja = franjaDe(r.frase, extra.ahora ?? Date.now());
  const hz = r.capas?.tono ? ` a ${r.capas.tono.hz} Hz` : r.capas?.binaural ? ` a ${r.capas.binaural.baseHz} Hz` : '';
  if (r.momento === 'para-alguien' || (extra.paraQuien && r.tipo !== 'paisaje')) {
    return extra.paraQuien ? `Para ${extra.paraQuien}` : 'Para alguien';
  }
  if (extra.artista) return `${extra.artista.nombre} ${deLa(franja)}`;
  switch (r.momento) {
    case 'concentrarme':
      return `Foco ${deLa(franja)}${hz}`;
    case 'dormir':
      return `Para dormir${hz}`;
    case 'desconectar':
      return `${capital(franja)} ${franja === 'mediodía' ? 'tranquilo' : 'tranquila'}${hz}`;
    case 'correr':
      return `A tu paso${hz}`;
    default: {
      const primero = r.estilo?.split(/,| y /)[0]?.trim();
      return primero ? `${capital(primero)} ${deLa(franja)}${hz}` : `Tu canción ${deLa(franja)}${hz}`;
    }
  }
}

const PARA_QUE: Record<Momento, string> = {
  concentrarme: 'concentrarte',
  dormir: 'dormir',
  desconectar: 'desconectar',
  correr: 'correr',
  'para-alguien': 'alguien',
  sorprendeme: 'sorprenderte',
};

/** Por qué existe, en una frase. Dice para qué está pensada, nunca qué cura. */
export function porqueDe(r: Receta, extra: { paraQuien?: string; ahora?: number } = {}): string {
  const franja = franjaDe(r.frase, extra.ahora ?? Date.now());
  const para = extra.paraQuien && (r.momento === 'para-alguien' || !r.momento)
    ? `Para ${extra.paraQuien}`
    : r.momento
      ? `Para ${PARA_QUE[r.momento]}${r.momento === 'desconectar' || r.momento === 'dormir' || r.momento === 'concentrarme' ? ` por la ${franja === 'mediodía' ? 'tarde' : franja}` : ''}`
      : 'Hecha a tu medida';
  const rasgos = [tempoEnPalabras(r), r.conVoz ? `con voz ${IDIOMA_ES[r.idioma ?? 'es'] ?? ''}`.trim() : 'sin voz'];
  if (r.estilo) rasgos.push(r.estilo);
  const capas = capasEnPalabras(r).map((c) => c.replace(' muy bajo', '').replace(' (con auriculares)', ''));
  const cola = capas.length ? `, con ${enLista(capas.map((c) => (c.startsWith('tono') ? `un ${c}` : c)))}` : '';
  return `${para}, ${enLista(rasgos.filter((x): x is string => !!x))}${cola}.`;
}
