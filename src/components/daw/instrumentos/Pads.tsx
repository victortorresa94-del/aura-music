'use client';

import { useEffect, useRef } from 'react';
import type { Atril } from '@/lib/instrumentos/directo';
import type { DefInstrumento } from '@/lib/instrumentos/registro';
import { T } from '../theme';

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
export function Pads({ atril, def }: { atril: Atril | null; def: DefInstrumento }) {
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
        maxWidth: 560,
        height: '100%',
        maxHeight: 640,
        margin: '0 auto',
      }}
    >
      {pads.map((pad, i) => {
        // La fila de abajo (bombo, aro, caja, palmas) es la que más se toca:
        // un punto más de peso para que el pulgar la encuentre sin mirar.
        const principal = i >= 12;
        return (
          <button
            key={pad.nota}
            type="button"
            data-nota={pad.nota}
            className="tocar-pad"
            aria-label={pad.nombre}
            style={{
              position: 'relative',
              minWidth: 64,
              minHeight: 64,
              border: 'none',
              borderRadius: 14,
              background: principal ? T.fillStrong : T.fill,
              boxShadow: `inset 0 1px 0 ${T.rim}, inset 0 0 0 1px ${T.border}`,
              color: T.text,
              padding: 0,
              cursor: 'pointer',
            }}
          >
            <span
              style={{
                position: 'absolute',
                left: 9,
                bottom: 8,
                right: 6,
                textAlign: 'left',
                fontFamily: T.fontBody,
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: '-0.01em',
                lineHeight: 1.15,
                color: principal ? T.text : T.dim,
                pointerEvents: 'none',
              }}
            >
              {pad.nombre}
            </span>
          </button>
        );
      })}
    </div>
  );
}
