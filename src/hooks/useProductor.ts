'use client';

/**
 * El productor, conectado al estudio.
 *
 * Le pides algo con palabras, Claude devuelve un plan de pasos y aquí se
 * ejecutan uno a uno con las mismas piezas que usas a mano: el músico al
 * momento, el músico con IA, el tempo y la canción entera. Cada pista que
 * sale es una pista más, y se deshace con el Deshacer de siempre.
 *
 * El cerebro (lo que va aprendiendo de ti) vive en este móvil; con cada
 * pedido viaja un resumen de unas líneas. Ver src/lib/productor/cerebro.ts.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Studio } from '@/hooks/useStudio';
import type { Musico, PeticionMomento } from '@/hooks/useMusico';
import { cabecerasDeAcceso, FaltaCodigo } from '@/lib/acceso';
import type { Escucha } from '@/lib/musico/escucha';
import type { EstiloBajo } from '@/lib/musico/bajo';
import type { EstiloTeclas } from '@/lib/musico/teclas';
import type { Track } from '@/lib/daw/types';
import type { Paso, Plan } from '@/lib/productor/plan';
import { rehacerPistaDeNotas } from '@/hooks/useInstrumentos';
import { getInstrumento } from '@/lib/instrumentos/registro';
import { ajustesParaCuadrar, describirDiagnostico, diagnosticar } from '@/lib/musico/groove';
import type { ContextoProductor, TurnoProductor } from '@/lib/productor/prompt';
import {
  apuntarIdea,
  apuntarNotas,
  apuntarPedido,
  apuntarToma,
  apuntarUso,
  cerebroVacio,
  CLAVE_CEREBRO,
  leerCerebro,
  olvidarNota,
  resumirCerebro,
  type Cerebro,
} from '@/lib/productor/cerebro';

export type EstadoPaso = 'pendiente' | 'haciendo' | 'hecho' | 'saltado' | 'fallo';

export interface PasoEnCurso {
  paso: Paso;
  estado: EstadoPaso;
  nota?: string;
}

export interface Turno {
  id: string;
  pedido: string;
  estado: 'pensando' | 'haciendo' | 'listo' | 'fallo';
  respuesta?: string;
  pasos: PasoEnCurso[];
  sugerencias: string[];
  aprendido: string[];
  error?: string;
}

/** La toma sobre la que se toca: la elegida si es tuya; si no, la última que grabaste. */
export function tomaObjetivo(studio: Pick<Studio, 'selectedTrack' | 'project'>): Track | null {
  const elegida = studio.selectedTrack;
  if (elegida && !elegida.ia) return elegida;
  const grabadas = studio.project.tracks.filter((t) => !t.ia);
  return grabadas[grabadas.length - 1] ?? null;
}

