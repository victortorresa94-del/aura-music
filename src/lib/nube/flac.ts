/**
 * FLAC de 16 bits, escrito y leído en TypeScript.
 *
 * El audio viaja a la nube en FLAC porque es sin pérdidas y pesa bastante
 * menos que el PCM de 16 bits que ya guardamos en IndexedDB (medido en
 * `flac.test.ts`: una guitarra rasgueada baja a menos de la mitad y el
 * silencio entre tomas casi no ocupa). Sin pérdidas de verdad: lo que se baja
 * en el otro móvil es, muestra a muestra, lo que se grabó en este.
 *
 * Por qué propio y no una librería:
 *   · las que hay son compilaciones de libFLAC a WebAssembly de casi 1 MB, o
 *     solo leen;
 *   · `decodeAudioData` del navegador sí lee FLAC, pero remuestrea a la
 *     frecuencia del contexto y no corre en los tests;
 *   · el subconjunto que hace falta es pequeño: predictores fijos (orden 0 a
 *     4, los de la especificación), residuo en Rice con particiones, y bloque
 *     constante o literal cuando sale más barato. Lo que escribe es FLAC
 *     normal: cualquier reproductor lo abre.
 *
 * El lector entiende además LPC, mid/side y el escape de Rice, para poder abrir
 * un FLAC hecho por otro programa si algún día hace falta.
 *
 * Formato: https://www.rfc-editor.org/rfc/rfc9639 (FLAC, RFC 9639).
 */

/** El audio tal como vive en IndexedDB: enteros de 16 bits, los canales seguidos (no entrelazados). */
export interface Pcm16 {
  pcm: Int16Array;
  canales: number;
  /** Muestras por canal. */
  muestras: number;
  sampleRate: number;
}

export class ErrorFlac extends Error {}

const TAM_BLOQUE = 4096;
/** Hasta 2^6 particiones de Rice por bloque: de 64 muestras con bloques de 4096. */
const MAX_ORDEN_PARTICION = 6;
/** Con parámetros de 4 bits, el 15 es el escape. */
const MAX_RICE = 14;
/** Cada cuántos bloques se suelta el hilo, para que la app no se trabe subiendo una toma larga. */
const BLOQUES_POR_PAUSA = 24;

/* -------------------------------------------------------------------------- */
/* CRC                                                                        */
/* -------------------------------------------------------------------------- */

const CRC8 = new Uint8Array(256);
const CRC16 = new Uint16Array(256);
for (let i = 0; i < 256; i++) {
  let c8 = i;
  for (let b = 0; b < 8; b++) c8 = c8 & 0x80 ? ((c8 << 1) ^ 0x07) & 0xff : (c8 << 1) & 0xff;
  CRC8[i] = c8;
  let c16 = i << 8;
  for (let b = 0; b < 8; b++) c16 = c16 & 0x8000 ? ((c16 << 1) ^ 0x8005) & 0xffff : (c16 << 1) & 0xffff;
  CRC16[i] = c16;
}

function crc8(datos: Uint8Array, desde: number, hasta: number): number {
  let c = 0;
  for (let i = desde; i < hasta; i++) c = CRC8[c ^ datos[i]];
  return c;
}

function crc16(datos: Uint8Array, desde: number, hasta: number): number {
  let c = 0;
  for (let i = desde; i < hasta; i++) c = ((c << 8) & 0xffff) ^ CRC16[(c >>> 8) ^ datos[i]];
  return c;
}

/* -------------------------------------------------------------------------- */
/* Escribir bits                                                              */
/* -------------------------------------------------------------------------- */

class Escritor {
  datos: Uint8Array;
  pos = 0;
  private acc = 0;
  private nb = 0;

  constructor(capacidad: number) {
    this.datos = new Uint8Array(Math.max(64, capacidad));
  }

  private byte(b: number): void {
    if (this.pos >= this.datos.length) {
      const mas = new Uint8Array(this.datos.length * 2);
      mas.set(this.datos);
      this.datos = mas;
    }
    this.datos[this.pos++] = b;
  }

