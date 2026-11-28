/**
 * De lo que escribes a una receta a medias, sin red y sin IA. Es la base del
 * chat de crear: si Claude no contesta (sin clave, sin red, lento), el chat
 * sigue funcionando solo con esto, sin avisar de nada técnico.
 *
 * Saca el momento, si es canción o paisaje, los Hz, la duración («una hora»,
 * «20 minutos»), con o sin voz, el idioma, el tempo («lenta», «rápida»), para
 * quién es, el estilo y la letra literal entre comillas. Y caza lo que imita
 * a alguien real (`pareceImitacion`).
 *
 * ⚠️ Salud: «migraña» o «dolor de cabeza» llevan al momento `desconectar` y
 * a NADA más. No se etiqueta ni se guarda una condición médica en ningún
 * campo (RGPD, art. 9; plan, 3.2), y antes de mandar tu frase a Claude se le
 * quitan esas palabras (`sinDatosDeSalud`).
 */

import { pareceImitacion } from '../reglas';
import type { CapasPaisaje, Momento, TipoPieza } from '../tipos';

/** La receta mientras se pregunta: todo opcional. */
export interface RecetaParcial {
  tipo?: TipoPieza;
  momento?: Momento;
  conVoz?: boolean;
  idioma?: string;
  duracionSeg?: number;
  bpm?: number;
  energia?: number;
  /** Estilo en castellano y palabras sencillas: «rumba», «piano y pad cálido». */
  estilo?: string;
  /** A qué suena, con sus palabras y sin nombres de artistas: «a verano». */
  parecido?: string;
  /** «Sorpréndeme»: que elija la máquina. */
  sorpresa?: boolean;
  /** Letra literal (entre comillas), o el nombre que tiene que salir en la canción. */
  letra?: string;
  /** Para quién es: «mi madre», «Lucía». */
  paraQuien?: string;
  capas?: CapasPaisaje;
  artistaId?: string;
}

export interface Interpretacion {
  parcial: RecetaParcial;
  /** El artista real al que se quiere imitar, si lo hay. */
  imitacion: string | null;
}

/** Minúsculas y sin tildes, para comparar. La ñ pasa a n. */
export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/* ── Números dichos con palabras ─────────────────────────────────────── */

const NUMEROS: Record<string, number> = {
  un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9,
  diez: 10, once: 11, doce: 12, quince: 15, veinte: 20, veinticinco: 25, treinta: 30, cuarenta: 40,
  'cuarenta y cinco': 45, cincuenta: 50, sesenta: 60, noventa: 90,
};
const NUM = '(\\d+(?:[.,]\\d+)?|cuarenta y cinco|veinticinco|cincuenta|cuarenta|treinta|veinte|quince|sesenta|noventa|doce|once|diez|nueve|ocho|siete|seis|cinco|cuatro|tres|dos|una|uno|un)';

function numero(s: string): number {
  const limpio = s.trim().replace(',', '.');
  return NUMEROS[limpio] ?? Number(limpio);
}

/** Lo que dura, en segundos, si lo dice. Nada si no. */
export function duracionDe(texto: string): number | undefined {
  const n = normalizar(texto);
  if (/\b(toda la noche|hasta que (?:la|lo|las|los) pare|hasta que pare|sin fin|sin parar|infinit[ao])\b/.test(n)) return 8 * 3600;
  let m = n.match(new RegExp(`\\b${NUM}\\s+horas?\\s+y\\s+media\\b`));
  if (m) return numero(m[1]) * 3600 + 1800;
  if (/\bhora y media\b/.test(n)) return 5400;
  if (/\bmedia hora\b/.test(n)) return 1800;
  if (/\bun cuarto de hora\b/.test(n)) return 900;
  m = n.match(new RegExp(`\\b${NUM}\\s*(?:horas?|h)\\b`));
  if (m) return Math.round(numero(m[1]) * 3600);
  m = n.match(new RegExp(`\\b${NUM}\\s*(?:minutos?|mins?)\\b`));
  if (m) return Math.round(numero(m[1]) * 60);
  m = n.match(/\b(\d+)\s*(?:segundos?|seg|s)\b/);
  if (m) return Number(m[1]);
  return undefined;
}

/* ── Capas: tono, binaural, ruido, pulso ─────────────────────────────── */

