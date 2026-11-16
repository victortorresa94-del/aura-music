'use client';

import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { T, haptic } from './theme';

export { T } from './theme';

/**
 * Rótulo pequeño: el nombre de un grupo, una unidad, un estado. En
 * minúscula de frase y en la letra de la interfaz, no en versalitas de
 * máquina de escribir: se lee de un vistazo y no grita.
 */
export const label: CSSProperties = {
  fontFamily: T.fontBody,
  fontSize: 12,
  fontWeight: 500,
  letterSpacing: 0,
  lineHeight: 1.35,
  color: T.dim,
};

/** Números que se leen: cifras de ancho fijo, para que no bailen al cambiar.
 *  En la sans y no en la mono: Geist trae cifras tabulares, y el cero tachado
 *  de Geist Mono, a tamaño de lectura (el 1.1 del compás, los ms), se leía «Ø». */
export const numeric: CSSProperties = {
  fontFamily: T.fontBody,
  fontVariantNumeric: 'tabular-nums',
  letterSpacing: '-0.02em',
};

/** Números dentro de una frase: la misma letra, con cifras de ancho fijo. */
export const tabular: CSSProperties = {
  fontVariantNumeric: 'tabular-nums',
};

/** Texto de ayuda bajo un control. */
export const hintText: CSSProperties = {
  fontFamily: T.fontBody,
  fontSize: 13,
  lineHeight: 1.5,
  fontWeight: 400,
  color: T.dim,
  textWrap: 'pretty',
};

/* -------------------------------------------------------------------------- */
/* Iconos                                                                      */
/* -------------------------------------------------------------------------- */

type IconProps = { size?: number; color?: string };

/* Un solo grosor de trazo para toda la familia: 1,75 sobre 24. */
const W = 1.75;

const svg = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none' as const,
  xmlns: 'http://www.w3.org/2000/svg',
  'aria-hidden': true,
  focusable: false,
});

export const IconPlay = ({ size = 20, color = T.text }: IconProps) => (
  <svg {...svg(size)}>
    <path d="M7.5 5.2v13.6a1 1 0 0 0 1.5.86l11.2-6.8a1 1 0 0 0 0-1.72L9 4.34a1 1 0 0 0-1.5.86z" fill={color} />
  </svg>
);

export const IconStop = ({ size = 20, color = T.text }: IconProps) => (
  <svg {...svg(size)}>
    <rect x="6" y="6" width="12" height="12" rx="2.5" fill={color} />
  </svg>
);

export const IconRewind = ({ size = 20, color = T.text }: IconProps) => (
  <svg {...svg(size)}>
    <path d="M6 5.5v13" stroke={color} strokeWidth={2} strokeLinecap="round" />
    <path d="M18.5 6.3v11.4a.9.9 0 0 1-1.4.74L9.4 13.1a1.3 1.3 0 0 1 0-2.2l7.7-5.34a.9.9 0 0 1 1.4.74z" fill={color} />
  </svg>
);

export const IconMetronome = ({ size = 20, color = T.text }: IconProps) => (
  <svg {...svg(size)}>
    <path d="M9.6 3.5h4.8l3.9 16.2a.6.6 0 0 1-.6.8H6.3a.6.6 0 0 1-.6-.8L9.6 3.5z" stroke={color} strokeWidth={W} strokeLinejoin="round" />
    <path d="M7.6 15.5h8.8" stroke={color} strokeWidth={W} />
    <path d="M12 19.5 17.5 6" stroke={color} strokeWidth={W} strokeLinecap="round" />
  </svg>
);

export const IconSettings = ({ size = 20, color = T.text }: IconProps) => (
  <svg {...svg(size)}>
    <path d="M4 7.5h9M17.5 7.5H20M4 16.5h3.5M12 16.5h8" stroke={color} strokeWidth={W} strokeLinecap="round" />
    <circle cx="15" cy="7.5" r="2.4" stroke={color} strokeWidth={W} />
    <circle cx="9.5" cy="16.5" r="2.4" stroke={color} strokeWidth={W} />
  </svg>
);

