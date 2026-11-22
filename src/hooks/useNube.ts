'use client';

/**
 * Tu cuenta de Aura y la nube, enganchadas al estudio.
 *
 * Sin configuración de Firebase (`src/lib/nube/config.ts`) este hook no
 * carga nada, no escucha nada y devuelve `disponible: false`: la app es la de
 * siempre. Con ella, el SDK se baja cuando el estudio ya ha arrancado, se
 * recupera la sesión, y con la sesión nace el motor (`src/lib/nube/motor.ts`)
 * que pone al día las ideas en segundo plano.
 *
 * El estudio no sabe nada de esto: la nube se entera de lo que guarda por los
 * eventos de `storage.ts`, y le pide el audio que falte por `puente.ts`.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Studio } from '@/hooks/useStudio';
import type { Project } from '@/lib/daw/types';
import { configFirebase } from '@/lib/nube/config';
import { esteDispositivo } from '@/lib/nube/dispositivo';
import { EVENTO_CEREBRO_CAMBIADO, EVENTO_IDEA_BORRADA, EVENTO_IDEA_GUARDADA } from '@/lib/nube/eventos';
import { conectar, textoDelErrorAlEntrar, type Conexion, type Usuario } from '@/lib/nube/firebase';
import { guardarEstadoDeCuenta, leerEstadoDeCuenta, local } from '@/lib/nube/local';
import { MotorNube } from '@/lib/nube/motor';
import { ponerMotorActivo } from '@/lib/nube/puente';
import { ESTADO_INICIAL, type EstadoNube } from '@/lib/nube/tipos';

/** Cada cuánto se mira la nube con la app delante. Una consulta que no trae nada cuesta una lectura. */
const CADA_MINUTO = 60_000;

