'use client';

import { useEffect, useRef, useState } from 'react';
import { createClickBuffer } from '@/lib/daw/audio';
import type { StudioEngine } from '@/lib/daw/engine';
import type { Atril } from '@/lib/instrumentos/directo';
import { dispersionToque, guardarToqueMs, instanteDelToque, medirToque } from '@/lib/instrumentos/toque';
import { haptic, T } from '../theme';
import { hintText } from '../ui';

const BPM = 90;
const ENTRADA = 2;
const TOQUES = 8;

type Fase = 'listo' | 'midiendo' | 'hecho' | 'fallo';

/**
 * «Toca 8 veces con la claqueta». Suenan dos clicks de entrada y ocho más;
 * tocas el círculo con cada uno. La mediana de lo que llegas tarde (o pronto)
 * es tu latencia del toque en este móvil: se guarda aquí y se resta al grabar.
 */
export function CalibrarToque({ engine, atril, onHecho }: { engine: StudioEngine | null; atril: Atril | null; onHecho: () => void }) {
  const [fase, setFase] = useState<Fase>('listo');
  const [tocados, setTocados] = useState(0);
  const [resultado, setResultado] = useState<{ ms: number; baile: number } | null>(null);
  const padRef = useRef<HTMLButtonElement | null>(null);
  const sesion = useRef<{ ctx: AudioContext; clicks: number[]; toques: number[]; fin: number } | null>(null);
  const temporizador = useRef<number | null>(null);

  useEffect(() => {
    const pad = padRef.current;
    if (!pad) return;
    const alTocar = (evento: PointerEvent) => {
      evento.preventDefault();
      const s = sesion.current;
      if (!s) return;
      s.toques.push(instanteDelToque(s.ctx, evento.timeStamp));
      pad.dataset.on = '1';
      window.setTimeout(() => delete pad.dataset.on, 90);
      setTocados((n) => n + 1);
    };
    pad.addEventListener('pointerdown', alTocar);
    return () => pad.removeEventListener('pointerdown', alTocar);
  }, []);

  useEffect(() => () => {
    if (temporizador.current) window.clearTimeout(temporizador.current);
  }, []);

  const empezar = () => {
    if (!engine) return;
    const ctx = engine.unlockSync();
    const alto = createClickBuffer(ctx, 1800, 0.03, 0.5);
    const bajo = createClickBuffer(ctx, 1200, 0.03, 0.35);
    const pulso = 60 / BPM;
    const inicio = ctx.currentTime + 0.4;
    const clicks: number[] = [];
    for (let i = 0; i < ENTRADA + TOQUES; i++) {
      const cuando = inicio + i * pulso;
      const fuente = ctx.createBufferSource();
      fuente.buffer = i < ENTRADA ? alto : bajo;
      fuente.connect(ctx.destination);
      fuente.start(cuando);
      if (i >= ENTRADA) clicks.push(cuando);
    }
    const fin = inicio + (ENTRADA + TOQUES) * pulso;
    sesion.current = { ctx, clicks, toques: [], fin };
    setTocados(0);
    setResultado(null);
    setFase('midiendo');
    haptic(10);
    temporizador.current = window.setTimeout(terminar, (fin - ctx.currentTime + 0.5) * 1000);
  };

  const terminar = () => {
    const s = sesion.current;
    sesion.current = null;
    if (!s) return;
    const ms = medirToque(s.toques, s.clicks);
    // Un dedo humano con la claqueta cae entre unos −50 y +120 ms. Más allá
    // es que algo ha ido mal (el audio arrancó tarde, un toque fuera de
    // sitio): mejor repetir que guardar una cifra que descoloca cada toma.
    if (ms === null || Math.abs(ms) > 180) {
      setFase('fallo');
      return;
    }
    setResultado({ ms, baile: Math.round(dispersionToque(s.toques, s.clicks)) });
    setFase('hecho');
  };

  const guardar = () => {
    if (!resultado) return;
    guardarToqueMs(resultado.ms);
    if (atril) atril.toqueMs = resultado.ms;
    haptic(12);
    onHecho();
  };

  const texto: Record<Fase, string> = {
    listo: 'Con cascos o con el altavoz, como vayas a tocar. Suenan dos clicks de entrada y luego ocho: toca el círculo con cada uno.',
    midiendo: tocados === 0 ? 'Escucha los dos primeros y entra con el tercero.' : `${Math.min(tocados, TOQUES + ENTRADA)} toques`,
    hecho: resultado
      ? `Tu toque llega ${Math.abs(resultado.ms)} ms ${resultado.ms >= 0 ? 'tarde' : 'pronto'}. ${resultado.baile > 35 ? 'Has bailado bastante: si puedes, repítelo.' : 'Medida limpia.'}`
      : '',
    fallo: 'No me ha salido una medida fiable: pocos toques cerca de los clicks, o el audio arrancó tarde. Prueba otra vez, sin prisa.',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, paddingBottom: 8 }}>
      <p style={{ ...hintText, fontSize: 14, textAlign: 'center', minHeight: 42, maxWidth: 360 }}>{texto[fase]}</p>
      <button
        ref={padRef}
        type="button"
        aria-label="Toca aquí con cada click"
        className="tocar-pad tocar-superficie"
        disabled={fase !== 'midiendo'}
        style={{
          width: 168,
          height: 168,
          borderRadius: '50%',
          border: 'none',
          background: fase === 'midiendo' ? T.fillStrong : T.fill,
          boxShadow: `inset 0 1px 0 ${T.rim}, inset 0 0 0 1px ${T.border}`,
          color: T.text,
          fontFamily: T.fontBody,
          fontSize: 15,
          fontWeight: 600,
          cursor: fase === 'midiendo' ? 'pointer' : 'default',
        }}
      >
        {fase === 'midiendo' ? 'Toca aquí' : ''}
      </button>
      <div style={{ display: 'flex', gap: 10, width: '100%', maxWidth: 360 }}>
        {fase === 'hecho' ? (
          <button type="button" className="daw-press daw-sink" onClick={guardar} style={botonPrincipal}>
            Guardar en este móvil
          </button>
        ) : null}
        <button
          type="button"
          className="daw-press daw-hover"
          disabled={fase === 'midiendo'}
          onClick={empezar}
          style={fase === 'hecho' ? botonSecundario : botonPrincipal}
        >
          {fase === 'listo' ? 'Empezar' : fase === 'midiendo' ? 'Escuchando…' : 'Otra vez'}
        </button>
      </div>
    </div>
  );
}

const botonPrincipal: React.CSSProperties = {
  flex: 1,
  minHeight: 48,
  borderRadius: 12,
  border: 'none',
  background: T.text,
  color: T.inverse,
  fontFamily: T.fontBody,
  fontSize: 15,
  fontWeight: 600,
  cursor: 'pointer',
};

const botonSecundario: React.CSSProperties = {
  ...botonPrincipal,
  background: T.fill,
  color: T.text,
  boxShadow: `inset 0 1px 0 ${T.rim}`,
};
