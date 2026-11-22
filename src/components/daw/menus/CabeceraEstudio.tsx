'use client';

/**
 * La cabecera del estudio con sus menús.
 *
 * En el PC (1024 px o más) es la de un programa de escritorio: la marca y la
 * barra Archivo, Editar, Pista, Ver y Ayuda a la izquierda; la idea en el
 * centro con su estado de guardado; y a la derecha lo que se mira y se toca a
 * menudo: el tempo en una píldora, «Productor» (el único verde, porque lo
 * hace Aura) y «Mezclar».
 *
 * En el móvil no caben cinco menús: el nombre de la idea abre el de Archivo
 * (y Ajustes al final), y a la derecha quedan el tempo y tres iconos.
 */

import { CaretDown, Sparkle } from '@phosphor-icons/react';
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { Archivo } from '@/hooks/useArchivo';
import type { Studio } from '@/hooks/useStudio';
import { ATAJOS, textoAtajo, type IdComando } from '@/lib/daw/menus/comandos';
import { IconoMezclador } from '../mezclador/icono';
import { haptic, T } from '../theme';
import { IconButton, IconSpark, IconUndo, Sheet, TextButton, hintText, label, numeric } from '../ui';
import { BarraDeMenus, type Menu } from './menus';
import { PanelDeMenu, type Entrada } from './PanelDeMenu';

/** ¿Pantalla de ordenador? A partir de 1024 px caben la barra de menús y los botones con texto. */
export function usePantallaAncha(minimo = 1024): boolean {
  const [ancha, setAncha] = useState(false);
  useEffect(() => {
    const media = window.matchMedia(`(min-width: ${minimo}px)`);
    const cambiar = () => setAncha(media.matches);
    cambiar();
    media.addEventListener('change', cambiar);
    return () => media.removeEventListener('change', cambiar);
  }, [minimo]);
  return ancha;
}

export function CabeceraEstudio({
  studio,
  archivo,
  menus,
  compas,
  subtitulo,
  tonalidad,
  onAbrirTempo,
  onProductor,
  onMezclar,
  nube,
}: {
  studio: Studio;
  archivo: Archivo;
  menus: { barra: Menu[]; movil: Entrada[]; refrescar: () => void };
  compas: { valor: string; dicho: string };
  subtitulo: string;
  tonalidad: string | null;
  onAbrirTempo: () => void;
  onProductor: () => void;
  onMezclar: () => void;
  /** Cuenta (pilar D): el icono de cómo va la nube, junto al estado de guardado. */
  nube?: ReactNode;
}) {
  const ancha = usePantallaAncha();
  const { project } = studio;
  const [menuIdea, setMenuIdea] = useState(false);
  const nombreRef = useRef<HTMLButtonElement | null>(null);

  const abrirMenuIdea = () => {
    haptic(8);
    menus.refrescar();
    setMenuIdea((abierto) => !abierto);
  };

  const estadoGuardado =
    studio.guardado === 'guardando' ? 'Guardando…' : studio.guardado === 'error' ? 'Sin guardar' : 'Guardado';

  const nombre = (
    <NombreDeIdea
      studio={studio}
      archivo={archivo}
      boton={(estilo) => (
        <button
          ref={nombreRef}
          type="button"
          className="daw-press daw-hover"
          onClick={abrirMenuIdea}
          aria-haspopup="menu"
          aria-expanded={menuIdea}
          aria-label={`${project.name}: menú de la idea`}
          style={estilo}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, maxWidth: '100%' }}>
            <span style={nombreTexto(ancha)}>{project.name}</span>
            <CaretDown size={12} weight="bold" color={T.dim} aria-hidden style={{ flexShrink: 0 }} />
          </span>
          {ancha ? null : (
            <span style={{ ...label, display: 'block', maxWidth: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {subtitulo}
              {nube}
            </span>
          )}
        </button>
      )}
      ancha={ancha}
    />
  );

  return (
    <header
      style={{
        position: 'relative',
        // Por encima de la línea de tiempo y del aviso: los menús caen sobre ellos.
        zIndex: 30,
        flexShrink: 0,
        background: T.surface,
        boxShadow: `inset 0 -1px 0 ${T.border}`,
        paddingTop: 'env(safe-area-inset-top)',
      }}
    >
      {ancha ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)', alignItems: 'center', gap: 16, height: 52, padding: '0 12px 0 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, minWidth: 0 }}>
            <Marca />
            <BarraDeMenus menus={menus.barra} onAbrir={menus.refrescar} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, maxWidth: 420 }}>
            {nombre}
            <span aria-live="polite" style={{ fontFamily: T.fontBody, fontSize: 12.5, color: studio.guardado === 'error' ? T.rec : T.faint, whiteSpace: 'nowrap' }}>
              {estadoGuardado}
              {nube}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
            <PildoraTempo bpm={project.bpm} compas={compas} tonalidad={tonalidad} onClick={onAbrirTempo} ancha />
            <button type="button" className="daw-press daw-sink" onClick={onProductor} style={botonProductor}>
              <Sparkle size={15} weight="fill" aria-hidden />
              Productor
            </button>
            <button type="button" className="daw-press daw-hover" onClick={onMezclar} style={botonMezclar}>
              <IconoMezclador size={16} />
              Mezclar
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '6px 6px 6px 8px' }}>
          {nombre}
          <PildoraTempo bpm={project.bpm} compas={compas} tonalidad={null} onClick={onAbrirTempo} />
          {/* El productor: el único verde de la cabecera, porque es Aura. */}
          <IconButton title="Productor" onClick={onProductor}>
            <IconSpark size={21} color={T.ai} />
          </IconButton>
          <IconButton title="Mezclador" onClick={onMezclar}>
            <IconoMezclador size={21} color={T.text} />
          </IconButton>
          <IconButton title="Deshacer" onClick={studio.undo}>
            <IconUndo size={20} color={T.text} />
          </IconButton>
        </div>
      )}

      {menuIdea ? (
        <MenuDeIdea entradas={ancha ? menus.barra[0].entradas : menus.movil} ancla={nombreRef.current} centrado={ancha} onCerrar={() => setMenuIdea(false)} />
      ) : null}

      {/* «Importar audio…»: el selector de ficheros de siempre, escondido. */}
      <input
        ref={archivo.entradaAudio}
        type="file"
        accept="audio/*,.m4a,.mp3,.wav,.aac,.caf,.aiff,.ogg"
        aria-hidden
        tabIndex={-1}
        style={{ display: 'none' }}
        onChange={(event) => {
          const fichero = event.target.files?.[0];
          if (fichero) void studio.importFile(fichero);
          event.target.value = '';
        }}
      />
    </header>
  );
}

