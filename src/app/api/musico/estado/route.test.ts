import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';

const sobre = (data: unknown) => new Response(JSON.stringify({ data, code: 200, error: null }), { status: 200 });

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('/api/musico/estado', () => {
  it('sin configurar: no hay IA y no se pregunta a nadie', async () => {
    vi.stubEnv('ACESTEP_API_URL', '');
    const pedir = vi.fn();
    vi.stubGlobal('fetch', pedir);

    expect(await (await GET()).json()).toEqual({ ia: false, conectado: false, prueba: false, proveedor: null });
    expect(pedir).not.toHaveBeenCalled();
  });

  it('con el servidor falso: configurado y conectado, pero de prueba y con su nombre', async () => {
    vi.stubEnv('ACESTEP_API_URL', 'http://localhost:8001');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(sobre({ status: 'ok', service: 'ACE-Step falso (una nota fija)' })));

    expect(await (await GET()).json()).toEqual({
      ia: true,
      conectado: true,
      prueba: true,
      proveedor: 'ACE-Step falso (una nota fija)',
    });
  });

  it('con el pod apagado: configurado pero sin conectar, y no lanza', async () => {
    vi.stubEnv('ACESTEP_API_URL', 'https://pod-8001.proxy.runpod.net');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));

    const respuesta = await GET();
    expect(respuesta.status).toBe(200);
    expect(respuesta.headers.get('Cache-Control')).toBe('no-store');
    expect(await respuesta.json()).toEqual({ ia: true, conectado: false, prueba: false, proveedor: 'ACE-Step 1.5' });
  });

  it('con ACE-Step de verdad: conectado y no de prueba', async () => {
    vi.stubEnv('ACESTEP_API_URL', 'https://pod-8001.proxy.runpod.net');
    vi.stubEnv('ACESTEP_API_KEY', 'k');
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(sobre({ status: 'ok', service: 'ACE-Step API', version: '1.0' }))
        .mockResolvedValueOnce(sobre({ data: [] })),
    );

    expect(await (await GET()).json()).toEqual({ ia: true, conectado: true, prueba: false, proveedor: 'ACE-Step 1.5' });
  });
});
