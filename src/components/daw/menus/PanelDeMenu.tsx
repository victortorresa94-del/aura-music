'use client';

/**
 * El panel de un menú: el mismo para la barra del PC y para el menú que sale
 * del nombre de la idea en el móvil. Papel blanco con la sombra de altura 2,
 * filas con icono a la izquierda y el atajo a la derecha, como en cualquier
 * programa de escritorio: aquí lo familiar es lo que hace que se use sin leer.
 *
 * Con teclado: flechas arriba y abajo, Intro, derecha abre un submenú e
 * izquierda lo cierra, Escape cierra. En el PC los submenús salen al lado; en
 * el móvil se despliegan debajo de su fila, que de lado no caben.
 */

import { CaretDown, CaretRight, Check } from '@phosphor-icons/react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { haptic, T } from '../theme';

export type Entrada =
  | {
      tipo: 'item';
      clave: string;
      texto: string;
      icono?: ReactNode;
      atajo?: string | null;
      /** Una segunda línea pequeña: «Guardado hace 3 s». */
      detalle?: string;
      /** Borrar: en rojo, que en este estudio el rojo es grabar y borrar. */
      peligro?: boolean;
      desactivado?: boolean;
      /** Una opción de varias (el tema): lleva la marca a la derecha. */
      marcado?: boolean;
      alElegir: () => void;
    }
  | { tipo: 'sub'; clave: string; texto: string; icono?: ReactNode; desactivado?: boolean; hijos: Entrada[] }
  | { tipo: 'separador'; clave: string };

const elegible = (e: Entrada) => e.tipo !== 'separador' && !e.desactivado;

export function PanelDeMenu({
  entradas,
  etiqueta,
  onCerrar,
  onSalir,
  enLinea = false,
  animar = true,
  style,
}: {
  entradas: Entrada[];
  etiqueta: string;
  /** Se ha elegido algo o se ha pulsado Escape: se cierra todo. */
  onCerrar: (porTeclado: boolean) => void;
  /** Flecha a izquierda o derecha en el primer nivel: la barra pasa al menú de al lado. */
  onSalir?: (direccion: -1 | 1) => void;
  /** Móvil: filas de 44 px y submenús desplegados debajo de su fila. */
  enLinea?: boolean;
  /** Al pasar de un menú a otro de la barra ya abierta no se anima: tiene que ser instantáneo. */
  animar?: boolean;
  style?: CSSProperties;
}) {
  return (
    <Lista
      entradas={entradas}
      etiqueta={etiqueta}
      onCerrar={onCerrar}
      onSalir={onSalir}
      enLinea={enLinea}
      animar={animar}
      nivel={0}
      style={style}
    />
  );
}

