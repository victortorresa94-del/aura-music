'use client';

import { useLayoutEffect, useMemo, useRef } from 'react';
import type { Clip } from '@/lib/daw/types';
import type { PistaDeNotas } from '@/lib/instrumentos/tipos';
import { cssColor } from '../theme';

/** Los canvas se cortan en trozos: uno de 20 000 px revienta en Safari móvil. */
const TROZO = 1600;

/**
 * Lo que se ve de una pista de notas en la línea de tiempo: bloques en vez de
 * onda. En la batería, un carril por pad; en lo demás, la altura de cada nota.
 * La opacidad es la fuerza del golpe.
 */
export function NotasClip({
  notas,
  clip,
  pps,
  width,
  height,
  color,
  theme,
}: {
  notas: PistaDeNotas;
  clip: Clip;
  pps: number;
  width: number;
  height: number;
  color: string;
  theme: string;
}) {
  const trozos = useMemo(() => {
    const lista: { x: number; w: number }[] = [];
    for (let x = 0; x < width; x += TROZO) lista.push({ x, w: Math.min(TROZO, width - x) });
    return lista;
  }, [width]);

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', pointerEvents: 'none' }}>
      {trozos.map((trozo) => (
        <TrozoDeNotas
          key={trozo.x}
          notas={notas}
          clip={clip}
          pps={pps}
          x0={trozo.x}
          width={trozo.w}
          height={height}
          color={color}
          theme={theme}
        />
      ))}
    </div>
  );
}

function TrozoDeNotas({
  notas,
  clip,
  pps,
  x0,
  width,
  height,
  color,
  theme,
}: {
  notas: PistaDeNotas;
  clip: Clip;
  pps: number;
  x0: number;
  width: number;
  height: number;
  color: string;
  theme: string;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useLayoutEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.floor(width * dpr));
    canvas.height = Math.max(1, Math.floor(height * dpr));
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.scale(dpr, dpr);
    ctx.fillStyle = cssColor(color, '#888');

    const golpes = notas.golpes;
    if (golpes.length === 0) return;
    // El audio de la pista se hizo con este tempo: con él se pasa de pulsos a segundos.
    const pulso = 60 / notas.bpm;
    const bateria = notas.instrumento.startsWith('bateria') || notas.instrumento === 'cajon';
    const margen = 4;
    const alto = height - margen * 2;

    let carril: (nota: number) => { y: number; h: number };
    if (bateria) {
      const usados = [...new Set(golpes.map((g) => g.nota))].sort((a, b) => a - b);
      const h = alto / Math.max(1, usados.length);
      carril = (nota) => ({ y: margen + (usados.length - 1 - usados.indexOf(nota)) * h, h: Math.max(2, h - 1) });
    } else {
      const min = Math.min(...golpes.map((g) => g.nota)) - 1;
      const max = Math.max(...golpes.map((g) => g.nota)) + 1;
      const h = alto / Math.max(1, max - min + 1);
      carril = (nota) => ({ y: margen + (max - nota) * h, h: Math.max(2, Math.min(6, h)) });
    }

    const repeticiones = Math.max(1, Math.floor(clip.repeats));
    for (let r = 0; r < repeticiones; r++) {
      const base = r * clip.duration;
      for (const golpe of golpes) {
        const t = golpe.beat * pulso - clip.offset;
        if (t < 0 || t >= clip.duration) continue;
        const x = (base + t) * pps - x0;
        const w = bateria ? Math.max(2, Math.min(5, pulso * 0.12 * pps)) : Math.max(2, Math.min(golpe.dur * pulso, clip.duration - t) * pps - 1);
        if (x + w < 0 || x > width) continue;
        const { y, h } = carril(golpe.nota);
        ctx.globalAlpha = 0.4 + 0.6 * (golpe.vel / 127);
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') ctx.roundRect(x, y, w, h, Math.min(2, h / 2));
        else ctx.rect(x, y, w, h);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }, [notas, clip, pps, x0, width, height, color, theme]);

  return <canvas ref={ref} style={{ width, height, display: 'block', flexShrink: 0 }} aria-hidden />;
}
