/**
 * La cuenta de aura vista desde bolsillo, sin React: el token para pagar y el
 * saldo del monedero.
 *
 * Crear se pide a aura Studio (`/api/fal`, `op:'music'`) con el token de
 * Firebase de la cuenta: mismo proyecto (`aether-app-59bd1`), así que aura
 * Studio lo acepta, cobra del monedero de aura y pone sus frenos. El saldo se
 * PREGUNTA a aura Studio (`/api/admin?action=saldo`), como hace su propia app:
 * el monedero vive en `system/creditos/usuarios/{uid}`, que ningún navegador
 * lee (decisión 0023 y `aura-studio/src/services/creditos/useCreditos.ts`).
 *
 * Firebase se carga a trozos y solo si hay configuración (`src/lib/nube/`): sin
 * ella no hay cuenta, y escuchar lo que ya está en el móvil sigue igual.
 */

import { configFirebase } from '@/lib/nube/config';

/** La dirección de aura Studio. No es secreta: `NEXT_PUBLIC_AURA_STUDIO_URL`. */
export function urlAuraStudio(): string {
  const v = process.env.NEXT_PUBLIC_AURA_STUDIO_URL?.trim();
  return (v || 'https://aurastudio.cat').replace(/\/+$/, '');
}

/**
 * A dónde se va a recargar: los Ajustes de aura Studio por su apartado del
 * plan (`/app?ajustes=plan`), con el saldo, «Recargar» y «Ver planes». Es el
 * enlace que da también su MCP; aura Studio lo guarda antes del login, así que
 * funciona aunque allí haya que entrar primero. Recargar es un extra del plan
 * (`recargaPermitida`): quien no lo tiene ve «Ver planes» en el mismo sitio.
 */
export function urlRecargar(): string {
  return `${urlAuraStudio()}/app?ajustes=plan&ref=aura-music`;
}

/** Cuando algo cambia el saldo (crear cobra, devolver devuelve), quien lo pinta lo vuelve a pedir. */
export const EVENTO_SALDO_CAMBIADO = 'aura-music:saldo-cambiado';

/** Avisa de que el saldo ha cambiado. Lo llama Crear al cobrar o al devolver; la cuenta lo relee. */
export function avisarSaldoCambiado(): void {
  try {
    window.dispatchEvent(new Event(EVENTO_SALDO_CAMBIADO));
  } catch {
    /* sin window (tests, servidor) */
  }
}

/** Lo que se dice cuando no se puede saber nada porque no hay red. */
export const TEXTO_SIN_RED = 'Sin conexión. Prueba cuando vuelva la red.';

/**
 * El token de Firebase de la cuenta que ha entrado, o `null` si no hay nadie
 * (o no hay configuración). Espera a que se recupere la sesión guardada.
 *
 * Lanza un `Error` con el motivo en castellano si no se puede saber (sin red
 * la primera vez no se puede ni cargar Firebase, o el token caducado no se
 * puede renovar): no es lo mismo que «no hay nadie» y no se debe decir igual.
 *
 * @param opciones.forzar pide uno nuevo aunque el guardado siga vivo: tras un
 *   401 de aura Studio, antes de dar la sesión por caducada.
 */
export async function obtenerToken(opciones: { forzar?: boolean } = {}): Promise<string | null> {
  const config = configFirebase();
  if (!config) return null;
  try {
    // A trozos: quien solo escucha no baja Firebase hasta que hace falta.
    const { conectar } = await import('@/lib/nube/firebase');
    const conexion = await conectar(config);
    return await conexion.token(opciones.forzar === true);
  } catch (error) {
    throw new Error(textoDelFalloDeSesion(error));
  }
}

function textoDelFalloDeSesion(error: unknown): string {
  const codigo = (error as { code?: string } | null)?.code ?? '';
  if (codigo === 'auth/user-token-expired' || codigo === 'auth/user-disabled' || codigo === 'auth/invalid-user-token') {
    return 'Tu sesión de aura ha caducado. Sal y vuelve a entrar.';
  }
  return TEXTO_SIN_RED;
}

/* ── El saldo ─────────────────────────────────────────────────────────── */

/**
 * Lo que se puede gastar en música, leído de aura Studio.
 *
 * `saldo` son los créditos que PAGAN una canción: lo pagado más los del plan.
 * Los de prueba (`saldoRegalo`, `saldoRegaloChat`) no cuentan: en aura Studio
 * solo pagan el chat y las imágenes baratas (`pagableConRegalo`), nunca la
 * música. Si fueran en la cifra, el móvil diría «40 créditos» y crear daría
 * «sin créditos». En negativo (se devolvió un pago ya gastado) el saldo es la
 * deuda y no se gasta nada, como en `cobrar`.
 */
export interface SaldoDeAura {
  /** Créditos que pagan música. `null` si la cuenta no paga o no se sabe. Negativo: lo que se debe. */
  saldo: number | null;
  /** La cuenta no paga (dueños de aura, o gasta los créditos de una cuenta que no paga): crear no descuenta. */
  sinCobro: boolean;
  /** Créditos de prueba que tienes en aura pero que no valen para música. */
  dePrueba: number;
  /** Tu plan de aura, si tienes uno vivo: «Lite», «Creador»… */
  plan: { nombre: string; estado: 'activo' | 'impago' | 'cancelado' } | null;
  /** Gastas los créditos de otra cuenta (lo decide el admin de aura): cómo se llama. */
  pagaCon: string | null;
  /** `socio` = paga a coste: los precios le salen más baratos que lo que dice el botón. */
  tarifa: 'normal' | 'socio';
}

export type LecturaDeSaldo = { saldo: SaldoDeAura; motivo: null } | { saldo: null; motivo: string };

