'use client';

/**
 * Las dos hojas del mezclador: los efectos de una pista y los ajustes del
 * master. Controles simples (un deslizador por cosa, con su cifra) y
 * preajustes arriba, que es por donde empieza casi todo el mundo.
 */

import type { Studio } from '@/hooks/useStudio';
import type { Mezcla } from '@/hooks/useMezcla';
import { conMaster, conMezcla, conPreajusteEn } from '@/lib/daw/mezcla/acciones';
import { segundosDeEco } from '@/lib/daw/mezcla/efectos';
import { textoGanancia, textoPorcentaje } from '@/lib/daw/mezcla/escala';
import { OBJETIVOS } from '@/lib/daw/mezcla/masterizar';
import { rt60De } from '@/lib/daw/mezcla/sala';
import {
  masterDe,
  mezclaDe,
  NOMBRE_ESPACIO,
  PREAJUSTES,
  preajuste,
  preajusteActual,
  type DivisionEco,
  type Espacio,
  type MezclaPista,
  type ObjetivoMaster,
} from '@/lib/daw/mezcla/tipos';
import type { Project } from '@/lib/daw/types';
import { haptic, T } from '../theme';
import { Field, Segmented, Sheet, TextButton, Toggle, hintText } from '../ui';
import { Deslizador } from './controles';

const segundos = (s: number) => `${s.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} s`;
const unDecimal = (n: number) => n.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const lufs = (n: number) => `${n < 0 ? '−' : ''}${unDecimal(Math.abs(n))} LUFS`;
const dbtp = (n: number) => `${n < 0 ? '−' : '+'}${unDecimal(Math.abs(n))} dBTP`;

/* -------------------------------------------------------------------------- */
/* Efectos de una pista                                                        */
/* -------------------------------------------------------------------------- */

