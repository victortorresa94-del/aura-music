'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowCounterClockwise, GearSix, Play, Stop, X } from '@phosphor-icons/react';
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
import { useTecladoMidi } from '@/hooks/useTecladoMidi';

type Pestana = 'pads' | 'teclado' | 'acordes' | 'bajo';

interface Preferencias {
  pestana: Pestana;
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
];

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
}: {
  studio: Studio;
  instrumentos: Instrumentos;
  abierta: boolean;
  onCerrar: () => void;
  /** La tonalidad que ha oído la app en tus tomas, si la hay. */
  tonalidadSugerida: Tonalidad | null;
}) {
  const { project, engine, settings, updateSettings } = studio;
  const { atril, estado, grabar, parar, escuchar, recuperar, hayCaptura, pulsosPorCompas } = instrumentos;
  const [prefs, setPrefs] = useState<Preferencias>(PREFERENCIAS);
  const [bajo, setBajo] = useState<InstrumentoId>('bajo-dedos');
  const [tonalidad, setTonalidad] = useState<Tonalidad>({ tonica: 0, modo: 'mayor' });
  const [automatico, setAutomatico] = useState(false);
  const [activa, setActiva] = useState<number | null>(null);
  const [panel, setPanel] = useState<null | 'ajustes' | 'calibrar' | 'tonalidad'>(null);
  const [montada, setMontada] = useState(false);

  // Las preferencias se leen en el cliente, al montar (no en el render del servidor).
  useEffect(() => {
    const guardadas = leer(CLAVE_PREFERENCIAS, PREFERENCIAS);
    setPrefs({
      ...guardadas,
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

  const instrumento: InstrumentoId =
    prefs.pestana === 'pads' ? prefs.kit : prefs.pestana === 'teclado' ? prefs.teclas : prefs.pestana === 'acordes' ? prefs.acordes : bajo;
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

  const cerrar = () => {
    atril?.pararAuto();
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
    prefs.pestana === 'pads'
      ? instrumentosDe('bateria')
      : prefs.pestana === 'teclado'
        ? TECLAS()
        : prefs.pestana === 'acordes'
          ? instrumentosDeAcordes()
          : instrumentosDe('bajo');
  const elegirVariante = (id: InstrumentoId) => {
    atril?.pararAuto();
    if (prefs.pestana === 'pads') cambiar({ kit: id });
    else if (prefs.pestana === 'teclado') cambiar({ teclas: id });
    else if (prefs.pestana === 'acordes') cambiar({ acordes: id });
    else {
      setBajo(id);
      guardarBajoElegido(id);
    }
  };

  const toqueMs = atril?.toqueMs ?? leerToqueMs() ?? 0;

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
      {/* Arriba, lo que manda: cerrar, GRABAR, escuchar, recuperar y ajustes. */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 12px',
          background: T.surface,
          boxShadow: `inset 0 -1px 0 ${T.border}`,
        }}
      >
        <Herramienta titulo="Cerrar" etiqueta="Cerrar" onClick={cerrar}>
          <X size={20} weight="bold" color={T.text} />
        </Herramienta>
        <BotonGrabar
          studio={studio}
          estado={estado}
          pulsosPorCompas={pulsosPorCompas}
          claqueta={prefs.claqueta}
          onPulsar={() => {
            engine?.unlockSync();
            haptic(grabando ? [18, 40, 18] : 22);
            void (grabando ? parar() : grabar(prefs.claqueta));
          }}
        />
        <Herramienta
          titulo={sonando && !grabando ? 'Parar' : 'Escuchar la idea y tocar encima'}
          etiqueta={sonando && !grabando ? 'Parar' : 'Escuchar'}
          onClick={() => {
            engine?.unlockSync();
            void escuchar();
          }}
          desactivado={grabando}
          activo={sonando && !grabando}
        >
          {sonando && !grabando ? <Stop size={20} weight="fill" color={T.text} /> : <Play size={20} weight="fill" color={T.text} />}
        </Herramienta>
        {/* Lo que tocaste sin grabar no se pierde. Sale aquí arriba y no encima
            del instrumento, para no tapar ni mover nada mientras tocas. */}
        {hayCaptura && !grabando && !sonando ? (
          <Herramienta
            titulo="Recuperar lo último que has tocado sin grabar"
            etiqueta="Recuperar"
            onClick={() => void recuperar()}
          >
            <ArrowCounterClockwise size={20} weight="bold" color={T.text} />
          </Herramienta>
        ) : null}
        <Herramienta titulo="Ajustes del toque" etiqueta="Ajustes" onClick={() => setPanel('ajustes')}>
          <GearSix size={20} weight="bold" color={T.text} />
        </Herramienta>
      </header>

      <div style={{ padding: '10px 12px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* Un teclado MIDI conectado (o el aviso para conectarlo): una línea. */}
        <ChipMidi
          midi={midi}
          onConectar={() => {
            engine?.unlockSync();
            void conectarMidi();
          }}
        />
        {/* Qué tocas: las cuatro familias, cada una con su icono. */}
        <div role="radiogroup" aria-label="Qué tocar" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 6 }}>
          {FAMILIAS.map((familia) => (
            <BaldosaFamilia
              key={familia.id}
              familia={familia.id}
              nombre={familia.nombre}
              elegida={prefs.pestana === familia.id}
              onElegir={() => {
                atril?.pararAuto();
                cambiar({ pestana: familia.id });
              }}
            />
          ))}
        </div>
        {/* Y con qué: los sonidos de esa familia, en baldosas que se deslizan. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
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
          {prefs.pestana === 'acordes' ? (
            <BotonBarra
              titulo={automatico ? 'Automático encendido: toca una tira para cambiar de acorde' : 'Que toque solo, a tu tempo'}
              ancho
              activo={automatico}
              onClick={() => {
                atril?.pararAuto();
                setAutomatico((a) => !a);
              }}
            >
              Auto
            </BotonBarra>
          ) : null}
          {prefs.pestana !== 'pads' ? (
            <BotonBarra titulo={`Tonalidad: ${nombreTonalidad(tonalidad)}. Cambiar`} ancho onClick={() => setPanel('tonalidad')}>
              {NOTAS[tonalidad.tonica]}
              {tonalidad.modo === 'mayor' ? '' : tonalidad.modo === 'menor' ? ' m' : ' fl.'}
            </BotonBarra>
          ) : null}
        </div>
        {textoCarga ? <p style={{ ...hintText, fontSize: 12, marginTop: -2 }}>{textoCarga}</p> : null}
      </div>

      {/* El instrumento: todo lo que queda, abajo, donde llega el pulgar. */}
      <main
        style={{
          position: 'relative',
          flex: 1,
          minHeight: 0,
          display: 'flex',
          alignItems: 'flex-end',
          padding: '12px 16px 4px',
        }}
      >
        {montada ? (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
            {prefs.pestana === 'pads' ? (
              <Pads atril={atril} def={def} />
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
              />
            )}
          </div>
        ) : null}

        <CuentaAtras studio={studio} estado={estado} />

        {studio.status ? (
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
        ) : null}
      </main>

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

      <Sheet open={panel === 'ajustes'} title="Ajustes del toque" onClose={() => setPanel(null)}>
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
        <section style={{ marginBottom: 12 }}>
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
        .tocar-pad[data-on] { background: color-mix(in srgb, ${T.text} 20%, ${T.surface}) !important; }
        .tocar-tecla[data-on] { background: color-mix(in srgb, ${T.text} 14%, ${T.surface}) !important; }
        .tocar-tecla-negra[data-on] { background: ${T.dim} !important; }
        .tocar-tira[data-on] { background: color-mix(in srgb, ${T.text} 12%, ${T.surface}) !important; }
        .tocar-chips::-webkit-scrollbar { display: none; }
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
}: {
  children: React.ReactNode;
  titulo: string;
  etiqueta: string;
  onClick: () => void;
  activo?: boolean;
  desactivado?: boolean;
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
        width: 52,
        height: 52,
        flexShrink: 0,
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
        opacity: desactivado ? 0.35 : 1,
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
 * GRABAR, inconfundible: rojo, con la palabra escrita y el estado dentro.
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
}: {
  studio: Studio;
  estado: 'libre' | 'claqueta' | 'grabando';
  pulsosPorCompas: number;
  claqueta: boolean;
  onPulsar: () => void;
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
        flex: 1,
        minWidth: 0,
        height: 52,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        padding: '0 14px',
        border: 'none',
        borderRadius: 16,
        background: grabando ? T.recSoft : T.recFill,
        boxShadow: grabando ? `inset 0 0 0 2px ${T.rec}` : T.elev1,
        color: grabando ? T.rec : T.onRec,
        fontFamily: T.fontBody,
        fontSize: 16,
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
          width: 14,
          height: 14,
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
