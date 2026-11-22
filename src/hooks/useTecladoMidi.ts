'use client';

/**
 * Un teclado MIDI tocando el instrumento abierto en «Tocar».
 *
 * Cada nota entra por el mismo sitio que un toque en la pantalla
 * (`atril.tocar`), así que suena con el mismo instrumento, se graba en la
 * toma, entra en «Recuperar lo último» y pasa por la calibración. El pedal
 * de sostenido retiene las notas que sueltas hasta que levantas el pie.
 *
 * El permiso se pide al tocar «Conectar teclado MIDI» (el navegador pregunta
 * una vez); si ya estaba dado, se conecta solo al abrir. Los teclados que se
 * enchufan o desenchufan con la pantalla abierta se recogen sin recargar.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Atril } from '@/lib/instrumentos/directo';
import type { DefInstrumento } from '@/lib/instrumentos/registro';
import { leerMidi, notaParaInstrumento } from '@/lib/instrumentos/midi';

export type EstadoConexionMidi = 'sin-soporte' | 'apagado' | 'pidiendo' | 'listo' | 'denegado';

export interface EstadoMidi {
  estado: EstadoConexionMidi;
  /** Los teclados conectados, por su nombre. */
  dispositivos: string[];
  /** La última nota que llegó, para enseñar que el teclado está vivo. */
  ultima: number | null;
}

type Soltar = (horaSoltar?: number) => void;

export function useTecladoMidi({ activo, atril, def }: { activo: boolean; atril: Atril | null; def: DefInstrumento }) {
  const [midi, setMidi] = useState<EstadoMidi>({ estado: 'apagado', dispositivos: [], ultima: null });
  const accesoRef = useRef<MIDIAccess | null>(null);
  const vivo = useRef({ activo, atril, def });
  vivo.current = { activo, atril, def };
  const sonando = useRef(new Map<number, Soltar>());
  const retenidas = useRef(new Map<number, Soltar>());
  const pedal = useRef(false);

  const soltarTodo = useCallback(() => {
    for (const soltar of sonando.current.values()) soltar();
    for (const soltar of retenidas.current.values()) soltar();
    sonando.current.clear();
    retenidas.current.clear();
    pedal.current = false;
  }, []);

  const alMensaje = useCallback((evento: MIDIMessageEvent) => {
    const { activo: abierto, atril: a, def: d } = vivo.current;
    if (!abierto || !a || !evento.data) return;
    const mensaje = leerMidi(evento.data);
    if (mensaje.tipo === 'nota') {
      const nota = notaParaInstrumento(d, mensaje.nota);
      // Repetir la misma tecla sin haberla soltado: se suelta la anterior.
      sonando.current.get(mensaje.nota)?.();
      retenidas.current.get(mensaje.nota)?.();
      retenidas.current.delete(mensaje.nota);
      sonando.current.set(mensaje.nota, a.tocar(d.id, nota, mensaje.vel, evento.timeStamp));
      setMidi((m) => (m.ultima === nota ? m : { ...m, ultima: nota }));
    } else if (mensaje.tipo === 'suelta') {
      const soltar = sonando.current.get(mensaje.nota);
      if (!soltar) return;
      sonando.current.delete(mensaje.nota);
      if (pedal.current && d.sostiene) retenidas.current.set(mensaje.nota, soltar);
      else soltar(evento.timeStamp);
    } else if (mensaje.tipo === 'pedal') {
      pedal.current = mensaje.abajo;
      if (!mensaje.abajo) {
        for (const soltar of retenidas.current.values()) soltar(evento.timeStamp);
        retenidas.current.clear();
      }
    }
  }, []);

  const engancharEntradas = useCallback(
    (acceso: MIDIAccess) => {
      const nombres: string[] = [];
      acceso.inputs.forEach((entrada) => {
        entrada.onmidimessage = alMensaje;
        if (entrada.state === 'connected') nombres.push(entrada.name || 'Teclado MIDI');
      });
      setMidi((m) => ({ ...m, estado: 'listo', dispositivos: nombres }));
    },
    [alMensaje],
  );

  const conectar = useCallback(async () => {
    if (typeof navigator === 'undefined' || !('requestMIDIAccess' in navigator)) return;
    if (accesoRef.current) {
      engancharEntradas(accesoRef.current);
      return;
    }
    setMidi((m) => ({ ...m, estado: 'pidiendo' }));
    try {
      const acceso = await navigator.requestMIDIAccess({ sysex: false });
      accesoRef.current = acceso;
      acceso.onstatechange = () => engancharEntradas(acceso);
      engancharEntradas(acceso);
    } catch {
      setMidi((m) => ({ ...m, estado: 'denegado' }));
    }
  }, [engancharEntradas]);

  // ¿Hay MIDI en este navegador? Y si el permiso ya estaba dado, se conecta solo.
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('requestMIDIAccess' in navigator)) {
      setMidi((m) => ({ ...m, estado: 'sin-soporte' }));
      return;
    }
    let cancelado = false;
    navigator.permissions
      ?.query({ name: 'midi' as PermissionName })
      .then((permiso) => {
        if (!cancelado && permiso.state === 'granted') void conectar();
      })
      .catch(() => undefined);
    return () => {
      cancelado = true;
    };
  }, [conectar]);

  // Al cerrar «Tocar» o cambiar de instrumento, nada se queda colgado sonando.
  useEffect(() => {
    if (!activo) soltarTodo();
  }, [activo, soltarTodo]);
  useEffect(() => soltarTodo, [def.id, soltarTodo]);

  // Al desmontar, el teclado deja de mandar aquí.
  useEffect(
    () => () => {
      soltarTodo();
      accesoRef.current?.inputs.forEach((entrada) => {
        entrada.onmidimessage = null;
      });
    },
    [soltarTodo],
  );

  return { midi, conectar };
}
