'use client';

/**
 * El ciclo en la línea de tiempo: el botón de la esquina de la regla, la
 * zona dibujada en la regla y en las pistas, y la hoja para ponerlo.
 *
 * Que se vea clarísimo qué se repite: en la regla, los bordes de la zona
 * van en tinta, con un asa para arrastrarlos, y una pastilla dice «2
 * compases» parado, «Vuelta 3» reproduciendo y «Toma 3» grabando. En las
 * pistas, la zona va sombreada. Sin colores nuevos: tinta y papel; el rojo
 * sigue siendo solo «grabando».
 */

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Repeat } from '@phosphor-icons/react';
import type { Studio } from '@/hooks/useStudio';
import {
  cicloDesde,
  cicloEntre,
  compasesDelCiclo,
  COMPASES_DE_CICLO,
  moverBorde,
  segundosDelCiclo,
  type Ciclo,
} from '@/lib/daw/bucle/bucle';
import { haptic, T } from '../theme';
import { Field, Sheet, TextButton, Toggle, hintText, label } from '../ui';

const decirCompases = (n: number) => `${n} ${n === 1 ? 'compás' : 'compases'}`;

/* -------------------------------------------------------------------------- */
/* Botón de la esquina                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Va en la esquina de arriba a la izquierda, justo al lado de la regla:
 * el ciclo es de la regla. Encendido, se ve encendido (tinta).
 */
export function BotonCiclo({ studio, pulsosPorCompas }: { studio: Studio; pulsosPorCompas: number }) {
  const [abierta, setAbierta] = useState(false);
  const ciclo = studio.project.ciclo;
  const activo = !!ciclo?.activo;
  return (
    <>
      <button
        type="button"
        className="daw-press daw-hover"
        aria-label={activo && ciclo ? `Ciclo puesto: ${decirCompases(compasesDelCiclo(ciclo, pulsosPorCompas))}. Cambiar` : 'Ciclo: repetir una zona'}
        aria-pressed={activo}
        onClick={() => {
          haptic(8);
          setAbierta(true);
        }}
        style={{
          margin: '3px 6px',
          height: 24,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          padding: '0 9px 0 7px',
          border: 'none',
          borderRadius: 7,
          background: activo ? T.text : T.fill,
          boxShadow: activo ? 'none' : `inset 0 0 0 1px ${T.border}`,
          color: activo ? T.inverse : T.text,
          fontFamily: T.fontBody,
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: '-0.005em',
          cursor: 'pointer',
          touchAction: 'manipulation',
          alignSelf: 'flex-start',
        }}
      >
        <Repeat size={14} weight={activo ? 'bold' : 'regular'} color="currentColor" />
        Ciclo
      </button>
      <HojaCiclo studio={studio} pulsosPorCompas={pulsosPorCompas} open={abierta} onClose={() => setAbierta(false)} />
    </>
  );
}

/**
 * La hoja se pinta dentro de la raíz del estudio y no dentro de la regla:
 * la esquina de la regla vive en una capa pegajosa y la hoja quedaría
 * debajo del dock.
 */
