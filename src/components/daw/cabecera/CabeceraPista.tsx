'use client';

/**
 * La cabecera de una pista en la línea de tiempo: lo que cualquier DAW tiene
 * a la vista sin abrir nada.
 *
 *   PC (columna ancha)          ┌──────────────────────────────┐
 *                               │ ■ Voz                      ⋯ │
 *                               │ [M][S] ━━━━━●━━━━   ━━●━━    │  volumen · panorama
 *                               └──────────────────────────────┘
 *   Móvil (128 px)              ┌──────────────┐
 *                               │ ■ Voz      ⋯ │
 *                               │ [M][S] ━━●━  │  el volumen, más corto
 *                               └──────────────┘
 *
 * En el móvil el fader es corto pero no impreciso: se mueve por arrastre
 * relativo y el recorrido entero son 180 px de dedo, no el ancho del mando.
 * El panorama, que no cabe, sigue en el mezclador.
 *
 * Elegida, la fila entera se ve más opaca (la cabecera y su calle) y el clip
 * lleva el filo de tinta. Sin colores: el color aquí significa algo.
 */

import type { Studio } from '@/hooks/useStudio';
import type { Mezcla } from '@/hooks/useMezcla';
import type { Track } from '@/lib/daw/types';
import { conMezcla, conVolumen } from '@/lib/daw/mezcla/acciones';
import { mezclaDe } from '@/lib/daw/mezcla/tipos';
import { haptic, T } from '../theme';
import { IconMore } from '../ui';
import { PanoramaPista, VolumenPista } from './ControlesPista';

/** Una pista generada lleva el «IA» en la insignia: no hace falta repetirlo en el nombre. */
export function nombreVisible(track: Track): string {
  return track.ia ? track.name.replace(/\s*·\s*IA$/i, '') : track.name;
}

/** La celda fija de la izquierda: se queda quieta al desplazarte en el tiempo. */
export const headerCell = (width: number): React.CSSProperties => ({
  position: 'sticky',
  left: 0,
  zIndex: 5,
  width,
  flexShrink: 0,
  display: 'flex',
  flexDirection: 'column',
  boxShadow: `inset -1px 0 0 ${T.border}`,
});

export const botonPlano: React.CSSProperties = {
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

/** El velo de la fila elegida, sobre el papel de la cabecera. */
export const veloElegida = `linear-gradient(${T.fillStrong}, ${T.fillStrong}), ${T.surface}`;

export function CabeceraPista({
  track,
  tint,
  headerW,
  wide,
  selected,
  callada,
  studio,
  mezcla,
  onSelect,
  onOptions,
}: {
  track: Track;
  tint: string;
  headerW: number;
  /** Columna ancha (PC): cabe el panorama. */
  wide: boolean;
  selected: boolean;
  /** No suena: silenciada, o hay otra pista en solo. */
  callada: boolean;
  studio: Studio;
  /** Sin él, el volumen se guarda por `setVolume` y no sale el panorama. */
  mezcla?: Mezcla;
  onSelect: () => void;
  onOptions: () => void;
}) {
  const { toggleMute, toggleSolo, setVolume, engine } = studio;
  const grupo = (que: string) => `${que}:${track.id}`;

  return (
    <div
      data-cabecera={track.id}
      aria-label={`Pista ${track.name}${selected ? ', elegida' : ''}`}
      style={{
        ...headerCell(headerW),
        background: selected ? veloElegida : T.surface,
        padding: wide ? '7px 8px 7px 12px' : '7px 4px 7px 10px',
        gap: 3,
        cursor: 'default',
        transition: `background-color 160ms ${T.easeOut}`,
      }}
      onPointerDown={onSelect}
      onContextMenu={(event) => {
        event.preventDefault();
        onSelect();
        onOptions();
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, height: 28, minWidth: 0 }}>
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
          <span aria-hidden style={{ width: 10, height: 10, borderRadius: 3, background: tint, flexShrink: 0 }} />
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
        {/* La única puerta a renombrar, colorear, duplicar o borrar una
            pista no puede depender de que alguien adivine que el nombre es
            un botón. Aquí está, a la vista, en todas. */}
        <button
          type="button"
          className="daw-press daw-hover"
          title={`Opciones de ${track.name}`}
          aria-label={`Opciones de ${track.name}`}
          onClick={(event) => {
            event.stopPropagation();
            haptic(8);
            onSelect();
            onOptions();
          }}
          style={{
            ...botonPlano,
            width: 30,
            height: 28,
            borderRadius: 7,
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
          }}
        >
          <IconMore size={18} color={T.dim} />
        </button>
      </div>

      <div style={{ display: 'flex', gap: wide ? 4 : 3, alignItems: 'center', height: 32, minWidth: 0 }}>
        <Pill active={track.muted} onClick={() => toggleMute(track.id)} title={`Silenciar ${track.name} (M)`}>
          M
        </Pill>
        <Pill active={track.soloed} onClick={() => toggleSolo(track.id)} title={`Solo ${track.name} (Mayús+S)`}>
          S
        </Pill>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', marginLeft: wide ? 4 : 2 }}>
          <VolumenPista
            volumen={track.volume}
            etiqueta={`Volumen de ${track.name}`}
            apagado={callada}
            // Se oye al momento; se guarda al soltar, un paso de Deshacer.
            onVivo={(v) => engine?.setTrackVolume(track.id, v, !callada)}
            onSoltar={(v) =>
              mezcla ? mezcla.guardar((p) => conVolumen(p, track.id, v), grupo('volumen')) : setVolume(track.id, v)
            }
          />
        </div>
        {wide && mezcla ? (
          <PanoramaPista
            valor={mezclaDe(track).panorama}
            etiqueta={`Panorama de ${track.name}`}
            onVivo={(v) => mezcla.oir((p) => conMezcla(p, track.id, { panorama: v }))}
            onSoltar={(v) => mezcla.guardar((p) => conMezcla(p, track.id, { panorama: v }), grupo('panorama'))}
            style={{ marginLeft: 4 }}
          />
        ) : null}
      </div>
    </div>
  );
}

/**
 * Mute y solo. Apagado: relleno tenue y letra gris. Encendido: invertido,
 * claro sobre oscuro (u oscuro sobre claro), que se distingue a un metro sin
 * necesitar un color más. La zona que se toca es más alta que la píldora.
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
        width: 28,
        height: 32,
        flexShrink: 0,
        display: 'grid',
        placeItems: 'center',
      }}
    >
      <span
        style={{
          width: '100%',
          height: 24,
          display: 'grid',
          placeItems: 'center',
          borderRadius: 6,
          background: active ? T.text : T.fill,
          boxShadow: active ? 'none' : `inset 0 1px 0 ${T.rim}, inset 0 0 0 1px ${T.border}`,
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
