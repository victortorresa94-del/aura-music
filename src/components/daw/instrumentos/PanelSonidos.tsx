'use client';

import { Star } from '@phosphor-icons/react';
import { IconoArcilla } from '@/components/iconos/IconoArcilla';
import { ARCILLA_DE_FAMILIA, arcillaDe } from '@/lib/iconos/arcilla';
import type { DefInstrumento } from '@/lib/instrumentos/registro';
import type { InstrumentoId } from '@/lib/instrumentos/tipos';
import { haptic, T } from '../theme';
import type { IconoFamilia } from './iconos';

/** Una línea de cómo suena cada sonido, para elegir sin tener que probarlos todos. */
const COMO_SUENA: Partial<Record<InstrumentoId, string>> = {
  'bateria-acustica': 'Natural y equilibrada, de estudio.',
  'bateria-808': 'Graves profundos y modernos.',
  'bateria-909': 'Pegada seca, de pista de baile.',
  cajon: 'Madera, cuerpo y compás.',
  'percusion-latina': 'Ritmo, color y percusión latina.',
  piano: 'De cola, para todo.',
  'piano-electrico': 'Suave y con campana, de los ochenta.',
  organo: 'De iglesia, lleno y sostenido.',
  'organo-electrico': 'De ruedas, con vibrato.',
  cuerdas: 'Sección de cuerda sostenida.',
  pizzicato: 'Cuerdas pellizcadas, cortas.',
  metales: 'Trompetas y trombones.',
  marimba: 'Láminas de madera, cálida.',
  pad: 'Un colchón que respira.',
  sinte: 'Para melodías que corten.',
  guitarra: 'Española, de nailon.',
  'guitarra-acero': 'Acústica, con brillo.',
  'bajo-dedos': 'Redondo y cálido.',
  'bajo-pua': 'Ataque y brillo.',
  contrabajo: 'De jazz, de madera.',
  'bajo-sub': 'Grave limpio, que se siente.',
  'bajo-808': 'Cae y satura, de trap.',
  'bajo-analogico': 'Sierra con filtro.',
};

/** Las cinco pestañas, con su icono de arcilla y su nombre debajo. */
export function PestanasDeFamilia<P extends IconoFamilia>({
  familias,
  elegida,
  onElegir,
}: {
  familias: { id: P; nombre: string }[];
  elegida: P;
  onElegir: (id: P) => void;
}) {
  return (
    <div role="radiogroup" aria-label="Qué tocar" style={{ display: 'grid', gridTemplateColumns: `repeat(${familias.length}, minmax(0, 1fr))`, gap: 4 }}>
      {familias.map((f) => {
        const si = f.id === elegida;
        return (
          <button
            key={f.id}
            type="button"
            role="radio"
            aria-checked={si}
            className="daw-press daw-hover"
            onClick={() => {
              haptic(8);
              onElegir(f.id);
            }}
            style={{
              minWidth: 0,
              height: 64,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
              padding: 0,
              border: 'none',
              borderRadius: 14,
              background: si ? T.surface : 'transparent',
              boxShadow: si ? T.elev1 : 'none',
              cursor: 'pointer',
              transition: `background-color 160ms ${T.easeOut}, box-shadow 160ms ${T.easeOut}`,
            }}
          >
            <IconoArcilla id={ARCILLA_DE_FAMILIA[f.id]} tamano={34} apagado={!si} />
            <span style={{ fontFamily: T.fontBody, fontSize: 11, fontWeight: si ? 650 : 550, color: si ? T.text : T.dim, lineHeight: 1 }}>
              {f.nombre}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Los sonidos de la familia, en lista: el icono, el nombre corto con su
 * apellido y una línea de cómo suena. El elegido, en blanco y con su
 * sombra (sin rayas de color al lado: el blanco ya dice cuál es).
 */
export function ListaDeSonidos({
  sonidos,
  elegido,
  onElegir,
}: {
  sonidos: DefInstrumento[];
  elegido: InstrumentoId;
  onElegir: (id: InstrumentoId) => void;
}) {
  return (
    <div role="radiogroup" aria-label="Sonido" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {sonidos.map((def) => {
        const si = def.id === elegido;
        // Las cuerdas de «Acordes» son el sonido protegido del dueño.
        const favorito = def.id === 'cuerdas';
        return (
          <button
            key={def.id}
            type="button"
            role="radio"
            aria-checked={si}
            aria-label={`${def.nombre}: ${COMO_SUENA[def.id] ?? def.detalle}`}
            className="daw-press daw-hover"
            onClick={() => {
              haptic(8);
              onElegir(def.id);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              minHeight: 68,
              padding: '8px 12px 8px 8px',
              border: 'none',
              borderRadius: 16,
              background: si ? T.surface : 'transparent',
              boxShadow: si ? T.elev1 : 'none',
              textAlign: 'left',
              cursor: 'pointer',
              transition: `background-color 160ms ${T.easeOut}, box-shadow 160ms ${T.easeOut}`,
            }}
          >
            <IconoArcilla id={arcillaDe(def.id)} tamano={48} apagado={!si} />
            <span style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
              <span style={{ fontFamily: T.fontBody, fontSize: 14, lineHeight: 1.25, color: T.text, textWrap: 'balance' } as React.CSSProperties}>
                <span style={{ fontWeight: 650 }}>{def.corto}</span>
                <span style={{ fontWeight: 450, color: T.dim }}> · {def.detalle}</span>
              </span>
              <span style={{ fontFamily: T.fontBody, fontSize: 12, lineHeight: 1.35, color: T.faint, textWrap: 'pretty' } as React.CSSProperties}>
                {COMO_SUENA[def.id] ?? def.nombre}
              </span>
              {favorito ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: T.fontBody, fontSize: 11.5, fontWeight: 600, color: T.dim }}>
                  <Star size={12} weight="fill" color={T.dim} />
                  Tu favorito
                </span>
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}
