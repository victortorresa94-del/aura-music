/**
 * Generar las canciones de un plan y renovar las playlists vivas.
 *
 * - **De dos en dos** (como la skill de playlists de MiniMax, que genera en
 *   paralelo): la primera suena mientras llegan las demás.
 * - **Cada una entra en la playlist en cuanto termina**, con su porqué, así
 *   la playlist se va llenando sola.
 * - **Se para al primer error de créditos, de cuenta o de límite y lo dice**:
 *   las demás fallarían igual y alguna podría cobrarse. Lo que ya estaba en
 *   marcha termina; no se lanza nada más.
 * - **No vuelve a lanzar lo ya lanzado.** El progreso vive a nivel de módulo
 *   (salir de la pantalla no lo borra): pedir el mismo plan dos veces no
 *   lanza nada nuevo, y «Seguir» tras una parada solo lanza las que faltan.
 *   Una que salió mal no se relanza sola: no se paga dos veces por lo mismo.
 * - **Nada que imite a alguien real**: un plan con una imitación no se lanza.
 *
 * `generar` se inyecta (es `generarCancion` de Crear en la app y uno simulado
 * en los tests), así esto no depende de cómo se habla con aura Studio.
 */

import type { Almacen } from '../almacen';
import type { DatosGenerar, ResultadoGenerar } from '../crear/generar';
import { creditosDeReceta, textoCreditos } from '../precios';
import { respuestaAImitacion } from '../reglas';
import { imitaA } from '../artistas/adn';
import type { Receta } from '../tipos';
import { planDePlaylist, type PlanDePlaylist } from './plan';
import { conCanciones } from './playlist';
import { costePorCancion, cuantasCaben, debeRenovar, trasRenovar } from './viva';

export type GenerarCancion = (receta: Receta, datos: DatosGenerar) => Promise<ResultadoGenerar>;

export type EstadoEntrada = 'pendiente' | 'generando' | 'hecha' | 'fallo';

/** Por qué se paró todo: lo que haría fallar a las demás también. */
export type MotivoParada = 'creditos' | 'cuenta' | 'limite' | 'borrada';

export interface Parada {
  motivo: MotivoParada;
  texto: string;
}

/** El progreso de una playlist que se está llenando. Inmutable: cada cambio es un objeto nuevo. */
export interface Progreso {
  playlistId: string;
  plan: PlanDePlaylist;
  estados: EstadoEntrada[];
  cancionIds: (string | null)[];
  errores: (string | null)[];
  parada: Parada | null;
  enMarcha: boolean;
  /** Créditos de todo lo hecho con este plan, entre todas las tandas. */
  gastado: number;
}

export interface ResultadoPlaylist {
  /** Hechas con este plan, contando las de tandas anteriores. */
  hechas: number;
  total: number;
  hechasEstaVez: number;
  fallos: number;
  pendientes: number;
  /** Créditos de lo hecho en esta tanda. */
  gastado: number;
  parada: Parada | null;
  texto: string;
}

/* ── El progreso, a nivel de módulo ───────────────────────────────────── */

const progresos = new Map<string, Progreso>();
const enCurso = new Map<string, Promise<ResultadoPlaylist>>();
const oyentes = new Set<() => void>();

export function progresoDe(playlistId: string): Progreso | null {
  return progresos.get(playlistId) ?? null;
}

/** Para pintar el progreso: avisa en cada cambio de cualquier playlist. */
export function escucharProgresos(oyente: () => void): () => void {
  oyentes.add(oyente);
  return () => {
    oyentes.delete(oyente);
  };
}

function poner(p: Progreso) {
  progresos.set(p.playlistId, p);
  for (const o of oyentes) {
    try {
      o();
    } catch {
      /* un oyente roto no para la playlist */
    }
  }
}

function cambiar(playlistId: string, cambio: (p: Progreso) => Progreso) {
  const p = progresos.get(playlistId);
  if (p) poner(cambio(p));
}

function conEntrada(p: Progreso, i: number, estado: EstadoEntrada, extra: { cancionId?: string | null; error?: string | null } = {}): Progreso {
  const estados = [...p.estados];
  estados[i] = estado;
  const cancionIds = [...p.cancionIds];
  if (extra.cancionId !== undefined) cancionIds[i] = extra.cancionId;
  const errores = [...p.errores];
  if (extra.error !== undefined) errores[i] = extra.error;
  return { ...p, estados, cancionIds, errores };
}

