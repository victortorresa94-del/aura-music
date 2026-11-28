'use client';

/**
 * El chat de crear: ocasiones de un toque, como mucho tres preguntas con
 * chips, la receta (o el plan de la playlist) con su precio, y generar.
 * La lógica es `src/lib/bolsillo/crear/conversacion.ts`; esto la conecta con
 * React, el almacén y la cuenta.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { almacen } from '@/lib/bolsillo/almacen';
import { quedarme } from '@/lib/bolsillo/biblioteca';
import {
  conversacionVacia,
  decir,
  planDe,
  recetaDe,
  responder as responderChip,
  siguientePregunta,
  type EstadoConversacion,
  type PreguntaChat,
  type Quiere,
} from '@/lib/bolsillo/crear/conversacion';
import { generarCancion } from '@/lib/bolsillo/crear/generar';
import { tomarPeticion } from '@/lib/bolsillo/crear/pendiente';
import { porqueDe, resumenDe, tituloDe } from '@/lib/bolsillo/crear/receta';
import { usaMotorFalso } from '@/lib/bolsillo/motor/motores';
import { generarPlaylist } from '@/lib/bolsillo/playlists/generarPlaylist';
import { conCanciones, nuevaPlaylist } from '@/lib/bolsillo/playlists/playlist';
import type { PlanDePlaylist } from '@/lib/bolsillo/playlists/plan';
import { creditosDeBoceto, creditosDeReceta } from '@/lib/bolsillo/precios';
import { respuestaAImitacion } from '@/lib/bolsillo/reglas';
import type { Receta } from '@/lib/bolsillo/tipos';
import type { Biblioteca } from './useBiblioteca';

export interface MensajeCrear {
  id: string;
  de: 'aura' | 'tu';
  texto: string;
}

export type FaseCrear = 'charla' | 'generando' | 'error';

export interface Crear {
  mensajes: MensajeCrear[];
  pregunta: PreguntaChat | null;
  quiere: Quiere | undefined;
  receta: Receta | null;
  plan: PlanDePlaylist | null;
  resumen: string | null;
  creditos: number;
  creditosBoceto: number;
  falso: boolean;
  fase: FaseCrear;
  avance: string | null;
  error: string | null;
  /** Ya se ha dicho algo: se enseñan los mensajes y no las ocasiones. */
  empezado: boolean;
  escribir(texto: string, quiere?: Quiere, nombre?: string): void;
  responder(valor: string, etiqueta: string): void;
  /** Hace la pieza. Devuelve a dónde ir: la canción o la playlist. */
  generar(opciones?: { boceto?: boolean }): Promise<{ tipo: 'cancion' | 'playlist'; id: string } | null>;
  reiniciar(): void;
}

let contador = 0;
const mensaje = (de: 'aura' | 'tu', texto: string): MensajeCrear => ({ id: `m${++contador}`, de, texto });

