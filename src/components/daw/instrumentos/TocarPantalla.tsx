'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowCounterClockwise, ArrowLeft, ArrowUUpLeft, GearSix, Play, Repeat, Stop } from '@phosphor-icons/react';
import type { Instrumentos } from '@/hooks/useInstrumentos';
import type { Studio } from '@/hooks/useStudio';
import { getPaquete } from '@/lib/instrumentos/packs';
import { guardarBajoElegido, leerBajoElegido } from '@/lib/instrumentos/preferencias';
import {
  getInstrumento,
  instrumentosDe,
  instrumentosDeAcordes,
  type DefInstrumento,
} from '@/lib/instrumentos/registro';
import type { InstrumentoId } from '@/lib/instrumentos/tipos';
import {
  asignar,
  doDeOctava,
  etiquetas,
  guardarTeclas,
  leerTeclas,
  mapaPorDefecto,
  teclaAsignable,
  type GrupoTeclas,
  type MapaTeclas,
} from '@/lib/instrumentos/tecladoPc';
import { leerToqueMs } from '@/lib/instrumentos/toque';
import { NOTAS, type Tonalidad } from '@/lib/musico/teoria';
import { haptic, T } from '../theme';
import { Segmented, Sheet, Toggle, hintText } from '../ui';
import { Acordes } from './Acordes';
import { CalibrarToque } from './Calibrar';
import { BaldosaFamilia, BaldosaInstrumento } from './Baldosas';
import { Pads } from './Pads';
import { BotonBarra, Teclado, type ModoTeclado, type TamanoTeclas } from './Teclado';
import { ChipMidi } from './ChipMidi';
import { BibliotecaLoops } from './Loops';
import { BarraResultado } from './TarjetaResultado';
import { TiraDeTiempo } from './TiraDeTiempo';
import { ListaDeSonidos, PestanasDeFamilia } from './PanelSonidos';
import { PanelSonido } from './PanelSonido';
import { useTecladoMidi } from '@/hooks/useTecladoMidi';
import { useTecladoPC } from '@/hooks/useTecladoPC';

/** Lo que se toca con el dedo. */
type Familia = 'pads' | 'teclado' | 'acordes' | 'bajo';
/** Y la quinta pestaña, la biblioteca de loops, que no es un instrumento. */
type Pestana = Familia | 'loops';

/** Largos del modo loop al grabar, en compases (0: grabar normal, de corrido). */
const LARGOS_BUCLE = [0, 1, 2, 4] as const;

interface Preferencias {
  pestana: Pestana;
  /** La última familia que tocaste: la que suena con el MIDI y la que vuelve al grabar desde «Loops». */
  familia: Familia;
  /** Compases del modo loop al grabar (0: apagado). */
  bucle: number;
  kit: InstrumentoId;
  teclas: InstrumentoId;
  acordes: InstrumentoId;
  modoTeclado: ModoTeclado;
  tamano: TamanoTeclas;
  tamanoBajo: TamanoTeclas;
  claqueta: boolean;
}

const PREFERENCIAS: Preferencias = {
  pestana: 'pads',
  familia: 'pads',
  bucle: 0,
  kit: 'bateria-acustica',
  teclas: 'piano',
  acordes: 'guitarra',
  modoTeclado: 'escala',
  tamano: 'mediano',
  tamanoBajo: 'grande',
  claqueta: true,
};
const CLAVE_PREFERENCIAS = 'aura-music:tocar';
const claveTonalidad = (proyecto: string) => `aura-music:tonalidad:${proyecto}`;

function leer<T>(clave: string, base: T): T {
  try {
    const crudo = window.localStorage.getItem(clave);
    return crudo ? { ...base, ...(JSON.parse(crudo) as Partial<T>) } : base;
  } catch {
    return base;
  }
}
function escribir(clave: string, valor: unknown) {
  try {
    window.localStorage.setItem(clave, JSON.stringify(valor));
  } catch {
    /* sin almacenamiento: se olvida al cerrar */
  }
}

/** Lo guardado puede ser de otra versión: si el instrumento ya no se ofrece, el de por defecto. */
function valido(id: InstrumentoId, lista: DefInstrumento[], porDefecto: InstrumentoId): InstrumentoId {
  return lista.some((d) => d.id === id) ? id : porDefecto;
}

const NOMBRE_MODO: Record<Tonalidad['modo'], string> = { mayor: 'mayor', menor: 'menor', frigio: 'frigio' };
export const nombreTonalidad = (t: Tonalidad) => `${NOTAS[t.tonica]} ${NOMBRE_MODO[t.modo]}`;

const FAMILIAS: { id: Pestana; nombre: string }[] = [
  { id: 'pads', nombre: 'Batería' },
  { id: 'teclado', nombre: 'Teclado' },
  { id: 'acordes', nombre: 'Acordes' },
  { id: 'bajo', nombre: 'Bajo' },
  { id: 'loops', nombre: 'Loops' },
];
/**
 * El margen de los lados: el de siempre en el móvil y, en una pantalla ancha,
 * lo que haga falta para que el contenido quede en una columna de 960 px.
 */
const LATERAL = (minimo: number) => `max(${minimo}px, calc((100% - 960px) / 2 + ${minimo}px))`;

/** En el PC, todo en una columna de 1440 px como mucho, con 24 de aire. */
const LATERAL_ANCHO = 'max(24px, calc((100% - 1440px) / 2 + 24px))';

const NOMBRE_FAMILIA: Record<Familia, string> = { pads: 'Batería', teclado: 'Teclado', acordes: 'Acordes', bajo: 'Bajo' };

/** De 1024 px en adelante, tres columnas (sonidos, instrumento, «Sonido»); por debajo, una. */
function useEsAncho(): boolean {
  const [ancho, setAncho] = useState(false);
  useEffect(() => {
    const consulta = window.matchMedia('(min-width: 1024px)');
    const mirar = () => setAncho(consulta.matches);
    mirar();
    consulta.addEventListener('change', mirar);
    return () => consulta.removeEventListener('change', mirar);
  }, []);
  return ancho;
}

/**
 * ¿Hay teclado de ordenador? Con ratón, sí; en un móvil o una tableta, en
 * cuanto se pulse una tecla de verdad (un iPad con teclado). Sin él, las
 * letras en los pads serían ruido.
 */
function useHayTeclado(): boolean {
  const [hay, setHay] = useState(false);
  useEffect(() => {
    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      setHay(true);
      return;
    }
    const alTeclear = (evento: KeyboardEvent) => {
      if (evento.key.length === 1) setHay(true);
    };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, []);
  return hay;
}

const ES_FAMILIA = (p: unknown): p is Familia => p === 'pads' || p === 'teclado' || p === 'acordes' || p === 'bajo';

const TECLAS = () => [...instrumentosDe('teclas'), ...instrumentosDe('guitarra')];