  /** `valor` sin signo, en `n` bits (n ≤ 32), el más significativo primero. */
  bits(valor: number, n: number): void {
    let quedan = n;
    while (quedan > 0) {
      const libres = 8 - this.nb;
      const toma = quedan < libres ? quedan : libres;
      quedan -= toma;
      const trozo = (valor >>> quedan) & ((1 << toma) - 1);
      this.acc = (this.acc << toma) | trozo;
      this.nb += toma;
      if (this.nb === 8) {
        this.byte(this.acc);
        this.acc = 0;
        this.nb = 0;
      }
    }
  }

  conSigno(valor: number, n: number): void {
    this.bits(n === 32 ? valor >>> 0 : valor & ((1 << n) - 1), n);
  }

  /** `q` ceros y un uno: la parte unaria de Rice. */
  unario(q: number): void {
    let quedan = q;
    while (quedan > 0) {
      const libres = 8 - this.nb;
      const toma = quedan < libres ? quedan : libres;
      this.acc = (this.acc << toma) & 0xff;
      this.nb += toma;
      quedan -= toma;
      if (this.nb === 8) {
        this.byte(this.acc);
        this.acc = 0;
        this.nb = 0;
      }
    }
    this.bits(1, 1);
  }

  alinear(): void {
    if (this.nb > 0) this.bits(0, 8 - this.nb);
  }

  bytes(): Uint8Array {
    return this.datos.subarray(0, this.pos);
  }
}

/* -------------------------------------------------------------------------- */
/* Codificar                                                                  */
/* -------------------------------------------------------------------------- */

const zigzag = (v: number) => (v >= 0 ? v * 2 : -v * 2 - 1);

/** Residuo de un predictor fijo de orden `orden` (los de la especificación). */
function residuoFijo(x: Int16Array, orden: number, salida: Int32Array): void {
  const n = x.length;
  for (let i = orden; i < n; i++) {
    let e: number;
    switch (orden) {
      case 0:
        e = x[i];
        break;
      case 1:
        e = x[i] - x[i - 1];
        break;
      case 2:
        e = x[i] - 2 * x[i - 1] + x[i - 2];
        break;
      case 3:
        e = x[i] - 3 * x[i - 1] + 3 * x[i - 2] - x[i - 3];
        break;
      default:
        e = x[i] - 4 * x[i - 1] + 6 * x[i - 2] - 4 * x[i - 3] + x[i - 4];
    }
    salida[i - orden] = e;
  }
}

/** El orden de predictor que deja el residuo más pequeño (suma de valores absolutos, como hace libFLAC). */
function mejorOrden(x: Int16Array): number {
  const n = x.length;
  if (n < 5) return 0;
  let s0 = 0;
  let s1 = 0;
  let s2 = 0;
  let s3 = 0;
  let s4 = 0;
  for (let i = 4; i < n; i++) {
    const a = x[i];
    const e1 = a - x[i - 1];
    const e2 = e1 - (x[i - 1] - x[i - 2]);
    const e3 = e2 - (x[i - 1] - 2 * x[i - 2] + x[i - 3]);
    const e4 = e3 - (x[i - 1] - 3 * x[i - 2] + 3 * x[i - 3] - x[i - 4]);
    s0 += a < 0 ? -a : a;
    s1 += e1 < 0 ? -e1 : e1;
    s2 += e2 < 0 ? -e2 : e2;
    s3 += e3 < 0 ? -e3 : e3;
    s4 += e4 < 0 ? -e4 : e4;
  }
  const sumas = [s0, s1, s2, s3, s4];
  let mejor = 0;
  for (let o = 1; o < 5; o++) if (sumas[o] < sumas[mejor]) mejor = o;
  return mejor;
}

function riceEstimado(suma: number, n: number): number {
  if (n === 0 || suma === 0) return 0;
  const media = suma / n;
  const k = Math.floor(Math.log2(media));
  return Math.max(0, Math.min(MAX_RICE, k));
}