export function capasDe(texto: string): CapasPaisaje | undefined {
  const n = normalizar(texto);
  const capas: CapasPaisaje = {};
  const hzM = n.match(/(\d+(?:[.,]\d+)?)\s*(?:hz|hercios|herzios|herz)\b/);
  const hz = hzM ? Number(hzM[1].replace(',', '.')) : undefined;
  const hzValido = hz !== undefined && hz >= 20 && hz <= 2000 ? hz : undefined;
  if (/\bbinaural/.test(n)) {
    capas.binaural = { baseHz: hzValido ?? 200, difHz: 6, nivel: 0.08 };
  } else if (hzValido !== undefined) {
    capas.tono = { hz: hzValido, nivel: 0.1 };
  }
  const ruido = n.match(/(?<!\bsin\s)\bruido(?:\s+(blanco|rosa|marron))?/);
  if (ruido) capas.ruido = { color: (ruido[1] as 'blanco' | 'rosa' | 'marron' | undefined) ?? 'rosa', nivel: 0.15 };
  if (/\bisocronic/.test(n)) capas.pulso = { hz: 10, profundidad: 0.2 };
  return Object.keys(capas).length ? capas : undefined;
}

/* ── Momento ─────────────────────────────────────────────────────────── */

/**
 * El orden importa: «para que el bebé se duerma» es dormir aunque sea para
 * alguien, y «relajante para estudiar» es concentrarse.
 */
const MOMENTOS_POR_PALABRA: [Momento, RegExp][] = [
  ['dormir', /\b(dormir|dormirme|dormirse|duerm\w*|sueno|nana|cuna|siesta|acostar\w*)\b/],
  ['correr', /\b(correr|corriendo|running|entren\w*|gimnasio|gym|deporte|caminar|bici\w*|pesas|cardio)\b/],
  ['concentrarme', /\b(concentr\w*|estudi\w*|trabaj\w*|foco|focus|leer|lectura|programar|oficina|deberes)\b/],
  // Salud: lleva a desconectar y a nada más (ni una etiqueta, ni un campo).
  ['desconectar', /\b(desconect\w*|relaj\w*|calma\w*|descans\w*|medit\w*|respir\w*|yoga|estres\w*|nervios|migrana\w*|jaqueca\w*|cefalea\w*|dolor de cabeza|ansiedad|bajar el ritmo)\b/],
  ['sorprendeme', /\b(sorprend\w*|lo que quieras|cualquiera)\b/],
];

const PARA_ALGUIEN = /\b(cumpleanos|cumple|regalo|dedicad\w*|aniversario|boda|felicitar|felicitacion|serenata)\b/;

const RELACIONES =
  'madre|padre|mama|papa|abuela|abuelo|hermana|hermano|hija|hijo|novia|novio|pareja|mujer|marido|amiga|amigo|amigas|amigos|jefa|jefe|bebe|sobrina|sobrino|tia|tio|prima|primo|vecina|vecino|profe|profesora|profesor|perro|perra|gato|gata';

/** «mi madre», «Lucía»: para quién es, con las palabras de quien lo pide. */
export function paraQuienDe(texto: string): string | undefined {
  const n = normalizar(texto);
  const rel = new RegExp(`\\b(?:para|a|de)\\s+(mi|mis|tu|su)\\s+(${RELACIONES})\\b`).exec(n);
  if (rel) {
    // Se recupera el trozo original (con sus tildes) por la posición.
    const inicio = rel.index + rel[0].indexOf(rel[1]);
    return texto.slice(inicio, rel.index + rel[0].length).trim();
  }
  const nombre = /\b[Pp]ara\s+((?:[A-ZÁÉÍÓÚÑ][a-záéíóúñü]+)(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñü]+)?)/u.exec(texto);
  if (nombre && !/^(Navidad|Dios|España|Madrid|Barcelona|Año|Semana)\b/u.test(nombre[1])) return nombre[1];
  return undefined;
}

/** «se llama Carmen» → «Carmen». */
export function nombreDe(texto: string): string | undefined {
  const m = /\b(?:se llama|llamad[ao]|de nombre)\s+([A-ZÁÉÍÓÚÑa-záéíóúñü][\p{L}'’-]+(?:\s+[A-ZÁÉÍÓÚÑ][\p{L}'’-]+)?)/u.exec(texto);
  if (!m) return undefined;
  const nombre = m[1].trim();
  return nombre.charAt(0).toUpperCase() + nombre.slice(1);
}

/* ── Estilo ──────────────────────────────────────────────────────────── */

