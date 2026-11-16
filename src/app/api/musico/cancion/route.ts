import { z } from 'zod';
import { proveedorActivo } from '@/lib/ia/proveedores';
import { SEGUNDOS_CANCION } from '@/lib/productor/plan';
import { accesoPermitido, faltaCodigo } from '@/lib/servidor/acceso';
import { fallo, json, mismoOrigen } from '../_comun';

export const dynamic = 'force-dynamic';

const CancionSchema = z.object({
  descripcion: z.string().trim().min(3).max(600),
  letra: z.string().max(3000).nullable().optional(),
  segundos: z.number().min(SEGUNDOS_CANCION.min).max(SEGUNDOS_CANCION.max),
  bpm: z.number().min(40).max(240).nullable().optional(),
  tonalidad: z.string().max(30).nullable().optional(),
  pulsosPorCompas: z.number().int().min(1).max(16).optional(),
});

/**
 * Encarga una canción entera, sin toma. Como las pistas: devuelve la tarea al
 * momento y la app pregunta por ella en GET /api/musico/pista?tarea=…
 */
export async function POST(request: Request) {
  if (!mismoOrigen(request)) return json({ error: 'Origen no permitido.' }, 403);
  if (!accesoPermitido(request)) return faltaCodigo();
  const proveedor = proveedorActivo();
  if (!proveedor) return json({ error: 'No hay músico en la nube configurado (falta ACESTEP_API_URL).' }, 503);
  if (!proveedor.iniciarCancion) return json({ error: `${proveedor.nombre} no sabe hacer canciones enteras.` }, 501);

  let datos: unknown;
  try {
    datos = await request.json();
  } catch {
    return json({ error: 'La petición no se entiende.' }, 400);
  }
  const pedido = CancionSchema.safeParse(datos);
  if (!pedido.success) return json({ error: 'La canción no viene bien pedida.' }, 400);

  try {
    const tarea = await proveedor.iniciarCancion({
      descripcion: pedido.data.descripcion,
      letra: pedido.data.letra ?? undefined,
      segundos: pedido.data.segundos,
      bpm: pedido.data.bpm ?? undefined,
      tonalidad: pedido.data.tonalidad ?? undefined,
      pulsosPorCompas: pedido.data.pulsosPorCompas,
      semilla: Date.now() % 100_000,
    });
    return json({ tarea: tarea.id, estado: tarea.estado, proveedor: proveedor.nombre }, 202);
  } catch (error) {
    return fallo(error);
  }
}