export function useProductor(studio: Studio, musico: Musico, pulsosPorCompas: number, ritmo: string | null) {
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [cerebro, setCerebro] = useState<Cerebro>(cerebroVacio);
  const [necesitaCodigo, setNecesitaCodigo] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  // Lo último de todo, para que los pasos que tardan no trabajen con un estado viejo.
  const studioRef = useRef(studio);
  studioRef.current = studio;
  const musicoRef = useRef(musico);
  musicoRef.current = musico;
  const turnosRef = useRef(turnos);
  turnosRef.current = turnos;
  const cerebroRef = useRef(cerebro);
  // El pedido que se quedó esperando el código: se repite solo al guardarlo.
  const pendienteRef = useRef<string | null>(null);

  useEffect(() => {
    let guardado: string | null = null;
    try {
      guardado = window.localStorage.getItem(CLAVE_CEREBRO);
    } catch {
      /* sin almacenamiento, el cerebro dura lo que la pestaña */
    }
    const leido = leerCerebro(guardado);
    cerebroRef.current = leido;
    setCerebro(leido);
  }, []);

  const cambiarCerebro = useCallback((cambio: (c: Cerebro) => Cerebro) => {
    const siguiente = cambio(cerebroRef.current);
    cerebroRef.current = siguiente;
    setCerebro(siguiente);
    try {
      window.localStorage.setItem(CLAVE_CEREBRO, JSON.stringify(siguiente));
    } catch {
      /* sin almacenamiento, el cerebro dura lo que la pestaña */
    }
  }, []);

  const cambiarTurno = useCallback((id: string, cambio: (t: Turno) => Turno) => {
    setTurnos((todos) => todos.map((t) => (t.id === id ? cambio(t) : t)));
  }, []);

  const cambiarPaso = useCallback(
    (id: string, indice: number, datos: Partial<PasoEnCurso>) =>
      cambiarTurno(id, (t) => ({ ...t, pasos: t.pasos.map((p, i) => (i === indice ? { ...p, ...datos } : p)) })),
    [cambiarTurno],
  );

  /** Ejecuta un paso del plan. Nunca lanza: devuelve cómo ha ido. */
  const ejecutar = useCallback(
    async (paso: Paso, toma: Track | null, oido: Escucha | null): Promise<Pick<PasoEnCurso, 'estado' | 'nota'>> => {
      const m = musicoRef.current;
      const s = studioRef.current;
      const iaLista = Boolean(m.ia?.disponible);

      switch (paso.tipo) {
        case 'al_momento': {
          if (!toma || !oido) return { estado: 'saltado', nota: 'Graba una toma primero.' };
          const peticion: PeticionMomento =
            paso.instrumento === 'bateria'
              ? { instrumento: 'bateria', ritmo: paso.estilo }
              : paso.instrumento === 'bajo'
                ? { instrumento: 'bajo', estilo: paso.estilo as EstiloBajo }
                : { instrumento: 'teclado', estilo: paso.estilo as EstiloTeclas };
          const ok = await m.tocarAlMomento(toma, oido, peticion);
          if (!ok) return { estado: 'fallo', nota: 'No he oído acordes claros en tu toma.' };
          cambiarCerebro((c) =>
            apuntarUso(c, paso.instrumento === 'bateria' ? `ritmo:${paso.estilo}` : `${paso.instrumento}:${paso.estilo}`),
          );
          return { estado: 'hecho' };
        }
        case 'con_ia': {
          if (!toma || !oido) return { estado: 'saltado', nota: 'Graba una toma primero.' };
          if (!iaLista) return { estado: 'saltado', nota: 'La IA está apagada.' };
          const ok = await m.tocarConIA(toma, oido, paso.instrumento as Parameters<Musico['tocarConIA']>[2], paso.descripcion);
          if (!ok) return { estado: 'fallo', nota: 'No ha salido. Mira el aviso del músico.' };
          cambiarCerebro((c) => apuntarUso(c, `ia:${paso.instrumento}`));
          return { estado: 'hecho' };
        }
        case 'tempo': {
          s.setBpm(paso.bpm);
          return { estado: 'hecho' };
        }
        case 'cancion': {
          if (!iaLista) return { estado: 'saltado', nota: 'La IA está apagada.' };
          const ok = await m.crearCancion({
            descripcion: paso.descripcion,
            letra: paso.letra,
            segundos: paso.segundos,
            bpm: paso.bpm,
            tonalidad: paso.tonalidad,
          });
          if (!ok) return { estado: 'fallo', nota: 'No ha salido. Mira el aviso del músico.' };
          cambiarCerebro((c) => apuntarUso(c, 'ia:cancion'));
          return { estado: 'hecho' };
        }
        case 'cuadrar': {
          // Pilar B: lo mismo que el botón «Cuadrar» de la pista, con los ajustes de Claude.
          const pista = s.project.tracks.find((t) => t.notas && t.name === paso.pista);
          if (!pista?.notas) return { estado: 'saltado', nota: 'No encuentro esa pista tocada en la pantalla.' };
          const ajustes = ajustesParaCuadrar(pista.notas.bruto, pista.notas.ajustes, {
            fuerza: paso.fuerza / 100,
            swing: paso.swing / 100,
            humanizar: paso.humanizar,
            inicioBeat: (pista.clip.start * s.project.bpm) / 60,
            semilla: (Date.now() % 9973) + 1,
          });
          const ok = await rehacerPistaDeNotas(s, pista.id, { ajustes });
          if (!ok) return { estado: 'fallo', nota: 'No he podido rehacer el sonido de la pista.' };
          cambiarCerebro((c) => apuntarUso(c, 'cuadrar'));
          return { estado: 'hecho' };
        }
      }
    },
    [cambiarCerebro],
  );

  const pedir = useCallback(
    async (texto: string) => {
      const pedido = texto.trim();
      if (!pedido || ocupado) return;
      setOcupado(true);
      const id = `t${Date.now().toString(36)}`;
      const s = studioRef.current;
      const m = musicoRef.current;

      // Lo que oye antes de pensar: la toma sobre la que tocaría.
      const toma = tomaObjetivo(s);
      let oido: Escucha | null = null;
      if (toma) oido = m.escucha && m.escucha.trackId === toma.id ? m.escucha : m.escuchar(toma);

      const contexto: ContextoProductor = {
        proyecto: { nombre: s.project.name, bpm: s.project.bpm, pulsosPorCompas, ritmo },
        pistas: s.project.tracks.map((t) => ({
          nombre: t.name,
          ia: Boolean(t.ia),
          segundos: t.clip.duration * t.clip.repeats,
          // Pilar B: lo tocado en la pantalla va con su diagnóstico de tiempo.
          notas: t.notas
            ? {
                instrumento: getInstrumento(t.notas.instrumento).nombre.toLowerCase(),
                diagnostico:
                  t.notas.bruto.length > 3
                    ? describirDiagnostico(
                        diagnosticar(t.notas.bruto, {
                          bpm: t.notas.bpm,
                          inicioBeat: (t.clip.start * t.notas.bpm) / 60,
                          pulsosPorCompas: t.notas.pulsosPorCompas,
                        }),
                      )
                    : null,
              }
            : null,
        })),
        toma:
          toma && oido
            ? {
                nombre: toma.name,
                bpm: oido.bpm,
                tonalidad: oido.tonalidad?.nombre ?? null,
                progresion: oido.progresion,
                segundos: oido.duracion,
              }
            : null,
        ia: { disponible: Boolean(m.ia?.disponible), prueba: Boolean(m.ia?.prueba) },
      };
      const conversacion: TurnoProductor[] = turnosRef.current.slice(-3).flatMap((t) => [
        { de: 'musico' as const, texto: t.pedido },
        ...(t.respuesta ? [{ de: 'productor' as const, texto: t.respuesta }] : []),
      ]);

      cambiarCerebro((c) => {
        let siguiente = apuntarPedido(c, pedido);
        if (oido) siguiente = apuntarToma(siguiente, { bpm: oido.bpm, tonalidad: oido.tonalidad?.nombre ?? null });
        return apuntarIdea(siguiente, s.project.id, {
          nombre: s.project.name,
          bpm: s.project.bpm,
          tonalidad: oido?.tonalidad?.nombre ?? null,
          pistas: s.project.tracks.length,
        });
      });
      setTurnos((todos) => [...todos, { id, pedido, estado: 'pensando', pasos: [], sugerencias: [], aprendido: [] }]);

      try {
        const respuesta = await fetch('/api/productor', {
          method: 'POST',
          headers: cabecerasDeAcceso({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ pedido, contexto, cerebro: resumirCerebro(cerebroRef.current), conversacion }),
        });
        if (respuesta.status === 401) {
          setNecesitaCodigo(true);
          throw new FaltaCodigo();
        }
        const datos = (await respuesta.json()) as { plan?: Plan; error?: string };
        if (!respuesta.ok || !datos.plan) throw new Error(datos.error ?? 'El productor no ha contestado.');
        const plan = datos.plan;

        cambiarCerebro((c) => apuntarNotas(c, plan.recuerda));
        cambiarTurno(id, (t) => ({
          ...t,
          estado: plan.pasos.length ? 'haciendo' : 'listo',
          respuesta: plan.respuesta,
          sugerencias: plan.sugerencias,
          aprendido: plan.recuerda,
          pasos: plan.pasos.map((paso) => ({ paso, estado: 'pendiente' })),
        }));

        for (let i = 0; i < plan.pasos.length; i++) {
          cambiarPaso(id, i, { estado: 'haciendo' });
          cambiarPaso(id, i, await ejecutar(plan.pasos[i], toma, oido));
        }
        cambiarTurno(id, (t) => ({ ...t, estado: 'listo' }));
      } catch (e) {
        if (e instanceof FaltaCodigo) pendienteRef.current = pedido;
        cambiarTurno(id, (t) => ({ ...t, estado: 'fallo', error: (e as Error).message }));
      } finally {
        setOcupado(false);
      }
    },
    [ocupado, pulsosPorCompas, ritmo, cambiarCerebro, cambiarTurno, cambiarPaso, ejecutar],
  );
  const pedirRef = useRef(pedir);
  pedirRef.current = pedir;

  const olvidar = useCallback((indice: number) => cambiarCerebro((c) => olvidarNota(c, indice)), [cambiarCerebro]);
  const olvidarTodo = useCallback(() => cambiarCerebro(() => cerebroVacio()), [cambiarCerebro]);

  /** Con el código ya bueno, lo que se quedó esperando se pide otra vez, sin reescribirlo. */
  const codigoGuardado = useCallback(() => {
    setNecesitaCodigo(false);
    const pendiente = pendienteRef.current;
    pendienteRef.current = null;
    if (!pendiente) return;
    setTurnos((todos) => todos.filter((t) => !(t.estado === 'fallo' && t.pedido === pendiente)));
    void pedirRef.current(pendiente);
  }, []);

  return { turnos, cerebro, ocupado, necesitaCodigo, pedir, olvidar, olvidarTodo, codigoGuardado };
}

export type Productor = ReturnType<typeof useProductor>;
