'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useInstrumentos } from '@/hooks/useInstrumentos';
import { useMusico } from '@/hooks/useMusico';
import { useProductor } from '@/hooks/useProductor';
import { useStudio } from '@/hooks/useStudio';
import { usePwa } from '@/hooks/usePwa';
import { AvisosPwa } from '@/components/pwa/AvisosPwa';
import { GuiaInstalarIphone } from '@/components/pwa/GuiaInstalar';
import { getCompas } from '@/lib/daw/rhythm/compases';
import { getGroove } from '@/lib/daw/rhythm/grooves';
import { TocarPantalla } from './instrumentos';
import { MusicoSheet } from './MusicoSheet';
import { ProductorSheet } from './ProductorSheet';
import { useTheme } from '@/hooks/useTheme';
import { SettingsSheet } from './SettingsSheet';
import { THEME_CSS, T, haptic } from './theme';
import { Timeline } from './Timeline';
import { RhythmSheet } from './RhythmSheet';
import { ClickSheet, TrackSheet, TrackStrip } from './TrackPanel';
import { Transport } from './Transport';
import { IconButton, IconChevronDown, IconClose, IconSpark, IconUndo, label, numeric } from './ui';
// Mezcla (pilar A)
import { useMezcla } from '@/hooks/useMezcla';
import { useClaqueta } from '@/hooks/useClaqueta';
import { Mezclador } from './mezclador/Mezclador';
import { IconoMezclador } from './mezclador/icono';

/**
 * Cómo se nombra el ciclo en la cabecera, en lo que ocupa una firma de compás.
 * El doce de la bulería se escribe 12/8 en casi todos los métodos, y la rumba
 * de ocho (3+3+2), 8/8. El lector de pantalla oye los pulsos con todas las letras.
 */
function nombreDelCompas(pulsos: number): { valor: string; dicho: string } {
  if (pulsos === 4) return { valor: '4/4', dicho: '4 por 4' };
  if (pulsos === 3) return { valor: '3/4', dicho: '3 por 4' };
  if (pulsos === 6) return { valor: '6/8', dicho: '6 por 8' };
  return { valor: `${pulsos}/8`, dicho: `${pulsos} pulsos` };
}

