/**
 * Los paquetes de muestras: de dónde salen, con qué licencia, cuánto pesan y
 * a quién hay que dar las gracias. Se sirven desde `public/samples/<id>/`, se
 * bajan al abrir el instrumento (la primera carga de la app baja 0 MB) y se
 * guardan en Cache Storage (`aura-samples-v1`) para tocar sin red.
 *
 * Regla de la casa: solo CC0, dominio público o CC-BY con crédito. Nada GPL,
 * NC ni SA. Si la licencia de una fuente no está clara, no entra: el
 * instrumento suena sintetizado (ver `sinte.ts`).
 */

export type PaqueteId = 'piano' | 'piano-electrico' | 'cuerdas' | 'guitarra' | 'bajo';

export type Licencia = 'CC0-1.0' | 'dominio-publico' | 'CC-BY-4.0' | 'CC-BY-3.0';

export interface ArchivoMuestra {
  /** Nombre del fichero dentro de `public/samples/<id>/`. */
  nombre: string;
  /** Nota MIDI que suena en la muestra. */
  midi: number;
  /** Capa de fuerza, si el paquete tiene más de una. */
  capa?: 'p' | 'f';
  bytes: number;
}

export interface Paquete {
  id: PaqueteId;
  /** Cómo se llama en la app. */
  nombre: string;
  /** La obra original, como la nombra su autor. */
  obra: string;
  autor: string;
  /** Página de donde se descargó. */
  origen: string;
  licencia: Licencia;
  urlLicencia: string;
  /** Texto de crédito (obligatorio con CC-BY; vacío con CC0 y dominio público). */
  creditos: string;
  archivos: ArchivoMuestra[];
  /** Ajustes de la envolvente al tocarlo. */
  sonido: { ataque: number; suelta: number };
}

/**
 * Lista de paquetes disponibles. Un instrumento cuyo paquete no está aquí
 * suena con su síntesis. Licencias comprobadas en la fuente el 17-nov-2026
 * (detalle y citas en `public/samples/LICENCIAS.md`).
 *
 * Todas las muestras son MP3 mono a 44,1 kHz, reafinadas al temperamento
 * igual, con el ataque en la primera muestra y unos 3,2 MB en total.
 */
