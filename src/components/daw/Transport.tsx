'use client';

import { useEffect, useRef } from 'react';
import { formatTime } from '@/lib/daw/audio';
import type { Studio } from '@/hooks/useStudio';
import { haptic } from './theme';
import { IconChevronRight, IconMetronome, IconPlay, IconRewind, IconRhythm, IconStop, T, label, numeric } from './ui';

/**
 * El dock del transporte.
 *
 * Decisiones del panel, resumidas:
 * · Un solo botón domina la pantalla (grabar), en el centro exacto. Ley de
 *   Hick: cuantas más opciones equivalentes, más tarda el cerebro en elegir,
 *   y aquí la única respuesta correcta casi siempre es "graba antes de que se
 *   te olvide". Reproducir es el segundo; volver al principio, el tercero.
 * · A la izquierda del rojo, el transporte (volver, reproducir). A la
 *   derecha, las herramientas que se encienden y se apagan (click, ritmo),
 *   con un estado que se ve encendido desde el atril.
 * · Todo lo que se toca a menudo vive en el tercio inferior, al alcance del
 *   pulgar (ergonomía de una mano, Hoober).
 * · Los números se leen de lejos: compás y pulso en grande, el reloj debajo,
 *   el vúmetro en decibelios (en lineal, una guitarra a -20 dB no movía ni
 *   un píxel) y el estado de la latencia en palabras.
 */

