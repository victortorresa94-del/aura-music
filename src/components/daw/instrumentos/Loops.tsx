'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Play, Plus, Stop } from '@phosphor-icons/react';
import type { Instrumentos } from '@/hooks/useInstrumentos';
import { getLoop, loopsDe, tieneNiveles, vaConElTempo, type FamiliaLoop, type Loop, type NivelLoop } from '@/lib/instrumentos/loops';
import { getInstrumento } from '@/lib/instrumentos/registro';
import { haptic, T } from '../theme';
import { Segmented, hintText } from '../ui';
import { IconoInstrumento } from './iconos';

const FAMILIAS: { value: FamiliaLoop; text: string }[] = [
  { value: 'bateria', text: 'Batería' },
  { value: 'bajo', text: 'Bajo' },
  { value: 'percusion', text: 'Percusión' },
];

/**
 * La biblioteca de loops: patrones listos que suenan a tu tempo y en tu
 * compás (son notas sobre los kits, no audio estirado). Tocar uno lo escucha;
 * «Poner» lo mete como pista de notas que se repite 2, 4 u 8 compases en el
 * compás donde esté el cursor. Lo que pone la máquina va en verde, como el
 * resto de lo generado.
 */
export function BibliotecaLoops({
  instrumentos,
  bpm,
  tonica,
  sonando,
}: {
  instrumentos: Instrumentos;
  bpm: number;
  /** Si la canción está sonando: la escucha se pega a su rejilla. */
  sonando: boolean;
  /** La tónica del proyecto, para los bajos. */
  tonica: number;
}) {
  const { escuchando, escucharLoop, pararEscucha, ponerLoop } = instrumentos;
  const [familia, setFamilia] = useState<FamiliaLoop>('bateria');
  const [nivel, setNivel] = useState<NivelLoop>('completo');
  const [veces, setVeces] = useState(4);
  const [poniendo, setPoniendo] = useState<string | null>(null);
  const loops = useMemo(() => loopsDe(familia), [familia]);

  // Lo que suena, se para al irse de aquí.
  useEffect(() => () => pararEscucha(), [pararEscucha]);

  // Si arrancas o paras la canción mientras escuchas un loop, se vuelve a
  // colocar: pegado a la rejilla de la canción, o suelto desde ya.
  const vivo = useRef({ escuchando, nivel, tonica, escucharLoop });
  vivo.current = { escuchando, nivel, tonica, escucharLoop };
  useEffect(() => {
    const { escuchando: id, nivel: n, tonica: t, escucharLoop: escuchar } = vivo.current;
    const loop = id ? getLoop(id) : undefined;
    if (loop) escuchar(loop, { nivel: tieneNiveles(loop) ? n : 'completo', tonica: t });
  }, [sonando]);

  const escuchar = (loop: Loop, nuevoNivel = nivel) => {
    haptic(8);
    if (escuchando === loop.id && nuevoNivel === nivel) {
      pararEscucha();
      return;
    }
    escucharLoop(loop, { nivel: tieneNiveles(loop) ? nuevoNivel : 'completo', tonica });
  };

  const poner = async (loop: Loop) => {
    haptic(12);
    setPoniendo(loop.id);
    await ponerLoop(loop, { nivel: tieneNiveles(loop) ? nivel : 'completo', veces, tonica });
    setPoniendo(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', height: '100%', minHeight: 0 }}>
      <Segmented<FamiliaLoop>
        ariaLabel="Qué loops"
        value={familia}
        options={FAMILIAS}
        onChange={(f) => {
          pararEscucha();
          setFamilia(f);
        }}
      />
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {familia === 'bateria' ? (
          <div style={{ flex: 3, minWidth: 0 }}>
            <Segmented<NivelLoop>
              ariaLabel="Cuánto toca"
              value={nivel}
              options={[
                { value: 'bombo', text: 'Bombo' },
                { value: 'bombo-caja', text: 'Con caja' },
                { value: 'completo', text: 'Todo' },
              ]}
              onChange={(n) => {
                setNivel(n);
                // Si hay uno sonando, se oye el cambio al momento.
                const sonando = loops.find((l) => l.id === escuchando);
                if (sonando) escucharLoop(sonando, { nivel: tieneNiveles(sonando) ? n : 'completo', tonica });
              }}
            />
          </div>
        ) : null}
        <div style={{ flex: 2, minWidth: 0 }}>
          <Segmented<number>
            ariaLabel="Cuántos compases"
            value={veces}
            options={[
              { value: 2, text: '2 c.' },
              { value: 4, text: '4 c.' },
              { value: 8, text: '8 c.' },
            ]}
            onChange={setVeces}
          />
        </div>
      </div>
      <p style={{ ...hintText, fontSize: 12, marginTop: -2 }}>
        Toca uno para oírlo a {bpm} BPM. «Poner» lo mete en el compás del cursor.
      </p>
      <div
        role="list"
        aria-label="Loops"
        style={{ flex: 1, minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain', display: 'flex', flexDirection: 'column', gap: 6, paddingBottom: 8 }}
      >
        {loops.map((loop) => {
          const sonando = escuchando === loop.id;
          const def = getInstrumento(loop.instrumento);
          const fueraDeTempo = !vaConElTempo(loop, bpm);
          return (
            <div
              key={loop.id}
              role="listitem"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                minHeight: 64,
                padding: '8px 8px 8px 8px',
                borderRadius: 14,
                background: sonando ? T.surface : T.fill,
                boxShadow: sonando ? `inset 0 0 0 1.5px ${T.text}, ${T.elev1}` : `inset 0 1px 0 ${T.rim}`,
                transition: `background-color 160ms ${T.easeOut}, box-shadow 160ms ${T.easeOut}`,
              }}
            >
              <button
                type="button"
                className="daw-press"
                aria-label={sonando ? `Parar ${loop.nombre}` : `Escuchar ${loop.nombre}`}
                aria-pressed={sonando}
                onClick={() => escuchar(loop)}
                style={{
                  width: 44,
                  height: 44,
                  flexShrink: 0,
                  display: 'grid',
                  placeItems: 'center',
                  border: 'none',
                  borderRadius: 22,
                  background: sonando ? T.text : T.surface,
                  boxShadow: sonando ? 'none' : `inset 0 0 0 1px ${T.border}`,
                  cursor: 'pointer',
                }}
              >
                {sonando ? <Stop size={18} weight="fill" color={T.inverse} /> : <Play size={18} weight="fill" color={T.text} />}
              </button>
              <button
                type="button"
                onClick={() => escuchar(loop)}
                aria-hidden
                tabIndex={-1}
                style={{
                  flex: 1,
                  minWidth: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                  padding: 0,
                  border: 'none',
                  background: 'transparent',
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                  <IconoInstrumento icono={def.icono} size={16} weight="duotone" color={T.dim} />
                  <span style={{ fontFamily: T.fontBody, fontSize: 14.5, fontWeight: 600, color: T.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {loop.nombre}
                  </span>
                </span>
                <span style={{ fontFamily: T.fontBody, fontSize: 12, color: T.dim, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical' }}>
                  {def.corto} · {loop.detalle}
                </span>
                {fueraDeTempo ? (
                  <span style={{ fontFamily: T.fontBody, fontSize: 11.5, color: T.faint }}>
                    Pensado para {loop.bpm[0]} a {loop.bpm[1]} BPM
                  </span>
                ) : null}
              </button>
              <button
                type="button"
                className="daw-press daw-sink"
                aria-label={`Poner ${loop.nombre}, ${veces} compases`}
                disabled={poniendo !== null}
                onClick={() => void poner(loop)}
                style={{
                  flexShrink: 0,
                  height: 40,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '0 12px 0 10px',
                  border: 'none',
                  borderRadius: 11,
                  // Lo pone la máquina: verde, como «Ponle algo debajo».
                  background: T.aiSoft,
                  color: T.ai,
                  fontFamily: T.fontBody,
                  fontSize: 13.5,
                  fontWeight: 650,
                  cursor: poniendo ? 'default' : 'pointer',
                  opacity: poniendo && poniendo !== loop.id ? 0.5 : 1,
                }}
              >
                <Plus size={15} weight="bold" color={T.ai} />
                {poniendo === loop.id ? 'Poniendo…' : 'Poner'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
