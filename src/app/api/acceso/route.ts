import { accesoPermitido, faltaCodigo, hayCandado } from '@/lib/servidor/acceso';
import { json, mismoOrigen } from '../musico/_comun';

export const dynamic = 'force-dynamic';

/**
 * ¿Vale este código? Lo pregunta el móvil al pulsar «Guardar», para decir
 * al momento si es el bueno en vez de descubrirlo al fallar un pedido.
 * No gasta nada: no llama ni a Claude ni a la GPU.
 */
export async function POST(request: Request) {
  if (!mismoOrigen(request)) return json({ error: 'Origen no permitido.' }, 403);
  if (!hayCandado()) return json({ ok: true, candado: false });
  if (!accesoPermitido(request)) return faltaCodigo();
  return json({ ok: true, candado: true });
}