/* -------------------------------------------------------------------------- */

function Marca() {
  // En tinta: el verde es de lo que hace la máquina, no de la marca.
  return (
    <span aria-label="Aura Music" style={{ fontFamily: T.fontBody, fontSize: 15, letterSpacing: '-0.03em', whiteSpace: 'nowrap', color: T.text, userSelect: 'none' }}>
      <span style={{ fontWeight: 650 }}>aura</span> <span style={{ fontWeight: 450, color: T.dim }}>music</span>
    </span>
  );
}

const nombreTexto = (ancha: boolean): CSSProperties => ({
  fontFamily: T.fontBody,
  fontSize: ancha ? 15 : 17,
  fontWeight: 600,
  letterSpacing: '-0.02em',
  lineHeight: 1.2,
  color: T.text,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
});

/**
 * El nombre de la idea, que se renombra en su sitio: «Renombrar» lo convierte
 * en un campo con el texto ya elegido. Intro o salir guardan; Escape lo deja
 * como estaba. Un nombre vacío no se guarda.
 */
function NombreDeIdea({
  studio,
  archivo,
  boton,
  ancha,
}: {
  studio: Studio;
  archivo: Archivo;
  boton: (estilo: CSSProperties) => ReactNode;
  ancha: boolean;
}) {
  // Campo sin estado propio: nace con el nombre de ahora y se lee al terminar.
  const campo = useRef<HTMLInputElement | null>(null);
  // Escape y luego perder el foco no tienen que guardar dos veces.
  const hecho = useRef(false);
  const { renombrando, setRenombrando } = archivo;

  useLayoutEffect(() => {
    if (!renombrando) return;
    hecho.current = false;
    // El campo ya está en el DOM: foco y texto elegido, para escribir encima sin borrar.
    campo.current?.focus({ preventScroll: true });
    campo.current?.select();
    // Solo al empezar a renombrar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renombrando]);

  const estilo: CSSProperties = {
    flex: ancha ? '0 1 auto' : 1,
    minWidth: 0,
    minHeight: ancha ? 36 : 48,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: 2,
    padding: ancha ? '0 10px' : '4px 8px',
    border: 'none',
    borderRadius: 10,
    background: 'transparent',
    textAlign: 'left',
    cursor: 'pointer',
  };

  if (!renombrando) return <>{boton(estilo)}</>;

  const terminar = (guardar: boolean) => {
    if (hecho.current) return;
    hecho.current = true;
    const limpio = (campo.current?.value ?? '').trim().slice(0, 60);
    if (guardar && limpio && limpio !== studio.project.name) {
      studio.renameProject(limpio);
      studio.setStatus(`Ahora se llama «${limpio}»`);
    }
    setRenombrando(false);
  };

  return (
    <div style={{ ...estilo, cursor: 'text' }}>
      <input
        ref={campo}
        defaultValue={studio.project.name}
        onBlur={() => terminar(true)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') terminar(true);
          if (event.key === 'Escape') terminar(false);
        }}
        maxLength={60}
        aria-label="Nombre de la idea"
        enterKeyHint="done"
        style={{
          ...nombreTexto(ancha),
          width: ancha ? 260 : '100%',
          height: 34,
          padding: '0 10px',
          margin: '0 -10px',
          border: 'none',
          borderRadius: 8,
          background: T.fill,
          boxShadow: `inset 0 0 0 1px ${T.borderStrong}`,
          outline: 'none',
          // 16 px como mínimo en el móvil: con menos, iOS hace zoom al enfocar.
          fontSize: ancha ? 15 : 17,
        }}
      />
    </div>
  );
}

/** El tempo y el compás (y la tonalidad en el PC): lo que la máquina va a seguir. Abre tempo y claqueta. */
function PildoraTempo({
  bpm,
  compas,
  tonalidad,
  onClick,
  ancha = false,
}: {
  bpm: number;
  compas: { valor: string; dicho: string };
  tonalidad: string | null;
  onClick: () => void;
  ancha?: boolean;
}) {
  const punto = <span aria-hidden style={{ color: T.faint }}>·</span>;
  return (
    <button
      type="button"
      className="daw-press"
      onClick={() => {
        haptic(8);
        onClick();
      }}
      aria-label={`Tempo ${bpm} BPM, compás de ${compas.dicho}${tonalidad ? `, ${tonalidad}` : ''}. Abrir tempo y claqueta`}
      style={{ minHeight: ancha ? 36 : 48, padding: ancha ? 0 : '0 4px', border: 'none', background: 'transparent', cursor: 'pointer', flexShrink: 0 }}
    >
      <span
        className="daw-hover-target"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: ancha ? 8 : 10,
          height: ancha ? 32 : 36,
          padding: ancha ? '0 14px' : '0 12px',
          borderRadius: ancha ? 16 : 10,
          background: T.fill,
          boxShadow: `inset 0 1px 0 ${T.rim}`,
          whiteSpace: 'nowrap',
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 4 }}>
          <span style={{ ...numeric, fontSize: ancha ? 14 : 16, fontWeight: 500, color: T.text }}>{bpm}</span>
          <span style={{ ...label, fontSize: 11, fontWeight: 600 }}>BPM</span>
        </span>
        {ancha ? punto : <span aria-hidden style={{ width: 1, height: 16, background: T.border }} />}
        <span style={{ ...numeric, fontSize: ancha ? 13 : 14, color: T.text }}>{compas.valor}</span>
        {ancha && tonalidad ? (
          <>
            {punto}
            <span style={{ fontFamily: T.fontBody, fontSize: 13, fontWeight: 500, color: T.text }}>{tonalidad}</span>
          </>
        ) : null}
      </span>
    </button>
  );
}