export const IconLayers = ({ size = 20, color = T.text }: IconProps) => (
  <svg {...svg(size)}>
    <path d="M12 3 3 7.5 12 12l9-4.5L12 3z" stroke={color} strokeWidth={W} strokeLinejoin="round" />
    <path d="m3 12.5 9 4.5 9-4.5" stroke={color} strokeWidth={W} strokeLinejoin="round" />
  </svg>
);

export const IconTrash = ({ size = 18, color = T.text }: IconProps) => (
  <svg {...svg(size)}>
    <path d="M4 6.5h16M9.5 6.5V4.8c0-.7.5-1.3 1.2-1.3h2.6c.7 0 1.2.6 1.2 1.3v1.7" stroke={color} strokeWidth={W} strokeLinecap="round" />
    <path d="M6.5 6.5 7.4 20c0 .8.7 1.5 1.5 1.5h6.2c.8 0 1.5-.7 1.5-1.5l.9-13.5" stroke={color} strokeWidth={W} strokeLinecap="round" />
  </svg>
);

export const IconCopy = ({ size = 18, color = T.text }: IconProps) => (
  <svg {...svg(size)}>
    <rect x="8.5" y="3.5" width="12" height="12" rx="2" stroke={color} strokeWidth={W} />
    <path d="M15.5 18.5v1a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h1" stroke={color} strokeWidth={W} />
  </svg>
);

