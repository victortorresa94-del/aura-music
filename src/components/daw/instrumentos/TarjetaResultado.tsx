'use client';

import { useState } from 'react';
import { Check } from '@phosphor-icons/react';
import type { Resultado } from '@/hooks/useInstrumentos';
import { haptic, T } from '../theme';

/**
 * «¿Ha quedado bien?», justo después de grabar. Lo tocado ya está guardado
 * como pista; aquí solo se decide cómo se queda:
 * - un loop entra cuadrado al 70 % (fuerza y swing por defecto) y se ofrece
 *   dejarlo como lo tocaste o cuadrarlo más;
 * - una toma normal entra tal cual y se ofrece cuadrarla;
 * - «Deshacer» la quita entera.
 * Nunca se pierde lo tocado: cuadrar se calcula siempre desde el bruto.
 * Va en el flujo (no encima del instrumento) para no tapar ningún pad.
 */
export function TarjetaResultado({
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
  const { origen, fuerza, trackIds, nombre } = resultado;
  const varias = trackIds.length > 1;
  const biblioteca = origen === 'biblioteca';

  const titulo = biblioteca ? 'Puesto en la canción' : '¿Ha quedado bien?';
  const detalle = biblioteca
    ? (nombre ?? '')
    : fuerza === null
      ? origen === 'recuperado'
        ? 'Recuperado tal cual lo tocaste.'
        : varias
          ? `${trackIds.length} pistas, tal cual las tocaste.`
          : 'Guardado tal cual lo tocaste.'
      : fuerza >= 1
        ? 'Cuadrado del todo a la rejilla.'
        : `Cuadrado al ${Math.round(fuerza * 100)} % a tu tempo.`;

  const cuadrar = async (nueva: number | null) => {
    haptic(10);
    setOcupada(true);
    try {
      await onCuadrar(nueva);
    } finally {
      setOcupada(false);
    }
  };

  return (
    <section
      aria-label={titulo}
      className="daw-rise"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        padding: '12px 12px 12px 14px',
        borderRadius: 16,
        background: T.surface,
        boxShadow: `${T.elev1}, inset 0 0 0 1px ${T.border}`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              margin: 0,
              fontFamily: T.fontBody,
              fontSize: 15,
              fontWeight: 650,
              color: T.text,
              letterSpacing: '-0.01em',
            }}
          >
            {titulo}
          </p>
          <p
            aria-live="polite"
            style={{
              margin: '2px 0 0',
              fontFamily: T.fontBody,
              fontSize: 13,
              color: T.dim,
              lineHeight: 1.35,
            }}
          >
            {detalle}
          </p>
        </div>
        {/* Deshacer arriba y discreto: borra, así que no se lleva el peso de una fila entera. */}
        <button
          type="button"
          className="daw-press daw-hover"
          disabled={ocupada}
          onClick={() => {
            haptic([12, 30, 12]);
            onDeshacer();
          }}
          style={{
            flexShrink: 0,
            height: 36,
            padding: '0 10px',
            border: 'none',
            borderRadius: 10,
            background: 'transparent',
            boxShadow: `inset 0 0 0 1px ${T.border}`,
            color: T.text,
            fontFamily: T.fontBody,
            fontSize: 13.5,
            fontWeight: 600,
            opacity: ocupada ? 0.5 : 1,
            cursor: ocupada ? 'default' : 'pointer',
          }}
        >
          Deshacer
        </button>
        <button
          type="button"
          className="daw-press daw-hover"
          aria-label="Vale, se queda así"
          title="Vale, se queda así"
          onClick={() => {
            haptic(8);
            onCerrar();
          }}
          style={{
            flexShrink: 0,
            height: 36,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '0 12px 0 10px',
            border: 'none',
            borderRadius: 10,
            background: T.text,
            color: T.inverse,
            fontFamily: T.fontBody,
            fontSize: 13.5,
            fontWeight: 650,
            cursor: 'pointer',
          }}
        >
          <Check size={15} weight="bold" color={T.inverse} />
          Vale
        </button>
      </div>
      {biblioteca ? null : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {fuerza !== null ? (
            <Opcion
              texto={varias ? 'Dejar como las toqué' : 'Dejar como lo toqué'}
              desactivada={ocupada}
              onClick={() => void cuadrar(null)}
            />
          ) : null}
          {fuerza === null || fuerza < 1 ? (
            // Cuadrar es cosa de la máquina: verde, como lo demás que hace sola.
            <Opcion
              texto={fuerza === null ? 'Cuadrar' : 'Cuadrar más'}
              maquina
              desactivada={ocupada}
              onClick={() => void cuadrar(fuerza === null ? 0.7 : 1)}
            />
          ) : null}
          {fuerza !== null && fuerza >= 1 ? (
            <Opcion texto="Cuadrar menos" maquina desactivada={ocupada} onClick={() => void cuadrar(0.7)} />
          ) : null}
        </div>
      )}
    </section>
  );
}

function Opcion({
  texto,
  onClick,
  maquina,
  desactivada,
}: {
  texto: string;
  onClick: () => void;
  maquina?: boolean;
  desactivada?: boolean;
}) {
  return (
    <button
      type="button"
      className="daw-press daw-sink"
      disabled={desactivada}
      onClick={onClick}
      style={{
        flex: '1 1 auto',
        minHeight: 40,
        padding: '0 12px',
        border: 'none',
        borderRadius: 11,
        background: maquina ? T.aiSoft : T.fill,
        boxShadow: maquina ? 'none' : `inset 0 1px 0 ${T.rim}`,
        color: maquina ? T.ai : T.text,
        fontFamily: T.fontBody,
        fontSize: 13.5,
        fontWeight: 600,
        whiteSpace: 'nowrap',
        opacity: desactivada ? 0.5 : 1,
        cursor: desactivada ? 'default' : 'pointer',
      }}
    >
      {texto}
    </button>
  );
}
