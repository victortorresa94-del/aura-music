'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { PeakData, Track } from '@/lib/daw/types';
import type { Studio } from '@/hooks/useStudio';
import type { Mezcla } from '@/hooks/useMezcla';
import { cssColor, haptic, trackTint } from './theme';
import { T, hintText, numeric } from './ui';
import { CabeceraPista, botonPlano, headerCell, nombreVisible } from './cabecera/CabeceraPista';
import { ESTILO_MANDOS } from './cabecera/ControlesPista';
import { EVENTO_VER_CURSOR, EVENTO_ZOOM } from '@/hooks/useEdicion';
import { alPulso, TROZO_MINIMO } from '@/lib/daw/edicion';
import { NotasClip } from './instrumentos';
// Grabar en bucle: el ciclo en la regla y en las pistas.
import { BotonCiclo, useArrastreDeCiclo, ZonaEnPistas, ZonaEnRegla } from './bucle/Ciclo';
// Añadir: el «+» de la fila de añadir y del estado vacío.
import { Plus } from '@phosphor-icons/react';

/** Ancho de la columna de pistas en el móvil. En pantallas anchas crece. */
export const HEADER_W = 128;
/* Cabe el nombre, M, S, el volumen y el panorama sin apretar. */
const HEADER_W_WIDE = 252;
const ROW_H = 80;
const RULER_H = 30;
/** Margen del clip dentro de su calle, arriba y abajo. */
const CLIP_INSET = 6;
const CLIP_H = ROW_H - CLIP_INSET * 2;
/** La franja del nombre, arriba del clip: el nombre nunca va encima de la onda. */
const CAPTION_H = 18;
const CANVAS_CHUNK = 1600;
const PPS_MIN = 6;
const PPS_MAX = 240;

/* -------------------------------------------------------------------------- */
/* Forma de onda                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Se dibuja en trozos de 1600 px: un canvas de 20 000 px de ancho (un minuto
 * de audio con el zoom alto) revienta en Safari móvil.
 */
function Waveform({
  peaks,
  offset,
  duration,
  repeats,
  width,
  height,
  color,
  theme,
}: {
  peaks: PeakData | null;
  offset: number;
  duration: number;
  repeats: number;
  width: number;
  height: number;
  color: string;
  theme: string;
}) {
  const chunks = useMemo(() => {
    const list: { x: number; w: number }[] = [];
    for (let x = 0; x < width; x += CANVAS_CHUNK) {
      list.push({ x, w: Math.min(CANVAS_CHUNK, width - x) });
    }
    return list;
  }, [width]);

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', pointerEvents: 'none' }}>
      {chunks.map((chunk) => (
        <WaveChunk
          key={chunk.x}
          peaks={peaks}
          offset={offset}
          duration={duration}
          repeats={repeats}
          totalWidth={width}
          x0={chunk.x}
          width={chunk.w}
          height={height}
          color={color}
          theme={theme}
        />
      ))}
    </div>
  );
}

function WaveChunk({
  peaks,
  offset,
  duration,
  repeats,
  totalWidth,
  x0,
  width,
  height,
  color,
  theme,
}: {
  peaks: PeakData | null;
  offset: number;
  duration: number;
  repeats: number;
  totalWidth: number;
  x0: number;
  width: number;
  height: number;
  color: string;
  theme: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.floor(width * dpr));
    const h = Math.max(1, Math.floor(height * dpr));
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, w, h);
    const mid = h / 2;
    const tinte = cssColor(color, '#888');

    // La línea de cero, en el tinte de la pista y muy baja: se ve que la
    // pista existe aunque la toma sea silencio.
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = tinte;
    ctx.fillRect(0, Math.floor(mid), w, Math.max(1, Math.round(dpr)));
    ctx.globalAlpha = 1;

    if (!peaks || duration <= 0) return;

    const totalTime = duration * Math.max(1, repeats);

    /* La onda se dibuja a escala de su propio pico, no de la escala absoluta.
       Una guitarra grabada con el micro del móvil a medio metro entra sobre
       -20 dBFS, o sea una amplitud de 0,1: dibujada en crudo ocupaba tres
       píxeles y la pista parecía vacía. Mirando la pantalla no se podía saber
       si había grabado algo, que en una app cuya promesa es "no pierdas la
       idea" es el peor sitio posible para tener una duda.
       El suelo evita el efecto contrario: amplificar el ruido de fondo de una
       toma muda hasta que parezca música. Por debajo de él se dibuja plano, y
       ese silencio se avisa aparte. */
    const SUELO = 0.02;
    const escala = peaks.pico > SUELO ? 0.9 / peaks.pico : 0;
    ctx.fillStyle = tinte;
    ctx.beginPath();
    for (let px = 0; px < w; px++) {
      const globalX = x0 * dpr + px;
      const time = (globalX / (totalWidth * dpr)) * totalTime;
      const inRepeat = duration > 0 ? time % duration : 0;
      const index = Math.floor((offset + inRepeat) * peaks.peaksPerSecond);
      if (index < 0 || index >= peaks.min.length) continue;
      const lo = peaks.min[index];
      const hi = peaks.max[index];
      const y1 = mid - hi * mid * escala;
      const y2 = mid - lo * mid * escala;
      ctx.rect(px, y1, 1, Math.max(1, y2 - y1));
    }
    ctx.fill();
  }, [peaks, offset, duration, repeats, totalWidth, x0, width, height, color, theme]);

  return <canvas ref={canvasRef} style={{ width, height, display: 'block', flexShrink: 0 }} aria-hidden />;
}

