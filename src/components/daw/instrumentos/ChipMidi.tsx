'use client';

/**
 * El estado del teclado MIDI en «Tocar», en una línea: si lo hay, cómo se
 * llama y si está llegando algo. Si el navegador no tiene MIDI (Safari en
 * iPhone), no ocupa sitio.
 */

import type { EstadoMidi } from '@/hooks/useTecladoMidi';
import { haptic } from '../theme';
import { T, hintText } from '../ui';

const NOMBRES = ['Do', 'Do#', 'Re', 'Re#', 'Mi', 'Fa', 'Fa#', 'Sol', 'Sol#', 'La', 'La#', 'Si'];
const nombreNota = (n: number) => `${NOMBRES[n % 12]}${Math.floor(n / 12) - 1}`;

export function ChipMidi({ midi, onConectar }: { midi: EstadoMidi; onConectar: () => void }) {
  if (midi.estado === 'sin-soporte') return null;

  const hayTeclado = midi.estado === 'listo' && midi.dispositivos.length > 0;
  const texto =
    midi.estado === 'pidiendo'
      ? 'Pidiendo permiso al navegador…'
      : midi.estado === 'denegado'
        ? 'El navegador no deja usar MIDI. Permítelo en el candado de la barra de direcciones.'
        : midi.estado === 'listo' && !hayTeclado
          ? 'Ningún teclado MIDI conectado. Enchúfalo por USB y enciéndelo.'
          : hayTeclado
            ? `${midi.dispositivos.join(' · ')}${midi.ultima !== null ? ` · ${nombreNota(midi.ultima)}` : ' · toca una tecla'}`
            : '';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 32 }}>
      <span
        aria-hidden
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          flexShrink: 0,
          background: hayTeclado ? T.text : 'transparent',
          boxShadow: hayTeclado ? 'none' : `inset 0 0 0 1.5px ${T.borderStrong}`,
        }}
      />
      {midi.estado === 'apagado' ? (
        <button
          type="button"
          className="daw-press daw-hover"
          onClick={() => {
            haptic(8);
            onConectar();
          }}
          style={{
            minHeight: 32,
            padding: '0 12px',
            border: 'none',
            borderRadius: 999,
            background: T.fill,
            boxShadow: `inset 0 0 0 1px ${T.border}`,
            color: T.text,
            fontFamily: T.fontBody,
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Conectar teclado MIDI
        </button>
      ) : (
        <span role="status" style={{ ...hintText, margin: 0, fontSize: 13, color: hayTeclado ? T.text : T.dim }}>
          {texto}
        </span>
      )}
    </div>
  );
}