export const IconUndo = ({ size = 18, color = T.text }: IconProps) => (
  <svg {...svg(size)}>
    <path d="M4.5 9.5h10.5a4.75 4.75 0 0 1 0 9.5H9" stroke={color} strokeWidth={W} strokeLinecap="round" strokeLinejoin="round" />
    <path d="M8 5.5 4 9.5l4 4" stroke={color} strokeWidth={W} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const IconRepeat = ({ size = 18, color = T.text }: IconProps) => (
  <svg {...svg(size)}>
    <path d="M4 10V8.5a3 3 0 0 1 3-3h11" stroke={color} strokeWidth={W} strokeLinecap="round" />
    <path d="m15 2.5 3.5 3-3.5 3" stroke={color} strokeWidth={W} strokeLinecap="round" strokeLinejoin="round" />
    <path d="M20 14v1.5a3 3 0 0 1-3 3H6" stroke={color} strokeWidth={W} strokeLinecap="round" />
    <path d="m9 21.5-3.5-3 3.5-3" stroke={color} strokeWidth={W} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const IconClose = ({ size = 20, color = T.text }: IconProps) => (
  <svg {...svg(size)}>
    <path d="m6.5 6.5 11 11M17.5 6.5l-11 11" stroke={color} strokeWidth={W} strokeLinecap="round" />
  </svg>
);

export const IconPlus = ({ size = 18, color = T.text }: IconProps) => (
  <svg {...svg(size)}>
    <path d="M12 5v14M5 12h14" stroke={color} strokeWidth={W} strokeLinecap="round" />
  </svg>
);

export const IconMinus = ({ size = 18, color = T.text }: IconProps) => (
  <svg {...svg(size)}>
    <path d="M5 12h14" stroke={color} strokeWidth={W} strokeLinecap="round" />
  </svg>
);

export const IconMore = ({ size = 18, color = T.text }: IconProps) => (
  <svg {...svg(size)}>
    <circle cx="6" cy="12" r="1.6" fill={color} />
    <circle cx="12" cy="12" r="1.6" fill={color} />
    <circle cx="18" cy="12" r="1.6" fill={color} />
  </svg>
);

export const IconChevronRight = ({ size = 14, color = T.text }: IconProps) => (
  <svg {...svg(size)}>
    <path d="m9.5 5.5 6.5 6.5-6.5 6.5" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const IconChevronDown = ({ size = 14, color = T.text }: IconProps) => (
  <svg {...svg(size)}>
    <path d="m5.5 9.5 6.5 6.5 6.5-6.5" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const IconDownload = ({ size = 18, color = T.text }: IconProps) => (
  <svg {...svg(size)}>
    <path d="M12 3v12" stroke={color} strokeWidth={W} strokeLinecap="round" />
    <path d="m7.5 10.5 4.5 4.5 4.5-4.5" stroke={color} strokeWidth={W} strokeLinecap="round" strokeLinejoin="round" />
    <path d="M4 19.5h16" stroke={color} strokeWidth={W} strokeLinecap="round" />
  </svg>
);

/** Meter un fichero: la flecha entra en la bandeja. */
export const IconImport = ({ size = 18, color = T.text }: IconProps) => (
  <svg {...svg(size)}>
    <path d="M12 3.5v10" stroke={color} strokeWidth={W} strokeLinecap="round" />
    <path d="m8 9.5 4 4 4-4" stroke={color} strokeWidth={W} strokeLinecap="round" strokeLinejoin="round" />
    <path d="M4 14.5v3a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3v-3" stroke={color} strokeWidth={W} strokeLinecap="round" />
  </svg>
);

export const IconVolume = ({ size = 18, color = T.text }: IconProps) => (
  <svg {...svg(size)}>
    <path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4z" stroke={color} strokeWidth={W} strokeLinejoin="round" />
    <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" stroke={color} strokeWidth={W} strokeLinecap="round" />
  </svg>
);

export const IconSun = ({ size = 18, color = T.text }: IconProps) => (
  <svg {...svg(size)}>
    <circle cx="12" cy="12" r="4.2" stroke={color} strokeWidth={W} />
    <path
      d="M12 2.6v2.1M12 19.3v2.1M21.4 12h-2.1M4.7 12H2.6M18.6 5.4l-1.5 1.5M6.9 17.1l-1.5 1.5M18.6 18.6l-1.5-1.5M6.9 6.9 5.4 5.4"
      stroke={color}
      strokeWidth={W}
      strokeLinecap="round"
    />
  </svg>
);

export const IconMoon = ({ size = 18, color = T.text }: IconProps) => (
  <svg {...svg(size)}>
    <path d="M20 14.2A8.2 8.2 0 0 1 9.8 4a8.4 8.4 0 1 0 10.2 10.2z" stroke={color} strokeWidth={W} strokeLinejoin="round" />
  </svg>
);

export const IconMic = ({ size = 18, color = T.text }: IconProps) => (
  <svg {...svg(size)}>
    <rect x="9" y="2.8" width="6" height="11.4" rx="3" stroke={color} strokeWidth={W} />
    <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3.2" stroke={color} strokeWidth={W} strokeLinecap="round" />
  </svg>
);

export const IconRhythm = ({ size = 18, color = T.text }: IconProps) => (
  <svg {...svg(size)}>
    {/* Un parche de caja visto de lado, con las dos baquetas: es «ritmo»
        sin confundirse con la nota musical genérica de cualquier app. */}
    <ellipse cx="12" cy="14.5" rx="7.5" ry="2.6" stroke={color} strokeWidth={W} />
    <path d="M4.5 14.5v3.2c0 1.4 3.4 2.6 7.5 2.6s7.5-1.2 7.5-2.6v-3.2" stroke={color} strokeWidth={W} />
    <path d="m8 3.5 3 9M16.5 3.5l-3 9" stroke={color} strokeWidth={W} strokeLinecap="round" />
  </svg>
);

/** El productor: una chispa grande y una pequeña. Es Aura, no un «asistente». */
export const IconSpark = ({ size = 20, color = T.text }: IconProps) => (
  <svg {...svg(size)}>
    <path
      d="M10 3.5c.5 3.6 2.4 5.5 6 6-3.6.5-5.5 2.4-6 6-.5-3.6-2.4-5.5-6-6 3.6-.5 5.5-2.4 6-6Z"
      stroke={color}
      strokeWidth={W}
      strokeLinejoin="round"
    />
    <path d="M18 14.5c.2 1.5 1 2.3 2.5 2.5-1.5.2-2.3 1-2.5 2.5-.2-1.5-1-2.3-2.5-2.5 1.5-.2 2.3-1 2.5-2.5Z" fill={color} />
  </svg>
);

export const IconSend = ({ size = 18, color = T.text }: IconProps) => (
  <svg {...svg(size)}>
    <path d="M12 19V5M6 11l6-6 6 6" stroke={color} strokeWidth={W} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const IconWave = ({ size = 18, color = T.text }: IconProps) => (
  <svg {...svg(size)}>
    <path d="M3 12h2.5M8 6v12M12 3v18M16 8v8M20 11h1" stroke={color} strokeWidth={W} strokeLinecap="round" />
  </svg>
);

/* -------------------------------------------------------------------------- */
/* Controles                                                                   */
/* -------------------------------------------------------------------------- */

const reset: CSSProperties = {
  touchAction: 'manipulation',
  WebkitTapHighlightColor: 'transparent',
  border: 'none',
  margin: 0,
  font: 'inherit',
  color: 'inherit',
};

/**
 * Botón de icono. Fantasma por defecto (sin caja: el icono es el botón) y con
 * un relleno de verdad cuando está encendido, para que un interruptor se lea
 * encendido desde un metro sin tener que adivinarlo por un borde.
 */
export function IconButton({
  children,
  onClick,
  active,
  disabled,
  size = 44,
  title,
  style,
  variant = 'ghost',
}: {
  children: ReactNode;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
  size?: number;
  title?: string;
  style?: CSSProperties;
  /** ghost: sin fondo hasta que está encendido · filled: siempre con relleno. */
  variant?: 'ghost' | 'filled';
}) {
  return (
    <button
      type="button"
      className="daw-press daw-hover"
      onClick={() => {
        if (disabled) return;
        haptic(8);
        onClick?.();
      }}
      disabled={disabled}
      aria-label={title}
      title={title}
      aria-pressed={active}
      style={{
        ...reset,
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: Math.round(size * 0.3),
        background: active ? T.fillStrong : variant === 'filled' ? T.fill : 'transparent',
        boxShadow: active || variant === 'filled' ? `inset 0 1px 0 ${T.rim}` : 'none',
        color: T.text,
        opacity: disabled ? 0.35 : 1,
        cursor: disabled ? 'default' : 'pointer',
        flexShrink: 0,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export function TextButton({
  children,
  onClick,
  tone = 'default',
  disabled,
  full,
}: {
  children: ReactNode;
  onClick?: () => void;
  /** default: relleno neutro · solid: el principal · danger: borrar · ai: lo que hará la máquina. */
  tone?: 'default' | 'solid' | 'danger' | 'ai';
  disabled?: boolean;
  full?: boolean;
}) {
  const palette =
    tone === 'solid'
      ? { bg: T.text, color: T.inverse, shadow: T.elev1 }
      : tone === 'danger'
        ? // Borrar no va en rojo: en este estudio el rojo solo significa
          // «grabando». Lo que protege es la confirmación, no el color.
          { bg: T.fill, color: T.text, shadow: `inset 0 0 0 1px ${T.borderStrong}` }
        : tone === 'ai'
          ? { bg: T.ai, color: T.inverse, shadow: T.elev1 }
          : { bg: T.fill, color: T.text, shadow: `inset 0 1px 0 ${T.rim}` };

  return (
    <button
      type="button"
      className="daw-press daw-hover"
      onClick={() => {
        if (disabled) return;
        haptic(8);
        onClick?.();
      }}
      disabled={disabled}
      style={{
        ...reset,
        width: full ? '100%' : undefined,
        minHeight: 48,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: '0 18px',
        borderRadius: 12,
        background: palette.bg,
        boxShadow: palette.shadow,
        color: palette.color,
        fontFamily: T.fontBody,
        fontSize: 15,
        fontWeight: 500,
        letterSpacing: '-0.01em',
        whiteSpace: 'nowrap',
        opacity: disabled ? 0.4 : 1,
        cursor: disabled ? 'default' : 'pointer',
      }}
    >
      {children}
    </button>
  );
}

/**
 * Control segmentado: varias opciones excluyentes, una elegida. Es el control
 * que ya conoce cualquiera que use un iPhone; la elegida sube un nivel (fondo
 * propio, filo de luz y sombra) en vez de cambiar de color.
 */
export function Segmented<V extends string | number>({
  value,
  options,
  onChange,
  ariaLabel,
  mono,
}: {
  value: V;
  options: { value: V; text: string }[];
  onChange: (value: V) => void;
  ariaLabel: string;
  /** Opciones numéricas (×2, 1 compás…): en mono para que se alineen. */
  mono?: boolean;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      style={{
        display: 'flex',
        gap: 2,
        padding: 3,
        borderRadius: 12,
        background: T.fill,
      }}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={String(option.value)}
            type="button"
            role="radio"
            aria-checked={selected}
            className="daw-press"
            onClick={() => {
              haptic(8);
              onChange(option.value);
            }}
            style={{
              ...reset,
              flex: 1,
              minWidth: 0,
              minHeight: 40,
              padding: '0 8px',
              borderRadius: 9,
              background: selected ? T.thumb : 'transparent',
              boxShadow: selected ? T.elev1 : 'none',
              color: selected ? T.text : T.dim,
              fontFamily: mono ? T.fontMono : T.fontBody,
              fontVariantNumeric: 'tabular-nums',
              fontSize: mono ? 13 : 14,
              fontWeight: 500,
              whiteSpace: 'nowrap',
              cursor: 'pointer',
              transition: `background-color 160ms ${T.easeOut}, color 160ms ${T.easeOut}, box-shadow 160ms ${T.easeOut}`,
            }}
          >
            {option.text}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Interruptor con su explicación. Para lo que es sí o no (metrónomo, rejilla,
 * cancelación de eco), un interruptor dice el estado sin leer; un botón que
 * cambia de texto («Encendido» / «Apagado») obliga a pararse a pensar si el
 * texto es lo que hay o lo que va a pasar.
 */
export function Toggle({
  checked,
  onChange,
  title,
  detail,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  title: string;
  detail?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className="daw-press"
      onClick={() => {
        haptic(8);
        onChange(!checked);
      }}
      style={{
        ...reset,
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        width: '100%',
        minHeight: 56,
        padding: '12px 14px 12px 16px',
        borderRadius: 12,
        background: T.fill,
        boxShadow: `inset 0 1px 0 ${T.rim}`,
        textAlign: 'left',
        cursor: 'pointer',
      }}
    >
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontFamily: T.fontBody, fontSize: 15, fontWeight: 500, color: T.text, letterSpacing: '-0.01em' }}>
          {title}
        </span>
        {detail ? (
          <span style={{ ...hintText, display: 'block', marginTop: 2, fontSize: 13 }}>{detail}</span>
        ) : null}
      </span>
      <span
        aria-hidden
        style={{
          position: 'relative',
          width: 46,
          height: 28,
          borderRadius: 14,
          flexShrink: 0,
          background: checked ? T.text : T.fillStrong,
          transition: `background-color 200ms ${T.easeOut}`,
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 3,
            left: 3,
            width: 22,
            height: 22,
            borderRadius: '50%',
            background: checked ? T.inverse : T.knob,
            boxShadow: T.knobShadow,
            transform: checked ? 'translateX(18px)' : 'translateX(0)',
            transition: `transform 200ms ${T.easeOut}, background-color 200ms ${T.easeOut}`,
          }}
        />
      </span>
    </button>
  );
}

export function Slider({
  value,
  min,
  max,
  step = 1,
  onChange,
  onCommit,
  ariaLabel,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  onCommit?: () => void;
  ariaLabel: string;
}) {
  // El tramo recorrido se pinta con una variable CSS: la pista nativa del
  // deslizador no sabe pintar «hasta aquí» sin ayuda.
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;
  return (
    <input
      type="range"
      className="daw-slider"
      aria-label={ariaLabel}
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(event) => onChange(Number(event.target.value))}
      onPointerUp={onCommit}
      onKeyUp={onCommit}
      style={{ width: '100%', ['--p' as string]: `${Math.max(0, Math.min(100, pct))}%` } as CSSProperties}
    />
  );
}

/**
 * Hoja que sube desde abajo. La única superficie a la altura 3: la más clara
 * en oscuro, con velo detrás. Entra con la curva de los cajones de iOS y en
 * el ordenador no se estira a 1440 px: se queda en una columna legible.
 */
export function Sheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);

  // Escape cierra, y el foco entra en el panel al abrirse: con teclado no
  // tiene que hacer falta buscar dónde ha ido a parar.
  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus({ preventScroll: true });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  return (
    <div
      aria-hidden={!open}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        pointerEvents: open ? 'auto' : 'none',
        // Oculto de verdad: si no, los botones del panel cerrado siguen
        // siendo alcanzables con el teclado.
        visibility: open ? 'visible' : 'hidden',
        transition: open ? 'none' : 'visibility 0s linear 260ms',
      }}
    >
      <div
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          background: T.scrim,
          opacity: open ? 1 : 0,
          transition: `opacity ${open ? 240 : 200}ms ${T.easeOut}`,
        }}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal={open}
        aria-label={title}
        tabIndex={-1}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          marginInline: 'auto',
          maxWidth: 560,
          maxHeight: 'calc(92dvh - env(safe-area-inset-top))',
          overflowY: 'auto',
          overscrollBehavior: 'contain',
          outline: 'none',
          background: T.sheet,
          borderRadius: '20px 20px 0 0',
          transform: open ? 'translateY(0)' : 'translateY(100%)',
          transition: `transform ${open ? 320 : 240}ms ${T.easeDrawer}`,
          paddingBottom: 'calc(24px + env(safe-area-inset-bottom))',
          boxShadow: T.elev3,
        }}
      >
        <div
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            minHeight: 60,
            padding: '14px 10px 6px 20px',
            background: T.sheet,
            borderRadius: '20px 20px 0 0',
            // Lo que pasa por debajo al desplazar se corta contra una línea, no contra el aire.
            boxShadow: `0 1px 0 ${T.rowLine}`,
          }}
        >
          <span
            aria-hidden
            style={{
              position: 'absolute',
              top: 7,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 36,
              height: 5,
              borderRadius: 3,
              background: T.borderStrong,
            }}
          />
          <h2
            style={{
              fontFamily: T.fontBody,
              fontSize: 19,
              fontWeight: 600,
              letterSpacing: '-0.02em',
              lineHeight: 1.2,
              color: T.text,
            }}
          >
            {title}
          </h2>
          <IconButton onClick={onClose} size={44} title="Cerrar" variant="filled" style={{ borderRadius: 22, width: 36, height: 36, margin: 4 }}>
            <IconClose size={18} color={T.dim} />
          </IconButton>
        </div>
        <div style={{ padding: '12px 20px 8px' }}>{children}</div>
      </div>
    </div>
  );
}