function HojaCiclo({
  studio,
  pulsosPorCompas,
  open,
  onClose,
}: {
  studio: Studio;
  pulsosPorCompas: number;
  open: boolean;
  onClose: () => void;
}) {
  const [raiz, setRaiz] = useState<HTMLElement | null>(null);
  useEffect(() => setRaiz(document.querySelector<HTMLElement>('.daw-root')), []);
  const { project, engine, ponerCiclo } = studio;
  const ciclo = project.ciclo ?? null;
  const pulso = 60 / project.bpm;
  const cursor = engine?.position ?? 0;
  const compasCursor = Math.floor(cursor / pulso / pulsosPorCompas) + 1;
  const desdeCompas = ciclo ? Math.round(ciclo.desde / pulsosPorCompas) + 1 : compasCursor;
  const compases = ciclo ? compasesDelCiclo(ciclo, pulsosPorCompas) : 0;

  const repetir = (n: number) => {
    // Desde el compás de la zona si ya hay una; si no, desde donde está el cursor.
    const desde = ciclo ? ciclo.desde * pulso : cursor;
    ponerCiclo(cicloDesde(desde, n, project.bpm, pulsosPorCompas));
  };

  if (!raiz) return null;
  return createPortal(
    <Sheet open={open} title="Ciclo" onClose={onClose}>
      <Field
        title="Repetir una zona"
        intro="La zona se repite al reproducir y al grabar. Grabando, cada vuelta es una toma: al parar suena la última y eliges otra en la pista."
      >
        <span style={{ ...label, display: 'block', marginBottom: 8 }}>
          {ciclo ? `Desde el compás ${desdeCompas}` : `Desde el compás ${compasCursor}, donde está el cursor`}
        </span>
        <div role="radiogroup" aria-label="Cuántos compases" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
          {COMPASES_DE_CICLO.map((n) => {
            const elegida = !!ciclo?.activo && compases === n;
            return (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={elegida}
                className="daw-press daw-hover"
                onClick={() => {
                  haptic(8);
                  repetir(n);
                }}
                style={{
                  minHeight: 48,
                  border: 'none',
                  borderRadius: 12,
                  background: elegida ? T.text : T.fill,
                  boxShadow: elegida ? T.elev1 : `inset 0 1px 0 ${T.rim}`,
                  color: elegida ? T.inverse : T.text,
                  fontFamily: T.fontBody,
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 1,
                }}
              >
                <span style={{ fontSize: 17, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{n}</span>
                <span style={{ fontSize: 11, opacity: 0.8 }}>{n === 1 ? 'compás' : 'compases'}</span>
              </button>
            );
          })}
        </div>
        <p style={{ ...hintText, marginTop: 10 }}>
          También se marca arrastrando por la regla con el ratón, y los bordes de la zona se arrastran con el dedo.
        </p>
      </Field>

      {ciclo ? (
        <Field title="Ciclo puesto">
          <Toggle
            checked={ciclo.activo}
            onChange={(activo) => ponerCiclo({ ...ciclo, activo })}
            title={`Compases ${desdeCompas} a ${desdeCompas + compases - 1}`}
            detail={ciclo.activo ? 'Se repite. Apágalo para reproducir de largo sin perder la zona.' : 'Apagado: la zona se recuerda, pero no se repite.'}
          />
          <div style={{ marginTop: 10 }}>
            <TextButton
              full
              onClick={() => {
                ponerCiclo(null);
                onClose();
              }}
            >
              Quitar el ciclo
            </TextButton>
          </div>
        </Field>
      ) : null}
    </Sheet>,
    raiz,
  );
}

/* -------------------------------------------------------------------------- */
/* La zona en la regla                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Bordes en tinta con su asa, la zona sombreada y una pastilla que dice
 * cuánto mide o en qué vuelta vas. La pastilla se actualiza leyendo el motor
 * con requestAnimationFrame: React no se redibuja en cada vuelta.
 */
export function ZonaEnRegla({ studio, pps, pulsosPorCompas }: { studio: Studio; pps: number; pulsosPorCompas: number }) {
  const { project, engine, ponerCiclo } = studio;
  const ciclo = project.ciclo ?? null;
  const pastilla = useRef<HTMLSpanElement | null>(null);
  const compases = ciclo ? compasesDelCiclo(ciclo, pulsosPorCompas) : 0;
  const reposo = decirCompases(compases);

  useEffect(() => {
    if (!ciclo?.activo) return;
    let raf = 0;
    let ultimo = '';
    const bucle = () => {
      const vuelta = engine?.vueltaDelBucle ?? null;
      const estado = engine?.transportState;
      const texto = vuelta === null ? reposo : estado === 'recording' || estado === 'countin' ? `Toma ${vuelta}` : `Vuelta ${vuelta}`;
      if (texto !== ultimo && pastilla.current) {
        ultimo = texto;
        pastilla.current.textContent = texto;
        // Grabando, la pastilla va en rojo: es lo único que se está grabando.
        pastilla.current.style.background = estado === 'recording' ? T.recFill : T.text;
        pastilla.current.style.color = estado === 'recording' ? T.onRec : T.inverse;
      }
      raf = requestAnimationFrame(bucle);
    };
    raf = requestAnimationFrame(bucle);
    return () => cancelAnimationFrame(raf);
  }, [ciclo?.activo, engine, reposo]);

  if (!ciclo) return null;
  const zona = segundosDelCiclo({ ...ciclo, activo: true }, project.bpm)!;
  const x = zona.inicio * pps;
  const ancho = (zona.fin - zona.inicio) * pps;
  const activo = ciclo.activo;

  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        left: x,
        width: ancho,
        top: 0,
        bottom: 0,
        background: activo ? 'color-mix(in srgb, var(--daw-text) 9%, transparent)' : 'transparent',
        boxShadow: activo ? `inset 2px 0 0 ${T.text}, inset -2px 0 0 ${T.text}` : `inset 1px 0 0 ${T.borderStrong}, inset -1px 0 0 ${T.borderStrong}`,
        pointerEvents: 'none',
        zIndex: 1,
      }}
    >
      <span
        ref={pastilla}
        style={{
          position: 'absolute',
          left: 4,
          top: 3,
          // Sin recortar: con una zona estrecha (un compás a tempo vivo) la
          // pastilla sale por la derecha encima de la regla. «Vuelta 3» se
          // tiene que leer entero, aunque tape un número de compás.
          padding: '1px 6px',
          borderRadius: 5,
          background: activo ? T.text : T.fill,
          color: activo ? T.inverse : T.dim,
          fontFamily: T.fontBody,
          fontVariantNumeric: 'tabular-nums',
          fontSize: 10,
          fontWeight: 600,
          lineHeight: '14px',
          whiteSpace: 'nowrap',
        }}
      >
        {activo ? reposo : `${reposo} · apagado`}
      </span>
      <Asa lado="desde" ciclo={ciclo} pps={pps} studio={studio} pulsosPorCompas={pulsosPorCompas} onCambio={ponerCiclo} />
      <Asa lado="hasta" ciclo={ciclo} pps={pps} studio={studio} pulsosPorCompas={pulsosPorCompas} onCambio={ponerCiclo} />
    </div>
  );
}