export function useCrear(_biblioteca: Biblioteca, opciones: { hayCuenta: boolean }): Crear {
  const falso = usaMotorFalso();
  const [estado, setEstadoReal] = useState<EstadoConversacion>(conversacionVacia);
  // El estado también en una ref: escribir y responder leen el último sin
  // efectos dentro de un actualizador (en StrictMode se ejecutan dos veces).
  const estadoRef = useRef(estado);
  const setEstado = useCallback((nuevo: EstadoConversacion) => {
    estadoRef.current = nuevo;
    setEstadoReal(nuevo);
  }, []);
  const [mensajes, setMensajes] = useState<MensajeCrear[]>([]);
  const [fase, setFase] = useState<FaseCrear>('charla');
  const [avance, setAvance] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const playlistDestino = useRef<string | null>(null);

  const pregunta = siguientePregunta(estado);
  const listo = estado.frases.length > 0 && !pregunta && !estado.imitacion;
  const receta = useMemo(() => (listo && estado.quiere !== 'playlist' ? recetaDe(estado, { falso }) : null), [listo, estado, falso]);
  const plan = useMemo(() => (listo && estado.quiere === 'playlist' ? planDe(estado, { falso }) : null), [listo, estado, falso]);
  const creditos = receta ? creditosDeReceta(receta) : (plan?.total ?? 0);
  const resumen = receta ? resumenDe(receta) : plan ? `${plan.nombre} · ${plan.entradas.length} canciones` : null;

  const anadirPregunta = useCallback((siguiente: EstadoConversacion) => {
    const p = siguientePregunta(siguiente);
    if (siguiente.imitacion) setMensajes((m) => [...m, mensaje('aura', respuestaAImitacion(siguiente.imitacion!))]);
    else if (p) setMensajes((m) => [...m, mensaje('aura', p.texto)]);
    else setMensajes((m) => [...m, mensaje('aura', siguiente.quiere === 'playlist' ? 'Este es el plan. Si te vale, la hago.' : 'Así la haría. Si te vale, dale.')]);
  }, []);

  const escribir = useCallback(
    (texto: string, quiere?: Quiere, nombre?: string) => {
      const limpio = texto.trim();
      if (!limpio) return;
      setError(null);
      setMensajes((m) => [...m, mensaje('tu', limpio)]);
      const siguiente = decir(estadoRef.current, limpio, quiere, nombre);
      setEstado(siguiente);
      anadirPregunta(siguiente);
    },
    [anadirPregunta, setEstado],
  );

  const responder = useCallback(
    (valor: string, etiqueta: string) => {
      if (!pregunta) return;
      setMensajes((m) => [...m, mensaje('tu', etiqueta)]);
      const siguiente = responderChip(estadoRef.current, pregunta.id, valor);
      setEstado(siguiente);
      anadirPregunta(siguiente);
    },
    [pregunta, anadirPregunta, setEstado],
  );

  // Lo que llega pedido desde otra pantalla (un artista, una playlist, un paisaje).
  useEffect(() => {
    const p = tomarPeticion();
    if (!p) return;
    playlistDestino.current = p.playlistId ?? null;
    if (p.frase || p.tipo) escribir(p.frase ?? (p.tipo === 'paisaje' ? 'Un paisaje largo' : 'Créame una canción'), p.tipo);
  }, [escribir]);

  const generar = useCallback(
    async (o: { boceto?: boolean } = {}) => {
      if (!falso && !opciones.hayCuenta) {
        setError('Entra con tu cuenta de aura para crear: lo que haces se paga con tus créditos.');
        return null;
      }
      setFase('generando');
      setError(null);
      try {
        if (receta) {
          const r = await generarCancion(receta, {
            titulo: tituloDe(receta),
            porque: porqueDe(receta),
            boceto: o.boceto,
            alAvanzar: setAvance,
          });
          if (playlistDestino.current) {
            const pl = await almacen().playlists.leer(playlistDestino.current);
            if (pl) await almacen().playlists.poner(conCanciones(pl, [r.cancionId]));
          }
          setFase('charla');
          return { tipo: 'cancion' as const, id: r.cancionId };
        }
        if (plan) {
          const playlist = nuevaPlaylist({ nombre: plan.nombre, porque: plan.porque });
          await almacen().playlists.poner(playlist);
          // Se llena mientras escuchas: la pantalla de la playlist enseña el avance.
          // Lo que entra en una playlist está en tu biblioteca: se queda guardado.
          const generarYQuedar: typeof generarCancion = async (r, d) => {
            const hecho = await generarCancion(r, d);
            const c = await almacen().canciones.leer(hecho.cancionId);
            if (c) await almacen().canciones.poner(quedarme(c, hecho.versionId));
            return hecho;
          };
          void generarPlaylist({ almacen: almacen(), playlistId: playlist.id, plan, generar: generarYQuedar }).catch(() => undefined);
          setFase('charla');
          return { tipo: 'playlist' as const, id: playlist.id };
        }
        setFase('charla');
        return null;
      } catch (e) {
        setFase('error');
        setError(e instanceof Error ? e.message : 'No ha salido. Prueba otra vez.');
        return null;
      } finally {
        setAvance(null);
      }
    },
    [falso, opciones.hayCuenta, receta, plan],
  );

  const reiniciar = useCallback(() => {
    setEstado(conversacionVacia());
    setMensajes([]);
    setFase('charla');
    setError(null);
    playlistDestino.current = null;
  }, [setEstado]);

  return {
    mensajes,
    pregunta,
    quiere: estado.quiere,
    receta,
    plan,
    resumen,
    creditos: falso ? 0 : creditos,
    creditosBoceto: falso ? 0 : creditosDeBoceto(),
    falso,
    fase,
    avance,
    error,
    empezado: estado.frases.length > 0,
    escribir,
    responder,
    generar,
    reiniciar,
  };
}