interface Residuo {
  ordenParticion: number;
  parametros: number[];
  bits: number;
}

/**
 * Elige cuántas particiones de Rice y el parámetro de cada una. Primero con
 * una estimación barata (sumas acumuladas), después afina el parámetro de cada
 * partición con el coste exacto.
 */
function elegirRice(u: Uint32Array, n: number, tamBloque: number, orden: number): Residuo {
  const acumulado = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) acumulado[i + 1] = acumulado[i] + u[i];

  let mejorP = 0;
  let mejorCoste = Infinity;
  for (let p = 0; p <= MAX_ORDEN_PARTICION; p++) {
    const partes = 1 << p;
    if (tamBloque % partes !== 0) break;
    const tam = tamBloque / partes;
    if (tam <= orden) break;
    let coste = 0;
    for (let j = 0; j < partes; j++) {
      const desde = j === 0 ? 0 : j * tam - orden;
      const hasta = (j + 1) * tam - orden;
      const cuantas = hasta - desde;
      const suma = acumulado[hasta] - acumulado[desde];
      const k = riceEstimado(suma, cuantas);
      coste += 4 + cuantas * (k + 1) + suma / 2 ** k;
    }
    if (coste < mejorCoste) {
      mejorCoste = coste;
      mejorP = p;
    }
  }

  const partes = 1 << mejorP;
  const tam = tamBloque / partes;
  const parametros: number[] = [];
  let bits = 6;
  for (let j = 0; j < partes; j++) {
    const desde = j === 0 ? 0 : j * tam - orden;
    const hasta = (j + 1) * tam - orden;
    const cuantas = hasta - desde;
    const k0 = riceEstimado(acumulado[hasta] - acumulado[desde], cuantas);
    let mejorK = k0;
    let mejorBits = Infinity;
    for (let k = Math.max(0, k0 - 1); k <= Math.min(MAX_RICE, k0 + 1); k++) {
      let b = cuantas * (k + 1);
      for (let i = desde; i < hasta; i++) b += u[i] >>> k;
      if (b < mejorBits) {
        mejorBits = b;
        mejorK = k;
      }
    }
    parametros.push(mejorK);
    bits += 4 + mejorBits;
  }
  return { ordenParticion: mejorP, parametros, bits };
}

function escribirSubbloque(w: Escritor, x: Int16Array): void {
  const n = x.length;
  // Constante: el silencio digital (y cualquier tramo plano) en 2 bytes.
  let constante = true;
  for (let i = 1; i < n; i++) {
    if (x[i] !== x[0]) {
      constante = false;
      break;
    }
  }
  if (constante) {
    w.bits(0, 1);
    w.bits(0b000000, 6);
    w.bits(0, 1);
    w.conSigno(x[0], 16);
    return;
  }

  const orden = mejorOrden(x);
  const e = new Int32Array(n);
  residuoFijo(x, orden, e);
  const cuantos = n - orden;
  const u = new Uint32Array(cuantos);
  for (let i = 0; i < cuantos; i++) u[i] = zigzag(e[i]);
  const rice = elegirRice(u, cuantos, n, orden);

  // Si comprimir no compensa (ruido blanco, por ejemplo), va tal cual.
  if (orden * 16 + rice.bits >= n * 16) {
    w.bits(0, 1);
    w.bits(0b000001, 6);
    w.bits(0, 1);
    for (let i = 0; i < n; i++) w.conSigno(x[i], 16);
    return;
  }

  w.bits(0, 1);
  w.bits(0b001000 | orden, 6);
  w.bits(0, 1);
  for (let i = 0; i < orden; i++) w.conSigno(x[i], 16);
  w.bits(0b00, 2); // Rice con parámetros de 4 bits
  w.bits(rice.ordenParticion, 4);
  const partes = 1 << rice.ordenParticion;
  const tam = n / partes;
  for (let j = 0; j < partes; j++) {
    const desde = j === 0 ? 0 : j * tam - orden;
    const hasta = (j + 1) * tam - orden;
    const k = rice.parametros[j];
    w.bits(k, 4);
    const mascara = (1 << k) - 1;
    for (let i = desde; i < hasta; i++) {
      const v = u[i];
      w.unario(v >>> k);
      if (k > 0) w.bits(v & mascara, k);
    }
  }
}

