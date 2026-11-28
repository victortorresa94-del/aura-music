import { describe, expect, it } from 'vitest';
import { leerRespuestaDeSaldo, leerSaldo, obtenerToken, urlAuraStudio, urlRecargar } from './cuenta';

/**
 * El saldo se pregunta a aura Studio (`/api/admin?action=saldo`). Aquí nunca
 * se le llama de verdad: `fetch` simulado con lo que contesta su código
 * (`aura-studio/api/admin.ts`, acción `saldo`).
 */

type Llamada = { url: string; init?: RequestInit };

function fetchQueContesta(...respuestas: (Response | Error)[]) {
  const llamadas: Llamada[] = [];
  const f = (async (url: string, init?: RequestInit) => {
    llamadas.push({ url, init });
    const r = respuestas.shift();
    if (!r) throw new Error('no esperaba otra llamada');
    if (r instanceof Error) throw r;
    return r;
  }) as unknown as typeof fetch;
  return { f, llamadas };
}

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } });

describe('leerRespuestaDeSaldo', () => {
  it('lo pagado más lo del plan; lo de prueba aparte porque no paga música', () => {
    const s = leerRespuestaDeSaldo({
      saldo: 30,
      saldoPlan: 90,
      saldoRegalo: 20,
      saldoRegaloChat: 40,
      conMonedero: true,
      tarifa: 'normal',
      plan: { id: 'lite', nombre: 'Lite', estado: 'activo', creditos: 200 },
      pagos: true,
    });
    expect(s).toEqual({ saldo: 120, sinCobro: false, dePrueba: 60, plan: { nombre: 'Lite', estado: 'activo' }, pagaCon: null, tarifa: 'normal' });
  });

  it('en negativo es la deuda: el plan no la tapa', () => {
    expect(leerRespuestaDeSaldo({ saldo: -50, saldoPlan: 200, conMonedero: true })?.saldo).toBe(-50);
  });

  it('sin monedero no se cobra nada (los dueños de aura)', () => {
    const s = leerRespuestaDeSaldo({ saldo: 0, saldoRegaloChat: 0, saldoRegalo: 0, conMonedero: false, tarifa: 'normal', pagos: true });
    expect(s).toMatchObject({ saldo: null, sinCobro: true });
  });

  it('gastar los créditos de una cuenta que no paga tampoco cobra', () => {
    const s = leerRespuestaDeSaldo({
      saldo: null,
      conMonedero: false,
      pagaCon: { nombre: 'BeServices', sinCobro: true },
      pagos: false,
    });
    expect(s).toMatchObject({ saldo: null, sinCobro: true, pagaCon: 'BeServices' });
  });

  it('gastar los de otra cuenta que sí paga: su saldo y su nombre', () => {
    const s = leerRespuestaDeSaldo({ saldo: 500, saldoPlan: 0, conMonedero: true, pagaCon: { nombre: 'BeServices' }, tarifa: 'socio' });
    expect(s).toMatchObject({ saldo: 500, sinCobro: false, pagaCon: 'BeServices', tarifa: 'socio' });
  });

  it('una respuesta que no es un saldo no se pinta como cero', () => {
    expect(leerRespuestaDeSaldo(null)).toBeNull();
    expect(leerRespuestaDeSaldo({ error: 'unauthorized' })).toBeNull();
    expect(leerRespuestaDeSaldo({ saldo: 'mucho', conMonedero: true })).toBeNull();
  });

  it('un plan terminado o con forma rara no sale', () => {
    expect(leerRespuestaDeSaldo({ saldo: 1, conMonedero: true, plan: { nombre: 'Lite', estado: 'terminado' } })?.plan).toBeNull();
    expect(leerRespuestaDeSaldo({ saldo: 1, conMonedero: true, plan: { estado: 'activo' } })?.plan).toBeNull();
  });
});