/**
 * La pantalla «Tocar»: batería, teclado, tiras de acordes y bajo, como en
 * GarageBand. Arriba lo que manda (grabar, escuchar), luego qué tocas, con
 * un icono para cada cosa, y abajo el instrumento, al alcance del pulgar.
 * Sube desde abajo sobre el estudio y no lo desmonta: al cerrar, todo sigue
 * donde estaba.
 */
export function TocarPantalla({
  studio,
  instrumentos,
  abierta,
  onCerrar,
  tonalidadSugerida,
  enLoops: abrirEnLoops = false,
}: {
  studio: Studio;
  instrumentos: Instrumentos;
  abierta: boolean;
  onCerrar: () => void;
  /** La tonalidad que ha oído la app en tus tomas, si la hay. */
  tonalidadSugerida: Tonalidad | null;
  /** Abrir directamente en «Loops» (desde «Poner un loop» del estudio vacío). */
  enLoops?: boolean;
}) {
  const { project, engine, settings, updateSettings } = studio;
  const { atril, estado, grabar, parar, escuchar, recuperar, hayCaptura, pulsosPorCompas, vuelta, deshacerVuelta, resultado } = instrumentos;
  const [prefs, setPrefs] = useState<Preferencias>(PREFERENCIAS);
  const [bajo, setBajo] = useState<InstrumentoId>('bajo-dedos');
  const [tonalidad, setTonalidad] = useState<Tonalidad>({ tonica: 0, modo: 'mayor' });
  const [automatico, setAutomatico] = useState(false);
  const [activa, setActiva] = useState<number | null>(null);
  const [panel, setPanel] = useState<null | 'ajustes' | 'calibrar' | 'tonalidad'>(null);
  const [montada, setMontada] = useState(false);
  const ancho = useEsAncho();
  const hayTeclado = useHayTeclado();
  /** Las teclas propias de cada grupo («Asignar teclas»); sin ellas, las de siempre. */
  const [teclasPropias, setTeclasPropias] = useState<Partial<Record<GrupoTeclas, MapaTeclas>>>({});
  const [asignando, setAsignando] = useState(false);
  /** El pedal de sostener del teclado (no se recuerda: se pone y se quita tocando). */
  const [pedal, setPedal] = useState(false);
  const instrumentoRef = useRef<HTMLDivElement | null>(null);
  const seleccionRef = useRef<{ valor: number; el: HTMLElement } | null>(null);
  useEffect(() => {
    setTeclasPropias({ pads: leerTeclas('pads') ?? undefined, teclado: leerTeclas('teclado') ?? undefined, bajo: leerTeclas('bajo') ?? undefined });
  }, []);

  // Las preferencias se leen en el cliente, al montar (no en el render del servidor).
  useEffect(() => {
    const guardadas = leer(CLAVE_PREFERENCIAS, PREFERENCIAS);
    setPrefs({
      ...guardadas,
      pestana: ES_FAMILIA(guardadas.pestana) || guardadas.pestana === 'loops' ? guardadas.pestana : PREFERENCIAS.pestana,
      familia: ES_FAMILIA(guardadas.familia) ? guardadas.familia : ES_FAMILIA(guardadas.pestana) ? guardadas.pestana : 'pads',
      bucle: (LARGOS_BUCLE as readonly number[]).includes(guardadas.bucle) ? guardadas.bucle : 0,
      kit: valido(guardadas.kit, instrumentosDe('bateria'), PREFERENCIAS.kit),
      teclas: valido(guardadas.teclas, TECLAS(), PREFERENCIAS.teclas),
      acordes: valido(guardadas.acordes, instrumentosDeAcordes(), PREFERENCIAS.acordes),
    });
    setBajo(leerBajoElegido());
  }, []);
  const cambiar = useCallback((patch: Partial<Preferencias>) => {
    setPrefs((actual) => {
      const nuevas = { ...actual, ...patch };
      escribir(CLAVE_PREFERENCIAS, nuevas);
      return nuevas;
    });
  }, []);

  // La tonalidad, por idea: la que elegiste aquí, o la que oyó la app, o Do.
  useEffect(() => {
    const guardada = leer<Tonalidad | null>(claveTonalidad(project.id), null);
    setTonalidad(guardada && typeof guardada.tonica === 'number' ? guardada : tonalidadSugerida ?? { tonica: 0, modo: 'mayor' });
  }, [project.id, tonalidadSugerida]);
  const elegirTonalidad = (t: Tonalidad) => {
    setTonalidad(t);
    escribir(claveTonalidad(project.id), t);
  };

  useEffect(() => {
    if (abierta) setMontada(true);
  }, [abierta]);

  useEffect(() => {
    if (abierta && abrirEnLoops) cambiar({ pestana: 'loops' });
  }, [abierta, abrirEnLoops, cambiar]);

  // En «Loops» no hay instrumento a la vista: manda la última familia tocada.
  const enLoops = prefs.pestana === 'loops';
  const familia: Familia = enLoops ? prefs.familia : (prefs.pestana as Familia);
  const instrumento: InstrumentoId =
    familia === 'pads' ? prefs.kit : familia === 'teclado' ? prefs.teclas : familia === 'acordes' ? prefs.acordes : bajo;
  const def = getInstrumento(instrumento);
  // Un teclado MIDI (por USB) toca lo que esté abierto, y se graba igual que el dedo.
  const { midi, conectar: conectarMidi } = useTecladoMidi({ activo: abierta, atril, def });

  // El instrumento se prepara al abrirlo: voz, muestras y notas calculadas.
  useEffect(() => {
    if (abierta) atril?.preparar(instrumento);
  }, [abierta, atril, instrumento]);

  // Lo automático se para al cambiar de instrumento o de tonalidad.
  useEffect(() => {
    setActiva(null);
  }, [instrumento, tonalidad, automatico]);

  const grabando = estado !== 'libre';
  const sonando = studio.transport !== 'stopped';
  const verResultado = !!resultado && !grabando;
  const enBucle = grabando && prefs.bucle > 0;

  /** GRABAR o parar. Desde «Loops» vuelve antes al último instrumento: grabar es tocar. */
  const pulsarGrabar = () => {
    engine?.unlockSync();
    haptic(grabando ? [18, 40, 18] : 22);
    if (grabando) {
      void parar();
      return;
    }
    instrumentos.pararEscucha();
    if (enLoops) cambiar({ pestana: prefs.familia });
    void grabar(prefs.claqueta, prefs.bucle);
  };
  const pulsarEscuchar = () => {
    engine?.unlockSync();
    void (grabando ? parar() : escuchar());
  };

  // El teclado del ordenador toca lo abierto (Intro graba, Espacio escucha),
  // con las teclas propias si las hay. En «Loops» no (no hay nada que tocar a
  // la vista) ni mientras se asignan teclas (entonces cada tecla es para eso).
  const grupo: GrupoTeclas = familia === 'pads' ? 'pads' : familia === 'bajo' ? 'bajo' : 'teclado';
  const mapa = useMemo(() => teclasPropias[grupo] ?? mapaPorDefecto(grupo), [teclasPropias, grupo]);
  const { octava } = useTecladoPC({ activo: abierta && !enLoops && !asignando, atril, def, onGrabar: pulsarGrabar, onEscuchar: pulsarEscuchar, mapa });
  const porValor = useMemo(() => etiquetas(mapa), [mapa]);
  const doActual = doDeOctava(def.base, octava, def.rango);
  const teclasPads = def.pads && hayTeclado ? def.pads.map((_, i) => porValor.get(i) ?? null) : undefined;
  const teclaDeNota = hayTeclado ? (nota: number) => porValor.get(nota - doActual) ?? null : undefined;

  /*
   * «Asignar teclas»: tocas un pad o una nota (suena, y se queda marcado) y
   * pulsas la tecla del ordenador que quieras. Se guarda al momento, por
   * grupo (todos los kits comparten las de los pads). Escape sale.
   */
  // Lo último, por referencia: los manejadores se enganchan una vez al entrar
  // en el modo y no se rehacen con cada nota (cada toque vuelve a pintar).
  const asignarVivo = useRef({ def, doActual, mapa, grupo });
  asignarVivo.current = { def, doActual, mapa, grupo };
  useEffect(() => {
    if (!asignando || !abierta) return;
    const zona = instrumentoRef.current;
    const limpiar = () => {
      zona?.querySelectorAll<HTMLElement>('[data-elegida]').forEach((el) => delete el.dataset.elegida);
      seleccionRef.current = null;
    };
    const alTocar = (evento: PointerEvent) => {
      const el = (evento.target as HTMLElement | null)?.closest<HTMLElement>('[data-nota]');
      if (!el || !zona?.contains(el)) return;
      const { def: d, doActual: inicio } = asignarVivo.current;
      const nota = Number(el.dataset.nota);
      const valor = d.pads ? d.pads.findIndex((pad) => pad.nota === nota) : nota - inicio;
      if (d.pads && valor < 0) return;
      limpiar();
      el.dataset.elegida = '1';
      seleccionRef.current = { valor, el };
    };
    const alTeclear = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') {
        // Sale de asignar sin cerrar «Tocar».
        evento.preventDefault();
        evento.stopImmediatePropagation();
        setAsignando(false);
        return;
      }
      const seleccion = seleccionRef.current;
      if (!seleccion || evento.ctrlKey || evento.metaKey || evento.altKey || !teclaAsignable(evento.key)) return;
      evento.preventDefault();
      evento.stopImmediatePropagation();
      const { mapa: m, grupo: g } = asignarVivo.current;
      const nuevo = asignar(m, evento.key, seleccion.valor);
      guardarTeclas(g, nuevo);
      setTeclasPropias((t) => ({ ...t, [g]: nuevo }));
      haptic(10);
      limpiar();
    };
    zona?.addEventListener('pointerdown', alTocar, true);
    window.addEventListener('keydown', alTeclear, true);
    return () => {
      zona?.removeEventListener('pointerdown', alTocar, true);
      window.removeEventListener('keydown', alTeclear, true);
      limpiar();
    };
  }, [asignando, abierta, ancho]);

  const restablecerTeclas = () => {
    guardarTeclas(grupo, null);
    setTeclasPropias((t) => ({ ...t, [grupo]: undefined }));
  };

  const elegirFamilia = (id: Pestana) => {
    atril?.pararAuto();
    if (id !== 'loops') instrumentos.pararEscucha();
    cambiar(ES_FAMILIA(id) ? { pestana: id, familia: id } : { pestana: id });
  };

  const cerrar = () => {
    atril?.pararAuto();
    instrumentos.pararEscucha();
    setActiva(null);
    if (grabando || sonando) void parar();
    onCerrar();
  };

  // Escape cierra, como las hojas.
  useEffect(() => {
    if (!abierta) return;
    const alTeclear = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape' && !panel) cerrar();
    };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  });

  const paquete = getPaquete(def.paquete);
  const carga = def.paquete ? atril?.cargas.get(def.paquete) : undefined;
  const textoCarga =
    !paquete || !carga || carga === 'lista'
      ? null
      : carga === 'error'
        ? 'Sin red: suena el sintetizado'
        : `Cargando ${def.nombre.toLowerCase()} · ${Math.round((carga.cargadas / Math.max(1, carga.total)) * 100)} %`;

  const variantes =
    familia === 'pads'
      ? instrumentosDe('bateria')
      : familia === 'teclado'
        ? TECLAS()
        : familia === 'acordes'
          ? instrumentosDeAcordes()
          : instrumentosDe('bajo');
  const elegirVariante = (id: InstrumentoId) => {
    atril?.pararAuto();
    if (familia === 'pads') cambiar({ kit: id });
    else if (familia === 'teclado') cambiar({ teclas: id });
    else if (familia === 'acordes') cambiar({ acordes: id });
    else {
      setBajo(id);
      guardarBajoElegido(id);
    }
  };

  const toqueMs = atril?.toqueMs ?? leerToqueMs() ?? 0;

  /** El instrumento (o la biblioteca de loops): el mismo en el PC y en el móvil. */
  const instrumentoJsx = enLoops ? (
    <BibliotecaLoops instrumentos={instrumentos} bpm={project.bpm} tonica={tonalidad.tonica} sonando={sonando} />
  ) : prefs.pestana === 'pads' ? (
    <Pads atril={atril} def={def} teclas={teclasPads} />
  ) : prefs.pestana === 'acordes' ? (
    <Acordes
      atril={atril}
      def={def}
      tonalidad={tonalidad}
      automatico={automatico}
      bpm={project.bpm}
      pulsosPorCompas={pulsosPorCompas}
      activa={activa}
      onActiva={setActiva}
    />
  ) : (
    <Teclado
      atril={atril}
      def={def}
      tonalidad={tonalidad}
      modo={prefs.pestana === 'bajo' ? 'escala' : prefs.modoTeclado}
      tamano={prefs.pestana === 'bajo' ? prefs.tamanoBajo : prefs.tamano}
      onModo={prefs.pestana === 'bajo' ? undefined : (modoTeclado) => cambiar({ modoTeclado })}
      onTamano={(tamano) => cambiar(prefs.pestana === 'bajo' ? { tamanoBajo: tamano } : { tamano })}
      teclaDe={teclaDeNota}
      sostener={prefs.pestana === 'bajo' ? false : pedal}
      onSostener={prefs.pestana === 'bajo' ? undefined : setPedal}
    />
  );

  /** Lo que se elige del instrumento: el automático de los acordes y la tonalidad. */
  const opcionesDelInstrumento =
    enLoops || familia === 'pads' ? null : (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        {familia === 'acordes' ? (
          <BotonBarra
            titulo={automatico ? 'Automático encendido: toca una tira para cambiar de acorde' : 'Que toque solo, a tu tempo'}
            ancho
            activo={automatico}
            onClick={() => {
              atril?.pararAuto();
              setAutomatico((a) => !a);
            }}
          >
            {ancho ? 'Automático' : 'Auto'}
          </BotonBarra>
        ) : null}
        <BotonBarra titulo={`Tonalidad: ${nombreTonalidad(tonalidad)}. Cambiar`} ancho onClick={() => setPanel('tonalidad')}>
          {ancho ? `Tonalidad: ${nombreTonalidad(tonalidad)}` : `${NOTAS[tonalidad.tonica]}${tonalidad.modo === 'mayor' ? '' : tonalidad.modo === 'menor' ? ' m' : ' fl.'}`}
        </BotonBarra>
      </div>
    );

  /** Los avisos del estudio («Toma guardada»…), abajo y sin tapar nada que se toque. */
  const avisoEstado = studio.status ? (
    <div role="status" className="daw-rise" style={{ position: 'absolute', left: 16, right: 16, bottom: 12, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
      <span
        style={{
          padding: '10px 14px',
          borderRadius: 12,
          background: T.glass,
          backdropFilter: 'blur(20px) saturate(160%)',
          WebkitBackdropFilter: 'blur(20px) saturate(160%)',
          boxShadow: `${T.elev2}, inset 0 0 0 1px ${T.border}`,
          fontFamily: T.fontBody,
          fontSize: 14,
          fontWeight: 500,
          color: T.text,
          textAlign: 'center',
        }}
      >
        {studio.status}
      </span>
    </div>
  ) : null;

  return (
    <div
      aria-hidden={!abierta}
      role="dialog"
      aria-modal={abierta}
      aria-label="Tocar"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 55,
        display: 'flex',
        flexDirection: 'column',
        background: T.bg,
        transform: abierta ? 'translateY(0)' : 'translateY(100%)',
        visibility: abierta ? 'visible' : 'hidden',
        transition: abierta
          ? `transform 320ms ${T.easeDrawer}`
          : `transform 240ms ${T.easeDrawer}, visibility 0s linear 240ms`,
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
      }}
    >
      {/* Arriba, lo que manda. En el PC: volver, qué tocas, y GRABAR en una
          píldora con el bucle y escuchar al lado. En el móvil, lo mismo en
          herramientas con su nombre debajo, que se dan mejor con el pulgar. */}
      {ancho ? (
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            height: 64,
            flexShrink: 0,
            padding: `0 ${LATERAL_ANCHO}`,
            background: T.surface,
            boxShadow: `inset 0 -1px 0 ${T.border}`,
          }}
        >
          <ChipCabecera titulo="Volver al estudio" onClick={cerrar} plano>
            <ArrowLeft size={18} weight="bold" color={T.text} />
            Estudio
          </ChipCabecera>
          <span aria-hidden style={{ width: 1, height: 24, background: T.border, margin: '0 6px' }} />
          <h1 style={{ margin: 0, minWidth: 0, flex: 1, fontFamily: T.fontBody, fontSize: 17, letterSpacing: '-0.015em', color: T.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {enLoops ? (
              <>
                <span style={{ fontWeight: 650 }}>Loops</span>
                <span style={{ fontWeight: 450, color: T.dim }}> · a {project.bpm} BPM, en {NOTAS[tonalidad.tonica]}</span>
              </>
            ) : (
              <>
                <span style={{ fontWeight: 650 }}>{NOMBRE_FAMILIA[familia]}</span>
                <span style={{ fontWeight: 450, color: T.dim }}> · {def.corto}</span>
              </>
            )}
          </h1>
          {hayCaptura && !grabando && !sonando ? (
            <ChipCabecera titulo="Recuperar lo último que has tocado sin grabar" onClick={() => void recuperar()}>
              <ArrowCounterClockwise size={17} weight="bold" color={T.text} />
              Recuperar
            </ChipCabecera>
          ) : null}
          <BotonGrabar studio={studio} estado={estado} pulsosPorCompas={pulsosPorCompas} claqueta={prefs.claqueta} onPulsar={pulsarGrabar} compacto />
          <ChipCabecera
            titulo={
              enBucle
                ? `Grabando en loop de ${prefs.bucle} ${prefs.bucle === 1 ? 'compás' : 'compases'}: cada vuelta se suma`
                : 'Grabar en bucle: unos compases que se repiten y cada vuelta se suma. Toca para cambiar'
            }
            onClick={() => {
              const i = LARGOS_BUCLE.indexOf(prefs.bucle as (typeof LARGOS_BUCLE)[number]);
              cambiar({ bucle: LARGOS_BUCLE[(i + 1) % LARGOS_BUCLE.length] });
            }}
            activo={prefs.bucle > 0}
            desactivado={grabando}
          >
            <Repeat size={17} weight={prefs.bucle > 0 ? 'fill' : 'bold'} color={T.text} />
            {enBucle ? `Vuelta ${vuelta + 1}` : prefs.bucle > 0 ? `Bucle ${prefs.bucle} c.` : 'Bucle'}
          </ChipCabecera>
          {enBucle ? (
            <ChipCabecera titulo="Quitar lo de la última vuelta" onClick={deshacerVuelta} desactivado={estado !== 'grabando'}>
              <ArrowUUpLeft size={17} weight="bold" color={T.text} />
              Quitar
            </ChipCabecera>
          ) : (
            <ChipCabecera
              titulo={sonando && !grabando ? 'Parar' : 'Escuchar la idea y tocar encima'}
              onClick={pulsarEscuchar}
              desactivado={grabando}
              activo={sonando && !grabando}
            >
              {sonando && !grabando ? <Stop size={16} weight="fill" color={T.text} /> : <Play size={16} weight="fill" color={T.text} />}
              {sonando && !grabando ? 'Parar' : 'Escuchar'}
            </ChipCabecera>
          )}
        </header>
      ) : (
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            // Caben cinco herramientas y GRABAR a 375 px: 48 de ancho y 4 de aire.
            gap: 4,
            flexShrink: 0,
            padding: `8px ${LATERAL(10)}`,
            background: T.surface,
            boxShadow: `inset 0 -1px 0 ${T.border}`,
          }}
        >
          <Herramienta titulo="Volver al estudio" etiqueta="Estudio" onClick={cerrar}>
            <ArrowLeft size={20} weight="bold" color={T.text} />
          </Herramienta>
          <BotonGrabar studio={studio} estado={estado} pulsosPorCompas={pulsosPorCompas} claqueta={prefs.claqueta} onPulsar={pulsarGrabar} />
          {/* Grabando en loop, «Escuchar» no sirve: en su sitio, quitar la última vuelta. */}
          {enBucle ? (
            <Herramienta titulo="Quitar lo de la última vuelta" etiqueta="Quitar" onClick={deshacerVuelta} desactivado={estado !== 'grabando'}>
              <ArrowUUpLeft size={20} weight="bold" color={T.text} />
            </Herramienta>
          ) : (
            <Herramienta
              titulo={sonando && !grabando ? 'Parar' : 'Escuchar la idea y tocar encima'}
              etiqueta={sonando && !grabando ? 'Parar' : 'Escuchar'}
              onClick={pulsarEscuchar}
              desactivado={grabando}
              activo={sonando && !grabando}
            >
              {sonando && !grabando ? <Stop size={20} weight="fill" color={T.text} /> : <Play size={20} weight="fill" color={T.text} />}
            </Herramienta>
          )}
          {/* El bucle: toca para cambiar de largo (no, 1, 2 o 4 compases).
              Grabando, dice por qué vuelta vas. */}
          <Herramienta
            titulo={
              enBucle
                ? `Grabando en loop de ${prefs.bucle} ${prefs.bucle === 1 ? 'compás' : 'compases'}: cada vuelta se suma`
                : prefs.bucle > 0
                  ? `Bucle de ${prefs.bucle} ${prefs.bucle === 1 ? 'compás' : 'compases'}: al grabar se repite y cada vuelta se suma. Toca para cambiar`
                  : 'Grabar en bucle: unos compases que se repiten y cada vuelta se suma. Toca para encenderlo'
            }
            etiqueta={enBucle ? `Vuelta ${vuelta + 1}` : prefs.bucle > 0 ? `Bucle ${prefs.bucle}` : 'Bucle'}
            onClick={() => {
              const i = LARGOS_BUCLE.indexOf(prefs.bucle as (typeof LARGOS_BUCLE)[number]);
              cambiar({ bucle: LARGOS_BUCLE[(i + 1) % LARGOS_BUCLE.length] });
            }}
            activo={prefs.bucle > 0}
            desactivado={grabando}
            // Grabando en loop no se puede cambiar, pero no se apaga: es lo que más se mira.
            visible={enBucle}
          >
            <Repeat size={20} weight={prefs.bucle > 0 ? 'fill' : 'bold'} color={T.text} />
          </Herramienta>
          {/* Lo que tocaste sin grabar no se pierde. Sale aquí arriba y no encima
              del instrumento, para no tapar ni mover nada mientras tocas. */}
          {hayCaptura && !grabando && !sonando ? (
            <Herramienta titulo="Recuperar lo último que has tocado sin grabar" etiqueta="Recuperar" onClick={() => void recuperar()}>
              <ArrowCounterClockwise size={20} weight="bold" color={T.text} />
            </Herramienta>
          ) : null}
          <Herramienta titulo="Sonido y ajustes del toque" etiqueta="Ajustes" onClick={() => setPanel('ajustes')} alFinal>
            <GearSix size={20} weight="bold" color={T.text} />
          </Herramienta>
        </header>
      )}

      {/* Dónde estás: compases, cursor, loop y notas, y para moverte. Lo
          primero bajo GRABAR, que es lo que se mira al grabar. */}
      <div style={{ padding: `10px ${ancho ? LATERAL_ANCHO : LATERAL(12)} 0`, flexShrink: 0 }}>
        <TiraDeTiempo studio={studio} instrumentos={instrumentos} instrumento={instrumento} bucleCompases={prefs.bucle} />
      </div>

      {ancho ? (
        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: 'grid',
            gridTemplateColumns: '264px minmax(0, 1fr) 272px',
            gap: 20,
            padding: `14px ${LATERAL_ANCHO} 16px`,
          }}
        >
          {/* Izquierda: qué tocas y con qué sonido. */}
          <aside style={{ minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 18, paddingBottom: 8 }}>
            <PestanasDeFamilia familias={FAMILIAS} elegida={prefs.pestana} onElegir={elegirFamilia} />
            {enLoops ? null : <ListaDeSonidos sonidos={variantes} elegido={instrumento} onElegir={elegirVariante} />}
          </aside>

          {/* En medio, el instrumento, en su hoja blanca. */}
          <section style={{ minHeight: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div
              style={{
                position: 'relative',
                flex: 1,
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                padding: 18,
                borderRadius: 22,
                background: T.surface,
                boxShadow: T.elev1,
              }}
            >
              {opcionesDelInstrumento}
              {asignando ? <AvisoAsignar onHecho={() => setAsignando(false)} /> : null}
              {textoCarga && !enLoops ? <p style={{ ...hintText, fontSize: 12, margin: 0 }}>{textoCarga}</p> : null}
              {/* En el PC el instrumento va centrado en su hoja: no hay pulgar que alcanzar abajo. */}
              <div ref={instrumentoRef} style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {montada ? instrumentoJsx : null}
              </div>
              <CuentaAtras studio={studio} estado={estado} />
              {avisoEstado}
            </div>
            {verResultado && resultado ? (
              <div style={{ height: 60, flexShrink: 0, padding: '0 8px 0 16px', borderRadius: 18, background: T.surface, boxShadow: T.elev1 }}>
                <BarraResultado
                  resultado={resultado}
                  onCuadrar={instrumentos.cuadrarResultado}
                  onDeshacer={instrumentos.deshacerResultado}
                  onCerrar={instrumentos.cerrarResultado}
                />
              </div>
            ) : null}
          </section>

          {/* Derecha: «Sonido». */}
          <aside style={{ minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14, padding: '18px 18px 20px', borderRadius: 22, background: T.surface, boxShadow: T.elev1, alignSelf: 'start', maxHeight: '100%' }}>
            <h2 style={{ margin: 0, fontFamily: T.fontBody, fontSize: 17, fontWeight: 650, letterSpacing: '-0.015em', color: T.text }}>Sonido</h2>
            {enLoops ? (
              <p style={{ ...hintText, margin: 0 }}>
                Los loops entran en el compás del cursor, como pista nueva. Mueve el cursor en la tira de arriba.
              </p>
            ) : (
              <PanelSonido
                instrumento={instrumento}
                atril={atril}
                asignando={asignando}
                conTeclasPropias={!!teclasPropias[grupo]}
                onAsignar={() => setAsignando((a) => !a)}
                onRestablecerTeclas={restablecerTeclas}
                midi={midi}
                onConectarMidi={() => {
                  engine?.unlockSync();
                  void conectarMidi();
                }}
                onAjustesDelToque={() => setPanel('ajustes')}
              />
            )}
          </aside>
        </div>
      ) : (
        <>
          <div style={{ padding: `10px ${LATERAL(12)} 0`, display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
            {/* Un teclado MIDI conectado (o el aviso para conectarlo): una línea. */}
            <ChipMidi
              midi={midi}
              onConectar={() => {
                engine?.unlockSync();
                void conectarMidi();
              }}
            />
            {/* Qué tocas: las cuatro familias y los loops, cada una con su icono. */}
            <div role="radiogroup" aria-label="Qué tocar" style={{ display: 'grid', gridTemplateColumns: `repeat(${FAMILIAS.length}, minmax(0, 1fr))`, gap: 6 }}>
              {FAMILIAS.map((f) => (
                <BaldosaFamilia key={f.id} familia={f.id} nombre={f.nombre} elegida={prefs.pestana === f.id} onElegir={() => elegirFamilia(f.id)} />
              ))}
            </div>
            {/* Y con qué: los sonidos de esa familia, en baldosas que se deslizan.
                En «Loops» no: la biblioteca trae sus propios filtros. Tras grabar,
                «¿Ha quedado bien?» se monta encima de esta fila, con su misma
                altura, para que el instrumento no se mueva. */}
            <div style={{ position: 'relative', display: enLoops ? 'none' : 'block' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, visibility: verResultado && !enLoops ? 'hidden' : 'visible' }}>
                <div
                  role="radiogroup"
                  aria-label="Sonido"
                  className="tocar-chips"
                  style={{ display: 'flex', gap: 6, overflowX: 'auto', minWidth: 0, flex: 1, scrollSnapType: 'x proximity', paddingBottom: 2 }}
                >
                  {variantes.map((v) => (
                    <BaldosaInstrumento key={v.id} def={v} elegido={v.id === instrumento} onElegir={() => elegirVariante(v.id)} />
                  ))}
                </div>
                {opcionesDelInstrumento}
              </div>
              {verResultado && !enLoops && resultado ? (
                <div style={{ position: 'absolute', inset: 0, background: T.bg }}>
                  <BarraResultado
                    resultado={resultado}
                    onCuadrar={instrumentos.cuadrarResultado}
                    onDeshacer={instrumentos.deshacerResultado}
                    onCerrar={instrumentos.cerrarResultado}
                  />
                </div>
              ) : null}
            </div>
            {/* En «Loops» no hay fila de sonidos: la barra va en su sitio, sobre la lista. */}
            {verResultado && enLoops && resultado ? (
              <div style={{ height: 48 }}>
                <BarraResultado
                  resultado={resultado}
                  onCuadrar={instrumentos.cuadrarResultado}
                  onDeshacer={instrumentos.deshacerResultado}
                  onCerrar={instrumentos.cerrarResultado}
                />
              </div>
            ) : null}
            {asignando ? <AvisoAsignar onHecho={() => setAsignando(false)} /> : null}
            {textoCarga && !enLoops ? <p style={{ ...hintText, fontSize: 12, marginTop: -2 }}>{textoCarga}</p> : null}
          </div>

          {/* El instrumento: todo lo que queda, abajo, donde llega el pulgar. */}
          <main
            style={{
              position: 'relative',
              flex: 1,
              minHeight: 0,
              display: 'flex',
              alignItems: 'flex-end',
              padding: `12px ${LATERAL(16)} 4px`,
            }}
          >
            <div ref={instrumentoRef} style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
              {montada ? instrumentoJsx : null}
            </div>
            <CuentaAtras studio={studio} estado={estado} />
            {avisoEstado}
          </main>
        </>
      )}

      {/* Grabando: el marco rojo de siempre, más tenue en la cuenta atrás. */}
      {grabando ? (
        <span
          aria-hidden
          style={{
            position: 'fixed',
            inset: 0,
            pointerEvents: 'none',
            boxShadow: `inset 0 0 0 2px ${T.rec}`,
            opacity: estado === 'claqueta' ? 0.35 : 0.75,
            transition: `opacity 200ms ${T.easeOut}`,
          }}
        />
      ) : null}

      <Sheet open={panel === 'ajustes'} title={ancho ? 'Ajustes del toque' : 'Sonido y ajustes'} onClose={() => setPanel(null)}>
        {/* En el móvil no hay columna de la derecha: «Sonido» va aquí, lo primero. */}
        {!ancho && !enLoops ? (
          <section style={{ marginBottom: 28 }}>
            <h3 style={tituloSeccion}>Sonido de {def.nombre.toLowerCase()}</h3>
            <PanelSonido
              instrumento={instrumento}
              atril={atril}
              asignando={asignando}
              conTeclasPropias={!!teclasPropias[grupo]}
              onAsignar={() => {
                // Para asignar hay que ver los pads: se cierra la hoja.
                setAsignando((a) => !a);
                setPanel(null);
              }}
              onRestablecerTeclas={restablecerTeclas}
            />
          </section>
        ) : null}
        <section style={{ marginBottom: 28 }}>
          <h3 style={tituloSeccion}>Calibrar el toque</h3>
          <p style={{ ...hintText, marginBottom: 12 }}>
            Lo que tarda tu dedo en convertirse en sonido. Se mide una vez en cada móvil y se resta al grabar, para que
            lo que tocas caiga donde lo tocaste.{' '}
            {toqueMs ? `Ahora: ${Math.abs(toqueMs)} ms ${toqueMs >= 0 ? 'tarde' : 'pronto'}.` : 'Ahora: sin calibrar.'}
          </p>
          <BotonBarra titulo="Toca 8 veces con la claqueta" ancho onClick={() => setPanel('calibrar')}>
            Toca 8 veces con la claqueta
          </BotonBarra>
        </section>
        <section style={{ marginBottom: 20 }}>
          <Toggle
            checked={prefs.claqueta}
            onChange={(claqueta) => cambiar({ claqueta })}
            title="Claqueta al grabar"
            detail="Suena el click mientras grabas lo que tocas. La cuenta atrás suena siempre."
          />
        </section>
        <section style={{ marginBottom: 28 }}>
          <h3 style={tituloSeccion}>Cuenta atrás al grabar</h3>
          <Segmented<number>
            ariaLabel="Cuenta atrás"
            value={settings.countInBars}
            onChange={(countInBars) => updateSettings({ countInBars })}
            options={[
              { value: 0, text: 'Sin cuenta' },
              { value: 1, text: '1 compás' },
              { value: 2, text: '2 compases' },
            ]}
          />
        </section>
        <section style={{ marginBottom: 12 }}>
          <h3 style={tituloSeccion}>Con el teclado del ordenador</h3>
          <p style={{ ...hintText }}>
            Cada pad y cada nota llevan escrita su tecla, y se cambian en «Asignar teclas».{' '}
            {def.pads ? '' : `Z baja de octava y X la sube${octava ? ` (ahora ${octava > 0 ? '+' : ''}${octava})` : ''}. `}
            Intro graba o para, y Espacio escucha o para. Un teclado MIDI por USB también vale.
          </p>
        </section>
      </Sheet>

      <Sheet open={panel === 'calibrar'} title="Toca 8 veces con la claqueta" onClose={() => setPanel('ajustes')}>
        {panel === 'calibrar' ? <CalibrarToque engine={engine} atril={atril} onHecho={() => setPanel('ajustes')} /> : null}
      </Sheet>

      <Sheet open={panel === 'tonalidad'} title="Tonalidad" onClose={() => setPanel(null)}>
        <SelectorTonalidad
          valor={tonalidad}
          sugerida={tonalidadSugerida}
          onCambio={(t) => {
            elegirTonalidad(t);
            haptic(8);
          }}
        />
      </Sheet>

      <style>{`
        .tocar-superficie, .tocar-superficie * {
          touch-action: none;
          user-select: none;
          -webkit-user-select: none;
          -webkit-touch-callout: none;
          -webkit-tap-highlight-color: transparent;
        }
        .tocar-pad, .tocar-tecla, .tocar-tira {
          transition: transform 160ms ${T.easeOut}, background-color 160ms ${T.easeOut}, box-shadow 160ms ${T.easeOut};
        }
        /* Encender es instantáneo; apagar se desvanece. Lo que responde al dedo no puede esperar. */
        .tocar-pad[data-on], .tocar-tecla[data-on], .tocar-tira[data-on] {
          transition-duration: 0ms;
          transform: scale(0.97);
        }
        .tocar-pad[data-on] { background: color-mix(in srgb, ${T.ai} 26%, ${T.surface}) !important; }
        .tocar-tecla[data-on] { background: color-mix(in srgb, ${T.ai} 24%, ${T.surface}) !important; }
        .tocar-tecla-negra[data-on] { background: color-mix(in srgb, ${T.ai} 55%, ${T.text}) !important; }
        .tocar-tira[data-on] { background: color-mix(in srgb, ${T.ai} 14%, ${T.surface}) !important; }
        /* Lo que suena se enciende en salvia (es lo único que lo usa aquí, junto a la máquina). */
        .tocar-pad[data-elegida], .tocar-tecla[data-elegida] { box-shadow: inset 0 0 0 2.5px ${T.text} !important; }
        .tocar-chips::-webkit-scrollbar { display: none; }
        /* La pregunta escrita, solo si cabe: a 375 px manda el control. */
        .tocar-resultado-pregunta { display: none; }
        @media (min-width: 480px) { .tocar-resultado-pregunta { display: inline; } }
        .tocar-tira-tiempo:focus-visible { box-shadow: inset 0 0 0 2px ${T.focus} !important; }
        @media (prefers-reduced-motion: reduce) {
          .tocar-pad[data-on], .tocar-tecla[data-on], .tocar-tira[data-on] { transform: none; }
        }
      `}</style>
    </div>
  );
}

