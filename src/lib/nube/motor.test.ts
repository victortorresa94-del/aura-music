/**
 * El motor de la nube con Firebase simulado: una «nube» en memoria que se
 * comporta como Firestore y Storage (documentos con hora del servidor,
 * carpetas de audio, fallos de red a voluntad) y dos dispositivos en memoria
 * que hacen de IndexedDB. Los mismos casos que pasarán en tu móvil y tu PC.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import type { Project } from '@/lib/daw/types';
import { cerebroVacio, type Cerebro } from '@/lib/productor/cerebro';
import { AGRUPAR_MS } from './cola';
import { aProyectoRemoto } from './documento';
import type { Pcm16 } from './flac';
import { MotorNube, type IdeaAbierta } from './motor';
import { ESPERA_ANTES_DE_BORRAR } from './reconciliar';
import { estadoVacio, type CerebroRemoto, type Dispositivo, type EstadoGuardado, type Local, type MetaAudio, type ProyectoRemoto, type Remoto } from './tipos';

let ahora = 1_800_000_000_000;

class SinRed extends Error {
  code = 'unavailable';
}

/** Firestore y Storage de una cuenta, en memoria. */
class NubeFalsa implements Remoto {
  docs = new Map<string, Record<string, unknown> & { servidorEn: number }>();
  archivos = new Map<string, Uint8Array>();
  cerebro: { json: string; updatedAt: number } | null = null;
  registro: string[] = [];
  sinRed = false;
  /** Corta la red justo al subir este audio. */
  cortarEn: string | null = null;
  private servidor = 0;

  private red(): void {
    if (this.sinRed) throw new SinRed('sin red');
  }

  async listarProyectos(desde: number | null): Promise<ProyectoRemoto[]> {
    this.red();
    return [...this.docs.entries()]
      .filter(([, d]) => desde === null || d.servidorEn > desde)
      .map(([id, d]) => aProyectoRemoto(id, d, d.servidorEn))
      .filter((p): p is ProyectoRemoto => p !== null);
  }

  async leerProyecto(id: string): Promise<ProyectoRemoto | null> {
    this.red();
    const d = this.docs.get(id);
    return d ? aProyectoRemoto(id, d, d.servidorEn) : null;
  }

  async escribirProyecto(p: Project, buffers: string[], dispositivo: Dispositivo): Promise<void> {
    this.red();
    this.registro.push(`doc:${p.id}`);
    const antes = this.docs.get(p.id) ?? {};
    this.docs.set(p.id, {
      ...antes,
      json: JSON.stringify(p),
      updatedAt: p.updatedAt,
      borrado: false,
      buffers,
      dispositivo,
      audioBorrado: false,
      servidorEn: ++this.servidor,
    });
  }

  async escribirBorrado(id: string, updatedAt: number, dispositivo: Dispositivo): Promise<void> {
    this.red();
    this.registro.push(`borrado:${id}`);
    const antes = this.docs.get(id) ?? {};
    this.docs.set(id, { ...antes, json: undefined, borrado: true, updatedAt, buffers: [], dispositivo, servidorEn: ++this.servidor });
  }

  async marcarLimpieza(id: string, huerfanos: Record<string, number>, audioBorrado?: boolean): Promise<void> {
    this.red();
    const d = this.docs.get(id);
    if (!d) throw new Error('no existe');
    this.docs.set(id, { ...d, huerfanos, ...(audioBorrado === undefined ? {} : { audioBorrado }) });
  }

  async subirAudio(pid: string, bid: string, flac: Uint8Array, _meta: MetaAudio): Promise<void> {
    this.red();
    if (this.cortarEn === bid) {
      this.sinRed = true;
      throw new SinRed('se fue la red a media subida');
    }
    this.registro.push(`audio:${pid}/${bid}`);
    this.archivos.set(`${pid}/${bid}`, flac.slice());
  }

  async bajarAudio(pid: string, bid: string): Promise<Uint8Array | null> {
    this.red();
    return this.archivos.get(`${pid}/${bid}`)?.slice() ?? null;
  }

  async listarAudios(pid: string): Promise<string[]> {
    this.red();
    return [...this.archivos.keys()].filter((k) => k.startsWith(`${pid}/`)).map((k) => k.slice(pid.length + 1));
  }

  async borrarAudio(pid: string, bid: string): Promise<void> {
    this.red();
    this.registro.push(`borrar-audio:${pid}/${bid}`);
    this.archivos.delete(`${pid}/${bid}`);
  }