export function Field({
  title,
  hint,
  intro,
  children,
}: {
  title: string;
  hint?: string;
  /** Explicación que va ANTES de los controles, cuando hace falta contexto. */
  intro?: string;
  children: ReactNode;
}) {
  return (
    <section style={{ marginBottom: 32 }}>
      <h3
        style={{
          fontFamily: T.fontBody,
          fontSize: 13,
          fontWeight: 600,
          letterSpacing: '-0.005em',
          lineHeight: 1.3,
          color: T.text,
          marginBottom: intro ? 6 : 12,
        }}
      >
        {title}
      </h3>
      {intro ? <p style={{ ...hintText, marginBottom: 14 }}>{intro}</p> : null}
      {children}
      {hint ? <p style={{ ...hintText, marginTop: 10 }}>{hint}</p> : null}
    </section>
  );
}

/** Un dato grande con su unidad: «96 BPM», «40 ms». Mono y de ancho fijo. */
export function Readout({ value, unit, size = 34 }: { value: ReactNode; unit?: string; size?: number }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6 }}>
      <span style={{ ...numeric, fontSize: size, fontWeight: 500, lineHeight: 1, color: T.text, letterSpacing: '-0.06em' }}>
        {value}
      </span>
      {unit ? <span style={{ ...label, fontSize: 13 }}>{unit}</span> : null}
    </span>
  );
}
