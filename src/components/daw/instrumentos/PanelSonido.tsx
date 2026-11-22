'use client';

import { useEffect, useState } from 'react';
import { Keyboard, SlidersHorizontal } from '@phosphor-icons/react';
import type { EstadoMidi } from '@/hooks/useTecladoMidi';
import { posicionDeVolumen, textoDb, textoVolumen, volumenDePosicion } from '@/lib/daw/mezcla/escala';
import { LIMITES } from '@/lib/daw/mezcla/tipos';
import type { Atril } from '@/lib/instrumentos/directo';
import { guardarSonido, leerSonido, VOLUMEN_MAXIMO, type AjustesSonido } from '@/lib/instrumentos/sonido';
import type { InstrumentoId } from '@/lib/instrumentos/tipos';
import { CSS_CONTROLES, Deslizador } from '../mezclador/controles';
import { haptic, T } from '../theme';
import { ChipMidi } from './ChipMidi';

/**
 * «Sonido»: lo que se ajusta del instrumento abierto. Volumen, reverb y
 * brillo son el volumen, el envío a la reverb y los agudos de la pista que
 * saldrá al grabar (`instrumentos/sonido.ts`), y en directo suenan igual.
 * Debajo, asignar las teclas del ordenador, el teclado MIDI y los ajustes del
 * toque (claqueta, cuenta atrás, calibrar).
 *
 * En el PC es la columna de la derecha; en el móvil, lo primero de la hoja
 * de ajustes.
 */
export function PanelSonido({
  instrumento,
  atril,
  asignando,
  conTeclasPropias,
  onAsignar,
  onRestablecerTeclas,
  midi,
  onConectarMidi,
  onAjustesDelToque,
}: {
  instrumento: InstrumentoId;
  atril: Atril | null;
  asignando: boolean;
  /** Si este grupo tiene teclas propias (para ofrecer volver a las de siempre). */
  conTeclasPropias: boolean;
  onAsignar: () => void;
  onRestablecerTeclas: () => void;
  midi?: EstadoMidi;
  onConectarMidi?: () => void;
  /** Sin él (en el móvil, que ya está en la hoja de ajustes), no sale el enlace. */
  onAjustesDelToque?: () => void;
}) {
  const [sonido, setSonido] = useState<AjustesSonido>(() => leerSonido(instrumento));
  useEffect(() => setSonido(leerSonido(instrumento)), [instrumento]);

  const vivo = (patch: Partial<AjustesSonido>) => atril?.ajustarSonido(instrumento, { ...sonido, ...patch });
  const soltar = (patch: Partial<AjustesSonido>) => {
    const nuevo = { ...sonido, ...patch };
    setSonido(nuevo);
    guardarSonido(instrumento, nuevo);
    atril?.ajustarSonido(instrumento, nuevo);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Deslizador
          etiqueta="Volumen"
          valor={posicionDeVolumen(sonido.volumen)}
          min={0}
          max={posicionDeVolumen(VOLUMEN_MAXIMO)}
          formato={(p) => textoVolumen(volumenDePosicion(p))}
          onVivo={(p) => vivo({ volumen: volumenDePosicion(p) })}
          onSoltar={(p) => soltar({ volumen: volumenDePosicion(p) })}
        />
        <Deslizador
          etiqueta="Reverb"
          valor={sonido.reverb}
          min={0}
          max={1}
          formato={(v) => `${Math.round(v * 100)} %`}
          onVivo={(reverb) => vivo({ reverb })}
          onSoltar={(reverb) => soltar({ reverb })}
        />
        <Deslizador
          etiqueta="Brillo"
          valor={sonido.brillo}
          min={-LIMITES.ecualizador}
          max={LIMITES.ecualizador}
          paso={0.5}
          bipolar
          formato={(db) => `${textoDb(db)} dB`}
          onVivo={(brillo) => vivo({ brillo })}
          onSoltar={(brillo) => soltar({ brillo })}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button
          type="button"
          className="daw-press daw-hover"
          aria-pressed={asignando}
          onClick={() => {
            haptic(8);
            onAsignar();
          }}
          style={{
            height: 48,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            border: 'none',
            borderRadius: 14,
            background: asignando ? T.text : T.surface,
            color: asignando ? T.inverse : T.text,
            boxShadow: asignando ? 'none' : `${T.elev1}`,
            fontFamily: T.fontBody,
            fontSize: 14.5,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          <Keyboard size={20} weight={asignando ? 'fill' : 'duotone'} color={asignando ? T.inverse : T.text} />
          {asignando ? 'Hecho' : 'Asignar teclas'}
        </button>
        {asignando ? (
          <p style={{ margin: 0, fontFamily: T.fontBody, fontSize: 12.5, lineHeight: 1.45, color: T.dim }}>
            Toca un pad o una nota y pulsa la tecla del ordenador que quieras. Se guarda al momento.
          </p>
        ) : null}
        {conTeclasPropias ? (
          <button
            type="button"
            className="daw-press daw-hover"
            onClick={() => {
              haptic(8);
              onRestablecerTeclas();
            }}
            style={{
              alignSelf: 'flex-start',
              height: 36,
              padding: '0 10px',
              marginLeft: -10,
              border: 'none',
              borderRadius: 10,
              background: 'transparent',
              color: T.dim,
              fontFamily: T.fontBody,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Volver a las de siempre
          </button>
        ) : null}
      </div>

      {midi && onConectarMidi ? <ChipMidi midi={midi} onConectar={onConectarMidi} /> : null}

      {onAjustesDelToque ? (
        <button
          type="button"
          className="daw-press daw-hover"
          onClick={onAjustesDelToque}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            height: 40,
            padding: '0 10px',
            marginLeft: -10,
            border: 'none',
            borderRadius: 10,
            background: 'transparent',
            color: T.dim,
            fontFamily: T.fontBody,
            fontSize: 13,
            fontWeight: 600,
            textAlign: 'left',
            cursor: 'pointer',
          }}
        >
          <SlidersHorizontal size={16} weight="bold" color={T.dim} />
          Claqueta, cuenta atrás y calibrar
        </button>
      ) : null}
      <style>{CSS_CONTROLES}</style>
    </div>
  );
}
