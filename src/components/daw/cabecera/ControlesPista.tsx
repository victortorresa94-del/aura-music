'use client';

/**
 * Lo de siempre en la cabecera de cada pista: el volumen y el panorama, a la
 * vista y sin abrir nada.
 *
 * Mismas reglas que el mezclador (`mezclador/controles.tsx`), porque son los
 * mismos mandos en otro sitio:
 *   · se mueven por arrastre relativo, no saltan a donde tocas;
 *   · mientras el dedo se mueve se OYE (el motor cambia al momento) y solo
 *     se redibuja el propio mando; al soltar se guarda una vez, con su paso
 *     de Deshacer;
 *   · doble toque (o doble clic) vuelve a 0 dB, o al centro.
 * La escala es la del fader de la mesa (`mezcla/escala.ts`): mover el de la
 * cabecera o el del mezclador da el mismo número.
 *
 * El valor en dB sale en una etiqueta encima de la bola mientras lo mueves
 * (o con el ratón encima, en el PC). En reposo no ocupa sitio.
 */

import { useRef, useState, type CSSProperties } from 'react';
import {
  dbDePosicion,
  dbALineal,
  linealADb,
  panoramaDicho,
  POSICION_0DB,
  posicionDeVolumen,
  textoDb,
  textoPanorama,
  volumenDePosicion,
} from '@/lib/daw/mezcla/escala';
import { haptic, T } from '../theme';
import { numeric } from '../ui';

const limitar = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const DOBLE_TOQUE_MS = 320;
/**
 * Cuántos píxeles de arrastre recorren el fader entero. No depende del ancho
 * del mando: en el móvil mide 48 px y sería imposible afinar medio decibelio.
 */
const RECORRIDO_PX = 180;

/** La etiqueta flotante con el valor, encima de la bola. */
function Globo({ texto, x, visible }: { texto: string; x: number; visible: boolean }) {
  return (
    <span
      aria-hidden
      style={{
        ...numeric,
        position: 'absolute',
        bottom: 'calc(100% + 9px)',
        left: `${x * 100}%`,
        transform: `translateX(-50%) translateY(${visible ? 0 : 3}px)`,
        padding: '3px 6px',
        borderRadius: 6,
        background: T.text,
        color: T.inverse,
        fontSize: 11,
        fontWeight: 600,
        lineHeight: 1.1,
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
        opacity: visible ? 1 : 0,
        transition: `opacity 120ms ${T.easeOut}, transform 120ms ${T.easeOut}`,
        zIndex: 8,
      }}
    >
      {texto}
    </span>
  );
}