describe('leerSaldo', () => {
  it('pregunta a aura Studio con el token y lee lo que contesta', async () => {
    const { f, llamadas } = fetchQueContesta(json({ saldo: 14, saldoPlan: 0, conMonedero: true }));
    const r = await leerSaldo({ token: async () => 'tok-1', fetch: f, base: 'https://estudio.test' });
    expect(r).toMatchObject({ motivo: null, saldo: { saldo: 14, sinCobro: false } });
    expect(llamadas).toHaveLength(1);
    expect(llamadas[0].url).toBe('https://estudio.test/api/admin?action=saldo');
    expect((llamadas[0].init?.headers as Record<string, string>).Authorization).toBe('Bearer tok-1');
    expect(llamadas[0].init?.credentials).toBe('omit');
  });

  it('sin sesión no pregunta y lo dice', async () => {
    const { f, llamadas } = fetchQueContesta();
    const r = await leerSaldo({ token: async () => null, fetch: f });
    expect(r.saldo).toBeNull();
    expect(r.motivo).toMatch(/Entra con tu cuenta/);
    expect(llamadas).toHaveLength(0);
  });

  it('un 401 se reintenta una vez con un token nuevo', async () => {
    const pedidos: boolean[] = [];
    const { f, llamadas } = fetchQueContesta(json({ error: 'unauthorized' }, 401), json({ saldo: 6, conMonedero: true }));
    const r = await leerSaldo({
      token: async (forzar) => {
        pedidos.push(forzar);
        return forzar ? 'tok-nuevo' : 'tok-viejo';
      },
      fetch: f,
    });
    expect(pedidos).toEqual([false, true]);
    expect((llamadas[1].init?.headers as Record<string, string>).Authorization).toBe('Bearer tok-nuevo');
    expect(r.saldo?.saldo).toBe(6);
  });

  it('dos 401 seguidos: la sesión ha caducado', async () => {
    const { f } = fetchQueContesta(json({ error: 'unauthorized' }, 401), json({ error: 'unauthorized' }, 401));
    const r = await leerSaldo({ token: async () => 'tok', fetch: f });
    expect(r).toEqual({ saldo: null, motivo: 'Tu sesión de aura ha caducado. Sal y vuelve a entrar.' });
  });

  it('sin red: null y el motivo, sin lanzar', async () => {
    const { f } = fetchQueContesta(new TypeError('Failed to fetch'));
    const r = await leerSaldo({ token: async () => 'tok', fetch: f });
    expect(r).toEqual({ saldo: null, motivo: 'Sin conexión. Prueba cuando vuelva la red.' });
  });

  it('aura Studio caído o con una respuesta rara: que no contesta', async () => {
    for (const respuesta of [json({ error: 'boom' }, 500), new Response('<html>', { status: 200 }), json({ nada: true })]) {
      const { f } = fetchQueContesta(respuesta);
      const r = await leerSaldo({ token: async () => 'tok', fetch: f });
      expect(r.saldo).toBeNull();
      expect(r.motivo).toMatch(/no contesta/);
    }
  });

  it('si el token no se puede pedir, su motivo', async () => {
    const r = await leerSaldo({
      token: async () => {
        throw new Error('Sin conexión. Prueba cuando vuelva la red.');
      },
      fetch: fetchQueContesta().f,
    });
    expect(r).toEqual({ saldo: null, motivo: 'Sin conexión. Prueba cuando vuelva la red.' });
  });

  it('se corta si tarda demasiado', async () => {
    const lento = ((_url: string, init?: RequestInit) =>
      new Promise((_, rechazar) => {
        init?.signal?.addEventListener('abort', () => rechazar(new DOMException('abort', 'AbortError')));
      })) as unknown as typeof fetch;
    const r = await leerSaldo({ token: async () => 'tok', fetch: lento, esperaMs: 20 });
    expect(r.saldo).toBeNull();
    expect(r.motivo).toMatch(/tarda en contestar/);
  });
});

describe('la cuenta sin configuración', () => {
  it('sin Firebase no hay token ni nada que cargar', async () => {
    expect(await obtenerToken()).toBeNull();
  });

  it('recargar va a los Ajustes de aura Studio, al apartado del plan', () => {
    expect(urlAuraStudio()).toBe('https://aurastudio.cat');
    expect(urlRecargar()).toBe('https://aurastudio.cat/app?ajustes=plan&ref=aura-music');
  });
});