/* -------------------------------------------------------------------------- */
/* Clip                                                                        */
/* -------------------------------------------------------------------------- */

type DragMode = 'move' | 'left' | 'right';

function ClipBlock({
  track,
  tint,
  peaks,
  pps,
  selected,
  beatSeconds,
  snap,
  onSelect,
  onBeginEdit,
  onEdit,
  onOptions,
  theme,
  callada,
}: {
  /** No suena: silenciada, o hay otra pista en solo. */
  callada: boolean;
  track: Track;
  tint: string;
  peaks: PeakData | null;
  pps: number;
  selected: boolean;
  beatSeconds: number;
  snap: boolean;
  theme: string;
  onSelect: () => void;
  onBeginEdit: () => void;
  onEdit: (patch: Partial<Track['clip']>) => void;
  onOptions: () => void;
}) {
  const drag = useRef<{ mode: DragMode; x: number; clip: Track['clip']; empezado: boolean } | null>(null);
  const [arrastrando, setArrastrando] = useState(false);
  const { clip } = track;
  const width = Math.max(6, clip.duration * clip.repeats * pps);

  // El imán a la rejilla (si está puesto en Ajustes). Con Alt se suelta.
  const snapValue = useCallback(
    (value: number, libre = false) => alPulso(value, beatSeconds, snap && !libre),
    [snap, beatSeconds],
  );

  const begin = (mode: DragMode) => (event: React.PointerEvent) => {
    if (event.button !== 0) return;
    if (!selected) {
      onSelect();
      // Con el dedo, el primer toque elige y el segundo ya arrastra: si no,
      // desplazar la lista movería clips sin querer. Con el ratón no hay ese
      // riesgo y se arrastra a la primera, como en cualquier DAW.
      if (event.pointerType !== 'mouse') return;
    }
    event.stopPropagation();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    drag.current = { mode, x: event.clientX, clip: { ...clip }, empezado: false };
  };

  const move = (event: React.PointerEvent) => {
    const state = drag.current;
    if (!state) return;
    event.stopPropagation();
    const dx = event.clientX - state.x;
    // Hasta que no se mueve de verdad no es un arrastre: un clic no deja un
    // paso de Deshacer vacío ni mueve el clip medio píxel.
    if (!state.empezado) {
      if (Math.abs(dx) < 3) return;
      state.empezado = true;
      setArrastrando(true);
      onBeginEdit();
    }
    const delta = dx / pps;
    const base = state.clip;
    const libre = event.altKey;

    if (state.mode === 'move') {
      onEdit({ start: Math.max(0, snapValue(base.start + delta, libre)) });
      return;
    }

    if (state.mode === 'left') {
      // Recorte de entrada: se come buffer por delante y desplaza el inicio.
      // El imán va sobre el borde, que es lo que se ve.
      const maxIn = base.duration - TROZO_MINIMO;
      const deseado = snapValue(Math.max(0, base.start + delta), libre) - base.start;
      const shift = Math.min(Math.max(deseado, -base.offset, -base.start), maxIn);
      onEdit({
        offset: base.offset + shift,
        start: base.start + shift,
        duration: base.duration - shift,
      });
      return;
    }

    const maxOut = track.sourceDuration - base.offset;
    // Con repeticiones el borde derecho cambia lo que dura cada vuelta: el
    // imán solo tiene sentido con una.
    const fin =
      base.repeats === 1 ? snapValue(base.start + base.duration + delta, libre) - base.start : base.duration + delta;
    onEdit({ duration: Math.min(Math.max(TROZO_MINIMO, fin), maxOut) });
  };

  const end = (event: React.PointerEvent) => {
    if (!drag.current) return;
    drag.current = null;
    setArrastrando(false);
    try {
      (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
    } catch {
      /* el puntero ya se soltó */
    }
  };

  const handleStyle = {
    position: 'absolute' as const,
    top: 0,
    bottom: 0,
    width: 22,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'ew-resize',
    touchAction: 'none' as const,
    zIndex: 3,
  };

  const grip = (
    <span
      style={{
        width: 4,
        height: 24,
        marginTop: CAPTION_H / 2,
        borderRadius: 2,
        background: T.text,
        boxShadow: `0 0 0 1px ${T.bg}`,
      }}
    />
  );

  // El tinte manda en todo el clip: fondo, filo, franja del nombre y onda.
  // Mezclado con el fondo, no transparente: las líneas de la rejilla no se
  // cuelan por debajo de la onda.
  const mezcla = (pct: number, base: string = T.bg) => `color-mix(in srgb, ${tint} ${pct}%, ${base})`;
  // Sobre papel blanco el mismo porcentaje pesa casi el doble que sobre negro:
  // en claro el clip es un velo y la que lleva el color es la onda.
  const claro = theme === 'light';

  return (
    <div
      data-clip={track.id}
      data-start={clip.start.toFixed(3)}
      onPointerDown={begin('move')}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
      onContextMenu={(event) => {
        // El botón derecho, en vez de abrir el menú del navegador, abre el
        // mismo panel de opciones que el botón "⋯": es donde de verdad hay
        // algo que hacer con la pista.
        event.preventDefault();
        onSelect();
        onOptions();
      }}
      style={{
        position: 'absolute',
        left: clip.start * pps,
        top: CLIP_INSET,
        height: CLIP_H,
        width,
        borderRadius: 6,
        background: mezcla(claro ? (selected ? 11 : 7) : selected ? 17 : 13),
        // El contorno va en una capa encima (ver abajo): una sombra interior
        // aquí quedaría tapada por la franja del nombre. Aquí, la elevación.
        boxShadow: selected ? (arrastrando ? T.elev2 : T.elev1) : 'none',
        overflow: 'hidden',
        touchAction: selected ? 'none' : 'pan-x pan-y',
        opacity: callada ? 0.42 : 1,
        zIndex: selected ? 2 : 1,
        cursor: selected ? 'grab' : 'pointer',
        transition: `box-shadow 160ms ${T.easeOut}, opacity 160ms ${T.easeOut}, background-color 160ms ${T.easeOut}`,
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          height: CAPTION_H,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '0 7px',
          background: mezcla(claro ? (selected ? 26 : 15) : selected ? 40 : 26),
          pointerEvents: 'none',
        }}
      >
        <span
          style={{
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontFamily: T.fontBody,
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.005em',
            color: T.text,
          }}
        >
          {nombreVisible(track)}
        </span>
        {clip.repeats > 1 ? (
          <span style={{ ...numeric, fontSize: 10, color: T.dim, flexShrink: 0 }}>×{clip.repeats}</span>
        ) : null}
      </div>

      <div style={{ position: 'absolute', left: 0, right: 0, top: CAPTION_H, bottom: 0 }}>
        {/* Pilar B: una pista tocada en la pantalla enseña sus notas, no la onda. */}
        {track.notas ? (
          <NotasClip notas={track.notas} clip={clip} pps={pps} width={width} height={CLIP_H - CAPTION_H} color={tint} theme={theme} />
        ) : (
          <Waveform
            peaks={peaks}
            offset={clip.offset}
            duration={clip.duration}
            repeats={clip.repeats}
            width={width}
            height={CLIP_H - CAPTION_H}
            color={tint}
            theme={theme}
          />
        )}
      </div>

      {/* separadores entre repeticiones */}
      {clip.repeats > 1
        ? Array.from({ length: clip.repeats - 1 }, (_, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: (i + 1) * clip.duration * pps,
                top: CAPTION_H,
                bottom: 0,
                width: 1,
                background: mezcla(55, 'transparent'),
                pointerEvents: 'none',
              }}
            />
          ))
        : null}

      {/* El contorno, por encima de la franja y de la onda. Como sombra
          interior y no como borde: con box-sizing:border-box, un borde de 1px
          encoge la caja y la onda dejaría de cuadrar con la rejilla. */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 'inherit',
          pointerEvents: 'none',
          zIndex: 2,
          boxShadow: selected ? `inset 0 0 0 1.5px ${T.text}` : `inset 0 0 0 1px ${mezcla(34, 'transparent')}`,
          transition: `box-shadow 160ms ${T.easeOut}`,
        }}
      />

      {selected ? (
        <>
          <div style={{ ...handleStyle, left: 0 }} onPointerDown={begin('left')} onPointerMove={move} onPointerUp={end} onPointerCancel={end}>
            {grip}
          </div>
          <div style={{ ...handleStyle, right: 0 }} onPointerDown={begin('right')} onPointerMove={move} onPointerUp={end} onPointerCancel={end}>
            {grip}
          </div>
        </>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Cursor y toma en curso                                                      */
/* -------------------------------------------------------------------------- */

/**
 * El cursor son dos piezas que se mueven en el mismo fotograma: la línea, que
 * cruza las calles por debajo de la columna de pistas, y la cabeza, que vive
 * en la regla. Así la línea nunca pasa por encima de los nombres al
 * desplazarte a la derecha.
 */
function Playhead({
  studio,
  pps,
  headerW,
  recording,
  headRef,
  scrollRef,
  followRef,
}: {
  studio: Studio;
  pps: number;
  headerW: number;
  recording: boolean;
  headRef: React.RefObject<HTMLDivElement | null>;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  followRef: React.RefObject<number>;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const { engine } = studio;

  useEffect(() => {
    let raf = 0;
    let last = -1;
    const loop = () => {
      const position = engine?.position ?? 0;
      if (position !== last && ref.current) {
        last = position;
        ref.current.style.transform = `translateX(${headerW + position * pps}px)`;
        // En el cero la cabeza no se esconde a medias bajo la columna de pistas.
        if (headRef.current) headRef.current.style.transform = `translateX(${Math.max(0, position * pps - 6)}px)`;

        const scroller = scrollRef.current;
        const playing = engine?.transportState !== 'stopped';
        if (scroller && playing && Date.now() > followRef.current) {
          const x = headerW + position * pps;
          const min = scroller.scrollLeft + headerW + 40;
          const max = scroller.scrollLeft + scroller.clientWidth - 60;
          if (x > max || x < min) {
            scroller.scrollLeft = Math.max(0, x - headerW - scroller.clientWidth * 0.35);
          }
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [engine, pps, headerW, headRef, scrollRef, followRef]);

  return (
    <div
      ref={ref}
      aria-hidden
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: 1.5,
        marginLeft: -0.75,
        background: recording ? T.rec : T.text,
        zIndex: 4,
        pointerEvents: 'none',
        willChange: 'transform',
      }}
    />
  );
}

function RecordingRow({ studio, pps, headerW, laneStyle }: { studio: Studio; pps: number; headerW: number; laneStyle: React.CSSProperties }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const { engine } = studio;

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const node = ref.current;
      if (node && engine) {
        const start = engine.recordingStart;
        const width = Math.max(0, (engine.position - start) * pps);
        node.style.left = `${start * pps}px`;
        node.style.width = `${width}px`;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [engine, pps]);

  return (
    <div style={{ display: 'flex', height: ROW_H, flexShrink: 0, boxShadow: `inset 0 -1px 0 ${T.rowLine}` }}>
      <div
        style={{
          ...headerCell(headerW),
          background: T.surface,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          padding: '0 12px',
        }}
      >
        <span
          className="daw-blink"
          style={{ width: 8, height: 8, borderRadius: '50%', background: T.rec, flexShrink: 0 }}
        />
        <span style={{ fontFamily: T.fontBody, fontSize: 13, fontWeight: 600, color: T.rec }}>Grabando</span>
      </div>
      <div style={{ position: 'relative', flex: 1, backgroundColor: T.recSoft, ...laneStyle }}>
        <div
          ref={ref}
          style={{
            position: 'absolute',
            top: CLIP_INSET,
            height: CLIP_H,
            borderRadius: 6,
            background: T.recSoft,
            boxShadow: `inset 0 0 0 1.5px ${T.rec}`,
          }}
        />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Regla                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * La regla cuenta compases y pulsos, como cualquier DAW: un músico dice «en
 * el compás 9», no «a los 18 segundos». Los compases salen del tempo del
 * proyecto y del ciclo que esté sonando (4 pulsos, o 12 si es una bulería).
 * Las marcas son degradados y no un div por pulso: con el zoom fuera, un
 * minuto de bulería son cientos de pulsos.
 */
function Ruler({
  width,
  pps,
  bpm,
  beatsPerBar,
  recording,
  showHead,
  headRef,
  onSeek,
  onScrub,
  cicloArrastre,
  children,
}: {
  /** Grabar en bucle: Mayús + arrastrar con el ratón marca el ciclo. */
  cicloArrastre?: {
    onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
    onPointerMove: (event: React.PointerEvent<HTMLDivElement>) => void;
    onPointerUp: () => void;
  };
  /** Lo que se dibuja encima de la regla (la zona del ciclo). */
  children?: React.ReactNode;
  showHead: boolean;
  width: number;
  pps: number;
  bpm: number;
  beatsPerBar: number;
  recording: boolean;
  headRef: React.RefObject<HTMLDivElement | null>;
  onSeek: (t: number) => void;
  /** Mientras se arrastra: mueve el cursor sin reprogramar lo que suena. */
  onScrub: (t: number) => void;
}) {
  const arrastre = useRef(false);
  const beatPx = (60 / bpm) * pps;
  const barPx = beatPx * beatsPerBar;
  // Un número cada tantos compases como haga falta para que no se pisen.
  const every = [1, 2, 4, 8, 16, 32, 64].find((n) => n * barPx >= 34) ?? 128;
  const bars = Math.ceil(width / barPx) + 1;
  const numeros: number[] = [];
  for (let i = 0; i < bars; i += every) numeros.push(i);

  const capas = [
    `repeating-linear-gradient(90deg, ${T.borderStrong} 0 1px, transparent 1px ${every * barPx}px)`,
    `repeating-linear-gradient(90deg, ${T.borderStrong} 0 1px, transparent 1px ${barPx}px)`,
  ];
  const tamaños = ['100% 100%', '100% 9px'];
  if (beatPx >= 7) {
    capas.push(`repeating-linear-gradient(90deg, ${T.border} 0 1px, transparent 1px ${beatPx}px)`);
    tamaños.push('100% 5px');
  }

  return (
    <div
      title="Clic para llevar el cursor ahí. Con el ratón, arrastra. Con Mayús, marca el ciclo."
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        // Grabar en bucle: Mayús + arrastrar con el ratón marca el ciclo,
        // sin mover el cursor. Sin Mayús, la regla es la de siempre.
        if (event.shiftKey && cicloArrastre) {
          cicloArrastre.onPointerDown(event);
          return;
        }
        const rect = event.currentTarget.getBoundingClientRect();
        onSeek(Math.max(0, (event.clientX - rect.left) / pps));
        // Con el ratón se arrastra el cursor por la regla, atrás o adelante.
        // Con el dedo no: deslizar la regla desplaza la línea de tiempo.
        if (event.pointerType === 'mouse') {
          event.currentTarget.setPointerCapture(event.pointerId);
          arrastre.current = true;
        }
      }}
      onPointerMove={(event) => {
        cicloArrastre?.onPointerMove(event);
        if (!arrastre.current) return;
        const rect = event.currentTarget.getBoundingClientRect();
        onScrub(Math.max(0, (event.clientX - rect.left) / pps));
      }}
      onPointerUp={(event) => {
        cicloArrastre?.onPointerUp();
        if (!arrastre.current) return;
        arrastre.current = false;
        const rect = event.currentTarget.getBoundingClientRect();
        onSeek(Math.max(0, (event.clientX - rect.left) / pps));
      }}
      onPointerCancel={() => {
        cicloArrastre?.onPointerUp();
        arrastre.current = false;
      }}
      style={{
        position: 'relative',
        width,
        height: RULER_H,
        flexShrink: 0,
        cursor: 'pointer',
        touchAction: 'pan-x pan-y',
        backgroundImage: capas.join(', '),
        backgroundSize: tamaños.join(', '),
        backgroundPosition: capas.map(() => '0 100%').join(', '),
        backgroundRepeat: 'no-repeat',
      }}
    >
      {numeros.map((i) => (
        <span
          key={i}
          style={{
            ...numeric,
            position: 'absolute',
            left: i * barPx + 5,
            top: 6,
            fontSize: 11,
            lineHeight: 1,
            color: T.dim,
            pointerEvents: 'none',
          }}
        >
          {i + 1}
        </span>
      ))}
      {children}
      <div
        ref={headRef}
        aria-hidden
        style={{
          display: showHead ? 'block' : 'none',
          position: 'absolute',
          left: 0,
          bottom: 0,
          width: 12,
          height: 14,
          background: recording ? T.rec : T.text,
          clipPath: 'polygon(0 0, 100% 0, 100% 55%, 50% 100%, 0 55%)',
          borderRadius: 2,
          pointerEvents: 'none',
          willChange: 'transform',
          zIndex: 2,
        }}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Línea de tiempo                                                             */
/* -------------------------------------------------------------------------- */


export function Timeline({
  studio,
  pps,
  theme,
  onOpenTrack,
  onZoom,
  beatsPerBar = 4,
  onAnadir,
  mezcla,
}: {
  studio: Studio;
  /** El mezclador: el volumen y el panorama de la cabecera se guardan como los suyos. */
  mezcla?: Mezcla;
  pps: number;
  theme: string;
  onOpenTrack: () => void;
  /** Pilar B: abre la pantalla «Tocar». Sin él, no sale el botón. */
  /** Añadir: abre la hoja con todas las formas de meter una pista. */
  onAnadir?: () => void;
  /** Pellizco, Ctrl/⌘ + rueda o las teclas + y −. Sin él no hay zoom. */
  onZoom?: (pps: number) => void;
  /** Pulsos por compás para la regla: 4, o el ciclo del ritmo que suene. */
  beatsPerBar?: number;
}) {
  const {
    project,
    settings,
    transport,
    duration,
    selectedTrackId,
    setSelectedTrackId,
    getPeaks,
    updateClip,
    seek,
  } = studio;

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const headRef = useRef<HTMLDivElement | null>(null);
  const followRef = useRef<number>(0);
  const mountedAt = useRef(Date.now());
  const [viewport, setViewport] = useState(360);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    const update = () => setViewport(node.clientWidth);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const headerW = viewport >= 720 ? HEADER_W_WIDE : HEADER_W;
  const laneWidth = Math.max((duration + 12) * pps, viewport - headerW + 200, 600);
  const beatSeconds = 60 / project.bpm;
  const recording = transport === 'recording' || transport === 'countin';
  // Grabar en bucle: arrastrar por la regla con el ratón marca el ciclo.
  const arrastreDeCiclo = useArrastreDeCiclo(studio, pps, beatsPerBar);
  const haySolo = project.tracks.some((track) => track.soloed);

  const pauseFollow = () => {
    followRef.current = Date.now() + 4000;
  };

  /* ------------------------------ zoom ---------------------------------- */
  /* Se amplía alrededor de lo que hay bajo los dedos (o el ratón): el
     instante que miras se queda donde estaba, como en Logic. */
  const zoomRef = useRef({ pps, headerW, onZoom });
  zoomRef.current = { pps, headerW, onZoom };
  const anchorRef = useRef<{ time: number; offsetX: number } | null>(null);

  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    const node = scrollRef.current;
    if (!anchor || !node) return;
    anchorRef.current = null;
    node.scrollLeft = Math.max(0, headerW + anchor.time * pps - anchor.offsetX);
  }, [pps, headerW]);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;

    const zoomAround = (next: number, clientX: number | null) => {
      const { pps: actual, headerW: col, onZoom: zoom } = zoomRef.current;
      if (!zoom) return;
      const clamped = Math.min(PPS_MAX, Math.max(PPS_MIN, next));
      if (Math.abs(clamped - actual) < 0.01) return;
      const rect = node.getBoundingClientRect();
      const x = clientX === null ? rect.left + col + (rect.width - col) / 2 : clientX;
      const offsetX = Math.max(col, x - rect.left);
      const time = Math.max(0, (node.scrollLeft + offsetX - col) / actual);
      anchorRef.current = { time, offsetX };
      followRef.current = Date.now() + 4000;
      zoom(clamped);
    };

    let pellizco: { dist: number; pps: number } | null = null;
    const distancia = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length === 2) pellizco = { dist: distancia(event.touches), pps: zoomRef.current.pps };
    };
    const onTouchMove = (event: TouchEvent) => {
      if (event.touches.length !== 2 || !pellizco) return;
      // Sin esto, el navegador amplía la página entera en vez de la línea de tiempo.
      event.preventDefault();
      const medio = (event.touches[0].clientX + event.touches[1].clientX) / 2;
      zoomAround(pellizco.pps * (distancia(event.touches) / Math.max(1, pellizco.dist)), medio);
    };
    const onTouchEnd = (event: TouchEvent) => {
      if (event.touches.length < 2) pellizco = null;
    };
    // Ctrl/⌘ + rueda; el pellizco del trackpad llega así también.
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      zoomAround(zoomRef.current.pps * Math.exp(-event.deltaY * 0.004), event.clientX);
    };
    // Safari de iOS manda además sus propios gestos: que no amplíen la página.
    const onGesture = (event: Event) => event.preventDefault();
    // Las teclas + y − (y el menú Ver) llegan por `useEdicion` como evento.
    const onZoomTeclado = (event: Event) => {
      const factor = (event as CustomEvent<number>).detail;
      if (typeof factor === 'number' && factor > 0) zoomAround(zoomRef.current.pps * factor, null);
    };

    node.addEventListener('touchstart', onTouchStart, { passive: true });
    node.addEventListener('touchmove', onTouchMove, { passive: false });
    node.addEventListener('touchend', onTouchEnd);
    node.addEventListener('touchcancel', onTouchEnd);
    node.addEventListener('wheel', onWheel, { passive: false });
    node.addEventListener('gesturestart', onGesture);
    node.addEventListener('gesturechange', onGesture);
    window.addEventListener(EVENTO_ZOOM, onZoomTeclado);
    return () => {
      node.removeEventListener('touchstart', onTouchStart);
      node.removeEventListener('touchmove', onTouchMove);
      node.removeEventListener('touchend', onTouchEnd);
      node.removeEventListener('touchcancel', onTouchEnd);
      node.removeEventListener('wheel', onWheel);
      node.removeEventListener('gesturestart', onGesture);
      node.removeEventListener('gesturechange', onGesture);
      window.removeEventListener(EVENTO_ZOOM, onZoomTeclado);
    };
  }, []);

  /* Inicio, Fin y las flechas mueven el cursor: si se va fuera de la vista,
     la línea de tiempo lo sigue (aunque no esté sonando). */
  useEffect(() => {
    const verCursor = () => {
      const node = scrollRef.current;
      const engine = studio.engine;
      if (!node || !engine) return;
      requestAnimationFrame(() => {
        const { pps: actual, headerW: col } = zoomRef.current;
        const x = engine.position * actual;
        const izquierda = node.scrollLeft;
        const visible = node.clientWidth - col;
        if (x < izquierda + 24 || x > izquierda + visible - 48) {
          node.scrollLeft = Math.max(0, x - visible * 0.3);
        }
      });
    };
    window.addEventListener(EVENTO_VER_CURSOR, verCursor);
    return () => window.removeEventListener(EVENTO_VER_CURSOR, verCursor);
  }, [studio.engine]);

  /* Arrastrar el cursor por la regla. Parado, el cursor va con el ratón;
     sonando, se oye desde donde sueltes (reprogramar a cada píxel daría
     tirones). */
  const scrub = useCallback(
    (t: number) => {
      const engine = studio.engine;
      if (!engine) return;
      if (engine.transportState === 'stopped') engine.seek(t);
    },
    [studio.engine],
  );

  /* ----------------------------- rejilla -------------------------------- */
  /* Compás más marcado, pulso más tenue. Va en cada calle (y en el relleno
     de abajo), así la estructura de la canción llega hasta el borde de la
     pantalla en vez de acabarse con la última pista. */
  const beatPx = beatSeconds * pps;
  const barPx = beatPx * beatsPerBar;
  const laneStyle = useMemo<React.CSSProperties>(() => {
    const capas = [`repeating-linear-gradient(90deg, ${T.gridBar} 0 1px, transparent 1px ${barPx}px)`];
    if (beatPx >= 9) capas.push(`repeating-linear-gradient(90deg, ${T.grid} 0 1px, transparent 1px ${beatPx}px)`);
    return { backgroundImage: capas.join(', ') };
  }, [barPx, beatPx]);

  return (
    <div
      ref={scrollRef}
      onPointerDown={pauseFollow}
      style={{
        flex: 1,
        minHeight: 0,
        overflow: 'auto',
        position: 'relative',
        background: T.bg,
        WebkitOverflowScrolling: 'touch',
        overscrollBehavior: 'contain',
      }}
    >
      <div
        style={{
          position: 'relative',
          width: headerW + laneWidth,
          minHeight: '100%',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <style>{ESTILO_MANDOS}</style>
        {/* Regla */}
        <div
          style={{
            display: 'flex',
            flexShrink: 0,
            position: 'sticky',
            top: 0,
            zIndex: 6,
            background: T.surface,
            boxShadow: `inset 0 -1px 0 ${T.border}`,
          }}
        >
          <div style={{ ...headerCell(headerW), zIndex: 7, height: RULER_H, background: T.surface }}>
            {/* Grabar en bucle: el ciclo es de la regla, así que su botón vive al lado. */}
            <BotonCiclo studio={studio} pulsosPorCompas={beatsPerBar} />
          </div>
          <Ruler
            cicloArrastre={arrastreDeCiclo}
            width={laneWidth}
            pps={pps}
            bpm={project.bpm}
            beatsPerBar={beatsPerBar}
            recording={recording}
            showHead={project.tracks.length > 0 || recording}
            headRef={headRef}
            onSeek={seek}
            onScrub={scrub}
          >
            <ZonaEnRegla studio={studio} pps={pps} pulsosPorCompas={beatsPerBar} />
          </Ruler>
        </div>

        {/* Grabar en bucle: la zona del ciclo, sombreada debajo de los clips. */}
        <ZonaEnPistas studio={studio} pps={pps} izquierda={headerW} arriba={RULER_H} />

        {/* Pistas */}
        {project.tracks.map((track, index) => {
          // Con alguna pista en solo, las demás se apagan también a la vista:
          // lo que no suena no puede parecer que suena.
          const callada = track.muted || (haySolo && !track.soloed);
          const selected = track.id === selectedTrackId;
          const tint = track.ia ? T.ai : trackTint(index, theme === 'light' ? 'light' : 'dark');
          const openOptions = () => {
            setSelectedTrackId(track.id);
            onOpenTrack();
          };
          return (
            <div
              key={track.id}
              className={track.createdAt > mountedAt.current ? 'daw-land' : undefined}
              style={{
                display: 'flex',
                height: ROW_H,
                flexShrink: 0,
                boxShadow: `inset 0 -1px 0 ${T.rowLine}`,
              }}
            >
              <CabeceraPista
                track={track}
                tint={tint}
                headerW={headerW}
                wide={headerW > HEADER_W}
                selected={selected}
                callada={callada}
                studio={studio}
                mezcla={mezcla}
                onSelect={() => setSelectedTrackId(track.id)}
                onOptions={openOptions}
              />

              <div
                onPointerDown={() => setSelectedTrackId(track.id)}
                onClick={(event) => {
                  // Un clic en la calle vacía lleva el cursor ahí, como en la
                  // regla. En un clip no: ahí se elige y se arrastra.
                  if ((event.target as HTMLElement).closest('[data-clip]')) return;
                  const rect = event.currentTarget.getBoundingClientRect();
                  seek(alPulso(Math.max(0, (event.clientX - rect.left) / pps), beatSeconds, settings.snapToGrid));
                }}
                style={{
                  position: 'relative',
                  width: laneWidth,
                  flexShrink: 0,
                  // Elegida, la calle entera un punto más opaca.
                  backgroundColor: selected ? T.fill : 'transparent',
                  ...laneStyle,
                }}
              >
                <ClipBlock
                  track={track}
                  tint={tint}
                  peaks={getPeaks(track.clip.bufferId)}
                  pps={pps}
                  selected={selected}
                  beatSeconds={beatSeconds}
                  snap={settings.snapToGrid}
                  theme={theme}
                  callada={callada}
                  onSelect={() => setSelectedTrackId(track.id)}
                  onBeginEdit={() => updateClip(track.id, {}, { history: true })}
                  onEdit={(patch) => updateClip(track.id, patch, { history: false })}
                  onOptions={openOptions}
                />
              </div>
            </div>
          );
        })}

        {recording ? <RecordingRow studio={studio} pps={pps} headerW={headerW} laneStyle={laneStyle} /> : null}

        {project.tracks.length === 0 && !recording ? (
          <EmptyState width={viewport} onAnadir={onAnadir} onGrabar={() => {
            // Dentro del toque: en iOS el audio solo arranca así.
            studio.engine?.unlockSync();
            void studio.record();
          }} />
        ) : (
          <>
            <AddTrackRow headerW={headerW} laneWidth={laneWidth} laneStyle={laneStyle} onAnadir={onAnadir} />
            {/* Relleno: la columna y la rejilla siguen hasta abajo, y deja
                aire para que el aviso no tape la última pista. */}
            <div style={{ display: 'flex', flex: 1, minHeight: 72 }}>
              <div style={{ ...headerCell(headerW), background: T.surface }} />
              <div style={{ width: laneWidth, flexShrink: 0, ...laneStyle }} />
            </div>
          </>
        )}

        {project.tracks.length > 0 || recording ? (
          <Playhead
            studio={studio}
            pps={pps}
            headerW={headerW}
            recording={recording}
            headRef={headRef}
            scrollRef={scrollRef}
            followRef={followRef}
          />
        ) : null}
      </div>
    </div>
  );
}


/**
 * La fila de debajo de la última pista: un solo «+ Añadir» con todas las
 * formas de meter una pista (grabar, tocar, un loop, la IA, importar). Antes
 * eran «Importar» y «Tocar» sueltos, y grabar la voz no aparecía. Va en la
 * columna de las cabeceras, donde el ojo espera el «y ahora qué».
 */
function AddTrackRow({
  headerW,
  laneWidth,
  laneStyle,
  onAnadir,
}: {
  headerW: number;
  laneWidth: number;
  laneStyle: React.CSSProperties;
  onAnadir?: () => void;
}) {
  return (
    <div style={{ display: 'flex', height: 56, flexShrink: 0, boxShadow: `inset 0 -1px 0 ${T.rowLine}` }}>
      <div style={{ ...headerCell(headerW), background: T.surface, justifyContent: 'flex-start', padding: '0 8px' }}>
        {onAnadir ? <BotonAnadir onAnadir={onAnadir} /> : null}
      </div>
      <div style={{ width: laneWidth, flexShrink: 0, ...laneStyle }} />
    </div>
  );
}

/** «+ Añadir»: abre la hoja (en el estado vacío, en grande). */
function BotonAnadir({ onAnadir, grande }: { onAnadir: () => void; grande?: boolean }) {
  return (
    <button
      type="button"
      className="daw-press daw-hover"
      title="Grabar, tocar un instrumento, poner un loop, generar con IA o importar un audio"
      aria-haspopup="dialog"
      onClick={() => {
        haptic(10);
        onAnadir();
      }}
      style={{
        ...botonPlano,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        minHeight: grande ? 52 : 40,
        padding: grande ? '0 22px 0 18px' : '0 14px 0 10px',
        borderRadius: grande ? 14 : 10,
        background: T.fill,
        boxShadow: `inset 0 1px 0 ${T.rim}`,
        color: T.text,
        fontFamily: T.fontBody,
        fontSize: grande ? 16 : 14,
        fontWeight: 600,
        letterSpacing: '-0.01em',
        whiteSpace: 'nowrap',
      }}
    >
      <Plus size={grande ? 18 : 16} weight="bold" aria-hidden />
      Añadir
    </button>
  );
}

/**
 * Estado vacío. Una frase y dos botones: «Grabar» (lo principal, en rojo,
 * porque es grabar) y «+ Añadir» para todo lo demás. Antes eran tres botones
 * iguales y una flecha hacia el botón rojo del transporte.
 */
function EmptyState({
  width,
  onAnadir,
  onGrabar,
}: {
  width: number;
  onAnadir?: () => void;
  onGrabar: () => void;
}) {
  return (
    <div
      style={{
        position: 'sticky',
        left: 0,
        width,
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 24px 24px',
        textAlign: 'center',
      }}
    >
      <h2
        style={{
          fontFamily: T.fontBody,
          fontSize: 23,
          fontWeight: 600,
          letterSpacing: '-0.025em',
          lineHeight: 1.2,
          color: T.text,
          marginBottom: 10,
          textWrap: 'balance',
        }}
      >
        Graba la primera toma
      </h2>
      <p style={{ ...hintText, fontSize: 15, maxWidth: 320, marginBottom: 6 }}>
        Tu voz o tu instrumento con el micro. O añade un instrumento en la pantalla, un loop, algo de la IA o un audio.
      </p>
      <p style={{ ...hintText, fontSize: 13, color: T.faint, maxWidth: 300, marginBottom: 24 }}>
        Con cascos, para que la segunda toma no se coma a la primera.
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 10 }}>
        <button
          type="button"
          className="daw-press daw-sink"
          onClick={() => {
            haptic(12);
            onGrabar();
          }}
          style={{
            ...botonPlano,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            minHeight: 52,
            padding: '0 24px 0 20px',
            borderRadius: 14,
            background: T.recFill,
            boxShadow: T.elev1,
            color: T.onRec,
            fontFamily: T.fontBody,
            fontSize: 16,
            fontWeight: 600,
            letterSpacing: '-0.01em',
            whiteSpace: 'nowrap',
          }}
        >
          <span aria-hidden style={{ width: 12, height: 12, borderRadius: '50%', background: T.onRec }} />
          Grabar
        </button>
        {onAnadir ? <BotonAnadir onAnadir={onAnadir} grande /> : null}
      </div>
    </div>
  );
}
