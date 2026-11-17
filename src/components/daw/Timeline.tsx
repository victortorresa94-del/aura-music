'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { PeakData, Track } from '@/lib/daw/types';
import type { Studio } from '@/hooks/useStudio';
import { cssColor, haptic, trackTint } from './theme';
import { IconImport, IconMore, T, hintText, numeric } from './ui';
import { IconTocar, NotasClip } from './instrumentos';

/** Ancho de la columna de pistas en el móvil. En pantallas anchas crece. */
export const HEADER_W = 128;
const HEADER_W_WIDE = 208;
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

/** Una pista generada lleva el «IA» en la insignia: no hace falta repetirlo en el nombre. */
function nombreVisible(track: Track): string {
  return track.ia ? track.name.replace(/\s*·\s*IA$/i, '') : track.name;
}

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
  const drag = useRef<{ mode: DragMode; x: number; clip: Track['clip'] } | null>(null);
  const [arrastrando, setArrastrando] = useState(false);
  const { clip } = track;
  const width = Math.max(6, clip.duration * clip.repeats * pps);

  const snapValue = useCallback(
    (value: number) => {
      if (!snap || beatSeconds <= 0) return value;
      const nearest = Math.round(value / beatSeconds) * beatSeconds;
      return Math.abs(nearest - value) < beatSeconds * 0.25 ? nearest : value;
    },
    [snap, beatSeconds],
  );

  const begin = (mode: DragMode) => (event: React.PointerEvent) => {
    if (!selected) {
      onSelect();
      return; // primer toque selecciona; el segundo ya arrastra
    }
    event.stopPropagation();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    drag.current = { mode, x: event.clientX, clip: { ...clip } };
    setArrastrando(true);
    onBeginEdit();
  };

  const move = (event: React.PointerEvent) => {
    const state = drag.current;
    if (!state) return;
    event.stopPropagation();
    const delta = (event.clientX - state.x) / pps;
    const base = state.clip;

    if (state.mode === 'move') {
      onEdit({ start: Math.max(0, snapValue(base.start + delta)) });
      return;
    }

    if (state.mode === 'left') {
      // Recorte de entrada: se come buffer por delante y desplaza el inicio.
      const maxIn = base.duration - 0.08;
      const shift = Math.min(Math.max(delta, -base.offset), maxIn);
      onEdit({
        offset: base.offset + shift,
        start: Math.max(0, base.start + shift),
        duration: base.duration - shift,
      });
      return;
    }

    const maxOut = track.sourceDuration - base.offset;
    onEdit({ duration: Math.min(Math.max(0.08, base.duration + delta), maxOut) });
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
}: {
  showHead: boolean;
  width: number;
  pps: number;
  bpm: number;
  beatsPerBar: number;
  recording: boolean;
  headRef: React.RefObject<HTMLDivElement | null>;
  onSeek: (t: number) => void;
}) {
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
      onPointerDown={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        onSeek(Math.max(0, (event.clientX - rect.left) / pps));
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

const headerCell = (width: number): React.CSSProperties => ({
  position: 'sticky',
  left: 0,
  zIndex: 5,
  width,
  flexShrink: 0,
  display: 'flex',
  flexDirection: 'column',
  boxShadow: `inset -1px 0 0 ${T.border}`,
});

export function Timeline({
  studio,
  pps,
  theme,
  onOpenTrack,
  onZoom,
  beatsPerBar = 4,
  onTocar,
}: {
  studio: Studio;
  pps: number;
  theme: string;
  onOpenTrack: () => void;
  /** Pilar B: abre la pantalla «Tocar». Sin él, no sale el botón. */
  onTocar?: () => void;
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
    toggleMute,
    toggleSolo,
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
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) return;
      if (event.key === '+' || event.key === '=') zoomAround(zoomRef.current.pps * 1.4, null);
      else if (event.key === '-' || event.key === '_') zoomAround(zoomRef.current.pps / 1.4, null);
    };

    node.addEventListener('touchstart', onTouchStart, { passive: true });
    node.addEventListener('touchmove', onTouchMove, { passive: false });
    node.addEventListener('touchend', onTouchEnd);
    node.addEventListener('touchcancel', onTouchEnd);
    node.addEventListener('wheel', onWheel, { passive: false });
    node.addEventListener('gesturestart', onGesture);
    node.addEventListener('gesturechange', onGesture);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      node.removeEventListener('touchstart', onTouchStart);
      node.removeEventListener('touchmove', onTouchMove);
      node.removeEventListener('touchend', onTouchEnd);
      node.removeEventListener('touchcancel', onTouchEnd);
      node.removeEventListener('wheel', onWheel);
      node.removeEventListener('gesturestart', onGesture);
      node.removeEventListener('gesturechange', onGesture);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

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
          <div style={{ ...headerCell(headerW), zIndex: 7, height: RULER_H, background: T.surface }} />
          <Ruler
            width={laneWidth}
            pps={pps}
            bpm={project.bpm}
            beatsPerBar={beatsPerBar}
            recording={recording}
            showHead={project.tracks.length > 0 || recording}
            headRef={headRef}
            onSeek={seek}
          />
        </div>

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
              <div
                style={{
                  ...headerCell(headerW),
                  background: selected ? T.raised : T.surface,
                  padding: '6px 4px 6px 10px',
                  transition: `background-color 160ms ${T.easeOut}`,
                }}
                onClick={() => setSelectedTrackId(track.id)}
                onContextMenu={(event) => {
                  event.preventDefault();
                  openOptions();
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, height: 32, minWidth: 0 }}>
                  {track.ia ? (
                    <span
                      title="La ha tocado la máquina"
                      style={{
                        flexShrink: 0,
                        padding: '2px 4px',
                        borderRadius: 4,
                        background: T.aiSoft,
                        color: T.ai,
                        fontFamily: T.fontBody,
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: '0.03em',
                        lineHeight: 1,
                      }}
                    >
                      IA
                    </span>
                  ) : (
                    <span
                      aria-hidden
                      style={{ width: 10, height: 10, borderRadius: 3, background: tint, flexShrink: 0 }}
                    />
                  )}
                  <span
                    style={{
                      flex: 1,
                      minWidth: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      fontFamily: T.fontBody,
                      fontSize: 13,
                      fontWeight: selected ? 600 : 500,
                      letterSpacing: '-0.01em',
                      color: callada ? T.dim : T.text,
                    }}
                    title={track.name}
                  >
                    {nombreVisible(track)}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center', flex: 1 }}>
                  <Pill active={track.muted} onClick={() => toggleMute(track.id)} title={`Silenciar ${track.name}`}>
                    M
                  </Pill>
                  <Pill active={track.soloed} onClick={() => toggleSolo(track.id)} title={`Solo ${track.name}`}>
                    S
                  </Pill>
                  {/* La única puerta a renombrar, colorear, duplicar o borrar
                      una pista no puede depender de que alguien adivine que el
                      nombre es un botón. Aquí está, a la vista, en todas. */}
                  <button
                    type="button"
                    className="daw-press daw-hover"
                    title={`Opciones de ${track.name}`}
                    aria-label={`Opciones de ${track.name}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      haptic(8);
                      openOptions();
                    }}
                    style={{
                      ...botonPlano,
                      width: 34,
                      height: 36,
                      marginLeft: 'auto',
                      borderRadius: 8,
                      display: 'grid',
                      placeItems: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <IconMore size={18} color={T.dim} />
                  </button>
                </div>
              </div>

              <div
                onPointerDown={() => setSelectedTrackId(track.id)}
                style={{
                  position: 'relative',
                  width: laneWidth,
                  flexShrink: 0,
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
          <EmptyState onImport={studio.importFile} width={viewport} onTocar={onTocar} />
        ) : (
          <>
            <AddTrackRow onImport={studio.importFile} headerW={headerW} laneWidth={laneWidth} laneStyle={laneStyle} wide={headerW > HEADER_W} onTocar={onTocar} />
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

const botonPlano: React.CSSProperties = {
  border: 'none',
  margin: 0,
  padding: 0,
  background: 'transparent',
  color: 'inherit',
  font: 'inherit',
  cursor: 'pointer',
  touchAction: 'manipulation',
  WebkitTapHighlightColor: 'transparent',
};

/**
 * Añadir una pista que no viene del micro. Va al final de la columna de
 * pistas, que es donde el ojo espera encontrar el "y ahora qué": debajo de lo
 * último grabado. Sin borde de rayas: es una fila más de la lista.
 */
function AddTrackRow({
  onImport,
  headerW,
  laneWidth,
  laneStyle,
  wide,
  onTocar,
}: {
  onImport: (file: File) => void | Promise<void>;
  headerW: number;
  laneWidth: number;
  laneStyle: React.CSSProperties;
  wide: boolean;
  onTocar?: () => void;
}) {
  return (
    <div style={{ display: 'flex', height: 56, flexShrink: 0, boxShadow: `inset 0 -1px 0 ${T.rowLine}` }}>
      <div style={{ ...headerCell(headerW), background: T.surface, justifyContent: 'center', padding: '0 6px' }}>
        <ImportButton onImport={onImport} text={wide ? 'Importar audio' : 'Importar'} />
      </div>
      <div style={{ width: laneWidth, flexShrink: 0, ...laneStyle }}>
        {/* Pilar B: tocar un instrumento es la otra forma de añadir una pista.
            Pegado a la izquierda de la calle, para que no se vaya al desplazar. */}
        {onTocar ? (
          <div style={{ position: 'sticky', left: headerW, display: 'inline-flex', alignItems: 'center', height: '100%', paddingLeft: 8 }}>
            <BotonTocar onTocar={onTocar} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Pilar B: el botón que abre la pantalla «Tocar». */
function BotonTocar({ onTocar, prominent }: { onTocar: () => void; prominent?: boolean }) {
  return (
    <button
      type="button"
      className="daw-press daw-hover"
      title="Tocar pads, teclado, acordes o bajo y grabarlo como notas"
      onClick={() => {
        haptic(10);
        onTocar();
      }}
      style={{
        ...botonPlano,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        minHeight: prominent ? 48 : 40,
        padding: prominent ? '0 18px' : '0 12px',
        borderRadius: prominent ? 12 : 10,
        background: T.fill,
        boxShadow: `inset 0 1px 0 ${T.rim}`,
        color: T.text,
        fontFamily: T.fontBody,
        fontSize: prominent ? 15 : 13,
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}
    >
      <IconTocar size={prominent ? 18 : 16} color="currentColor" />
      {prominent ? 'Tocar un instrumento' : 'Tocar'}
    </button>
  );
}

function ImportButton({
  onImport,
  text,
  prominent,
}: {
  onImport: (file: File) => void | Promise<void>;
  text: string;
  prominent?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="audio/*,.m4a,.mp3,.wav,.aac,.caf,.aiff,.ogg"
        style={{ display: 'none' }}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void onImport(file);
          event.target.value = '';
        }}
      />
      <button
        type="button"
        className="daw-press daw-hover"
        title="Importar un audio del móvil como pista nueva"
        onClick={() => inputRef.current?.click()}
        style={{
          ...botonPlano,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          minHeight: prominent ? 48 : 40,
          padding: prominent ? '0 18px' : '0 8px',
          borderRadius: prominent ? 12 : 10,
          background: prominent ? T.fill : 'transparent',
          boxShadow: prominent ? `inset 0 1px 0 ${T.rim}` : 'none',
          color: prominent ? T.text : T.dim,
          fontFamily: T.fontBody,
          fontSize: prominent ? 15 : 13,
          fontWeight: 500,
          whiteSpace: 'nowrap',
        }}
      >
        <IconImport size={prominent ? 18 : 16} color="currentColor" />
        {text}
      </button>
    </>
  );
}

/**
 * Mute y solo. Apagado: relleno tenue y letra gris. Encendido: invertido,
 * claro sobre oscuro (u oscuro sobre claro), que se distingue a un metro sin
 * necesitar un color más. La zona que se toca es la fila entera, más alta que
 * la píldora que se ve.
 */
function Pill({
  children,
  active,
  onClick,
  title,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      className="daw-press"
      onClick={(event) => {
        event.stopPropagation();
        haptic(8);
        onClick();
      }}
      style={{
        ...botonPlano,
        flex: 1,
        maxWidth: 40,
        height: 36,
        display: 'grid',
        placeItems: 'center',
      }}
    >
      <span
        style={{
          width: '100%',
          height: 26,
          display: 'grid',
          placeItems: 'center',
          borderRadius: 7,
          background: active ? T.text : T.fill,
          boxShadow: active ? 'none' : `inset 0 1px 0 ${T.rim}`,
          color: active ? T.inverse : T.dim,
          fontFamily: T.fontBody,
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: '0.02em',
          transition: `background-color 140ms ${T.easeOut}, color 140ms ${T.easeOut}`,
        }}
      >
        {children}
      </span>
    </button>
  );
}

/**
 * Estado vacío. Enseña lo que se hace aquí en una frase y apunta al botón de
 * grabar: el ojo tiene que saber en menos de un segundo qué toca, sin leer.
 */
function EmptyState({
  onImport,
  width,
  onTocar,
}: {
  onImport: (file: File) => void | Promise<void>;
  width: number;
  onTocar?: () => void;
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
      <p style={{ ...hintText, fontSize: 15, maxWidth: 300, marginBottom: 6 }}>
        Dale al botón rojo y toca. Cada toma cae en su propia pista, y la siguiente se graba oyendo las
        anteriores.
      </p>
      <p style={{ ...hintText, fontSize: 13, color: T.faint, maxWidth: 300, marginBottom: 24 }}>
        Con cascos, para que la segunda toma no se coma a la primera.
      </p>
      {/* Pilar B: sin micro también se empieza, tocando en la pantalla. */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }}>
        {onTocar ? <BotonTocar onTocar={onTocar} prominent /> : null}
        <ImportButton onImport={onImport} text="Importar un audio" prominent />
      </div>
      <svg width="22" height="56" viewBox="0 0 22 56" fill="none" aria-hidden style={{ marginTop: 24, opacity: 0.55 }}>
        <path d="M11 1v48" stroke={T.rec} strokeWidth="1.5" strokeLinecap="round" strokeDasharray="3 5" />
        <path d="m4.5 43 6.5 7 6.5-7" stroke={T.rec} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}
