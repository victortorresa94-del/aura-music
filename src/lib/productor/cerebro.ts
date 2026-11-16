/**
 * El cerebro del productor: lo que va aprendiendo de ti.
 *
 * Vive en tu móvil, no en un servidor. Guarda poco y legible: lo que el
 * productor ha anotado de tus gustos, lo último que le has pedido, qué
 * instrumentos y estilos usas, a qué tempos y en qué tonos tocas, y tus
 * ideas. Con cada pedido viaja un resumen de unas líneas, nunca el audio.
 *
 * Todo se puede ver y borrar desde la hoja del productor: un cerebro que no
 * puedes revisar no es tuyo.
 */

export interface Nota {
  texto: string;
  fecha: string;
}

export interface IdeaRecordada {
  nombre: string;
  bpm: number;
  tonalidad: string | null;
  pistas: number;
  fecha: string;
}

export interface Cerebro {
  version: 1;
  /** Lo que el productor ha aprendido de tus gustos, con sus palabras. */
  notas: Nota[];
  /** Lo último que le has pedido. */
  pedidos: Nota[];
  /** Cuántas veces has usado cada cosa: «bajo:caminante», «ia:cuerdas», «ritmo:rumba». */
  usos: Record<string, number>;
  /** Tempos y tonalidades de tus tomas, las últimas primero. */
  tempos: number[];
  tonalidades: string[];
  /** Tus ideas, por id de proyecto. */
  ideas: Record<string, IdeaRecordada>;
}

export const CLAVE_CEREBRO = 'aura-music:cerebro';
const MAX_NOTAS = 40;
const MAX_PEDIDOS = 15;
const MAX_SERIE = 20;
const MAX_IDEAS = 30;

export function cerebroVacio(): Cerebro {
  return { version: 1, notas: [], pedidos: [], usos: {}, tempos: [], tonalidades: [], ideas: {} };
}

const hoy = () => new Date().toISOString().slice(0, 10);
const normal = (texto: string) => texto.trim().toLowerCase().replace(/\s+/g, ' ');

/** Lee el cerebro guardado. Si no hay, o está roto, empieza de cero. */
export function leerCerebro(texto: string | null): Cerebro {
  if (!texto) return cerebroVacio();
  try {
    const datos = JSON.parse(texto) as Partial<Cerebro>;
    if (datos.version !== 1) return cerebroVacio();
    return { ...cerebroVacio(), ...datos } as Cerebro;
  } catch {
    return cerebroVacio();
  }
}

export function apuntarPedido(cerebro: Cerebro, texto: string): Cerebro {
  const pedido = texto.trim().slice(0, 200);
  if (!pedido) return cerebro;
  return { ...cerebro, pedidos: [{ texto: pedido, fecha: hoy() }, ...cerebro.pedidos].slice(0, MAX_PEDIDOS) };
}

/** Añade lo aprendido sin repetir lo que ya sabía (sin mirar mayúsculas ni espacios). */
export function apuntarNotas(cerebro: Cerebro, notas: string[]): Cerebro {
  const sabidas = new Set(cerebro.notas.map((n) => normal(n.texto)));
  const nuevas = notas
    .map((n) => n.trim().slice(0, 160))
    .filter((n) => n && !sabidas.has(normal(n)))
    .map((texto) => ({ texto, fecha: hoy() }));
  if (nuevas.length === 0) return cerebro;
  return { ...cerebro, notas: [...nuevas, ...cerebro.notas].slice(0, MAX_NOTAS) };
}

export function apuntarUso(cerebro: Cerebro, clave: string): Cerebro {
  return { ...cerebro, usos: { ...cerebro.usos, [clave]: (cerebro.usos[clave] ?? 0) + 1 } };
}

export function apuntarToma(cerebro: Cerebro, toma: { bpm: number; tonalidad: string | null }): Cerebro {
  return {
    ...cerebro,
    tempos: [Math.round(toma.bpm), ...cerebro.tempos].slice(0, MAX_SERIE),
    tonalidades: toma.tonalidad ? [toma.tonalidad, ...cerebro.tonalidades].slice(0, MAX_SERIE) : cerebro.tonalidades,
  };
}

