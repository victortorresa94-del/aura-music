'use client';

/**
 * Las tiras del mezclador: una por pista y la del master.
 *
 * De arriba abajo, en el orden en que se mira una mesa: quién es, qué
 * efectos lleva, dónde suena (panorama), cuánto (fader y medidor) y si
 * suena (mute y solo). Todas las tiras miden lo mismo y los faders quedan a
 * la misma altura, para comparar niveles de un vistazo.
 */

import type { Studio } from '@/hooks/useStudio';
import type { Mezcla } from '@/hooks/useMezcla';
import { conMaster, conMezcla, conVolumen } from '@/lib/daw/mezcla/acciones';
import { textoDb, linealADb, textoPanorama } from '@/lib/daw/mezcla/escala';
import { rt60De } from '@/lib/daw/mezcla/sala';
import { masterDe, mezclaDe, NOMBRE_DIVISION, NOMBRE_ESPACIO, preajuste, preajusteActual, tieneEfectos } from '@/lib/daw/mezcla/tipos';
import type { Track } from '@/lib/daw/types';
import { haptic, T, trackTint } from '../theme';
import { Fader, Panorama } from './controles';
import { Medidor } from './Medidores';

export const ANCHO_TIRA = 80;
export const ANCHO_TIRA_ANCHA = 96;

/** Un botón pequeño de la tira: Efectos, M, S, Limitador. */
function BotonTira({
  children,
  onClick,
  activo,
  etiqueta,
  ancho,
  marca,
}: {
  children: React.ReactNode;
  onClick: () => void;
  activo?: boolean;
  etiqueta: string;
  ancho?: number | string;
  /** Un punto: lleva algo puesto aunque no sea un preajuste. */
  marca?: boolean;
}) {
  return (
    <button
      type="button"
      className="daw-press daw-hover mez-boton"
      aria-label={etiqueta}
      title={etiqueta}
      aria-pressed={activo}
      onClick={() => {
        haptic(8);
        onClick();
      }}
      style={{
        position: 'relative',
        width: ancho ?? '100%',
        minWidth: 0,
        height: 36,
        padding: '0 6px',
        border: 'none',
        borderRadius: 9,
        background: activo ? T.text : T.fill,
        boxShadow: activo ? 'none' : `inset 0 1px 0 ${T.rim}`,
        color: activo ? T.inverse : T.text,
        fontFamily: T.fontBody,
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: '-0.005em',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        cursor: 'pointer',
        touchAction: 'manipulation',
        transition: `background-color 140ms ${T.easeOut}, color 140ms ${T.easeOut}`,
      }}
    >
      {children}
      {marca ? (
        <span
          aria-hidden
          style={{ position: 'absolute', top: 5, right: 5, width: 5, height: 5, borderRadius: 3, background: activo ? T.inverse : T.text }}
        />
      ) : null}
    </button>
  );
}

/** El hueco común de una tira: así las de pista y la del master se alinean. */
function Columna({
  children,
  ancho,
  seleccionada,
  etiqueta,
}: {
  children: React.ReactNode;
  ancho: number;
  seleccionada?: boolean;
  etiqueta: string;
}) {
  return (
    <section
      aria-label={etiqueta}
      className="mez-tira"
      style={{
        flex: `0 0 ${ancho}px`,
        width: ancho,
        height: '100%',
        display: 'grid',
        gridTemplateRows: '40px 36px 50px minmax(120px, 1fr) 22px 36px',
        rowGap: 8,
        padding: '10px 8px 12px',
        background: seleccionada ? T.fill : 'transparent',
        boxShadow: `inset -1px 0 0 ${T.rowLine}`,
        scrollSnapAlign: 'start',
      }}
    >
      {children}
    </section>
  );
}

function Nombre({ texto, ia, tinte, onClick }: { texto: string; ia?: boolean; tinte?: string; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className="mez-boton"
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 4,
        minWidth: 0,
        padding: 0,
        border: 'none',
        background: 'transparent',
        textAlign: 'left',
        cursor: onClick ? 'pointer' : 'default',
        touchAction: 'manipulation',
        color: T.text,
      }}
    >
      {ia ? (
        <span style={{ alignSelf: 'flex-start', padding: '2px 4px', borderRadius: 4, background: T.aiSoft, color: T.ai, fontSize: 10, fontWeight: 700, lineHeight: 1 }}>
          IA
        </span>
      ) : tinte ? (
        <span aria-hidden style={{ width: 10, height: 10, borderRadius: 3, background: tinte }} />
      ) : null}
      <span
        style={{
          display: 'block',
          maxWidth: '100%',
          fontFamily: T.fontBody,
          fontSize: 13,
          fontWeight: 600,
          letterSpacing: '-0.01em',
          lineHeight: 1.2,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {texto}
      </span>
    </button>
  );
}

