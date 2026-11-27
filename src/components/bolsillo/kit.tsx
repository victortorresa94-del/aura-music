'use client';

/**
 * El kit de pantalla de bolsillo. Todas las pantallas se hacen con estas
 * piezas, para que el reproductor, una fila o un botón se vean igual en todas
 * partes (asiento de Encore del equipo Spotify).
 *
 * Reglas de la casa: estilos en línea con los tokens `T.*`, nunca colores
 * literales en la interfaz; el primario es negro (claro en oscuro); el verde
 * de aura solo es acento (lo que suena, lo que acaba de hacer la máquina);
 * rojo, nunca: aquí no se graba. La portada es la única excepción: es arte,
 * no interfaz, y sale de una semilla.
 */

import type { CSSProperties, ReactNode } from 'react';
import { CaretLeft } from '@phosphor-icons/react';
import { T, haptic } from '@/components/daw/theme';
import { textoCreditos } from '@/lib/bolsillo/precios';
import type { Portada as DatosPortada } from '@/lib/bolsillo/tipos';

const reset: CSSProperties = {
  appearance: 'none',
  border: 'none',
  background: 'none',
  padding: 0,
  margin: 0,
  font: 'inherit',
  color: 'inherit',
  textAlign: 'inherit',
  cursor: 'pointer',
};

/* ── Portada ──────────────────────────────────────────────────────────── */

/** Un generador pequeño y estable: la misma semilla, la misma portada. */
function azar(semilla: number) {
  let s = semilla >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 10000) / 10000;
  };
}

/**
 * Portada generativa: tres manchas de color apagado sobre un fondo que casa.
 * Gratis, instantánea y distinta por canción. Los tonos van apagados (poca
 * saturación) para que la pantalla siga siendo casi monocroma.
 */
export function Portada({ portada, tam = 56, radio, titulo }: { portada: DatosPortada; tam?: number | string; radio?: number; titulo?: string }) {
  const r = radio ?? (typeof tam === 'number' ? Math.max(6, Math.round(tam * 0.12)) : 12);
  if (portada.tipo === 'imagen') {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={portada.url}
        alt={titulo ? `Portada de ${titulo}` : ''}
        style={{ width: tam, height: tam, borderRadius: r, objectFit: 'cover', flexShrink: 0, display: 'block' }}
      />
    );
  }
  const a = azar(portada.semilla);
  const tono = Math.floor(a() * 360);
  const fondo = `hsl(${tono} 18% 86%)`;
  const manchas = [0, 1, 2].map((i) => ({
    x: 15 + a() * 70,
    y: 15 + a() * 70,
    r: 28 + a() * 34,
    color: `hsl(${(tono + 40 * i + Math.floor(a() * 60)) % 360} ${22 + a() * 18}% ${48 + a() * 22}%)`,
  }));
  return (
    <svg
      viewBox="0 0 100 100"
      role={titulo ? 'img' : undefined}
      aria-label={titulo ? `Portada de ${titulo}` : undefined}
      aria-hidden={titulo ? undefined : true}
      style={{ width: tam, height: tam, borderRadius: r, flexShrink: 0, display: 'block' }}
    >
      <defs>
        <filter id={`borroso-${portada.semilla}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="9" />
        </filter>
      </defs>
      <rect width="100" height="100" fill={fondo} />
      <g filter={`url(#borroso-${portada.semilla})`}>
        {manchas.map((m, i) => (
          <circle key={i} cx={m.x} cy={m.y} r={m.r} fill={m.color} opacity={0.85} />
        ))}
      </g>
    </svg>
  );
}

/* ── Botones ──────────────────────────────────────────────────────────── */

/**
 * El principal: negro (claro en oscuro). Si cuesta, el precio va DENTRO del
 * botón: el botón con el precio es el sí.
 */
export function BotonPrincipal({
  children,
  onClick,
  creditos,
  disabled,
  full = true,
}: {
  children: ReactNode;
  onClick?: () => void;
  creditos?: number;
  disabled?: boolean;
  full?: boolean;
}) {
  return (
    <button
      type="button"
      className="daw-press daw-sink"
      disabled={disabled}
      onClick={() => {
        if (disabled) return;
        haptic(10);
        onClick?.();
      }}
      style={{
        ...reset,
        width: full ? '100%' : undefined,
        minHeight: 52,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        padding: '0 20px',
        borderRadius: 14,
        background: T.text,
        color: T.inverse,
        boxShadow: T.elev1,
        fontSize: 16,
        fontWeight: 600,
        letterSpacing: '-0.01em',
        opacity: disabled ? 0.4 : 1,
        cursor: disabled ? 'default' : 'pointer',
      }}
    >
      <span>{children}</span>
      {creditos !== undefined ? (
        <span style={{ fontWeight: 500, opacity: 0.72, fontVariantNumeric: 'tabular-nums' }}>· {textoCreditos(creditos)}</span>
      ) : null}
    </button>
  );
}

/** El secundario: relleno neutro. */
export function BotonSecundario({
  children,
  onClick,
  disabled,
  full,
  creditos,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  full?: boolean;
  creditos?: number;
}) {
  return (
    <button
      type="button"
      className="daw-press daw-hover"
      disabled={disabled}
      onClick={() => {
        if (disabled) return;
        haptic(8);
        onClick?.();
      }}
      style={{
        ...reset,
        width: full ? '100%' : undefined,
        minHeight: 44,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: '0 16px',
        borderRadius: 12,
        background: T.fill,
        boxShadow: `inset 0 1px 0 ${T.rim}`,
        fontSize: 15,
        fontWeight: 500,
        opacity: disabled ? 0.4 : 1,
        cursor: disabled ? 'default' : 'pointer',
      }}
    >
      <span>{children}</span>
      {creditos !== undefined ? <span style={{ color: T.dim, fontVariantNumeric: 'tabular-nums' }}>· {textoCreditos(creditos)}</span> : null}
    </button>
  );
}

/** Un chip: una respuesta de un toque. Elegido = sube (blanco con sombra), no cambia de color. */
export function Chip({
  children,
  elegido,
  onClick,
  disabled,
}: {
  children: ReactNode;
  elegido?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className="daw-press"
      aria-pressed={elegido}
      disabled={disabled}
      onClick={() => {
        if (disabled) return;
        haptic(6);
        onClick?.();
      }}
      style={{
        ...reset,
        minHeight: 40,
        padding: '0 14px',
        borderRadius: 999,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        whiteSpace: 'nowrap',
        fontSize: 15,
        fontWeight: elegido ? 600 : 500,
        background: elegido ? T.raised : T.fill,
        boxShadow: elegido ? `${T.elev1}, inset 0 0 0 1px ${T.borderStrong}` : `inset 0 1px 0 ${T.rim}`,
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {children}
    </button>
  );
}

/** Fila de chips que se desliza de lado si no cabe. */
export function FilaChips({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 8, overflowX: 'auto', overflowY: 'hidden', paddingBottom: 2, scrollbarWidth: 'none' }}>
      {children}
    </div>
  );
}

/* ── Estructura de una pantalla ───────────────────────────────────────── */

/** La cabecera de una pantalla: título grande y, si se puede volver, «‹». */
export function Cabecera({
  titulo,
  subtitulo,
  onAtras,
  acciones,
}: {
  titulo: string;
  subtitulo?: string;
  onAtras?: () => void;
  acciones?: ReactNode;
}) {
  return (
    <header style={{ padding: '12px 0 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
      {onAtras || acciones ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 }}>
          {onAtras ? (
            <button
              type="button"
              className="daw-press"
              onClick={onAtras}
              aria-label="Volver"
              style={{ ...reset, width: 44, height: 44, marginLeft: -10, display: 'grid', placeItems: 'center', borderRadius: 12 }}
            >
              <CaretLeft size={22} weight="bold" color={T.text} />
            </button>
          ) : (
            <span />
          )}
          <div style={{ display: 'flex', gap: 4 }}>{acciones}</div>
        </div>
      ) : null}
      <h1 style={{ fontSize: 28, fontWeight: 650, letterSpacing: '-0.03em', lineHeight: 1.1, color: T.text }}>{titulo}</h1>
      {subtitulo ? <p style={{ fontSize: 15, color: T.dim, lineHeight: 1.4 }}>{subtitulo}</p> : null}
    </header>
  );
}