export default function StudioApp() {
  const studio = useStudio();
  const theme = useTheme();
  const [pps, setPps] = useState(45);
  const [sheet, setSheet] = useState<null | 'track' | 'click' | 'settings' | 'ritmo' | 'musico' | 'productor'>(null);
  // El ciclo del ritmo que esté puesto: si es una bulería, el bajo «al compás» la sigue.
  const grooveId = studio.grooveId;
  const groove = useMemo(() => (grooveId ? getGroove(grooveId) : null), [grooveId]);
  const ciclo = useMemo(() => {
    if (!groove) return undefined;
    const compas = getCompas(groove.compasId);
    return { pulsos: compas.pulsos, acentos: compas.acentos };
  }, [groove]);
  const musico = useMusico(studio, ciclo);
  const productor = useProductor(studio, musico, ciclo?.pulsos ?? 4, groove?.nombre ?? null);
  // El mezclador: su hook vive siempre (lleva la mezcla al motor, también al
  // deshacer); la pantalla solo se monta al abrirla.
  const mezcla = useMezcla(studio);
  const [mezclador, setMezclador] = useState(false);
  // Pilar B: los instrumentos que se tocan en la pantalla.
  const instrumentos = useInstrumentos(studio, ciclo?.pulsos ?? 4);
  const [tocar, setTocar] = useState(false);
  // Si «Tocar» se abre desde «Poner un loop», entra directamente en «Loops».
  const [tocarEnLoops, setTocarEnLoops] = useState(false);
  const tonoOido = studio.oido?.tonalidad ?? musico.escucha?.tonalidad ?? null;
  const tonalidadSugerida = useMemo(
    () => (tonoOido ? { tonica: tonoOido.tonica, modo: tonoOido.modo } : null),
    [tonoOido],
  );
  const { ready, project, status, busy, transport, setStatus, loadProjectAudio, engine, record, undo } =
    studio;
  const loadedRef = useRef<string | null>(null);
  const autoStartRef = useRef(false);
  /* Se lee en el primer render, no en un efecto: los efectos de los hijos
     corren antes que los del padre, así que la intro habría mirado el flag
     antes de que este componente pudiera ponerlo. */
  const [autoGrabar] = useState(
    () => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('grabar') === '1',
  );

  // El audio de la última idea se carga en cuanto sabemos cuál es.
  useEffect(() => {
    if (!ready) return;
    if (loadedRef.current === project.id) return;
    loadedRef.current = project.id;
    void loadProjectAudio(project);
  }, [ready, project, loadProjectAudio]);

  // Los navegadores no dejan sonar nada hasta que el usuario toca algo, y en
  // iOS el toque solo cuenta al LEVANTAR el dedo, no al apoyarlo.
  useEffect(() => {
    const wake = () => engine?.unlockSync();
    window.addEventListener('pointerup', wake, { once: true });
    window.addEventListener('click', wake, { once: true });
    return () => {
      window.removeEventListener('pointerup', wake);
      window.removeEventListener('click', wake);
    };
  }, [engine]);

  /* Ctrl/Cmd+Z. Antes solo existía como botón: quien viene de cualquier otro
     editor prueba el atajo de teclado sin mirar, y no pasaba nada. Se ignora
     si el foco está en un campo de texto (renombrar la idea, por ejemplo):
     ahí Ctrl+Z tiene que deshacer lo que se está escribiendo, no la última
     acción del proyecto. */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'z' || (!event.metaKey && !event.ctrlKey)) return;
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return;
      event.preventDefault();
      undo();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [undo]);

  /* Atajo del icono de la app: abrir grabando. Se marca la intro como vista
     antes de arrancar, porque si no salía encima de una grabación que ya iba
     en marcha, y su botón "Empezar a grabar" llamaba a `record()` otra vez,
     que con el transporte andando PARA la toma. El estreno de quien acababa
     de instalarse la app era una pista fantasma. */
  useEffect(() => {
    if (!ready || autoStartRef.current || !autoGrabar) return;
    autoStartRef.current = true;
    window.localStorage.setItem('compas:intro', '1');
    const timer = window.setTimeout(() => void record(), 400);
    return () => window.clearTimeout(timer);
  }, [ready, record, autoGrabar]);

  // PWA (pilar E): service worker, versiones nuevas, compartir y espacio.
  const pwa = usePwa(studio);

  useEffect(() => {
    if (!status) return;
    const timer = window.setTimeout(() => setStatus(null), 3800);
    return () => window.clearTimeout(timer);
  }, [status, setStatus]);

  const recording = transport === 'recording' || transport === 'countin';
  const beatsPerBar = ciclo?.pulsos ?? 4;
  // La claqueta: el motor sabe siempre cómo tiene que sonar y dónde va el 1.
  useClaqueta(studio, beatsPerBar);
  const compas = nombreDelCompas(beatsPerBar);
  const pistas = project.tracks.length;

  return (
    <div
      className="daw-root"
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        background: T.bg,
        color: T.text,
        fontFamily: T.fontBody,
        overscrollBehavior: 'none',
        // Va por encima de cualquier cromo fijo de la web que se escape.
        zIndex: 300,
      }}
    >
      {/* Cabecera: manda el proyecto y su estado musical. El padding superior
          respeta la barra de estado y la isla dinámica con la app instalada.
          El zoom ya no tiene botones (se pellizca, o Ctrl + rueda) y el tema
          vive en Ajustes: aquí solo lo que se mira o se toca a menudo. */}
      <header
        style={{
          position: 'relative',
          zIndex: 8,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          padding: '6px 6px 6px 8px',
          paddingTop: 'max(6px, env(safe-area-inset-top))',
          background: T.surface,
          boxShadow: `inset 0 -1px 0 ${T.border}`,
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          className="daw-press daw-hover"
          onClick={() => {
            haptic(8);
            setSheet('settings');
          }}
          aria-label={`${project.name}: proyecto y ajustes`}
          style={{
            flex: 1,
            minWidth: 0,
            minHeight: 48,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'flex-start',
            gap: 2,
            padding: '4px 8px',
            border: 'none',
            borderRadius: 10,
            background: 'transparent',
            textAlign: 'left',
            cursor: 'pointer',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, maxWidth: '100%' }}>
            <span
              style={{
                fontFamily: T.fontBody,
                fontSize: 17,
                fontWeight: 600,
                letterSpacing: '-0.02em',
                lineHeight: 1.2,
                color: T.text,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {project.name}
            </span>
            <IconChevronDown size={12} color={T.dim} />
          </span>
          <span
            style={{
              ...label,
              display: 'block',
              maxWidth: '100%',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {pistas === 0 ? 'Sin pistas' : `${pistas} ${pistas === 1 ? 'pista' : 'pistas'}`}
            {groove ? ` · ${groove.nombre}` : ''}
          </span>
        </button>

        {/* El tempo y el compás, que es lo que la máquina va a seguir. Abre
            el tempo y la claqueta. */}
        <button
          type="button"
          className="daw-press"
          onClick={() => {
            haptic(8);
            setSheet('click');
          }}
          aria-label={`Tempo ${project.bpm} BPM, compás de ${compas.dicho}. Abrir tempo y claqueta`}
          style={{
            minHeight: 48,
            padding: '0 4px',
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <span
            className="daw-hover-target"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              height: 36,
              padding: '0 12px',
              borderRadius: 10,
              background: T.fill,
              boxShadow: `inset 0 1px 0 ${T.rim}`,
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 4 }}>
              <span style={{ ...numeric, fontSize: 16, fontWeight: 500, color: T.text }}>{project.bpm}</span>
              <span style={{ ...label, fontSize: 11, fontWeight: 600 }}>BPM</span>
            </span>
            <span aria-hidden style={{ width: 1, height: 16, background: T.border }} />
            <span style={{ ...numeric, fontSize: 14, color: T.text }}>{compas.valor}</span>
          </span>
        </button>

        {/* El productor: el único verde de la cabecera, porque es Aura. */}
        <IconButton title="Productor" onClick={() => setSheet('productor')}>
          <IconSpark size={21} color={T.ai} />
        </IconButton>
        {/* El mezclador ocupa el sitio del engranaje: los ajustes ya se
            abren tocando el nombre del proyecto (y desde la latencia del
            dock), y en 375 px no cabía un botón más sin dejar el nombre
            en dos letras. */}
        <IconButton title="Mezclador" onClick={() => setMezclador(true)}>
          <IconoMezclador size={21} color={T.text} />
        </IconButton>
        <IconButton title="Deshacer" onClick={undo}>
          <IconUndo size={20} color={T.text} />
        </IconButton>
      </header>

      <main style={{ flex: 1, minHeight: 0, position: 'relative', display: 'flex', flexDirection: 'column' }}>
        <Timeline
          studio={studio}
          mezcla={mezcla}
          pps={pps}
          theme={theme.resolved}
          beatsPerBar={beatsPerBar}
          onZoom={setPps}
          onOpenTrack={() => setSheet('track')}
          onTocar={() => {
            engine?.unlockSync();
            setTocarEnLoops(false);
            setTocar(true);
          }}
          onLoops={() => {
            engine?.unlockSync();
            setTocarEnLoops(true);
            setTocar(true);
          }}
        />

        {/* Lo que flota sobre la línea de tiempo: el aviso. Es el único
            cristal de la pantalla, porque es lo único que pasa por encima de
            algo que se mueve. */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 20,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
            padding: '0 12px 12px',
            pointerEvents: 'none',
          }}
        >
          {status || busy ? (
            <div role="status" className="daw-rise" style={{ width: '100%', maxWidth: 480 }}>
              <Glass radius={14} style={{ padding: '12px 16px', textAlign: 'center' }}>
                <span style={{ fontFamily: T.fontBody, fontSize: 14, lineHeight: 1.45, fontWeight: 500, color: T.text }}>
                  {busy ?? status}
                </span>
              </Glass>
            </div>
          ) : null}
        </div>
      </main>

      {/* El dock: una sola superficie apoyada, con su filo de luz arriba. En
          lo alto, lo que toca ahora: lo que ha oído la app tras una toma (y
          el botón para ponerle algo debajo) o, si no, la pista elegida. Antes
          la barra del oído flotaba sobre la línea de tiempo y tapaba justo la
          toma que acababas de grabar. */}
      <footer
        style={{
          position: 'relative',
          zIndex: 8,
          flexShrink: 0,
          background: T.surface,
          boxShadow: `inset 0 1px 0 ${T.rim}, 0 -1px 0 ${T.border}`,
          padding: '12px 16px',
          paddingBottom: 'max(14px, env(safe-area-inset-bottom))',
        }}
      >
        <div style={{ maxWidth: 1040, margin: '0 auto' }}>
          {studio.oido && (studio.oido.bpm || studio.oido.tonalidad) ? (
            <BarraDelOido
              studio={studio}
              onOpenMusico={(trackId) => {
                studio.setSelectedTrackId(trackId);
                setSheet('musico');
              }}
            />
          ) : (
            <TrackStrip
              studio={studio}
              theme={theme.resolved}
              onOpenTrack={() => setSheet('track')}
              onPonerDebajo={() => setSheet('musico')}
            />
          )}
          <Transport
            studio={studio}
            beatsPerBar={beatsPerBar}
            onOpenClick={() => setSheet('click')}
            onOpenRhythm={() => setSheet('ritmo')}
            onOpenSettings={() => setSheet('settings')}
          />
        </div>
      </footer>

      <RhythmSheet studio={studio} open={sheet === 'ritmo'} onClose={() => setSheet(null)} />
      <TrackSheet
        studio={studio}
        open={sheet === 'track'}
        onClose={() => setSheet(null)}
        onOpenMusico={() => setSheet('musico')}
      />
      <MusicoSheet studio={studio} musico={musico} open={sheet === 'musico'} onClose={() => setSheet(null)} />
      <ProductorSheet
        studio={studio}
        musico={musico}
        productor={productor}
        open={sheet === 'productor'}
        onClose={() => setSheet(null)}
      />
      <ClickSheet studio={studio} open={sheet === 'click'} onClose={() => setSheet(null)} />
      <SettingsSheet
        studio={studio}
        theme={theme}
        open={sheet === 'settings'}
        onClose={() => setSheet(null)}
      />

      <Mezclador
        studio={studio}
        mezcla={mezcla}
        tema={theme.resolved}
        open={mezclador}
        onClose={() => setMezclador(false)}
      />

      <TocarPantalla
        studio={studio}
        instrumentos={instrumentos}
        abierta={tocar}
        onCerrar={() => setTocar(false)}
        tonalidadSugerida={tonalidadSugerida}
        enLoops={tocarEnLoops}
      />

      <FirstRun studio={studio} suprimida={autoGrabar} onRecord={() => void record()} />
      {/* PWA (pilar E): avisos bajo la cabecera y, en iPhone sin instalar, cómo instalarla. */}
      <AvisosPwa studio={studio} pwa={pwa} onAbrirAjustes={() => setSheet('settings')} />
      <GuiaInstalarIphone />

      <style>{`
        ${THEME_CSS}
        html, body { overscroll-behavior: none; overflow: hidden; height: 100%; background: var(--daw-bg); }
        body::before, body::after { display: none !important; }
        .daw-root, .daw-root *, .daw-root *::before, .daw-root *::after { box-sizing: border-box; }
        .daw-root h1, .daw-root h2, .daw-root h3, .daw-root p, .daw-root ol, .daw-root ul { margin: 0; }
        .daw-root {
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          text-rendering: optimizeLegibility;
        }
        .daw-root button, .daw-root input, .daw-root select, .daw-root textarea { font-family: inherit; color: inherit; }
        button, a, input, select { touch-action: manipulation; }
        .daw-root input::placeholder { color: ${T.faint}; }

        /* Foco visible con teclado, nunca con el dedo. Neutro: no hay más acentos. */
        .daw-root :focus { outline: none; }
        .daw-root :focus-visible { outline: 2px solid ${T.focus}; outline-offset: 2px; }
        .daw-root input:focus-visible, .daw-root select:focus-visible { outline-offset: 0; }

        .daw-slider {
          -webkit-appearance: none;
          appearance: none;
          height: 32px;
          margin: 0;
          background: transparent;
          touch-action: none;
          cursor: pointer;
        }
        .daw-slider::-webkit-slider-runnable-track {
          height: 4px; border-radius: 2px;
          background: linear-gradient(to right, ${T.text} 0 var(--p, 0%), ${T.fillStrong} var(--p, 0%) 100%);
        }
        .daw-slider::-moz-range-track { height: 4px; border-radius: 2px; background: ${T.fillStrong}; }
        .daw-slider::-moz-range-progress { height: 4px; border-radius: 2px; background: ${T.text}; }
        .daw-slider::-webkit-slider-thumb {
          -webkit-appearance: none; appearance: none;
          width: 22px; height: 22px; margin-top: -9px;
          border-radius: 50%; background: ${T.knob}; border: none;
          box-shadow: ${T.knobShadow};
          transition: transform 140ms ${T.easeOut};
        }
        .daw-slider:active::-webkit-slider-thumb { transform: scale(1.12); }
        .daw-slider::-moz-range-thumb {
          width: 22px; height: 22px; border-radius: 50%; border: none;
          background: ${T.knob};
          box-shadow: ${T.knobShadow};
        }

        /* Dock del transporte: dos filas en el móvil (lectura arriba,
           botones abajo) y una sola en pantallas anchas. */
        .daw-transport {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr);
          grid-template-areas: "time status" "controls controls";
          column-gap: 24px;
          row-gap: 14px;
          align-items: center;
        }
        .daw-t-time { grid-area: time; }
        .daw-t-status { grid-area: status; }
        .daw-t-controls {
          grid-area: controls;
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
          align-items: center;
          column-gap: 14px;
        }
        @media (min-width: 760px) {
          .daw-transport {
            grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
            grid-template-areas: "time controls status";
          }
          .daw-t-status { justify-self: end; width: min(100%, 300px); }
          .daw-t-controls { column-gap: 18px; }
        }

        /* Separadores de las listas agrupadas (opciones del músico). */
        .daw-opciones > * + * { box-shadow: inset 0 1px 0 ${T.rowLine}; }

        @keyframes daw-blink { 0%, 100% { opacity: 1 } 50% { opacity: .25 } }
        @keyframes daw-land {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: none; }
        }
        @keyframes daw-rise {
          from { opacity: 0; transform: translateY(8px) scale(.985); }
          to { opacity: 1; transform: none; }
        }
        .daw-blink { animation: daw-blink 1.1s ease-in-out infinite; }
        .daw-land { animation: daw-land 260ms ${T.easeOut}; }
        .daw-rise { animation: daw-rise 240ms ${T.easeOut}; }

        /* Lo que se pulsa tiene que notarse al pulsarlo (Emil Kowalski). */
        .daw-press { transition: transform 160ms ${T.easeOut}, background-color 160ms ${T.easeOut}, box-shadow 160ms ${T.easeOut}, opacity 160ms ${T.easeOut}; }
        .daw-press:active:not(:disabled) { transform: scale(0.97); }
        /* Los principales se hunden un poco más y vuelven. */
        .daw-sink:active:not(:disabled) { transform: translateY(1px) scale(0.955); filter: brightness(0.92); }
        @media (hover: hover) {
          .daw-hover:hover:not(:disabled),
          button:hover > .daw-hover-target {
            background-image: linear-gradient(${T.fill}, ${T.fill}) !important;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .daw-blink, .daw-land, .daw-rise { animation: none !important; }
          .daw-press:active:not(:disabled), .daw-sink:active:not(:disabled) { transform: none; }
          .daw-root *, .daw-root *::before, .daw-root *::after { transition-duration: .01ms !important; }
        }
        ::-webkit-scrollbar { width: 0; height: 0; }
      `}</style>

      {recording ? (
        <span
          aria-hidden
          style={{
            position: 'fixed',
            inset: 0,
            pointerEvents: 'none',
            boxShadow: `inset 0 0 0 2px ${T.rec}`,
            opacity: transport === 'countin' ? 0.35 : 0.75,
            transition: `opacity 200ms ${T.easeOut}`,
            zIndex: 50,
          }}
        />
      ) : null}
    </div>
  );
}

/**
 * Cristal. Solo para lo que flota sobre contenido que se mueve (la línea de
 * tiempo, con el cursor corriendo). El desenfoque va en un hijo con su propia
 * capa (translateZ), nunca en un nodo fijo, y no se anima nunca.
 */
function Glass({
  children,
  radius = 16,
  style,
}: {
  children: React.ReactNode;
  radius?: number;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        borderRadius: radius,
        background: T.glass,
        backdropFilter: 'blur(20px) saturate(160%)',
        WebkitBackdropFilter: 'blur(20px) saturate(160%)',
        transform: 'translateZ(0)',
        boxShadow: `${T.elev2}, inset 0 0 0 1px ${T.border}`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/**
 * Lo que la app ha oído en la última toma.
 *
 * Sale sola al soltar el botón, sin que nadie la pida, y es la única vez que
 * la máquina habla primero. Por eso dice solo lo que sabe y se calla lo que
 * no: si el tempo no está claro, no se inventa un número; si la toma no tiene
 * tonalidad (un cajón no la tiene), no se nombra ninguna. Un dato inventado
 * aquí cuesta más que un hueco.
 */
function BarraDelOido({
  studio,
  onOpenMusico,
}: {
  studio: ReturnType<typeof useStudio>;
  onOpenMusico: (trackId: string) => void;
}) {
  const { oido, setOido, project, setBpm } = studio;
  if (!oido || (!oido.bpm && !oido.tonalidad)) return null;

  const tono = oido.tonalidad;
  const nombreTono = tono
    ? tono.flamenco
      ? `${tono.nombre} · ${tono.flamenco}`
      : tono.nombre
    : null;
  const mismoTempo = oido.bpm !== null && Math.abs(project.bpm - oido.bpm) < 1;

  return (
    <section
      aria-label="Lo que he oído"
      className="daw-rise"
      style={{ paddingBottom: 12, marginBottom: 12, boxShadow: `inset 0 -1px 0 ${T.rowLine}` }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ ...label, fontSize: 12 }}>He oído</span>
          <span
            style={{
              fontFamily: T.fontBody,
              fontSize: 15,
              fontWeight: 500,
              letterSpacing: '-0.01em',
              color: T.text,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {oido.bpm ? (
              <span style={{ ...numeric, fontSize: 15 }}>
                {oido.bpm} <span style={{ fontFamily: T.fontBody, fontSize: 12, fontWeight: 600, color: T.dim }}>BPM</span>
              </span>
            ) : null}
            {oido.bpm && nombreTono ? <span style={{ color: T.faint }}> · </span> : null}
            {nombreTono}
          </span>
        </span>
        <IconButton title="Cerrar" size={40} onClick={() => setOido(null)} style={{ marginRight: -4 }}>
          <IconClose size={18} color={T.dim} />
        </IconButton>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        {oido.bpm && !mismoTempo ? (
          <button
            type="button"
            className="daw-press daw-hover"
            onClick={() => {
              haptic(10);
              setBpm(oido.bpm as number);
            }}
            style={{
              minHeight: 44,
              padding: '0 14px',
              borderRadius: 11,
              border: 'none',
              background: T.fill,
              boxShadow: `inset 0 1px 0 ${T.rim}`,
              color: T.text,
              fontFamily: T.fontBody,
              fontSize: 14,
              fontWeight: 500,
              whiteSpace: 'nowrap',
              cursor: 'pointer',
            }}
          >
            Usar este tempo
          </button>
        ) : null}
        {/* Un solo botón: bajo, batería, teclas o lo que toque la IA, todo a
            tu tempo. Va en ámbar porque lo va a tocar la máquina: en este
            estudio ese color siempre significa «generado», nunca adorno. */}
        <button
          type="button"
          className="daw-press daw-sink"
          onClick={() => {
            haptic(10);
            onOpenMusico(oido.trackId);
          }}
          style={{
            flex: 1,
            minHeight: 44,
            padding: '0 16px',
            borderRadius: 11,
            border: 'none',
            background: T.ai,
            boxShadow: T.elev1,
            color: T.inverse,
            fontFamily: T.fontBody,
            fontSize: 15,
            fontWeight: 600,
            letterSpacing: '-0.01em',
            whiteSpace: 'nowrap',
            cursor: 'pointer',
          }}
        >
          Ponle algo debajo
        </button>
      </div>
    </section>
  );
}

/**
 * Primera vez. Tres frases y un botón que graba directamente: el objetivo es
 * que entre abrir la app y estar grabando no haya más de dos toques.
 */
function FirstRun({
  studio,
  suprimida,
  onRecord,
}: {
  studio: ReturnType<typeof useStudio>;
  suprimida: boolean;
  onRecord: () => void;
}) {
  const [visible, setVisible] = useState(false);
  const { project, ready } = studio;

  useEffect(() => {
    if (!ready || suprimida) return;
    const seen = window.localStorage.getItem('compas:intro');
    setVisible(!seen && project.tracks.length === 0);
  }, [ready, suprimida, project.tracks.length]);

  if (!visible) return null;

  const close = (thenRecord: boolean) => {
    window.localStorage.setItem('compas:intro', '1');
    setVisible(false);
    haptic(10);
    if (thenRecord) onRecord();
  };

  const pasos = [
    'Cascos puestos. Sin ellos, la segunda toma se come a la primera.',
    'Calibra la latencia una vez en Ajustes. Eso corrige el desfase.',
    'Botón rojo, toca, para. Cada toma cae en su pista.',
  ];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 90,
        background: T.bg,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        padding: '32px 24px',
        paddingBottom: 'max(32px, env(safe-area-inset-bottom))',
        paddingTop: 'max(32px, env(safe-area-inset-top))',
      }}
    >
      <div style={{ width: '100%', maxWidth: 440, margin: '0 auto' }}>
        <span style={{ ...label, fontSize: 13 }}>Aura Music · tu estudio de bolsillo</span>
        <h2
          style={{
            fontFamily: T.fontBody,
            fontSize: 34,
            fontWeight: 600,
            letterSpacing: '-0.035em',
            lineHeight: 1.08,
            margin: '12px 0 28px',
            color: T.text,
            textWrap: 'balance',
          }}
        >
          Graba la idea antes de que se vaya.
        </h2>
        <ol style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 32 }}>
          {pasos.map((paso, i) => (
            <li key={paso} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <span
                aria-hidden
                style={{
                  ...numeric,
                  width: 26,
                  height: 26,
                  flexShrink: 0,
                  display: 'grid',
                  placeItems: 'center',
                  borderRadius: 8,
                  background: T.fill,
                  boxShadow: `inset 0 1px 0 ${T.rim}`,
                  fontSize: 12,
                  color: T.text,
                }}
              >
                {i + 1}
              </span>
              <span style={{ fontSize: 15, lineHeight: 1.5, color: T.dim, paddingTop: 2 }}>{paso}</span>
            </li>
          ))}
        </ol>
        <button
          type="button"
          className="daw-press daw-sink"
          onClick={() => close(true)}
          style={{
            width: '100%',
            minHeight: 54,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            borderRadius: 14,
            border: 'none',
            background: T.recFill,
            boxShadow: T.elev1,
            color: T.onRec,
            fontFamily: T.fontBody,
            fontSize: 16,
            fontWeight: 600,
            letterSpacing: '-0.01em',
            cursor: 'pointer',
            marginBottom: 10,
          }}
        >
          <span aria-hidden style={{ width: 12, height: 12, borderRadius: '50%', background: T.onRec }} />
          Empezar a grabar
        </button>
        <button
          type="button"
          className="daw-press daw-hover"
          onClick={() => close(false)}
          style={{
            width: '100%',
            minHeight: 52,
            borderRadius: 14,
            border: 'none',
            background: T.fill,
            boxShadow: `inset 0 1px 0 ${T.rim}`,
            color: T.text,
            fontFamily: T.fontBody,
            fontSize: 15,
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          Entrar sin grabar
        </button>
      </div>
    </div>
  );
}
