'use client';

/**
 * Qué hay en cada menú, la barra del PC y el menú del nombre en el móvil.
 * El contenido sale de una sola función (`useMenus`): lo que se ve en la barra
 * y en el móvil es lo mismo, y los atajos que se enseñan salen de la tabla de
 * `comandos.ts`, que es la que escucha el teclado.
 */

import {
  ArrowClockwise,
  ArrowCounterClockwise,
  ClipboardText,
  ClockCounterClockwise,
  Copy,
  CopySimple,
  Desktop,
  Export,
  FileAudio,
  FilePlus,
  FileZip,
  FloppyDisk,
  FolderOpen,
  Gauge,
  GearSix,
  Headphones,
  Keyboard,
  Moon,
  PencilSimple,
  PianoKeys,
  PlayCircle,
  Plus,
  Repeat,
  Scissors,
  ShareNetwork,
  SlidersHorizontal,
  Sparkle,
  SpeakerSlash,
  Stack,
  Sun,
  Trash,
  Waveform,
  XSquare,
} from '@phosphor-icons/react';
import { hayAlgoCopiado } from '@/hooks/useEdicion';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Archivo } from '@/hooks/useArchivo';
import { IconoArcilla } from '@/components/iconos/IconoArcilla';
import type { IdArcilla } from '@/lib/iconos/arcilla';
import type { Studio } from '@/hooks/useStudio';
import { haceCuanto, textoAtajo, type IdComando } from '@/lib/daw/menus/comandos';
import { listProjects } from '@/lib/daw/storage';
import type { Project } from '@/lib/daw/types';
import { IconoMezclador } from '../mezclador/icono';
import { T, type ThemeMode } from '../theme';
import { PanelDeMenu, type Entrada } from './PanelDeMenu';

const I = 17;
const SEP = (clave: string): Entrada => ({ tipo: 'separador', clave });

export interface Menu {
  clave: string;
  texto: string;
  entradas: Entrada[];
}

/** «Guardado hace 3 s», «Guardando…» o el fallo, para la fila de Guardar y la cabecera. */
export function textoGuardado(studio: Studio, ahora: number): string {
  if (studio.guardado === 'guardando') return 'Guardando…';
  if (studio.guardado === 'error') return 'No se ha podido guardar';
  return `Guardado ${haceCuanto(studio.guardadoEn, ahora)}`;
}

