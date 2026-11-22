'use client';

/**
 * La claqueta, conectada al estudio. Vive en `StudioApp` para que el motor
 * sepa siempre cómo tiene que sonar (al abrir la app, al cambiar de compás
 * con un ritmo flamenco, al rehacer el contexto en iOS), aunque la hoja de
 * tempo esté cerrada.
 */

import { useCallback, useEffect, useMemo } from 'react';
import type { Studio } from '@/hooks/useStudio';
import { claquetaDe, type AjustesClaqueta } from '@/lib/daw/claqueta/claqueta';

export function useClaqueta(studio: Pick<Studio, 'engine' | 'settings'>, pulsosPorCompas: number) {
  const { engine, settings } = studio;
  const ajustes = useMemo(() => claquetaDe(settings), [settings]);
  useEffect(() => {
    engine?.setClaqueta(ajustes, pulsosPorCompas);
  }, [engine, ajustes, pulsosPorCompas]);
  return ajustes;
}

/**
 * Elegir algo de la claqueta desde la hoja: se guarda (se recuerda la
 * próxima vez), entra en el motor ya mismo y, si se pide, suena un ejemplo.
 * El desbloqueo del audio va dentro del propio toque, como pide iOS.
 */
export function useElegirClaqueta(studio: Pick<Studio, 'engine' | 'settings' | 'updateSettings'>) {
  const { engine, settings, updateSettings } = studio;
  const ajustes = useMemo(() => claquetaDe(settings), [settings]);
  const elegir = useCallback(
    (cambio: Partial<AjustesClaqueta>, ejemplo?: 'clic' | 'fondo') => {
      const siguiente = claquetaDe({ claqueta: { ...ajustes, ...cambio } });
      updateSettings({ claqueta: siguiente });
      engine?.setClaqueta(siguiente);
      if (ejemplo && engine) {
        engine.unlockSync();
        engine.previewClaqueta(siguiente, ejemplo);
      }
    },
    [ajustes, engine, updateSettings],
  );
  return { ajustes, elegir };
}