export function VolumenPista({
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
  const [encima, setEncima] = useState(false);
  const zonaRef = useRef<HTMLDivElement | null>(null);
  const gesto = useRef<{ id: number; x0: number; p0: number; movido: boolean } | null>(null);
  const ultimaPos = useRef(0);
  const ultimoToque = useRef(0);
  const teclado = useRef<{ db: number; hora: number } | null>(null);

  const posicion = local ?? posicionDeVolumen(volumen);
  const texto = `${textoDb(dbDePosicion(posicion))} dB`.replace('∞ dB', '∞');

  const empezar = (e: React.PointerEvent<HTMLDivElement>) => {
    if (gesto.current || !zonaRef.current) return;
    const ahora = performance.now();
    if (ahora - ultimoToque.current < DOBLE_TOQUE_MS) {
      // Doble toque: a 0 dB, como en cualquier mesa.
      ultimoToque.current = 0;
      haptic(10);
      onVivo(1);
      onSoltar(1);
      return;
    }
    zonaRef.current.setPointerCapture(e.pointerId);
    gesto.current = { id: e.pointerId, x0: e.clientX, p0: posicion, movido: false };
  };

  const mover = (e: React.PointerEvent<HTMLDivElement>) => {
    const g = gesto.current;
    if (!g || e.pointerId !== g.id) return;
    const dx = e.clientX - g.x0;
    if (!g.movido && Math.abs(dx) < 3) return;
    g.movido = true;
    // Con Mayús, diez veces más fino.
    let p = limitar(g.p0 + (dx / RECORRIDO_PX) * (e.shiftKey ? 0.1 : 1), 0, 1);
    // Un imán suave en 0 dB: se nota al pasar, con un toque.
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

  const teclas = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const pasos: Record<string, number> = { ArrowRight: 0.5, ArrowUp: 0.5, ArrowLeft: -0.5, ArrowDown: -0.5 };
    const dbActual = linealADb(volumen);
    const reciente = teclado.current && performance.now() - teclado.current.hora < 400 ? teclado.current.db : null;
    const base = reciente ?? (Number.isFinite(dbActual) ? dbActual : -60);
    let db: number | null = null;
    if (e.key in pasos) db = limitar(base + pasos[e.key] * (e.shiftKey ? 6 : 1), -60, 6);
    else if (e.key === 'Home') db = 0;
    if (db === null) return;
    e.preventDefault();
    e.stopPropagation();
    teclado.current = { db, hora: performance.now() };
    onVivo(dbALineal(db));
    onSoltar(dbALineal(db));
  };

  const pct = posicion * 100;
  const moviendo = local !== null;

  return (
    <div
      ref={zonaRef}
      role="slider"
      tabIndex={0}
      aria-label={etiqueta}
      aria-valuemin={-60}
      aria-valuemax={6}
      aria-valuenow={Math.round(Math.max(-60, linealADb(volumen)) * 10) / 10}
      aria-valuetext={texto}
      title={`${etiqueta}: ${texto}. Doble clic, a 0 dB`}
      className="daw-mando"
      onPointerDown={empezar}
      onPointerMove={mover}
      onPointerUp={soltar}
      onPointerCancel={soltar}
      onPointerEnter={(e) => e.pointerType === 'mouse' && setEncima(true)}
      onPointerLeave={() => setEncima(false)}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={teclas}
      style={{
        position: 'relative',
        flex: 1,
        minWidth: 40,
        height: 32,
        // Arrastrar en vertical sigue desplazando la lista de pistas.
        touchAction: 'pan-y',
        cursor: 'ew-resize',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        borderRadius: 8,
        outline: 'none',
        opacity: apagado ? 0.5 : 1,
        transition: `opacity 160ms ${T.easeOut}`,
      }}
    >
      <div
        aria-hidden
        style={{ position: 'absolute', left: 7, right: 7, top: '50%', height: 4, marginTop: -2, borderRadius: 2, background: T.fillStrong }}
      >
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: `${pct}%`, borderRadius: 2, background: T.text }} />
        {/* La marca del 0 dB: donde se deja una pista «tal como se grabó». */}
        <div
          style={{
            position: 'absolute',
            left: `${POSICION_0DB * 100}%`,
            top: -3,
            width: 1.5,
            height: 10,
            marginLeft: -0.75,
            borderRadius: 1,
            background: T.borderStrong,
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: `${pct}%`,
            width: 14,
            height: 14,
            margin: '-7px 0 0 -7px',
            borderRadius: '50%',
            background: T.knob,
            boxShadow: T.knobShadow,
            transform: moviendo ? 'scale(1.15)' : 'none',
            transition: `transform 120ms ${T.easeOut}`,
          }}
        />
        <Globo texto={texto} x={posicion} visible={moviendo || encima} />
      </div>
    </div>
  );
}

/**
 * El panorama, como perilla: en una fila tan estrecha, una segunda raya al
 * lado del volumen se confundía con él. Una perilla con su arco desde el
 * centro se lee como panorama en cualquier DAW.
 *
 * Se gira arrastrando a los lados o arriba y abajo (lo que pida la mano) y
 * tiene un imán en el centro. El globo dice «I 40», «C» o «D 25».
 */