const tituloSeccion: React.CSSProperties = {
  fontFamily: T.fontBody,
  fontSize: 13,
  fontWeight: 600,
  color: T.text,
  marginBottom: 6,
};

/** La cuenta atrás, enorme y en medio: es lo único que hay que mirar. */
function CuentaAtras({ studio, estado }: { studio: Studio; estado: string }) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const { engine, project } = studio;

  useEffect(() => {
    if (estado !== 'claqueta') return;
    let raf = 0;
    const bucle = () => {
      const ctx = engine?.ctx;
      if (ctx && engine && ref.current) {
        const falta = engine.position - engine.posicionEn(ctx.currentTime);
        const pulsos = Math.ceil(falta / (60 / project.bpm) - 0.02);
        ref.current.textContent = pulsos > 0 ? String(pulsos) : '';
      }
      raf = requestAnimationFrame(bucle);
    };
    raf = requestAnimationFrame(bucle);
    return () => cancelAnimationFrame(raf);
  }, [engine, estado, project.bpm]);

  if (estado !== 'claqueta') return null;
  return (
    <div aria-live="assertive" style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none' }}>
      <span
        ref={ref}
        style={{ fontFamily: T.fontBody, fontVariantNumeric: 'tabular-nums', fontSize: 120, fontWeight: 600, letterSpacing: '-0.06em', color: T.rec, opacity: 0.85 }}
      />
    </div>
  );
}