  async leerCerebro(): Promise<CerebroRemoto | null> {
    this.red();
    return this.cerebro ? { cerebro: JSON.parse(this.cerebro.json) as Cerebro, updatedAt: this.cerebro.updatedAt } : null;
  }

  async escribirCerebro(cerebro: Cerebro): Promise<void> {
    this.red();
    this.cerebro = { json: JSON.stringify(cerebro), updatedAt: ahora };
  }
}

/** IndexedDB y localStorage de un dispositivo, en memoria. */
class DispositivoFalso implements Local {
  proyectos = new Map<string, Project>();
  audios = new Map<string, Pcm16>();
  cerebro: Cerebro = cerebroVacio();

  async listarProyectos(): Promise<Project[]> {
    return [...this.proyectos.values()].map((p) => structuredClone(p));
  }
  async leerProyecto(id: string): Promise<Project | null> {
    const p = this.proyectos.get(id);
    return p ? structuredClone(p) : null;
  }
  async guardarProyecto(p: Project): Promise<void> {
    this.proyectos.set(p.id, structuredClone(p));
  }
  async borrarProyecto(p: Project): Promise<void> {
    // Como storage.deleteProject: un audio solo se va si no lo usa otra idea.
    this.proyectos.delete(p.id);
    const enUso = new Set([...this.proyectos.values()].flatMap((o) => o.tracks.map((t) => t.clip.bufferId)));
    for (const t of p.tracks) if (!enUso.has(t.clip.bufferId)) this.audios.delete(t.clip.bufferId);
  }
  async leerAudio(id: string): Promise<Pcm16 | null> {
    return this.audios.get(id) ?? null;
  }
  async guardarAudio(id: string, audio: Pcm16): Promise<void> {
    this.audios.set(id, audio);
  }
  async tieneAudio(id: string): Promise<boolean> {
    return this.audios.has(id);
  }
  leerCerebro(): Cerebro {
    return structuredClone(this.cerebro);
  }
  guardarCerebro(c: Cerebro): void {
    this.cerebro = structuredClone(c);
  }
}

function toma(semilla: number, muestras = 3000): Pcm16 {
  const pcm = new Int16Array(muestras);
  let x = semilla;
  for (let i = 0; i < muestras; i++) {
    x = (x * 1103515245 + 12345) % 2147483648;
    pcm[i] = Math.round(Math.sin(i / (5 + semilla)) * 9000 + (x / 2147483648 - 0.5) * 800);
  }
  return { pcm, canales: 1, muestras, sampleRate: 48000 };
}

function idea(id: string, updatedAt: number, buffers: string[], nombre = 'Bulería de la cocina'): Project {
  return {
    id,
    name: nombre,
    bpm: 120,
    createdAt: 1,
    updatedAt,
    tracks: buffers.map((b, i) => ({
      id: `trk_${b}`,
      name: `Pista ${i + 1}`,
      clip: { bufferId: b, start: 0, offset: 0, duration: 1, repeats: 1 },
      volume: 1,
      muted: false,
      soloed: false,
      sourceDuration: 1,
      createdAt: 1,
    })),
  };
}

interface Montaje {
  motor: MotorNube;
  disp: DispositivoFalso;
  estado: { valor: EstadoGuardado };
  abierta: { valor: IdeaAbierta | null };
  grabando: { valor: boolean };
  recargadas: string[];
}

let ids = 0;

function montar(nube: NubeFalsa, nombre: string, disp = new DispositivoFalso(), estado = { valor: estadoVacio() }): Montaje {
  const abierta = { valor: null as IdeaAbierta | null };
  const grabando = { valor: false };
  const recargadas: string[] = [];
  const motor = new MotorNube({
    local: disp,
    remoto: nube,
    dispositivo: { id: `dsp_${nombre}`, nombre },
    leerEstado: () => structuredClone(estado.valor),
    guardarEstado: (e) => {
      estado.valor = structuredClone(e);
    },
    reloj: () => ahora,
    enLinea: () => !nube.sinRed,
    nuevoId: () => `prj_copia${++ids}`,
    abierta: () => abierta.valor,
    grabando: () => grabando.valor,
    alRecargarAbierta: (id) => {
      recargadas.push(id);
    },
    temporizador: { poner: () => 0, quitar: () => undefined },
  });
  return { motor, disp, estado, abierta, grabando, recargadas };
}