export function PanoramaPista({
  valor,
  etiqueta,
  onVivo,
  onSoltar,
  style,
}: {
  /** −1 (izquierda) a 1 (derecha). */
  valor: number;
  etiqueta: string;
  onVivo: (valor: number) => void;
  onSoltar: (valor: number) => void;
  style?: CSSProperties;
}) {
  const [local, setLocal] = useState<number | null>(null);
  const [encima, setEncima] = useState(false);
  const zonaRef = useRef<HTMLDivElement | null>(null);
  const gesto = useRef<{ id: number; x0: number; y0: number; v0: number; movido: boolean } | null>(null);
  const ultimo = useRef(0);
  const ultimoToque = useRef(0);
  const teclado = useRef<{ v: number; hora: number } | null>(null);
  const v = local ?? valor;

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
    gesto.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, v0: v, movido: false };
  };
  const mover = (e: React.PointerEvent<HTMLDivElement>) => {
    const g = gesto.current;
    if (!g || e.pointerId !== g.id) return;
    const d = e.clientX - g.x0 - (e.clientY - g.y0);
    if (!g.movido && Math.abs(d) < 3) return;
    g.movido = true;
    let x = limitar(g.v0 + (d / 120) * (e.shiftKey ? 0.1 : 1), -1, 1);
    if (Math.abs(x) < 0.04) {
      if (ultimo.current !== 0) haptic(6);
      x = 0;
    }
    x = Math.round(x * 100) / 100;
    ultimo.current = x;
    setLocal(x);
    onVivo(x);
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
  const teclas = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const pasos: Record<string, number> = { ArrowRight: 0.05, ArrowUp: 0.05, ArrowLeft: -0.05, ArrowDown: -0.05 };
    const reciente = teclado.current && performance.now() - teclado.current.hora < 400 ? teclado.current.v : null;
    let x: number | null = null;
    if (e.key in pasos) x = Math.round(limitar((reciente ?? v) + pasos[e.key], -1, 1) * 100) / 100;
    else if (e.key === 'Home') x = 0;
    if (x === null) return;
    e.preventDefault();
    e.stopPropagation();
    teclado.current = { v: x, hora: performance.now() };
    onVivo(x);
    onSoltar(x);
  };

  // El arco va de las 12 a la posición, como el tramo pintado de una mesa:
  // 135° a cada lado.
  const R = 9;
  const angulo = v * 135;
  const punto = (grados: number) => {
    const rad = ((grados - 90) * Math.PI) / 180;
    return [12 + R * Math.cos(rad), 12 + R * Math.sin(rad)];
  };
  const [x1, y1] = punto(0);
  const [x2, y2] = punto(angulo);
  const arco =
    Math.abs(angulo) < 0.5 ? '' : `M ${x1} ${y1} A ${R} ${R} 0 0 ${angulo > 0 ? 1 : 0} ${x2.toFixed(2)} ${y2.toFixed(2)}`;
  const [f1x, f1y] = punto(-135);
  const [f2x, f2y] = punto(135);

  return (
    <div
      ref={zonaRef}
      role="slider"
      tabIndex={0}
      className="daw-mando"
      aria-label={etiqueta}
      aria-valuemin={-100}
      aria-valuemax={100}
      aria-valuenow={Math.round(v * 100)}
      aria-valuetext={panoramaDicho(v)}
      title={`${etiqueta}: ${panoramaDicho(valor)}. Doble clic, al centro`}
      onPointerDown={empezar}
      onPointerMove={mover}
      onPointerUp={soltar}
      onPointerCancel={soltar}
      onPointerEnter={(e) => e.pointerType === 'mouse' && setEncima(true)}
      onPointerLeave={() => setEncima(false)}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={teclas}
      style={{
        position: 'relative',
        width: 32,
        height: 32,
        flexShrink: 0,
        display: 'grid',
        placeItems: 'center',
        touchAction: 'none',
        cursor: 'ew-resize',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        borderRadius: 8,
        outline: 'none',
        ...style,
      }}
    >
      <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden style={{ overflow: 'visible' }}>
        {/* El recorrido entero, muy tenue, y el tramo desde el centro, en tinta. */}
        <path
          d={`M ${f1x} ${f1y} A ${R} ${R} 0 1 1 ${f2x} ${f2y}`}
          fill="none"
          stroke={T.fillStrong}
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        {arco ? <path d={arco} fill="none" stroke={T.text} strokeWidth="2.5" strokeLinecap="round" /> : null}
        <circle cx="12" cy="12" r="5.5" fill={T.knob} stroke={T.borderStrong} strokeWidth="0.75" />
        <line
          x1="12"
          y1="12"
          x2="12"
          y2="7.5"
          stroke={T.text}
          strokeWidth="1.6"
          strokeLinecap="round"
          transform={`rotate(${angulo} 12 12)`}
        />
      </svg>
      <span aria-hidden style={{ position: 'absolute', left: 0, right: 0, top: 2, height: 0 }}>
        <Globo texto={textoPanorama(v)} x={0.5} visible={local !== null || encima} />
      </span>
    </div>
  );
}

/** El foco de teclado de los mandos: se ve, sin pintar nada al tocarlos con el dedo. */
export const ESTILO_MANDOS = `.daw-mando:focus-visible { box-shadow: 0 0 0 2px ${T.focus}; }`;

/** Para quien necesite el número fuera del mando (la tira del dock, el lector). */
export function textoVolumenPista(volumen: number): string {
  return `${textoDb(linealADb(volumen))} dB`.replace('∞ dB', '∞');
}