export const PAQUETES: Paquete[] = [
  {
    id: 'piano',
    nombre: 'Piano de cola',
    obra: 'Piano de cola (Salamander Grand Piano V3, Yamaha C5)',
    autor: 'Alexander Holm',
    origen: 'https://github.com/sfzinstruments/SalamanderGrandPiano/tree/master/Samples',
    licencia: 'CC-BY-3.0',
    urlLicencia: 'https://creativecommons.org/licenses/by/3.0/',
    creditos: 'Salamander Grand Piano V3, de Alexander Holm, con licencia CC BY 3.0 (https://archive.org/details/SalamanderGrandPianoV3). Modificado: notas recortadas, pasadas a mono, reafinadas al temperamento igual, normalizadas y convertidas a MP3.',
    sonido: { ataque: 0.002, suelta: 0.35 },
    archivos: [
      { nombre: '36-p.mp3', midi: 36, capa: 'p', bytes: 39389 },
      { nombre: '36-f.mp3', midi: 36, capa: 'f', bytes: 39414 },
      { nombre: '39-p.mp3', midi: 39, capa: 'p', bytes: 38374 },
      { nombre: '39-f.mp3', midi: 39, capa: 'f', bytes: 38166 },
      { nombre: '42-p.mp3', midi: 42, capa: 'p', bytes: 38815 },
      { nombre: '42-f.mp3', midi: 42, capa: 'f', bytes: 38035 },
      { nombre: '45-p.mp3', midi: 45, capa: 'p', bytes: 40013 },
      { nombre: '45-f.mp3', midi: 45, capa: 'f', bytes: 37722 },
      { nombre: '48-p.mp3', midi: 48, capa: 'p', bytes: 36397 },
      { nombre: '48-f.mp3', midi: 48, capa: 'f', bytes: 34305 },
      { nombre: '51-p.mp3', midi: 51, capa: 'p', bytes: 36183 },
      { nombre: '51-f.mp3', midi: 51, capa: 'f', bytes: 34502 },
      { nombre: '54-p.mp3', midi: 54, capa: 'p', bytes: 39155 },
      { nombre: '54-f.mp3', midi: 54, capa: 'f', bytes: 36866 },
      { nombre: '57-p.mp3', midi: 57, capa: 'p', bytes: 39831 },
      { nombre: '57-f.mp3', midi: 57, capa: 'f', bytes: 36814 },
      { nombre: '60-p.mp3', midi: 60, capa: 'p', bytes: 37228 },
      { nombre: '60-f.mp3', midi: 60, capa: 'f', bytes: 31526 },
      { nombre: '63-p.mp3', midi: 63, capa: 'p', bytes: 33329 },
      { nombre: '63-f.mp3', midi: 63, capa: 'f', bytes: 29651 },
      { nombre: '66-p.mp3', midi: 66, capa: 'p', bytes: 36865 },
      { nombre: '66-f.mp3', midi: 66, capa: 'f', bytes: 33035 },
      { nombre: '69-p.mp3', midi: 69, capa: 'p', bytes: 38583 },
      { nombre: '69-f.mp3', midi: 69, capa: 'f', bytes: 35136 },
      { nombre: '72-p.mp3', midi: 72, capa: 'p', bytes: 40403 },
      { nombre: '72-f.mp3', midi: 72, capa: 'f', bytes: 34696 },
      { nombre: '75-p.mp3', midi: 75, capa: 'p', bytes: 38088 },
      { nombre: '75-f.mp3', midi: 75, capa: 'f', bytes: 33615 },
      { nombre: '78-p.mp3', midi: 78, capa: 'p', bytes: 35559 },
      { nombre: '78-f.mp3', midi: 78, capa: 'f', bytes: 30819 },
      { nombre: '81-p.mp3', midi: 81, capa: 'p', bytes: 41417 },
      { nombre: '81-f.mp3', midi: 81, capa: 'f', bytes: 35998 },
      { nombre: '84-p.mp3', midi: 84, capa: 'p', bytes: 42250 },
      { nombre: '84-f.mp3', midi: 84, capa: 'f', bytes: 38061 },
      { nombre: '87-p.mp3', midi: 87, capa: 'p', bytes: 41600 },
      { nombre: '87-f.mp3', midi: 87, capa: 'f', bytes: 39051 },
      { nombre: '90-p.mp3', midi: 90, capa: 'p', bytes: 41678 },
      { nombre: '90-f.mp3', midi: 90, capa: 'f', bytes: 38478 },
      { nombre: '93-p.mp3', midi: 93, capa: 'p', bytes: 39805 },
      { nombre: '93-f.mp3', midi: 93, capa: 'f', bytes: 33901 },
      { nombre: '96-p.mp3', midi: 96, capa: 'p', bytes: 39337 },
      { nombre: '96-f.mp3', midi: 96, capa: 'f', bytes: 35455 },
    ],
  },
  {
    id: 'piano-electrico',
    nombre: 'Piano eléctrico FM',
    obra: 'Piano eléctrico FM (Yamaha TX81Z «FM Piano», VCSL)',
    autor: 'Versilian Studios (Versilian Community Sample Library)',
    origen: 'https://github.com/sgossner/VCSL/tree/master/Electrophones/TX81Z/FM%20Piano',
    licencia: 'CC0-1.0',
    urlLicencia: 'https://creativecommons.org/publicdomain/zero/1.0/',
    creditos: '',
    sonido: { ataque: 0.002, suelta: 0.3 },
    archivos: [
      { nombre: '36.mp3', midi: 36, bytes: 32746 },
      { nombre: '40.mp3', midi: 40, bytes: 32199 },
      { nombre: '44.mp3', midi: 44, bytes: 32564 },
      { nombre: '48.mp3', midi: 48, bytes: 33162 },
      { nombre: '52.mp3', midi: 52, bytes: 34800 },
      { nombre: '56.mp3', midi: 56, bytes: 34462 },
      { nombre: '60.mp3', midi: 60, bytes: 34540 },
      { nombre: '64.mp3', midi: 64, bytes: 36542 },
      { nombre: '68.mp3', midi: 68, bytes: 33932 },
      { nombre: '72.mp3', midi: 72, bytes: 33933 },
      { nombre: '76.mp3', midi: 76, bytes: 35760 },
      { nombre: '80.mp3', midi: 80, bytes: 35684 },
      { nombre: '84.mp3', midi: 84, bytes: 38414 },
    ],
  },
  {
    id: 'cuerdas',
    nombre: 'Cuerdas',
    obra: 'Sección de cuerdas sostenidas (VS Chamber Orchestra: Community Edition)',
    autor: 'Versilian Studios (Sam Gossner y Simon Dalzell)',
    origen: 'https://github.com/sgossner/VSCO-2-CE/tree/master/Strings',
    licencia: 'CC0-1.0',
    urlLicencia: 'https://creativecommons.org/publicdomain/zero/1.0/',
    creditos: '',
    sonido: { ataque: 0.06, suelta: 0.45 },
    archivos: [
      { nombre: '36.mp3', midi: 36, bytes: 43299 },
      { nombre: '40.mp3', midi: 40, bytes: 42545 },
      { nombre: '43.mp3', midi: 43, bytes: 43012 },
      { nombre: '47.mp3', midi: 47, bytes: 43792 },
      { nombre: '50.mp3', midi: 50, bytes: 43039 },
      { nombre: '52.mp3', midi: 52, bytes: 42701 },
      { nombre: '55.mp3', midi: 55, bytes: 48993 },
      { nombre: '59.mp3', midi: 59, bytes: 44574 },
      { nombre: '62.mp3', midi: 62, bytes: 44365 },
      { nombre: '65.mp3', midi: 65, bytes: 46341 },
      { nombre: '69.mp3', midi: 69, bytes: 43482 },
      { nombre: '72.mp3', midi: 72, bytes: 45821 },
      { nombre: '76.mp3', midi: 76, bytes: 58530 },
      { nombre: '79.mp3', midi: 79, bytes: 61624 },
      { nombre: '83.mp3', midi: 83, bytes: 62670 },
    ],
  },
  {
    id: 'guitarra',
    nombre: 'Guitarra española',
    obra: 'Guitarra española de nailon (FreePats Spanish Classical Guitar)',
    autor: 'Proyecto FreePats (freepats.zenvoid.org)',
    origen: 'https://freepats.zenvoid.org/Guitar/SpanishClassicalGuitar/SpanishClassicalGuitar-SFZ+FLAC-20190618.7z',
    licencia: 'CC0-1.0',
    urlLicencia: 'https://creativecommons.org/publicdomain/zero/1.0/',
    creditos: '',
    sonido: { ataque: 0.001, suelta: 0.28 },
    archivos: [
      { nombre: '40.mp3', midi: 40, bytes: 19359 },
      { nombre: '43.mp3', midi: 43, bytes: 17564 },
      { nombre: '47.mp3', midi: 47, bytes: 16443 },
      { nombre: '50.mp3', midi: 50, bytes: 16603 },
      { nombre: '53.mp3', midi: 53, bytes: 17252 },
      { nombre: '56.mp3', midi: 56, bytes: 16340 },
      { nombre: '60.mp3', midi: 60, bytes: 15614 },
      { nombre: '64.mp3', midi: 64, bytes: 18474 },
      { nombre: '67.mp3', midi: 67, bytes: 17409 },
      { nombre: '70.mp3', midi: 70, bytes: 16003 },
      { nombre: '73.mp3', midi: 73, bytes: 12417 },
      { nombre: '76.mp3', midi: 76, bytes: 11461 },
      { nombre: '79.mp3', midi: 79, bytes: 11376 },
      { nombre: '83.mp3', midi: 83, bytes: 7890 },
    ],
  },
  {
    id: 'bajo',
    nombre: 'Bajo eléctrico',
    obra: 'Bajo eléctrico (Karoryfer Growlybass, Squier Jazz Bass)',
    autor: 'Karoryfer Samples',
    origen: 'https://github.com/sfzinstruments/karoryfer.growlybass/tree/master/sustain',
    licencia: 'CC0-1.0',
    urlLicencia: 'https://creativecommons.org/publicdomain/zero/1.0/',
    creditos: '',
    sonido: { ataque: 0.002, suelta: 0.12 },
    archivos: [
      { nombre: '28.mp3', midi: 28, bytes: 22369 },
      { nombre: '30.mp3', midi: 30, bytes: 22078 },
      { nombre: '33.mp3', midi: 33, bytes: 21678 },
      { nombre: '36.mp3', midi: 36, bytes: 21965 },
      { nombre: '39.mp3', midi: 39, bytes: 22173 },
      { nombre: '42.mp3', midi: 42, bytes: 22426 },
      { nombre: '45.mp3', midi: 45, bytes: 21837 },
      { nombre: '48.mp3', midi: 48, bytes: 22123 },
      { nombre: '51.mp3', midi: 51, bytes: 23041 },
      { nombre: '54.mp3', midi: 54, bytes: 26030 },
      { nombre: '57.mp3', midi: 57, bytes: 22625 },
    ],
  },
];

export function getPaquete(id: PaqueteId | undefined): Paquete | null {
  if (!id) return null;
  return PAQUETES.find((p) => p.id === id) ?? null;
}

export function bytesDelPaquete(p: Paquete): number {
  return p.archivos.reduce((total, a) => total + a.bytes, 0);
}

export function urlDeMuestra(p: Paquete, archivo: ArchivoMuestra): string {
  return `/samples/${p.id}/${archivo.nombre}`;
}

/** Lo que exige un crédito visible (CC-BY): sale en Ajustes. */
export function paquetesConCredito(): Paquete[] {
  return PAQUETES.filter((p) => p.licencia.startsWith('CC-BY'));
}

export const NOMBRE_LICENCIA: Record<Licencia, string> = {
  'CC0-1.0': 'CC0 1.0',
  'dominio-publico': 'Dominio público',
  'CC-BY-4.0': 'CC BY 4.0',
  'CC-BY-3.0': 'CC BY 3.0',
};