function TimeDisplay({ studio, beatsPerBar }: { studio: Studio; beatsPerBar: number }) {
  const bigRef = useRef<HTMLSpanElement | null>(null);
  const smallRef = useRef<HTMLSpanElement | null>(null);
  const { engine, project } = studio;
  const musicaRef = useRef({ bpm: project.bpm, beatsPerBar });
  musicaRef.current = { bpm: project.bpm, beatsPerBar };

  useEffect(() => {
    let raf = 0;
    let lastBig = '';
    let lastSmall = '';
    let lastCounting = false;
    const loop = () => {
      const position = engine?.position ?? 0;
      const counting = engine?.transportState === 'countin';
      const { bpm, beatsPerBar: pulsos } = musicaRef.current;
      const beat = 60 / Math.max(1, bpm);
      const bar = beat * pulsos;
      let big: string;
      if (counting) {
        // La cuenta atrás ocupa el sitio del compás: es lo que hay que mirar.
        big = String(Math.max(1, Math.ceil(engine.countInRemaining)));
      } else {
        const compas = Math.floor(position / bar);
        const pulso = Math.floor((position - compas * bar) / beat);
        big = `${compas + 1}.${Math.min(pulsos, pulso + 1)}`;
      }
      const small = formatTime(position);
      if (big !== lastBig && bigRef.current) {
        lastBig = big;
        bigRef.current.textContent = big;
      }
      if (counting !== lastCounting && bigRef.current) {
        lastCounting = counting;
        bigRef.current.style.color = counting ? T.rec : T.text;
      }
      if (small !== lastSmall && smallRef.current) {
        lastSmall = small;
        smallRef.current.textContent = small;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [engine]);

  return (
    <div className="daw-t-time" style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
      <span
        ref={bigRef}
        aria-label="Compás y pulso"
        style={{ ...numeric, fontSize: 30, fontWeight: 500, lineHeight: 1, letterSpacing: '-0.07em', color: T.text }}
      >
        1.1
      </span>
      <span ref={smallRef} style={{ ...numeric, fontSize: 12, lineHeight: 1.2, color: T.dim }}>
        00:00.0
      </span>
    </div>
  );
}

/** Lo que entra por el micro, en decibelios: de -54 dB a 0 dB. */
const DB_SUELO = -54;
const aPosicion = (lineal: number) => {
  const db = 20 * Math.log10(Math.max(lineal, 1e-6));
  return Math.max(0, Math.min(1, (db - DB_SUELO) / -DB_SUELO));
};

function LevelMeter({ studio }: { studio: Studio }) {
  const barRef = useRef<HTMLDivElement | null>(null);
  const holdRef = useRef<HTMLDivElement | null>(null);
  const { levelRef } = studio;

  useEffect(() => {
    let raf = 0;
    let smoothed = 0;
    let hold = 0;
    let holdAt = 0;
    let clipUntil = 0;
    const loop = () => {
      const value = Math.min(1, levelRef.current);
      smoothed = value > smoothed ? value : smoothed * 0.86 + value * 0.14;
      const now = performance.now();
      const pos = aPosicion(smoothed);
      if (pos >= hold || now - holdAt > 1200) {
        hold = pos;
        holdAt = now;
      }
      // Recorta: el aviso se queda un segundo y medio, para que dé tiempo a verlo.
      if (value > 0.97) clipUntil = now + 1500;
      const clipping = now < clipUntil;
      if (barRef.current) {
        barRef.current.style.transform = `scaleX(${Math.max(0.004, pos)})`;
        barRef.current.style.background = clipping ? T.rec : T.text;
      }
      if (holdRef.current) {
        holdRef.current.style.transform = `translateX(${hold * 100}%)`;
        holdRef.current.style.opacity = hold > 0.02 ? '1' : '0';
        holdRef.current.style.color = clipping ? T.rec : T.text;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [levelRef]);

  // Marcas en -24, -12 y -6 dB: donde debería moverse una buena toma.
  const marcas = [-24, -12, -6].map((db) => (db - DB_SUELO) / -DB_SUELO);

  return (
    <div
      role="meter"
      aria-label="Nivel de entrada"
      aria-valuemin={DB_SUELO}
      aria-valuemax={0}
      style={{ position: 'relative', width: '100%', height: 6, borderRadius: 3, background: T.fillStrong, overflow: 'hidden' }}
    >
      <div
        ref={barRef}
        style={{
          position: 'absolute',
          inset: 0,
          background: T.text,
          transformOrigin: 'left center',
          transform: 'scaleX(0.004)',
          opacity: 0.88,
        }}
      />
      <div ref={holdRef} style={{ position: 'absolute', inset: 0, opacity: 0 }}>
        <span style={{ position: 'absolute', left: -2, top: 0, bottom: 0, width: 2, background: 'currentColor' }} />
      </div>
      {marcas.map((x) => (
        <span
          key={x}
          aria-hidden
          style={{ position: 'absolute', left: `${x * 100}%`, top: 0, bottom: 0, width: 1, background: T.bg, opacity: 0.6 }}
        />
      ))}
    </div>
  );
}

/** El estado de la latencia, en palabras y con el número en mono. */
function textoLatencia(latencia: Studio['latencia']): { texto: string; ms: number | null; ok: boolean } {
  switch (latencia.origen) {
    case 'medida':
      return { texto: 'Calibrada', ms: latencia.ms, ok: true };
    case 'tomas':
      return { texto: 'Ajustada con tus tomas', ms: latencia.ms, ok: true };
    case 'estimada':
      return { texto: 'Latencia estimada', ms: latencia.ms, ok: false };
    default:
      return { texto: 'Sin calibrar', ms: null, ok: false };
  }
}

export function Transport({
  studio,
  onOpenClick,
  onOpenRhythm,
  onOpenSettings,
  beatsPerBar = 4,
}: {
  studio: Studio;
  onOpenClick: () => void;
  onOpenRhythm: () => void;
  /** Tocar el estado de la latencia lleva a calibrarla. Sin él, abre la claqueta. */
  onOpenSettings?: () => void;
  beatsPerBar?: number;
}) {
  const { transport, settings, play, stop, record, rewind, engine, toggleMetronome, grooveId, latencia } = studio;
  const running = transport !== 'stopped';
  const recording = transport === 'recording' || transport === 'countin';
  const estado = textoLatencia(latencia);

  return (
    <div className="daw-transport">
      <TimeDisplay studio={studio} beatsPerBar={beatsPerBar} />

      <div className="daw-t-status" style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 8, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ ...label, fontSize: 11, flexShrink: 0 }}>Entrada</span>
          <LevelMeter studio={studio} />
        </div>
        <button
          type="button"
          className="daw-hover"
          onClick={onOpenSettings ?? onOpenClick}
          title="Latencia: el retardo que se compensa en cada toma"
          style={{
            alignSelf: 'flex-end',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            minHeight: 28,
            margin: '-6px -6px -6px 0',
            padding: '0 6px',
            border: 'none',
            borderRadius: 8,
            background: 'transparent',
            color: estado.ok ? T.dim : T.text,
            fontFamily: T.fontBody,
            fontSize: 12,
            fontWeight: 500,
            whiteSpace: 'nowrap',
            cursor: 'pointer',
            touchAction: 'manipulation',
          }}
        >
          <span
            aria-hidden
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              flexShrink: 0,
              background: estado.ok ? T.dim : 'transparent',
              boxShadow: estado.ok ? 'none' : `inset 0 0 0 1.5px ${T.dim}`,
            }}
          />
          {estado.texto}
          {estado.ms !== null ? (
            <span style={{ fontVariantNumeric: 'tabular-nums', color: T.dim }}>· {estado.ms} ms</span>
          ) : null}
          <IconChevronRight size={11} color={T.faint} />
        </button>
      </div>

      <div className="daw-t-controls">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
          <ToolButton onClick={rewind} title="Al principio">
            <IconRewind size={19} color={T.text} />
          </ToolButton>
          <button
            type="button"
            className="daw-press daw-sink"
            onClick={() => {
              engine?.unlockSync();
              haptic(10);
              void (running ? stop() : play());
            }}
            aria-label={running ? 'Parar' : 'Reproducir'}
            title={running ? 'Parar' : 'Reproducir'}
            style={{
              width: 60,
              height: 60,
              borderRadius: '50%',
              border: 'none',
              display: 'grid',
              placeItems: 'center',
              background: running ? T.fillStrong : T.raised,
              boxShadow: T.elev1,
              cursor: 'pointer',
              touchAction: 'manipulation',
              WebkitTapHighlightColor: 'transparent',
              flexShrink: 0,
            }}
          >
            {running ? (
              <IconStop size={22} />
            ) : (
              // El triángulo pesa a la izquierda: un par de píxeles a la
              // derecha para que se vea centrado, no que lo esté.
              <span style={{ display: 'grid', marginLeft: 3 }}>
                <IconPlay size={24} />
              </span>
            )}
          </button>
        </div>

        <button
          type="button"
          className="daw-press daw-sink"
          onClick={() => {
            // Primero desbloquear, dentro del gesto y sin await por delante.
            engine?.unlockSync();
            haptic(recording ? [18, 40, 18] : 22);
            void (recording ? stop() : record());
          }}
          aria-label={recording ? 'Parar grabación' : 'Grabar'}
          title={recording ? 'Parar grabación' : 'Grabar'}
          aria-pressed={recording}
          style={{
            width: 78,
            height: 78,
            borderRadius: '50%',
            border: 'none',
            display: 'grid',
            placeItems: 'center',
            background: recording ? T.recSoft : T.raised,
            boxShadow: `inset 0 0 0 2.5px ${T.rec}, ${T.elev1}`,
            cursor: 'pointer',
            touchAction: 'manipulation',
            WebkitTapHighlightColor: 'transparent',
            transition: `background-color 200ms ${T.easeOut}`,
            flexShrink: 0,
          }}
        >
          <span
            style={{
              width: 56,
              height: 56,
              background: T.rec,
              borderRadius: recording ? 14 : 28,
              transform: recording ? 'scale(0.5)' : 'scale(1)',
              transition: `transform 220ms ${T.easeOut}, border-radius 220ms ${T.easeOut}`,
            }}
          />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 8 }}>
          {/* Encender y apagar el click es lo que más se toca, así que va en el
              botón directamente. El tempo se abre desde la cabecera. */}
          <ToolButton
            onClick={toggleMetronome}
            active={settings.metronome}
            title={settings.metronome ? 'Apagar el click' : 'Encender el click'}
          >
            <IconMetronome size={20} color={settings.metronome ? T.text : T.dim} />
          </ToolButton>
          <ToolButton onClick={onOpenRhythm} active={!!grooveId} title={grooveId ? 'Ritmo sonando' : 'Ritmos'}>
            <IconRhythm size={20} color={grooveId ? T.text : T.dim} />
          </ToolButton>
        </div>
      </div>
    </div>
  );
}