export function apuntarIdea(cerebro: Cerebro, id: string, idea: Omit<IdeaRecordada, 'fecha'>): Cerebro {
  const ideas = { ...cerebro.ideas, [id]: { ...idea, fecha: hoy() } };
  const ordenadas = Object.entries(ideas)
    .sort((a, b) => b[1].fecha.localeCompare(a[1].fecha))
    .slice(0, MAX_IDEAS);
  return { ...cerebro, ideas: Object.fromEntries(ordenadas) };
}

export function olvidarNota(cerebro: Cerebro, indice: number): Cerebro {
  return { ...cerebro, notas: cerebro.notas.filter((_, i) => i !== indice) };
}

/** Lo más frecuente primero. */
function masUsados(usos: Record<string, number>, n: number): [string, number][] {
  return Object.entries(usos)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, n);
}

function masRepetida<T>(serie: T[]): T | null {
  const cuenta = new Map<T, number>();
  for (const v of serie) cuenta.set(v, (cuenta.get(v) ?? 0) + 1);
  let mejor: T | null = null;
  let veces = 0;
  for (const [v, c] of cuenta) {
    if (c > veces) {
      mejor = v;
      veces = c;
    }
  }
  return mejor;
}

/**
 * Lo que viaja a Claude con cada pedido: unas líneas, lo justo para que el
 * productor te conozca. Vacío si todavía no sabe nada.
 */
export function resumirCerebro(cerebro: Cerebro): string {
  const lineas: string[] = [];
  if (cerebro.notas.length) {
    lineas.push('Lo que sabes de sus gustos:');
    for (const n of cerebro.notas.slice(0, 20)) lineas.push(`- ${n.texto}`);
  }
  const usos = masUsados(cerebro.usos, 8);
  if (usos.length) lineas.push(`Lo que más usa: ${usos.map(([k, v]) => `${k} (${v})`).join(', ')}.`);
  if (cerebro.tempos.length >= 2) {
    const min = Math.min(...cerebro.tempos);
    const max = Math.max(...cerebro.tempos);
    lineas.push(`Toca entre ${min} y ${max} BPM.`);
  }
  const tono = masRepetida(cerebro.tonalidades);
  if (tono) lineas.push(`Tonalidad que más repite: ${tono}.`);
  if (cerebro.pedidos.length) {
    lineas.push('Últimos pedidos:');
    for (const p of cerebro.pedidos.slice(0, 5)) lineas.push(`- «${p.texto}» (${p.fecha})`);
  }
  const ideas = Object.values(cerebro.ideas).slice(0, 8);
  if (ideas.length) {
    lineas.push('Sus ideas recientes:');
    for (const i of ideas) {
      lineas.push(`- ${i.nombre}: ${i.bpm} BPM${i.tonalidad ? `, ${i.tonalidad}` : ''}, ${i.pistas} pistas (${i.fecha})`);
    }
  }
  return lineas.join('\n');
}

/**
 * Lo que el productor propone sin que se lo pidas, antes de gastar nada:
 * sale de lo que ya sabe de ti y de lo que hay en el proyecto.
 */
export function sugerenciasDelCerebro(
  cerebro: Cerebro,
  situacion: { hayToma: boolean; pistas: number; nombresDePistas: string[] },
): string[] {
  const ideas: string[] = [];
  const tiene = (palabra: string) => situacion.nombresDePistas.some((n) => n.toLowerCase().includes(palabra));
  if (!situacion.hayToma) {
    ideas.push('Hazme una canción de rumba de un minuto');
    ideas.push('Una base lo-fi de 30 segundos para un reel');
  } else {
    const favorito = masUsados(cerebro.usos, 1)[0]?.[0];
    if (favorito?.startsWith('bajo:') && !tiene('bajo')) {
      ideas.push(`Ponle el bajo ${favorito.slice(5).replace('-', ' ')} de siempre`);
    } else if (!tiene('bajo')) {
      ideas.push('Ponle bajo y batería');
    }
    if (!tiene('teclas') && !tiene('cuerdas')) ideas.push('Añade algo que rellene por debajo');
    ideas.push('Hazme dos pistas: cuerdas y metales');
  }
  return ideas.slice(0, 3);
}