function Lista({
  entradas,
  etiqueta,
  onCerrar,
  onSalir,
  onVolver,
  enLinea,
  animar,
  nivel,
  style,
}: {
  entradas: Entrada[];
  etiqueta: string;
  onCerrar: (porTeclado: boolean) => void;
  onSalir?: (direccion: -1 | 1) => void;
  /** En un submenú: flecha izquierda vuelve a la fila que lo abrió. */
  onVolver?: () => void;
  enLinea: boolean;
  animar: boolean;
  nivel: number;
  style?: CSSProperties;
}) {
  const panel = useRef<HTMLDivElement | null>(null);
  const filas = useRef<(HTMLDivElement | null)[]>([]);
  const [activo, setActivo] = useState(() => (nivel > 0 ? entradas.findIndex(elegible) : -1));
  const [subAbierto, setSubAbierto] = useState<number | null>(null);
  const temporizador = useRef<number | null>(null);
  // Un submenú del PC que no cabe a la derecha se abre a la izquierda.
  const [haciaIzquierda, setHaciaIzquierda] = useState(false);

  useLayoutEffect(() => {
    if (enLinea || nivel === 0 || !panel.current) return;
    const caja = panel.current.getBoundingClientRect();
    if (caja.right > window.innerWidth - 8) setHaciaIzquierda(true);
  }, [enLinea, nivel]);

  // El foco entra en el panel al abrirse (o en su primera fila, en un submenú).
  useEffect(() => {
    if (nivel === 0) panel.current?.focus({ preventScroll: true });
  }, [nivel]);

  useEffect(() => {
    if (activo >= 0 && subAbierto === null) filas.current[activo]?.focus({ preventScroll: true });
  }, [activo, subAbierto]);

  useEffect(() => () => {
    if (temporizador.current) window.clearTimeout(temporizador.current);
  }, []);

  const mover = useCallback(
    (paso: 1 | -1, desde = activo) => {
      const n = entradas.length;
      for (let k = 1; k <= n; k++) {
        const i = (((desde + paso * k) % n) + n) % n;
        if (elegible(entradas[i])) {
          setActivo(i);
          return;
        }
      }
    },
    [activo, entradas],
  );

  const elegir = (i: number, porTeclado: boolean) => {
    const e = entradas[i];
    if (!e || !elegible(e)) return;
    if (e.tipo === 'sub') {
      setActivo(i);
      setSubAbierto((actual) => (enLinea && actual === i ? null : i));
      return;
    }
    if (e.tipo === 'item') {
      haptic(6);
      onCerrar(porTeclado);
      e.alElegir();
    }
  };

  const alPulsar = (event: React.KeyboardEvent) => {
    // Las teclas de un submenú son suyas: aquí suben por el DOM, pero no se repiten.
    if ((event.target as HTMLElement).closest('[role="menu"]') !== panel.current) return;
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        mover(1);
        return;
      case 'ArrowUp':
        event.preventDefault();
        mover(-1, activo < 0 ? 0 : activo);
        return;
      case 'Home':
        event.preventDefault();
        mover(1, -1);
        return;
      case 'End':
        event.preventDefault();
        mover(-1, 0);
        return;
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (activo >= 0) elegir(activo, true);
        return;
      case 'ArrowRight': {
        event.preventDefault();
        const e = entradas[activo];
        if (e?.tipo === 'sub' && !e.desactivado) setSubAbierto(activo);
        else onSalir?.(1);
        return;
      }
      case 'ArrowLeft':
        event.preventDefault();
        if (onVolver) onVolver();
        else onSalir?.(-1);
        return;
      case 'Escape':
        event.preventDefault();
        event.stopPropagation();
        if (onVolver) onVolver();
        else onCerrar(true);
        return;
      case 'Tab':
        // Tab no se pasea por las filas: cierra, como en los menús de escritorio.
        onCerrar(false);
        return;
    }
  };

  const alto = enLinea ? 44 : 34;

  return (
    <div
      ref={panel}
      role="menu"
      aria-label={etiqueta}
      tabIndex={-1}
      onKeyDown={alPulsar}
      className={animar && nivel === 0 ? 'daw-menu-entra' : undefined}
      style={{
        ...(nivel > 0 && !enLinea
          ? {
              position: 'absolute',
              top: -6,
              ...(haciaIzquierda ? { right: 'calc(100% + 4px)' } : { left: 'calc(100% + 4px)' }),
            }
          : null),
        minWidth: enLinea ? undefined : nivel > 0 ? 200 : 252,
        padding: enLinea && nivel > 0 ? '2px 0 4px 26px' : 6,
        borderRadius: 12,
        background: enLinea && nivel > 0 ? 'transparent' : T.raised,
        boxShadow: enLinea && nivel > 0 ? 'none' : T.elev2,
        outline: 'none',
        zIndex: nivel + 1,
        ...style,
      }}
    >
      {entradas.map((e, i) => {
        if (e.tipo === 'separador') {
          return <div key={e.clave} role="separator" style={{ height: 1, margin: '6px 8px', background: T.rowLine }} />;
        }
        const encima = i === activo;
        const desactivado = !!e.desactivado;
        const peligro = e.tipo === 'item' && e.peligro;
        const color = peligro ? T.rec : T.text;
        const abiertoAqui = e.tipo === 'sub' && subAbierto === i;
        return (
          <div key={e.clave} style={{ position: 'relative' }}>
            <div
              ref={(nodo) => {
                filas.current[i] = nodo;
              }}
              role={e.tipo === 'item' && e.marcado !== undefined ? 'menuitemradio' : 'menuitem'}
              aria-checked={e.tipo === 'item' && e.marcado !== undefined ? e.marcado : undefined}
              aria-haspopup={e.tipo === 'sub' ? 'menu' : undefined}
              aria-expanded={e.tipo === 'sub' ? abiertoAqui : undefined}
              aria-disabled={desactivado || undefined}
              tabIndex={-1}
              onPointerEnter={(event) => {
                if (event.pointerType !== 'mouse' || desactivado) return;
                setActivo(i);
                if (enLinea) return;
                if (temporizador.current) window.clearTimeout(temporizador.current);
                // Un respiro antes de abrir o cerrar un submenú: cruzar en
                // diagonal hacia él no tiene que cerrarlo.
                temporizador.current = window.setTimeout(() => setSubAbierto(e.tipo === 'sub' ? i : null), 110);
              }}
              onClick={() => elegir(i, false)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                minHeight: alto,
                padding: e.tipo === 'item' && e.detalle ? '6px 10px' : '0 10px',
                borderRadius: 8,
                background: (encima || abiertoAqui) && !desactivado ? T.fill : 'transparent',
                color,
                opacity: desactivado ? 0.4 : 1,
                cursor: desactivado ? 'default' : 'pointer',
                outline: 'none',
                userSelect: 'none',
                WebkitUserSelect: 'none',
                touchAction: 'manipulation',
              }}
            >
              <span aria-hidden style={{ width: 18, display: 'grid', placeItems: 'center', color: peligro ? T.rec : T.dim, flexShrink: 0 }}>
                {e.icono}
              </span>
              <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                <span style={{ fontFamily: T.fontBody, fontSize: enLinea ? 15 : 13.5, fontWeight: 500, letterSpacing: '-0.005em', whiteSpace: 'nowrap', color }}>
                  {e.texto}
                </span>
                {e.tipo === 'item' && e.detalle ? (
                  <span style={{ fontFamily: T.fontBody, fontSize: 12, color: T.faint, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{e.detalle}</span>
                ) : null}
              </span>
              {e.tipo === 'item' && e.marcado ? <Check size={14} weight="bold" color={T.text} aria-hidden /> : null}
              {e.tipo === 'item' && e.atajo && !enLinea ? (
                <span style={{ fontFamily: T.fontBody, fontSize: 12.5, color: T.faint, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', paddingLeft: 16 }}>
                  {e.atajo}
                </span>
              ) : null}
              {e.tipo === 'sub' ? (
                enLinea ? (
                  <CaretDown size={13} color={T.faint} aria-hidden style={{ transform: abiertoAqui ? 'rotate(180deg)' : 'none', transition: `transform 160ms ${T.easeOut}` }} />
                ) : (
                  <CaretRight size={12} color={T.faint} aria-hidden />
                )
              ) : null}
            </div>
            {e.tipo === 'sub' && abiertoAqui ? (
              <Lista
                entradas={e.hijos}
                etiqueta={e.texto}
                onCerrar={onCerrar}
                onVolver={() => {
                  setSubAbierto(null);
                  filas.current[i]?.focus({ preventScroll: true });
                }}
                enLinea={enLinea}
                animar={animar}
                nivel={nivel + 1}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

/** El estilo de entrada de los menús: sale de donde lo has pedido, rápido y sin rebote. */
export const MENU_CSS = `
  @keyframes daw-menu-entra {
    from { opacity: 0; transform: translateY(-4px) scale(.98); }
    to { opacity: 1; transform: none; }
  }
  .daw-menu-entra { animation: daw-menu-entra 150ms cubic-bezier(0.23, 1, 0.32, 1); transform-origin: top left; }
  @media (prefers-reduced-motion: reduce) { .daw-menu-entra { animation: none; } }
`;
