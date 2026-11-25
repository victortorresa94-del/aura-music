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
import {
  audiosDeLaIdea,
  crearZipDeIdea,
  ErrorDeCopia,
  leerZipDeIdea,
  nombreDelZip,
  prepararParaImportar,
  type AudioDeIdea,
} from '@/lib/pwa/copia';
import { esCuotaLlena } from '@/lib/pwa/espacio';
import {
  atajoPermitido,
  comandoDeTecla,
  escribiendo,
  SE_REPITEN,
  teclaDelMando,
  type IdComando,
  type ModoTeclado,
} from '@/lib/daw/menus/comandos';
import type { Project } from '@/lib/daw/types';
import type { Studio } from './useStudio';
import { useEdicion } from './useEdicion';

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
  /** Añadir: la hoja «+ Añadir» y el músico («Ponle algo debajo»). */
  abrirAnadir?: () => void;
  abrirMusico?: () => void;
  /**
   * Qué hay en pantalla, para los atajos de teclas sueltas: con una hoja o
   * el mezclador encima no editan la línea de tiempo, y con «Tocar» abierto
   * el teclado toca notas. Sin él, como si el estudio estuviera a la vista.
   */
  modoTeclado?: () => ModoTeclado;
  /** Pulsos por compás (4, o el ciclo del ritmo): las flechas saltan de compás en compás. */
  pulsosPorCompas?: () => number;
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
  /** «Importar una idea (.zip)…»: antes vivía en Ajustes. */
  const entradaIdea = useRef<HTMLInputElement | null>(null);
  const mac = useRef(false);
  useEffect(() => {
    mac.current = esMac();
  }, []);
  // Transporte, portapapeles, cortar clips, cambiar de pista, zoom…
  const pantallaRef = useRef(pantalla);
  pantallaRef.current = pantalla;
  const edicion = useEdicion(studio, () => pantallaRef.current.pulsosPorCompas?.() ?? 4);

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

  /**
   * Una idea entera desde su zip (la que sale de Exportar › Idea completa).
   * El audio primero y el proyecto después: un proyecto nunca apunta a audio
   * que no está. Si ya existe, entra como copia y no se pisa nada.
   */
  const importarIdea = useCallback(
    async (fichero: File) => {
      setStatus('Abriendo la idea…');
      try {
        const leida = leerZipDeIdea(new Uint8Array(await fichero.arrayBuffer()));
        const yaExiste = (await store.loadProject(leida.proyecto.id)) !== null;
        const { proyecto, audios } = prepararParaImportar(leida.proyecto, leida.audios, yaExiste);
        for (const [bufferId, audio] of audios) await store.putAudio(bufferId, audio.channels, audio.sampleRate);
        await store.saveProject(proyecto);
        await studio.openProject(proyecto.id);
        setStatus(yaExiste ? `«${leida.proyecto.name}» ya estaba: la he metido como copia` : `Idea importada: «${proyecto.name}»`);
      } catch (fallo) {
        setStatus(
          fallo instanceof ErrorDeCopia
            ? fallo.message
            : esCuotaLlena(fallo)
              ? 'No cabe en este dispositivo. Haz sitio borrando ideas que ya tengas copiadas.'
              : 'No he podido importar esa idea. Lo que tenías sigue igual.',
        );
      }
    },
    [studio, setStatus],
  );

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
      // Los de la línea de tiempo (y duplicar, silenciar, solo y borrar la
      // pista) los resuelve `useEdicion`.
      if (edicion.ejecutar(id)) return;
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
        case 'anadir':
          pantalla.abrirAnadir?.();
          return;
        case 'musico':
          pantalla.abrirMusico?.();
          return;
        case 'importarAudio':
          entradaAudio.current?.click();
          return;
        case 'importarIdea':
          entradaIdea.current?.click();
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
    [studio, engine, pantalla, setStatus, exportarMezcla, exportarPistas, exportarZip, edicion],
  );

  /* Los atajos de teclado. Un solo oyente para todos. Se apartan si estás
     escribiendo en un campo: ahí Ctrl+Z deshace lo escrito y Retroceso
     borra una letra, no una pista. Los de Archivo y Deshacer valen también
     con una hoja abierta, como en cualquier programa; los de teclas sueltas
     que editan la línea de tiempo, solo con el estudio a la vista
     (`atajoPermitido`). En un deslizador, las flechas lo mueven a él. */
  const ejecutarRef = useRef(ejecutar);
  ejecutarRef.current = ejecutar;
  useEffect(() => {
    const alPulsar = (event: KeyboardEvent) => {
      const objetivo = event.target as HTMLElement | null;
      if (event.defaultPrevented || escribiendo(objetivo)) return;
      const id = comandoDeTecla(event, mac.current);
      if (!id) return;
      if (!atajoPermitido(id, pantallaRef.current.modoTeclado?.() ?? 'estudio')) return;
      if (teclaDelMando(objetivo, id)) return;
      // Espacio con el foco en un botón: reproduce, y no pulsa además el botón.
      event.preventDefault();
      if (event.repeat && !SE_REPITEN.has(id)) return;
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
    entradaIdea,
    importarIdea,
    mac: () => mac.current,
  };
}

export type Archivo = ReturnType<typeof useArchivo>;
