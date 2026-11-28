'use client';

/**
 * Tu cuenta de aura dentro de bolsillo: quién eres, cuántos créditos te
 * quedan y traerte tus canciones de aura Studio.
 *
 * Crear gasta créditos del monedero de aura, así que pide cuenta; escuchar lo
 * que ya está en el móvil, no. Sin configuración de Firebase
 * (`src/lib/nube/config.ts`) este hook no carga nada y devuelve
 * `hayNube: false`. Con ella, el SDK se baja cuando la app ya ha arrancado
 * (como en el estudio, `useNube.ts`) y se recupera la sesión guardada. Es la
 * MISMA sesión que la del estudio: mismo Firebase, misma conexión por página.
 *
 * El saldo se pide a aura Studio al entrar, al volver a la app, al volver la
 * red y cuando alguien avisa de que ha cambiado (`avisarSaldoCambiado`, lo
 * llama Crear al cobrar).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { almacen } from '@/lib/bolsillo/almacen';
import { EVENTO_SALDO_CAMBIADO, leerSaldo, type SaldoDeAura } from '@/lib/bolsillo/cuenta';
import { traerDeAuraStudio, type ResultadoImportar } from '@/lib/bolsillo/importar/importar';
import { configFirebase } from '@/lib/nube/config';
import { conectar, textoDelErrorAlEntrar, type Conexion } from '@/lib/nube/firebase';

export interface UsuarioBolsillo {
  uid: string;
  nombre: string | null;
  correo: string | null;
  foto: string | null;
}

export interface CuentaBolsillo {
  /** Hay Firebase configurado. Sin él no se puede crear (no hay con qué pagar). */
  hayNube: boolean;
  cargando: boolean;
  usuario: UsuarioBolsillo | null;
  /** Créditos que quedan en el monedero de aura; null si no se sabe o no paga (admin). Negativo: lo que se debe. */
  saldo: number | null;
  /** La cuenta no paga (dueños de aura): crear no descuenta. */
  sinCobro: boolean;
  error: string | null;
  entrarConGoogle(): Promise<void>;
  salir(): Promise<void>;
  refrescarSaldo(): Promise<void>;
  /** Trae tus canciones de Music Studio de aura Studio a la biblioteca. */
  importarDeAuraStudio(): Promise<ResultadoImportar>;
  importando: boolean;
  /** Se está pidiendo el saldo ahora mismo. */
  leyendoSaldo?: boolean;
  /** Por qué no se sabe el saldo (sin red, aura Studio no contesta…), o null. */
  avisoSaldo?: string | null;
  /** El detalle del saldo: lo de prueba que no vale para música, el plan, si gastas los de otra cuenta. */
  detalleSaldo?: SaldoDeAura | null;
  /** Lo que pasó la última vez que se trajo de aura Studio en esta sesión. */
  importacion?: ResultadoImportar | null;
  /** «Trayendo 2 de 5», mientras se trae. */
  progresoImportar?: { hechas: number; total: number } | null;
}

/** Un saldo que se pidió hace menos de esto no se vuelve a pedir al volver a la app. */
const FRESCO_MS = 20_000;