/** Lo que hace la app: avisar, dejar pasar el rato de agrupar, y atender la cola. */
async function guardarYSubir(m: Montaje, p: Project): Promise<void> {
  await m.disp.guardarProyecto(p);
  m.motor.avisarGuardado(p.id);
  ahora += AGRUPAR_MS + 1;
  await m.motor.bombear();
  await m.motor.enCalma();
}

async function ponerAlDia(m: Montaje, completo = false): Promise<void> {
  await m.motor.tirar(completo);
  await m.motor.enCalma();
  ahora += 1;
  await m.motor.bombear();
  await m.motor.enCalma();
}

function mismoAudio(a: Pcm16 | null | undefined, b: Pcm16 | null | undefined): boolean {
  if (!a || !b || a.muestras !== b.muestras || a.canales !== b.canales || a.sampleRate !== b.sampleRate) return false;
  for (let i = 0; i < a.pcm.length; i++) if (a.pcm[i] !== b.pcm[i]) return false;
  return true;
}

describe('la nube con dos dispositivos', () => {
  let nube: NubeFalsa;
  let movil: Montaje;
  let pc: Montaje;

  beforeEach(() => {
    nube = new NubeFalsa();
    movil = montar(nube, 'iPhone');
    pc = montar(nube, 'PC');
  });

  it('al entrar por primera vez sube lo que ya había: primero el audio, después la idea', async () => {
    movil.disp.audios.set('buf_a', toma(1));
    movil.disp.audios.set('buf_b', toma(2));
    await movil.disp.guardarProyecto(idea('prj_1', 100, ['buf_a', 'buf_b']));
    await ponerAlDia(movil, true);
    expect(nube.registro).toEqual(['audio:prj_1/buf_a', 'audio:prj_1/buf_b', 'doc:prj_1']);
    expect(movil.motor.estadoPublico.fase).toBe('al-dia');
    expect(movil.motor.estadoPublico.pendientes).toBe(0);
    expect(movil.estado.valor.base.prj_1).toBe(100);
  });

  it('en el otro dispositivo aparece la idea y el audio baja al abrirla, idéntico', async () => {
    movil.disp.audios.set('buf_a', toma(1));
    await movil.disp.guardarProyecto(idea('prj_1', 100, ['buf_a']));
    await ponerAlDia(movil, true);

    await ponerAlDia(pc, true);
    const enElPc = await pc.disp.leerProyecto('prj_1');
    expect(enElPc?.name).toBe('Bulería de la cocina');
    // Solo el documento: el audio no se baja hasta abrirla.
    expect(pc.disp.audios.size).toBe(0);
    let avisado = false;
    expect(await pc.motor.asegurarAudio(enElPc as Project, () => (avisado = true))).toBe(1);
    expect(avisado).toBe(true);
    expect(mismoAudio(pc.disp.audios.get('buf_a'), movil.disp.audios.get('buf_a'))).toBe(true);
    // La segunda vez ya está: no se baja nada.
    expect(await pc.motor.asegurarAudio(enElPc as Project)).toBe(0);
    // Y no se vuelve a subir lo que acaba de bajar.
    expect(nube.registro.filter((r) => r.startsWith('doc:'))).toHaveLength(1);
  });

  it('lo que cambias en uno llega al otro, y un audio ya subido no se sube otra vez', async () => {
    movil.disp.audios.set('buf_a', toma(1));
    await guardarYSubir(movil, idea('prj_1', 100, ['buf_a']));
    await ponerAlDia(pc, true);

    movil.disp.audios.set('buf_b', toma(2));
    ahora += 1000;
    await guardarYSubir(movil, idea('prj_1', ahora, ['buf_a', 'buf_b'], 'Bulería con bajo'));
    expect(nube.registro.filter((r) => r === 'audio:prj_1/buf_a')).toHaveLength(1);

    await ponerAlDia(pc);
    expect((await pc.disp.leerProyecto('prj_1'))?.name).toBe('Bulería con bajo');
    expect(pc.estado.valor.base.prj_1).toBe(ahora - AGRUPAR_MS - 2);
  });

  it('un choque: gana la última modificación y la toma de la que pierde se queda como copia', async () => {
    movil.disp.audios.set('buf_a', toma(1));
    await guardarYSubir(movil, idea('prj_1', 100, ['buf_a']));
    await ponerAlDia(pc, true);
    await pc.motor.asegurarAudio(idea('prj_1', 100, ['buf_a']));

    // Sin red en el móvil, grabas «b». En el PC, más tarde, grabas «c».
    nube.sinRed = true;
    movil.disp.audios.set('buf_b', toma(2));
    await movil.disp.guardarProyecto(idea('prj_1', 200, ['buf_a', 'buf_b'], 'Versión del móvil'));
    movil.motor.avisarGuardado('prj_1');
    nube.sinRed = false;
    pc.disp.audios.set('buf_c', toma(3));
    ahora += 10;
    await guardarYSubir(pc, idea('prj_1', 300, ['buf_a', 'buf_c'], 'Versión del PC'));

    // Vuelve la red en el móvil.
    ahora += AGRUPAR_MS + 1;
    await ponerAlDia(movil);
    const ideasDelMovil = await movil.disp.listarProyectos();
    const ganadora = ideasDelMovil.find((p) => p.id === 'prj_1');
    const copia = ideasDelMovil.find((p) => p.id !== 'prj_1');
    expect(ganadora?.name).toBe('Versión del PC');
    expect(copia?.name).toBe('Versión del móvil · copia del iPhone');
    expect(copia?.tracks.map((t) => t.clip.bufferId)).toEqual(['buf_a', 'buf_b']);

    // La copia sube con sus audios a su carpeta, y el PC la ve con la toma «b» intacta.
    await ponerAlDia(pc);
    const copiaEnElPc = await pc.disp.leerProyecto(copia?.id as string);
    expect(copiaEnElPc).not.toBeNull();
    await pc.motor.asegurarAudio(copiaEnElPc as Project);
    expect(mismoAudio(pc.disp.audios.get('buf_b'), toma(2))).toBe(true);
  });

  it('si gana la de aquí, la de la nube con tomas que aquí no están también queda como copia', async () => {
    movil.disp.audios.set('buf_a', toma(1));
    await guardarYSubir(movil, idea('prj_1', 100, ['buf_a']));
    await ponerAlDia(pc, true);

    pc.disp.audios.set('buf_c', toma(3));
    await guardarYSubir(pc, idea('prj_1', 200, ['buf_a', 'buf_c'], 'Del PC'));
    // El móvil la toca después, sin haberse enterado.
    movil.disp.audios.set('buf_b', toma(2));
    await movil.disp.guardarProyecto(idea('prj_1', 300, ['buf_a', 'buf_b'], 'Del móvil'));
    await ponerAlDia(movil);

    const ideas = await movil.disp.listarProyectos();
    expect(ideas.find((p) => p.id === 'prj_1')?.name).toBe('Del móvil');
    const copia = ideas.find((p) => p.id !== 'prj_1');
    expect(copia?.name).toBe('Del PC · copia del PC');
    // Su audio ya está aquí: se bajó antes de crear la copia.
    expect(mismoAudio(movil.disp.audios.get('buf_c'), toma(3))).toBe(true);
    expect(JSON.parse(nube.docs.get('prj_1')?.json as string).name).toBe('Del móvil');
  });

  it('borrar en un dispositivo borra en el otro, pero nunca cambios que no habían subido', async () => {
    movil.disp.audios.set('buf_a', toma(1));
    await guardarYSubir(movil, idea('prj_1', 100, ['buf_a']));
    await guardarYSubir(movil, idea('prj_2', 100, ['buf_a2']));
    await ponerAlDia(pc, true);
    expect(pc.disp.proyectos.size).toBe(2);

    // El PC toca prj_2 sin red. El móvil borra las dos.
    nube.sinRed = true;
    await pc.disp.guardarProyecto(idea('prj_2', 500, ['buf_a2'], 'Retocada en el PC'));
    nube.sinRed = false;
    for (const id of ['prj_1', 'prj_2']) {
      const p = await movil.disp.leerProyecto(id);
      await movil.disp.borrarProyecto(p as Project);
      movil.motor.avisarBorrado(id);
    }
    await movil.motor.enCalma();
    expect(nube.docs.get('prj_1')?.borrado).toBe(true);

    await ponerAlDia(pc);
    expect(pc.disp.proyectos.has('prj_1')).toBe(false);
    // prj_2 vuelve: tenía cambios del PC que no habían subido.
    expect(pc.disp.proyectos.get('prj_2')?.name).toBe('Retocada en el PC');
    expect(nube.docs.get('prj_2')?.borrado).toBe(false);
  });

  it('sin red, lo pendiente espera; al volver, sube solo', async () => {
    nube.sinRed = true;
    movil.disp.audios.set('buf_a', toma(1));
    await guardarYSubir(movil, idea('prj_1', 100, ['buf_a']));
    expect(movil.motor.estadoPublico.fase).toBe('sin-conexion');
    expect(movil.motor.estadoPublico.pendientes).toBe(1);
    expect(movil.estado.valor.cola).toHaveLength(1);

    // Cerrar la app y volver a abrirla: lo pendiente sigue ahí.
    const otraVez = montar(nube, 'iPhone', movil.disp, movil.estado);
    expect(otraVez.motor.guardado.cola).toHaveLength(1);
    nube.sinRed = false;
    otraVez.motor.reintentar();
    await otraVez.motor.enCalma();
    await otraVez.motor.bombear();
    await otraVez.motor.enCalma();
    expect(nube.registro).toContain('doc:prj_1');
    expect(otraVez.motor.estadoPublico.pendientes).toBe(0);
  });

  it('si la red se va a media subida, la idea no se publica sin su audio', async () => {
    movil.disp.audios.set('buf_a', toma(1));
    movil.disp.audios.set('buf_b', toma(2));
    nube.cortarEn = 'buf_b';
    await guardarYSubir(movil, idea('prj_1', 100, ['buf_a', 'buf_b']));
    expect(nube.registro).toEqual(['audio:prj_1/buf_a']);
    expect(nube.docs.has('prj_1')).toBe(false);

    nube.cortarEn = null;
    nube.sinRed = false;
    movil.motor.reintentar();
    await movil.motor.enCalma();
    ahora += 10_000;
    await movil.motor.bombear();
    await movil.motor.enCalma();
    // Lo que ya había subido no se repite.
    expect(nube.registro).toEqual(['audio:prj_1/buf_a', 'audio:prj_1/buf_b', 'doc:prj_1']);
  });

  it('mientras grabas no se sube nada', async () => {
    movil.grabando.valor = true;
    movil.disp.audios.set('buf_a', toma(1));
    await guardarYSubir(movil, idea('prj_1', 100, ['buf_a']));
    expect(nube.registro).toEqual([]);
    movil.grabando.valor = false;
    await movil.motor.bombear();
    await movil.motor.enCalma();
    expect(nube.registro).toContain('doc:prj_1');
  });

  it('la idea abierta no se cambia por debajo si ya la habías tocado: se avisa', async () => {
    pc.disp.audios.set('buf_a', toma(1));
    await guardarYSubir(pc, idea('prj_1', 100, ['buf_a']));
    await ponerAlDia(movil, true);
    movil.abierta.valor = { id: 'prj_1', intacta: false, ocupado: false };

    ahora += 1000;
    pc.disp.audios.set('buf_b', toma(2));
    await guardarYSubir(pc, idea('prj_1', ahora, ['buf_a', 'buf_b'], 'Del PC'));
    await ponerAlDia(movil);
    expect((await movil.disp.leerProyecto('prj_1'))?.name).toBe('Bulería de la cocina');
    expect(movil.motor.estadoPublico.cambioEnLaAbierta).toEqual({ id: 'prj_1', dispositivo: 'PC' });

    await movil.motor.cargarLaDeLaNube();
    await movil.motor.enCalma();
    expect((await movil.disp.leerProyecto('prj_1'))?.name).toBe('Del PC');
    expect(movil.recargadas).toEqual(['prj_1']);
    expect(movil.motor.estadoPublico.cambioEnLaAbierta).toBeNull();
  });

  it('si estaba intacta, se cambia sola y el estudio la vuelve a cargar', async () => {
    pc.disp.audios.set('buf_a', toma(1));
    await guardarYSubir(pc, idea('prj_1', 100, ['buf_a']));
    await ponerAlDia(movil, true);
    movil.abierta.valor = { id: 'prj_1', intacta: true, ocupado: false };
    ahora += 1000;
    await guardarYSubir(pc, idea('prj_1', ahora, ['buf_a'], 'Renombrada en el PC'));
    await ponerAlDia(movil);
    expect((await movil.disp.leerProyecto('prj_1'))?.name).toBe('Renombrada en el PC');
    expect(movil.recargadas).toEqual(['prj_1']);
  });

  it('«seguir con la mía» sube la tuya y guarda la de la nube como copia si traía tomas', async () => {
    pc.disp.audios.set('buf_a', toma(1));
    await guardarYSubir(pc, idea('prj_1', 100, ['buf_a']));
    await ponerAlDia(movil, true);
    movil.abierta.valor = { id: 'prj_1', intacta: false, ocupado: false };
    ahora += 1000;
    pc.disp.audios.set('buf_b', toma(2));
    await guardarYSubir(pc, idea('prj_1', ahora, ['buf_a', 'buf_b'], 'Del PC'));
    await ponerAlDia(movil);

    await movil.motor.quedarmeConLaMia();
    await movil.motor.enCalma();
    ahora += 1;
    await movil.motor.bombear();
    await movil.motor.enCalma();
    expect(JSON.parse(nube.docs.get('prj_1')?.json as string).name).toBe('Bulería de la cocina');
    const copia = [...movil.disp.proyectos.values()].find((p) => p.id !== 'prj_1');
    expect(copia?.name).toBe('Del PC · copia del PC');
    expect(mismoAudio(movil.disp.audios.get('buf_b'), toma(2))).toBe(true);
  });

  it('el cerebro: lo aprendido en los dos se junta, y lo olvidado se queda olvidado', async () => {
    const nota = (texto: string) => ({ texto, fecha: '2026-11-20' });
    movil.disp.cerebro = { ...cerebroVacio(), notas: [nota('Le gusta la rumba'), nota('Toca en Mi frigio')] };
    await ponerAlDia(movil, true);
    await ponerAlDia(pc, true);
    expect(pc.disp.cerebro.notas.map((n) => n.texto)).toEqual(['Le gusta la rumba', 'Toca en Mi frigio']);

    // En el PC aprende algo; en el móvil olvidas la rumba.
    pc.disp.cerebro = { ...pc.disp.cerebro, notas: [nota('Bajo caminante'), ...pc.disp.cerebro.notas] };
    pc.motor.avisarCerebro();
    ahora += 6000;
    await pc.motor.bombear();
    await pc.motor.enCalma();
    movil.disp.cerebro = { ...movil.disp.cerebro, notas: [nota('Toca en Mi frigio')] };
    movil.motor.avisarCerebro();
    ahora += 6000;
    await movil.motor.bombear();
    await movil.motor.enCalma();
    await ponerAlDia(pc);

    const textos = (c: Cerebro) => c.notas.map((n) => n.texto).sort();
    expect(textos(movil.disp.cerebro)).toEqual(['Bajo caminante', 'Toca en Mi frigio']);
    expect(textos(pc.disp.cerebro)).toEqual(['Bajo caminante', 'Toca en Mi frigio']);
  });

  it('la limpieza: el audio que ya no usa nadie se va a los 30 días; el que se usa, nunca', async () => {
    movil.disp.audios.set('buf_a', toma(1));
    movil.disp.audios.set('buf_b', toma(2));
    await guardarYSubir(movil, idea('prj_1', 100, ['buf_a', 'buf_b']));
    // Borras la pista «b».
    await guardarYSubir(movil, idea('prj_1', 200, ['buf_a']));
    await movil.motor.limpiar();
    expect(nube.archivos.has('prj_1/buf_b')).toBe(true);
    expect(nube.docs.get('prj_1')?.huerfanos).toEqual({ buf_b: ahora });

    ahora += ESPERA_ANTES_DE_BORRAR;
    await movil.motor.limpiar();
    expect(nube.archivos.has('prj_1/buf_b')).toBe(false);
    expect(nube.archivos.has('prj_1/buf_a')).toBe(true);
  });

  it('y una idea borrada pierde su audio en la nube a los 30 días, no antes', async () => {
    movil.disp.audios.set('buf_a', toma(1));
    await guardarYSubir(movil, idea('prj_1', 100, ['buf_a']));
    const p = await movil.disp.leerProyecto('prj_1');
    await movil.disp.borrarProyecto(p as Project);
    movil.motor.avisarBorrado('prj_1');
    await movil.motor.enCalma();
    await movil.motor.limpiar();
    expect(nube.archivos.has('prj_1/buf_a')).toBe(true);
    ahora += ESPERA_ANTES_DE_BORRAR + 1;
    await movil.motor.limpiar();
    expect(nube.archivos.has('prj_1/buf_a')).toBe(false);
    expect(nube.docs.get('prj_1')?.audioBorrado).toBe(true);
  });
});