export function useMenus(studio: Studio, archivo: Archivo, tema: ThemeMode) {
  const [recientes, setRecientes] = useState<Project[]>([]);
  const [ahora, setAhora] = useState(() => Date.now());

  /** Al abrir un menú: la lista de ideas y la hora del «hace N s». */
  const refrescar = useCallback(() => {
    setAhora(Date.now());
    void listProjects().then(setRecientes, () => undefined);
  }, []);

  const mac = archivo.mac();
  const { project, selectedTrack: pista } = studio;
  // Mientras se exporta no se lanza otra exportación encima.
  const exportandoNada = !archivo.exportando;
  const sinPistas = project.tracks.length === 0;
  const item = (id: IdComando, texto: string, icono: ReactNode, extra: Partial<Extract<Entrada, { tipo: 'item' }>> = {}): Entrada => ({
    tipo: 'item',
    clave: id,
    texto,
    icono,
    atajo: textoAtajo(id, mac),
    alElegir: () => archivo.ejecutar(id),
    ...extra,
  });

  const otras = recientes.filter((p) => p.id !== project.id).slice(0, 6);
  const recientesSub: Entrada = {
    tipo: 'sub',
    clave: 'recientes',
    texto: 'Ideas recientes',
    icono: <ClockCounterClockwise size={I} />,
    desactivado: otras.length === 0,
    hijos: otras.map((p) => ({
      tipo: 'item',
      clave: p.id,
      texto: p.name,
      detalle: `${p.tracks.length} ${p.tracks.length === 1 ? 'pista' : 'pistas'} · ${haceCuanto(p.updatedAt, ahora)}`,
      alElegir: () => void studio.openProject(p.id),
    })),
  };

  const archivoMenu: Entrada[] = [
    item('nueva', 'Nueva idea', <FilePlus size={I} />),
    item('abrir', 'Abrir…', <FolderOpen size={I} />),
    recientesSub,
    SEP('s1'),
    item('guardar', 'Guardar', <FloppyDisk size={I} />, { detalle: textoGuardado(studio, ahora) }),
    item('guardarCopia', 'Guardar como copia', <Copy size={I} />),
    item('renombrar', 'Renombrar', <PencilSimple size={I} />),
    SEP('s2'),
    {
      tipo: 'sub',
      clave: 'exportar',
      texto: archivo.exportando ? 'Exportando…' : 'Exportar',
      icono: <Export size={I} />,
      desactivado: !exportandoNada,
      hijos: [
        item('exportarWav', 'Canción en WAV', <Waveform size={I} />, { desactivado: sinPistas }),
        item('exportarPistas', 'Pistas sueltas', <Stack size={I} />, { desactivado: sinPistas }),
        item('exportarZip', 'Idea completa (.zip)', <FileZip size={I} />),
      ],
    },
    item('importarAudio', 'Importar audio…', <FileAudio size={I} />),
    item('importarIdea', 'Importar una idea (.zip)…', <FileZip size={I} />),
    item('compartir', 'Compartir…', <ShareNetwork size={I} />, { desactivado: sinPistas || !exportandoNada }),
    SEP('s3'),
    // Ajustes es del equipo y de tu cuenta, no de la idea; va aquí porque es
    // donde se busca en un programa de escritorio (y en el móvil, al final
    // del menú del nombre, que es este mismo).
    item('ajustes', 'Ajustes y cuenta…', <GearSix size={I} />),
    SEP('s4'),
    item('cerrar', 'Cerrar idea', <XSquare size={I} />),
    item('borrar', 'Borrar idea…', <Trash size={I} />, { peligro: true }),
  ];

  const sinPista = !pista;
  // Cortar el clip solo si el cursor cae dentro del de la pista elegida.
  const cursor = studio.engine?.position ?? 0;
  const cursorEnClip =
    !!pista && cursor > pista.clip.start && cursor < pista.clip.start + pista.clip.duration * pista.clip.repeats;
  const editarMenu: Entrada[] = [
    item('deshacer', 'Deshacer', <ArrowCounterClockwise size={I} />, { desactivado: !studio.hayDeshacer() }),
    item('rehacer', 'Rehacer', <ArrowClockwise size={I} />, { desactivado: !studio.hayRehacer() }),
    SEP('e1'),
    item('cortarPista', 'Cortar', <Scissors size={I} />, { desactivado: sinPista }),
    item('copiarPista', 'Copiar', <Copy size={I} />, { desactivado: sinPista }),
    item('pegarPista', 'Pegar en el cursor', <ClipboardText size={I} />, { desactivado: !hayAlgoCopiado() }),
    item('duplicarPista', 'Duplicar', <CopySimple size={I} />, { desactivado: sinPista }),
    item('dividirClip', 'Cortar el clip en el cursor', <Scissors size={I} />, { desactivado: !cursorEnClip }),
    item('borrarPista', 'Borrar la pista', <Trash size={I} />, { desactivado: sinPista, peligro: !sinPista }),
  ];

  /* Añadir: un solo sitio con todas las formas de meter una pista (lo mismo
     que la hoja «+ Añadir» del estudio), con sus iconos de arcilla. */
  const arcilla = (id: IdArcilla) => <IconoArcilla id={id} tamano={22} />;
  const pistaMenu: Entrada[] = [
    {
      tipo: 'sub',
      clave: 'anadir',
      texto: 'Añadir',
      icono: <Plus size={I} />,
      hijos: [
        item('grabar', 'Grabar voz o instrumento', arcilla('micro')),
        item('tocar', 'Tocar un instrumento…', arcilla('piano')),
        item('loops', 'Poner un loop…', arcilla('loops')),
        item('musico', 'Ponle algo debajo (IA)…', arcilla('productor'), { desactivado: project.tracks.length === 0 }),
        item('productor', 'Pídeselo al productor…', arcilla('productor')),
        item('importarAudio', 'Importar audio…', arcilla('altavoz')),
      ],
    },
    SEP('p1'),
    item('opcionesPista', pista ? `Opciones de «${pista.name}»…` : 'Opciones de la pista…', <SlidersHorizontal size={I} />, { desactivado: sinPista }),
    item('duplicarPista', 'Duplicar', <CopySimple size={I} />, { desactivado: sinPista }),
    item('silenciarPista', pista?.muted ? 'Quitar el silencio' : 'Silenciar', <SpeakerSlash size={I} />, { desactivado: sinPista }),
    item('soloPista', pista?.soloed ? 'Quitar el solo' : 'Solo', <Headphones size={I} />, { desactivado: sinPista }),
    SEP('p2'),
    item('borrarPista', 'Borrar la pista', <Trash size={I} />, { desactivado: sinPista, peligro: !sinPista }),
  ];

  const verMenu: Entrada[] = [
    item('mezclador', 'Mezclador', <IconoMezclador size={I} color="currentColor" />),
    item('productor', 'Productor', <Sparkle size={I} />),
    SEP('v1'),
    item('temaClaro', 'Claro', <Sun size={I} />, { marcado: tema === 'light' }),
    item('temaOscuro', 'Oscuro', <Moon size={I} />, { marcado: tema === 'dark' }),
    item('temaSistema', 'Como el sistema', <Desktop size={I} />, { marcado: tema === 'system' }),
  ];

  const ayudaMenu: Entrada[] = [
    item('atajos', 'Atajos de teclado', <Keyboard size={I} />),
    item('latencia', 'Calibrar la latencia…', <Gauge size={I} />),
    item('intro', 'Ver la introducción', <PlayCircle size={I} />),
  ];

  const barra: Menu[] = [
    { clave: 'archivo', texto: 'Archivo', entradas: archivoMenu },
    { clave: 'editar', texto: 'Editar', entradas: editarMenu },
    { clave: 'pista', texto: 'Pista', entradas: pistaMenu },
    { clave: 'ver', texto: 'Ver', entradas: verMenu },
    { clave: 'ayuda', texto: 'Ayuda', entradas: ayudaMenu },
  ];

  // En el móvil, desde el nombre: lo mismo que Archivo (con Ajustes y cuenta).
  const movil: Entrada[] = archivoMenu;

  return { barra, movil, refrescar, ahora };
}