/** Un bloque con título dentro de una pantalla. */
export function Seccion({ titulo, accion, children }: { titulo: string; accion?: ReactNode; children: ReactNode }) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 24 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
        <h2 style={{ fontSize: 19, fontWeight: 650, letterSpacing: '-0.02em', color: T.text }}>{titulo}</h2>
        {accion}
      </div>
      {children}
    </section>
  );
}

/** Papel: el sitio del trabajo. */
export function Tarjeta({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{ background: T.surface, borderRadius: 16, boxShadow: T.elev1, padding: 16, ...style }}>{children}</div>
  );
}

/** Una fila de lista: portada, título, debajo una línea, y algo a la derecha. */
export function Fila({
  portada,
  titulo,
  linea,
  derecha,
  onClick,
  activa,
}: {
  portada?: DatosPortada;
  titulo: string;
  linea?: string;
  derecha?: ReactNode;
  onClick?: () => void;
  /** Lo que está sonando: el título va en el verde de aura. */
  activa?: boolean;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 64 }}>
      <button
        type="button"
        className="daw-press"
        onClick={onClick}
        style={{ ...reset, flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 12, padding: '6px 0' }}
      >
        {portada ? <Portada portada={portada} tam={52} /> : null}
        <span style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span
            style={{
              fontSize: 16,
              fontWeight: 550,
              color: activa ? T.ai : T.text,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {titulo}
          </span>
          {linea ? (
            <span style={{ fontSize: 14, color: T.dim, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {linea}
            </span>
          ) : null}
        </span>
      </button>
      {derecha}
    </div>
  );
}

/** Lo que se ve cuando no hay nada: una frase y, si hace falta, el siguiente paso. */
export function Vacio({ texto, accion }: { texto: string; accion?: ReactNode }) {
  return (
    <div style={{ padding: '32px 4px', display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'flex-start' }}>
      <p style={{ fontSize: 16, color: T.dim, lineHeight: 1.45, maxWidth: 380 }}>{texto}</p>
      {accion}
    </div>
  );
}

/** Aviso en línea: lo que ha fallado o lo que hay que saber, sin color de alarma. */
export function Aviso({ children }: { children: ReactNode }) {
  return (
    <div
      role="status"
      style={{
        padding: '12px 14px',
        borderRadius: 12,
        background: T.fill,
        boxShadow: `inset 0 0 0 1px ${T.border}`,
        fontSize: 14,
        lineHeight: 1.45,
        color: T.text,
      }}
    >
      {children}
    </div>
  );
}

/** «2:31», «1 h 05 min». */
export function duracionLegible(segundos: number): string {
  const s = Math.max(0, Math.round(segundos));
  if (s >= 3600) {
    const h = Math.floor(s / 3600);
    const m = Math.round((s % 3600) / 60);
    return m ? `${h} h ${String(m).padStart(2, '0')} min` : `${h} h`;
  }
  if (s >= 600) return `${Math.round(s / 60)} min`;
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
