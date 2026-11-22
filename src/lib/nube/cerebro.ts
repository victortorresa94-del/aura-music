/**
 * El cerebro del productor en dos dispositivos a la vez.
 *
 * No gana uno entero sobre el otro: lo que aprendió el productor en el móvil
 * y lo que aprendió en el PC se juntan. Para eso se mezcla en tres partes,
 * con la versión en la que los dos coincidieron por última vez (la base):
 *
 *   · una nota que está en la base y falta en uno de los dos se borró allí
 *     («olvidar» en la hoja del productor): se queda borrada;
 *   · una nota que no está en la base es nueva: se queda, venga de donde venga;
 *   · los usos suman lo que sumó cada uno desde la base;
 *   · tempos y tonalidades juntan lo nuevo de los dos delante de lo de antes.
 *
 * Pura, con tests en `nube.test.ts`.
 */

import {
  MAX_IDEAS,
  MAX_NOTAS,
  MAX_PEDIDOS,
  MAX_SERIE,
  type Cerebro,
  type IdeaRecordada,
  type Nota,
} from '@/lib/productor/cerebro';

const normal = (texto: string) => texto.trim().toLowerCase().replace(/\s+/g, ' ');

function mezclarNotas(base: Nota[] | null, local: Nota[], remoto: Nota[], clave: (n: Nota) => string, max: number): Nota[] {
  const enBase = new Set((base ?? []).map(clave));
  const enLocal = new Set(local.map(clave));
  const enRemoto = new Set(remoto.map(clave));
  const vistas = new Set<string>();
  const juntas: Nota[] = [];
  for (const nota of [...local, ...remoto]) {
    const k = clave(nota);
    if (vistas.has(k)) continue;
    vistas.add(k);
    // Estaba antes y uno de los dos la quitó: quitada.
    if (enBase.has(k) && !(enLocal.has(k) && enRemoto.has(k))) continue;
    juntas.push(nota);
  }
  // Lo más reciente delante; a igual fecha, el orden de antes (lo de aquí primero).
  return juntas
    .map((nota, i) => ({ nota, i }))
    .sort((a, b) => b.nota.fecha.localeCompare(a.nota.fecha) || a.i - b.i)
    .map(({ nota }) => nota)
    .slice(0, max);
}

/** Lo que una serie («las últimas primero») tiene delante que la base no tenía. */
export function nuevosDelante<T>(serie: T[], base: T[]): T[] {
  for (let k = 0; k <= serie.length; k++) {
    // Lo que queda detrás de lo nuevo tiene que ser el principio de la base, y no más largo que ella.
    if (serie.length - k > base.length) continue;
    let encaja = true;
    for (let i = k; i < serie.length && i - k < base.length; i++) {
      if (serie[i] !== base[i - k]) {
        encaja = false;
        break;
      }
    }
    if (encaja) return serie.slice(0, k);
  }
  return serie;
}

function mezclarSerie<T>(base: T[] | null, local: T[], remoto: T[]): T[] {
  const b = base ?? [];
  return [...nuevosDelante(local, b), ...nuevosDelante(remoto, b), ...b].slice(0, MAX_SERIE);
}

function mezclarUsos(
  base: Record<string, number> | null,
  local: Record<string, number>,
  remoto: Record<string, number>,
): Record<string, number> {
  const claves = new Set([...Object.keys(local), ...Object.keys(remoto)]);
  const usos: Record<string, number> = {};
  for (const k of claves) {
    const l = local[k] ?? 0;
    const r = remoto[k] ?? 0;
    // Sin base (la primera vez) no se sabe qué es de quién: se queda el mayor, sin contar dos veces.
    if (!base) {
      usos[k] = Math.max(l, r);
      continue;
    }
    const b = base[k] ?? 0;
    usos[k] = b + Math.max(0, l - b) + Math.max(0, r - b);
  }
  return usos;
}

function mezclarIdeas(local: Record<string, IdeaRecordada>, remoto: Record<string, IdeaRecordada>): Record<string, IdeaRecordada> {
  const todas: Record<string, IdeaRecordada> = { ...remoto };
  for (const [id, idea] of Object.entries(local)) {
    const otra = todas[id];
    if (!otra || idea.fecha >= otra.fecha) todas[id] = idea;
  }
  const ordenadas = Object.entries(todas)
    .sort((a, b) => b[1].fecha.localeCompare(a[1].fecha))
    .slice(0, MAX_IDEAS);
  return Object.fromEntries(ordenadas);
}

export function fusionarCerebros(base: Cerebro | null, local: Cerebro, remoto: Cerebro): Cerebro {
  return {
    version: 1,
    notas: mezclarNotas(base?.notas ?? null, local.notas, remoto.notas, (n) => normal(n.texto), MAX_NOTAS),
    pedidos: mezclarNotas(base?.pedidos ?? null, local.pedidos, remoto.pedidos, (n) => `${n.texto}|${n.fecha}`, MAX_PEDIDOS),
    usos: mezclarUsos(base?.usos ?? null, local.usos, remoto.usos),
    tempos: mezclarSerie(base?.tempos ?? null, local.tempos, remoto.tempos),
    tonalidades: mezclarSerie(base?.tonalidades ?? null, local.tonalidades, remoto.tonalidades),
    ideas: mezclarIdeas(local.ideas, remoto.ideas),
  };
}

/** JSON con las claves ordenadas: dos cerebros iguales dan el mismo texto. */
function canonico(valor: unknown): string {
  return JSON.stringify(valor, (_clave, v: unknown) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)))
      : v,
  );
}

export function mismoCerebro(a: Cerebro, b: Cerebro): boolean {
  return canonico(a) === canonico(b);
}