/* -------------------------------------------------------------------------- */
/* La barra del PC                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Archivo, Editar, Pista, Ver y Ayuda. Se abre al apretar (no al soltar), y
 * con un menú abierto basta pasar el ratón por otro título para cambiar, sin
 * animación: así funcionan los menús de escritorio y así se espera.
 */
export function BarraDeMenus({ menus, onAbrir }: { menus: Menu[]; onAbrir: () => void }) {
  const [abierto, setAbierto] = useState<number | null>(null);
  const [animar, setAnimar] = useState(true);
  const raiz = useRef<HTMLDivElement | null>(null);
  const botones = useRef<(HTMLButtonElement | null)[]>([]);
  const ultimoPuntero = useRef<string>('mouse');

  useEffect(() => {
    if (abierto === null) return;
    const fuera = (event: PointerEvent) => {
      if (!raiz.current?.contains(event.target as Node)) setAbierto(null);
    };
    window.addEventListener('pointerdown', fuera);
    return () => window.removeEventListener('pointerdown', fuera);
  }, [abierto]);

  const abrir = (i: number | null, conAnimacion: boolean) => {
    if (i !== null) onAbrir();
    setAnimar(conAnimacion);
    setAbierto(i);
  };

  return (
    <div ref={raiz} role="menubar" aria-label="Menús de la idea" style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      {menus.map((menu, i) => {
        const esteAbierto = abierto === i;
        return (
          <div key={menu.clave} style={{ position: 'relative' }}>
            <button
              ref={(nodo) => {
                botones.current[i] = nodo;
              }}
              type="button"
              role="menuitem"
              aria-haspopup="menu"
              aria-expanded={esteAbierto}
              onPointerDown={(event) => {
                ultimoPuntero.current = event.pointerType;
                if (event.pointerType !== 'mouse' || event.button !== 0) return;
                event.preventDefault();
                abrir(esteAbierto ? null : i, !esteAbierto && abierto === null);
              }}
              onClick={() => {
                // El ratón ya lo abrió al apretar; aquí llegan el dedo y el teclado.
                if (ultimoPuntero.current === 'mouse') {
                  ultimoPuntero.current = '';
                  return;
                }
                abrir(esteAbierto ? null : i, abierto === null);
              }}
              onPointerEnter={(event) => {
                if (event.pointerType === 'mouse' && abierto !== null && !esteAbierto) abrir(i, false);
              }}
              onKeyDown={(event) => {
                const n = menus.length;
                if (event.key === 'ArrowDown') {
                  event.preventDefault();
                  abrir(i, true);
                } else if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
                  event.preventDefault();
                  botones.current[(i + (event.key === 'ArrowRight' ? 1 : -1) + n) % n]?.focus();
                }
              }}
              className="daw-hover"
              style={{
                height: 30,
                padding: '0 10px',
                border: 'none',
                borderRadius: 8,
                background: esteAbierto ? T.fillStrong : 'transparent',
                color: T.text,
                fontFamily: T.fontBody,
                fontSize: 13.5,
                fontWeight: 500,
                letterSpacing: '-0.005em',
                cursor: 'default',
              }}
            >
              {menu.texto}
            </button>
            {esteAbierto ? (
              <PanelDeMenu
                entradas={menu.entradas}
                etiqueta={menu.texto}
                animar={animar}
                onCerrar={(porTeclado) => {
                  setAbierto(null);
                  if (porTeclado) botones.current[i]?.focus();
                }}
                onSalir={(direccion) => abrir((i + direccion + menus.length) % menus.length, false)}
                style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0 }}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
