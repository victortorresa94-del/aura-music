import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { parse } = vi.hoisted(() => ({ parse: vi.fn() }));

// Claude simulado: misma forma que el SDK, sin red.
vi.mock('@anthropic-ai/sdk', async (importOriginal) => {
  const real = await importOriginal<typeof import('@anthropic-ai/sdk')>();
  class Falso {
    beta = { messages: { parse } };
    static AuthenticationError = real.default.AuthenticationError;
    static RateLimitError = real.default.RateLimitError;
    static APIConnectionError = real.default.APIConnectionError;
    static APIError = real.default.APIError;
  }
  return { ...real, default: Falso };
});

import { POST } from './route';

const cuerpo = {
  pedido: 'Ponle un bajo y sube el tempo',
  contexto: {
    proyecto: { nombre: 'Idea', bpm: 96, pulsosPorCompas: 4, ritmo: null },
    pistas: [{ nombre: 'Guitarra', ia: false, segundos: 12 }],
    toma: { nombre: 'Guitarra', bpm: 96, tonalidad: 'La menor', progresion: 'La m · Sol', segundos: 12 },
    ia: { disponible: false, prueba: false },
  },
  cerebro: '',
  conversacion: [],
};

const pedir = (body: unknown, cabeceras: Record<string, string> = {}) =>
  POST(
    new Request('http://localhost/api/productor', {
      method: 'POST',
      headers: { origin: 'http://localhost', 'content-type': 'application/json', ...cabeceras },
      body: JSON.stringify(body),
    }),
  );

beforeEach(() => parse.mockReset());
afterEach(() => vi.unstubAllEnvs());

describe('/api/productor', () => {
  it('sin clave de Anthropic dice que falta, sin llamar a nadie', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    const r = await pedir(cuerpo);
    expect(r.status).toBe(503);
    expect(await r.json()).toMatchObject({ sinClave: true });
    expect(parse).not.toHaveBeenCalled();
  });

  it('con candado y sin código, pide el código', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-prueba');
    vi.stubEnv('AURA_MUSIC_CODIGO', 'abre');
    expect((await pedir(cuerpo)).status).toBe(401);
    parse.mockResolvedValue({ stop_reason: 'end_turn', parsed_output: { respuesta: 'Ok', pasos: [], recuerda: [], sugerencias: [] } });
    expect((await pedir(cuerpo, { 'x-aura-music-codigo': 'abre' })).status).toBe(200);
  });

  it('rechaza lo que no viene bien formado', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-prueba');
    expect((await pedir({ pedido: 'hola' })).status).toBe(400);
  });

  it('llama a Claude con el sistema en caché y devuelve el plan ya normalizado', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-prueba');
    parse.mockResolvedValue({
      stop_reason: 'end_turn',
      parsed_output: {
        respuesta: 'Te pongo un bajo.',
        pasos: [
          { tipo: 'al_momento', instrumento: 'bajo', estilo: 'inventado', porque: 'firme' },
          { tipo: 'tempo', bpm: 120, porque: 'más energía' },
        ],
        recuerda: ['Le gustan los bajos firmes'],
        sugerencias: ['Añade batería'],
      },
    });
    const r = await pedir(cuerpo);
    expect(r.status).toBe(200);
    const { plan } = await r.json();
    // El estilo inventado pasa a uno real y el tempo no se toca: hay audio grabado.
    expect(plan.pasos).toEqual([{ tipo: 'al_momento', instrumento: 'bajo', estilo: 'raiz-quinta', porque: 'firme' }]);
    expect(plan.recuerda).toEqual(['Le gustan los bajos firmes']);

    const args = parse.mock.calls[0][0];
    expect(args.model).toBe('claude-opus-5-5');
    expect(args.fallbacks).toBe('default');
    expect(args.system[0].cache_control).toEqual({ type: 'ephemeral' });
    expect(args.messages[0].content).toContain('Ponle un bajo y sube el tempo');
  });

  it('si Claude declina, lo dice sin romperse', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-prueba');
    parse.mockResolvedValue({ stop_reason: 'refusal', parsed_output: null });
    expect((await pedir(cuerpo)).status).toBe(422);
  });
});