/** Olvida el progreso de una playlist (al borrarla, o en los tests). No para lo que está en marcha. */
export function olvidarProgreso(playlistId: string) {
  if (enCurso.has(playlistId)) return;
  if (progresos.delete(playlistId)) for (const o of oyentes) o();
}

/** Solo para tests. */
export function reiniciarProgresosParaPruebas() {
  progresos.clear();
  enCurso.clear();
  colas.clear();
  renovando = null;
}

/* ── Errores que paran ────────────────────────────────────────────────── */

/**
 * ¿Este error pararía también a las demás? Créditos (402, `SIN_CREDITOS`),
 * cuenta (401, 403, sin sesión) o límite (429, `LIMITE_ALCANZADO`, el saldo
 * del proveedor de aura). Lo demás (una canción que no sale) no para el resto.
 */
export function motivoDeParada(error: unknown): Exclude<MotivoParada, 'borrada'> | null {
  const e = (typeof error === 'object' && error !== null ? error : {}) as { status?: unknown; code?: unknown };
  const status = typeof e.status === 'number' ? e.status : null;
  const codigo = typeof e.code === 'string' ? e.code : '';
  const texto = `${codigo} ${error instanceof Error ? error.message : typeof error === 'string' ? error : ''}`;
  if (
    status === 402 ||
    /SIN_CREDITOS|sin cr[eé]ditos|cr[eé]ditos insuficientes|no (?:te )?quedan cr[eé]ditos|saldo insuficiente|sin saldo|\b402\b/i.test(texto)
  )
    return 'creditos';
  if (status === 429 || /LIMITE_ALCANZADO|SALDO_FAL_AGOTADO|CONTADOR_NO_DISPONIBLE|\b429\b/i.test(texto)) return 'limite';
  if (
    status === 401 ||
    status === 403 ||
    /\b40[13]\b|sin sesi[oó]n|inicia(?:r)? sesi[oó]n|entra con tu cuenta|no has entrado|SOLO_LECTURA|SOLO_SUS_CLAVES|no autorizad|unauthori[sz]ed|forbidden/i.test(
      texto,
    )
  )
    return 'cuenta';
  return null;
}

export function textoDeParada(motivo: MotivoParada, hechas: number, total: number): string {
  const van = `van ${hechas} de ${total}`;
  switch (motivo) {
    case 'creditos':
      return `Te has quedado sin créditos: ${van}. Recarga en tu cuenta de aura y sigue con las que faltan.`;
    case 'cuenta':
      return `Entra con tu cuenta de aura para seguir: ${van}.`;
    case 'limite':
      return `Ahora mismo no se pueden hacer más: ${van}. Sigue en un rato.`;
    case 'borrada':
      return 'La playlist ya no existe: no se hacen las que faltaban.';
  }
}

function mensajeDe(error: unknown): string {
  const m = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  return m.trim() || 'No ha salido.';
}

/* ── Escribir en la playlist, de una en una ───────────────────────────── */

const colas = new Map<string, Promise<unknown>>();

/** Dos canciones que terminan a la vez no se pisan al escribir la playlist. */
function enCola<T>(clave: string, trabajo: () => Promise<T>): Promise<T> {
  const antes = colas.get(clave) ?? Promise.resolve();
  const ahora = antes.then(trabajo, trabajo);
  colas.set(
    clave,
    ahora.catch(() => undefined),
  );
  return ahora;
}

/* ── Generar un plan ──────────────────────────────────────────────────── */

function firma(plan: PlanDePlaylist): string {
  return JSON.stringify(plan.entradas.map((e) => [e.titulo, e.receta]));
}

/** La imitación de un plan, si la hay: en la frase o en cualquiera de sus recetas. */
export function imitacionDelPlan(plan: PlanDePlaylist): string | null {
  if (plan.imitacion) return plan.imitacion;
  for (const e of plan.entradas) {
    const quien = imitaA(e.receta.frase) ?? imitaA(e.receta.estilo ?? '') ?? imitaA(e.titulo);
    if (quien) return quien;
  }
  return null;
}