/** Géneros e instrumentos que se reconocen, en castellano y en inglés para el modelo. */
export const PALABRAS_DE_ESTILO: { clave: RegExp; es: string; en: string }[] = [
  { clave: /\brumba\w*/, es: 'rumba', en: 'Spanish rumba' },
  { clave: /\bflamenc\w*/, es: 'flamenco', en: 'flamenco' },
  { clave: /\bsevillanas\b/, es: 'sevillanas', en: 'sevillanas' },
  { clave: /\bcopla\b/, es: 'copla', en: 'Spanish copla' },
  { clave: /\bbossa ?nova\b/, es: 'bossa nova', en: 'bossa nova' },
  { clave: /\bjazz\w*/, es: 'jazz', en: 'jazz' },
  { clave: /\bblues\b/, es: 'blues', en: 'blues' },
  { clave: /\bsoul\b/, es: 'soul', en: 'soul' },
  { clave: /\bfunk\w*/, es: 'funk', en: 'funk' },
  { clave: /\bpop\b/, es: 'pop', en: 'pop' },
  { clave: /\brock\w*/, es: 'rock', en: 'rock' },
  { clave: /\bindie\b/, es: 'indie', en: 'indie' },
  { clave: /\bfolk\w*/, es: 'folk', en: 'folk' },
  { clave: /\breggae\b/, es: 'reggae', en: 'reggae' },
  { clave: /\b(?:reggaeton|regueton)\b/, es: 'reguetón', en: 'reggaeton' },
  { clave: /\bsalsa\b/, es: 'salsa', en: 'salsa' },
  { clave: /\bbachata\b/, es: 'bachata', en: 'bachata' },
  { clave: /\bcumbia\b/, es: 'cumbia', en: 'cumbia' },
  { clave: /\btango\b/, es: 'tango', en: 'tango' },
  { clave: /\bbolero\b/, es: 'bolero', en: 'bolero' },
  { clave: /\btrap\b/, es: 'trap', en: 'trap' },
  { clave: /\bhip ?hop\b/, es: 'hip hop', en: 'hip hop' },
  { clave: /\brap\b/, es: 'rap', en: 'rap' },
  { clave: /\belectronic\w*/, es: 'electrónica', en: 'electronic' },
  { clave: /\btechno\b/, es: 'techno', en: 'techno' },
  { clave: /\bhouse\b/, es: 'house', en: 'house' },
  { clave: /\bdisco\b/, es: 'disco', en: 'disco' },
  { clave: /\bsynthwave\b/, es: 'synthwave', en: 'synthwave' },
  { clave: /\bambient\w*/, es: 'ambient', en: 'ambient' },
  { clave: /\blo-?fi\b/, es: 'lo-fi', en: 'lo-fi' },
  { clave: /\bchill\w*/, es: 'chill', en: 'chill' },
  { clave: /\bgospel\b/, es: 'gospel', en: 'gospel' },
  { clave: /\bcountry\b/, es: 'country', en: 'country' },
  { clave: /\bclasica\b/, es: 'clásica', en: 'classical' },
  { clave: /\borquest\w*/, es: 'orquesta', en: 'orchestral' },
  { clave: /\bpiano\b/, es: 'piano', en: 'piano' },
  { clave: /\bguitarra espanola\b/, es: 'guitarra española', en: 'Spanish guitar' },
  { clave: /\bguitarra acustica\b/, es: 'guitarra acústica', en: 'acoustic guitar' },
  { clave: /\bguitarra electrica\b/, es: 'guitarra eléctrica', en: 'electric guitar' },
  { clave: /\bguitarras?\b(?!\s+(?:espanola|acustica|electrica))/, es: 'guitarra', en: 'guitar' },
  { clave: /\bviolin\w*/, es: 'violín', en: 'violin' },
  { clave: /\b(?:violon)?chelo\b/, es: 'chelo', en: 'cello' },
  { clave: /\bcuerdas\b/, es: 'cuerdas', en: 'strings' },
  { clave: /\bsintetizador\w*|\bsintes?\b/, es: 'sintetizador', en: 'synthesizer' },
  { clave: /\bpad\b/, es: 'pad', en: 'pad' },
  { clave: /\bcoros?\b/, es: 'coros', en: 'choir' },
  { clave: /\bflauta\b/, es: 'flauta', en: 'flute' },
  { clave: /\bsaxo\w*/, es: 'saxo', en: 'saxophone' },
  { clave: /\btrompeta\b/, es: 'trompeta', en: 'trumpet' },
  { clave: /\bbateria\b/, es: 'batería', en: 'drums' },
  { clave: /\bpercusion\b/, es: 'percusión', en: 'percussion' },
  { clave: /\bpalmas\b/, es: 'palmas', en: 'handclaps' },
  { clave: /\bcajon\b/, es: 'cajón', en: 'cajón' },
  { clave: /\bukel?ele\b/, es: 'ukelele', en: 'ukulele' },
  { clave: /\barpa\b/, es: 'arpa', en: 'harp' },
  { clave: /\borgano\b/, es: 'órgano', en: 'organ' },
];