const entero = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? Math.trunc(v) : 0);

/**
 * Lo que contesta `GET /api/admin?action=saldo` de aura Studio, pasado a lo
 * que necesita bolsillo. PURA. La forma sale de `aura-studio/api/admin.ts`
 * (acción `saldo`):
 * - `conMonedero: false` = no se cobra nada (los dueños no tienen monedero;
 *   aura Studio lo lee igual, `canje.ts`).
 * - `pagaCon.sinCobro` = gasta los de una cuenta que no paga: tampoco.
 * - `saldo` (pagado, con signo) + `saldoPlan`; el regalo, aparte.
 */
export function leerRespuestaDeSaldo(json: unknown): SaldoDeAura | null {
  if (!json || typeof json !== 'object') return null;
  const r = json as {
    saldo?: unknown;
    saldoPlan?: unknown;
    saldoRegalo?: unknown;
    saldoRegaloChat?: unknown;
    conMonedero?: unknown;
    tarifa?: unknown;
    plan?: { nombre?: unknown; estado?: unknown } | null;
    pagaCon?: { nombre?: unknown; sinCobro?: unknown } | null;
  };
  const pagaCon = typeof r.pagaCon?.nombre === 'string' && r.pagaCon.nombre.trim() ? r.pagaCon.nombre.trim() : null;
  const tarifa = r.tarifa === 'socio' ? 'socio' : 'normal';
  const estado = (['activo', 'impago', 'cancelado'] as const).find((e) => e === r.plan?.estado);
  const plan: SaldoDeAura['plan'] =
    typeof r.plan?.nombre === 'string' && r.plan.nombre.trim() && estado ? { nombre: r.plan.nombre.trim(), estado } : null;
  const dePrueba = Math.max(0, entero(r.saldoRegalo)) + Math.max(0, entero(r.saldoRegaloChat));

  if (r.conMonedero === false || r.pagaCon?.sinCobro === true) {
    return { saldo: null, sinCobro: true, dePrueba: 0, plan, pagaCon, tarifa };
  }
  if (typeof r.saldo !== 'number' || !Number.isFinite(r.saldo)) return null;
  const pagado = Math.trunc(r.saldo);
  const delPlan = Math.max(0, entero(r.saldoPlan));
  return {
    saldo: pagado < 0 ? pagado : pagado + delPlan,
    sinCobro: false,
    dePrueba,
    plan,
    pagaCon,
    tarifa,
  };
}

export interface DependenciasDelSaldo {
  /** El token; por defecto, el de la sesión de aura (`obtenerToken`). */
  token?: (forzar: boolean) => Promise<string | null>;
  fetch?: typeof fetch;
  /** Por defecto, `urlAuraStudio()`. */
  base?: string;
  /** Lo que se espera a aura Studio antes de decir que no contesta. */
  esperaMs?: number;
}

const SIN_SESION = 'Entra con tu cuenta de aura para ver tus créditos.';
const NO_CONTESTA = 'aura Studio no contesta ahora. Vuelve a mirar en un rato.';
const CADUCADA = 'Tu sesión de aura ha caducado. Sal y vuelve a entrar.';

function sinRed(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

/**
 * Pregunta a aura Studio cuántos créditos quedan. Nunca lanza: sin red, sin
 * sesión o con aura Studio caído devuelve `saldo: null` y el motivo en
 * castellano, listo para enseñarlo.
 *
 * Un 401 se reintenta una vez con un token recién pedido: el guardado puede
 * haber caducado justo (dura una hora) y eso no es «sal y vuelve a entrar».
 */
export async function leerSaldo(dependencias: DependenciasDelSaldo = {}): Promise<LecturaDeSaldo> {
  const pedirToken = dependencias.token ?? ((forzar: boolean) => obtenerToken({ forzar }));
  const pedir = dependencias.fetch ?? (typeof fetch === 'function' ? fetch.bind(globalThis) : null);
  if (!pedir) return { saldo: null, motivo: NO_CONTESTA };
  const url = `${dependencias.base ?? urlAuraStudio()}/api/admin?action=saldo`;
  const esperaMs = dependencias.esperaMs ?? 12_000;

  const preguntar = async (forzar: boolean): Promise<Response | { motivo: string }> => {
    let token: string | null;
    try {
      token = await pedirToken(forzar);
    } catch (error) {
      return { motivo: error instanceof Error && error.message ? error.message : TEXTO_SIN_RED };
    }
    if (!token) return { motivo: SIN_SESION };
    const corte = new AbortController();
    const reloj = setTimeout(() => corte.abort(), esperaMs);
    try {
      return await pedir(url, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        cache: 'no-store',
        credentials: 'omit',
        signal: corte.signal,
      });
    } catch (error) {
      if (corte.signal.aborted) return { motivo: 'aura Studio tarda en contestar. Vuelve a mirar en un rato.' };
      return { motivo: sinRed() || error instanceof TypeError ? TEXTO_SIN_RED : NO_CONTESTA };
    } finally {
      clearTimeout(reloj);
    }
  };

  let respuesta = await preguntar(false);
  if (!('motivo' in respuesta) && respuesta.status === 401) respuesta = await preguntar(true);
  if ('motivo' in respuesta) return { saldo: null, motivo: respuesta.motivo };
  if (respuesta.status === 401) return { saldo: null, motivo: CADUCADA };
  if (!respuesta.ok) return { saldo: null, motivo: NO_CONTESTA };
  let json: unknown;
  try {
    json = await respuesta.json();
  } catch {
    return { saldo: null, motivo: NO_CONTESTA };
  }
  const saldo = leerRespuestaDeSaldo(json);
  return saldo ? { saldo, motivo: null } : { saldo: null, motivo: NO_CONTESTA };
}