export interface OpcionesGenerarPlaylist {
  almacen: Almacen;
  playlistId: string;
  plan: PlanDePlaylist;
  generar: GenerarCancion;
  /** Cuántas a la vez. Dos: la primera suena antes y no se dispara el gasto. */
  concurrencia?: number;
  /** Las nuevas al final (una playlist nueva) o al principio (una renovación). */
  posicion?: 'final' | 'principio';
  reloj?: () => number;
}

/**
 * Genera lo que falta de un plan y lo va metiendo en la playlist. Si ya se
 * está generando ese mismo plan, devuelve esa misma tanda (no lanza nada).
 */
export async function generarPlaylist(op: OpcionesGenerarPlaylist): Promise<ResultadoPlaylist> {
  const previa = enCurso.get(op.playlistId);
  if (previa) {
    const actual = progresos.get(op.playlistId);
    if (actual && firma(actual.plan) === firma(op.plan)) return previa;
    // Otro plan sobre la misma playlist (una renovación mientras se llenaba): después.
    await previa.catch(() => undefined);
    const otra = enCurso.get(op.playlistId);
    if (otra) return otra;
  }
  const tanda = correr(op);
  enCurso.set(op.playlistId, tanda);
  try {
    return await tanda;
  } finally {
    if (enCurso.get(op.playlistId) === tanda) enCurso.delete(op.playlistId);
  }
}

async function correr(op: OpcionesGenerarPlaylist): Promise<ResultadoPlaylist> {
  const { almacen, playlistId, plan, generar } = op;
  const reloj = op.reloj ?? Date.now;
  const quien = imitacionDelPlan(plan);
  if (quien) throw new Error(respuestaAImitacion(quien));

  const previo = progresos.get(playlistId);
  poner(
    previo && firma(previo.plan) === firma(plan)
      ? { ...previo, parada: null, enMarcha: true }
      : {
          playlistId,
          plan,
          estados: plan.entradas.map(() => 'pendiente'),
          cancionIds: plan.entradas.map(() => null),
          errores: plan.entradas.map(() => null),
          parada: null,
          enMarcha: true,
          gastado: 0,
        },
  );

  const cola = (progresos.get(playlistId) as Progreso).estados
    .map((estado, i) => (estado === 'pendiente' ? i : -1))
    .filter((i) => i >= 0);
  let gastado = 0;
  let hechasEstaVez = 0;
  let parar = false;
  const total = plan.entradas.length;
  const hechasYa = () => (progresos.get(playlistId)?.estados ?? []).filter((e) => e === 'hecha').length;

  const pararPor = (motivo: MotivoParada) => {
    parar = true;
    cambiar(playlistId, (p) => (p.parada ? p : { ...p, parada: { motivo, texto: textoDeParada(motivo, hechasYa(), total) } }));
  };

  const trabajador = async () => {
    while (!parar) {
      const i = cola.shift();
      if (i === undefined) return;
      // Si la han borrado mientras tanto, no se gasta en ella.
      if (!(await almacen.playlists.leer(playlistId))) {
        pararPor('borrada');
        return;
      }
      if (parar) return;
      const entrada = plan.entradas[i];
      cambiar(playlistId, (p) => conEntrada(p, i, 'generando'));
      let resultado: ResultadoGenerar;
      try {
        resultado = await generar(entrada.receta, { titulo: entrada.titulo, porque: entrada.porque });
      } catch (error) {
        const motivo = motivoDeParada(error);
        if (motivo) {
          // No se ha hecho: queda pendiente para «Seguir».
          cambiar(playlistId, (p) => conEntrada(p, i, 'pendiente'));
          pararPor(motivo);
        } else {
          cambiar(playlistId, (p) => conEntrada(p, i, 'fallo', { error: mensajeDe(error) }));
        }
        continue;
      }
      const coste = creditosDeReceta(entrada.receta);
      gastado += coste;
      hechasEstaVez++;
      cambiar(playlistId, (p) => ({ ...conEntrada(p, i, 'hecha', { cancionId: resultado.cancionId }), gastado: p.gastado + coste }));
      try {
        await enCola(playlistId, async () => {
          const pl = await almacen.playlists.leer(playlistId);
          if (!pl) return;
          await almacen.playlists.poner(
            conCanciones(pl, [resultado.cancionId], {
              porques: { [resultado.cancionId]: entrada.porque },
              posicion: op.posicion ?? 'final',
              ahora: reloj(),
            }),
          );
        });
      } catch {
        cambiar(playlistId, (p) =>
          conEntrada(p, i, 'hecha', { error: 'Está hecha, pero no se ha podido meter en la playlist. Búscala en tu biblioteca.' }),
        );
      }
    }
  };

  try {
    const cuantos = Math.max(1, Math.min(op.concurrencia ?? 2, cola.length));
    await Promise.all(Array.from({ length: cuantos }, trabajador));
  } finally {
    cambiar(playlistId, (p) => {
      const hechas = p.estados.filter((e) => e === 'hecha').length;
      return {
        ...p,
        enMarcha: false,
        parada: p.parada ? { ...p.parada, texto: textoDeParada(p.parada.motivo, hechas, total) } : null,
      };
    });
  }

  const final = progresos.get(playlistId) as Progreso;
  const hechas = final.estados.filter((e) => e === 'hecha').length;
  const fallos = final.estados.filter((e) => e === 'fallo').length;
  const pendientes = final.estados.filter((e) => e === 'pendiente').length;
  return {
    hechas,
    total,
    hechasEstaVez,
    fallos,
    pendientes,
    gastado,
    parada: final.parada,
    texto: textoDelResultado(hechas, total, fallos, final.parada),
  };
}

