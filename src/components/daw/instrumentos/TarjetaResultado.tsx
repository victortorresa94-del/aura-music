'use client';

import { useState } from 'react';
import { ArrowUUpLeft, Check } from '@phosphor-icons/react';
import type { Resultado } from '@/hooks/useInstrumentos';
import { haptic, T } from '../theme';
import { Segmented } from '../ui';

type Cuadre = 'tal' | 'cuadrado' | 'todo';
const FUERZA: Record<Cuadre, number | null> = { tal: null, cuadrado: 0.7, todo: 1 };
const cuadreDe = (fuerza: number | null): Cuadre => (fuerza === null ? 'tal' : fuerza >= 0.99 ? 'todo' : 'cuadrado');

/**
 * «¿Ha quedado bien?», en una sola fila, justo después de grabar. Lo tocado
 * ya está guardado como pista; aquí solo se decide cómo se queda: tal cual,
 * cuadrado (al 70 %, la fuerza de siempre) o del todo a la rejilla, o
 * deshacerlo. Cuadrar sale siempre del bruto: nunca se pierde lo tocado.
 *
 * Se monta ENCIMA de la fila de sonidos, con su misma altura: el teclado no
 * se mueve ni un píxel al aparecer o al irse (antes era una tarjeta que lo
 * empujaba hacia abajo). Con sitio (de 480 px en adelante) lleva la pregunta
 * escrita delante.
 */
export function BarraResultado({
  resultado,
  onCuadrar,
  onDeshacer,
  onCerrar,
}: {
  resultado: Resultado;
  onCuadrar: (fuerza: number | null) => Promise<void>;
  onDeshacer: () => void;
  onCerrar: () => void;
}) {
  const [ocupada, setOcupada] = useState(false);
  const biblioteca = resultado.origen === 'biblioteca';

  const cuadrar = async (cuadre: Cuadre) => {
    setOcupada(true);
    try {
      await onCuadrar(FUERZA[cuadre]);
    } finally {
      setOcupada(false);
    }
  };

  return (
    <section
      aria-label={biblioteca ? 'Puesto en la canción' : '¿Ha quedado bien?'}
      className="daw-rise tocar-resultado"
      style={{ display: 'flex', alignItems: 'center', gap: 6, height: '100%', minWidth: 0 }}
    >
      {biblioteca ? (
        <p
          style={{
            flex: 1,
            minWidth: 0,
            margin: 0,
            fontFamily: T.fontBody,
            fontSize: 13.5,
            fontWeight: 600,
            color: T.text,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          Puesto: <span style={{ fontWeight: 500, color: T.dim }}>{resultado.nombre}</span>
        </p>
      ) : (
        <>
          <span className="tocar-resultado-pregunta" style={{ fontFamily: T.fontBody, fontSize: 13.5, fontWeight: 600, color: T.text, whiteSpace: 'nowrap' }}>
            ¿Ha quedado bien?
          </span>
          <div style={{ flex: 1, minWidth: 0, opacity: ocupada ? 0.55 : 1, pointerEvents: ocupada ? 'none' : 'auto' }}>
            <Segmented<Cuadre>
              ariaLabel="Cuánto se cuadra a tu tempo"
              value={cuadreDe(resultado.fuerza)}
              onChange={(c) => void cuadrar(c)}
              options={[
                { value: 'tal', text: 'Tal cual' },
                { value: 'cuadrado', text: 'Cuadrado' },
                { value: 'todo', text: 'Del todo' },
              ]}
            />
          </div>
        </>
      )}
      <BotonIcono
        titulo={biblioteca ? 'Deshacer: quitar el loop' : 'Deshacer: quitar la toma'}
        desactivado={ocupada}
        onClick={() => {
          haptic([12, 30, 12]);
          onDeshacer();
        }}
      >
        <ArrowUUpLeft size={18} weight="bold" color={T.text} />
      </BotonIcono>
      <BotonIcono
        titulo="Vale, se queda así"
        principal
        onClick={() => {
          haptic(8);
          onCerrar();
        }}
      >
        <Check size={18} weight="bold" color={T.inverse} />
      </BotonIcono>
    </section>
  );
}

function BotonIcono({
  children,
  titulo,
  onClick,
  principal,
  desactivado,
}: {
  children: React.ReactNode;
  titulo: string;
  onClick: () => void;
  principal?: boolean;
  desactivado?: boolean;
}) {
  return (
    <button
      type="button"
      className="daw-press daw-hover"
      aria-label={titulo}
      title={titulo}
      disabled={desactivado}
      onClick={onClick}
      style={{
        width: 44,
        height: 44,
        flexShrink: 0,
        display: 'grid',
        placeItems: 'center',
        padding: 0,
        border: 'none',
        borderRadius: 12,
        background: principal ? T.text : T.fill,
        boxShadow: principal ? 'none' : `inset 0 1px 0 ${T.rim}`,
        opacity: desactivado ? 0.5 : 1,
        cursor: desactivado ? 'default' : 'pointer',
      }}
    >
      {children}
    </button>
  );
}
