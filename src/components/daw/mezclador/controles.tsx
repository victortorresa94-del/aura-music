'use client';

/**
 * Los controles del mezclador: el fader vertical, el panorama y el
 * deslizador de las hojas de efectos.
 *
 * Todos siguen la misma regla: mientras el dedo se mueve, el valor vive en
 * el propio control (se redibuja solo él) y se oye al momento con `onVivo`;
 * al soltar, `onSoltar` lo guarda una vez. El fader y el panorama se mueven
 * por arrastre relativo, no saltan a donde tocas: en un móvil el dedo tapa
 * lo que hay debajo y un salto de 20 dB por rozar la tira no se perdona.
 */

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import {
  dbDePosicion,
  dbALineal,
  panoramaDicho,
  POSICION_0DB,
  posicionDeDb,
  posicionDeVolumen,
  textoDb,
  volumenDePosicion,
} from '@/lib/daw/mezcla/escala';
import { haptic, T } from '../theme';

const limitar = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const DOBLE_TOQUE_MS = 320;

/* -------------------------------------------------------------------------- */
/* Fader                                                                       */
/* -------------------------------------------------------------------------- */

const ALTO_TAPA = 20;
const MARCAS = [6, 0, -10, -20, -40];

export function Fader({
  volumen,
  etiqueta,
  apagado,
  onVivo,
  onSoltar,
}: {
  /** Ganancia lineal. */
  volumen: number;
  /** «Volumen de Voz», para el lector de pantalla. */
  etiqueta: string;
  /** En mute o fuera del solo: se ve más apagado. */
  apagado?: boolean;
  onVivo: (volumen: number) => void;
  onSoltar: (volumen: number) => void;
}) {
  const [local, setLocal] = useState<number | null>(null);
  const zonaRef = useRef<HTMLDivElement | null>(null);
  const gesto = useRef<{ id: number; y0: number; p0: number; alto: number; movido: boolean } | null>(null);
  const ultimaPos = useRef(0);
  const ultimoToque = useRef(0);

  const posicion = local ?? posicionDeVolumen(volumen);
  const db = dbDePosicion(posicion);
  const texto = textoDb(db);
  // Con el teclado, varias pulsaciones pueden llegar antes de redibujar:
  // cada una parte de la anterior, no del último render.
  const dbTeclado = useRef<{ db: number; hora: number } | null>(null);

  const empezar = (e: React.PointerEvent<HTMLDivElement>) => {
    // Un segundo dedo no roba el fader a mitad de arrastre.
    if (gesto.current) return;
    const zona = zonaRef.current;
    if (!zona) return;
    const ahora = performance.now();
    if (ahora - ultimoToque.current < DOBLE_TOQUE_MS) {
      // Doble toque: a 0 dB, como en cualquier mesa.
      ultimoToque.current = 0;
      haptic(10);
      onVivo(1);
      onSoltar(1);
      return;
    }
    zona.setPointerCapture(e.pointerId);
    gesto.current = { id: e.pointerId, y0: e.clientY, p0: posicion, alto: Math.max(40, zona.clientHeight - ALTO_TAPA), movido: false };
  };

  const mover = (e: React.PointerEvent<HTMLDivElement>) => {
    const g = gesto.current;
    if (!g || e.pointerId !== g.id) return;
    const dy = e.clientY - g.y0;
    if (!g.movido && Math.abs(dy) < 3) return;
    g.movido = true;
    let p = limitar(g.p0 - dy / g.alto, 0, 1);
    // Imán en 0 dB: se nota (un toque de vibración) y cuesta un poco salir.
    if (Math.abs(p - POSICION_0DB) < 0.012) {
      if (ultimaPos.current !== POSICION_0DB) haptic(6);
      p = POSICION_0DB;
    }
    ultimaPos.current = p;
    setLocal(p);
    onVivo(volumenDePosicion(p));
  };

  const soltar = (e: React.PointerEvent<HTMLDivElement>) => {
    const g = gesto.current;
    if (!g || e.pointerId !== g.id) return;
    gesto.current = null;
    if (g.movido) {
      onSoltar(volumenDePosicion(ultimaPos.current));
      ultimoToque.current = 0;
    } else {
      ultimoToque.current = performance.now();
    }
    setLocal(null);
  };

  const teclado = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const pasos: Record<string, number> = { ArrowUp: 0.5, ArrowRight: 0.5, ArrowDown: -0.5, ArrowLeft: -0.5, PageUp: 3, PageDown: -3 };
    let siguiente: number | null = null;
    const reciente = dbTeclado.current && performance.now() - dbTeclado.current.hora < 400 ? dbTeclado.current.db : null;
    const actual = reciente ?? (Number.isFinite(db) ? db : -60);
    if (e.key in pasos) {
      const nuevoDb = limitar(actual + pasos[e.key] * (e.shiftKey ? 0.2 : 1), -60, 6);
      dbTeclado.current = { db: nuevoDb, hora: performance.now() };
      siguiente = dbALineal(nuevoDb);
    }
    else if (e.key === 'Home') siguiente = 1;
    else if (e.key === 'End') siguiente = 0;
    if (siguiente === null) return;
    e.preventDefault();
    onVivo(siguiente);
    onSoltar(siguiente);
  };

  return (
    <div
      ref={zonaRef}
      role="slider"
      tabIndex={0}
      aria-label={etiqueta}
      aria-orientation="vertical"
      aria-valuemin={-60}
      aria-valuemax={6}
      aria-valuenow={Number.isFinite(db) ? Math.round(db * 10) / 10 : -60}
      aria-valuetext={texto.endsWith('∞') ? 'Silencio' : `${texto} dB`}
      onPointerDown={empezar}
      onPointerMove={mover}
      onPointerUp={soltar}
      onPointerCancel={soltar}
      onKeyDown={teclado}
      style={{
        position: 'relative',
        flex: 1,
        minWidth: 0,
        height: '100%',
        touchAction: 'none',
        cursor: 'ns-resize',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        borderRadius: 8,
      }}
    >
      {/* Marcas de la escala: a la izquierda del raíl, pequeñas. */}
      <div aria-hidden style={{ position: 'absolute', top: ALTO_TAPA / 2, bottom: ALTO_TAPA / 2, left: 0, right: 0, pointerEvents: 'none' }}>
        {MARCAS.map((m) => (
          <span
            key={m}
            style={{
              position: 'absolute',
              left: 0,
              top: `${(1 - posicionDeDb(m)) * 100}%`,
              transform: 'translateY(-50%)',
              fontFamily: T.fontBody,
              fontVariantNumeric: 'tabular-nums',
              fontSize: 10,
              lineHeight: 1,
              color: m === 0 ? T.dim : T.faint,
              fontWeight: m === 0 ? 600 : 400,
            }}
          >
            {m > 0 ? `+${m}` : m === 0 ? '0' : `−${-m}`}
          </span>
        ))}
        {/* El raíl. */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 'calc(50% + 6px)',
            width: 4,
            marginLeft: -2,
            borderRadius: 2,
            background: T.fillStrong,
            opacity: apagado ? 0.6 : 1,
          }}
        />
        {/* Hasta dónde está subido: el raíl se rellena desde abajo. */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 'calc(50% + 6px)',
            width: 4,
            marginLeft: -2,
            height: '100%',
            borderRadius: 2,
            // Gris, no negro: lo que tiene que saltar a la vista es el
            // medidor de al lado, que se mueve; el fader es la referencia.
            background: apagado ? T.borderStrong : T.dim,
            opacity: 0.55,
            transformOrigin: 'bottom',
            transform: `scaleY(${posicion})`,
          }}
        />
      </div>
      {/* La tapa del fader: se agarra de cualquier parte de la zona. */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: 'calc(50% + 6px)',
          top: 0,
          width: 30,
          height: ALTO_TAPA,
          marginLeft: -15,
          borderRadius: 6,
          background: T.knob,
          boxShadow: local != null ? T.elev2 : T.knobShadow,
          transform: `translateY(calc(${(1 - posicion)} * (var(--alto-fader, 0px))))`,
          transition: local != null ? 'none' : `transform 140ms ${T.easeOut}, box-shadow 140ms ${T.easeOut}`,
          display: 'grid',
          placeItems: 'center',
          pointerEvents: 'none',
        }}
      >
        <span style={{ width: 16, height: 2, borderRadius: 1, background: apagado ? T.faint : T.text }} />
      </div>
      <AltoDelFader zona={zonaRef} />
    </div>
  );
}