function textoDelResultado(hechas: number, total: number, fallos: number, parada: Parada | null): string {
  if (parada) return parada.texto;
  const listas = hechas === 1 ? 'Lista una canción nueva' : `Listas ${hechas} canciones nuevas`;
  if (!fallos) return `${listas}.`;
  return `${hechas} de ${total} listas; ${fallos === 1 ? 'una no ha salido' : `${fallos} no han salido`}.`;
}

/** Las entradas que quedan por hacer de un progreso (para «Seguir» y su precio). */
export function pendientesDe(progreso: Progreso): number[] {
  return progreso.estados.map((e, i) => (e === 'pendiente' ? i : -1)).filter((i) => i >= 0);
}

/* ── Las playlists vivas ──────────────────────────────────────────────── */

export interface Renovacion {
  playlistId: string;
  nombre: string;
  nuevas: number;
  gastado: number;
  /** Por qué no se ha renovado entera, si es el caso. */
  motivo?: MotivoParada | 'tope' | 'fallo';
  texto: string;
}

async function generadorPorDefecto(): Promise<GenerarCancion> {
  // Se carga solo si nadie inyecta uno: los tests no lo tocan.
  const { generarCancion } = await import('../crear/generar');
  return generarCancion;
}

/**
 * Renueva UNA playlist viva si le toca. Reserva el gasto ANTES de lanzar
 * (otra apertura de la app ve que ya está renovada y no paga dos veces),
 * genera lo que cabe en el tope y devuelve lo que no se gastó. Si no sale
 * ninguna, deja la renovación pendiente para la próxima vez.
 */
