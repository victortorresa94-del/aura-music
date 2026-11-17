/**
 * Encender y apagar la GPU de RunPod desde la app.
 *
 * El dueño (17-nov-2026): «quisiera usarlo solo cuando uso la IA; podríamos
 * meter un botón en la app». Un pod encendido cobra por segundo aunque nadie
 * le pida nada, así que la GPU vive apagada y la app la enciende cuando hace
 * falta. Con la API v2 de RunPod (https://api.runpod.io/v2, Bearer):
 *
 *   GET  /v2/pods/{id}          → `status`: PROVISIONING, STARTING, RUNNING,
 *                                  EXITED (parado), ERROR, TERMINATED
 *   POST /v2/pods/{id}/action   → {"action": "start" | "stop"}
 *   POST /v2/pods/{id}/exec     → ejecuta un comando dentro (sin SSH), para
 *                                  arrancar ACE-Step en cuanto el pod sube
 *
 * El apagado lo hace el propio pod tras 15 minutos sin pedidos
 * (scripts/acestep-gpu.sh), y aquí también se puede pedir a mano.
 * La clave de RunPod solo vive en el servidor.
 */

export type EstadoPod = 'apagado' | 'encendiendo' | 'encendido' | 'error' | 'borrado';

export interface ConfigRunPod {
  clave: string;
  podId: string;
  /** Dónde está el script dentro del pod. */
  script?: string;
  /** La clave de ACE-Step (ACESTEP_API_KEY): se le pasa al arrancarlo. */
  claveAceStep?: string;
}

const API = 'https://api.runpod.io/v2/pods';
const SCRIPT_POR_DEFECTO = '/workspace/acestep-gpu.sh';

export class ErrorRunPod extends Error {
  constructor(
    message: string,
    readonly status = 502,
  ) {
    super(message);
    this.name = 'ErrorRunPod';
  }
}

/** Lo que dice RunPod, en los cinco estados que le importan a la app. */
export function estadoDelPod(status: unknown): EstadoPod {
  switch (status) {
    case 'RUNNING':
      return 'encendido';
    case 'PROVISIONING':
    case 'STARTING':
      return 'encendiendo';
    case 'EXITED':
      return 'apagado';
    case 'TERMINATED':
      return 'borrado';
    default:
      return 'error';
  }
}

/** Solo letras, números, guion, guion bajo, punto, dos puntos y barras: nada que la shell interprete. */
const seguro = (texto: string) => texto.replace(/[^A-Za-z0-9_\-.:/]/g, '');

export interface OpcionesArranque {
  /** Dónde vive el script dentro del pod. */
  script?: string;
  /** De dónde bajar la última versión del script (la sirve la propia app). */
  urlScript?: string;
  /** La clave con la que ACE-Step aceptará a la app: la misma que ACESTEP_API_KEY en Vercel. */
  clave?: string;
}

/**
 * La orden que arranca ACE-Step dentro del pod, sin duplicarlo: si el
 * servidor ya contesta o el script ya está corriendo (descargando o cargando
 * el modelo), no hace nada. Se puede mandar las veces que haga falta.
 *
 * Antes de arrancar baja la última versión del script desde la app, así que
 * nadie vuelve a subir nada a Jupyter tras un arreglo (si la bajada falla,
 * usa el que ya hay). Y le pasa la clave de Vercel: no hay que copiarla del
 * pod a mano.
 */
export function ordenDeArranque(opciones: OpcionesArranque = {}): string[] {
  const s = seguro(opciones.script ?? SCRIPT_POR_DEFECTO);
  const bajar = opciones.urlScript
    ? `curl -fsSL -m 20 '${seguro(opciones.urlScript)}' -o '${s}.nuevo' && mv '${s}.nuevo' '${s}' ; `
    : '';
  const clave = opciones.clave ? `ACESTEP_API_KEY='${seguro(opciones.clave)}' ` : '';
  return [
    'sh',
    '-c',
    `curl -sf -m 2 http://127.0.0.1:8001/health >/dev/null 2>&1 || pgrep -f '${s}' >/dev/null 2>&1 || ` +
      `( ${bajar}${clave}nohup bash '${s}' > /workspace/acestep.log 2>&1 & ) ; echo ok`,
  ];
}

export function crearRunPod(config: ConfigRunPod, pedir: typeof fetch = fetch) {
  const base = `${API}/${encodeURIComponent(config.podId.trim())}`;
  const cabeceras = { Authorization: `Bearer ${config.clave}`, 'Content-Type': 'application/json' };

  async function llamar(ruta: string, init: RequestInit = {}): Promise<Response> {
    let respuesta: Response;
    try {
      respuesta = await pedir(`${base}${ruta}`, { ...init, headers: cabeceras, signal: AbortSignal.timeout(28_000) });
    } catch {
      throw new ErrorRunPod('No llego a RunPod. Prueba otra vez en un momento.', 503);
    }
    if (respuesta.status === 401 || respuesta.status === 403) {
      throw new ErrorRunPod('RunPod no acepta la clave (RUNPOD_API_KEY). Mira que tenga permiso sobre los pods.', 502);
    }
    if (respuesta.status === 404) {
      throw new ErrorRunPod('RunPod no encuentra ese pod (RUNPOD_POD_ID). ¿Lo has borrado o cambiado?', 502);
    }
    return respuesta;
  }

  return {
    async estado(): Promise<EstadoPod> {
      const r = await llamar('');
      if (!r.ok) throw new ErrorRunPod(`RunPod ha respondido ${r.status}.`);
      const pod = (await r.json()) as { status?: unknown };
      return estadoDelPod(pod.status);
    },

    async accion(accion: 'start' | 'stop'): Promise<void> {
      const r = await llamar('/action', { method: 'POST', body: JSON.stringify({ action: accion }) });
      // 409: la transición no vale en este estado (ya encendido, ya parado). No es un fallo.
      if (!r.ok && r.status !== 409) throw new ErrorRunPod(`RunPod no ha podido ${accion === 'start' ? 'encender' : 'apagar'} el pod (${r.status}).`);
    },

    /**
     * Arranca ACE-Step dentro del pod. Devuelve false si el contenedor aún
     * está subiendo (RunPod contesta 409 o 503): se reintenta en la siguiente
     * vuelta.
     */
    async arrancarServidor(urlScript?: string): Promise<boolean> {
      const r = await llamar('/exec', {
        method: 'POST',
        body: JSON.stringify({
          command: ordenDeArranque({ script: config.script, urlScript, clave: config.claveAceStep }),
          timeoutSeconds: 10,
        }),
      });
      if (r.status === 409 || r.status === 503) return false;
      if (!r.ok) throw new ErrorRunPod(`RunPod no ha podido arrancar ACE-Step (${r.status}).`);
      return true;
    },
  };
}

export type RunPod = ReturnType<typeof crearRunPod>;

type Entorno = Record<string, string | undefined>;

/** La GPU se puede manejar desde la app si hay clave y pod en el servidor. */
export function runpodActivo(env: Entorno = process.env): RunPod | null {
  if (!env.RUNPOD_API_KEY || !env.RUNPOD_POD_ID) return null;
  return crearRunPod({
    clave: env.RUNPOD_API_KEY,
    podId: env.RUNPOD_POD_ID,
    script: env.RUNPOD_SCRIPT || undefined,
    claveAceStep: env.ACESTEP_API_KEY || undefined,
  });
}
