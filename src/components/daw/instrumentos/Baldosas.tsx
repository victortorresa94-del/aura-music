'use client';

/**
 * Las baldosas para elegir qué tocar en el móvil: el icono de arcilla y el
 * nombre, fáciles de dar con el pulgar. Elegida, en blanco con su sombra y
 * un filo de tinta; apagada, sobre el suelo y el icono un punto más tenue.
 * Nunca en verde: el verde es de lo que hace la máquina, y esto lo eliges tú.
 */

import { IconoArcilla } from '@/components/iconos/IconoArcilla';
import { ARCILLA_DE_FAMILIA, arcillaDe } from '@/lib/iconos/arcilla';
import type { DefInstrumento } from '@/lib/instrumentos/registro';
import { haptic, T } from '../theme';
import type { IconoFamilia } from './iconos';

/** Una familia (batería, teclado, acordes, bajo): icono grande y nombre. */
export function BaldosaFamilia({
  familia,
  nombre,
  elegida,
  onElegir,
}: {
  familia: IconoFamilia;
  nombre: string;
  elegida: boolean;
  onElegir: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={elegida}
      className="daw-press"
      onClick={() => {
        haptic(8);
        onElegir();
      }}
      style={{
        minWidth: 0,
        height: 62,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
        padding: 0,
        border: 'none',
        borderRadius: 14,
        background: elegida ? T.surface : T.fill,
        boxShadow: elegida ? `inset 0 0 0 1.5px ${T.text}, ${T.elev1}` : `inset 0 1px 0 ${T.rim}`,
        color: elegida ? T.text : T.dim,
        cursor: 'pointer',
        transition: `background-color 160ms ${T.easeOut}, box-shadow 160ms ${T.easeOut}, color 160ms ${T.easeOut}`,
      }}
    >
      <IconoArcilla id={ARCILLA_DE_FAMILIA[familia]} tamano={30} apagado={!elegida} />
      <span style={{ fontFamily: T.fontBody, fontSize: 12.5, fontWeight: 600, lineHeight: 1, color: elegida ? T.text : T.dim }}>{nombre}</span>
    </button>
  );
}

/** Un sonido de la familia: icono, nombre y una línea de cómo suena. */
export function BaldosaInstrumento({ def, elegido, onElegir }: { def: DefInstrumento; elegido: boolean; onElegir: () => void }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={elegido}
      aria-label={`${def.nombre}: ${def.detalle}`}
      className="daw-press"
      onClick={() => {
        haptic(8);
        onElegir();
      }}
      style={{
        flexShrink: 0,
        scrollSnapAlign: 'start',
        height: 52,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '0 12px 0 10px',
        border: 'none',
        borderRadius: 13,
        background: elegido ? T.surface : T.fill,
        boxShadow: elegido ? `inset 0 0 0 1.5px ${T.text}, ${T.elev1}` : `inset 0 1px 0 ${T.rim}`,
        color: elegido ? T.text : T.dim,
        textAlign: 'left',
        cursor: 'pointer',
        transition: `background-color 160ms ${T.easeOut}, box-shadow 160ms ${T.easeOut}`,
      }}
    >
      <IconoArcilla id={arcillaDe(def.id)} tamano={34} apagado={!elegido} style={{ marginLeft: -2 }} />
      <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontFamily: T.fontBody, fontSize: 13.5, fontWeight: 600, lineHeight: 1.1, color: T.text, whiteSpace: 'nowrap' }}>{def.corto}</span>
        <span style={{ fontFamily: T.fontBody, fontSize: 11, fontWeight: 500, lineHeight: 1.1, color: T.faint, whiteSpace: 'nowrap' }}>{def.detalle}</span>
      </span>
    </button>
  );
}
