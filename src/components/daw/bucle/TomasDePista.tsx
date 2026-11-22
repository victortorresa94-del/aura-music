'use client';

/**
 * Las tomas de una pista grabada con el ciclo. Una ficha por vuelta: tocar
 * una la pone a sonar (con la canción en marcha cambia sin parar, por el
 * `resync` de siempre). Y la salida para superponerlas en vez de elegir.
 */

import type { Studio } from '@/hooks/useStudio';
import { elegirToma, separarTomas } from '@/lib/daw/bucle/bucle';
import { newId, type Track } from '@/lib/daw/types';
import { haptic, T } from '../theme';
import { Field, TextButton } from '../ui';

export function TomasDePista({ studio, track }: { studio: Studio; track: Track }) {
  const tomas = track.tomas;
  if (!tomas || tomas.offsets.length < 2) return null;
  return (
    <Field
      title="Tomas"
      hint="Grabadas con el ciclo: cada vuelta es una toma y suena la que elijas. «Una pista por toma» las pone todas a sonar a la vez, para superponerlas."
    >
      <div role="radiogroup" aria-label="Qué toma suena" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {tomas.offsets.map((_, i) => {
          const elegida = i === tomas.elegida;
          return (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={elegida}
              className="daw-press daw-hover"
              onClick={() => {
                haptic(8);
                studio.commit((p) => elegirToma(p, track.id, i));
              }}
              style={{
                minHeight: 40,
                padding: '0 14px',
                border: 'none',
                borderRadius: 20,
                background: elegida ? T.text : T.fill,
                boxShadow: elegida ? T.elev1 : `inset 0 1px 0 ${T.rim}`,
                color: elegida ? T.inverse : T.text,
                fontFamily: T.fontBody,
                fontSize: 14,
                fontWeight: 500,
                fontVariantNumeric: 'tabular-nums',
                cursor: 'pointer',
                touchAction: 'manipulation',
              }}
            >
              Toma {i + 1}
            </button>
          );
        })}
      </div>
      <div style={{ marginTop: 10 }}>
        <TextButton
          full
          onClick={() => {
            studio.commit((p) => separarTomas(p, track.id, () => newId('trk')));
            studio.setStatus(`${tomas.offsets.length} tomas, cada una en su pista. Puedes deshacer.`);
          }}
        >
          Una pista por toma
        </TextButton>
      </div>
    </Field>
  );
}