/** Una lista en castellano: «a», «a y b», «a, b y c». */
export function enLista(cosas: string[]): string {
  if (cosas.length <= 1) return cosas[0] ?? '';
  return `${cosas.slice(0, -1).join(', ')} y ${cosas[cosas.length - 1]}`;
}

/** Los géneros e instrumentos que nombra, en el orden en que los dice. */
export function estiloDe(texto: string): string | undefined {
  const n = normalizar(texto);
  const vistos = PALABRAS_DE_ESTILO.map((p) => ({ p, i: n.search(p.clave) }))
    .filter(({ i }) => i >= 0)
    .sort((a, b) => a.i - b.i)
    .map(({ p }) => p.es);
  const unicos = [...new Set(vistos)];
  return unicos.length ? enLista(unicos) : undefined;
}

/** «que suene a verano», «como de domingo por la mañana»: a qué suena, sin artistas. */
export function parecidoDe(texto: string): string | undefined {
  const m = /\b(?:que suene|que sea|suena|sonar|sonando)\s+(a|como)\s+([^,.;]+)/iu.exec(texto) ?? /\b(como de)\s+([^,.;]+)/iu.exec(texto);
  if (!m) return undefined;
  const resto = m[2].trim();
  if (!resto || pareceImitacion(`que suene ${m[1]} ${resto}`)) return undefined;
  return `${m[1].toLowerCase() === 'como de' ? 'como de' : m[1].toLowerCase()} ${resto}`.trim();
}

/** Letra literal: lo que va entre comillas tras «que diga», «letra» o «que cante». */
export function letraDe(texto: string): string | undefined {
  const m = /\b(?:que diga|que cante|con (?:esta |la )?letra|letra)\s*:?\s*["“«‘']([^"”»’']{2,})["”»’']/iu.exec(texto);
  return m ? m[1].trim() : undefined;
}

/* ── Voz, idioma, tempo ──────────────────────────────────────────────── */

const IDIOMAS: Record<string, string> = {
  ingles: 'en', castellano: 'es', espanol: 'es', catalan: 'ca', frances: 'fr', italiano: 'it',
  portugues: 'pt', euskera: 'eu', gallego: 'gl', aleman: 'de',
};

export function idiomaDe(texto: string): string | undefined {
  const m = normalizar(texto).match(/\ben\s+(ingles|castellano|espanol|catalan|frances|italiano|portugues|euskera|gallego|aleman)\b/);
  return m ? IDIOMAS[m[1]] : undefined;
}

export function vozDe(texto: string): boolean | undefined {
  const n = normalizar(texto);
  if (/\b(sin voz|sin voces|sin letra|sin cantar|sin que cante|que no cante|instrumental)\b/.test(n)) return false;
  if (/\b(con voz|con voces|con letra|cantad[ao]s?|que cante|cantando|con su nombre|que diga su nombre|que diga)\b/.test(n)) return true;
  return undefined;
}

export function tempoDe(texto: string): { bpm?: number; energia?: number } {
  const n = normalizar(texto);
  const bpm = n.match(/\b(\d{2,3})\s*(?:bpm|pulsaciones|golpes por minuto)\b/);
  const dicho = bpm ? Math.max(40, Math.min(200, Number(bpm[1]))) : undefined;
  if (/\bmuy (?:lent[ao]|despacio)\b/.test(n)) return { bpm: dicho ?? 60, energia: 0.15 };
  if (/\b(lent[ao]s?|despacio|pausad[ao])\b/.test(n)) return { bpm: dicho ?? 68, energia: 0.25 };
  if (/\b(rapid[ao]s?|deprisa|cañer[ao]|caner[ao]|movid[ao]|marchos[ao]|bailable|con energia|energic[ao])\b/.test(n)) {
    return { bpm: dicho ?? 124, energia: 0.8 };
  }
  if (/\b(tranquil[ao]|suave|calmad[ao]|relajad[ao]|relajante|dulce|serena?)\b/.test(n)) return { ...(dicho ? { bpm: dicho } : {}), energia: 0.2 };
  if (/\b(alegre|animad[ao]|luminos[ao])\b/.test(n)) return { ...(dicho ? { bpm: dicho } : {}), energia: 0.7 };
  return dicho ? { bpm: dicho } : {};
}

