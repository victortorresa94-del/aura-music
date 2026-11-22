'use client';

/**
 * Medidores de nivel. Un solo bucle de `requestAnimationFrame` para todos,
 * que lee los `AnalyserNode` del grafo y mueve las barras tocando el estilo
 * de los nodos a mano: React no se entera, así que veinte medidores a 60
 * fotogramas no redibujan nada.
 *
 * Balística de medidor de pico: sube al instante y baja a 24 dB por
 * segundo; la marca del pico se queda 1,2 s. La escala es la del fader, así
 * que el nivel y el fader se leen a la misma altura.
 */

import { createContext, useCallback, useContext, useEffect, useRef, type ReactNode } from 'react';
import type { StudioEngine } from '@/lib/daw/engine';
import { POSICION_0DB, posicionDeDb } from '@/lib/daw/mezcla/escala';
import { T } from '../theme';

interface Entrada {
  barra: HTMLElement;
  marca: HTMLElement;
  nivel: number;
  pico: number;
  picoHasta: number;
}

type Registrar = (clave: string, barra: HTMLElement | null, marca?: HTMLElement | null) => void;

const Contexto = createContext<Registrar>(() => undefined);

const CAIDA_DB_POR_S = 24;
const PICO_MS = 1200;
const SUELO = -70;

/** `pista:<id>`, `master:0` o `master:1`. */
function analizadorDe(engine: StudioEngine | null, clave: string): AnalyserNode | null {
  const grafo = engine?.grafoMezcla;
  if (!grafo) return null;
  if (clave.startsWith('master:')) return grafo.medidorMaster?.[Number(clave.slice(7))] ?? null;
  return grafo.medidorDe(clave.slice(6));
}

export function ProveedorDeMedidores({
  engine,
  activo,
  children,
}: {
  engine: StudioEngine | null;
  activo: boolean;
  children: ReactNode;
}) {
  const registro = useRef(new Map<string, Entrada>());

  const registrar = useCallback<Registrar>((clave, barra, marca) => {
    if (!barra || !marca) {
      registro.current.delete(clave);
      return;
    }
    registro.current.set(clave, { barra, marca, nivel: SUELO, pico: SUELO, picoHasta: 0 });
  }, []);

  useEffect(() => {
    if (!activo) return;
    let raf = 0;
    let antes = performance.now();
    const muestras = new Float32Array(2048);
    const bucle = (ahora: number) => {
      const dt = Math.min(0.1, (ahora - antes) / 1000);
      antes = ahora;
      const sonando = engine?.transportState !== 'stopped';
      for (const [clave, e] of registro.current) {
        const analizador = analizadorDe(engine, clave);
        let db = SUELO;
        if (analizador) {
          const n = Math.min(muestras.length, analizador.fftSize);
          const vista = n === muestras.length ? muestras : muestras.subarray(0, n);
          analizador.getFloatTimeDomainData(vista);
          let max = 0;
          for (let i = 0; i < n; i++) {
            const a = vista[i] < 0 ? -vista[i] : vista[i];
            if (a > max) max = a;
          }
          if (max > 0) db = Math.max(SUELO, 20 * Math.log10(max));
        }
        const cae = e.nivel - CAIDA_DB_POR_S * dt;
        const nivel = db > cae ? db : cae;
        if (nivel >= e.pico || ahora > e.picoHasta) {
          e.pico = nivel;
          e.picoHasta = ahora + PICO_MS;
        }
        // Solo se escribe en el DOM si ha cambiado algo que se vea.
        if (Math.abs(nivel - e.nivel) > 0.05 || !sonando) {
          e.barra.style.transform = `scaleY(${Math.max(0.0001, posicionDeDb(nivel))})`;
        }
        e.nivel = nivel;
        const alturaPico = posicionDeDb(e.pico);
        e.marca.style.transform = `translateY(${(1 - alturaPico) * 100}%)`;
        e.marca.style.opacity = e.pico > SUELO + 1 ? '1' : '0';
      }
      raf = requestAnimationFrame(bucle);
    };
    raf = requestAnimationFrame(bucle);
    return () => cancelAnimationFrame(raf);
  }, [activo, engine]);

  return <Contexto.Provider value={registrar}>{children}</Contexto.Provider>;
}

/** Una barra de nivel vertical. Se estira a lo alto de su contenedor. */
export function Medidor({ clave, ancho = 6, apagado }: { clave: string; ancho?: number; apagado?: boolean }) {
  const registrar = useContext(Contexto);
  const barraRef = useRef<HTMLDivElement | null>(null);
  const marcaRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    registrar(clave, barraRef.current, marcaRef.current);
    return () => registrar(clave, null);
  }, [clave, registrar]);

  return (
    <div
      aria-hidden
      style={{
        position: 'relative',
        width: ancho,
        height: '100%',
        borderRadius: ancho / 2,
        background: T.fill,
        overflow: 'hidden',
        opacity: apagado ? 0.45 : 1,
        transition: `opacity 160ms ${T.easeOut}`,
      }}
    >
      <div
        ref={barraRef}
        style={{
          position: 'absolute',
          inset: 0,
          background: T.waveStrong,
          transformOrigin: 'bottom',
          transform: 'scaleY(0)',
          willChange: 'transform',
        }}
      />
      {/* La marca del pico: una raya que se queda arriba un momento. */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          height: '100%',
          transform: 'translateY(100%)',
          opacity: 0,
          pointerEvents: 'none',
        }}
        ref={marcaRef}
      >
        <div style={{ height: 2, background: T.text }} />
      </div>
      {/* El 0 dBFS, a la misma altura que el 0 del fader. */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: `${(1 - POSICION_0DB) * 100}%`,
          height: 1,
          background: T.borderStrong,
        }}
      />
    </div>
  );
}
