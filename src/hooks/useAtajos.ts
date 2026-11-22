'use client';

/**
 * Los atajos de teclado, conectados al estudio. Qué tecla es cada atajo y
 * su nombre en español viven en `src/lib/daw/atajos.ts`; aquí, qué hace.
 *
 * `ejecutar(id)` sirve también a los menús: «Editar → Copiar» y Ctrl+C
 * hacen lo mismo porque llaman a lo mismo.
 *
 * Cuándo no cuentan:
 *   · escribiendo en un campo (ahí Retroceso borra una letra);
 *   · con «Tocar» abierto (el teclado toca notas): `activo` a false;
 *   · con una hoja o el mezclador encima solo valen Espacio, Deshacer y
 *     Rehacer (`soloTransporte`): borrar una pista que no ves no.
 *
 * El portapapeles es del estudio, no del sistema: lo que se copia es una
 * pista entera (clip, volumen y mezcla), y vale también para pegarla en
 * otra idea.
 */

import { useCallback, useEffect, useRef } from 'react';
import type { Studio } from '@/hooks/useStudio';
import type { Track } from '@/lib/daw/types';
import { ATAJOS_DE_TRANSPORTE, atajoDe, escribiendoEn, teclaDelMando, type IdAtajo } from '@/lib/daw/atajos';
import { compasVecino, cortarPista, finDelProyecto, pegarPista, pistaTrasBorrar, pistaVecina } from '@/lib/daw/edicion';

/** La línea de tiempo escucha estos dos: acercar o alejar, y enseñar el cursor si se ha ido de la vista. */
export const EVENTO_ZOOM = 'daw:zoom';
export const EVENTO_VER_CURSOR = 'daw:ver-cursor';

/** Uno para toda la app: copiar en una idea y pegar en otra funciona. */
let portapapeles: Track | null = null;

/** Los que no tiene sentido repetir dejando la tecla pulsada. */
const SIN_REPETICION: ReadonlySet<IdAtajo> = new Set([
  'reproducir',
  'grabar',
  'deshacer',
  'rehacer',
  'copiar',
  'cortar',
  'pegar',
  'duplicar',
  'borrar',
  'dividir',
  'silenciar',
  'solo',
  'soltar',
]);

export function useAtajos(
  studio: Studio,
  {
    activo = true,
    soloTransporte = false,
    pulsosPorCompas = 4,
  }: { activo?: boolean; soloTransporte?: boolean; pulsosPorCompas?: number } = {},
) {
  const vivo = useRef(studio);
  vivo.current = studio;
  const compasRef = useRef(pulsosPorCompas);
  compasRef.current = pulsosPorCompas;

  const ejecutar = useCallback((id: IdAtajo): boolean => {
    const s = vivo.current;
    const { project, selectedTrackId: elegida, engine, setStatus } = s;
    const pista = elegida ? project.tracks.find((track) => track.id === elegida) ?? null : null;
    const cursor = engine?.position ?? 0;
    const pedirPista = (que: string) => {
      setStatus(`Elige una pista para ${que}`);
      return false;
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
      case 'deshacer':
        s.undo();
        return true;
      case 'rehacer':
        s.redo();
        return true;

      case 'copiar':
        if (!pista) return pedirPista('copiarla');
        portapapeles = pista;
        setStatus(`«${pista.name}» copiada. Ctrl+V la pega en el cursor.`);
        return true;
      case 'cortar': {
        if (!pista) return pedirPista('cortarla');
        portapapeles = pista;
        const siguiente = pistaTrasBorrar(project, pista.id);
        s.deleteTrack(pista.id);
        s.setSelectedTrackId(siguiente);
        setStatus(`«${pista.name}» cortada. Ctrl+V la pega en el cursor.`);
        return true;
      }
      case 'pegar': {
        if (!portapapeles) {
          setStatus('No hay nada copiado');
          return false;
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
      case 'duplicar':
        if (!pista) return pedirPista('duplicarla');
        s.duplicateTrack(pista.id);
        setStatus(`«${pista.name}» duplicada debajo`);
        return true;
      case 'borrar': {
        if (!pista) return pedirPista('borrarla');
        const siguiente = pistaTrasBorrar(project, pista.id);
        s.deleteTrack(pista.id);
        s.setSelectedTrackId(siguiente);
        return true;
      }
      case 'dividir': {
        if (!pista) return pedirPista('cortar su clip');
        const prueba = cortarPista(project, pista.id, cursor);
        if (!prueba) {
          setStatus('Pon el cursor dentro del clip para cortarlo');
          return false;
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

      case 'silenciar':
        if (!pista) return pedirPista('silenciarla');
        s.toggleMute(pista.id);
        return true;
      case 'solo':
        if (!pista) return pedirPista('ponerla en solo');
        s.toggleSolo(pista.id);
        return true;
      case 'pista-arriba':
      case 'pista-abajo': {
        const destino = pistaVecina(project, elegida, id === 'pista-arriba' ? -1 : 1);
        if (!destino) return false;
        s.setSelectedTrackId(destino);
        document.querySelector(`[data-cabecera="${destino}"]`)?.scrollIntoView({ block: 'nearest' });
        return true;
      }
      case 'soltar':
        if (!elegida) return false;
        s.setSelectedTrackId(null);
        return true;

      case 'inicio':
        mover(0);
        return true;
      case 'fin':
        mover(finDelProyecto(project));
        return true;
      case 'compas-atras':
      case 'compas-adelante':
        mover(compasVecino(cursor, (60 / project.bpm) * compasRef.current, id === 'compas-atras' ? -1 : 1));
        return true;

      case 'zoom-mas':
      case 'zoom-menos':
        window.dispatchEvent(new CustomEvent(EVENTO_ZOOM, { detail: id === 'zoom-mas' ? 1.4 : 1 / 1.4 }));
        return true;
    }
  }, []);

  useEffect(() => {
    if (!activo) return;
    const alPulsar = (event: KeyboardEvent) => {
      if (event.defaultPrevented || escribiendoEn(event.target)) return;
      const id = atajoDe(event);
      if (!id) return;
      if (soloTransporte && !ATAJOS_DE_TRANSPORTE.has(id)) return;
      if (teclaDelMando(event.target, id)) return;
      // Las letras sueltas con el foco en un botón: el atajo manda, y
      // Espacio no pulsa además el botón que tenga el foco.
      event.preventDefault();
      if (event.repeat && SIN_REPETICION.has(id)) return;
      ejecutar(id);
    };
    window.addEventListener('keydown', alPulsar);
    return () => window.removeEventListener('keydown', alPulsar);
  }, [activo, soloTransporte, ejecutar]);

  /** Para pintar apagado lo que ahora no se puede hacer (los menús). */
  const disponible = useCallback((id: IdAtajo): boolean => {
    const s = vivo.current;
    const hayPista = !!s.selectedTrackId;
    switch (id) {
      case 'copiar':
      case 'cortar':
      case 'duplicar':
      case 'borrar':
      case 'dividir':
      case 'silenciar':
      case 'solo':
      case 'soltar':
        return hayPista;
      case 'pegar':
        return portapapeles !== null;
      case 'deshacer':
        return s.hayDeshacer();
      case 'rehacer':
        return s.hayRehacer();
      default:
        return true;
    }
  }, []);

  return { ejecutar, disponible };
}

export type Atajos = ReturnType<typeof useAtajos>;
