import { proveedorActivo } from '@/lib/ia/proveedores';
import { fallo, json, mismoOrigen } from '../_comun';

export const dynamic = 'force-dynamic';

/**
 * Baja la pista generada a través de nuestro servidor: la clave del servidor
 * de la GPU no puede viajar al móvil.
 */
export async function GET(request: Request) {
  if (!mismoOrigen(request)) return json({ error: 'Origen no permitido.' }, 403);
  const proveedor = proveedorActivo();
  if (!proveedor) return json({ error: 'No hay músico en la nube configurado.' }, 503);
  const archivo = new URL(request.url).searchParams.get('archivo');
  if (!archivo) return json({ error: 'Falta el archivo.' }, 400);

  try {
    const respuesta = await proveedor.descargar(archivo);
    return new Response(respuesta.body, {
      headers: {
        'Content-Type': respuesta.headers.get('content-type') ?? 'audio/wav',
        'Cache-Control': 'private, max-age=600',
      },
    });
  } catch (error) {
    return fallo(error);
  }
}
