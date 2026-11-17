'use client';

/**
 * Todo lo que hace de Aura Music una app instalada y no una web: el service
 * worker y sus versiones, instalar, los audios compartidos desde Android, el
 * aviso de almacenamiento lleno y qué pasa cuando el móvil se lleva la app a
 * media toma. Vive en su propio hook para tocar lo mínimo `useStudio`.
 */

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import * as store from '@/lib/daw/storage';
import { activarVersionNueva, registrarServiceWorker, sePuedeActualizar } from '@/lib/pwa/actualizacion';
import { audiosCompartidos, leerCompartido, olvidarCompartidos } from '@/lib/pwa/compartir';
import { EVENTO_ALMACENAMIENTO_LLENO } from '@/lib/pwa/espacio';
import {
  estadoInstalacion,
  estadoInstalacionServidor,
  suscribirInstalacion,
} from '@/lib/pwa/instalacion';
import type { Studio } from './useStudio';

export function useInstalacion() {
  return useSyncExternalStore(suscribirInstalacion, estadoInstalacion, estadoInstalacionServidor);
}

export function usePwa(studio: Studio) {
  const { transport, busy, project, setStatus, engine } = studio;

  /* ---------------------------------------------------------------- */
  /* Versión nueva                                                     */
  /* ---------------------------------------------------------------- */

  const [registro, setRegistro] = useState<ServiceWorkerRegistration | null>(null);
  const [versionNueva, setVersionNueva] = useState(false);
  const [aplazada, setAplazada] = useState(false);

  useEffect(() => {
    void registrarServiceWorker((conVersion) => {
      setRegistro(conVersion);
      setVersionNueva(true);
    });
  }, []);

  const projectRef = useRef(project);
  projectRef.current = project;

  const libre = sePuedeActualizar(transport, busy !== null);

  const actualizar = useCallback(async () => {
    // Doble cerrojo: el aviso ya se esconde mientras suena, pero el toque
    // puede llegar justo cuando arranca la grabación.
    if (!registro || !sePuedeActualizar(engine?.transportState ?? 'stopped', busy !== null)) return;
    setVersionNueva(false);
    // Lo último que hayas tocado, a disco antes de recargar: el guardado
    // normal espera 600 ms y una recarga no espera a nadie.
    try {
      await store.saveProject(projectRef.current);
    } catch {
      /* si no se puede guardar, tampoco se puede perder: sigue en el disco lo anterior */
    }
    activarVersionNueva(registro);
  }, [registro, engine, busy]);

  /* ---------------------------------------------------------------- */
  /* Audios compartidos desde otra app                                  */
  /* ---------------------------------------------------------------- */

  const [compartidos, setCompartidos] = useState<File[]>([]);

  useEffect(() => {
    const resultado = leerCompartido(window.location.search);
    if (!resultado) return;
    // La URL vuelve a ser `/`: recargar no tiene que repetir la importación.
    window.history.replaceState(null, '', '/');
    if (resultado === 'recibido') {
      void audiosCompartidos().then((ficheros) => {
        if (ficheros.length > 0) setCompartidos(ficheros);
        else setStatus('No me ha llegado ningún audio. Prueba a compartirlo otra vez.');
      });
    } else if (resultado === 'sin-app') {
      setStatus('Abre Aura Music una vez con cobertura y vuelve a compartir el audio.');
    } else {
      setStatus('No me ha llegado ningún audio. Prueba a compartirlo otra vez.');
    }
  }, [setStatus]);

  const meterCompartidos = useCallback(async () => {
    const ficheros = compartidos;
    setCompartidos([]);
    for (const fichero of ficheros) await studio.importFile(fichero);
    void olvidarCompartidos();
  }, [compartidos, studio]);

  const descartarCompartidos = useCallback(() => {
    setCompartidos([]);
    void olvidarCompartidos();
  }, []);

  /* ---------------------------------------------------------------- */
  /* Almacenamiento lleno                                               */
  /* ---------------------------------------------------------------- */

  const [lleno, setLleno] = useState(false);

  useEffect(() => {
    const alLlenarse = () => setLleno(true);
    window.addEventListener(EVENTO_ALMACENAMIENTO_LLENO, alLlenarse);
    return () => window.removeEventListener(EVENTO_ALMACENAMIENTO_LLENO, alLlenarse);
  }, []);

  /* ---------------------------------------------------------------- */
  /* La app se oculta a media toma                                      */
  /* ---------------------------------------------------------------- */

  /* Una llamada, el centro de control o cambiar de app: en iPhone la web
     instalada no puede seguir grabando en segundo plano y el micro se corta
     solo. Se para ya, que es lo que guarda lo que llevas, y al volver se dice
     qué ha pasado en vez de dejar un botón rojo que ya no graba. */
  const cortadaRef = useRef(false);
  useEffect(() => {
    if (!engine) return;
    const alCambiar = () => {
      const estado = engine.transportState;
      if (document.visibilityState === 'hidden') {
        if (estado === 'recording' || estado === 'countin') {
          cortadaRef.current = estado === 'recording';
          void engine.stop({ inmediata: true });
        }
        return;
      }
      if (cortadaRef.current) {
        cortadaRef.current = false;
        // Detrás de los avisos de la propia toma («adelantada 12 ms»), no debajo.
        window.setTimeout(
          () => setStatus('Has salido de la app a media toma: la he parado y está guardada.'),
          700,
        );
      }
    };
    document.addEventListener('visibilitychange', alCambiar);
    return () => document.removeEventListener('visibilitychange', alCambiar);
  }, [engine, setStatus]);

  return {
    versionNueva: versionNueva && !aplazada,
    puedeActualizarAhora: libre,
    actualizar,
    aplazarVersion: () => setAplazada(true),
    compartidos,
    meterCompartidos,
    descartarCompartidos,
    lleno,
    cerrarLleno: () => setLleno(false),
  };
}

export type Pwa = ReturnType<typeof usePwa>;