/** Número de bloque en el «UTF-8» de FLAC. */
function escribirNumero(w: Escritor, n: number): void {
  if (n < 0x80) {
    w.bits(n, 8);
    return;
  }
  const bytes = n < 0x800 ? 2 : n < 0x10000 ? 3 : n < 0x200000 ? 4 : n < 0x4000000 ? 5 : 6;
  const cabeza = (0xff00 >> bytes) & 0xff;
  w.bits(cabeza | (n >>> (6 * (bytes - 1))), 8);
  for (let i = bytes - 2; i >= 0; i--) w.bits(0x80 | ((n >>> (6 * i)) & 0x3f), 8);
}

function codigoDeFrecuencia(sr: number): number {
  switch (sr) {
    case 88200:
      return 0b0001;
    case 176400:
      return 0b0010;
    case 192000:
      return 0b0011;
    case 8000:
      return 0b0100;
    case 16000:
      return 0b0101;
    case 22050:
      return 0b0110;
    case 24000:
      return 0b0111;
    case 32000:
      return 0b1000;
    case 44100:
      return 0b1001;
    case 48000:
      return 0b1010;
    case 96000:
      return 0b1011;
    default:
      return 0b0000; // la de STREAMINFO
  }
}

const ceder = () => new Promise<void>((resolver) => setTimeout(resolver, 0));

/** Codifica el PCM de 16 bits en un FLAC completo. Suelta el hilo cada pocos bloques. */
export async function codificarFlac(audio: Pcm16, opciones: { pausas?: boolean } = {}): Promise<Uint8Array> {
  const { pcm, canales, muestras, sampleRate } = audio;
  if (canales < 1 || canales > 8) throw new ErrorFlac(`FLAC admite de 1 a 8 canales, no ${canales}`);
  if (pcm.length < canales * muestras) throw new ErrorFlac('Faltan muestras');
  if (!(sampleRate > 0 && sampleRate < 1 << 20)) throw new ErrorFlac(`Frecuencia imposible: ${sampleRate}`);

  const w = new Escritor(canales * muestras * 2 + 4096);
  // «fLaC» y STREAMINFO (34 bytes), el único bloque de metadatos.
  w.bits(0x664c6143, 32);
  w.bits(1, 1); // último bloque de metadatos
  w.bits(0, 7); // STREAMINFO
  w.bits(34, 24);
  w.bits(TAM_BLOQUE, 16);
  w.bits(TAM_BLOQUE, 16);
  w.bits(0, 24); // tamaño mínimo de bloque comprimido: desconocido
  w.bits(0, 24); // y máximo
  w.bits(sampleRate, 20);
  w.bits(canales - 1, 3);
  w.bits(16 - 1, 5);
  w.bits(Math.floor(muestras / 2 ** 32), 4);
  w.bits(muestras >>> 0, 32);
  for (let i = 0; i < 4; i++) w.bits(0, 32); // MD5 sin calcular (permitido)

  const codFrecuencia = codigoDeFrecuencia(sampleRate);
  const canal = new Int16Array(TAM_BLOQUE);
  let bloque = 0;
  for (let inicio = 0; inicio < muestras; inicio += TAM_BLOQUE, bloque++) {
    const n = Math.min(TAM_BLOQUE, muestras - inicio);
    const empieza = w.pos;
    w.bits(0b11111111111110, 14);
    w.bits(0, 1);
    w.bits(0, 1); // bloques de tamaño fijo
    w.bits(0b0111, 4); // tamaño en 16 bits al final de la cabecera
    w.bits(codFrecuencia, 4);
    w.bits(canales - 1, 4); // canales independientes
    w.bits(0b100, 3); // 16 bits por muestra
    w.bits(0, 1);
    escribirNumero(w, bloque);
    w.bits(n - 1, 16);
    w.bits(crc8(w.datos, empieza, w.pos), 8);
    for (let c = 0; c < canales; c++) {
      const trozo = n === TAM_BLOQUE ? canal : new Int16Array(n);
      trozo.set(pcm.subarray(c * muestras + inicio, c * muestras + inicio + n));
      escribirSubbloque(w, trozo);
    }
    w.alinear();
    w.bits(crc16(w.datos, empieza, w.pos), 16);
    if (opciones.pausas !== false && bloque % BLOQUES_POR_PAUSA === BLOQUES_POR_PAUSA - 1) await ceder();
  }
  return w.bytes().slice();
}

