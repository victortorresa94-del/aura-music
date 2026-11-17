import { afterEach, describe, expect, it, vi } from 'vitest';
import { crearRunPod, estadoDelPod, ordenDeArranque } from '@/lib/ia/runpod';
import { GET, POST } from './route';

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
const aceStepVivo = () => json({ data: { status: 'ok', service: 'ACE-Step API' }, code: 200, error: null });

/** RunPod y ACE-Step de mentira: responden según la URL y apuntan lo que se les pide. */
function redFalsa(pod: { status: string }, opciones: { aceStep?: boolean; exec?: number } = {}) {
  const llamadas: { url: string; metodo: string; cuerpo?: unknown }[] = [];
  const pedir = vi.fn(async (url: string, init: RequestInit = {}) => {
    const cuerpo = init.body ? JSON.parse(String(init.body)) : undefined;
    llamadas.push({ url, metodo: init.method ?? 'GET', cuerpo });
    if (url.includes('proxy.runpod.net/health')) return opciones.aceStep ? aceStepVivo() : new Response('502', { status: 502 });
    if (url.includes('proxy.runpod.net/v1/models')) return json({ data: { data: [] }, code: 200, error: null });
    if (url.endsWith('/action')) return json({ id: 'p', status: cuerpo.action === 'start' ? 'STARTING' : 'EXITED' });
    if (url.endsWith('/exec')) return json({ stdout: 'ok', stderr: '', exitCode: 0, timedOut: false }, opciones.exec ?? 200);
    return json({ id: 'p', status: pod.status });
  });
  vi.stubGlobal('fetch', pedir);
  return llamadas;
}

const peticion = (metodo: 'GET' | 'POST', cuerpo?: unknown, cabeceras: Record<string, string> = {}) =>
  new Request('https://aura.test/api/gpu', {
    method: metodo,
    headers: { origin: 'https://aura.test', 'content-type': 'application/json', ...cabeceras },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });

function conGpu() {
  vi.stubEnv('RUNPOD_API_KEY', 'rp-prueba');
  vi.stubEnv('RUNPOD_POD_ID', 'abc123');
  vi.stubEnv('ACESTEP_API_URL', 'https://abc123-8001.proxy.runpod.net');
  vi.stubEnv('ACESTEP_API_KEY', 'k');
  vi.stubEnv('AURA_MUSIC_CODIGO', '');
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('RunPod', () => {
  it('traduce los estados del pod a los de la app', () => {
    expect(estadoDelPod('RUNNING')).toBe('encendido');
    expect(estadoDelPod('STARTING')).toBe('encendiendo');
    expect(estadoDelPod('PROVISIONING')).toBe('encendiendo');
    expect(estadoDelPod('EXITED')).toBe('apagado');
    expect(estadoDelPod('TERMINATED')).toBe('borrado');
    expect(estadoDelPod('ERROR')).toBe('error');
  });

  it('la orden de arranque no duplica ACE-Step si ya contesta o ya está arrancando', () => {
    const [, , orden] = ordenDeArranque();
    expect(orden).toContain('127.0.0.1:8001/health');
    expect(orden).toContain("pgrep -f '/workspace/acestep-gpu.sh'");
    expect(orden).toContain('nohup bash');
  });

  it('baja el script de la app y le pasa la clave, sin dejar colar nada a la shell', () => {
    const [, , orden] = ordenDeArranque({
      urlScript: 'https://aura.test/acestep-gpu.sh',
      clave: "abc'; rm -rf /; echo '",
    });
    expect(orden).toContain("curl -fsSL -m 20 'https://aura.test/acestep-gpu.sh'");
    expect(orden).toContain("ACESTEP_API_KEY='abcrm-rf/echo'");
    expect(orden).not.toContain('; rm');
  });

  it('usa la API v2 con la clave en Bearer', async () => {
    const pedir = vi.fn(async () => json({ status: 'EXITED' }));
    const rp = crearRunPod({ clave: 'secreta', podId: 'abc123' }, pedir as unknown as typeof fetch);
    expect(await rp.estado()).toBe('apagado');
    const [url, init] = pedir.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.runpod.io/v2/pods/abc123');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer secreta');
  });

  it('una clave mala o un pod que no existe se explican', async () => {
    const mala = crearRunPod({ clave: 'x', podId: 'p' }, (async () => new Response('', { status: 401 })) as unknown as typeof fetch);
    await expect(mala.estado()).rejects.toThrow(/RUNPOD_API_KEY/);
    const borrado = crearRunPod({ clave: 'x', podId: 'p' }, (async () => new Response('', { status: 404 })) as unknown as typeof fetch);
    await expect(borrado.estado()).rejects.toThrow(/RUNPOD_POD_ID/);
  });
});

describe('/api/gpu', () => {
  it('sin clave de RunPod dice qué falta', async () => {
    vi.stubEnv('RUNPOD_API_KEY', '');
    expect((await GET(peticion('GET'))).status).toBe(503);
  });

  it('encender con candado y sin código: pide el código', async () => {
    conGpu();
    vi.stubEnv('AURA_MUSIC_CODIGO', 'abre');
    redFalsa({ status: 'EXITED' });
    expect((await POST(peticion('POST', { accion: 'encender' }))).status).toBe(401);
  });

  it('pod parado: lo enciende', async () => {
    conGpu();
    const llamadas = redFalsa({ status: 'EXITED' });
    const r = await POST(peticion('POST', { accion: 'encender' }));
    expect(await r.json()).toMatchObject({ gpu: 'encendiendo' });
    expect(llamadas.some((l) => l.url.endsWith('/action') && (l.cuerpo as { action: string }).action === 'start')).toBe(true);
  });

  it('pod encendido sin ACE-Step: lo arranca dentro', async () => {
    conGpu();
    const llamadas = redFalsa({ status: 'RUNNING' }, { aceStep: false });
    const r = await POST(peticion('POST', { accion: 'encender' }));
    expect(await r.json()).toMatchObject({ gpu: 'encendiendo', detalle: 'Cargando el modelo en la GPU' });
    const exec = llamadas.find((l) => l.url.endsWith('/exec'));
    const orden = (exec?.cuerpo as { command: string[] }).command[2];
    expect(orden).toContain('https://aura.test/acestep-gpu.sh');
    expect(orden).toContain("ACESTEP_API_KEY='k'");
  });

  it('contenedor aún subiendo (409 en exec): espera sin fallar', async () => {
    conGpu();
    redFalsa({ status: 'RUNNING' }, { aceStep: false, exec: 409 });
    const r = await POST(peticion('POST', { accion: 'encender' }));
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ gpu: 'encendiendo' });
  });

  it('ACE-Step contesta: lista, sin volver a arrancar nada', async () => {
    conGpu();
    const llamadas = redFalsa({ status: 'RUNNING' }, { aceStep: true });
    const r = await POST(peticion('POST', { accion: 'encender' }));
    expect(await r.json()).toMatchObject({ gpu: 'lista' });
    expect(llamadas.some((l) => l.url.endsWith('/exec') || l.url.endsWith('/action'))).toBe(false);
  });

  it('apagar para el pod', async () => {
    conGpu();
    const llamadas = redFalsa({ status: 'RUNNING' });
    const r = await POST(peticion('POST', { accion: 'apagar' }));
    expect(await r.json()).toMatchObject({ gpu: 'apagada' });
    expect(llamadas.some((l) => l.url.endsWith('/action') && (l.cuerpo as { action: string }).action === 'stop')).toBe(true);
  });
});
