import { afterEach, describe, expect, it, vi } from 'vitest';
import { leerWav } from '@/lib/musico/wav';
import { crearMotorAuraStudio, TEXTOS_MOTOR, traducirError } from './auraStudio';
import { crearMotorFalso, SEGUNDOS_MAX_FALSO, sintetizarAcordes } from './falso';
import { motorDeBoceto, motorPorDefecto, ponerMotorParaPruebas, usaMotorFalso } from './motores';
import { ErrorDeMotor, type PeticionMotor } from './tipos';

const responde = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });

const peticion: PeticionMotor = {
  descripcion: 'Calm piano piece, slow, instrumental.',
  segundos: 150,
  motor: 'lyria3',
  conVoz: false,
};

function motor(pedir: ReturnType<typeof vi.fn>, token: string | null = 'tok') {
  return crearMotorAuraStudio({ url: () => 'https://aura.test', token: async () => token, pedir: pedir as unknown as typeof fetch });
}

describe('motor de aura Studio', () => {
  it('encola la música con el token de la cuenta y sin ninguna clave', async () => {
    const pedir = vi.fn().mockResolvedValue(responde({ requestId: 'r1', queueSlug: 'fal-ai/lyria3/pro', queued: true }));
    const t = await motor(pedir).iniciar(peticion);

    expect(t).toEqual({ referencia: { requestId: 'r1', queueSlug: 'fal-ai/lyria3/pro' }, estado: { estado: 'en-cola' } });
    const [url, init] = pedir.mock.calls[0];
    expect(url).toBe('https://aura.test/api/fal');
    expect(init.headers.Authorization).toBe('Bearer tok');
    expect(JSON.parse(init.body)).toEqual({
      op: 'music',
      prompt: peticion.descripcion,
      duration: 150,
      musicModel: 'lyria3',
      instrumental: true,
      queue: true,
    });
  });

  it('la letra literal viaja como lyrics', async () => {
    const pedir = vi.fn().mockResolvedValue(responde({ requestId: 'r', queueSlug: 'minimax/music-3' }));
    await motor(pedir).iniciar({ ...peticion, motor: 'minimax-music-3', conVoz: true, letra: '[verse]\nFeliz día, Carmen' });
    expect(JSON.parse(pedir.mock.calls[0][1].body)).toMatchObject({ lyrics: '[verse]\nFeliz día, Carmen', instrumental: false });
  });

  it('Lyria por Google contesta con el audio ya hecho y la letra', async () => {
    const pedir = vi.fn().mockResolvedValue(
      responde({ audioUrl: 'https://storage.test/a.mp3', videoUrl: 'https://storage.test/a.mp3', modelUsed: 'google/lyria-3-pro', lyrics: '[0:00] Hola' }),
    );
    const t = await motor(pedir).iniciar(peticion);
    expect(t.estado).toEqual({ estado: 'lista', url: 'https://storage.test/a.mp3', letra: '[0:00] Hola', modelo: 'google/lyria-3-pro' });
  });

  it('sin cuenta no llama a nadie', async () => {
    const pedir = vi.fn();
    await expect(motor(pedir, null).iniciar(peticion)).rejects.toThrow(TEXTOS_MOTOR.sinCuenta);
    expect(pedir).not.toHaveBeenCalled();
  });

  it.each([
    [402, { error: 'SIN_CREDITOS · Te has quedado sin créditos.', code: 'sin_creditos' }, 'sin-creditos', TEXTOS_MOTOR.sinCreditos],
    [429, { error: 'LIMITE_ALCANZADO · Has llegado al tope de 20 audios por hora. Puedes seguir en 12 min.' }, 'limite', 'Has llegado al tope de 20 audios por hora. Puedes seguir en 12 min.'],
    [429, {}, 'limite', TEXTOS_MOTOR.limite],
    [401, { error: 'session_expired' }, 'sin-cuenta', TEXTOS_MOTOR.sinCuenta],
    [422, { error: 'Google no ha generado esta pista. Si nombras a un artista, quítalo.' }, 'bloqueado', 'Google no ha generado esta pista. Si nombras a un artista, quítalo.'],
    [502, { error: 'music failed' }, 'servidor', TEXTOS_MOTOR.servidor],
  ])('un %i se dice en castellano y NO se reintenta', async (status, cuerpo, tipo, texto) => {
    const pedir = vi.fn().mockResolvedValue(responde(cuerpo, status));
    const fallo = await motor(pedir).iniciar(peticion).catch((e: unknown) => e);
    expect(fallo).toBeInstanceOf(ErrorDeMotor);
    expect((fallo as ErrorDeMotor).tipo).toBe(tipo);
    expect((fallo as ErrorDeMotor).message).toBe(texto);
    expect(pedir).toHaveBeenCalledTimes(1);
  });

  it('sin red lo dice, y una sola llamada', async () => {
    const pedir = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(motor(pedir).iniciar(peticion)).rejects.toThrow(TEXTOS_MOTOR.sinRed);
    expect(pedir).toHaveBeenCalledTimes(1);
  });

  it('traduce los estados de la cola', async () => {
    const pedir = vi
      .fn()
      .mockResolvedValueOnce(responde({ status: 'IN_QUEUE' }))
      .mockResolvedValueOnce(responde({ status: 'IN_PROGRESS' }))
      .mockResolvedValueOnce(responde({ status: 'COMPLETED', videoUrl: 'https://fal.test/x.mp3', audioUrl: 'https://fal.test/x.mp3' }))
      .mockResolvedValueOnce(responde({ status: 'FAILED', error: 'El trabajo (fal-ai/lyria3/pro) falló en fal. Se te han devuelto 6 créditos.', creditosDevueltos: 6 }));
    const m = motor(pedir);
    const ref = { requestId: 'r1', queueSlug: 'fal-ai/lyria3/pro', modelo: 'fal-ai/lyria3/pro' };
    expect(await m.consultar(ref)).toEqual({ estado: 'en-cola' });
    expect(await m.consultar(ref)).toEqual({ estado: 'generando' });
    expect(await m.consultar(ref)).toEqual({ estado: 'lista', url: 'https://fal.test/x.mp3', modelo: 'fal-ai/lyria3/pro' });
    expect(await m.consultar(ref)).toEqual({ estado: 'fallo', error: 'La canción no ha salido. Se te han devuelto 6 créditos.' });
    expect(JSON.parse(pedir.mock.calls[0][1].body)).toEqual({ op: 'job-status', requestId: 'r1', queueSlug: 'fal-ai/lyria3/pro' });
  });

  it('consulta también por proveedor y trabajo', async () => {
    const pedir = vi.fn().mockResolvedValue(responde({ status: 'IN_PROGRESS' }));
    await motor(pedir).consultar({ provider: 'gemini', jobId: 'j1' });
    expect(JSON.parse(pedir.mock.calls[0][1].body)).toEqual({ op: 'job-status', provider: 'gemini', jobId: 'j1' });
  });

  it('una consulta que falla en el servidor se puede repetir (mirar es gratis)', async () => {
    const pedir = vi.fn().mockResolvedValue(responde({ error: 'job-status falló' }, 502));
    const fallo = (await motor(pedir).consultar({ requestId: 'r', queueSlug: 's' }).catch((e: unknown) => e)) as ErrorDeMotor;
    expect(fallo.reintentable).toBe(true);
  });

  it('no acepta como canción un enlace que no es de la red', async () => {
    const pedir = vi.fn().mockResolvedValue(responde({ status: 'COMPLETED', audioUrl: 'javascript:alert(1)' }));
    expect(await motor(pedir).consultar({ requestId: 'r', queueSlug: 's' })).toEqual({ estado: 'fallo', error: TEXTOS_MOTOR.vacio });
    expect(traducirError(500).tipo).toBe('servidor');
  });
});

