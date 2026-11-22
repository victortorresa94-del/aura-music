'use client';

/**
 * Lo que hace cada comando de los menús (`src/lib/daw/menus/comandos.ts`).
 * La barra del PC, el menú del nombre en el móvil y los atajos llaman todos a
 * `ejecutar`, así que «Guardar» hace lo mismo se pida como se pida.
 *
 * Lo que es de la pantalla (abrir una hoja, ir a «Tus ideas», cambiar el
 * tema) lo pone StudioApp en `pantalla`; aquí solo se decide qué toca.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { downloadBlob, encodeWav, slugify } from '@/lib/daw/audio';
import * as store from '@/lib/daw/storage';
import { audiosDeLaIdea, crearZipDeIdea, nombreDelZip, type AudioDeIdea } from '@/lib/pwa/copia';
import { comandoDeTecla, escribiendo, type IdComando } from '@/lib/daw/menus/comandos';
import type { Project } from '@/lib/daw/types';
import type { Studio } from './useStudio';

/** Lo que el estudio sabe hacer con su pantalla. */
export interface AccionesDePantalla {
  irAInicio: () => void;
  abrirAjustes: () => void;
  abrirPista: () => void;
  abrirMezclador: () => void;
  abrirProductor: () => void;
  tocar: () => void;
  loops: () => void;
  ponerTema: (modo: 'light' | 'dark' | 'system') => void;
  verAtajos: () => void;
  verIntro: () => void;
}

/** ¿Mac? Para enseñar ⌘ y escuchar ⌘ en vez de Ctrl. */
export function esMac(): boolean {
  if (typeof navigator === 'undefined') return false;
  const datos = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData;
  return /mac|iphone|ipad/i.test(datos?.platform ?? navigator.platform ?? navigator.userAgent);
}