const botonProductor: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 7,
  height: 32,
  padding: '0 14px 0 12px',
  border: 'none',
  borderRadius: 16,
  background: T.ai,
  boxShadow: T.elev1,
  color: T.inverse,
  fontFamily: T.fontBody,
  fontSize: 13.5,
  fontWeight: 600,
  letterSpacing: '-0.005em',
  whiteSpace: 'nowrap',
  cursor: 'pointer',
};

const botonMezclar: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 7,
  height: 32,
  padding: '0 14px 0 11px',
  border: 'none',
  borderRadius: 16,
  background: T.raised,
  boxShadow: T.elev1,
  color: T.text,
  fontFamily: T.fontBody,
  fontSize: 13.5,
  fontWeight: 500,
  letterSpacing: '-0.005em',
  whiteSpace: 'nowrap',
  cursor: 'pointer',
};

/**
 * El menú que sale del nombre. En el móvil ocupa el ancho (menos el margen)
 * con filas de 44 px; en el PC cae centrado bajo el nombre. Tocar fuera lo
 * cierra sin tocar lo de debajo.
 */
function MenuDeIdea({
  entradas,
  ancla,
  centrado,
  onCerrar,
}: {
  entradas: Entrada[];
  ancla: HTMLElement | null;
  centrado: boolean;
  onCerrar: () => void;
}) {
  const [caja, setCaja] = useState<{ top: number; left: number; ancho: number } | null>(null);

  useLayoutEffect(() => {
    if (!ancla) return;
    const r = ancla.getBoundingClientRect();
    const vw = window.innerWidth;
    if (centrado) {
      const ancho = 268;
      setCaja({ top: r.bottom + 6, left: Math.max(8, Math.min(vw - ancho - 8, r.left + r.width / 2 - ancho / 2)), ancho });
    } else {
      setCaja({ top: r.bottom + 4, left: 8, ancho: Math.min(380, vw - 16) });
    }
  }, [ancla, centrado]);

  if (!caja) return null;
  return (
    <>
      <div
        aria-hidden
        onPointerDown={(event) => {
          event.preventDefault();
          onCerrar();
        }}
        style={{ position: 'fixed', inset: 0, zIndex: 0 }}
      />
      <PanelDeMenu
        entradas={entradas}
        etiqueta="Menú de la idea"
        enLinea={!centrado}
        onCerrar={(porTeclado) => {
          onCerrar();
          if (porTeclado) ancla?.focus();
        }}
        style={{
          position: 'fixed',
          top: caja.top,
          left: caja.left,
          width: caja.ancho,
          maxHeight: `calc(100dvh - ${Math.round(caja.top) + 12}px)`,
          overflowY: 'auto',
          overscrollBehavior: 'contain',
          transformOrigin: centrado ? 'top center' : 'top left',
        }}
      />
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Lo que se abre desde los menús                                              */
/* -------------------------------------------------------------------------- */

const NOMBRES_DE_ATAJOS: Partial<Record<IdComando, string>> = {
  nueva: 'Nueva idea',
  abrir: 'Abrir',
  guardar: 'Guardar',
  guardarCopia: 'Guardar como copia',
  cerrar: 'Cerrar idea',
  deshacer: 'Deshacer',
  rehacer: 'Rehacer',
  ajustes: 'Ajustes',
};

/** Borrar la idea (con confirmación, que no se deshace) y la chuleta de atajos. Van en la raíz, como las demás hojas. */
export function DialogosDeArchivo({
  studio,
  archivo,
  atajos,
  onCerrarAtajos,
}: {
  studio: Studio;
  archivo: Archivo;
  atajos: boolean;
  onCerrarAtajos: () => void;
}) {
  const idea = archivo.porBorrar;
  const mac = archivo.mac();
  return (
    <>
      <Sheet open={!!idea} title="Borrar idea" onClose={archivo.cancelarBorrado}>
        <p style={{ fontFamily: T.fontBody, fontSize: 16, lineHeight: 1.45, color: T.text, marginBottom: 8 }}>
          Se borra «{idea?.name ?? studio.project.name}» de este móvil, con todas sus tomas.
        </p>
        <p style={{ ...hintText, marginBottom: 20 }}>No se puede deshacer. Si quieres guardarla antes, Exportar › Idea completa.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            type="button"
            className="daw-press daw-sink"
            onClick={() => void archivo.borrarConfirmado()}
            style={{
              minHeight: 52,
              borderRadius: 14,
              border: 'none',
              background: T.recFill,
              boxShadow: T.elev1,
              color: T.onRec,
              fontFamily: T.fontBody,
              fontSize: 16,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Borrar la idea
          </button>
          <TextButton full onClick={archivo.cancelarBorrado}>
            Cancelar
          </TextButton>
        </div>
      </Sheet>

      <Sheet open={atajos} title="Atajos de teclado" onClose={onCerrarAtajos}>
        <div style={{ borderRadius: 14, background: T.fill, boxShadow: `inset 0 1px 0 ${T.rim}`, overflow: 'hidden', marginBottom: 14 }}>
          {(Object.keys(ATAJOS) as IdComando[]).map((id, i) => (
            <div
              key={id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                minHeight: 44,
                padding: '0 16px',
                boxShadow: i > 0 ? `inset 0 1px 0 ${T.rowLine}` : 'none',
                fontFamily: T.fontBody,
                fontSize: 15,
                color: T.text,
              }}
            >
              <span>{NOMBRES_DE_ATAJOS[id] ?? id}</span>
              <kbd style={{ fontFamily: T.fontBody, fontSize: 13, color: T.dim, fontVariantNumeric: 'tabular-nums' }}>{textoAtajo(id, mac)}</kbd>
            </div>
          ))}
        </div>
        <p style={hintText}>
          En una pestaña del navegador, {mac ? '⌘N y ⌘W' : 'Ctrl+N y Ctrl+W'} son del navegador (abren y cierran ventanas). Con la app instalada funcionan.
        </p>
      </Sheet>
    </>
  );
}
