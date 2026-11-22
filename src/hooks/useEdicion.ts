'use client';

/**
 * Lo que hacen los comandos de la línea de tiempo: reproducir y grabar,
 * mover el cursor, copiar, cortar y pegar pistas, cortar un clip en el
 * cursor, cambiar de pista, silenciar, solo, borrar y el zoom.
 *
 * Los atajos y los menús salen de la misma tabla (`lib/daw/menus/comandos.ts`)
 * y pasan por `useArchivo().ejecutar`, que delega aquí estos. Así «Editar →
 * Copiar» y Ctrl+C hacen exactamente lo mismo.
 *
 * El portapapeles es del estudio, no del sistema: lo que se copia es una
 * pista entera (clip, volumen y mezcla), y vale también para pegarla en otra
 * idea.
 */

import { useCallback, useRef } from 'react';
import type { Studio } from '@/hooks/useStudio';
import type { Track } from '@/lib/daw/types';
import type { IdComando } from '@/lib/daw/menus/comandos';
import { compasVecino, cortarPista, finDelProyecto, pegarPista, pistaTrasBorrar, pistaVecina } from '@/lib/daw/edicion';

/** La línea de tiempo escucha estos dos: acercar o alejar, y enseñar el cursor si se ha ido de la vista. */
export const EVENTO_ZOOM = 'daw:zoom';
export const EVENTO_VER_CURSOR = 'daw:ver-cursor';

/** Uno para toda la app: copiar en una idea y pegar en otra funciona. */
let portapapeles: Track | null = null;

/** ¿Hay algo copiado? Para pintar «Pegar» apagado. */
export function hayAlgoCopiado(): boolean {
  return portapapeles !== null;
}

export function useEdicion(studio: Studio, pulsosPorCompas: () => number = () => 4) {
  const vivo = useRef({ studio, pulsosPorCompas });
  vivo.current = { studio, pulsosPorCompas };

  /** Hace el comando si es de los suyos y devuelve true; si no, false (y no hace nada). */
  const ejecutar = useCallback((id: IdComando): boolean => {
    const { studio: s, pulsosPorCompas: pulsos } = vivo.current;
    const { project, selectedTrackId: elegida, engine, setStatus } = s;
    const pista = elegida ? project.tracks.find((track) => track.id === elegida) ?? null : null;
    const cursor = engine?.position ?? 0;
    const pedirPista = (que: string) => {
      setStatus(`Elige una pista para ${que}`);
      return true;
    };
    const mover = (t: number) => {
      s.seek(t);
      window.dispatchEvent(new CustomEvent(EVENTO_VER_CURSOR));
    };

    switch (id) {
      case 'reproducir':
        void s.play();
        return true;
      case 'grabar':
        void s.record();
        return true;

      case 'copiarPista':
        if (!pista) return pedirPista('copiarla');
        portapapeles = pista;
        setStatus(`«${pista.name}» copiada. Ctrl+V la pega en el cursor.`);
        return true;
      case 'cortarPista': {
        if (!pista) return pedirPista('cortarla');
        portapapeles = pista;
        const siguiente = pistaTrasBorrar(project, pista.id);
        s.deleteTrack(pista.id);
        s.setSelectedTrackId(siguiente);
        setStatus(`«${pista.name}» cortada. Ctrl+V la pega en el cursor.`);
        return true;
      }
      case 'pegarPista': {
        if (!portapapeles) {
          setStatus('No hay nada copiado');
          return true;
        }
        const copiada = portapapeles;
        let nuevaId: string | null = null;
        s.commit((actual) => {
          const r = pegarPista(actual, copiada, cursor, elegida);
          nuevaId = r.nuevaId;
          return r.proyecto;
        });
        if (nuevaId) s.setSelectedTrackId(nuevaId);
        return true;
      }
      case 'duplicarPista':
        if (!pista) return pedirPista('duplicarla');
        s.duplicateTrack(pista.id);
        setStatus(`«${pista.name}» duplicada debajo`);
        return true;
      case 'borrarPista': {
        if (!pista) return pedirPista('borrarla');
        const siguiente = pistaTrasBorrar(project, pista.id);
        s.deleteTrack(pista.id);
        // Se queda elegida la de su sitio: Supr, Supr, Supr borra seguidas.
        s.setSelectedTrackId(siguiente);
        setStatus(`«${pista.name}» borrada. Puedes deshacer.`);
        return true;
      }
      case 'dividirClip': {
        if (!pista) return pedirPista('cortar su clip');
        if (!cortarPista(project, pista.id, cursor)) {
          setStatus('Pon el cursor dentro del clip para cortarlo');
          return true;
        }
        let nuevaId: string | null = null;
        let ajustado = false;
        s.commit((actual) => {
          const r = cortarPista(actual, pista.id, cursor);
          if (!r) return actual;
          nuevaId = r.nuevaId;
          ajustado = r.ajustadoAVuelta;
          return r.proyecto;
        });
        if (nuevaId) s.setSelectedTrackId(nuevaId);
        setStatus(
          ajustado
            ? 'Cortado entre dos vueltas. La segunda parte va en la pista de abajo.'
            : 'Cortado. La segunda parte va en la pista de abajo.',
        );
        return true;
      }

      case 'silenciarPista':
        if (!pista) return pedirPista('silenciarla');
        s.toggleMute(pista.id);
        return true;
      case 'soloPista':
        if (!pista) return pedirPista('ponerla en solo');
        s.toggleSolo(pista.id);
        return true;
      case 'pistaArriba':
      case 'pistaAbajo': {
        const destino = pistaVecina(project, elegida, id === 'pistaArriba' ? -1 : 1);
        if (!destino) return true;
        s.setSelectedTrackId(destino);
        document.querySelector(`[data-cabecera="${destino}"]`)?.scrollIntoView({ block: 'nearest' });
        return true;
      }
      case 'soltarPista':
        s.setSelectedTrackId(null);
        return true;

      case 'irAlPrincipio':
        mover(0);
        return true;
      case 'irAlFinal':
        mover(finDelProyecto(project));
        return true;
      case 'compasAtras':
      case 'compasAdelante':
        mover(compasVecino(cursor, (60 / project.bpm) * pulsos(), id === 'compasAtras' ? -1 : 1));
        return true;

      case 'acercar':
      case 'alejar':
        window.dispatchEvent(new CustomEvent(EVENTO_ZOOM, { detail: id === 'acercar' ? 1.4 : 1 / 1.4 }));
        return true;

      default:
        return false;
    }
  }, []);

  return { ejecutar };
}