describe('motor falso', () => {
  it('hace acordes de verdad, deterministas y con un pico cómodo', () => {
    const a = sintetizarAcordes({ segundos: 10, bpm: 80, energia: 0.3, semilla: 7 }, 8000);
    const b = sintetizarAcordes({ segundos: 10, bpm: 80, energia: 0.3, semilla: 7 }, 8000);
    expect(a.length).toBe(80000);
    expect(a).toEqual(b);
    const pico = a.reduce((m, x) => Math.max(m, Math.abs(x)), 0);
    expect(pico).toBeGreaterThan(0.5);
    expect(pico).toBeLessThanOrEqual(0.71);
    // Empieza y acaba en silencio: sin chasquidos.
    expect(Math.abs(a[0])).toBeLessThan(1e-6);
  });

  it('no pasa de 45 s aunque se pida una hora', () => {
    expect(sintetizarAcordes({ segundos: 3600, bpm: 70, energia: 0.2, semilla: 1 }, 1000).length).toBe(SEGUNDOS_MAX_FALSO * 1000);
  });

  it('espera un poco y entrega un WAV que suena', async () => {
    let reloj = 1000;
    const m = crearMotorFalso({ retrasoMs: 500, ahora: () => reloj });
    const t = await m.iniciar({ ...peticion, motor: 'falso', segundos: 4, bpm: 90, energia: 0.7, semilla: 3 });
    expect(t.estado).toEqual({ estado: 'en-cola' });
    expect(await m.consultar(t.referencia)).toEqual({ estado: 'generando' });
    reloj = 1600;
    const lista = await m.consultar(t.referencia);
    expect(lista.estado).toBe('lista');
    if (lista.estado !== 'lista' || !lista.audio) throw new Error('sin audio');
    expect(lista.audio.type).toBe('audio/wav');
    const { samples, sampleRate } = leerWav(await lista.audio.arrayBuffer());
    expect(sampleRate).toBe(22050);
    expect(samples.length).toBe(4 * 22050);
  });
});

describe('qué motor toca', () => {
  afterEach(() => ponerMotorParaPruebas(null));

  it('el falso si se pide, o en desarrollo sin Firebase; nunca en producción por su cuenta', () => {
    expect(usaMotorFalso({ motor: 'falso', entorno: 'production', nube: true })).toBe(true);
    expect(usaMotorFalso({ entorno: 'development', nube: false })).toBe(true);
    expect(usaMotorFalso({ entorno: 'development', nube: true })).toBe(false);
    expect(usaMotorFalso({ entorno: 'production', nube: false })).toBe(false);
  });

  it('Lyria 3 Pro por defecto, MiniMax si hay que cantar una letra literal, Lyria 3 para el boceto', () => {
    ponerMotorParaPruebas(null, { falso: false });
    expect(motorPorDefecto()).toBe('lyria3');
    expect(motorPorDefecto({ letra: 'Feliz día' })).toBe('minimax-music-3');
    expect(motorDeBoceto()).toBe('lyria3-base');
    ponerMotorParaPruebas(null, { falso: true });
    expect(motorPorDefecto({ letra: 'x' })).toBe('falso');
    expect(motorDeBoceto()).toBe('falso');
  });
});
