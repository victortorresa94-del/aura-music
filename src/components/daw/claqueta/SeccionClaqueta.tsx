'use client';

/**
 * La claqueta en la hoja de tempo: qué suena, cada cuánto y con qué ritmo
 * debajo. Todo a dos toques (abrir la hoja, tocar la opción), cada opción
 * suena al tocarla y se recuerda para la próxima vez.
 *
 * Elegir un sonido o un ritmo enciende la claqueta si estaba apagada:
 * quien abre la hoja y toca «Bombo» quiere oír un bombo, no buscar después
 * dónde se enciende.
 */

import type { Studio } from '@/hooks/useStudio';
import { useElegirClaqueta } from '@/hooks/useClaqueta';
import {
  FONDOS,
  SONIDOS,
  SUBDIVISIONES,
  type AjustesClaqueta,
  type FondoId,
} from '@/lib/daw/claqueta/claqueta';
import { haptic, T } from '../theme';
import { Field, Segmented, Slider, TextButton, Toggle, hintText, label } from '../ui';

/** Fichas de opción única: se lee la elegida desde un metro, sin colores. */
function Fichas<V extends string>({
  opciones,
  valor,
  onElegir,
  etiqueta,
}: {
  opciones: { id: V; nombre: string }[];
  valor: V;
  onElegir: (id: V) => void;
  etiqueta: string;
}) {
  return (
    <div role="radiogroup" aria-label={etiqueta} style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {opciones.map((o) => {
        const elegida = o.id === valor;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={elegida}
            className="daw-press daw-hover"
            onClick={() => {
              haptic(8);
              onElegir(o.id);
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
              letterSpacing: '-0.01em',
              whiteSpace: 'nowrap',
              cursor: 'pointer',
              touchAction: 'manipulation',
              transition: `background-color 160ms ${T.easeOut}, color 160ms ${T.easeOut}`,
            }}
          >
            {o.nombre}
          </button>
        );
      })}
    </div>
  );
}

const subtitulo: React.CSSProperties = { ...label, display: 'block', margin: '18px 0 8px' };

const SIN_RITMO = 'ninguno' as const;
type OpcionFondo = FondoId | typeof SIN_RITMO;

export function SeccionClaqueta({ studio }: { studio: Studio }) {
  const { settings, toggleMetronome } = studio;
  const { ajustes, elegir } = useElegirClaqueta(studio);

  /** Elegir algo y, si estaba apagada, encenderla. */
  const elegirYEncender = (cambio: Partial<AjustesClaqueta>, ejemplo: 'clic' | 'fondo') => {
    elegir(cambio, ejemplo);
    if (!settings.metronome) toggleMetronome();
  };

  const fondos: { id: OpcionFondo; nombre: string }[] = [
    { id: SIN_RITMO, nombre: 'Sin ritmo' },
    ...FONDOS.map((f) => ({ id: f.id, nombre: f.nombre })),
  ];

  return (
    <>
      <Field title="Claqueta">
        <Toggle
          checked={settings.metronome}
          onChange={() => toggleMetronome()}
          title="Claqueta"
          detail="Suena mientras reproduces y grabas. No se graba ni se exporta."
        />

        <span style={subtitulo}>Sonido</span>
        <Fichas
          etiqueta="Sonido de la claqueta"
          opciones={SONIDOS}
          valor={ajustes.sonido}
          onElegir={(sonido) => elegirYEncender({ sonido }, 'clic')}
        />

        <span style={subtitulo}>Cada cuánto</span>
        <Segmented
          ariaLabel="Cada cuánto suena"
          value={ajustes.subdivision}
          options={SUBDIVISIONES.map((s) => ({ value: s.id, text: s.nombre }))}
          onChange={(subdivision) => elegirYEncender({ subdivision }, 'clic')}
        />

        <div style={{ marginTop: 10 }}>
          <Toggle
            checked={ajustes.acento}
            onChange={(acento) => elegir({ acento }, 'clic')}
            title="Acento en el 1"
            detail="El primer pulso de cada compás suena más fuerte."
          />
        </div>

        <span style={subtitulo}>Volumen</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Slider
              ariaLabel="Volumen de la claqueta"
              value={Math.round(ajustes.volumen * 100)}
              min={0}
              max={150}
              onChange={(valor) => elegir({ volumen: valor / 100 })}
              onCommit={() => elegir({}, ajustes.fondo && !ajustes.clicConFondo ? 'fondo' : 'clic')}
            />
          </div>
          <span style={{ ...label, fontVariantNumeric: 'tabular-nums', width: 44, textAlign: 'right', color: T.text }}>
            {Math.round(ajustes.volumen * 100)} %
          </span>
        </div>
      </Field>

      <Field
        title="Ritmo de fondo"
        hint="Un ritmo suave para grabar encima. Suena solo mientras grabas o reproduces y nunca pasa a pista: para eso está la hoja de Ritmos."
      >
        <Fichas
          etiqueta="Ritmo de fondo"
          opciones={fondos}
          valor={ajustes.fondo ?? SIN_RITMO}
          onElegir={(id) => {
            if (id === SIN_RITMO) elegir({ fondo: null }, 'clic');
            else elegirYEncender({ fondo: id }, 'fondo');
          }}
        />
        {ajustes.fondo ? (
          <div style={{ marginTop: 10 }}>
            <Toggle
              checked={ajustes.clicConFondo}
              onChange={(clicConFondo) => elegir({ clicConFondo }, 'clic')}
              title="Clic encima del ritmo"
              detail="Además del ritmo, el sonido de la claqueta."
            />
          </div>
        ) : null}
        <div style={{ marginTop: 10 }}>
          <TextButton full onClick={() => elegir({}, ajustes.fondo ? 'fondo' : 'clic')}>
            Escuchar un compás
          </TextButton>
        </div>
        {studio.transport !== 'stopped' ? (
          <p style={{ ...hintText, marginTop: 8 }}>Con la canción en marcha, los cambios se oyen directamente.</p>
        ) : null}
      </Field>
    </>
  );
}