/* -------------------------------------------------------------------------- */
/* Leer                                                                       */
/* -------------------------------------------------------------------------- */

class Lector {
  pos = 0; // en bits

  constructor(readonly d: Uint8Array) {}

  get byte(): number {
    return this.pos >>> 3;
  }

  quedan(): number {
    return this.d.length * 8 - this.pos;
  }

  bits(n: number): number {
    if (n > this.quedan()) throw new ErrorFlac('El FLAC se corta a medias');
    if (n === 0) return 0;
    if (n <= 24) {
      // Lo normal (el resto de Rice, las cabeceras): una ventana de 4 bytes y
      // un desplazamiento, sin bucle. Leer era lo que más tardaba.
      const i = this.pos >>> 3;
      const d = this.d;
      const ventana = (d[i] << 24) | (d[i + 1] << 16) | (d[i + 2] << 8) | d[i + 3];
      const v = (ventana << (this.pos & 7)) >>> (32 - n);
      this.pos += n;
      return v;
    }
    let v = 0;
    let quedan = n;
    while (quedan > 0) {
      const usados = this.pos & 7;
      const libres = 8 - usados;
      const toma = quedan < libres ? quedan : libres;
      const trozo = (this.d[this.pos >>> 3] >>> (libres - toma)) & ((1 << toma) - 1);
      v = v * (1 << toma) + trozo;
      this.pos += toma;
      quedan -= toma;
    }
    return v;
  }

  conSigno(n: number): number {
    const v = this.bits(n);
    return v >= 2 ** (n - 1) ? v - 2 ** n : v;
  }

  unario(): number {
    let q = 0;
    for (;;) {
      if (this.pos >= this.d.length * 8) throw new ErrorFlac('El FLAC se corta a medias');
      const usados = this.pos & 7;
      const byte = (this.d[this.pos >>> 3] << usados) & 0xff;
      if (byte === 0) {
        q += 8 - usados;
        this.pos += 8 - usados;
        continue;
      }
      const ceros = Math.clz32(byte) - 24;
      q += ceros;
      this.pos += ceros + 1;
      return q;
    }
  }

  alinear(): void {
    this.pos = (this.pos + 7) & ~7;
  }
}

function leerNumero(r: Lector): number {
  const primero = r.bits(8);
  if (primero < 0x80) return primero;
  let extra = 0;
  let mascara = 0x40;
  while (primero & mascara) {
    extra++;
    mascara >>= 1;
  }
  let v = primero & (mascara - 1);
  for (let i = 0; i < extra; i++) v = v * 64 + (r.bits(8) & 0x3f);
  return v;
}

