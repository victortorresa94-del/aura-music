import { proveedorActivo } from '@/lib/ia/proveedores';
import { ErrorRunPod, runpodActivo, type EstadoPod } from '@/lib/ia/runpod';
import { accesoPermitido, faltaCodigo } from '@/lib/servidor/acceso';
import { json, mismoOrigen } from '../musico/_comun';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Cómo está la GPU, contado como lo ve el músico:
 *   apagada     el pod está parado (no cobra la GPU)
 *   encendiendo el pod sube, o ya ha subido y ACE-Step descarga o carga el modelo
 *   lista       ACE-Step contesta: ya se pueden pedir pistas
 *   error       RunPod dice que algo va mal (o el pod ya no existe)
 */
export type EstadoGpu = 'apagada' | 'encendiendo' | 'lista' | 'error';

interface Respuesta {
  gpu: EstadoGpu;
  pod: EstadoPod;
  detalle?: string;
}

async function aceStepContesta(): Promise<boolean> {
  const proveedor = proveedorActivo();
  if (!proveedor?.salud) return false;
  const salud = await proveedor.salud().catch(() => ({ conectado: false }));
  return salud.conectado;
}

function aGpu(pod: EstadoPod, contesta: boolean): EstadoGpu {
  if (pod === 'encendido') return contesta ? 'lista' : 'encendiendo';
  if (pod === 'encendiendo') return 'encendiendo';
  if (pod === 'apagado') return 'apagada';
  return 'error';
}

function falloRunPod(error: unknown): Response {
  if (error instanceof ErrorRunPod) return json({ error: error.message }, error.status);
  return json({ error: 'Algo ha fallado al hablar con RunPod.' }, 500);
}

/** Solo mira. No enciende ni gasta nada. */
export async function GET(request: Request) {
  if (!mismoOrigen(request)) return json({ error: 'Origen no permitido.' }, 403);
  const runpod = runpodActivo();
  if (!runpod) return json({ error: 'La GPU no se puede manejar desde la app (faltan RUNPOD_API_KEY y RUNPOD_POD_ID).' }, 503);
  try {
    const pod = await runpod.estado();
    const contesta = pod === 'encendido' ? await aceStepContesta() : false;
    return json({ gpu: aGpu(pod, contesta), pod } satisfies Respuesta);
  } catch (error) {
    return falloRunPod(error);
  }
}

/**
 * {"accion": "encender"}: deja la GPU lista. Se puede llamar en bucle, cada
 * pocos segundos, hasta que conteste «lista»: si el pod está parado lo
 * enciende; si ya está encendido pero ACE-Step no contesta, lo arranca
 * dentro (sin duplicarlo). {"accion": "apagar"}: lo para ya.
 * Las dos gastan o ahorran dinero: van con candado.
 */
export async function POST(request: Request) {
  if (!mismoOrigen(request)) return json({ error: 'Origen no permitido.' }, 403);
  if (!accesoPermitido(request)) return faltaCodigo();
  const runpod = runpodActivo();
  if (!runpod) return json({ error: 'La GPU no se puede manejar desde la app (faltan RUNPOD_API_KEY y RUNPOD_POD_ID).' }, 503);

  let accion: unknown;
  try {
    accion = ((await request.json()) as { accion?: unknown }).accion;
  } catch {
    return json({ error: 'La petición no se entiende.' }, 400);
  }

  try {
    if (accion === 'apagar') {
      await runpod.accion('stop');
      return json({ gpu: 'apagada', pod: 'apagado' } satisfies Respuesta);
    }
    if (accion !== 'encender') return json({ error: 'Acción desconocida.' }, 400);

    const pod = await runpod.estado();
    if (pod === 'apagado' || pod === 'error') {
      await runpod.accion('start');
      return json({ gpu: 'encendiendo', pod: 'encendiendo', detalle: 'Encendiendo el pod' } satisfies Respuesta);
    }
    if (pod === 'borrado') {
      return json({ gpu: 'error', pod, detalle: 'El pod ya no existe: hay que crear otro en RunPod.' } satisfies Respuesta);
    }
    if (pod === 'encendiendo') return json({ gpu: 'encendiendo', pod, detalle: 'Encendiendo el pod' } satisfies Respuesta);

    // Encendido: ¿contesta ya ACE-Step? Si no, se le da el arranque.
    if (await aceStepContesta()) return json({ gpu: 'lista', pod } satisfies Respuesta);
    // El script lo sirve la propia app (public/acestep-gpu.sh, copiado al construir).
    const arrancado = await runpod.arrancarServidor(new URL('/acestep-gpu.sh', request.url).toString());
    return json({
      gpu: 'encendiendo',
      pod,
      detalle: arrancado ? 'Cargando el modelo en la GPU' : 'Esperando a que el pod termine de subir',
    } satisfies Respuesta);
  } catch (error) {
    return falloRunPod(error);
  }
}
