import { proveedorActivo } from '@/lib/ia/proveedores';
import type { SaludProveedor } from '@/lib/ia/tipos';
import { json } from '../_comun';

export const dynamic = 'force-dynamic';

export interface EstadoMusico {
  /** Hay un músico en la nube configurado (ACESTEP_API_URL). */
  ia: boolean;
  /** Y contesta ahora mismo, con la clave buena. */
  conectado: boolean;
  /** Lo que contesta es un servidor de prueba (`npm run ia:falso`), no IA. */
  prueba: boolean;
  /** Quién toca, para enseñarlo. Si es de prueba, lo dice. */
  proveedor: string | null;
}

/**
 * ¿Hay músico en la nube y está ahí? La app lo pregunta para no ofrecer lo
 * que no hay y para no hacer pasar por IA un servidor de prueba.
 *
 * Barato: como mucho una comprobación de 3 s contra el servidor, que no le
 * pide ningún trabajo. No lanza nunca: ante la duda, «no conectado».
 */
export async function GET() {
  const nadie: EstadoMusico = { ia: false, conectado: false, prueba: false, proveedor: null };
  try {
    const proveedor = proveedorActivo();
    if (!proveedor) return json(nadie);

    // Un proveedor sin comprobación se da por bueno si está configurado.
    let salud: SaludProveedor = { conectado: true, prueba: false };
    if (proveedor.salud) {
      salud = await proveedor.salud().catch((): SaludProveedor => ({ conectado: false, prueba: false }));
    }
    const estado: EstadoMusico = {
      ia: true,
      conectado: salud.conectado,
      prueba: salud.prueba,
      proveedor: salud.prueba ? (salud.detalle ?? `${proveedor.nombre} (prueba)`) : proveedor.nombre,
    };
    return json(estado);
  } catch {
    return json(nadie);
  }
}
