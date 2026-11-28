import { describe, expect, it } from 'vitest';
import { creditosDeReceta } from '../precios';
import { PROMESAS_DE_SALUD } from '../reglas';
import { MOMENTOS, type AdnArtista } from '../tipos';
import { arcoDeEnergia, creditosDeEntradas, planDePlaylist, tamanoDePlan, TAMANOS } from './plan';

const lola = {
  id: 'art_1',
  nombre: 'Lola Niebla',
  adn: {
    estilo: 'rumba lenta',
    instrumentos: ['guitarra española', 'cajón'],
    voz: 'grave y cálida',
    idioma: 'es',
    tempo: { min: 90, max: 110 },
    nunca: 'autotune',
  } satisfies AdnArtista,
};

describe('el plan de una playlist', () => {
  it('por defecto 8 canciones; se piden 4, 8 o 12', () => {
    expect(planDePlaylist({ momento: 'concentrarme' }).entradas).toHaveLength(8);
    for (const n of TAMANOS) expect(planDePlaylist({ momento: 'correr', n }).entradas).toHaveLength(n);
    expect(tamanoDePlan(40)).toBe(12);
    expect(tamanoDePlan(0)).toBe(1);
    expect(tamanoDePlan(undefined)).toBe(8);
  });

  it('el total es lo que suman sus canciones, y es lo que dice el botón', () => {
    const plan = planDePlaylist({ momento: 'desconectar', n: 8 });
    expect(plan.total).toBe(plan.entradas.reduce((s, e) => s + creditosDeReceta(e.receta), 0));
    expect(plan.total).toBe(48); // 8 de Lyria 3 Pro a 6
    expect(creditosDeEntradas(plan.entradas.slice(0, 3))).toBe(18);
    expect(planDePlaylist({ momento: 'desconectar', n: 4, motor: 'falso' }).total).toBe(0);
  });

  it('cada canción con su título (sin repetir) y su porqué en una frase', () => {
    for (const momento of MOMENTOS) {
      const plan = planDePlaylist({ momento, n: 12, frase: 'que suene a verano' });
      const titulos = plan.entradas.map((e) => e.titulo);
      expect(new Set(titulos).size).toBe(12);
      for (const e of plan.entradas) {
        expect(e.porque).toMatch(/^[A-ZÁÉÍÓÚ].+\.$/);
        expect(e.porque).not.toMatch(/[—–]/);
        expect(e.porque).not.toMatch(PROMESAS_DE_SALUD);
        expect(e.receta.tipo).toBe('cancion');
        expect(e.receta.frase).toBe('que suene a verano');
      }
      expect(plan.porque).not.toMatch(PROMESAS_DE_SALUD);
    }
  });

  it('son variadas: no ocho veces la misma receta', () => {
    const plan = planDePlaylist({ momento: 'concentrarme', n: 8 });
    expect(new Set(plan.entradas.map((e) => e.receta.estilo)).size).toBe(8);
  });

  it('el arco: empieza a media altura, sube y se asienta', () => {
    for (const momento of MOMENTOS.filter((m) => m !== 'dormir')) {
      for (const n of TAMANOS) {
        const e = arcoDeEnergia(momento, n);
        const pico = Math.max(...e);
        const iPico = e.indexOf(pico);
        expect(e[0]).toBeGreaterThanOrEqual(0.4);
        expect(e[0]).toBeLessThanOrEqual(0.6);
        expect(pico).toBeGreaterThan(e[0]);
        expect(pico).toBeGreaterThan(e[n - 1]);
        for (let i = 1; i <= iPico; i++) expect(e[i]).toBeGreaterThanOrEqual(e[i - 1]);
        for (let i = iPico + 1; i < n; i++) expect(e[i]).toBeLessThanOrEqual(e[i - 1]);
      }
    }
  });

  it('para dormir, solo baja: energía y tempo', () => {
    const plan = planDePlaylist({ momento: 'dormir', n: 12 });
    const energias = plan.entradas.map((e) => e.receta.energia ?? 0);
    const bpms = plan.entradas.map((e) => e.receta.bpm ?? 0);
    for (let i = 1; i < 12; i++) {
      expect(energias[i]).toBeLessThan(energias[i - 1]);
      expect(bpms[i]).toBeLessThanOrEqual(bpms[i - 1]);
    }
    expect(plan.entradas.every((e) => !e.receta.conVoz)).toBe(true);
    expect(plan.entradas[11].porque).toMatch(/apagar la luz/);
  });

  it('la voz por defecto según el momento, y la frase manda', () => {
    expect(planDePlaylist({ momento: 'concentrarme' }).entradas.some((e) => e.receta.conVoz)).toBe(false);
    expect(planDePlaylist({ momento: 'correr' }).entradas.every((e) => e.receta.conVoz)).toBe(true);
    expect(planDePlaylist({ momento: 'correr', frase: 'instrumental y rápida' }).entradas.some((e) => e.receta.conVoz)).toBe(false);
    expect(planDePlaylist({ momento: 'concentrarme', frase: 'con voz suave' }).entradas.every((e) => e.receta.conVoz)).toBe(true);
    const sorpresa = planDePlaylist({ momento: 'sorprendeme' }).entradas.map((e) => e.receta.conVoz);
    expect(sorpresa).toContain(true);
    expect(sorpresa).toContain(false);
  });

  it('determinista: la misma petición, el mismo plan; otra semilla, otro', () => {
    const a = planDePlaylist({ momento: 'correr', frase: 'Mi ruta del domingo' });
    expect(planDePlaylist({ momento: 'correr', frase: 'Mi ruta del domingo' })).toEqual(a);
    expect(planDePlaylist({ momento: 'correr', frase: 'Mi ruta del domingo', semilla: 'otra' }).entradas.map((e) => e.titulo)).not.toEqual(
      a.entradas.map((e) => e.titulo),
    );
  });

  it('el nombre sale de la frase o del momento', () => {
    expect(planDePlaylist({ momento: 'correr', frase: 'mi ruta del domingo' }).nombre).toBe('Mi ruta del domingo');
    expect(planDePlaylist({ momento: 'dormir' }).nombre).toBe('Para dormir');
    expect(planDePlaylist({ momento: 'dormir', artista: lola }).nombre).toBe('Lola Niebla, para dormir');
    expect(planDePlaylist({ momento: 'concentrarme', frase: 'x '.repeat(40) }).nombre.length).toBeLessThanOrEqual(41);
  });

  it('con un artista: su estilo, su voz, su idioma y su tempo, que sube con la energía', () => {
    const plan = planDePlaylist({ momento: 'para-alguien', artista: lola, n: 8 });
    for (const e of plan.entradas) {
      expect(e.receta.artistaId).toBe('art_1');
      expect(e.receta.estilo).toContain('rumba lenta');
      expect(e.receta.conVoz).toBe(true);
      expect(e.receta.idioma).toBe('es');
      expect(e.receta.bpm).toBeGreaterThanOrEqual(90);
      expect(e.receta.bpm).toBeLessThanOrEqual(110);
      // Lo que no hace nunca no viaja en la receta.
      expect(JSON.stringify(e.receta)).not.toContain('autotune');
    }
    expect(plan.artistaId).toBe('art_1');
    expect(plan.porque).toContain('de Lola Niebla');
  });

  it('solo el id del artista: lo apunta, pero las texturas son las del momento', () => {
    const plan = planDePlaylist({ momento: 'correr', artistaId: 'art_9', n: 4 });
    expect(plan.entradas.every((e) => e.receta.artistaId === 'art_9')).toBe(true);
  });

  it('una renovación: «La de esta semana», sin repetir títulos de la playlist', () => {
    const base = planDePlaylist({ momento: 'sorprendeme', artista: lola, n: 1, renovacion: 'semana', semilla: 's1' });
    expect(base.entradas[0].porque).toMatch(/^La de esta semana, /);
    const otra = planDePlaylist({
      momento: 'sorprendeme',
      artista: lola,
      n: 1,
      renovacion: 'semana',
      semilla: 's1',
      evitarTitulos: [base.entradas[0].titulo],
    });
    expect(otra.entradas[0].titulo).not.toBe(base.entradas[0].titulo);
    expect(planDePlaylist({ momento: 'dormir', n: 1, renovacion: 'dia' }).entradas[0].porque).toMatch(/^La de hoy, /);
  });

  it('si se acaban los títulos, el mismo con «II»', () => {
    const todos = planDePlaylist({ momento: 'correr', n: 12 }).entradas.map((e) => e.titulo);
    const mas = planDePlaylist({ momento: 'correr', n: 12, semilla: 'b', evitarTitulos: todos });
    expect(new Set(mas.entradas.map((e) => e.titulo)).size).toBe(12);
    expect(mas.entradas.some((e) => / II$/.test(e.titulo))).toBe(true);
    for (const t of mas.entradas) expect(todos).not.toContain(t.titulo);
  });

  it('una frase que imita a alguien real queda marcada (y así no se genera)', () => {
    expect(planDePlaylist({ momento: 'correr', frase: 'que suene como Rosalía' }).imitacion).toBe('Rosalía');
    expect(planDePlaylist({ momento: 'correr', frase: 'Rollo Estopa pero más lento' }).imitacion).toBe('Estopa');
    expect(planDePlaylist({ momento: 'correr', frase: 'que suene a verano' }).imitacion).toBeNull();
  });
});