export function useNube(studio: Studio) {
  const config = useMemo(() => configFirebase(), []);
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [comprobando, setComprobando] = useState(!!config);
  const [conexion, setConexion] = useState<Conexion | null>(null);
  const [estado, setEstado] = useState<EstadoNube>(() => (config ? { ...ESTADO_INICIAL, fase: 'fuera' } : ESTADO_INICIAL));
  /** Sube cada vez que la nube cambia las ideas de este dispositivo (la lista de Ajustes se refresca). */
  const [cambios, setCambios] = useState(0);
  const motorRef = useRef<MotorNube | null>(null);

  const studioRef = useRef(studio);
  studioRef.current = studio;

  /* La idea abierta está «intacta» si nadie la ha tocado desde que se cargó:
     entonces la nube puede cambiarla por una versión nueva sin perder nada.
     Cualquier cambio (y deshacer) crea un objeto nuevo, así que basta con
     comparar referencias. */
  const cargadaRef = useRef<Project | null>(null);
  const recargandoRef = useRef<string | null>(null);
  useEffect(() => {
    cargadaRef.current = studio.project;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studio.project.id]);
  useEffect(() => {
    if (recargandoRef.current && recargandoRef.current === studio.project.id) {
      cargadaRef.current = studio.project;
      recargandoRef.current = null;
    }
  }, [studio.project]);

  /* ---------------------------------------------------------------- */
  /* La sesión                                                         */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    if (!config) return;
    let vivo = true;
    let dejarDeObservar: (() => void) | undefined;
    const empezar = () => {
      conectar(config)
        .then((c) => {
          if (!vivo) return;
          setConexion(c);
          dejarDeObservar = c.observar((u) => {
            if (!vivo) return;
            setUsuario(u);
            setComprobando(false);
          });
        })
        .catch(() => {
          // Sin red la primera vez no hay SDK que bajar: se queda «fuera» y se intenta al entrar.
          if (vivo) setComprobando(false);
        });
    };
    // Sin prisa: el estudio arranca primero, la cuenta después.
    const w = window as Window & { requestIdleCallback?: (fn: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
    const id = w.requestIdleCallback ? w.requestIdleCallback(empezar, { timeout: 2500 }) : window.setTimeout(empezar, 600);
    return () => {
      vivo = false;
      dejarDeObservar?.();
      if (w.cancelIdleCallback) w.cancelIdleCallback(id);
      else window.clearTimeout(id);
    };
  }, [config]);

  /* ---------------------------------------------------------------- */
  /* El motor, uno por sesión                                          */
  /* ---------------------------------------------------------------- */

  const uid = usuario?.uid ?? null;
  useEffect(() => {
    if (!config || !conexion || !uid) {
      setEstado(config ? { ...ESTADO_INICIAL, fase: 'fuera' } : ESTADO_INICIAL);
      return;
    }
    const motor = new MotorNube({
      local,
      remoto: conexion.remoto(uid),
      dispositivo: esteDispositivo(),
      leerEstado: () => leerEstadoDeCuenta(uid),
      guardarEstado: (e) => guardarEstadoDeCuenta(uid, e),
      abierta: () => {
        const s = studioRef.current;
        return { id: s.project.id, intacta: s.project === cargadaRef.current, ocupado: s.transport !== 'stopped' };
      },
      grabando: () => {
        const t = studioRef.current.transport;
        return t === 'recording' || t === 'countin';
      },
      alRecargarAbierta: async (id) => {
        const s = studioRef.current;
        if (s.project.id !== id || s.transport !== 'stopped') return;
        recargandoRef.current = id;
        await s.openProject(id);
      },
      alCambiarIdeas: () => setCambios((n) => n + 1),
      alCambiarEstado: setEstado,
    });
    motorRef.current = motor;
    ponerMotorActivo(motor);
    setEstado(motor.estadoPublico);
    // Al entrar (y al abrir la app con la sesión puesta): todo, y lo de aquí que falte, arriba.
    void motor.tirar(true).then(() => {
      const s = studioRef.current;
      // Si la idea abierta vino de la nube y le falta audio, que llegue ya.
      void s.loadProjectAudio(s.project);
    });
    return () => {
      motor.parar();
      if (motorRef.current === motor) motorRef.current = null;
      ponerMotorActivo(null);
    };
  }, [config, conexion, uid]);

  /* ---------------------------------------------------------------- */
  /* Lo que pasa fuera: guardados, red, volver a la app                */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    if (!config) return;
    const id = (e: Event) => (e as CustomEvent<{ id?: string } | undefined>).detail?.id;
    const guardada = (e: Event) => {
      const cual = id(e);
      if (cual) motorRef.current?.avisarGuardado(cual);
    };
    const borrada = (e: Event) => {
      const cual = id(e);
      if (cual) motorRef.current?.avisarBorrado(cual);
    };
    const cerebro = () => motorRef.current?.avisarCerebro();
    const conRed = () => {
      motorRef.current?.reintentar();
      const s = studioRef.current;
      void s.loadProjectAudio(s.project);
    };
    const sinRed = () => motorRef.current?.refrescar();
    const alVolver = () => {
      if (document.visibilityState === 'visible') void motorRef.current?.tirar();
    };
    const reloj = window.setInterval(() => {
      if (document.visibilityState === 'visible') void motorRef.current?.tirar();
    }, CADA_MINUTO);
    window.addEventListener(EVENTO_IDEA_GUARDADA, guardada);
    window.addEventListener(EVENTO_IDEA_BORRADA, borrada);
    window.addEventListener(EVENTO_CEREBRO_CAMBIADO, cerebro);
    window.addEventListener('online', conRed);
    window.addEventListener('offline', sinRed);
    document.addEventListener('visibilitychange', alVolver);
    return () => {
      window.clearInterval(reloj);
      window.removeEventListener(EVENTO_IDEA_GUARDADA, guardada);
      window.removeEventListener(EVENTO_IDEA_BORRADA, borrada);
      window.removeEventListener(EVENTO_CEREBRO_CAMBIADO, cerebro);
      window.removeEventListener('online', conRed);
      window.removeEventListener('offline', sinRed);
      document.removeEventListener('visibilitychange', alVolver);
    };
  }, [config]);

  // Al parar de grabar, lo que esperaba sube.
  useEffect(() => {
    if (studio.transport === 'stopped') void motorRef.current?.bombear();
  }, [studio.transport]);

  /* ---------------------------------------------------------------- */
  /* Acciones                                                          */
  /* ---------------------------------------------------------------- */

  /** Devuelven el texto del error, o `null` si ha ido bien. */
  const entrarConGoogle = useCallback(async (): Promise<string | null> => {
    if (!config) return null;
    try {
      const c = conexion ?? (await conectar(config));
      if (!conexion) setConexion(c);
      await c.entrarConGoogle();
      return null;
    } catch (error) {
      return textoDelErrorAlEntrar(error);
    }
  }, [config, conexion]);

  const entrarConCorreo = useCallback(
    async (correo: string, clave: string): Promise<string | null> => {
      if (!config) return null;
      try {
        const c = conexion ?? (await conectar(config));
        if (!conexion) setConexion(c);
        await c.entrarConCorreo(correo, clave);
        return null;
      } catch (error) {
        return textoDelErrorAlEntrar(error);
      }
    },
    [config, conexion],
  );

  const recuperarClave = useCallback(
    async (correo: string): Promise<string | null> => {
      if (!config) return null;
      try {
        const c = conexion ?? (await conectar(config));
        await c.recuperarClave(correo);
        return null;
      } catch (error) {
        return textoDelErrorAlEntrar(error);
      }
    },
    [config, conexion],
  );

  const salir = useCallback(async () => {
    motorRef.current?.parar();
    await conexion?.salir();
  }, [conexion]);

  const reintentar = useCallback(() => motorRef.current?.reintentar(), []);
  const cargarLaDeLaNube = useCallback(() => motorRef.current?.cargarLaDeLaNube(), []);
  const quedarmeConLaMia = useCallback(() => motorRef.current?.quedarmeConLaMia(), []);

  return {
    /** Hay configuración: se enseña la cuenta. */
    disponible: !!config,
    /** Todavía no se sabe si hay sesión (se está cargando el SDK). */
    comprobando,
    usuario,
    estado,
    cambios,
    entrarConGoogle,
    entrarConCorreo,
    recuperarClave,
    salir,
    reintentar,
    cargarLaDeLaNube,
    quedarmeConLaMia,
  };
}

export type Nube = ReturnType<typeof useNube>;
