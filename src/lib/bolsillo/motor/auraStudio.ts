/**
 * El motor de verdad: pide la canción a aura Studio, que tiene los modelos
 * (Lyria por Google, MiniMax, ACE-Step…), cobra del monedero de aura y pone
 * sus frenos. Es lo que hace su Music Studio (`aura-studio/src/services/
 * falService.ts`, `generarPista` + `runFalQueuedVideoDetailed`), separado en
 * dos pasos para poder retomarlo si se cierra la app.
 *
 * - `iniciar`: POST `/api/fal` con `op:'music'` y `queue:true`. Lyria por
 *   Google contesta ya con el audio; lo demás contesta con su sitio en la
 *   cola (`requestId` + `queueSlug`, o `provider` + `jobId`). Cobra: no se
 *   reintenta nunca.
 * - `consultar`: POST `/api/fal` con `op:'job-status'`. Es gratis (tier
 *   `gratis` del cuarto freno de aura Studio).
 *
 * Con el token de Firebase de la cuenta (mismo proyecto que aura Studio) y
 * sin ninguna clave: aquí no hay nada secreto.
 */

import { obtenerToken, urlAuraStudio } from '../cuenta';
import { ErrorDeMotor, type EstadoTrabajo, type MotorDeCanciones, type PeticionMotor, type TrabajoIniciado } from './tipos';

export interface OpcionesAuraStudio {
  url?: () => string;
  token?: () => Promise<string | null>;
  pedir?: typeof fetch;
  /** Lo que se espera a que aura Studio conteste a `iniciar` (Lyria por Google tarda). */
  esperaIniciarMs?: number;
}

export const TEXTOS_MOTOR = {
  sinCuenta: 'Entra con tu cuenta de aura para crear.',
  sinCreditos: 'Te faltan créditos para esta canción. Recarga en aura y vuelve a pedirla.',
  limite: 'Has llegado al tope de hoy. Vuelve a probar más tarde.',
  contador: 'aura no puede contar lo que gastas ahora mismo. Prueba en un minuto.',
  sinRed: 'No llego a aura. Mira la conexión y vuelve a probar.',
  tarda: 'aura ha tardado demasiado en contestar. Vuelve a probar en un rato.',
  noDeja: 'aura no deja crear con esta cuenta ahora mismo.',
  servidor: 'aura no ha podido hacer la canción. Vuelve a probar en un momento.',
  vacio: 'aura no ha devuelto nada que se pueda escuchar.',
  fallo: 'La canción no ha salido.',
} as const;

interface CuerpoError {
  error?: unknown;
  code?: unknown;
}

function textoDe(cuerpo: CuerpoError): string {
  return typeof cuerpo.error === 'string' ? cuerpo.error.trim() : '';
}

/**
 * Lo que dice aura Studio cuando dice que no, en castellano y para quien
 * escucha. Las marcas (`SIN_CREDITOS ·`, `LIMITE_ALCANZADO ·`) son las del
 * monedero y el cuarto freno de aura Studio.
 */
export function traducirError(status: number, cuerpo: CuerpoError = {}): ErrorDeMotor {
  const texto = textoDe(cuerpo);
  const code = typeof cuerpo.code === 'string' ? cuerpo.code : '';
  if (status === 401) return new ErrorDeMotor(TEXTOS_MOTOR.sinCuenta, 'sin-cuenta');
  if (status === 402 || /SIN_CREDITOS/.test(texto) || code === 'sin_creditos') {
    return new ErrorDeMotor(TEXTOS_MOTOR.sinCreditos, 'sin-creditos');
  }
  if (/LIMITE_ALCANZADO/.test(texto) || status === 429) {
    // El freno escribe un texto para personas tras la marca («Puedes seguir en 12 min»): mejor que el nuestro.
    const tras = texto.split('·').slice(1).join('·').trim();
    return new ErrorDeMotor(tras || TEXTOS_MOTOR.limite, 'limite');
  }
  if (/CONTADOR_NO_DISPONIBLE/.test(texto)) return new ErrorDeMotor(TEXTOS_MOTOR.contador, 'servidor', true);
  // La op de música escribe en castellano lo que no ha podido hacer (letra que falta, Google que no genera).
  if ((status === 400 || status === 422) && texto) return new ErrorDeMotor(texto, 'bloqueado');
  if (status === 403) return new ErrorDeMotor(TEXTOS_MOTOR.noDeja, 'otro');
  if (status >= 500) return new ErrorDeMotor(TEXTOS_MOTOR.servidor, 'servidor', true);
  return new ErrorDeMotor(TEXTOS_MOTOR.servidor, 'otro');
}

