'use client';

import { bytesDelPaquete, NOMBRE_LICENCIA, PAQUETES } from '@/lib/instrumentos/packs';
import { formatBytes } from '@/lib/daw/storage';
import { T } from '../theme';
import { Field, hintText } from '../ui';

/**
 * Los sonidos y de quién son. Las licencias CC-BY exigen el crédito a la
 * vista; las CC0 y de dominio público no, pero se nombran igual: es de buena
 * educación y deja claro de dónde sale cada cosa.
 */
export function CreditosDeSonidos() {
  return (
    <Field
      title="Sonidos de los instrumentos"
      intro="La batería, la guitarra y el sintetizador se generan en el propio móvil. Los instrumentos con muestras se bajan la primera vez que los abres y se quedan guardados para tocar sin red."
    >
      {PAQUETES.length === 0 ? (
        <p style={hintText}>Ahora mismo todos los instrumentos suenan sintetizados.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {PAQUETES.map((paquete) => (
            <li key={paquete.id} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontFamily: T.fontBody, fontSize: 14, fontWeight: 600, color: T.text }}>
                {paquete.nombre}
                <span style={{ fontWeight: 500, color: T.dim }}> · {formatBytes(bytesDelPaquete(paquete))}</span>
              </span>
              <span style={{ ...hintText, fontSize: 13 }}>
                {paquete.creditos || paquete.autor} ·{' '}
                <a href={paquete.urlLicencia} target="_blank" rel="noreferrer" style={{ color: T.text }}>
                  {NOMBRE_LICENCIA[paquete.licencia]}
                </a>{' '}
                ·{' '}
                <a href={paquete.origen} target="_blank" rel="noreferrer" style={{ color: T.dim }}>
                  origen
                </a>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Field>
  );
}
