import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { normalizarPlan, PlanSchema } from '@/lib/productor/plan';
import { armarMensaje, PeticionProductorSchema, SISTEMA } from '@/lib/productor/prompt';
import { accesoPermitido, faltaCodigo } from '@/lib/servidor/acceso';
import { json, mismoOrigen } from '../musico/_comun';

export const dynamic = 'force-dynamic';
// Pensar un plan lleva de 5 a 30 segundos; el límite deja margen.
export const maxDuration = 60;

const MODELO = process.env.PRODUCTOR_MODELO || 'claude-opus-5-5';

/**
 * El productor: recibe tu pedido, el estado del proyecto y lo que recuerda
 * de ti, y devuelve un plan de pasos que ejecuta el móvil. La clave de
 * Anthropic solo existe aquí, en el servidor.
 */
export async function POST(request: Request) {
  if (!mismoOrigen(request)) return json({ error: 'Origen no permitido.' }, 403);
  if (!accesoPermitido(request)) return faltaCodigo();
  if (!process.env.ANTHROPIC_API_KEY) {
    return json({ error: 'El productor necesita una clave de Anthropic en el servidor.', sinClave: true }, 503);
  }

  let datos: unknown;
  try {
    datos = await request.json();
  } catch {
    return json({ error: 'La petición no se entiende.' }, 400);
  }
  const peticion = PeticionProductorSchema.safeParse(datos);
  if (!peticion.success) return json({ error: 'El pedido no viene bien formado.' }, 400);

  const client = new Anthropic();
  try {
    const respuesta = await client.beta.messages.parse({
      model: MODELO,
      max_tokens: 16000,
      // Si el modelo declina por un falso positivo de seguridad, la API
      // reintenta en otro modelo dentro de la misma llamada.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium', format: betaZodOutputFormat(PlanSchema) },
      system: [{ type: 'text', text: SISTEMA, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: armarMensaje(peticion.data) }],
    });

    if (respuesta.stop_reason === 'refusal') {
      return json({ error: 'Eso no te lo puedo preparar. Prueba a pedirlo de otra forma.' }, 422);
    }
    if (respuesta.stop_reason === 'max_tokens' || !respuesta.parsed_output) {
      return json({ error: 'El productor se ha liado con la respuesta. Prueba otra vez.' }, 502);
    }

    const contexto = peticion.data.contexto;
    const plan = normalizarPlan(respuesta.parsed_output, {
      // Las pistas tocadas en la pantalla siguen al tempo (son notas): no cuentan.
      hayTomas: contexto.pistas.some((p) => !p.ia && !p.notas),
      bpm: contexto.toma?.bpm ?? contexto.proyecto.bpm,
      pistas: contexto.pistas.map((p) => p.nombre),
      pistasDeNotas: contexto.pistas.filter((p) => p.notas).map((p) => p.nombre),
    });
    return json({ plan });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      return json({ error: 'La clave de Anthropic del servidor no vale.', sinClave: true }, 503);
    }
    if (error instanceof Anthropic.RateLimitError) {
      return json({ error: 'El productor tiene mucho lío ahora. Prueba en un minuto.' }, 429);
    }
    if (error instanceof Anthropic.APIConnectionError) {
      return json({ error: 'No llego a Claude. Mira la conexión del servidor.' }, 503);
    }
    if (error instanceof Anthropic.APIError) {
      return json({ error: `Claude ha respondido con un error (${error.status ?? 'sin código'}).` }, 502);
    }
    return json({ error: 'Algo ha fallado al hablar con el productor.' }, 500);
  }
}
