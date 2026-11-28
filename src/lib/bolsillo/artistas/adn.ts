/**
 * El ADN de un artista inventado, puro y con tests (plan, parte 3.4).
 *
 * Un artista es una ficha: nombre, estilo, instrumentos, cómo canta, idioma,
 * tempo, de qué habla y lo que no hace nunca. Cada canción suya sale de aquí:
 * `recetaDeArtista` pasa el ADN a una receta parcial que Crear y Playlists
 * completan, y `fraseParaElMotor` lo cuenta en una descripción para el motor.
 *
 * Dos reglas que no se saltan:
 * - **Un artista es inventado y es tuyo.** Si el estilo, la voz, los
 *   instrumentos o el nombre piden parecerse a alguien real, no se guarda
 *   (`pareceImitacion`, la misma red que el chat de crear).
 * - **Lo que no hace nunca no va en la frase del motor.** Nombrar algo en un
 *   prompt tiende a meterlo (la lección de las imágenes de aura: «NO logos»
 *   pinta logos). Va aparte, en `evitar`, para el motor que acepte una lista
 *   de lo que no se quiere.
 *
 * El tempo se pide en palabras (Lento · Medio · Animado · Rápido): quien
 * escucha no sabe qué es un BPM, y no tiene por qué.
 */

import { semillaDe } from '../biblioteca';
import { pareceImitacion, respuestaAImitacion } from '../reglas';
import type { AdnArtista, Artista, Receta } from '../tipos';

export const MAX_NOMBRE = 40;
export const MAX_TEXTO = 160;
export const MAX_INSTRUMENTOS = 8;
const TEMPO_MIN = 40;
const TEMPO_MAX = 220;

/** El tempo en palabras, con su rango. Lo que se guarda es el rango. */
export const TEMPOS = [
  { id: 'lento', etiqueta: 'Lento', min: 60, max: 80 },
  { id: 'medio', etiqueta: 'Medio', min: 85, max: 105 },
  { id: 'animado', etiqueta: 'Animado', min: 110, max: 128 },
  { id: 'rapido', etiqueta: 'Rápido', min: 130, max: 160 },
] as const;

export type IdTempo = (typeof TEMPOS)[number]['id'];

export const IDIOMAS: readonly { id: string; etiqueta: string; enFrase: string }[] = [
  { id: 'es', etiqueta: 'Castellano', enFrase: 'castellano' },
  { id: 'en', etiqueta: 'Inglés', enFrase: 'inglés' },
  { id: 'ca', etiqueta: 'Catalán', enFrase: 'catalán' },
  { id: 'pt', etiqueta: 'Portugués', enFrase: 'portugués' },
  { id: 'fr', etiqueta: 'Francés', enFrase: 'francés' },
  { id: 'it', etiqueta: 'Italiano', enFrase: 'italiano' },
];

export const INSTRUMENTOS_SUGERIDOS: readonly string[] = [
  'guitarra española',
  'guitarra eléctrica',
  'piano',
  'bajo',
  'batería',
  'cajón',
  'palmas',
  'sintetizador',
  'cuerdas',
  'trompeta',
  'saxo',
  'ukelele',
];

export const ESTILOS_SUGERIDOS: readonly string[] = [
  'rumba lenta',
  'pop de verano',
  'piano de noche',
  'electrónica suave',
  'acústico y cálido',
  'jazz de bar',
  'rock de garaje',
  'lo-fi para estudiar',
];

/** El rango del tempo de un id en palabras. */
export function tempoDe(id: IdTempo): { min: number; max: number } {
  const t = TEMPOS.find((x) => x.id === id) ?? TEMPOS[1];
  return { min: t.min, max: t.max };
}

/** El tempo de un rango, en palabras: el que más se le acerca por el centro. */
export function tempoEnPalabras(tempo?: { min: number; max: number }): string | null {
  const id = idDeTempo(tempo);
  return id ? (TEMPOS.find((t) => t.id === id)?.etiqueta ?? null) : null;
}

export function idDeTempo(tempo?: { min: number; max: number }): IdTempo | null {
  if (!tempo) return null;
  const centro = (tempo.min + tempo.max) / 2;
  let mejor: IdTempo = TEMPOS[0].id;
  let distancia = Infinity;
  for (const t of TEMPOS) {
    const d = Math.abs((t.min + t.max) / 2 - centro);
    if (d < distancia) {
      distancia = d;
      mejor = t.id;
    }
  }
  return mejor;
}