function leerResiduo(r: Lector, n: number, orden: number, salida: Int32Array): void {
  const metodo = r.bits(2);
  if (metodo > 1) throw new ErrorFlac('Codificación de residuo desconocida');
  const bitsParam = metodo === 0 ? 4 : 5;
  const escape = metodo === 0 ? 15 : 31;
  const ordenP = r.bits(4);
  const partes = 1 << ordenP;
  const tam = n >> ordenP;
  let i = orden;
  for (let j = 0; j < partes; j++) {
    const cuantas = j === 0 ? tam - orden : tam;
    const k = r.bits(bitsParam);
    if (k === escape) {
      const crudos = r.bits(5);
      for (let m = 0; m < cuantas; m++) salida[i++] = crudos === 0 ? 0 : r.conSigno(crudos);
      continue;
    }
    for (let m = 0; m < cuantas; m++) {
      const q = r.unario();
      const uu = k > 0 ? q * 2 ** k + r.bits(k) : q;
      salida[i++] = uu % 2 === 0 ? uu / 2 : -(uu + 1) / 2;
    }
  }
}

function leerSubbloque(r: Lector, n: number, bps: number, salida: Int32Array): void {
  if (r.bits(1) !== 0) throw new ErrorFlac('Subbloque corrupto');
  const tipo = r.bits(6);
  let perdidos = 0;
  if (r.bits(1) === 1) perdidos = r.unario() + 1;
  const b = bps - perdidos;

  if (tipo === 0) {
    salida.fill(r.conSigno(b), 0, n);
  } else if (tipo === 1) {
    for (let i = 0; i < n; i++) salida[i] = r.conSigno(b);
  } else if (tipo >= 8 && tipo <= 12) {
    const orden = tipo & 7;
    for (let i = 0; i < orden; i++) salida[i] = r.conSigno(b);
    leerResiduo(r, n, orden, salida);
    for (let i = orden; i < n; i++) {
      switch (orden) {
        case 1:
          salida[i] += salida[i - 1];
          break;
        case 2:
          salida[i] += 2 * salida[i - 1] - salida[i - 2];
          break;
        case 3:
          salida[i] += 3 * salida[i - 1] - 3 * salida[i - 2] + salida[i - 3];
          break;
        case 4:
          salida[i] += 4 * salida[i - 1] - 6 * salida[i - 2] + 4 * salida[i - 3] - salida[i - 4];
          break;
        default:
          break;
      }
    }
  } else if (tipo >= 32) {
    const orden = (tipo & 31) + 1;
    for (let i = 0; i < orden; i++) salida[i] = r.conSigno(b);
    const precision = r.bits(4) + 1;
    if (precision === 16) throw new ErrorFlac('Precisión LPC no válida');
    const desplazamiento = r.conSigno(5);
    const coef: number[] = [];
    for (let i = 0; i < orden; i++) coef.push(r.conSigno(precision));
    leerResiduo(r, n, orden, salida);
    for (let i = orden; i < n; i++) {
      let suma = 0;
      for (let j = 0; j < orden; j++) suma += coef[j] * salida[i - 1 - j];
      salida[i] += Math.floor(suma / 2 ** desplazamiento);
    }
  } else {
    throw new ErrorFlac(`Subbloque de tipo reservado: ${tipo}`);
  }
  if (perdidos > 0) for (let i = 0; i < n; i++) salida[i] *= 2 ** perdidos;
}

function tamDeBloque(codigo: number, r: Lector): number {
  if (codigo === 1) return 192;
  if (codigo >= 2 && codigo <= 5) return 576 * 2 ** (codigo - 2);
  if (codigo === 6) return r.bits(8) + 1;
  if (codigo === 7) return r.bits(16) + 1;
  if (codigo >= 8) return 256 * 2 ** (codigo - 8);
  throw new ErrorFlac('Tamaño de bloque reservado');
}

