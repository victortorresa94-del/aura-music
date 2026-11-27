'use client';

/**
 * aura Music de bolsillo: la app para quien escucha (plan: docs/PLAN-BOLSILLO.md).
 *
 * Tres sitios abajo (Inicio · Crear · Biblioteca) y nada más en la barra. Encima
 * de la barra, el mini reproductor, el mismo en todas las pantallas. Lo demás
 * (una canción, una playlist, un artista, un paisaje, la cuenta) se abre
 * encima como una pantalla con «‹», y el gesto de atrás del móvil vuelve.
 *
 * Aquí se monta UNA biblioteca, UN reproductor y UNA cuenta, y se reparten por
 * contexto (`useBolsillo`). Las pantallas no montan los suyos.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { House, MusicNotesPlus, Books } from '@phosphor-icons/react';
import { THEME_CSS, T, haptic } from '@/components/daw/theme';
import { useTheme } from '@/hooks/useTheme';
import { useBiblioteca } from '@/hooks/bolsillo/useBiblioteca';
import { useReproductor } from '@/hooks/bolsillo/useReproductor';
import { useCuentaBolsillo } from '@/hooks/bolsillo/useCuentaBolsillo';
import type { Destino, Navegacion, Pestana } from '@/lib/bolsillo/tipos';
import { ContextoBolsillo, type Bolsillo } from './contexto';
import { MiniReproductor } from './reproductor/MiniReproductor';
import { ReproductorGrande } from './reproductor/ReproductorGrande';
import { PantallaInicio } from './pantallas/Inicio';
import { PantallaCrear } from './pantallas/Crear';
import { PantallaBiblioteca } from './pantallas/Biblioteca';
import { PantallaCancion } from './pantallas/Cancion';
import { PantallaPlaylist, PantallaNuevaPlaylist } from './pantallas/Playlist';
import { PantallaArtista, PantallaNuevoArtista } from './pantallas/Artista';
import { PantallaPaisaje } from './pantallas/Paisaje';
import { PantallaCuenta } from './pantallas/Cuenta';

const PESTANAS: { id: Pestana; texto: string; icono: (activa: boolean) => ReactNode }[] = [
  { id: 'inicio', texto: 'Inicio', icono: (a) => <House size={24} weight={a ? 'fill' : 'regular'} /> },
  { id: 'crear', texto: 'Crear', icono: (a) => <MusicNotesPlus size={24} weight={a ? 'fill' : 'regular'} /> },
  { id: 'biblioteca', texto: 'Biblioteca', icono: (a) => <Books size={24} weight={a ? 'fill' : 'regular'} /> },
];

function pantallaDe(destino: Destino): ReactNode {
  switch (destino.tipo) {
    case 'cancion':
      return <PantallaCancion id={destino.id} />;
    case 'playlist':
      return <PantallaPlaylist id={destino.id} />;
    case 'nueva-playlist':
      return <PantallaNuevaPlaylist />;
    case 'artista':
      return <PantallaArtista id={destino.id} />;
    case 'nuevo-artista':
      return <PantallaNuevoArtista />;
    case 'paisaje':
      return <PantallaPaisaje cancionId={destino.cancionId} />;
    case 'cuenta':
      return <PantallaCuenta />;
  }
}

export default function BolsilloApp() {
  const tema = useTheme();
  const biblioteca = useBiblioteca();
  const reproductor = useReproductor(biblioteca);
  const cuenta = useCuentaBolsillo();
  const [pestana, setPestana] = useState<Pestana>('inicio');
  const [pila, setPila] = useState<Destino[]>([]);
  const [grande, setGrande] = useState(false);

  // El gesto de atrás del móvil (y el botón del navegador) cierra lo de encima:
  // primero el reproductor grande, después la pantalla abierta.
  const grandeRef = useRef(false);
  grandeRef.current = grande;
  useEffect(() => {
    const alVolver = () => {
      if (grandeRef.current) setGrande(false);
      else setPila((p) => p.slice(0, -1));
    };
    window.addEventListener('popstate', alVolver);
    return () => window.removeEventListener('popstate', alVolver);
  }, []);

  const ir = useCallback((destino: Destino) => {
    window.history.pushState({ bolsillo: true }, '');
    setPila((p) => [...p, destino]);
  }, []);
  const atras = useCallback(() => {
    window.history.back();
  }, []);
  const cambiarPestana = useCallback((p: Pestana) => {
    setPestana(p);
    setPila([]);
  }, []);

  const nav = useMemo<Navegacion>(() => ({ ir, atras, pestana: cambiarPestana }), [ir, atras, cambiarPestana]);
  const valor = useMemo<Bolsillo>(() => ({ biblioteca, reproductor, cuenta, nav }), [biblioteca, reproductor, cuenta, nav]);

  const encima = pila[pila.length - 1];

  return (
    <ContextoBolsillo.Provider value={valor}>
      <div
        className="daw-root bolsillo"
        data-tema={tema.resolved}
        style={{ position: 'fixed', inset: 0, background: T.bg, color: T.text, fontFamily: T.fontBody, display: 'flex', flexDirection: 'column' }}
      >
        <main
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            overscrollBehavior: 'contain',
            paddingTop: 'env(safe-area-inset-top)',
          }}
        >
          <div style={{ maxWidth: 640, margin: '0 auto', padding: '8px 16px 24px' }}>
            {encima ? (
              <div key={pila.length} className="daw-land">
                {pantallaDe(encima)}
              </div>
            ) : pestana === 'inicio' ? (
              <PantallaInicio />
            ) : pestana === 'crear' ? (
              <PantallaCrear />
            ) : (
              <PantallaBiblioteca />
            )}
          </div>
        </main>

        <div style={{ flexShrink: 0, background: T.bg, boxShadow: `0 -1px 0 ${T.rowLine}` }}>
          <div style={{ maxWidth: 640, margin: '0 auto', padding: '8px 12px 0' }}>
            <MiniReproductor
              onAbrir={() => {
                window.history.pushState({ bolsillo: true }, '');
                setGrande(true);
              }}
            />
          </div>
          <nav
            aria-label="Secciones"
            style={{
              maxWidth: 640,
              margin: '0 auto',
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              paddingBottom: 'max(env(safe-area-inset-bottom), 6px)',
            }}
          >
            {PESTANAS.map((p) => {
              const activa = pestana === p.id && !encima;
              return (
                <button
                  key={p.id}
                  type="button"
                  className="daw-press"
                  aria-current={activa ? 'page' : undefined}
                  onClick={() => {
                    haptic(6);
                    cambiarPestana(p.id);
                  }}
                  style={{
                    appearance: 'none',
                    border: 'none',
                    background: 'none',
                    padding: '8px 0 4px',
                    minHeight: 56,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 3,
                    color: activa ? T.text : T.faint,
                    cursor: 'pointer',
                  }}
                >
                  {p.icono(activa)}
                  <span style={{ fontSize: 11, fontWeight: activa ? 650 : 500 }}>{p.texto}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <ReproductorGrande abierto={grande} onCerrar={() => window.history.back()} />
      </div>

      <style>{`
        ${THEME_CSS}
        html, body { overscroll-behavior: none; height: 100%; background: var(--daw-bg); margin: 0; }
        .daw-root, .daw-root *, .daw-root *::before, .daw-root *::after { box-sizing: border-box; }
        .daw-root h1, .daw-root h2, .daw-root h3, .daw-root p, .daw-root ol, .daw-root ul { margin: 0; }
        .daw-root { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; text-rendering: optimizeLegibility; }
        .daw-root button, .daw-root input, .daw-root select, .daw-root textarea { font-family: inherit; color: inherit; }
        button, a, input, select, textarea { touch-action: manipulation; -webkit-tap-highlight-color: transparent; }
        .daw-root input, .daw-root textarea { font-size: 16px; }
        .daw-root input::placeholder, .daw-root textarea::placeholder { color: ${T.faint}; }
        .daw-root :focus { outline: none; }
        .daw-root :focus-visible { outline: 2px solid ${T.focus}; outline-offset: 2px; }
        .daw-slider { -webkit-appearance: none; appearance: none; height: 32px; margin: 0; background: transparent; touch-action: none; cursor: pointer; width: 100%; }
        .daw-slider::-webkit-slider-runnable-track { height: 4px; border-radius: 2px; background: linear-gradient(to right, ${T.text} 0 var(--p, 0%), ${T.fillStrong} var(--p, 0%) 100%); }
        .daw-slider::-moz-range-track { height: 4px; border-radius: 2px; background: ${T.fillStrong}; }
        .daw-slider::-moz-range-progress { height: 4px; border-radius: 2px; background: ${T.text}; }
        .daw-slider::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 22px; height: 22px; margin-top: -9px; border-radius: 50%; background: ${T.knob}; border: none; box-shadow: ${T.knobShadow}; }
        .daw-slider::-moz-range-thumb { width: 22px; height: 22px; border-radius: 50%; border: none; background: ${T.knob}; box-shadow: ${T.knobShadow}; }
        @keyframes daw-land { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
        @keyframes daw-blink { 0%, 100% { opacity: 1 } 50% { opacity: .35 } }
        .daw-land { animation: daw-land 240ms ${T.easeOut}; }
        .daw-blink { animation: daw-blink 1.2s ease-in-out infinite; }
        .daw-press { transition: transform 160ms ${T.easeOut}, background-color 160ms ${T.easeOut}, box-shadow 160ms ${T.easeOut}, opacity 160ms ${T.easeOut}; }
        .daw-press:active:not(:disabled) { transform: scale(0.97); }
        .daw-sink:active:not(:disabled) { transform: translateY(1px) scale(0.965); filter: brightness(0.92); }
        @media (hover: hover) and (pointer: fine) {
          .daw-hover:hover:not(:disabled) { background-image: linear-gradient(${T.fill}, ${T.fill}) !important; }
        }
        @media (prefers-reduced-motion: reduce) {
          .daw-land, .daw-blink { animation: none !important; }
          .daw-press:active:not(:disabled), .daw-sink:active:not(:disabled) { transform: none; }
          .daw-root *, .daw-root *::before, .daw-root *::after { transition-duration: .01ms !important; }
        }
        ::-webkit-scrollbar { width: 0; height: 0; }
      `}</style>
    </ContextoBolsillo.Provider>
  );
}
