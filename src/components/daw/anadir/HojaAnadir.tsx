'use client';

/**
 * «+ Añadir»: todas las formas de meter una pista nueva, en un solo sitio.
 * Antes había un «Importar» y un «Tocar» sueltos y grabar la voz solo se
 * descubría con el botón rojo del transporte (el dueño, en su iPhone: «no
 * puedo grabarme la voz»).
 *
 * Una fila por forma, con su icono de arcilla (el único 3D de la app) y una
 * línea que dice qué hace. Grabar y la IA se despliegan en su sitio en vez de
 * abrir otra hoja: grabar necesita decir qué entrada graba y dejar cambiarla
 * ahí mismo, y la IA tiene dos caminos.
 *
 * Diseño (taste → impeccable → emil): registro de producto, lista agrupada
 * como la de Ajustes, sin tarjetas; el rojo solo en «Empezar a grabar» y el
 * verde solo en lo que hace Aura. Despliegue de 260 ms con salida rápida.
 */

import { CaretDown, CaretRight } from '@phosphor-icons/react';
import { useEffect, useState, type ReactNode } from 'react';
import type { Archivo } from '@/hooks/useArchivo';
import type { Studio } from '@/hooks/useStudio';
import { listInputDevices } from '@/lib/daw/recorder';
import type { CanalEntrada } from '@/lib/daw/types';
import type { IdArcilla } from '@/lib/iconos/arcilla';
import { IconoArcilla } from '@/components/iconos/IconoArcilla';
import { inputStyle } from '../TrackPanel';
import { haptic, T } from '../theme';
import { Segmented, Sheet, hintText } from '../ui';

export interface AccionesDeAnadir {
  tocar: () => void;
  loops: () => void;
  musico: () => void;
  productor: () => void;
}

const CANALES: { value: CanalEntrada; text: string }[] = [
  { value: 'juntas', text: 'Las dos' },
  { value: 'entrada-1', text: 'Solo la 1' },
  { value: 'entrada-2', text: 'Solo la 2' },
];

/** «Graba las dos entradas juntas», dicho corto para la fila. */
export function queSeGraba(canal: CanalEntrada | undefined): string {
  if (canal === 'entrada-1') return 'solo la entrada 1';
  if (canal === 'entrada-2') return 'solo la entrada 2';
  return 'las dos entradas juntas';
}

export function HojaAnadir({
  studio,
  archivo,
  abierta,
  onCerrar,
  acciones,
}: {
  studio: Studio;
  archivo: Archivo;
  abierta: boolean;
  onCerrar: () => void;
  acciones: AccionesDeAnadir;
}) {
  const [desplegada, setDesplegada] = useState<'grabar' | 'ia' | null>(null);
  const [entradas, setEntradas] = useState<MediaDeviceInfo[]>([]);
  const { settings, project } = studio;

  // Cada vez que se abre, cerrada por dentro; las entradas, al desplegar grabar.
  useEffect(() => {
    if (!abierta) setDesplegada(null);
  }, [abierta]);
  useEffect(() => {
    if (desplegada !== 'grabar') return;
    void listInputDevices().then(setEntradas, () => setEntradas([]));
  }, [desplegada]);

  const hacer = (accion: () => void) => {
    haptic(10);
    onCerrar();
    accion();
  };

  const grabar = () => {
    haptic(12);
    onCerrar();
    // Dentro del toque: en iOS el audio solo arranca así.
    studio.engine?.unlockSync();
    void studio.record();
  };

  const cuenta = settings.countInBars > 0 ? `Con ${settings.countInBars === 1 ? 'un compás' : `${settings.countInBars} compases`} de cuenta atrás.` : 'Sin cuenta atrás.';
  const sinPistas = project.tracks.length === 0;

  return (
    <Sheet open={abierta} title="Añadir" onClose={onCerrar}>
      <div role="list" style={{ borderRadius: 16, background: T.fill, boxShadow: `inset 0 1px 0 ${T.rim}`, overflow: 'hidden', marginBottom: 12 }}>
        <Fila
          icono="micro"
          titulo="Grabar voz o instrumento"
          detalle={`Con el micro. Graba ${queSeGraba(settings.canalEntrada)}.`}
          desplegable
          abierta={desplegada === 'grabar'}
          onClick={() => setDesplegada((d) => (d === 'grabar' ? null : 'grabar'))}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <span style={{ ...hintText, display: 'block', fontSize: 13, marginBottom: 6 }}>
                Qué se graba. Si tienes una interfaz con el micro en una entrada y el instrumento en otra, elige cuál.
              </span>
              <Segmented
                ariaLabel="Qué entrada se graba"
                value={settings.canalEntrada ?? 'juntas'}
                options={CANALES}
                onChange={(canal) => void studio.reopenMic({ canalEntrada: canal })}
              />
            </div>
            {entradas.length > 1 ? (
              <select
                value={settings.inputDeviceId ?? ''}
                onChange={(event) => void studio.reopenMic({ inputDeviceId: event.target.value || null })}
                aria-label="Micrófono"
                style={{ ...inputStyle, appearance: 'auto' }}
              >
                <option value="">Entrada del dispositivo</option>
                {entradas.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || 'Micrófono'}
                  </option>
                ))}
              </select>
            ) : null}
            <button
              type="button"
              className="daw-press daw-sink"
              onClick={grabar}
              style={{
                minHeight: 52,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                border: 'none',
                borderRadius: 14,
                background: T.recFill,
                boxShadow: T.elev1,
                color: T.onRec,
                fontFamily: T.fontBody,
                fontSize: 16,
                fontWeight: 600,
                letterSpacing: '-0.01em',
                cursor: 'pointer',
              }}
            >
              <span aria-hidden style={{ width: 12, height: 12, borderRadius: '50%', background: T.onRec }} />
              Empezar a grabar
            </button>
            <span style={{ ...hintText, fontSize: 13 }}>{cuenta} Con cascos, para que no se cuele lo que ya suena.</span>
          </div>
        </Fila>

        <Fila icono="piano" titulo="Tocar un instrumento" detalle="Batería, teclado, acordes o bajo, en la pantalla." onClick={() => hacer(acciones.tocar)} />
        <Fila icono="loops" titulo="Poner un loop" detalle="Batería, bajo o percusión, ya a tu tempo." onClick={() => hacer(acciones.loops)} />

        <Fila
          icono="productor"
          titulo="Generar con IA"
          detalle="Aura toca algo debajo de lo tuyo o te propone una parte."
          desplegable
          abierta={desplegada === 'ia'}
          onClick={() => setDesplegada((d) => (d === 'ia' ? null : 'ia'))}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <BotonIa disabled={sinPistas} onClick={() => hacer(acciones.musico)}>
              Ponle algo debajo
            </BotonIa>
            {sinPistas ? <span style={{ ...hintText, fontSize: 13 }}>Para esto, graba o importa algo primero.</span> : null}
            <BotonIa secundario onClick={() => hacer(acciones.productor)}>
              Pídeselo al productor
            </BotonIa>
          </div>
        </Fila>

        <Fila
          icono="altavoz"
          titulo="Importar audio"
          detalle="Un m4a, mp3 o wav, una nota de voz o el audio de un vídeo."
          onClick={() => hacer(() => archivo.ejecutar('importarAudio'))}
        />
      </div>
      {/* Las rayas entre filas, y en el móvil lo desplegado a todo el ancho. */}
      <style>{`.daw-anadir-fila + .daw-anadir-fila { box-shadow: inset 0 1px 0 ${T.rowLine}; }
        @media (max-width: 420px) { .daw-anadir-fila .daw-land { padding-left: 14px !important; } }`}</style>
    </Sheet>
  );
}