export async function renovarUnaViva(
  almacen: Almacen,
  playlistId: string,
  ahora: number,
  generar: GenerarCancion,
): Promise<Renovacion | null> {
  const pl = await almacen.playlists.leer(playlistId);
  if (!pl?.viva || !debeRenovar(pl.viva, ahora)) return null;
  const viva = pl.viva;
  const caben = cuantasCaben(viva, ahora);
  if (caben <= 0) {
    return { playlistId, nombre: pl.nombre, nuevas: 0, gastado: 0, motivo: 'tope', texto: `${pl.nombre}: no quedan créditos este mes para renovarla.` };
  }
  const reservado = caben * costePorCancion(viva);
  await almacen.playlists.poner({ ...pl, viva: trasRenovar(viva, reservado, ahora) });

  const artista = viva.receta.artistaId ? await almacen.artistas.leer(viva.receta.artistaId) : null;
  const titulosYa = (await Promise.all(pl.cancionIds.map((id) => almacen.canciones.leer(id))))
    .filter((c) => c !== null)
    .map((c) => c.titulo);
  const plan = planDePlaylist({
    momento: viva.receta.momento ?? 'sorprendeme',
    frase: viva.receta.frase,
    n: caben,
    ...(artista ? { artista } : viva.receta.artistaId ? { artistaId: viva.receta.artistaId } : {}),
    motor: viva.receta.motor,
    semilla: `${playlistId}:${new Date(ahora).toDateString()}`,
    evitarTitulos: titulosYa,
    renovacion: viva.cada,
  });
  if (!viva.receta.momento) {
    for (const e of plan.entradas) delete e.receta.momento;
  }

  let resultado: ResultadoPlaylist | null = null;
  let errorSuelto: unknown = null;
  try {
    resultado = await generarPlaylist({ almacen, playlistId, plan, generar, posicion: 'principio', reloj: () => ahora });
  } catch (error) {
    errorSuelto = error;
  }
  const gastado = resultado?.gastado ?? 0;
  const nuevas = resultado?.hechasEstaVez ?? 0;

  // Devolver lo reservado que no se gastó; si no salió ninguna, que lo intente la próxima vez.
  const despues = await almacen.playlists.leer(playlistId);
  if (despues?.viva) {
    let v = { ...despues.viva, gastadoMes: Math.max(0, despues.viva.gastadoMes - Math.max(0, reservado - gastado)) };
    if (nuevas === 0) {
      const { ultimaRenovacion: _fuera, ...sinFecha } = v;
      v = viva.ultimaRenovacion === undefined ? sinFecha : { ...sinFecha, ultimaRenovacion: viva.ultimaRenovacion };
    }
    await almacen.playlists.poner({ ...despues, viva: v });
  }

  const motivo: Renovacion['motivo'] = resultado?.parada?.motivo ?? (nuevas < caben ? 'fallo' : undefined);
  return { playlistId, nombre: pl.nombre, nuevas, gastado, ...(motivo ? { motivo } : {}), texto: textoDeRenovacion(pl.nombre, nuevas, gastado, motivo, errorSuelto) };
}

function textoDeRenovacion(nombre: string, nuevas: number, gastado: number, motivo: Renovacion['motivo'], error: unknown): string {
  if (nuevas > 0) {
    const cuantas = nuevas === 1 ? 'una canción nueva' : `${nuevas} canciones nuevas`;
    return `${nombre}: ${cuantas} (${textoCreditos(gastado)}).`;
  }
  switch (motivo) {
    case 'creditos':
      return `${nombre}: te has quedado sin créditos para renovarla.`;
    case 'cuenta':
      return `${nombre}: entra con tu cuenta de aura para renovarla.`;
    case 'limite':
      return `${nombre}: ahora no se ha podido renovar; se intenta en la próxima visita.`;
    case 'borrada':
      return `${nombre} ya no existe.`;
    default:
      return error instanceof Error && /imit/i.test(error.message)
        ? `${nombre}: ${error.message}`
        : `${nombre}: la canción nueva no ha salido; se intenta en la próxima visita.`;
  }
}

export interface ResultadoRenovar {
  gastado: number;
  renovaciones: Renovacion[];
  /** Lo que hay que contar al abrir la app, o null si no hay nada (las que no tienen tope no avisan cada vez). */
  aviso: string | null;
}

let renovando: Promise<ResultadoRenovar> | null = null;

/**
 * Para llamarla al abrir la app: renueva las playlists vivas a las que les
 * toca, una detrás de otra, sin pasarse de su tope, y dice cuánto gastó.
 * Dos llamadas a la vez (dos efectos, dos pestañas en la misma página) son
 * una sola.
 */
export function renovarPlaylistsVivas(
  almacen: Almacen,
  ahora = Date.now(),
  opciones: { generar?: GenerarCancion } = {},
): Promise<ResultadoRenovar> {
  if (renovando) return renovando;
  const tanda = (async () => {
    const generar = opciones.generar ?? (await generadorPorDefecto());
    const renovaciones: Renovacion[] = [];
    for (const p of await almacen.playlists.todos()) {
      if (!p.viva || !debeRenovar(p.viva, ahora)) continue;
      const r = await renovarUnaViva(almacen, p.id, ahora, generar);
      if (r) renovaciones.push(r);
    }
    const gastado = renovaciones.reduce((s, r) => s + r.gastado, 0);
    const contar = renovaciones.filter((r) => r.motivo !== 'tope');
    return { gastado, renovaciones, aviso: contar.length ? contar.map((r) => r.texto).join(' ') : null };
  })();
  renovando = tanda;
  void tanda.finally(() => {
    if (renovando === tanda) renovando = null;
  }).catch(() => undefined);
  return tanda;
}