export function nombreDeIdioma(id?: string): string | null {
  if (!id) return null;
  return IDIOMAS.find((i) => i.id === id)?.etiqueta ?? id;
}

function idiomaEnFrase(id?: string): string {
  return IDIOMAS.find((i) => i.id === id)?.enFrase ?? 'castellano';
}

const limpia = (s: string | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();

/**
 * El ADN tal y como se guarda: textos sin espacios de más, instrumentos sin
 * repetir (da igual la mayúscula) y como mucho ocho, y el tempo con sentido
 * (de menor a mayor, entre 40 y 220). Lo vacío no se guarda.
 */
export function normalizarAdn(adn: AdnArtista): AdnArtista {
  const vistos = new Set<string>();
  const instrumentos: string[] = [];
  for (const bruto of adn.instrumentos ?? []) {
    const i = limpia(bruto);
    const clave = i.toLowerCase();
    if (!i || vistos.has(clave)) continue;
    vistos.add(clave);
    instrumentos.push(i);
    if (instrumentos.length >= MAX_INSTRUMENTOS) break;
  }
  const voz = limpia(adn.voz);
  const resultado: AdnArtista = { estilo: limpia(adn.estilo), instrumentos, voz };
  if (voz && limpia(adn.idioma)) resultado.idioma = limpia(adn.idioma);
  if (adn.tempo && Number.isFinite(adn.tempo.min) && Number.isFinite(adn.tempo.max)) {
    const a = Math.max(TEMPO_MIN, Math.min(TEMPO_MAX, Math.round(adn.tempo.min)));
    const b = Math.max(TEMPO_MIN, Math.min(TEMPO_MAX, Math.round(adn.tempo.max)));
    resultado.tempo = { min: Math.min(a, b), max: Math.max(a, b) };
  }
  const temas = limpia(adn.temas);
  if (temas) resultado.temas = temas;
  const nunca = limpia(adn.nunca);
  if (nunca) resultado.nunca = nunca;
  return resultado;
}

export type CampoArtista = 'nombre' | 'estilo' | 'voz' | 'instrumentos' | 'temas' | 'nunca';

/**
 * La red de `pareceImitacion` también al empezar el campo: «Rollo Estopa» o
 * «Como Rosalía» llevan el disparador en mayúscula.
 */
export function imitaA(texto: string): string | null {
  return pareceImitacion(texto) ?? pareceImitacion(texto.charAt(0).toLowerCase() + texto.slice(1));
}

export interface ProblemaArtista {
  campo: CampoArtista;
  motivo: string;
  /** Si pide parecerse a alguien real, a quién. */
  imitacion?: string;
}

/**
 * Lo que impide guardar un artista, o null si se puede. Nombre y estilo son
 * obligatorios; nada puede pedir parecerse a alguien real.
 */
export function validarArtista(nombre: string, adn: AdnArtista): ProblemaArtista | null {
  const n = limpia(nombre);
  if (!n) return { campo: 'nombre', motivo: 'Ponle un nombre. Si no se te ocurre, toca una sugerencia.' };
  if (n.length > MAX_NOMBRE) return { campo: 'nombre', motivo: `El nombre, mejor corto: como mucho ${MAX_NOMBRE} letras.` };
  const a = normalizarAdn(adn);
  if (!a.estilo) {
    return { campo: 'estilo', motivo: 'Dime su estilo en pocas palabras: «rumba lenta», «piano de noche»…' };
  }
  const largos: [CampoArtista, string][] = [
    ['estilo', a.estilo],
    ['voz', a.voz],
    ['temas', a.temas ?? ''],
    ['nunca', a.nunca ?? ''],
  ];
  for (const [campo, texto] of largos) {
    if (texto.length > MAX_TEXTO) return { campo, motivo: `Más corto, por favor: como mucho ${MAX_TEXTO} letras.` };
  }
  const aMirar: [CampoArtista, string][] = [
    ['nombre', n],
    ['estilo', a.estilo],
    ['voz', a.voz],
    ['instrumentos', a.instrumentos.join(', ')],
  ];
  for (const [campo, texto] of aMirar) {
    const quien = imitaA(texto);
    if (quien) return { campo, motivo: respuestaAImitacion(quien), imitacion: quien };
  }
  return null;
}

/* ── Nombres sugeridos ────────────────────────────────────────────────── */

const NOMBRES_DE_PILA = ['Lola', 'Inés', 'Bruno', 'Carmela', 'Teo', 'Alba', 'Ciro', 'Nora', 'Elio', 'Vera', 'Simón', 'Greta'];

const APELLIDOS_GENERALES = ['Niebla', 'Marea', 'Brasa', 'Escarcha', 'Faro', 'Salitre', 'Bruma', 'Trigo', 'Cobre', 'Tormenta'];

/** Por palabras del estilo, apellidos que le pegan. La primera que case manda. */
const APELLIDOS_POR_ESTILO: [RegExp, string[]][] = [
  [/rumba|flamenc|copla|sevillan|española|palmas|cajón|cajon/i, ['Albero', 'Azahar', 'Candela', 'Clavel', 'Romero', 'Alhambra']],
  [/electr|techno|house|synth|sintet|disco|dance/i, ['Neón', 'Voltio', 'Cromo', 'Radar', 'Píxel', 'Láser']],
  [/piano|clásic|clasic|cuerdas|ambient|orquest|cine/i, ['Nácar', 'Penumbra', 'Pizarra', 'Escarcha', 'Bruma', 'Ceniza']],
  [/rock|punk|garaje|metal|grunge/i, ['Grava', 'Óxido', 'Asfalto', 'Chispa', 'Cemento', 'Trueno']],
  [/jazz|soul|swing|blues|bossa/i, ['Terciopelo', 'Humo', 'Canela', 'Madrugada', 'Ébano', 'Tabaco']],
  [/pop|verano|playa|tropical|reggae/i, ['Limonada', 'Arena', 'Coral', 'Cometa', 'Agosto', 'Sandía']],
  [/lo-?fi|chill|tranquil|calma|dormir|nana/i, ['Siesta', 'Persiana', 'Domingo', 'Almohada', 'Tarde', 'Manta']],
];

const BANDAS = [
  'Los Faroles de Marzo',
  'Las Persianas Bajas',
  'Los Domingos Lentos',
  'Las Mareas Quietas',
  'Los Tejados Rojos',
  'Las Bombillas',
  'Los Relojes Parados',
  'Las Siestas Largas',
  'Los Cometas de Papel',
  'Las Brasas del Sur',
];

function azar(semilla: number) {
  let s = semilla >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

function elegir<T>(lista: readonly T[], r: () => number): T {
  return lista[Math.floor(r() * lista.length) % lista.length];
}

/**
 * Nombres inventados para quien no sabe cómo llamarlo. Deterministas: el
 * mismo estilo da los mismos nombres (para que no bailen mientras escribes
 * otra cosa), y cambian al cambiar el estilo. Mitad personas, mitad bandas.
 */
export function nombresSugeridos(estilo: string, cuantos = 4): string[] {
  const base = limpia(estilo).toLowerCase() || 'mezcla';
  const r = azar(semillaDe(`nombres:${base}`));
  const apellidos = APELLIDOS_POR_ESTILO.find(([re]) => re.test(base))?.[1] ?? APELLIDOS_GENERALES;
  const salida: string[] = [];
  const poner = (nombre: string) => {
    if (!salida.includes(nombre) && !pareceImitacion(nombre)) salida.push(nombre);
  };
  let intentos = 0;
  while (salida.length < cuantos && intentos < 60) {
    intentos++;
    if (salida.length % 2 === 0) poner(`${elegir(NOMBRES_DE_PILA, r)} ${elegir(apellidos, r)}`);
    else poner(elegir(BANDAS, r));
  }
  return salida.slice(0, cuantos);
}

/* ── Del ADN a la receta ──────────────────────────────────────────────── */

function lista(palabras: string[]): string {
  if (palabras.length <= 1) return palabras.join('');
  return `${palabras.slice(0, -1).join(', ')} y ${palabras[palabras.length - 1]}`;
}

const entre0y1 = (x: number | undefined, defecto: number) =>
  Number.isFinite(x) ? Math.max(0, Math.min(1, x as number)) : defecto;

/** Cómo suena, en una línea: estilo, instrumentos y voz. */
export function comoSuena(adn: AdnArtista): string {
  const a = normalizarAdn(adn);
  const partes = [a.estilo];
  if (a.instrumentos.length) partes.push(`con ${lista(a.instrumentos)}`);
  partes.push(a.voz ? `voz ${a.voz.replace(/^voz\s+/i, '')}` : 'sin voz');
  return partes.filter(Boolean).join(', ');
}

/** El tempo dentro del rango del artista: 0 = lo más lento que hace, 1 = lo más rápido. */
export function bpmDelArtista(adn: AdnArtista, energia = 0.5): number | undefined {
  const t = normalizarAdn(adn).tempo;
  if (!t) return undefined;
  return Math.round(t.min + (t.max - t.min) * entre0y1(energia, 0.5));
}

/**
 * El ADN contado para el motor, en positivo: lo que es, nunca lo que no es.
 * Sin el nombre del artista (el motor no lo conoce y no tiene que parecerse
 * a nadie) y con la frase de quien pide delante, si la hay.
 */
export function fraseParaElMotor(adn: AdnArtista, extra: { frase?: string; bpm?: number } = {}): string {
  const a = normalizarAdn(adn);
  const partes: string[] = [];
  const frase = limpia(extra.frase);
  if (frase) partes.push(frase.replace(/[.\s]+$/, ''));
  partes.push(`${a.estilo}${a.instrumentos.length ? `, con ${lista(a.instrumentos)}` : ''}`);
  if (a.voz) {
    partes.push(`Voz ${a.voz.replace(/^voz\s+/i, '')}, cantando en ${idiomaEnFrase(a.idioma)}`);
    if (a.temas) partes.push(`Habla de ${a.temas}`);
  } else {
    partes.push('Instrumental, sin voz');
  }
  if (extra.bpm) partes.push(`Hacia ${extra.bpm} BPM`);
  return `${partes.join('. ')}.`;
}

/** Lo que el artista no hace nunca, para el motor que acepte una lista de lo que no se quiere. */
export function evitarDelAdn(adn: AdnArtista): string | undefined {
  return normalizarAdn(adn).nunca;
}

/** La receta parcial de un artista: lo que el ADN decide de cada canción suya. */
export interface RecetaDeArtista extends Pick<Receta, 'artistaId' | 'estilo' | 'conVoz' | 'idioma' | 'bpm' | 'energia' | 'frase'> {
  artistaId: string;
  estilo: string;
  frase: string;
  /** El ADN contado para el motor (`fraseParaElMotor`). No es parte de `Receta`. */
  paraElMotor: string;
  /** Lo que no hace nunca. No es parte de `Receta`. */
  evitar?: string;
}

/**
 * Del ADN a una receta parcial: estilo (con instrumentos y cómo canta), con o
 * sin voz, idioma, el tempo dentro de su rango según la energía y la frase.
 * La frase es la de quien pide; si no hay, «Una nueva de <nombre>», con de
 * qué habla si canta.
 */
export function recetaDeArtista(
  artista: Pick<Artista, 'id' | 'nombre' | 'adn'>,
  opciones: { frase?: string; energia?: number } = {},
): RecetaDeArtista {
  const a = normalizarAdn(artista.adn);
  const energia = entre0y1(opciones.energia, 0.5);
  const bpm = bpmDelArtista(a, energia);
  const conVoz = a.voz.length > 0;
  const propia = limpia(opciones.frase);
  const frase =
    propia || (conVoz && a.temas ? `Una nueva de ${artista.nombre}, sobre ${a.temas}` : `Una nueva de ${artista.nombre}`);
  const receta: RecetaDeArtista = {
    artistaId: artista.id,
    estilo: comoSuena(a),
    conVoz,
    energia,
    frase,
    paraElMotor: fraseParaElMotor(a, { frase: propia || undefined, bpm }),
  };
  if (conVoz) receta.idioma = a.idioma || 'es';
  if (bpm !== undefined) receta.bpm = bpm;
  if (a.nunca) receta.evitar = a.nunca;
  return receta;
}

/** Los campos de `Receta` de una receta de artista (sin `paraElMotor` ni `evitar`). */
export function soloReceta(r: RecetaDeArtista): Pick<Receta, 'artistaId' | 'estilo' | 'conVoz' | 'idioma' | 'bpm' | 'energia' | 'frase'> {
  const { paraElMotor: _m, evitar: _e, ...resto } = r;
  return resto;
}
