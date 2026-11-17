'use client';

/**
 * La mezcla, conectada al estudio.
 *
 * Dos velocidades: mientras arrastras un fader se OYE el cambio (el motor
 * mueve el parámetro al momento) pero no se guarda; al soltar se guarda una
 * vez, con su paso de Deshacer. Así un arrastre no redibuja la app entera a
 * 60 por segundo ni llena el historial de pasos de medio decibelio.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Studio } from '@/hooks/useStudio';
import type { Project } from '@/lib/daw/types';
import type { Medida } from '@/lib/daw/mezcla/sonoridad';
import { masterDe, type ObjetivoMaster } from '@/lib/daw/mezcla/tipos';
import { conMaster } from '@/lib/daw/mezcla/acciones';

export interface Masterizado {
  estado: 'nada' | 'midiendo' | 'listo' | 'vacio' | 'fallo';
  objetivo?: Exclude<ObjetivoMaster, 'no'>;
  antes?: Medida;
  despues?: Medida;
  limitadoDb?: number;
  /** La mezcla que se midió: si cambia, las cifras ya no valen. */
  huella?: string;
}

/** Lo que cambia el sonido de la mezcla (todo menos el propio masterizado). */
export function huellaDeMezcla(project: Project): string {
  const master = { ...masterDe(project), masterizado: null };
  return JSON.stringify([
    project.bpm,
    master,
    project.tracks.map((t) => [t.id, t.volume, t.muted, t.soloed, t.mezcla ?? null, t.clip]),
  ]);
}

export function useMezcla(studio: Studio) {
  const { engine, project, commit } = studio;
  const proyectoRef = useRef(project);
  proyectoRef.current = project;

  /* Cada cambio del proyecto llega al motor, también al deshacer o al
     abrir otra idea. El grafo solo toca lo que ha cambiado. */
  useEffect(() => {
    engine?.aplicarMezcla(project);
  }, [engine, project]);

  /** Oír un cambio sin guardarlo (mientras se arrastra). */
  const oir = useCallback(
    (cambio: (p: Project) => Project) => {
      engine?.aplicarMezcla(cambio(proyectoRef.current));
    },
    [engine],
  );

  /** Guardarlo, con su paso de Deshacer. Los cambios seguidos del mismo `grupo` son un solo paso. */
  const guardar = useCallback(
    (cambio: (p: Project) => Project, grupo?: string) => {
      commit(cambio, grupo ? { grupo } : {});
    },
    [commit],
  );

  const [masterizado, setMasterizado] = useState<Masterizado>({ estado: 'nada' });

  /**
   * Masterizar de un toque: mezcla en silencio, mide, calcula y deja el
   * master puesto para que el WAV salga así. Devuelve las cifras para
   * enseñarlas; el audio no se toca hasta exportar.
   */
  const masterizar = useCallback(
    async (objetivo?: Exclude<ObjetivoMaster, 'no'>) => {
      if (!engine) return;
      const actual = masterDe(proyectoRef.current).masterizado;
      const destino = objetivo ?? (actual === 'no' ? 'plataformas' : actual);
      setMasterizado({ estado: 'midiendo', objetivo: destino });
      try {
        await engine.ensureContext();
        const r = await engine.analizarMaster(proyectoRef.current, destino);
        if (!Number.isFinite(r.antes.lufs)) {
          setMasterizado({ estado: 'vacio', objetivo: destino });
          return;
        }
        commit((p) => conMaster(p, { masterizado: destino }));
        setMasterizado({
          estado: 'listo',
          objetivo: destino,
          antes: r.antes,
          despues: r.despues,
          limitadoDb: r.limitadoDb,
          huella: huellaDeMezcla(proyectoRef.current),
        });
      } catch {
        setMasterizado({ estado: 'fallo', objetivo: destino });
      }
    },
    [commit, engine],
  );

  const quitarMaster = useCallback(() => {
    commit((p) => conMaster(p, { masterizado: 'no' }));
    setMasterizado({ estado: 'nada' });
  }, [commit]);

  // Si la mezcla ha cambiado desde que se midió, las cifras ya no dicen la verdad.
  const huella = useMemo(() => huellaDeMezcla(project), [project]);
  const cifrasAlDia = masterizado.estado === 'listo' && masterizado.huella === huella;

  return { oir, guardar, masterizado, cifrasAlDia, masterizar, quitarMaster };
}

export type Mezcla = ReturnType<typeof useMezcla>;
