'use client';

import { useEffect, useRef } from 'react';
import type { Atril } from '@/lib/instrumentos/directo';
import type { DefInstrumento } from '@/lib/instrumentos/registro';
import { T } from '../theme';

/**
 * Un tinte suave por familia de golpe, para encontrar cada cosa sin leer:
 * parches (bombo, caja, aro, palmas) en terracota, toms en arena, metales en
 * piedra y mano en madera. Mezclado con la superficie, sirve en claro y en
 * oscuro. Ni rojo ni salvia: en esta casa el rojo es grabar y el salvia, la
 * máquina o lo que suena.
 */
const TINTES = { parche: '#C98A6B', tom: '#C9AE7C', metal: '#8E9AA3', mano: '#B08A63' } as const;
function tinteDe(nota: number): keyof typeof TINTES {
  if (nota >= 35 && nota <= 40) return 'parche';
  if ([41, 43, 45, 47, 48, 50].includes(nota)) return 'tom';
  if ([42, 44, 46, 49, 51, 52, 53, 55, 57, 59].includes(nota)) return 'metal';
  return 'mano';
}

/**
 * Los pads de batería: 4 × 4, de 64 px como mínimo.
 *
 * Suenan en el `pointerdown` desde escuchas nativas: nada de esto pasa por el
 * estado de React, que en un móvil añadiría un fotograma (16 ms) entre el dedo
 * y el sonido. El pad encendido también se pinta a mano, con un atributo.
 * Cada dedo es un `pointerId` con su captura: diez dedos, diez golpes.
 *
 * La fuerza sale de dónde tocas: en el centro, el golpe entero; hacia el
 * borde, más suave. Así un redoble con dos dedos tiene matices sin pedirle a
 * la pantalla una presión que el iPhone no da.
 */
export function Pads({
  atril,
  def,
  teclas,
}: {
  atril: Atril | null;
  def: DefInstrumento;
  /** La tecla del ordenador de cada pad (por su sitio en la rejilla), para escribirla en la esquina. */
  teclas?: (string | null)[];
}) {
  const raizRef = useRef<HTMLDivElement | null>(null);
  const atrilRef = useRef(atril);
  const defRef = useRef(def);
  atrilRef.current = atril;
  defRef.current = def;

  useEffect(() => {
    const raiz = raizRef.current;
    if (!raiz) return;
    const apagados = new Map<HTMLElement, number>();

    const fuerza = (evento: PointerEvent, pad: HTMLElement): number => {
      if (evento.pointerType === 'pen' && evento.pressure > 0) return Math.round(40 + 87 * evento.pressure);
      const caja = pad.getBoundingClientRect();
      const dx = (evento.clientX - (caja.left + caja.width / 2)) / (caja.width / 2);
      const dy = (evento.clientY - (caja.top + caja.height / 2)) / (caja.height / 2);
      const distancia = Math.min(1, Math.hypot(dx, dy));
      return Math.round(127 - 52 * distancia * distancia);
    };

    const encender = (pad: HTMLElement) => {
      const previo = apagados.get(pad);
      if (previo) window.clearTimeout(previo);
      pad.dataset.on = '1';
    };
    const apagar = (pad: HTMLElement) => {
      // Un mínimo de 90 ms encendido: un golpe seco tiene que verse.
      const timer = window.setTimeout(() => {
        delete pad.dataset.on;
        apagados.delete(pad);
      }, 90);
      apagados.set(pad, timer);
    };

    const alBajar = (evento: PointerEvent) => {
      const pad = (evento.target as HTMLElement | null)?.closest<HTMLElement>('[data-nota]');
      if (!pad || !raiz.contains(pad)) return;
      evento.preventDefault();
      try {
        pad.setPointerCapture(evento.pointerId);
      } catch {
        /* sin captura: el golpe suena igual */
      }
      atrilRef.current?.tocar(defRef.current.id, Number(pad.dataset.nota), fuerza(evento, pad), evento.timeStamp);
      encender(pad);
    };
    const alSubir = (evento: PointerEvent) => {
      const pad = (evento.target as HTMLElement | null)?.closest<HTMLElement>('[data-nota]');
      if (pad) apagar(pad);
    };

    raiz.addEventListener('pointerdown', alBajar);
    raiz.addEventListener('pointerup', alSubir);
    raiz.addEventListener('pointercancel', alSubir);
    return () => {
      raiz.removeEventListener('pointerdown', alBajar);
      raiz.removeEventListener('pointerup', alSubir);
      raiz.removeEventListener('pointercancel', alSubir);
      for (const timer of apagados.values()) window.clearTimeout(timer);
    };
  }, []);

  const pads = def.pads ?? [];
  return (
    <div
      ref={raizRef}
      role="group"
      aria-label={`Pads de ${def.nombre}`}
      className="tocar-superficie"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, minmax(64px, 1fr))',
        // Llenan el alto que haya (más superficie de golpe), pero sin pasar
        // de unos 150 px: un pad más alto ya no se toca mejor, solo se aleja.
        gridTemplateRows: 'repeat(4, minmax(64px, 1fr))',
        gap: 8,
        width: '100%',
        maxWidth: 620,
        height: '100%',
        maxHeight: 640,
        margin: '0 auto',
      }}
    >
      {pads.map((pad, i) => {
        // La fila de abajo (bombo, aro, caja, palmas) es la que más se toca:
        // un punto más de tinte para que el pulgar la encuentre sin mirar.
        const principal = i >= 12;
        const tinte = TINTES[tinteDe(pad.nota)];
        const tecla = teclas?.[i] ?? null;
        return (
          <button
            key={pad.nota}
            type="button"
            data-nota={pad.nota}
            className="tocar-pad"
            aria-label={tecla ? `${pad.nombre}, tecla ${tecla}` : pad.nombre}
            style={{
              position: 'relative',
              minWidth: 64,
              minHeight: 64,
              border: 'none',
              borderRadius: 16,
              background: `color-mix(in srgb, ${tinte} ${principal ? 22 : 14}%, ${T.surface})`,
              // Plano, con su canto de luz arriba y la sombra de la casa: un pad se aprieta, no se ve hundido.
              boxShadow: `inset 0 1px 0 ${T.rim}, inset 0 0 0 1px color-mix(in srgb, ${tinte} 30%, transparent), ${T.elev1}`,
              color: T.text,
              padding: 0,
              cursor: 'pointer',
            }}
          >
            <span
              style={{
                position: 'absolute',
                left: 10,
                top: 9,
                right: 8,
                textAlign: 'left',
                fontFamily: T.fontBody,
                fontSize: 12.5,
                fontWeight: 600,
                letterSpacing: '-0.01em',
                lineHeight: 1.15,
                color: T.text,
                pointerEvents: 'none',
              }}
            >
              {pad.nombre}
            </span>
            {tecla ? (
              <span
                aria-hidden
                className="tocar-tecla-pc"
                style={{
                  position: 'absolute',
                  right: 8,
                  bottom: 7,
                  minWidth: 20,
                  height: 20,
                  padding: '0 5px',
                  display: 'grid',
                  placeItems: 'center',
                  borderRadius: 6,
                  background: `color-mix(in srgb, ${T.surface} 70%, transparent)`,
                  boxShadow: `inset 0 0 0 1px ${T.border}`,
                  fontFamily: T.fontMono,
                  fontSize: 11,
                  fontWeight: 600,
                  color: T.dim,
                  pointerEvents: 'none',
                }}
              >
                {tecla}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