/** Lee un FLAC de 16 bits (o menos) y lo devuelve como PCM de 16 bits con los canales seguidos. */
export async function decodificarFlac(datos: Uint8Array, opciones: { pausas?: boolean } = {}): Promise<Pcm16> {
  const r = new Lector(datos);
  if (datos.length < 42 || r.bits(32) !== 0x664c6143) throw new ErrorFlac('No es un FLAC');

  let sampleRate = 0;
  let canales = 0;
  let bps = 0;
  let total = 0;
  for (let ultimo = 0; !ultimo; ) {
    ultimo = r.bits(1);
    const tipo = r.bits(7);
    const largo = r.bits(24);
    const fin = r.pos + largo * 8;
    if (tipo === 0) {
      r.bits(16);
      r.bits(16);
      r.bits(24);
      r.bits(24);
      sampleRate = r.bits(20);
      canales = r.bits(3) + 1;
      bps = r.bits(5) + 1;
      total = r.bits(4) * 2 ** 32 + r.bits(32);
    }
    r.pos = fin;
  }
  if (!sampleRate || !canales) throw new ErrorFlac('Falta STREAMINFO');
  if (bps > 16) throw new ErrorFlac(`Solo FLAC de 16 bits o menos, no de ${bps}`);

  const salida = new Int16Array(total * canales);
  const escala = 2 ** (16 - bps);
  const bloques: Int32Array[] = [];
  let hecho = 0;
  let bloque = 0;
  while (hecho < total && r.quedan() > 0) {
    r.alinear();
    const empieza = r.byte;
    if (r.bits(14) !== 0b11111111111110) throw new ErrorFlac('Se ha perdido la sincronía del FLAC');
    r.bits(2);
    const codTam = r.bits(4);
    const codFrecuencia = r.bits(4);
    const asignacion = r.bits(4);
    const codBits = r.bits(3);
    r.bits(1);
    leerNumero(r);
    const n = tamDeBloque(codTam, r);
    if (codFrecuencia === 12) r.bits(8);
    else if (codFrecuencia === 13 || codFrecuencia === 14) r.bits(16);
    const crcCabecera = r.bits(8);
    if (crc8(datos, empieza, r.byte - 1) !== crcCabecera) throw new ErrorFlac('Cabecera de bloque corrupta');
    const bitsDelBloque = codBits === 0 ? bps : ([0, 8, 12, 0, 16, 20, 24, 32][codBits] ?? bps);
    if (!bitsDelBloque || bitsDelBloque > 16) throw new ErrorFlac('Tamaño de muestra no admitido');

    const nCanales = asignacion < 8 ? asignacion + 1 : 2;
    if (nCanales !== canales) throw new ErrorFlac('El número de canales cambia a mitad del FLAC');
    while (bloques.length < nCanales) bloques.push(new Int32Array(TAM_BLOQUE * 16));
    for (let c = 0; c < nCanales; c++) {
      if (bloques[c].length < n) bloques[c] = new Int32Array(n);
      // El canal de diferencias (side) lleva un bit más.
      const lateral = (asignacion === 8 && c === 1) || (asignacion === 9 && c === 0) || (asignacion === 10 && c === 1);
      leerSubbloque(r, n, bitsDelBloque + (lateral ? 1 : 0), bloques[c]);
    }
    r.alinear();
    const crcBloque = r.bits(16);
    if (crc16(datos, empieza, r.byte - 2) !== crcBloque) throw new ErrorFlac('Bloque de audio corrupto');

    const a = bloques[0];
    const b = bloques[1];
    if (asignacion === 8) for (let i = 0; i < n; i++) b[i] = a[i] - b[i];
    else if (asignacion === 9) for (let i = 0; i < n; i++) a[i] += b[i];
    else if (asignacion === 10) {
      for (let i = 0; i < n; i++) {
        const lado = b[i];
        const medio = a[i] * 2 + (lado & 1);
        a[i] = (medio + lado) >> 1;
        b[i] = (medio - lado) >> 1;
      }
    }
    const cuantas = Math.min(n, total - hecho);
    for (let c = 0; c < canales; c++) {
      const destino = c * total + hecho;
      const origen = bloques[c];
      for (let i = 0; i < cuantas; i++) salida[destino + i] = origen[i] * escala;
    }
    hecho += cuantas;
    bloque++;
    if (opciones.pausas !== false && bloque % BLOQUES_POR_PAUSA === 0) await ceder();
  }
  if (hecho < total) throw new ErrorFlac('Al FLAC le faltan muestras');
  return { pcm: salida, canales, muestras: total, sampleRate };
}