export function useArchivo(studio: Studio, pantalla: AccionesDePantalla) {
  const { project, engine, setStatus } = studio;
  const [exportando, setExportando] = useState(false);
  /** Renombrar se hace en el propio nombre de la cabecera: esto lo pone a escribir. */
  const [renombrando, setRenombrando] = useState(false);
  /** La idea que se va a borrar, a la espera de que lo confirmes. */
  const [porBorrar, setPorBorrar] = useState<Project | null>(null);
  const entradaAudio = useRef<HTMLInputElement | null>(null);
  const mac = useRef(false);
  useEffect(() => {
    mac.current = esMac();
  }, []);

  /**
   * Compartir o descargar. Cerrar la hoja de compartir sin elegir no es un
   * fallo; cualquier otro fallo de compartir (en Safari, el gesto caduca si
   * la mezcla tarda) cae a descargar en vez de rendirse.
   */
  const compartirODescargar = useCallback(async (blob: Blob, nombre: string, titulo: string, compartir: boolean) => {
    const fichero = new File([blob], nombre, { type: blob.type || 'application/octet-stream' });
    if (compartir) {
      try {
        if (navigator.canShare?.({ files: [fichero] })) {
          await navigator.share({ files: [fichero], title: titulo });
          return 'compartida' as const;
        }
      } catch (error) {
        if ((error as DOMException)?.name === 'AbortError') return 'cancelada' as const;
      }
    }
    downloadBlob(blob, nombre);
    return 'descargada' as const;
  }, []);

  const exportarMezcla = useCallback(
    async (compartir: boolean) => {
      if (!engine || project.tracks.length === 0) {
        setStatus('Todavía no hay pistas que exportar');
        return;
      }
      setExportando(true);
      try {
        const blob = encodeWav(await engine.renderMix(project));
        const resultado = await compartirODescargar(blob, `${slugify(project.name)}.wav`, project.name, compartir);
        if (resultado === 'cancelada') setStatus(null);
        else setStatus(resultado === 'compartida' ? 'Canción compartida' : 'Canción descargada en WAV');
      } catch {
        setStatus('No he podido generar el WAV, pero la idea sigue guardada: no se ha perdido nada.');
      } finally {
        setExportando(false);
      }
    },
    [engine, project, setStatus, compartirODescargar],
  );

  const exportarPistas = useCallback(async () => {
    if (!engine || project.tracks.length === 0) {
      setStatus('Todavía no hay pistas que exportar');
      return;
    }
    setExportando(true);
    try {
      for (const [i, track] of project.tracks.entries()) {
        const blob = encodeWav(await engine.renderMix(project, [track]));
        downloadBlob(blob, `${slugify(project.name)}-${i + 1}-${slugify(track.name)}.wav`);
        // Uno a uno: Safari descarta el resto si se lanzan varios a la vez.
        await new Promise((resolve) => setTimeout(resolve, 350));
      }
      setStatus(`${project.tracks.length} ${project.tracks.length === 1 ? 'pista descargada' : 'pistas descargadas'} en WAV`);
    } catch {
      setStatus('No he podido sacar todas las pistas, pero siguen en el estudio.');
    } finally {
      setExportando(false);
    }
  }, [engine, project, setStatus]);

  /** La idea entera en un zip (el proyecto y un WAV por pista), como la copia de Ajustes. */
  const exportarZip = useCallback(async () => {
    setExportando(true);
    try {
      const audios = new Map<string, AudioDeIdea>();
      for (const bufferId of audiosDeLaIdea(project)) {
        const guardado = await store.getAudio(bufferId);
        if (guardado) {
          audios.set(bufferId, guardado);
          continue;
        }
        // Lo que suena pero aún no ha llegado a disco también va.
        const enMemoria = engine?.getBuffer(bufferId);
        if (!enMemoria) continue;
        const channels: Float32Array[] = [];
        for (let c = 0; c < enMemoria.numberOfChannels; c++) channels.push(new Float32Array(enMemoria.getChannelData(c)));
        audios.set(bufferId, { channels, sampleRate: enMemoria.sampleRate });
      }
      const zip = crearZipDeIdea(project, audios);
      downloadBlob(new Blob([zip as Uint8Array<ArrayBuffer>], { type: 'application/zip' }), nombreDelZip(project));
      setStatus(`Idea completa descargada: «${project.name}»`);
    } catch {
      setStatus('No he podido preparar el zip. La idea sigue intacta.');
    } finally {
      setExportando(false);
    }
  }, [engine, project, setStatus]);

  const borrarConfirmado = useCallback(async () => {
    const idea = porBorrar;
    if (!idea) return;
    setPorBorrar(null);
    await studio.removeProject(idea);
    setStatus(`«${idea.name}» borrada`);
    // Sin la idea abierta no hay estudio que enseñar: a «Tus ideas».
    pantalla.irAInicio();
  }, [porBorrar, studio, setStatus, pantalla]);

  const ejecutar = useCallback(
    (id: IdComando) => {
      const pista = studio.selectedTrack;
      switch (id) {
        case 'nueva':
          void studio.newProject().then(() => setStatus('Idea nueva. Toca el botón rojo cuando quieras.'));
          return;
        case 'abrir':
        case 'cerrar':
          // Cerrar no pierde nada (todo se guarda solo, y lo pendiente se
          // escribe igual): lleva a «Tus ideas», que es la raíz.
          void engine?.stop();
          pantalla.irAInicio();
          return;
        case 'guardar':
          void studio.guardar();
          return;
        case 'guardarCopia':
          void studio.guardarCopia();
          return;
        case 'renombrar':
          setRenombrando(true);
          return;
        case 'exportarWav':
          void exportarMezcla(false);
          return;
        case 'exportarPistas':
          void exportarPistas();
          return;
        case 'exportarZip':
          void exportarZip();
          return;
        case 'compartir':
          void exportarMezcla(true);
          return;
        case 'importarAudio':
          entradaAudio.current?.click();
          return;
        case 'borrar':
          setPorBorrar(studio.project);
          return;
        case 'deshacer':
          studio.undo();
          return;
        case 'rehacer':
          studio.redo();
          return;
        case 'ajustes':
        case 'latencia':
          pantalla.abrirAjustes();
          return;
        case 'tocar':
          pantalla.tocar();
          return;
        case 'loops':
          pantalla.loops();
          return;
        case 'opcionesPista':
          if (pista) pantalla.abrirPista();
          return;
        case 'duplicarPista':
          if (pista) studio.duplicateTrack(pista.id);
          return;
        case 'silenciarPista':
          if (pista) studio.toggleMute(pista.id);
          return;
        case 'soloPista':
          if (pista) studio.toggleSolo(pista.id);
          return;
        case 'borrarPista':
          if (pista) {
            studio.deleteTrack(pista.id);
            setStatus(`«${pista.name}» borrada. Puedes deshacer.`);
          }
          return;
        case 'mezclador':
          pantalla.abrirMezclador();
          return;
        case 'productor':
          pantalla.abrirProductor();
          return;
        case 'temaClaro':
          pantalla.ponerTema('light');
          return;
        case 'temaOscuro':
          pantalla.ponerTema('dark');
          return;
        case 'temaSistema':
          pantalla.ponerTema('system');
          return;
        case 'atajos':
          pantalla.verAtajos();
          return;
        case 'intro':
          pantalla.verIntro();
          return;
      }
    },
    [studio, engine, pantalla, setStatus, exportarMezcla, exportarPistas, exportarZip],
  );

  /* Los atajos de teclado. Un solo oyente para todos (antes solo había
     Ctrl+Z). Se apartan si estás escribiendo en un campo: ahí Ctrl+Z deshace
     lo escrito, no la última acción de la idea. Con una hoja abierta también
     funcionan, como en cualquier programa. */
  const ejecutarRef = useRef(ejecutar);
  ejecutarRef.current = ejecutar;
  useEffect(() => {
    const alPulsar = (event: KeyboardEvent) => {
      if (event.repeat || escribiendo(event.target as HTMLElement | null)) return;
      const id = comandoDeTecla(event, mac.current);
      if (!id) return;
      event.preventDefault();
      ejecutarRef.current(id);
    };
    window.addEventListener('keydown', alPulsar);
    return () => window.removeEventListener('keydown', alPulsar);
  }, []);

  return {
    ejecutar,
    exportando,
    renombrando,
    setRenombrando,
    porBorrar,
    /** Borrar otra idea (desde «Tus ideas»): pide la misma confirmación. */
    pedirBorrado: (idea: Project) => setPorBorrar(idea),
    cancelarBorrado: () => setPorBorrar(null),
    borrarConfirmado,
    /** El `<input type=file>` escondido de «Importar audio…». */
    entradaAudio,
    mac: () => mac.current,
  };
}

export type Archivo = ReturnType<typeof useArchivo>;