export function HojaEfectos({
  studio,
  mezcla,
  trackId,
  open,
  onClose,
}: {
  studio: Studio;
  mezcla: Mezcla;
  /** La pista de la hoja. Se conserva al cerrar, para que no se vacíe mientras baja. */
  trackId: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const { project } = studio;
  const track = project.tracks.find((t) => t.id === trackId) ?? null;
  const abierta = open && !!track;
  if (!track) return <Sheet open={false} title="Efectos" onClose={onClose}>{null}</Sheet>;

  const m = mezclaDe(track);
  const master = masterDe(project);
  const actual = preajusteActual(m, master.espacio);
  const elegido = actual ? preajuste(actual) : null;
  const id = track.id;
  const otrasConReverb = project.tracks.filter((t) => t.id !== id && mezclaDe(t).reverb > 0).length;

  /** Un deslizador de esta pista: se oye al moverlo y se guarda al soltar. */
  const control = (clave: keyof MezclaPista, factor = 1) => ({
    valor: m[clave] * factor,
    onVivo: (v: number) => mezcla.oir((p: Project) => conMezcla(p, id, { [clave]: v / factor })),
    onSoltar: (v: number) => mezcla.guardar((p: Project) => conMezcla(p, id, { [clave]: v / factor }), `${clave}:${id}`),
  });

  const pistaDicha = track.name;

  return (
    <Sheet open={abierta} title={`Efectos · ${pistaDicha}`} onClose={onClose}>
      <Field title="Preajustes">
        <div role="radiogroup" aria-label="Preajustes" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {PREAJUSTES.map((p) => {
            const puesto = p.id === actual;
            return (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={puesto}
                className="daw-press daw-hover"
                onClick={() => {
                  haptic(8);
                  mezcla.guardar((proyecto) => conPreajusteEn(proyecto, id, p.id));
                }}
                style={{
                  minHeight: 40,
                  padding: '0 14px',
                  border: 'none',
                  borderRadius: 20,
                  background: puesto ? T.text : T.fill,
                  boxShadow: puesto ? T.elev1 : `inset 0 1px 0 ${T.rim}`,
                  color: puesto ? T.inverse : T.text,
                  fontFamily: T.fontBody,
                  fontSize: 14,
                  fontWeight: 500,
                  letterSpacing: '-0.01em',
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  touchAction: 'manipulation',
                  transition: `background-color 160ms ${T.easeOut}, color 160ms ${T.easeOut}`,
                }}
              >
                {p.nombre}
              </button>
            );
          })}
        </div>
        <p style={{ ...hintText, marginTop: 10 }}>{elegido ? elegido.descripcion : 'A tu manera: has tocado los controles a mano.'}</p>
        {/* «Sala» y «Catedral» mueven la reverb de todas las pistas. Si hay
            otras que la usan, se dice antes de tocarlo. */}
        {otrasConReverb > 0 ? (
          <p style={{ ...hintText, marginTop: 6 }}>
            «Sala» y «Catedral» cambian la reverb de toda la mezcla: también la de {otrasConReverb === 1 ? 'otra pista' : `${otrasConReverb} pistas más`}.
          </p>
        ) : null}
      </Field>

      <Field title="Ecualizador">
        <Deslizador etiqueta="Graves" detalle="120 Hz" min={-12} max={12} paso={0.5} bipolar formato={textoGanancia} {...control('graves')} />
        <Deslizador etiqueta="Medios" detalle="1 kHz" min={-12} max={12} paso={0.5} bipolar formato={textoGanancia} {...control('medios')} />
        <Deslizador etiqueta="Agudos" detalle="6 kHz" min={-12} max={12} paso={0.5} bipolar formato={textoGanancia} {...control('agudos')} />
      </Field>

      <Field title="Dinámica" hint="El compresor iguala lo fuerte y lo flojo; la saturación redondea los picos y le da cuerpo.">
        <Deslizador etiqueta="Compresor" min={0} max={1} formato={textoPorcentaje} {...control('compresor')} />
        <Deslizador etiqueta="Saturación" min={0} max={1} formato={textoPorcentaje} {...control('saturacion')} />
      </Field>

      <Field
        title="Envíos"
        hint="La reverb y el eco son los mismos para todas las pistas: aquí eliges cuánto le llega a esta. El sitio y el tiempo se cambian en el master."
      >
        <Deslizador
          etiqueta="Reverb"
          detalle={`${NOMBRE_ESPACIO[master.espacio]}, ${unDecimal(rt60De(master.espacio, master.tamano))} s`}
          min={0}
          max={1}
          formato={textoPorcentaje}
          {...control('reverb')}
        />
        <Deslizador
          etiqueta="Eco"
          detalle={`a ${master.division}, ${segundos(segundosDeEco(project.bpm, master.division))}`}
          min={0}
          max={1}
          formato={textoPorcentaje}
          {...control('eco')}
        />
      </Field>

      <TextButton full onClick={() => mezcla.guardar((p) => conPreajusteEn(p, id, 'seco'))}>
        Quitar efectos
      </TextButton>
    </Sheet>
  );
}

/* -------------------------------------------------------------------------- */
/* Master                                                                      */
/* -------------------------------------------------------------------------- */

const ESPACIOS: { value: Espacio; text: string }[] = [
  { value: 'estudio', text: 'Estudio' },
  { value: 'sala', text: 'Sala' },
  { value: 'catedral', text: 'Catedral' },
];

const DIVISIONES: { value: DivisionEco; text: string }[] = [
  { value: '1/8', text: 'Corchea' },
  { value: '1/4', text: 'Negra' },
  { value: '1/4.', text: 'Con puntillo' },
];

const MASTERIZADOS: { value: ObjetivoMaster; text: string }[] = [
  { value: 'no', text: 'Sin tocar' },
  { value: 'plataformas', text: '−14 LUFS' },
  { value: 'movil', text: '−16 LUFS' },
];

export function HojaMaster({
  studio,
  mezcla,
  open,
  onClose,
}: {
  studio: Studio;
  mezcla: Mezcla;
  open: boolean;
  onClose: () => void;
}) {
  const { project } = studio;
  const master = masterDe(project);
  const { masterizado, cifrasAlDia } = mezcla;

  return (
    <Sheet open={open} title="Master" onClose={onClose}>
      <Field
        title="Masterizar"
        intro="Al exportar la mezcla entera, el WAV sale a la sonoridad que piden las plataformas sin pasar de −1 dBTP de pico. Las pistas sueltas salen sin masterizar."
      >
        <Segmented
          ariaLabel="Masterizado"
          value={master.masterizado}
          options={MASTERIZADOS}
          onChange={(valor) => {
            if (valor === 'no') mezcla.quitarMaster();
            else void mezcla.masterizar(valor);
          }}
        />
        <p style={{ ...hintText, marginTop: 10 }}>
          {master.masterizado === 'movil'
            ? '−16 LUFS deja más aire: suena mejor en el altavoz del móvil y en unos cascos.'
            : master.masterizado === 'plataformas'
              ? '−14 LUFS es a lo que Spotify iguala todas las canciones: así no te la baja ni te la sube.'
              : 'El WAV sale tal como suena aquí.'}
        </p>
        {masterizado.estado === 'listo' && masterizado.antes && masterizado.despues ? (
          <div
            style={{
              marginTop: 12,
              padding: '12px 14px',
              borderRadius: 12,
              background: T.fill,
              boxShadow: `inset 0 1px 0 ${T.rim}`,
              display: 'grid',
              gridTemplateColumns: 'auto 1fr',
              columnGap: 14,
              rowGap: 6,
              fontFamily: T.fontBody,
              fontSize: 14,
              fontVariantNumeric: 'tabular-nums',
              opacity: cifrasAlDia ? 1 : 0.55,
            }}
          >
            <span style={{ color: T.dim }}>Tu mezcla</span>
            <span style={{ color: T.text }}>
              {lufs(masterizado.antes.lufs)} · {dbtp(masterizado.antes.picoVerdadero)}
            </span>
            <span style={{ color: T.dim }}>El WAV</span>
            <span style={{ color: T.text, fontWeight: 600 }}>
              {lufs(masterizado.despues.lufs)} · {dbtp(masterizado.despues.picoVerdadero)}
            </span>
          </div>
        ) : null}
        {masterizado.estado === 'listo' && !cifrasAlDia ? (
          <p style={{ ...hintText, marginTop: 8 }}>Has cambiado la mezcla desde que la medí. Al exportar se vuelve a calcular igual.</p>
        ) : null}
        {masterizado.estado === 'vacio' ? (
          <p style={{ ...hintText, marginTop: 8 }}>No suena nada que medir. Quita el mute a alguna pista.</p>
        ) : null}
        {masterizado.estado === 'fallo' ? (
          <p style={{ ...hintText, marginTop: 8 }}>No he podido medir la mezcla. Prueba otra vez.</p>
        ) : null}
        {masterizado.estado === 'listo' && (masterizado.limitadoDb ?? 0) > 6 ? (
          <p style={{ ...hintText, marginTop: 8 }}>
            Para llegar he tenido que apretar {unDecimal(masterizado.limitadoDb ?? 0)} dB los picos. Si suena aplastado, prueba «−16 LUFS».
          </p>
        ) : null}
      </Field>

      <Field title="Reverb" hint="Una sola reverb para todas las pistas, como en un estudio: suena más junta y gasta menos móvil.">
        <Segmented
          ariaLabel="Sitio de la reverb"
          value={master.espacio}
          options={ESPACIOS}
          onChange={(espacio) => mezcla.guardar((p) => conMaster(p, { espacio }))}
        />
        <div style={{ marginTop: 8 }}>
          <Deslizador
            etiqueta="Tamaño"
            detalle={`cola de ${unDecimal(rt60De(master.espacio, master.tamano))} s`}
            valor={master.tamano}
            min={0}
            max={1}
            formato={textoPorcentaje}
            onVivo={(v) => mezcla.oir((p) => conMaster(p, { tamano: v }))}
            onSoltar={(v) => mezcla.guardar((p) => conMaster(p, { tamano: v }), 'tamano:master')}
          />
        </div>
      </Field>

      <Field title="Eco" hint={`Va siempre a tempo. A ${project.bpm} BPM, ahora repite cada ${segundos(segundosDeEco(project.bpm, master.division))}.`}>
        <Segmented
          ariaLabel="Tiempo del eco"
          value={master.division}
          options={DIVISIONES}
          onChange={(division) => mezcla.guardar((p) => conMaster(p, { division }))}
        />
        <div style={{ marginTop: 8 }}>
          <Deslizador
            etiqueta="Repeticiones"
            valor={master.repeticiones}
            min={0}
            max={0.85}
            formato={(v) => textoPorcentaje(v / 0.85)}
            onVivo={(v) => mezcla.oir((p) => conMaster(p, { repeticiones: v }))}
            onSoltar={(v) => mezcla.guardar((p) => conMaster(p, { repeticiones: v }), 'repeticiones:master')}
          />
        </div>
      </Field>

      <Field title="Limitador">
        <Toggle
          checked={master.limitador}
          onChange={(limitador) => mezcla.guardar((p) => conMaster(p, { limitador }))}
          title="Limitador"
          detail="Sujeta los picos para que la suma de pistas no recorte. Viene puesto."
        />
      </Field>
    </Sheet>
  );
}

export const OBJETIVO_DICHO: Record<Exclude<ObjetivoMaster, 'no'>, string> = {
  plataformas: `${OBJETIVOS.plataformas.lufs} LUFS`.replace('-', '−'),
  movil: `${OBJETIVOS.movil.lufs} LUFS`.replace('-', '−'),
};
