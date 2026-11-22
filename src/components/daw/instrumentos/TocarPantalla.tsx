'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Instrumentos } from '@/hooks/useInstrumentos';
import type { Studio } from '@/hooks/useStudio';
import { getPaquete } from '@/lib/instrumentos/packs';
import { getInstrumento, instrumentosDe } from '@/lib/instrumentos/registro';
import type { InstrumentoId } from '@/lib/instrumentos/tipos';
import { leerToqueMs } from '@/lib/instrumentos/toque';
import { NOTAS, type Tonalidad } from '@/lib/musico/teoria';
import { haptic, T } from '../theme';
import { IconClose, IconMetronome, IconPlay, IconSettings, IconStop, Segmented, Sheet, hintText, label } from '../ui';
import { Acordes } from './Acordes';
import { CalibrarToque } from './Calibrar';
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
  kit: 'bateria-808',
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

const NOMBRE_MODO: Record<Tonalidad['modo'], string> = { mayor: 'mayor', menor: 'menor', frigio: 'frigio' };
export const nombreTonalidad = (t: Tonalidad) => `${NOTAS[t.tonica]} ${NOMBRE_MODO[t.modo]}`;

/**
 * La pantalla «Tocar»: pads, teclado, tiras de acordes y bajo, como en
 * GarageBand, con grabar arriba y el instrumento abajo, al alcance del
 * pulgar. Sube desde abajo sobre el estudio y no lo desmonta: al cerrar, todo
 * sigue donde estaba.
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
  const [tonalidad, setTonalidad] = useState<Tonalidad>({ tonica: 0, modo: 'mayor' });
  const [automatico, setAutomatico] = useState(false);
  const [activa, setActiva] = useState<number | null>(null);
  const [panel, setPanel] = useState<null | 'ajustes' | 'calibrar' | 'tonalidad'>(null);
  const [montada, setMontada] = useState(false);

  // Las preferencias se leen en el cliente, al montar (no en el render del servidor).
  useEffect(() => {
    setPrefs(leer(CLAVE_PREFERENCIAS, PREFERENCIAS));
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
    prefs.pestana === 'pads' ? prefs.kit : prefs.pestana === 'teclado' ? prefs.teclas : prefs.pestana === 'acordes' ? prefs.acordes : 'bajo';
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
        ? instrumentosDe('teclas')
        : prefs.pestana === 'acordes'
          ? [getInstrumento('guitarra'), getInstrumento('piano'), getInstrumento('cuerdas')]
          : [getInstrumento('bajo')];
  const elegirVariante = (id: InstrumentoId) => {
    if (prefs.pestana === 'pads') cambiar({ kit: id });
    else if (prefs.pestana === 'teclado') cambiar({ teclas: id });
    else if (prefs.pestana === 'acordes') cambiar({ acordes: id });
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
      {/* Arriba: cerrar, grabar, escuchar, dónde vas y la claqueta. */}
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
        <BotonRedondo titulo="Cerrar" onClick={cerrar}>
          <IconClose size={20} color={T.text} />
        </BotonRedondo>
        <button
          type="button"
          className="daw-press daw-sink"
          aria-label={grabando ? 'Parar y guardar' : 'Grabar lo que toques'}
          title={grabando ? 'Parar y guardar' : 'Grabar lo que toques'}
          aria-pressed={grabando}
          onClick={() => {
            engine?.unlockSync();
            haptic(grabando ? [18, 40, 18] : 22);
            void (grabando ? parar() : grabar(prefs.claqueta));
          }}
          style={{
            width: 52,
            height: 52,
            marginLeft: 4,
            borderRadius: '50%',
            border: 'none',
            display: 'grid',
            placeItems: 'center',
            background: grabando ? T.recSoft : T.raised,
            boxShadow: `inset 0 0 0 2px ${T.rec}, ${T.elev1}`,
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          <span
            style={{
              width: 34,
              height: 34,
              background: T.rec,
              borderRadius: grabando ? 9 : 17,
              transform: grabando ? 'scale(0.55)' : 'scale(1)',
              transition: `transform 200ms ${T.easeOut}, border-radius 200ms ${T.easeOut}`,
            }}
          />
        </button>
        <BotonRedondo
          titulo={sonando && !grabando ? 'Parar' : 'Escuchar la idea y tocar encima'}
          onClick={() => {
            engine?.unlockSync();
            void escuchar();
          }}
          desactivado={grabando}
        >
          {sonando && !grabando ? <IconStop size={18} /> : <span style={{ display: 'grid', marginLeft: 2 }}><IconPlay size={19} /></span>}
        </BotonRedondo>
        {/* Lo que tocaste sin grabar no se pierde: con el transporte parado,
            el sitio del contador es para recuperarlo. Arriba y no encima del
            instrumento, para no tapar ni mover nada mientras tocas. */}
        {hayCaptura && !grabando && !sonando ? (
          <span style={{ flex: 1, minWidth: 0, display: 'flex', justifyContent: 'center' }}>
            <button
              type="button"
              className="daw-press daw-rise"
              title="Lo que acabas de tocar sin grabar, a una pista"
              aria-label="Recuperar lo último que has tocado"
              onClick={() => {
                haptic(10);
                void recuperar();
              }}
              style={{
                minHeight: 44,
                maxWidth: '100%',
                padding: '0 10px',
                borderRadius: 12,
                border: 'none',
                background: T.fill,
                boxShadow: `inset 0 1px 0 ${T.rim}, inset 0 0 0 1px ${T.border}`,
                color: T.text,
                fontFamily: T.fontBody,
                fontSize: 12,
                fontWeight: 600,
                lineHeight: 1.15,
                textAlign: 'center',
                cursor: 'pointer',
              }}
            >
              {/* En dos líneas: en 375 px el hueco del contador no da para una. */}
              Recuperar
              <br />
              lo último
            </button>
          </span>
        ) : (
          <Posicion studio={studio} pulsosPorCompas={pulsosPorCompas} estado={estado} />
        )}
        <BotonRedondo
          titulo={prefs.claqueta ? 'Grabar con claqueta (encendida)' : 'Grabar sin claqueta (apagada)'}
          activo={prefs.claqueta}
          onClick={() => cambiar({ claqueta: !prefs.claqueta })}
        >
          <IconMetronome size={20} color={prefs.claqueta ? T.text : T.dim} />
        </BotonRedondo>
        <BotonRedondo titulo="Ajustes del toque" onClick={() => setPanel('ajustes')}>
          <IconSettings size={20} color={T.text} />
        </BotonRedondo>
      </header>

      <div style={{ padding: '12px 16px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <ChipMidi
          midi={midi}
          onConectar={() => {
            engine?.unlockSync();
            void conectarMidi();
          }}
        />
        <Segmented<Pestana>
          ariaLabel="Instrumento"
          value={prefs.pestana}
          onChange={(pestana) => {
            atril?.pararAuto();
            cambiar({ pestana });
          }}
          options={[
            { value: 'pads', text: 'Pads' },
            { value: 'teclado', text: 'Teclado' },
            { value: 'acordes', text: 'Acordes' },
            { value: 'bajo', text: 'Bajo' },
          ]}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minHeight: 36 }}>
          <div className="tocar-chips" style={{ display: 'flex', gap: 6, overflowX: 'auto', minWidth: 0, flex: 1 }}>
            {variantes.length > 1
              ? variantes.map((v) => (
                  <BotonBarra key={v.id} titulo={v.nombre} ancho activo={v.id === instrumento} onClick={() => elegirVariante(v.id)}>
                    {v.corto}
                  </BotonBarra>
                ))
              : (
                <span style={{ ...label, fontSize: 13, color: T.text, fontWeight: 600 }}>{def.nombre}</span>
              )}
          </div>
          {prefs.pestana === 'acordes' ? (
            <BotonBarra
              titulo={automatico ? 'Automático encendido: toca una tira para cambiar de acorde' : 'Tocar solo a tu tempo'}
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
              {NOTAS[tonalidad.tonica]} {tonalidad.modo === 'mayor' ? '' : tonalidad.modo === 'menor' ? 'm' : 'frig.'}
            </BotonBarra>
          ) : null}
        </div>
        {textoCarga ? <p style={{ ...hintText, fontSize: 12, marginTop: -4 }}>{textoCarga}</p> : null}
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

function BotonRedondo({
  children,
  titulo,
  onClick,
  activo,
  desactivado,
}: {
  children: React.ReactNode;
  titulo: string;
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
        width: 44,
        height: 44,
        borderRadius: 14,
        border: 'none',
        display: 'grid',
        placeItems: 'center',
        background: activo ? T.fillStrong : 'transparent',
        boxShadow: activo ? `inset 0 1px 0 ${T.rim}` : 'none',
        opacity: desactivado ? 0.35 : 1,
        cursor: desactivado ? 'default' : 'pointer',
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  );
}

/** Compás y pulso mientras suena; lo lee del motor con rAF, sin pasar por React. */
function Posicion({ studio, pulsosPorCompas, estado }: { studio: Studio; pulsosPorCompas: number; estado: string }) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const { engine, project } = studio;
  const bpmRef = useRef(project.bpm);
  bpmRef.current = project.bpm;

  useEffect(() => {
    let raf = 0;
    let ultimo = '';
    const bucle = () => {
      const posicion = engine?.position ?? 0;
      const pulso = 60 / Math.max(1, bpmRef.current);
      const compas = Math.floor(posicion / (pulso * pulsosPorCompas));
      const dentro = Math.floor((posicion - compas * pulso * pulsosPorCompas) / pulso);
      const texto = `${compas + 1}.${Math.min(pulsosPorCompas, dentro + 1)}`;
      if (texto !== ultimo && ref.current) {
        ultimo = texto;
        ref.current.textContent = texto;
      }
      raf = requestAnimationFrame(bucle);
    };
    raf = requestAnimationFrame(bucle);
    return () => cancelAnimationFrame(raf);
  }, [engine, pulsosPorCompas]);

  return (
    <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
      <span
        ref={ref}
        aria-label="Compás y pulso"
        style={{ fontFamily: T.fontBody, fontVariantNumeric: 'tabular-nums', fontSize: 20, fontWeight: 500, letterSpacing: '-0.04em', color: estado === 'grabando' ? T.rec : T.text, lineHeight: 1.1 }}
      >
        1.1
      </span>
      <span style={{ ...label, fontSize: 11, whiteSpace: 'nowrap' }}>{project.bpm} BPM</span>
    </span>
  );
}

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