function Fila({
  icono,
  titulo,
  detalle,
  onClick,
  desplegable,
  abierta,
  children,
}: {
  icono: IdArcilla;
  titulo: string;
  detalle: string;
  onClick: () => void;
  desplegable?: boolean;
  abierta?: boolean;
  children?: ReactNode;
}) {
  return (
    <div role="listitem" className="daw-anadir-fila">
      <button
        type="button"
        className="daw-press daw-hover"
        onClick={onClick}
        aria-expanded={desplegable ? !!abierta : undefined}
        style={{
          width: '100%',
          minHeight: 72,
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          padding: '10px 14px 10px 12px',
          border: 'none',
          background: 'transparent',
          textAlign: 'left',
          cursor: 'pointer',
          color: T.text,
        }}
      >
        <IconoArcilla id={icono} tamano={48} />
        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span style={{ fontFamily: T.fontBody, fontSize: 16, fontWeight: 600, letterSpacing: '-0.015em', lineHeight: 1.25 }}>{titulo}</span>
          <span style={{ fontFamily: T.fontBody, fontSize: 13, lineHeight: 1.35, color: T.dim }}>{detalle}</span>
        </span>
        {desplegable ? (
          <CaretDown size={16} color={T.faint} aria-hidden style={{ flexShrink: 0, transform: abierta ? 'rotate(180deg)' : 'none', transition: `transform 200ms ${T.easeOut}` }} />
        ) : (
          <CaretRight size={16} color={T.faint} aria-hidden style={{ flexShrink: 0 }} />
        )}
      </button>
      {desplegable && abierta ? (
        <div className="daw-land" style={{ padding: '2px 14px 16px 74px' }}>
          {children}
        </div>
      ) : null}
    </div>
  );
}

/** Lo que hará Aura: en verde, que es su color. */
function BotonIa({ children, onClick, disabled, secundario }: { children: ReactNode; onClick: () => void; disabled?: boolean; secundario?: boolean }) {
  return (
    <button
      type="button"
      className={secundario ? 'daw-press daw-hover' : 'daw-press daw-sink'}
      disabled={disabled}
      onClick={onClick}
      style={{
        minHeight: 48,
        border: 'none',
        borderRadius: 12,
        background: secundario ? T.raised : T.ai,
        boxShadow: secundario ? `inset 0 0 0 1px ${T.border}` : T.elev1,
        color: secundario ? T.ai : T.inverse,
        fontFamily: T.fontBody,
        fontSize: 15,
        fontWeight: 600,
        letterSpacing: '-0.01em',
        opacity: disabled ? 0.45 : 1,
        cursor: disabled ? 'default' : 'pointer',
      }}
    >
      {children}
    </button>
  );
}
