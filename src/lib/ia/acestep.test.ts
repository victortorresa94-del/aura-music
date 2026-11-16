import { describe, expect, it, vi } from 'vitest';
import { crearAceStep } from './acestep';
import { proveedorActivo } from './proveedores';

const sobre = (data: unknown) =>
  new Response(JSON.stringify({ data, code: 200, error: null, timestamp: 0 }), { status: 200 });

describe('ACE-Step', () => {
  it('pide un bajo con la tarea lego, el tempo, la tonalidad y la clave', async () => {
    const pedir = vi.fn().mockResolvedValue(sobre({ task_id: 't1', status: 'queued' }));
    const ace = crearAceStep({ url: 'https://gpu.example/', clave: 'k', modelo: 'acestep-v15-base' }, pedir);

    const tarea = await ace.iniciar({
      audio: new Blob([new Uint8Array(10)], { type: 'audio/wav' }),
      instrumento: 'bajo',
      bpm: 92.4,
      tonalidad: 'E minor',
      pulsosPorCompas: 4,
      duracion: 20,
    });

    expect(tarea).toEqual({ id: 't1', estado: 'en-cola' });
    const [url, init] = pedir.mock.calls[0];
    expect(url).toBe('https://gpu.example/release_task');
    expect(init.headers.Authorization).toBe('Bearer k');
    const form = init.body as FormData;
    expect(form.get('task_type')).toBe('lego');
    expect(form.get('track_name')).toBe('bass');
    expect(form.get('bpm')).toBe('92');
    expect(form.get('key_scale')).toBe('E minor');
    expect(form.get('model')).toBe('acestep-v15-base');
    expect(form.get('src_audio')).toBeInstanceOf(Blob);
  });

  it('traduce los estados de la cola', async () => {
    const pedir = vi
      .fn()
      .mockResolvedValueOnce(sobre([{ task_id: 't1', status: 0 }]))
      .mockResolvedValueOnce(
        sobre([{ task_id: 't1', status: 1, result: JSON.stringify([{ file: '/v1/audio?path=%2Ftmp%2Fa.wav' }]) }]),
      )
      .mockResolvedValueOnce(sobre([{ task_id: 't1', status: 2 }]));
    const ace = crearAceStep({ url: 'https://gpu.example' }, pedir);

    expect((await ace.consultar('t1')).estado).toBe('generando');
    expect(await ace.consultar('t1')).toEqual({ id: 't1', estado: 'listo', archivo: '/v1/audio?path=%2Ftmp%2Fa.wav' });
    expect((await ace.consultar('t1')).estado).toBe('fallo');
  });

  it('solo descarga audio de su propio servidor', async () => {
    const ace = crearAceStep({ url: 'https://gpu.example' }, vi.fn());
    await expect(ace.descargar('https://otro.sitio/robar')).rejects.toThrow('no válida');
  });

  it('da un error que se entiende si el servidor no está', async () => {
    const ace = crearAceStep({ url: 'https://gpu.example' }, vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));
    await expect(ace.consultar('t1')).rejects.toThrow('¿Está encendido?');
  });
});

describe('salud de ACE-Step', () => {
  const real = { status: 'ok', service: 'ACE-Step API', version: '1.0', loaded_model: 'acestep-v15-base' };

  it('con el servidor de verdad y la clave buena, está conectado y no es de prueba', async () => {
    const pedir = vi
      .fn()
      .mockResolvedValueOnce(sobre(real))
      .mockResolvedValueOnce(sobre({ object: 'list', data: [] }));
    const ace = crearAceStep({ url: 'https://pod-8001.proxy.runpod.net/', clave: 'k' }, pedir);

    expect(await ace.salud!()).toEqual({
      conectado: true,
      prueba: false,
      detalle: 'ACE-Step API 1.0 · acestep-v15-base',
    });
    const [url, init] = pedir.mock.calls[0];
    expect(url).toBe('https://pod-8001.proxy.runpod.net/health');
    expect(init.headers.Authorization).toBe('Bearer k');
    expect(init.signal).toBeInstanceOf(AbortSignal);
    // /health no mira la clave; /v1/models sí, y con la misma.
    expect(pedir.mock.calls[1][0]).toBe('https://pod-8001.proxy.runpod.net/v1/models');
    expect(pedir.mock.calls[1][1].headers.Authorization).toBe('Bearer k');
  });

  it('reconoce el servidor falso y no lo da por IA', async () => {
    const pedir = vi.fn().mockResolvedValueOnce(sobre({ status: 'ok', service: 'ACE-Step falso (una nota fija)' }));
    const ace = crearAceStep({ url: 'http://localhost:8001' }, pedir);

    expect(await ace.salud!()).toEqual({ conectado: true, prueba: true, detalle: 'ACE-Step falso (una nota fija)' });
    expect(pedir).toHaveBeenCalledTimes(1);
  });

  it('con la clave mala no está conectado, aunque /health conteste', async () => {
    const pedir = vi
      .fn()
      .mockResolvedValueOnce(sobre(real))
      .mockResolvedValueOnce(new Response('{"detail":"Invalid API key"}', { status: 401 }));
    const ace = crearAceStep({ url: 'https://gpu.example', clave: 'mala' }, pedir);

    const s = await ace.salud!();
    expect(s.conectado).toBe(false);
    expect(s.detalle).toContain('no acepta la clave');
  });

  it('sin clave, si el servidor la pide, dice cuál falta', async () => {
    const pedir = vi
      .fn()
      .mockResolvedValueOnce(sobre(real))
      .mockResolvedValueOnce(new Response('{"detail":"Missing Authorization header"}', { status: 401 }));
    const s = await crearAceStep({ url: 'https://gpu.example' }, pedir).salud!();
    expect(s.conectado).toBe(false);
    expect(s.detalle).toContain('ACESTEP_API_KEY');
  });

  it('si /v1/models no llega, se fía de /health', async () => {
    const pedir = vi.fn().mockResolvedValueOnce(sobre(real)).mockRejectedValueOnce(new Error('ECONNRESET'));
    expect((await crearAceStep({ url: 'https://gpu.example', clave: 'k' }, pedir).salud!()).conectado).toBe(true);
  });

  it('no lanza nunca: apagado, sin contestar, arrancando o algo que no es ACE-Step', async () => {
    const tiempo = Object.assign(new Error('timeout'), { name: 'TimeoutError' });
    const casos: [ReturnType<typeof vi.fn>, string][] = [
      [vi.fn().mockRejectedValue(new Error('ECONNREFUSED')), '¿Está encendido?'],
      [vi.fn().mockRejectedValue(tiempo), '3 segundos'],
      [vi.fn().mockResolvedValue(new Response('Bad Gateway', { status: 502 })), 'espera a que arranque'],
      [vi.fn().mockResolvedValue(new Response('nada', { status: 404 })), '404'],
      [vi.fn().mockResolvedValue(new Response('<html>hola</html>', { status: 200 })), 'no es ACE-Step'],
      [vi.fn().mockResolvedValue(sobre({ status: 'cargando' })), 'no es ACE-Step'],
    ];
    for (const [pedir, mensaje] of casos) {
      const s = await crearAceStep({ url: 'https://gpu.example' }, pedir).salud!();
      expect(s).toMatchObject({ conectado: false, prueba: false });
      expect(s.detalle).toContain(mensaje);
    }
  });
});

describe('proveedorActivo', () => {
  it('sin configurar no hay nadie, y con la URL toca ACE-Step', () => {
    expect(proveedorActivo({})).toBeNull();
    expect(proveedorActivo({ ACESTEP_API_URL: 'https://gpu.example' })?.id).toBe('acestep');
  });
});
