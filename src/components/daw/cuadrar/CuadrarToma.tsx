'use client';

/**
 * «Cuadrar al tempo» en el panel de una toma de audio.
 *
 * Tres decisiones, con valores por defecto que ya suenan bien (corcheas, 70 %,
 * estirando): la rejilla, la fuerza y si se estira para no dejar huecos. Una
 * vez cuadrada, lo importante pasa a ser comparar: «Como la toqué» y
 * «Cuadrada» a un toque, oír desde el principio de la toma, y la salida
 * para volver atrás del todo.
 */

import { useEffect, useState } from 'react';
import type { Studio } from '@/hooks/useStudio';
import { cuadrarToma, dejarComoLoToque, escucharCuadre } from '@/hooks/useCuadrar';
import { CUADRE_POR_DEFECTO, REJILLAS, type AjustesCuadreToma } from '@/lib/daw/cuadrar/cuadrar';
import type { Track } from '@/lib/daw/types';
import { haptic, T } from '../theme';
import { Field, IconButton, IconPlay, IconStop, Segmented, Slider, TextButton, Toggle, hintText, label } from '../ui';

export function CuadrarToma({ studio, track }: { studio: Studio; track: Track }) {
  const cuadre = track.cuadre ?? null;
  const [ajustes, setAjustes] = useState<AjustesCuadreToma>(cuadre?.ajustes ?? CUADRE_POR_DEFECTO);
  const [ocupado, setOcupado] = useState(false);
  // Al cambiar de pista, los ajustes son los de la pista nueva.
  useEffect(() => {
    setAjustes(track.cuadre?.ajustes ?? CUADRE_POR_DEFECTO);
  }, [track.id, track.cuadre?.ajustes]);

  const cuadrar = async () => {
    if (ocupado) return;
    setOcupado(true);
    try {
      await cuadrarToma(studio, track.id, ajustes);
    } finally {
      setOcupado(false);
    }
  };

  const sonando = studio.transport !== 'stopped';
  const oir = () => {
    studio.engine?.unlockSync();
    if (sonando) {
      void studio.stop();
      return;
    }
    studio.seek(track.clip.start);
    void studio.play();
  };

  const mismosAjustes =
    !!cuadre &&
    cuadre.ajustes.fuerza === ajustes.fuerza &&
    cuadre.ajustes.rejilla === ajustes.rejilla &&
    cuadre.ajustes.estirar === ajustes.estirar;

  const controles = (
    <>
      <span style={{ ...label, display: 'block', margin: '14px 0 8px' }}>Rejilla</span>
      <Segmented
        ariaLabel="Rejilla"
        value={ajustes.rejilla}
        options={REJILLAS.map((r) => ({ value: r.pulsos, text: r.nombre }))}
        onChange={(rejilla) => setAjustes({ ...ajustes, rejilla })}
      />
      <span style={{ ...label, display: 'flex', justifyContent: 'space-between', margin: '14px 0 2px' }}>
        <span>Fuerza</span>
        <span style={{ color: T.text, fontVariantNumeric: 'tabular-nums' }}>{Math.round(ajustes.fuerza * 100)} %</span>
      </span>
      <Slider
        ariaLabel="Fuerza del cuadre"
        value={Math.round(ajustes.fuerza * 100)}
        min={50}
        max={100}
        onChange={(valor) => setAjustes({ ...ajustes, fuerza: valor / 100 })}
      />
      <div style={{ marginTop: 8 }}>
        <Toggle
          checked={ajustes.estirar}
          onChange={(estirar) => setAjustes({ ...ajustes, estirar })}
          title="Estirar para no dejar huecos"
          detail="Cada trozo se alarga o se acorta un poco, sin cambiar el tono."
        />
      </div>
    </>
  );

  if (!cuadre) {
    return (
      <Field
        title="Cuadrar al tempo"
        intro={`Lleva cada golpe de la toma hacia la rejilla del proyecto, a ${studio.project.bpm} BPM. La toma como la tocaste no se pierde.`}
        hint="Al 70 % corrige sin que suene a máquina; al 100 % cada golpe cae justo en su sitio."
      >
        {controles}
        <div style={{ marginTop: 12 }}>
          <TextButton full tone="solid" disabled={ocupado} onClick={() => void cuadrar()}>
            {ocupado ? 'Cuadrando…' : 'Cuadrar al tempo'}
          </TextButton>
        </div>
      </Field>
    );
  }

  return (
    <Field title="Cuadrar al tempo">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Segmented
            ariaLabel="Qué versión suena"
            value={cuadre.escuchando}
            options={[
              { value: 'original', text: 'Como la toqué' },
              { value: 'cuadrado', text: 'Cuadrada' },
            ]}
            onChange={(cual) => {
              haptic(8);
              void escucharCuadre(studio, track.id, cual);
            }}
          />
        </div>
        <IconButton size={46} variant="filled" title={sonando ? 'Parar' : 'Oír desde el principio de la toma'} onClick={oir}>
          {sonando ? <IconStop size={18} /> : <IconPlay size={18} />}
        </IconButton>
      </div>
      <p style={{ ...hintText, marginTop: 10 }}>
        {cuadre.movidos} de {cuadre.golpes} golpes movidos: de {cuadre.antesMs} a {cuadre.despuesMs} ms de la rejilla, de media.
      </p>

      {controles}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
        <TextButton full disabled={ocupado || mismosAjustes} onClick={() => void cuadrar()}>
          {ocupado ? 'Cuadrando…' : 'Volver a cuadrar'}
        </TextButton>
        <TextButton full disabled={ocupado} onClick={() => void dejarComoLoToque(studio, track.id)}>
          Dejar como la toqué
        </TextButton>
      </div>
    </Field>
  );
}
