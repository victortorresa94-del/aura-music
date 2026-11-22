'use client';

/**
 * El teclado del ordenador tocando el instrumento abierto en «Tocar».
 *
 * Como el teclado MIDI (`useTecladoMidi`), cada nota entra por `atril.tocar`:
 * suena igual, se graba en la toma (también en el modo loop), entra en
 * «Recuperar lo último» y pasa por la calibración. Además, Espacio escucha o
 * para y Intro graba o para. Se apaga mientras escribes en un campo.
 */

import { useEffect, useRef, useState } from 'react';
import type { Atril } from '@/lib/instrumentos/directo';
import type { DefInstrumento } from '@/lib/instrumentos/registro';
import { accionDeTecla, doDeOctava, type MapaTeclas } from '@/lib/instrumentos/tecladoPc';

type Soltar = (hora?: number) => void;

export function useTecladoPC({
  activo,
  atril,
  def,
  onGrabar,
  onEscuchar,
  mapa,
}: {
  activo: boolean;
  atril: Atril | null;
  def: DefInstrumento;
  onGrabar: () => void;
  onEscuchar: () => void;
  /** Las teclas de este grupo (las propias o las de siempre). */
  mapa?: MapaTeclas | null;
}) {
  const [octava, setOctava] = useState(0);
  const vivo = useRef({ atril, def, onGrabar, onEscuchar, octava, mapa });
  vivo.current = { atril, def, onGrabar, onEscuchar, octava, mapa };

  // Al cambiar de instrumento se vuelve a su octava de siempre.
  useEffect(() => setOctava(0), [def.id]);

  useEffect(() => {
    if (!activo) return;
    const sonando = new Map<string, { soltar: Soltar; nota: number }>();

    /** El pad o la tecla de la pantalla, encendidos también desde el teclado. */
    const encender = (nota: number, on: boolean) => {
      const el = document.querySelector<HTMLElement>(`[role="dialog"][aria-label="Tocar"] [data-nota="${nota}"]`);
      if (!el) return;
      if (on) el.dataset.on = '1';
      else delete el.dataset.on;
    };

    const escribiendo = (objetivo: EventTarget | null) => {
      const el = objetivo as HTMLElement | null;
      const etiqueta = el?.tagName;
      return etiqueta === 'INPUT' || etiqueta === 'TEXTAREA' || etiqueta === 'SELECT' || !!el?.isContentEditable;
    };

    const alBajar = (evento: KeyboardEvent) => {
      if (evento.ctrlKey || evento.metaKey || evento.altKey || escribiendo(evento.target)) return;
      const { atril: a, def: d, onGrabar: grabar, onEscuchar: escuchar, octava: o, mapa: m } = vivo.current;
      if (evento.key === ' ') {
        evento.preventDefault();
        if (!evento.repeat) escuchar();
        return;
      }
      if (evento.key === 'Enter') {
        evento.preventDefault();
        if (!evento.repeat) grabar();
        return;
      }
      const accion = accionDeTecla(evento.key, !!d.pads, m);
      if (!accion || !a) return;
      evento.preventDefault();
      if (evento.repeat) return;
      if (accion.tipo === 'octava') {
        setOctava((actual) => Math.max(-2, Math.min(2, actual + accion.cambio)));
        return;
      }
      const clave = evento.key.toLowerCase();
      if (sonando.has(clave)) return;
      const nota =
        accion.tipo === 'pad'
          ? (d.pads?.[accion.indice]?.nota ?? null)
          : doDeOctava(d.base, o, d.rango) + accion.semitonos;
      if (nota === null) return;
      sonando.set(clave, { soltar: a.tocar(d.id, nota, 104, evento.timeStamp), nota });
      encender(nota, true);
    };

    const alSubir = (evento: KeyboardEvent) => {
      const clave = evento.key.toLowerCase();
      const nota = sonando.get(clave);
      if (!nota) return;
      nota.soltar(evento.timeStamp);
      sonando.delete(clave);
      encender(nota.nota, false);
    };

    const soltarTodo = () => {
      for (const { soltar, nota } of sonando.values()) {
        soltar();
        encender(nota, false);
      }
      sonando.clear();
    };

    window.addEventListener('keydown', alBajar);
    window.addEventListener('keyup', alSubir);
    window.addEventListener('blur', soltarTodo);
    return () => {
      window.removeEventListener('keydown', alBajar);
      window.removeEventListener('keyup', alSubir);
      window.removeEventListener('blur', soltarTodo);
      soltarTodo();
    };
  }, [activo]);

  return { octava };
}