export function useCuentaBolsillo(): CuentaBolsillo {
  const config = useMemo(() => configFirebase(), []);
  const [conexion, setConexion] = useState<Conexion | null>(null);
  const [usuario, setUsuario] = useState<UsuarioBolsillo | null>(null);
  const [cargando, setCargando] = useState(!!config);
  const [error, setError] = useState<string | null>(null);
  const [detalleSaldo, setDetalleSaldo] = useState<SaldoDeAura | null>(null);
  const [avisoSaldo, setAvisoSaldo] = useState<string | null>(null);
  const [leyendoSaldo, setLeyendoSaldo] = useState(false);
  const [importando, setImportando] = useState(false);
  const [importacion, setImportacion] = useState<ResultadoImportar | null>(null);
  const [progresoImportar, setProgresoImportar] = useState<{ hechas: number; total: number } | null>(null);

  const uid = usuario?.uid ?? null;
  const uidRef = useRef<string | null>(null);
  uidRef.current = uid;
  const ultimaLectura = useRef(0);
  const importandoRef = useRef(false);

  /* ── La sesión ──────────────────────────────────────────────────────── */

  useEffect(() => {
    if (!config) return;
    let vivo = true;
    const empezar = () => {
      conectar(config)
        .then((c) => {
          if (vivo) setConexion(c);
        })
        .catch(() => {
          // Sin red la primera vez no hay SDK que bajar: «fuera», y se intenta al tocar «Entrar».
          if (vivo) setCargando(false);
        });
    };
    // Sin prisa: la biblioteca y el reproductor primero, la cuenta después.
    const w = window as Window & {
      requestIdleCallback?: (fn: () => void, o?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    const id = w.requestIdleCallback ? w.requestIdleCallback(empezar, { timeout: 1500 }) : window.setTimeout(empezar, 400);
    return () => {
      vivo = false;
      if (w.cancelIdleCallback) w.cancelIdleCallback(id);
      else window.clearTimeout(id);
    };
  }, [config]);

  // Se observa la sesión en cuanto hay conexión, venga del arranque o de tocar
  // «Entrar» (si al abrir no había red, la conexión nace ahí).
  useEffect(() => {
    if (!conexion) return;
    return conexion.observar((u) => {
      setUsuario(u);
      setCargando(false);
    });
  }, [conexion]);

  /* ── El saldo ───────────────────────────────────────────────────────── */

  const refrescarSaldo = useCallback(async () => {
    if (!config || !uidRef.current) return;
    const deQuien = uidRef.current;
    ultimaLectura.current = Date.now();
    setLeyendoSaldo(true);
    try {
      const r = await leerSaldo({ token: (forzar) => (conexion ? conexion.token(forzar) : Promise.resolve(null)) });
      // Si mientras tanto se ha salido (o ha entrado otra cuenta), esto ya no es de nadie.
      if (uidRef.current !== deQuien) return;
      if (r.saldo) {
        setDetalleSaldo(r.saldo);
        setAvisoSaldo(null);
      } else {
        // Un fallo de red no borra lo que se sabía: se dice por qué no está al día.
        setAvisoSaldo(r.motivo);
      }
    } finally {
      if (uidRef.current === deQuien) setLeyendoSaldo(false);
    }
  }, [config, conexion]);

  // Al entrar (y al abrir la app con la sesión puesta), y al salir, a cero.
  useEffect(() => {
    if (!uid || !conexion) {
      setDetalleSaldo(null);
      setAvisoSaldo(null);
      setImportacion(null);
      setProgresoImportar(null);
      return;
    }
    void refrescarSaldo();
  }, [uid, conexion, refrescarSaldo]);

  useEffect(() => {
    if (!config || !uid) return;
    const alVolver = () => {
      if (document.visibilityState === 'visible' && Date.now() - ultimaLectura.current > FRESCO_MS) void refrescarSaldo();
    };
    const alCambiar = () => void refrescarSaldo();
    document.addEventListener('visibilitychange', alVolver);
    window.addEventListener('online', alCambiar);
    window.addEventListener(EVENTO_SALDO_CAMBIADO, alCambiar);
    return () => {
      document.removeEventListener('visibilitychange', alVolver);
      window.removeEventListener('online', alCambiar);
      window.removeEventListener(EVENTO_SALDO_CAMBIADO, alCambiar);
    };
  }, [config, uid, refrescarSaldo]);

  /* ── Entrar y salir ─────────────────────────────────────────────────── */

  const entrarConGoogle = useCallback(async () => {
    if (!config) return;
    setError(null);
    try {
      const c = conexion ?? (await conectar(config));
      if (!conexion) setConexion(c);
      // `redirigiendo`: la página se va a Google y vuelve sola; `cancelado`: cerró la ventana, nada que decir.
      await c.entrarConGoogle();
    } catch (e) {
      setError(textoDelErrorAlEntrar(e));
    }
  }, [config, conexion]);

  const salir = useCallback(async () => {
    setError(null);
    try {
      await conexion?.salir();
    } catch {
      setError('No he podido salir. Vuelve a probar en un momento.');
    }
  }, [conexion]);

  /* ── Traer de aura Studio ───────────────────────────────────────────── */

  const importarDeAuraStudio = useCallback(async (): Promise<ResultadoImportar> => {
    const vacio: ResultadoImportar = { nuevas: 0, yaEstaban: 0, soloConRed: 0, bajadasAhora: 0 };
    if (!config || !conexion || !uidRef.current) {
      return { ...vacio, error: 'Entra con tu cuenta de aura para traer tus canciones.' };
    }
    // Dos toques seguidos no son dos importaciones (y aunque lo fueran, no duplicarían).
    if (importandoRef.current) return vacio;
    importandoRef.current = true;
    const deQuien = uidRef.current;
    setImportando(true);
    setProgresoImportar(null);
    try {
      const r = await traerDeAuraStudio({
        almacen: almacen(),
        leer: () => conexion.leerPistasDeAuraStudio(deQuien),
        alAvanzar: (hechas, total) => {
          if (uidRef.current === deQuien) setProgresoImportar(total > 0 ? { hechas, total } : null);
        },
      });
      if (uidRef.current === deQuien) setImportacion(r);
      return r;
    } finally {
      importandoRef.current = false;
      setImportando(false);
      setProgresoImportar(null);
    }
  }, [config, conexion]);

  const saldo = detalleSaldo && !detalleSaldo.sinCobro ? detalleSaldo.saldo : null;
  const sinCobro = !!detalleSaldo?.sinCobro;
  return useMemo<CuentaBolsillo>(
    () => ({
      hayNube: !!config,
      cargando,
      usuario,
      saldo,
      sinCobro,
      error,
      entrarConGoogle,
      salir,
      refrescarSaldo,
      importarDeAuraStudio,
      importando,
      leyendoSaldo,
      avisoSaldo,
      detalleSaldo,
      importacion,
      progresoImportar,
    }),
    [
      config,
      cargando,
      usuario,
      saldo,
      sinCobro,
      error,
      entrarConGoogle,
      salir,
      refrescarSaldo,
      importarDeAuraStudio,
      importando,
      leyendoSaldo,
      avisoSaldo,
      detalleSaldo,
      importacion,
      progresoImportar,
    ],
  );
}