/* ── Todo junto ──────────────────────────────────────────────────────── */

export function interpretar(texto: string): Interpretacion {
  const n = normalizar(texto);
  const parcial: RecetaParcial = {};
  const imitacion = pareceImitacion(texto);

  for (const [momento, re] of MOMENTOS_POR_PALABRA) {
    if (re.test(n)) {
      parcial.momento = momento;
      break;
    }
  }
  const paraQuien = paraQuienDe(texto);
  if (paraQuien) parcial.paraQuien = paraQuien;
  // Un regalo es para alguien aunque diga «tranquila»; para alguien a secas, solo si no hay otro momento.
  if (PARA_ALGUIEN.test(n) || (paraQuien && (!parcial.momento || parcial.momento === 'sorprendeme'))) {
    if (!parcial.momento || parcial.momento === 'sorprendeme' || PARA_ALGUIEN.test(n)) parcial.momento = 'para-alguien';
  }
  if (/\b(paisaje|de fondo|sonido ambiente)\b/.test(n)) parcial.tipo = 'paisaje';

  const duracion = duracionDe(texto);
  if (duracion !== undefined) {
    parcial.duracionSeg = duracion;
    if (duracion > 300) parcial.tipo = 'paisaje';
  }
  const capas = capasDe(texto);
  if (capas) parcial.capas = capas;

  const voz = vozDe(texto);
  const idioma = idiomaDe(texto);
  if (voz !== undefined) parcial.conVoz = voz;
  if (idioma) {
    parcial.idioma = idioma;
    if (voz === undefined) parcial.conVoz = true;
  }
  Object.assign(parcial, tempoDe(texto));

  if (!imitacion) {
    const estilo = estiloDe(texto);
    if (estilo) parcial.estilo = estilo;
    const parecido = parecidoDe(texto);
    if (parecido) parcial.parecido = parecido;
  }
  const letra = letraDe(texto) ?? nombreDe(texto);
  if (letra) {
    parcial.letra = letra;
    if (parcial.conVoz === undefined) parcial.conVoz = true;
  }
  if (/\bsorprend/.test(n)) parcial.sorpresa = true;
  return { parcial, imitacion };
}

/** Junta lo nuevo con lo que ya había: lo nuevo manda (es una corrección). */
export function mezclar(antes: RecetaParcial, nuevo: RecetaParcial): RecetaParcial {
  const capas = antes.capas || nuevo.capas ? { ...antes.capas, ...nuevo.capas } : undefined;
  const junto: RecetaParcial = { ...antes, ...nuevo };
  if (capas) junto.capas = capas;
  return junto;
}

/* ── La frase, sin salud, para quien está fuera del móvil ────────────── */

const SALUD: [RegExp, string][] = [
  [/\b(?:el |mi |un |del )?insomnio\b/giu, 'dormir'],
  [/\b(?:la |mi |una |de la )?(?:migraña|migrañas|jaqueca|jaquecas|cefalea|cefaleas)\b/giu, 'desconectar'],
  [/\b(?:el |mi |un |del )?dolor(?:es)? de cabeza\b/giu, 'desconectar'],
  [/\b(?:la |mi |una )?(?:ansiedad|depresión|depresion|crisis de pánico|ataque de pánico)\b/giu, 'desconectar'],
];

/**
 * La frase sin palabras de salud. «Migraña» es un dato de salud (RGPD, art. 9):
 * vive en el móvil y no sale a Claude ni a los modelos. Se cambia por para
 * qué está pensada la música («desconectar», «dormir»).
 */
export function sinDatosDeSalud(texto: string): string {
  let s = texto;
  for (const [re, por] of SALUD) s = s.replace(re, por);
  return s.replace(/\s{2,}/g, ' ').trim();
}

/** ¿Nombra una condición de salud? Lo usan los tests y el filtro de lo que llega de fuera. */
export const PALABRAS_DE_SALUD =
  /\b(migra[ñn]as?|jaquecas?|cefaleas?|dolor(?:es)? de cabeza|insomnio|ansiedad|depresi[óo]n|migraine|headache|insomnia|anxiety|depression|pain)\b/iu;