function Lectura({ children, fuerte }: { children: React.ReactNode; fuerte?: boolean }) {
  return (
    <span
      style={{
        alignSelf: 'center',
        textAlign: 'center',
        fontFamily: T.fontBody,
        fontVariantNumeric: 'tabular-nums',
        fontSize: 13,
        fontWeight: 500,
        letterSpacing: '-0.02em',
        color: fuerte ? T.text : T.dim,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}

export function TiraDePista({
  studio,
  mezcla,
  track,
  indice,
  tema,
  ancho,
  suena,
  onEfectos,
}: {
  studio: Studio;
  mezcla: Mezcla;
  track: Track;
  indice: number;
  tema: 'dark' | 'light';
  ancho: number;
  /** Ya resueltos mute y solo. */
  suena: boolean;
  onEfectos: () => void;
}) {
  const { project, selectedTrackId, setSelectedTrackId, toggleMute, toggleSolo } = studio;
  const m = mezclaDe(track);
  const idPreajuste = preajusteActual(m, masterDe(project).espacio);
  const nombrePreajuste = idPreajuste && idPreajuste !== 'seco' ? preajuste(idPreajuste)?.nombre : null;
  const grupo = (que: string) => `${que}:${track.id}`;

  return (
    <Columna ancho={ancho} seleccionada={selectedTrackId === track.id} etiqueta={track.name}>
      <Nombre
        texto={track.name}
        ia={track.ia}
        tinte={trackTint(indice, tema)}
        onClick={() => setSelectedTrackId(track.id)}
      />
      <BotonTira
        etiqueta={`Efectos de ${track.name}${nombrePreajuste ? `: ${nombrePreajuste}` : ''}`}
        onClick={onEfectos}
        marca={!nombrePreajuste && tieneEfectos(m)}
      >
        {nombrePreajuste ?? 'Efectos'}
      </BotonTira>
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 2 }}>
        <Panorama
          valor={m.panorama}
          etiqueta={`Panorama de ${track.name}`}
          onVivo={(v) => mezcla.oir((p) => conMezcla(p, track.id, { panorama: v }))}
          onSoltar={(v) => mezcla.guardar((p) => conMezcla(p, track.id, { panorama: v }), grupo('panorama'))}
        />
        <Lectura>{textoPanorama(m.panorama)}</Lectura>
      </div>
      <div style={{ display: 'flex', gap: 6, minHeight: 0, opacity: suena ? 1 : 0.55, transition: `opacity 160ms ${T.easeOut}` }}>
        <Fader
          volumen={track.volume}
          etiqueta={`Volumen de ${track.name}`}
          apagado={!suena}
          onVivo={(v) => studio.engine?.setTrackVolume(track.id, v, suena)}
          onSoltar={(v) => mezcla.guardar((p) => conVolumen(p, track.id, v), grupo('volumen'))}
        />
        <div style={{ padding: '10px 0', height: '100%' }}>
          <Medidor clave={`pista:${track.id}`} apagado={!suena} />
        </div>
      </div>
      <Lectura fuerte>{textoDb(linealADb(track.volume))}</Lectura>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
        <BotonTira etiqueta={`Silenciar ${track.name}`} activo={track.muted} onClick={() => toggleMute(track.id)}>
          M
        </BotonTira>
        <BotonTira etiqueta={`Solo ${track.name}`} activo={track.soloed} onClick={() => toggleSolo(track.id)}>
          S
        </BotonTira>
      </div>
    </Columna>
  );
}

export function TiraMaster({
  studio,
  mezcla,
  ancho,
  onAjustes,
}: {
  studio: Studio;
  mezcla: Mezcla;
  ancho: number;
  onAjustes: () => void;
}) {
  const { project } = studio;
  const master = masterDe(project);
  const rt60 = rt60De(master.espacio, master.tamano);

  return (
    <Columna ancho={ancho} etiqueta="Master">
      <Nombre texto="Master" />
      <BotonTira etiqueta="Ajustes del master" onClick={onAjustes}>
        Ajustes
      </BotonTira>
      {/* Donde las pistas tienen el panorama, el master dice dónde suenan
          los dos efectos compartidos. */}
      <button
        type="button"
        onClick={onAjustes}
        className="mez-boton"
        aria-label={`Reverb ${NOMBRE_ESPACIO[master.espacio]}, eco a ${NOMBRE_DIVISION[master.division].toLowerCase()}. Cambiar`}
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: 3,
          padding: 0,
          border: 'none',
          background: 'transparent',
          color: T.dim,
          fontFamily: T.fontBody,
          fontSize: 11,
          lineHeight: 1.2,
          textAlign: 'left',
          cursor: 'pointer',
          touchAction: 'manipulation',
          minWidth: 0,
        }}
      >
        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {NOMBRE_ESPACIO[master.espacio]} · {rt60.toLocaleString('es-ES', { maximumFractionDigits: 1 })} s
        </span>
        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {/* «1/4.» es como se escribe la negra con puntillo en una partitura. */}
          Eco {master.division}
        </span>
      </button>
      <div style={{ display: 'flex', gap: 6, minHeight: 0 }}>
        <Fader
          volumen={master.volumen}
          etiqueta="Volumen del master"
          onVivo={(v) => mezcla.oir((p) => conMaster(p, { volumen: v }))}
          onSoltar={(v) => mezcla.guardar((p) => conMaster(p, { volumen: v }), 'volumen:master')}
        />
        <div style={{ display: 'flex', gap: 2, padding: '10px 0', height: '100%' }}>
          <Medidor clave="master:0" ancho={5} />
          <Medidor clave="master:1" ancho={5} />
        </div>
      </div>
      <Lectura fuerte>{textoDb(linealADb(master.volumen))}</Lectura>
      <BotonTira
        etiqueta={master.limitador ? 'Limitador puesto. Quitar' : 'Limitador quitado. Poner'}
        activo={master.limitador}
        onClick={() => mezcla.guardar((p) => conMaster(p, { limitador: !master.limitador }))}
      >
        Limitador
      </BotonTira>
    </Columna>
  );
}
