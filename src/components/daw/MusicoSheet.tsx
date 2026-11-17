'use client';

/**
 * La hoja del músico de sesión.
 *
 * Un solo recorrido, de arriba abajo: lo que ha oído, quién toca, cómo toca
 * y el botón. Nada se genera sin que lo pidas, y lo que sale entra como una
 * pista más, en ámbar, que se deshace con el mismo Deshacer de siempre.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Studio } from '@/hooks/useStudio';
import { NOMBRE_INSTRUMENTO, type Motor, type Musico, type Paso, type PeticionMomento } from '@/hooks/useMusico';
import type { Instrumento } from '@/lib/ia/tipos';
import { ESTILOS, type EstiloBajo } from '@/lib/musico/bajo';
import { ritmosParaTempo, tempoParaRitmo, vaConTuTempo } from '@/lib/musico/bateria';
import { ESTILOS_TECLAS, type EstiloTeclas } from '@/lib/musico/teclas';
import { Field, Readout, Sheet, T, hintText, label, numeric } from './ui';
import { GpuControl } from './GpuControl';
import { haptic } from './theme';

/** Los que tocan aquí mismo, sin red. El resto solo existe con IA. */
const AL_MOMENTO: Instrumento[] = ['bajo', 'bateria', 'teclado'];
const INSTRUMENTOS: Instrumento[] = ['bajo', 'bateria', 'teclado', 'guitarra', 'cuerdas', 'metales', 'percusion', 'sinte'];
const CON_ARTICULO: Record<Instrumento, string> = {
  bajo: 'el bajo',
  bateria: 'la batería',
  teclado: 'las teclas',
  guitarra: 'la guitarra',
  cuerdas: 'las cuerdas',
  metales: 'los metales',
  percusion: 'la percusión',
  sinte: 'el sinte',
};

const PASOS: Record<Paso, string> = {
  mandando: 'Mandando tu toma',
  'en-cola': 'Esperando turno en la GPU',
  generando: 'Tocando encima de ti',
  bajando: 'Bajando la pista',
  cuadrando: 'Cuadrándola a tu pulso',
};