async function leerJson(respuesta: Response): Promise<Record<string, unknown>> {
  try {
    const datos = (await respuesta.json()) as unknown;
    return datos && typeof datos === 'object' ? (datos as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

const cadena = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

/** Solo enlaces de la red: un `data:` o un `javascript:` no son una canción en la nube. */
function enlace(v: unknown): string | undefined {
  const s = cadena(v);
  return s && /^https?:\/\//i.test(s) ? s : undefined;
}

export function crearMotorAuraStudio(opciones: OpcionesAuraStudio = {}): MotorDeCanciones {
  const url = opciones.url ?? urlAuraStudio;
  const token = opciones.token ?? obtenerToken;
  const pedir = opciones.pedir ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  const esperaIniciarMs = opciones.esperaIniciarMs ?? 290_000;

  async function llamar(cuerpo: Record<string, unknown>, esperaMs: number): Promise<Response> {
    const t = await token();
    if (!t) throw new ErrorDeMotor(TEXTOS_MOTOR.sinCuenta, 'sin-cuenta');
    const control = new AbortController();
    const reloj = setTimeout(() => control.abort(), esperaMs);
    try {
      return await pedir(`${url()}/api/fal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
        body: JSON.stringify(cuerpo),
        signal: control.signal,
      });
    } catch (error) {
      if ((error as Error)?.name === 'AbortError') throw new ErrorDeMotor(TEXTOS_MOTOR.tarda, 'red', true);
      throw new ErrorDeMotor(TEXTOS_MOTOR.sinRed, 'red', true);
    } finally {
      clearTimeout(reloj);
    }
  }

  return {
    id: 'aura-studio',
    gratis: false,

    async iniciar(peticion: PeticionMotor): Promise<TrabajoIniciado> {
      const letra = peticion.letra?.trim();
      const respuesta = await llamar(
        {
          op: 'music',
          prompt: peticion.descripcion,
          duration: Math.round(peticion.segundos),
          musicModel: peticion.motor,
          // Solo lo lee ACE-Step; los demás lo ignoran.
          instrumental: !peticion.conVoz,
          ...(letra ? { lyrics: letra } : {}),
          queue: true,
        },
        esperaIniciarMs,
      );
      const datos = await leerJson(respuesta);
      if (!respuesta.ok) throw traducirError(respuesta.status, datos);

      const aviso = cadena(datos.warning);
      const modelo = cadena(datos.modelUsed);
      // Lyria por Google: el audio ya está en el Storage de aura.
      const directo = enlace(datos.audioUrl) ?? enlace(datos.videoUrl);
      if (directo) {
        return {
          referencia: { directo: '1', ...(modelo ? { modelo } : {}) },
          estado: {
            estado: 'lista',
            url: directo,
            ...(cadena(datos.lyrics) ? { letra: cadena(datos.lyrics) } : {}),
            ...(aviso ? { aviso } : {}),
            ...(modelo ? { modelo } : {}),
          },
        };
      }
      const requestId = cadena(datos.requestId);
      const queueSlug = cadena(datos.queueSlug);
      if (requestId && queueSlug) {
        return {
          referencia: { requestId, queueSlug, ...(aviso ? { aviso } : {}), ...(modelo ? { modelo } : {}) },
          estado: { estado: 'en-cola' },
        };
      }
      const provider = cadena(datos.provider);
      const jobId = cadena(datos.jobId);
      if (provider && jobId) {
        return { referencia: { provider, jobId, ...(modelo ? { modelo } : {}) }, estado: { estado: 'en-cola' } };
      }
      throw new ErrorDeMotor(TEXTOS_MOTOR.vacio, 'servidor');
    },

    async consultar(referencia: Record<string, string>): Promise<EstadoTrabajo> {
      const cuerpo: Record<string, unknown> | null = referencia.requestId && referencia.queueSlug
        ? { op: 'job-status', requestId: referencia.requestId, queueSlug: referencia.queueSlug }
        : referencia.provider && referencia.jobId
          ? { op: 'job-status', provider: referencia.provider, jobId: referencia.jobId }
          : null;
      if (!cuerpo) return { estado: 'fallo', error: 'Esta canción no tiene dónde recogerse. Pídela otra vez.' };

      const respuesta = await llamar(cuerpo, 30_000);
      const datos = await leerJson(respuesta);
      if (!respuesta.ok) {
        const error = traducirError(respuesta.status, datos);
        // Una consulta que falla no es una canción que falla: se vuelve a mirar.
        if (respuesta.status >= 500) throw new ErrorDeMotor(error.message, error.tipo, true);
        throw error;
      }
      const status = String(datos.status ?? '').toUpperCase();
      if (status === 'COMPLETED') {
        const url = enlace(datos.audioUrl) ?? enlace(datos.videoUrl);
        if (!url) return { estado: 'fallo', error: TEXTOS_MOTOR.vacio };
        return {
          estado: 'lista',
          url,
          ...(referencia.aviso ? { aviso: referencia.aviso } : {}),
          ...(referencia.modelo ? { modelo: referencia.modelo } : {}),
        };
      }
      if (status === 'FAILED') {
        const devueltos = Number(datos.creditosDevueltos);
        const extra = Number.isFinite(devueltos) && devueltos > 0
          ? ` Se te han devuelto ${devueltos} ${devueltos === 1 ? 'crédito' : 'créditos'}.`
          : '';
        return { estado: 'fallo', error: `${TEXTOS_MOTOR.fallo}${extra}` };
      }
      if (status === 'IN_QUEUE') return { estado: 'en-cola' };
      return { estado: 'generando' };
    },
  };
}