/** Doce tónicas y tres modos. La que oyó la app sale marcada. */
function SelectorTonalidad({
  valor,
  sugerida,
  onCambio,
}: {
  valor: Tonalidad;
  sugerida: Tonalidad | null;
  onCambio: (t: Tonalidad) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 8 }}>
      <Segmented<Tonalidad['modo']>
        ariaLabel="Modo"
        value={valor.modo}
        onChange={(modo) => onCambio({ ...valor, modo })}
        options={[
          { value: 'mayor', text: 'Mayor' },
          { value: 'menor', text: 'Menor' },
          { value: 'frigio', text: 'Flamenco' },
        ]}
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6 }}>
        {NOTAS.map((nota, i) => {
          const elegida = valor.tonica === i;
          return (
            <button
              key={nota}
              type="button"
              className="daw-press"
              aria-pressed={elegida}
              onClick={() => onCambio({ ...valor, tonica: i })}
              style={{
                minHeight: 46,
                borderRadius: 11,
                border: 'none',
                background: elegida ? T.text : T.fill,
                color: elegida ? T.inverse : T.text,
                boxShadow: elegida ? 'none' : `inset 0 1px 0 ${T.rim}`,
                fontFamily: T.fontBody,
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {nota}
            </button>
          );
        })}
      </div>
      {sugerida ? (
        <button
          type="button"
          className="daw-press daw-hover"
          onClick={() => onCambio(sugerida)}
          style={{
            minHeight: 44,
            borderRadius: 11,
            border: 'none',
            background: T.aiSoft,
            color: T.ai,
            fontFamily: T.fontBody,
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Usar la que he oído en tu toma: {nombreTonalidad(sugerida)}
        </button>
      ) : (
        <p style={{ ...hintText }}>Cuando grabes una toma con el micro, la app te dirá en qué tonalidad estás.</p>
      )}
    </div>
  );
}

/**
 * Botón de herramienta: icono y etiqueta debajo, como en Aura. Una palabra
 * debajo del icono quita la duda de qué hace sin tener que probarlo.
 */
function Herramienta({
  children,
  titulo,
  etiqueta,
  onClick,
  activo,
  desactivado,
  visible,
  alFinal,
}: {
  children: React.ReactNode;
  titulo: string;
  etiqueta: string;
  onClick: () => void;
  activo?: boolean;
  desactivado?: boolean;
  /** Desactivado pero a la vista: no se puede tocar, pero lo que dice importa. */
  visible?: boolean;
  /** Se va al final de la fila con lo que sobre. */
  alFinal?: boolean;
}) {
  return (
    <button
      type="button"
      className="daw-press daw-hover"
      aria-label={titulo}
      title={titulo}
      aria-pressed={activo}
      disabled={desactivado}
      onClick={() => {
        haptic(8);
        onClick();
      }}
      style={{
        width: 48,
        height: 52,
        flexShrink: 0,
        marginLeft: alFinal ? 'auto' : undefined,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
        padding: 0,
        border: 'none',
        borderRadius: 14,
        background: activo ? T.fillStrong : 'transparent',
        boxShadow: activo ? `inset 0 1px 0 ${T.rim}` : 'none',
        color: T.text,
        opacity: desactivado && !visible ? 0.35 : 1,
        cursor: desactivado ? 'default' : 'pointer',
      }}
    >
      {children}
      <span style={{ fontFamily: T.fontBody, fontSize: 10.5, fontWeight: 600, lineHeight: 1, color: T.dim, whiteSpace: 'nowrap' }}>
        {etiqueta}
      </span>
    </button>
  );
}

/**
 * GRABAR, inconfundible: una píldora roja, con la palabra escrita y el
 * estado dentro (ya no una barra roja de lado a lado).
 * - Parado: «Grabar», sobre rojo lleno.
 * - Cuenta atrás: «Entra en 3», con el número que baja.
 * - Grabando: «Parar · 2.3», con el compás y el pulso por los que vas.
 * El número se pinta desde el reloj del motor con rAF, sin pasar por React.
 */
function BotonGrabar({
  studio,
  estado,
  pulsosPorCompas,
  claqueta,
  onPulsar,
  compacto,
}: {
  studio: Studio;
  estado: 'libre' | 'claqueta' | 'grabando';
  pulsosPorCompas: number;
  claqueta: boolean;
  onPulsar: () => void;
  /** En la cabecera del PC: a su medida, junto al bucle y escuchar. */
  compacto?: boolean;
}) {
  const numeroRef = useRef<HTMLSpanElement | null>(null);
  const { engine, project } = studio;
  const bpmRef = useRef(project.bpm);
  bpmRef.current = project.bpm;

  useEffect(() => {
    if (estado === 'libre') return;
    let raf = 0;
    let ultimo = '';
    const bucle = () => {
      const ctx = engine?.ctx;
      const pulso = 60 / Math.max(1, bpmRef.current);
      let texto = '';
      if (engine && ctx) {
        if (estado === 'claqueta') {
          const falta = engine.position - engine.posicionEn(ctx.currentTime);
          texto = String(Math.max(1, Math.ceil(falta / pulso - 0.02)));
        } else {
          const posicion = engine.position;
          const compas = Math.floor(posicion / (pulso * pulsosPorCompas));
          const dentro = Math.floor((posicion - compas * pulso * pulsosPorCompas) / pulso);
          texto = `${compas + 1}.${Math.min(pulsosPorCompas, dentro + 1)}`;
        }
      }
      if (texto !== ultimo && numeroRef.current) {
        ultimo = texto;
        numeroRef.current.textContent = texto;
      }
      raf = requestAnimationFrame(bucle);
    };
    raf = requestAnimationFrame(bucle);
    return () => cancelAnimationFrame(raf);
  }, [engine, estado, pulsosPorCompas]);

  const grabando = estado === 'grabando';
  const titulo = estado === 'libre' ? `Grabar lo que toques${claqueta ? ', con claqueta' : ''}` : 'Parar y guardar la toma';
  return (
    <button
      type="button"
      className="daw-press daw-sink"
      aria-label={titulo}
      title={titulo}
      aria-pressed={estado !== 'libre'}
      onClick={onPulsar}
      style={{
        flex: compacto ? '0 0 auto' : 1,
        minWidth: compacto ? 132 : 0,
        // A 1786 px medía 732: un botón así pesa más que lo que graba.
        maxWidth: 360,
        height: compacto ? 40 : 48,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: compacto ? '0 20px 0 16px' : '0 10px',
        border: 'none',
        borderRadius: 999,
        background: grabando ? T.recSoft : T.recFill,
        boxShadow: grabando ? `inset 0 0 0 2px ${T.rec}` : T.elev1,
        color: grabando ? T.rec : T.onRec,
        fontFamily: T.fontBody,
        fontSize: compacto ? 15 : 16,
        fontWeight: 700,
        letterSpacing: '-0.01em',
        whiteSpace: 'nowrap',
        cursor: 'pointer',
        transition: `background-color 200ms ${T.easeOut}, box-shadow 200ms ${T.easeOut}, color 200ms ${T.easeOut}`,
      }}
    >
      <span
        aria-hidden
        className={grabando ? 'daw-blink' : undefined}
        style={{
          width: compacto ? 11 : 14,
          height: compacto ? 11 : 14,
          flexShrink: 0,
          borderRadius: grabando ? 3 : 7,
          background: grabando ? T.rec : T.onRec,
          transition: `border-radius 200ms ${T.easeOut}`,
        }}
      />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {estado === 'libre' ? 'Grabar' : estado === 'claqueta' ? 'Entra en ' : 'Parar · '}
      </span>
      {estado !== 'libre' ? (
        <span ref={numeroRef} style={{ fontVariantNumeric: 'tabular-nums', marginLeft: -6 }} />
      ) : null}
    </button>
  );
}

/**
 * Un botón de la cabecera del PC: píldora con icono y palabra. Blanco con su
 * filo; encendido (sonando, bucle puesto), sobre el gris del suelo. `plano`
 * va sin filo (volver al estudio, que no es una acción del instrumento).
 */
function ChipCabecera({
  children,
  titulo,
  onClick,
  activo,
  desactivado,
  plano,
}: {
  children: React.ReactNode;
  titulo: string;
  onClick: () => void;
  activo?: boolean;
  desactivado?: boolean;
  plano?: boolean;
}) {
  return (
    <button
      type="button"
      className="daw-press daw-hover"
      aria-label={titulo}
      title={titulo}
      aria-pressed={activo}
      disabled={desactivado}
      onClick={() => {
        haptic(8);
        onClick();
      }}
      style={{
        flexShrink: 0,
        height: 40,
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        padding: plano ? '0 12px 0 8px' : '0 16px 0 13px',
        border: 'none',
        borderRadius: 999,
        background: activo ? T.fillStrong : plano ? 'transparent' : T.surface,
        boxShadow: plano || activo ? 'none' : `inset 0 0 0 1px ${T.border}, 0 1px 2px rgba(20,40,33,0.05)`,
        color: T.text,
        fontFamily: T.fontBody,
        fontSize: 14,
        fontWeight: 600,
        whiteSpace: 'nowrap',
        opacity: desactivado && !activo ? 0.4 : 1,
        cursor: desactivado ? 'default' : 'pointer',
      }}
    >
      {children}
    </button>
  );
}

/** Mientras se asignan teclas: qué hacer, en una línea, y cómo salir. */
function AvisoAsignar({ onHecho }: { onHecho: () => void }) {
  return (
    <div
      role="status"
      className="daw-rise"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        minHeight: 44,
        padding: '6px 6px 6px 14px',
        borderRadius: 14,
        background: T.fill,
        boxShadow: `inset 0 0 0 1px ${T.border}`,
        flexShrink: 0,
      }}
    >
      <span style={{ flex: 1, minWidth: 0, fontFamily: T.fontBody, fontSize: 13, lineHeight: 1.35, color: T.text }}>
        Toca un pad o una nota y pulsa la tecla que quieras.
      </span>
      <button
        type="button"
        className="daw-press daw-hover"
        onClick={() => {
          haptic(8);
          onHecho();
        }}
        style={{
          flexShrink: 0,
          height: 36,
          padding: '0 14px',
          border: 'none',
          borderRadius: 999,
          background: T.text,
          color: T.inverse,
          fontFamily: T.fontBody,
          fontSize: 13.5,
          fontWeight: 650,
          cursor: 'pointer',
        }}
      >
        Hecho
      </button>
    </div>
  );
}
