import { proveedorActivo } from '@/lib/ia/proveedores';
import type { Instrumento } from '@/lib/ia/tipos';
import { LIMITE_SUBIDA_BYTES } from '@/lib/musico/wav';
import { fallo, json, mismoOrigen } from '../_comun';

export const dynamic = 'force-dynamic';

const INSTRUMENTOS: Instrumento[] = ['bajo', 'bateria', 'guitarra', 'teclado', 'cuerdas', 'metales', 'percusion', 'sinte'];
const DURACION_MAXIMA = 60;

/**
 * Encarga una pista al músico de la nube. Devuelve la tarea al momento: la
 * generación tarda de 10 a 60 segundos y la app pregunta por ella con GET.
 */
export async function POST(request: Request) {
  if (!mismoOrigen(request)) return json({ error: 'Origen no permitido.' }, 403);
  const proveedor = proveedorActivo();
  if (!proveedor) {
    return json({ error: 'No hay músico en la nube configurado (falta ACESTEP_API_URL).' }, 503);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ error: 'La petición no trae la toma.' }, 400);
  }

  const audio = form.get('audio');
  const instrumento = String(form.get('instrumento') ?? 'bajo') as Instrumento;
  const bpm = Number(form.get('bpm'));
  const duracion = Number(form.get('duracion'));
  const pulsos = Number(form.get('pulsosPorCompas') ?? 4);
  const semilla = form.get('semilla');

  if (!(audio instanceof Blob) || audio.size === 0) return json({ error: 'Falta la toma.' }, 400);
  if (audio.size > LIMITE_SUBIDA_BYTES) return json({ error: 'La toma es demasiado larga para mandarla.' }, 413);
  if (!INSTRUMENTOS.includes(instrumento)) return json({ error: 'Ese instrumento no lo toca nadie aquí.' }, 400);
  if (!(bpm >= 30 && bpm <= 300)) return json({ error: 'El tempo tiene que estar entre 30 y 300.' }, 400);
  if (!(duracion > 0 && duracion <= DURACION_MAXIMA)) {
    return json({ error: `La toma tiene que durar menos de ${DURACION_MAXIMA} segundos.` }, 400);
  }

  try {
    const tarea = await proveedor.iniciar({
      audio,
      instrumento,
      bpm,
      duracion,
      pulsosPorCompas: Number.isFinite(pulsos) ? pulsos : 4,
      tonalidad: (form.get('tonalidad') as string | null) || undefined,
      descripcion: ((form.get('descripcion') as string | null) || '').slice(0, 400) || undefined,
      semilla: semilla !== null && semilla !== '' ? Number(semilla) : undefined,
    });
    return json({ tarea: tarea.id, estado: tarea.estado, proveedor: proveedor.nombre }, 202);
  } catch (error) {
    return fallo(error);
  }
}

/** ¿Cómo va? Cuando está lista, dice de dónde bajar el audio. */
export async function GET(request: Request) {
  if (!mismoOrigen(request)) return json({ error: 'Origen no permitido.' }, 403);
  const proveedor = proveedorActivo();
  if (!proveedor) return json({ error: 'No hay músico en la nube configurado.' }, 503);
  const id = new URL(request.url).searchParams.get('tarea');
  if (!id || id.length > 200) return json({ error: 'Falta la tarea.' }, 400);

  try {
    const tarea = await proveedor.consultar(id);
    return json({
      estado: tarea.estado,
      error: tarea.error,
      audio: tarea.archivo ? `/api/musico/audio?archivo=${encodeURIComponent(tarea.archivo)}` : undefined,
    });
  } catch (error) {
    return fallo(error);
  }
}