export function MusicoSheet({
  studio,
  musico,
  open,
  onClose,
}: {
  studio: Studio;
  musico: Musico;
  open: boolean;
  onClose: () => void;
}) {
  const { selectedTrack } = studio;
  const { ia, escucha, escuchar, paso, error, setError, tocarAlMomento, tocarConIA, cancelar } = musico;
  const [instrumento, setInstrumento] = useState<Instrumento>('bajo');
  const [motor, setMotor] = useState<Motor>('momento');
  const [estilo, setEstilo] = useState<EstiloBajo>('raiz-quinta');
  const [estiloTeclas, setEstiloTeclas] = useState<EstiloTeclas>('colchon');
  const [ritmo, setRitmo] = useState<string | null>(null);
  const [descripcion, setDescripcion] = useState('');
  const [escuchando, setEscuchando] = useState(false);
  const [desde, setDesde] = useState<number | null>(null);
  const [ahora, setAhora] = useState(0);

  const trackId = selectedTrack?.id ?? null;
  const oidoDeEstaToma = escucha && escucha.trackId === trackId ? escucha : null;
  const trabajando = paso !== null;

  /* Se escucha DESPUÉS de que la hoja haya terminado de subir: analizar una
     toma larga ocupa el hilo unos cientos de milisegundos, y hacerlo a la vez
     que la animación la dejaría a tirones. */
  const trackRef = useRef(selectedTrack);
  trackRef.current = selectedTrack;
  useEffect(() => {
    if (!open || !trackId) return;
    setError(null);
    setEscuchando(true);
    const t = window.setTimeout(() => {
      if (trackRef.current) escuchar(trackRef.current);
      setEscuchando(false);
    }, 320);
    return () => window.clearTimeout(t);
  }, [open, trackId, escuchar, setError]);

  // El reloj del encargo: saber cuánto llevas esperando calma más que un spinner.
  useEffect(() => {
    if (!trabajando) {
      setDesde(null);
      return;
    }
    setDesde((d) => d ?? Date.now());
    const t = window.setInterval(() => setAhora(Date.now()), 500);
    return () => window.clearInterval(t);
  }, [trabajando]);

  const iaLista = Boolean(ia?.disponible);
  const soloIA = !AL_MOMENTO.includes(instrumento);
  // Un instrumento que solo toca la IA arrastra el motor; volver a uno de los
  // de aquí no lo devuelve: si elegiste IA, se respeta.
  const motorEfectivo: Motor = soloIA ? 'ia' : motor;

  /* La batería, ordenada por lo bien que va con tu tempo, y la primera
     elegida de salida: nada de escoger tú el BPM. */
  const ritmos = oidoDeEstaToma ? ritmosParaTempo(oidoDeEstaToma.bpm) : [];
  const ritmoElegido = ritmo ?? ritmos[0]?.id ?? null;

  const tocar = async () => {
    if (!selectedTrack || !oidoDeEstaToma) return;
    haptic(14);
    if (motorEfectivo === 'momento') {
      const peticion: PeticionMomento | null =
        instrumento === 'bajo'
          ? { instrumento: 'bajo', estilo }
          : instrumento === 'teclado'
            ? { instrumento: 'teclado', estilo: estiloTeclas }
            : ritmoElegido
              ? { instrumento: 'bateria', ritmo: ritmoElegido }
              : null;
      if (!peticion) return;
      // La hoja se va primero: la pista nueva aparece en la línea de tiempo,
      // que es donde se mira, y la hoja no parpadea mientras se renderiza.
      onClose();
      await tocarAlMomento(selectedTrack, oidoDeEstaToma, peticion);
      return;
    }
    const ok = await tocarConIA(selectedTrack, oidoDeEstaToma, instrumento, descripcion);
    if (ok) onClose();
  };

  // La batería no necesita acordes; el bajo y las teclas sí.
  const necesitaAcordes = motorEfectivo === 'momento' && instrumento !== 'bateria';
  const sinAcordes = oidoDeEstaToma !== null && !oidoDeEstaToma.progresion && necesitaAcordes;
  const bloqueado = !oidoDeEstaToma || sinAcordes || escuchando || (motorEfectivo === 'ia' && !iaLista);
  const detalleIA = !ia
    ? 'Comprobando si hay músico en la nube…'
    : ia.prueba
      ? 'Servidor de prueba: devuelve siempre la misma nota. Sirve para probar el recorrido, no para sonar.'
      : ia.disponible
        ? 'Un modelo toca escuchándote. Tarda de 30 a 60 segundos y suena a banda.'
        : ia.gpu
          ? 'La GPU está apagada para que no cobre. Enciéndela aquí abajo.'
          : ia.configurado
            ? 'Tu servidor no responde. Comprueba que el pod de la GPU esté encendido.'
            : 'Sin conectar. Hace falta encender ACE-Step en una GPU (docs/ACESTEP.md).';
  const segundos = desde ? Math.max(0, Math.round((ahora - desde) / 1000)) : 0;

  return (
    <Sheet open={open} title="Músico de sesión" onClose={trabajando ? () => undefined : onClose}>
      {!selectedTrack ? (
        <p style={texto}>Elige primero la toma sobre la que quieres tocar.</p>
      ) : (
        <>
          <Field title={`Lo que he oído en «${selectedTrack.name}»`}>
            {escuchando || !oidoDeEstaToma ? (
              <p style={{ ...texto, color: T.faint }}>Escuchando la toma…</p>
            ) : (
              <div>
                <div
                  style={{
                    padding: '14px 16px',
                    borderRadius: 14,
                    background: T.fill,
                    boxShadow: `inset 0 1px 0 ${T.rim}`,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
                    <span style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <Readout
                        value={oidoDeEstaToma.bpm.toLocaleString('es-ES', { maximumFractionDigits: 1 })}
                        unit="BPM"
                        size={32}
                      />
                      <span style={label}>
                        {oidoDeEstaToma.fuenteBpm === 'proyecto' ? 'El de la claqueta' : 'El de tu toma'}
                      </span>
                    </span>
                    {oidoDeEstaToma.tonalidad ? (
                      <span style={{ marginLeft: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                        <span style={{ fontFamily: T.fontBody, fontSize: 17, fontWeight: 600, letterSpacing: '-0.015em', color: T.text }}>
                          {oidoDeEstaToma.tonalidad.nombre}
                        </span>
                        <span style={label}>
                          {oidoDeEstaToma.tonalidad.flamenco ? oidoDeEstaToma.tonalidad.flamenco : 'Tonalidad'}
                        </span>
                      </span>
                    ) : null}
                  </div>
                  <p
                    style={{
                      marginTop: 14,
                      paddingTop: 12,
                      boxShadow: `inset 0 1px 0 ${T.rowLine}`,
                      ...numeric,
                      fontSize: 14,
                      lineHeight: 1.5,
                      color: sinAcordes ? T.faint : T.text,
                    }}
                  >
                    {sinAcordes ? 'No oigo acordes claros' : oidoDeEstaToma.progresion}
                  </p>
                </div>
                {sinAcordes ? (
                  <p style={{ ...texto, marginTop: 10 }}>
                    El bajo y las teclas siguen la armonía. Prueba con una toma rasgueada, o pon batería, que no la necesita.
                  </p>
                ) : null}
              </div>
            )}
          </Field>

          <Field title="Qué toca">
            <div
              role="radiogroup"
              aria-label="Instrumento"
              style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 3, padding: 3, borderRadius: 14, background: T.fill }}
            >
              {INSTRUMENTOS.map((id) => {
                const activo = instrumento === id;
                const deIA = !AL_MOMENTO.includes(id);
                return (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={activo}
                    disabled={trabajando}
                    className="daw-press"
                    onClick={() => {
                      haptic(8);
                      setInstrumento(id);
                    }}
                    style={{
                      position: 'relative',
                      minHeight: 44,
                      padding: '0 4px',
                      borderRadius: 11,
                      border: 'none',
                      background: activo ? T.thumb : 'transparent',
                      boxShadow: activo ? (deIA ? `inset 0 0 0 1.5px ${T.ai}, ${T.elev1}` : T.elev1) : 'none',
                      color: activo ? T.text : T.dim,
                      fontFamily: T.fontBody,
                      fontSize: 13,
                      fontWeight: activo ? 600 : 500,
                      letterSpacing: '-0.01em',
                      whiteSpace: 'nowrap',
                      cursor: 'pointer',
                      transition: `background-color 160ms ${T.easeOut}, box-shadow 160ms ${T.easeOut}, color 160ms ${T.easeOut}`,
                    }}
                  >
                    {NOMBRE_INSTRUMENTO[id]}
                    {deIA ? (
                      <span
                        title="Solo con IA"
                        style={{ position: 'absolute', top: 6, right: 6, width: 5, height: 5, borderRadius: '50%', background: T.ai }}
                      />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </Field>

          <Field title="Quién toca">
            <Opciones>
              <Opcion
                activa={motorEfectivo === 'momento'}
                onClick={() => setMotor('momento')}
                titulo="Al momento"
                detalle={
                  soloIA
                    ? `Aquí tocan el bajo, la batería y las teclas. ${NOMBRE_INSTRUMENTO[instrumento]}, solo con IA.`
                    : 'En el móvil y sin red. Va a tu tempo y sigue tus acordes. Sale en un segundo.'
                }
                disabled={trabajando || soloIA}
              />
              <Opcion
                activa={motorEfectivo === 'ia'}
                onClick={() => setMotor('ia')}
                titulo={`Con IA${ia?.proveedor ? ` · ${ia.proveedor}` : ''}`}
                detalle={detalleIA}
                disabled={!iaLista || trabajando}
                ia
              />
            </Opciones>
            <GpuControl musico={musico} />
          </Field>

          {motorEfectivo === 'momento' && instrumento === 'bateria' ? (
            <Field
              title="Qué ritmo"
              hint="Arriba, los que van con tu tempo. Todos suenan a tu pulso, aunque ese ritmo suela ir más rápido o más lento."
            >
              <Opciones>
                {ritmos.map((r) => {
                  const bpm = oidoDeEstaToma ? Math.round(tempoParaRitmo(oidoDeEstaToma.bpm, r.bpm)) : null;
                  const encaja = oidoDeEstaToma ? vaConTuTempo(oidoDeEstaToma.bpm, r) : false;
                  return (
                    <Opcion
                      key={r.id}
                      activa={ritmoElegido === r.id}
                      onClick={() => setRitmo(r.id)}
                      titulo={r.nombre}
                      detalle={`${r.familia}${bpm ? ` · a ${bpm} BPM` : ''}${encaja ? '' : ' · fuera de su tempo habitual'}`}
                    />
                  );
                })}
              </Opciones>
            </Field>
          ) : motorEfectivo === 'momento' ? (
            <Field title="Cómo toca">
              <Opciones>
                {(instrumento === 'teclado' ? ESTILOS_TECLAS : ESTILOS).map((e) => (
                  <Opcion
                    key={e.id}
                    activa={(instrumento === 'teclado' ? estiloTeclas : estilo) === e.id}
                    onClick={() =>
                      instrumento === 'teclado' ? setEstiloTeclas(e.id as EstiloTeclas) : setEstilo(e.id as EstiloBajo)
                    }
                    titulo={e.nombre}
                    detalle={e.descripcion}
                  />
                ))}
              </Opciones>
            </Field>
          ) : (
            <Field
              title="Cómo lo quieres"
              hint="Opcional. Dilo como se lo dirías a un músico: el modelo entiende inglés mejor, pero el castellano también le vale."
            >
              <input
                value={descripcion}
                onChange={(event) => setDescripcion(event.target.value)}
                maxLength={200}
                disabled={trabajando}
                placeholder={instrumento === 'bateria' ? 'Escobillas, suave, de bolero' : 'De dedos, funky, que respire'}
                aria-label={`Cómo quieres ${CON_ARTICULO[instrumento]}`}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  minHeight: 48,
                  padding: '0 14px',
                  borderRadius: 12,
                  border: 'none',
                  boxShadow: `inset 0 0 0 1px ${T.border}`,
                  background: T.fill,
                  color: T.text,
                  fontFamily: T.fontBody,
                  // 16 px: por debajo, Safari hace zoom al enfocar el campo.
                  fontSize: 16,
                  outline: 'none',
                }}
              />
            </Field>
          )}

          {trabajando ? (
            <div
              role="status"
              aria-live="polite"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                minHeight: 56,
                padding: '0 6px 0 16px',
                borderRadius: 14,
                background: T.aiSoft,
                boxShadow: `inset 0 0 0 1px ${T.ai}`,
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: T.ai,
                  animation: 'daw-blink 1.6s ease-in-out infinite',
                  flexShrink: 0,
                }}
              />
              <span style={{ flex: 1, fontFamily: T.fontBody, fontSize: 15, fontWeight: 500, color: T.text }}>
                {paso ? PASOS[paso] : ''}
              </span>
              <span style={{ ...numeric, fontSize: 13, color: T.dim }}>
                {segundos} s
              </span>
              <button type="button" className="daw-press" onClick={cancelar} style={botonSecundario}>
                Cancelar
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="daw-press daw-sink"
              onClick={() => void tocar()}
              disabled={bloqueado}
              style={{
                width: '100%',
                minHeight: 54,
                borderRadius: 14,
                border: 'none',
                // Lo que sale de aquí lo toca la máquina: ámbar, como la pista que va a crear.
                background: T.ai,
                boxShadow: T.elev1,
                color: T.inverse,
                fontFamily: T.fontBody,
                fontSize: 16,
                fontWeight: 600,
                letterSpacing: '-0.01em',
                cursor: bloqueado ? 'default' : 'pointer',
                opacity: bloqueado ? 0.4 : 1,
              }}
            >
              {motorEfectivo === 'momento' ? `Tocar ${CON_ARTICULO[instrumento]}` : `Encargar ${CON_ARTICULO[instrumento]}`}
            </button>
          )}

          {error ? (
            <p role="alert" style={{ ...texto, marginTop: 12, color: T.rec }}>
              {error}
            </p>
          ) : (
            <p style={{ ...texto, marginTop: 12, color: T.faint }}>
              Entra como una pista nueva, en ámbar, debajo de tu toma. Si no te convence, Deshacer.
            </p>
          )}
        </>
      )}
    </Sheet>
  );
}

const texto = hintText;

const botonSecundario = {
  minHeight: 44,
  padding: '0 14px',
  borderRadius: 10,
  border: 'none',
  background: T.fill,
  boxShadow: `inset 0 1px 0 ${T.rim}`,
  color: T.text,
  fontFamily: T.fontBody,
  fontSize: 14,
  fontWeight: 500,
  cursor: 'pointer',
} as const;

function Opciones({ children }: { children: ReactNode }) {
  return (
    // Una lista agrupada con separadores finos, no una pila de tarjetas iguales.
    <div
      role="radiogroup"
      className="daw-opciones"
      style={{
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 14,
        background: T.fill,
        boxShadow: `inset 0 1px 0 ${T.rim}`,
        overflow: 'hidden',
      }}
    >
      {children}
    </div>
  );
}

function Opcion({
  activa,
  onClick,
  titulo,
  detalle,
  disabled,
  ia,
}: {
  activa: boolean;
  onClick: () => void;
  titulo: string;
  detalle: string;
  disabled?: boolean;
  ia?: boolean;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={activa}
      disabled={disabled}
      className="daw-press"
      onClick={() => {
        if (disabled) return;
        haptic(8);
        onClick();
      }}
      style={{
        display: 'grid',
        gridTemplateColumns: '20px 1fr',
        alignItems: 'start',
        columnGap: 12,
        textAlign: 'left',
        width: '100%',
        padding: '14px 16px 14px 16px',
        border: 'none',
        background: activa ? (ia ? T.aiSoft : T.fillStrong) : 'transparent',
        color: T.text,
        opacity: disabled && !activa ? 0.45 : 1,
        cursor: disabled ? 'default' : 'pointer',
        transition: `background-color 160ms ${T.easeOut}`,
      }}
    >
      {/* El punto del radio: relleno cuando está elegido. */}
      <span
        aria-hidden
        style={{
          marginTop: 1,
          width: 20,
          height: 20,
          borderRadius: '50%',
          boxShadow: `inset 0 0 0 1.5px ${activa ? (ia ? T.ai : T.text) : T.borderStrong}`,
          display: 'grid',
          placeItems: 'center',
        }}
      >
        {activa ? (
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: ia ? T.ai : T.text }} />
        ) : null}
      </span>
      <span>
        <span style={{ display: 'block', fontFamily: T.fontBody, fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em' }}>
          {titulo}
        </span>
        <span style={{ display: 'block', marginTop: 3, fontFamily: T.fontBody, fontSize: 13, lineHeight: 1.45, fontWeight: 400, color: T.dim }}>
          {detalle}
        </span>
      </span>
    </button>
  );
}