/** Un borde de la zona, que se arrastra con el dedo o el ratón y salta de compás en compás. */
function Asa({
  lado,
  ciclo,
  pps,
  studio,
  pulsosPorCompas,
  onCambio,
}: {
  lado: 'desde' | 'hasta';
  ciclo: Ciclo;
  pps: number;
  studio: Studio;
  pulsosPorCompas: number;
  onCambio: (c: Ciclo) => void;
}) {
  const inicio = useRef<{ id: number; x: number; t: number } | null>(null);
  const pulso = 60 / studio.project.bpm;
  const tBorde = (lado === 'desde' ? ciclo.desde : ciclo.hasta) * pulso;
  return (
    <span
      onPointerDown={(e) => {
        e.stopPropagation();
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        inicio.current = { id: e.pointerId, x: e.clientX, t: tBorde };
      }}
      onPointerMove={(e) => {
        const i = inicio.current;
        if (!i || e.pointerId !== i.id) return;
        const t = i.t + (e.clientX - i.x) / pps;
        const siguiente = moverBorde(ciclo, lado, t, studio.project.bpm, pulsosPorCompas);
        if (siguiente.desde !== ciclo.desde || siguiente.hasta !== ciclo.hasta) {
          haptic(6);
          onCambio(siguiente);
        }
      }}
      onPointerUp={() => {
        inicio.current = null;
      }}
      onPointerCancel={() => {
        inicio.current = null;
      }}
      style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        [lado === 'desde' ? 'left' : 'right']: -10,
        width: 20,
        pointerEvents: 'auto',
        touchAction: 'none',
        cursor: 'ew-resize',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        paddingBottom: 3,
      }}
    >
      <span style={{ width: 6, height: 12, borderRadius: 3, background: ciclo.activo ? T.text : T.borderStrong }} />
    </span>
  );
}

/** La zona sombreada en las pistas, debajo de los clips. */
export function ZonaEnPistas({ studio, pps, izquierda, arriba }: { studio: Studio; pps: number; izquierda: number; arriba: number }) {
  const ciclo = studio.project.ciclo;
  const zona = segundosDelCiclo(ciclo, studio.project.bpm);
  if (!zona) return null;
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        left: izquierda + zona.inicio * pps,
        width: (zona.fin - zona.inicio) * pps,
        top: arriba,
        bottom: 0,
        background: 'color-mix(in srgb, var(--daw-text) 4%, transparent)',
        boxShadow: `inset 1px 0 0 ${T.borderStrong}, inset -1px 0 0 ${T.borderStrong}`,
        pointerEvents: 'none',
        zIndex: 0,
      }}
    />
  );
}

/**
 * Arrastrar por la regla con el ratón marca la zona, de compás entero a
 * compás entero. Con el dedo, arrastrar por la regla mueve la línea de
 * tiempo (como siempre); la zona se pone desde el botón y se ajusta con las
 * asas.
 */
export function useArrastreDeCiclo(studio: Studio, pps: number, pulsosPorCompas: number) {
  const arrastre = useRef<{ id: number; x0: number; t0: number; movido: boolean } | null>(null);
  return {
    onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      const rect = e.currentTarget.getBoundingClientRect();
      arrastre.current = { id: e.pointerId, x0: e.clientX, t0: Math.max(0, (e.clientX - rect.left) / pps), movido: false };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => {
      const a = arrastre.current;
      if (!a || e.pointerId !== a.id) return;
      if (!a.movido && Math.abs(e.clientX - a.x0) < 8) return;
      a.movido = true;
      const rect = e.currentTarget.getBoundingClientRect();
      const t = Math.max(0, (e.clientX - rect.left) / pps);
      const siguiente = cicloEntre(a.t0, t, studio.project.bpm, pulsosPorCompas);
      const actual = studio.project.ciclo;
      if (!actual || !actual.activo || actual.desde !== siguiente.desde || actual.hasta !== siguiente.hasta) studio.ponerCiclo(siguiente);
    },
    onPointerUp: () => {
      arrastre.current = null;
    },
  };
}