/**
 * La tapa se mueve con `transform` (sin tocar el diseño de la página), y
 * para eso necesita saber cuántos píxeles mide el recorrido. Se lo da una
 * variable CSS que se actualiza al cambiar el tamaño de la tira.
 */
function AltoDelFader({ zona }: { zona: React.RefObject<HTMLDivElement | null> }) {
  useEffect(() => {
    const el = zona.current;
    if (!el) return;
    const poner = () => el.style.setProperty('--alto-fader', `${Math.max(0, el.clientHeight - ALTO_TAPA)}px`);
    poner();
    const obs = new ResizeObserver(poner);
    obs.observe(el);
    return () => obs.disconnect();
  }, [zona]);
  return null;
}

/* -------------------------------------------------------------------------- */
/* Panorama                                                                    */
/* -------------------------------------------------------------------------- */

export function Panorama({
  valor,
  etiqueta,
  onVivo,
  onSoltar,
}: {
  /** −1 a 1. */
  valor: number;
  etiqueta: string;
  onVivo: (valor: number) => void;
  onSoltar: (valor: number) => void;
}) {
  const [local, setLocal] = useState<number | null>(null);
  const zonaRef = useRef<HTMLDivElement | null>(null);
  const gesto = useRef<{ id: number; x0: number; v0: number; ancho: number; movido: boolean } | null>(null);
  const ultimo = useRef(0);
  const ultimoToque = useRef(0);
  const v = local ?? valor;
  const vTeclado = useRef<{ v: number; hora: number } | null>(null);

  const empezar = (e: React.PointerEvent<HTMLDivElement>) => {
    if (gesto.current || !zonaRef.current) return;
    const ahora = performance.now();
    if (ahora - ultimoToque.current < DOBLE_TOQUE_MS) {
      ultimoToque.current = 0;
      haptic(10);
      onVivo(0);
      onSoltar(0);
      return;
    }
    zonaRef.current.setPointerCapture(e.pointerId);
    gesto.current = { id: e.pointerId, x0: e.clientX, v0: v, ancho: Math.max(30, zonaRef.current.clientWidth), movido: false };
  };
  const mover = (e: React.PointerEvent<HTMLDivElement>) => {
    const g = gesto.current;
    if (!g || e.pointerId !== g.id) return;
    const dx = e.clientX - g.x0;
    if (!g.movido && Math.abs(dx) < 3) return;
    g.movido = true;
    let siguiente = limitar(g.v0 + (dx / g.ancho) * 2, -1, 1);
    if (Math.abs(siguiente) < 0.04) {
      if (ultimo.current !== 0) haptic(6);
      siguiente = 0;
    }
    siguiente = Math.round(siguiente * 100) / 100;
    ultimo.current = siguiente;
    setLocal(siguiente);
    onVivo(siguiente);
  };
  const soltar = (e: React.PointerEvent<HTMLDivElement>) => {
    const g = gesto.current;
    if (!g || e.pointerId !== g.id) return;
    gesto.current = null;
    if (g.movido) {
      onSoltar(ultimo.current);
      ultimoToque.current = 0;
    } else {
      ultimoToque.current = performance.now();
    }
    setLocal(null);
  };
  const teclado = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const pasos: Record<string, number> = { ArrowRight: 0.05, ArrowUp: 0.05, ArrowLeft: -0.05, ArrowDown: -0.05 };
    let siguiente: number | null = null;
    const reciente = vTeclado.current && performance.now() - vTeclado.current.hora < 400 ? vTeclado.current.v : null;
    if (e.key in pasos) siguiente = Math.round(limitar((reciente ?? v) + pasos[e.key], -1, 1) * 100) / 100;
    else if (e.key === 'Home') siguiente = 0;
    if (siguiente !== null) vTeclado.current = { v: siguiente, hora: performance.now() };
    if (siguiente === null) return;
    e.preventDefault();
    onVivo(siguiente);
    onSoltar(siguiente);
  };

  // El tramo pintado va del centro a la bola, como en una mesa.
  const desde = Math.min(50, 50 + v * 50);
  const hasta = Math.max(50, 50 + v * 50);

  return (
    <div
      ref={zonaRef}
      role="slider"
      tabIndex={0}
      aria-label={etiqueta}
      aria-valuemin={-100}
      aria-valuemax={100}
      aria-valuenow={Math.round(v * 100)}
      aria-valuetext={panoramaDicho(v)}
      onPointerDown={empezar}
      onPointerMove={mover}
      onPointerUp={soltar}
      onPointerCancel={soltar}
      onKeyDown={teclado}
      style={{
        position: 'relative',
        height: 32,
        touchAction: 'none',
        cursor: 'ew-resize',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        borderRadius: 8,
      }}
    >
      <div aria-hidden style={{ position: 'absolute', left: 7, right: 7, top: '50%', height: 4, marginTop: -2, borderRadius: 2, background: T.fillStrong }}>
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${desde}%`, width: `${hasta - desde}%`, background: T.text, borderRadius: 2 }} />
        <div style={{ position: 'absolute', left: '50%', top: -4, width: 2, height: 12, marginLeft: -1, borderRadius: 1, background: T.borderStrong }} />
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: `${50 + v * 50}%`,
            width: 14,
            height: 14,
            margin: '-7px 0 0 -7px',
            borderRadius: '50%',
            background: T.knob,
            boxShadow: T.knobShadow,
            transform: local != null ? 'scale(1.15)' : 'none',
            transition: `transform 120ms ${T.easeOut}`,
          }}
        />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Deslizador de las hojas                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Un deslizador con su nombre y su cifra en una línea. `bipolar` pinta
 * desde el centro (para el ecualizador, donde 0 dB es no tocar nada).
 * Guarda al soltar; si el navegador no avisa del final del gesto (pasa con
 * algún toque en Safari), guarda solo al rato de dejar de moverse.
 */
export function Deslizador({
  etiqueta,
  detalle,
  valor,
  min,
  max,
  paso = 0.01,
  bipolar,
  formato,
  onVivo,
  onSoltar,
}: {
  etiqueta: string;
  detalle?: string;
  valor: number;
  min: number;
  max: number;
  paso?: number;
  bipolar?: boolean;
  formato: (v: number) => string;
  onVivo: (v: number) => void;
  onSoltar: (v: number) => void;
}) {
  const [local, setLocal] = useState<number | null>(null);
  const pendiente = useRef<number | null>(null);
  const reloj = useRef<number | null>(null);
  const v = local ?? valor;

  const guardar = () => {
    if (reloj.current != null) window.clearTimeout(reloj.current);
    reloj.current = null;
    if (pendiente.current === null) return;
    onSoltar(pendiente.current);
    pendiente.current = null;
    setLocal(null);
  };
  useEffect(() => () => {
    if (reloj.current != null) window.clearTimeout(reloj.current);
  }, []);

  const pct = (x: number) => ((x - min) / (max - min)) * 100;
  const cero = bipolar ? pct(0) : 0;
  const estilo = {
    width: '100%',
    ['--a' as string]: `${Math.min(cero, pct(v))}%`,
    ['--b' as string]: `${Math.max(cero, pct(v))}%`,
    ['--p' as string]: `${pct(v)}%`,
  } as CSSProperties;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', alignItems: 'baseline', rowGap: 2, columnGap: 12, padding: '6px 0' }}>
      <span style={{ fontFamily: T.fontBody, fontSize: 15, fontWeight: 500, letterSpacing: '-0.01em', color: T.text }}>
        {etiqueta}
        {detalle ? <span style={{ fontSize: 13, fontWeight: 400, color: T.dim }}> · {detalle}</span> : null}
      </span>
      <span style={{ fontFamily: T.fontBody, fontVariantNumeric: 'tabular-nums', fontSize: 13, color: local != null ? T.text : T.dim, minWidth: 56, textAlign: 'right' }}>
        {formato(v)}
      </span>
      <input
        type="range"
        className={`daw-slider mez-deslizador${bipolar ? ' mez-bipolar' : ''}`}
        aria-label={etiqueta}
        aria-valuetext={formato(v)}
        min={min}
        max={max}
        step={paso}
        value={v}
        onChange={(e) => {
          const siguiente = Number(e.target.value);
          setLocal(siguiente);
          pendiente.current = siguiente;
          onVivo(siguiente);
          if (reloj.current != null) window.clearTimeout(reloj.current);
          reloj.current = window.setTimeout(guardar, 700);
        }}
        onPointerUp={guardar}
        onTouchEnd={guardar}
        onKeyUp={guardar}
        onBlur={guardar}
        style={{ ...estilo, gridColumn: '1 / -1' }}
      />
    </div>
  );
}

/** CSS de los deslizadores bipolares: el tramo va del centro a la bola. */
export const CSS_CONTROLES = `
  .daw-slider.mez-bipolar::-webkit-slider-runnable-track {
    background: linear-gradient(to right, ${T.fillStrong} 0 var(--a), ${T.text} var(--a) var(--b), ${T.fillStrong} var(--b) 100%);
  }
  .daw-slider.mez-bipolar::-moz-range-progress { background: transparent; }
`;

