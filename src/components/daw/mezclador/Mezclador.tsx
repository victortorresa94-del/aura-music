'use client';

/**
 * El mezclador, a pantalla completa.
 *
 * Una tira por pista que se desliza de lado (en un móvil caben tres y media:
 * la media es la pista que asoma y dice que hay más) y la tira del master
 * fija a la derecha, siempre a la vista. Abajo, lo que hace falta para
 * mezclar sin salir: reproducir y parar, y masterizar de un toque.
 *
 * Se monta solo mientras está abierto (y lo que tarda en irse): con el
 * mezclador cerrado no hay tiras que redibujar ni medidores leyendo audio.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Studio } from '@/hooks/useStudio';
import type { Mezcla } from '@/hooks/useMezcla';
import { pistasQueSuenan } from '@/lib/daw/mezcla/grafo';
import { masterDe } from '@/lib/daw/mezcla/tipos';
import { haptic, T } from '../theme';
import { IconButton, IconClose, IconPlay, IconRewind, IconStop, IconUndo, label } from '../ui';
import { CSS_CONTROLES } from './controles';
import { HojaEfectos, HojaMaster, OBJETIVO_DICHO } from './Hojas';
import { ProveedorDeMedidores } from './Medidores';
import { ANCHO_TIRA, ANCHO_TIRA_ANCHA, TiraDePista, TiraMaster } from './Tiras';

const ENTRA_MS = 300;
const SALE_MS = 220;

const unDecimal = (n: number) =>
  `${n < 0 ? '−' : ''}${Math.abs(n).toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`;

export function Mezclador({
  studio,
  mezcla,
  tema,
  open,
  onClose,
}: {
  studio: Studio;
  mezcla: Mezcla;
  tema: 'dark' | 'light';
  open: boolean;
  onClose: () => void;
}) {
  const [montado, setMontado] = useState(open);
  const [efectosDe, setEfectosDe] = useState<string | null>(null);
  const [hojaEfectos, setHojaEfectos] = useState(false);
  const [hojaMaster, setHojaMaster] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [ancho, setAncho] = useState(ANCHO_TIRA);

  /* Entra con una animación CSS desde el primer fotograma y sale con una
     transición. Antes la entrada esperaba dos requestAnimationFrame para
     cambiar de estado, y con la pestaña en segundo plano el mezclador se
     quedaba invisible pero tocable: un toque a ciegas le daba a Deshacer. */
  if (open && !montado) setMontado(true);
  useEffect(() => {
    if (open) return;
    setHojaEfectos(false);
    setHojaMaster(false);
    const t = window.setTimeout(() => setMontado(false), SALE_MS + 40);
    return () => window.clearTimeout(t);
  }, [open]);
  const visible = open;

  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus({ preventScroll: true });
    const medir = () => setAncho(window.innerWidth >= 760 ? ANCHO_TIRA_ANCHA : ANCHO_TIRA);
    medir();
    window.addEventListener('resize', medir);
    return () => window.removeEventListener('resize', medir);
  }, [open]);

  // Escape cierra el mezclador, pero no si hay una hoja encima: esa se cierra sola.
  useEffect(() => {
    if (!open || hojaEfectos || hojaMaster) return;
    const alPulsar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', alPulsar);
    return () => window.removeEventListener('keydown', alPulsar);
  }, [open, hojaEfectos, hojaMaster, onClose]);

  const { project, transport, engine, play, stop, rewind, undo } = studio;
  const suenan = useMemo(() => pistasQueSuenan(project.tracks), [project.tracks]);
  const master = masterDe(project);
  const sonando = transport !== 'stopped';

  if (!montado) return null;

  const { masterizado, cifrasAlDia } = mezcla;
  const midiendo = masterizado.estado === 'midiendo';
  const objetivo = master.masterizado === 'no' ? null : master.masterizado;
  let titulo = 'Masterizar';
  let detalle = `A ${OBJETIVO_DICHO.plataformas} para plataformas`;
  if (midiendo) {
    titulo = 'Escuchando la mezcla…';
    detalle = 'Tarda unos segundos';
  } else if (objetivo && cifrasAlDia && masterizado.antes && masterizado.despues) {
    titulo = 'Masterizado';
    detalle = `${unDecimal(masterizado.antes.lufs)} → ${unDecimal(masterizado.despues.lufs)} LUFS`;
  } else if (objetivo) {
    titulo = `Masterizado a ${OBJETIVO_DICHO[objetivo]}`;
    detalle = 'Toca para volver a medir';
  } else if (masterizado.estado === 'vacio') {
    detalle = 'No suena nada que medir';
  } else if (masterizado.estado === 'fallo') {
    detalle = 'No he podido medir. Otra vez';
  }
  const hecho = !!objetivo && cifrasAlDia;

  const pistas = project.tracks.length;

  return (
    <ProveedorDeMedidores engine={engine} activo={open}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal={open}
        aria-label="Mezclador"
        tabIndex={-1}
        className="mez-raiz"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 40,
          display: 'flex',
          flexDirection: 'column',
          background: T.bg,
          color: T.text,
          outline: 'none',
          transform: visible ? 'translateY(0)' : 'translateY(24px)',
          opacity: visible ? 1 : 0,
          animation: visible ? `mez-entra ${ENTRA_MS}ms ${T.easeDrawer}` : 'none',
          transition: visible ? 'none' : `transform ${SALE_MS}ms ${T.easeOut}, opacity ${SALE_MS}ms ${T.easeOut}`,
          pointerEvents: open ? 'auto' : 'none',
        }}
      >
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '6px 8px 6px 16px',
            paddingTop: 'max(6px, env(safe-area-inset-top))',
            background: T.surface,
            boxShadow: `inset 0 -1px 0 ${T.border}`,
            flexShrink: 0,
          }}
        >
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2, minHeight: 48, justifyContent: 'center' }}>
            <h2 style={{ fontFamily: T.fontBody, fontSize: 19, fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.2 }}>Mezclador</h2>
            <span style={{ ...label, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {pistas === 0 ? 'Sin pistas' : `${pistas} ${pistas === 1 ? 'pista' : 'pistas'}`} · {project.name}
            </span>
          </div>
          <IconButton title="Deshacer" onClick={undo}>
            <IconUndo size={20} color={T.text} />
          </IconButton>
          <IconButton title="Cerrar el mezclador" onClick={onClose} variant="filled" style={{ borderRadius: 22, width: 40, height: 40, margin: 2 }}>
            <IconClose size={18} color={T.dim} />
          </IconButton>
        </header>

        <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
          <div
            className="mez-carril"
            style={{
              flex: 1,
              minWidth: 0,
              display: 'flex',
              overflowX: 'auto',
              overflowY: 'hidden',
              overscrollBehaviorX: 'contain',
              scrollSnapType: 'x proximity',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            {project.tracks.map((track, indice) => (
              <TiraDePista
                key={track.id}
                studio={studio}
                mezcla={mezcla}
                track={track}
                indice={indice}
                tema={tema}
                ancho={ancho}
                suena={suenan.has(track.id)}
                onEfectos={() => {
                  setEfectosDe(track.id);
                  setHojaEfectos(true);
                }}
              />
            ))}
            {pistas === 0 ? (
              <div style={{ padding: '28px 20px', maxWidth: 320 }}>
                <p style={{ fontFamily: T.fontBody, fontSize: 17, fontWeight: 600, letterSpacing: '-0.02em', color: T.text, marginBottom: 8 }}>
                  Todavía no hay nada que mezclar.
                </p>
                <p style={{ fontFamily: T.fontBody, fontSize: 14, lineHeight: 1.5, color: T.dim }}>
                  Graba una toma o importa un audio y aquí tendrás su tira, con su volumen, su panorama y sus efectos.
                </p>
              </div>
            ) : null}
          </div>
          {/* El master no se va con el desplazamiento: siempre a mano. */}
          <div style={{ flexShrink: 0, display: 'flex', background: T.surface, boxShadow: `inset 1px 0 0 ${T.border}` }}>
            <TiraMaster studio={studio} mezcla={mezcla} ancho={ancho + 8} onAjustes={() => setHojaMaster(true)} />
          </div>
        </div>

        <footer
          style={{
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '12px 16px',
            paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
            background: T.surface,
            boxShadow: `inset 0 1px 0 ${T.rim}, 0 -1px 0 ${T.border}`,
          }}
        >
          <IconButton title="Al principio" onClick={rewind}>
            <IconRewind size={19} color={T.text} />
          </IconButton>
          <button
            type="button"
            className="daw-press daw-sink"
            onClick={() => {
              engine?.unlockSync();
              haptic(10);
              void (sonando ? stop() : play());
            }}
            aria-label={sonando ? 'Parar' : 'Reproducir'}
            title={sonando ? 'Parar' : 'Reproducir'}
            style={{
              width: 52,
              height: 52,
              flexShrink: 0,
              borderRadius: '50%',
              border: 'none',
              display: 'grid',
              placeItems: 'center',
              background: sonando ? T.fillStrong : T.raised,
              boxShadow: T.elev1,
              cursor: 'pointer',
              touchAction: 'manipulation',
            }}
          >
            {sonando ? (
              <IconStop size={20} />
            ) : (
              <span style={{ display: 'grid', marginLeft: 3 }}>
                <IconPlay size={22} />
              </span>
            )}
          </button>
          {/* Masterizar lo hace la máquina: va en verde, como todo lo que pone Aura. */}
          <button
            type="button"
            className="daw-press daw-sink"
            disabled={midiendo || pistas === 0}
            onClick={() => {
              haptic(10);
              if (hecho) setHojaMaster(true);
              else void mezcla.masterizar();
            }}
            aria-label={`${titulo}${titulo.endsWith('…') ? '' : '.'} ${detalle}`}
            style={{
              flex: 1,
              minWidth: 0,
              minHeight: 52,
              marginLeft: 8,
              padding: '6px 16px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              justifyContent: 'center',
              gap: 2,
              border: 'none',
              borderRadius: 14,
              background: hecho ? T.aiSoft : T.ai,
              boxShadow: hecho ? 'none' : T.elev1,
              color: hecho ? T.ai : T.inverse,
              textAlign: 'left',
              cursor: midiendo || pistas === 0 ? 'default' : 'pointer',
              opacity: pistas === 0 ? 0.45 : 1,
              touchAction: 'manipulation',
              transition: `background-color 200ms ${T.easeOut}, color 200ms ${T.easeOut}`,
            }}
          >
            <span style={{ fontFamily: T.fontBody, fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em', lineHeight: 1.2, maxWidth: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {titulo}
            </span>
            <span
              className={midiendo ? 'daw-blink' : undefined}
              style={{ fontFamily: T.fontBody, fontSize: 12, fontVariantNumeric: 'tabular-nums', lineHeight: 1.2, opacity: 0.85, maxWidth: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
            >
              {detalle}
            </span>
          </button>
        </footer>
      </div>

      <HojaEfectos studio={studio} mezcla={mezcla} trackId={efectosDe} open={open && hojaEfectos} onClose={() => setHojaEfectos(false)} />
      <HojaMaster studio={studio} mezcla={mezcla} open={open && hojaMaster} onClose={() => setHojaMaster(false)} />

      <style>{`
        ${CSS_CONTROLES}
        .mez-raiz .mez-boton { user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; -webkit-tap-highlight-color: transparent; }
        .mez-carril { scrollbar-width: none; }
        @keyframes mez-entra {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: none; }
        }
        @media (prefers-reduced-motion: reduce) {
          .mez-raiz { animation: none !important; transition: opacity 120ms linear !important; transform: none !important; }
        }
      `}</style>
    </ProveedorDeMedidores>
  );
}