/**
 * Botón de herramienta del dock. Apagado: solo el icono, en gris. Encendido:
 * relleno, filo de luz y un punto debajo, como el piloto de un pedal.
 */
function ToolButton({
  children,
  onClick,
  active,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  title: string;
}) {
  return (
    <button
      type="button"
      className="daw-press daw-hover"
      onClick={() => {
        haptic(8);
        onClick();
      }}
      aria-label={title}
      title={title}
      aria-pressed={active}
      style={{
        position: 'relative',
        width: 48,
        height: 48,
        borderRadius: 14,
        border: 'none',
        display: 'grid',
        placeItems: 'center',
        background: active ? T.fillStrong : 'transparent',
        boxShadow: active ? `inset 0 1px 0 ${T.rim}` : 'none',
        cursor: 'pointer',
        touchAction: 'manipulation',
        WebkitTapHighlightColor: 'transparent',
        transition: `background-color 160ms ${T.easeOut}`,
        flexShrink: 0,
      }}
    >
      {children}
      <span
        aria-hidden
        style={{
          position: 'absolute',
          bottom: 5,
          left: '50%',
          width: 4,
          height: 4,
          marginLeft: -2,
          borderRadius: 2,
          background: T.text,
          opacity: active ? 1 : 0,
          transform: active ? 'scale(1)' : 'scale(0.5)',
          transition: `opacity 160ms ${T.easeOut}, transform 160ms ${T.easeOut}`,
        }}
      />
    </button>
  );
}
