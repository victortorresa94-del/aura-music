'use client';

/**
 * Encender y apagar la GPU desde la app.
 *
 * La GPU de RunPod cobra cada segundo que está encendida, la uses o no.
 * Por eso vive apagada: este botón la enciende cuando vas a pedir algo con
 * IA, y el pod se apaga solo tras 15 minutos sin pedidos. Mientras arranca
 * se ve qué está haciendo y cuánto lleva, porque son uno o dos minutos y una
 * espera sin explicación parece un fallo.
 */

import { useEffect, useState } from 'react';
import type { Musico } from '@/hooks/useMusico';
import { haptic } from './theme';
import { T, TextButton, hintText, label } from './ui';

function minutosYSegundos(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function GpuControl({ musico, compacto = false }: { musico: Musico; compacto?: boolean }) {
  const { ia, gpu, encenderGpu, apagarGpu } = musico;
  const [ahora, setAhora] = useState(() => Date.now());
  const encendiendo = gpu?.estado === 'encendiendo';

  useEffect(() => {
    if (!encendiendo) return;
    const t = window.setInterval(() => setAhora(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [encendiendo]);

  // Sin clave de RunPod en el servidor, la GPU se maneja desde RunPod: aquí no hay nada que enseñar.
  if (!ia?.gpu) return null;

  const caja: React.CSSProperties = {
    marginTop: compacto ? 0 : 12,
    marginBottom: compacto ? 16 : 0,
    padding: '14px 16px',
    borderRadius: 14,
    background: T.fill,
    boxShadow: `inset 0 0 0 1px ${T.border}`,
  };

  if (encendiendo) {
    return (
      <div role="status" style={caja}>
        <p style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8, fontFamily: T.fontBody, fontSize: 15, fontWeight: 600, color: T.text }}>
          <span aria-hidden style={{ width: 8, height: 8, borderRadius: 4, background: T.ai, animation: 'daw-blink 1.2s ease-in-out infinite' }} />
          Encendiendo la GPU
          <span style={{ ...label, marginLeft: 'auto', fontVariantNumeric: 'tabular-nums' }}>
            {gpu?.desde ? minutosYSegundos(ahora - gpu.desde) : ''}
          </span>
        </p>
        <p style={{ ...hintText, margin: '6px 0 0' }}>
          {gpu?.detalle ?? 'Arrancando'}. Suele tardar de 1 a 3 minutos. Puedes seguir grabando mientras.
        </p>
      </div>
    );
  }

  if (ia.disponible && !ia.prueba) {
    return (
      <div style={{ ...caja, display: 'flex', alignItems: 'center', gap: 12 }}>
        <p style={{ ...hintText, margin: 0, flex: 1 }}>
          GPU encendida. Se apaga sola tras 15 minutos sin pedidos.
        </p>
        <TextButton
          onClick={() => {
            haptic(10);
            void apagarGpu();
          }}
        >
          Apagar ya
        </TextButton>
      </div>
    );
  }

  return (
    <div style={caja}>
      {gpu?.estado === 'error' && gpu.detalle ? (
        <p role="alert" style={{ margin: '0 0 10px', fontFamily: T.fontBody, fontSize: 14, color: T.text }}>
          {gpu.detalle}
        </p>
      ) : null}
      <TextButton
        full
        tone="ai"
        onClick={() => {
          haptic(12);
          void encenderGpu();
        }}
      >
        {gpu?.estado === 'error' ? 'Volver a intentarlo' : 'Encender la GPU'}
      </TextButton>
      <p style={{ ...hintText, margin: '8px 0 0' }}>
        Cobra mientras está encendida. Se apaga sola tras 15 minutos sin pedidos.
      </p>
    </div>
  );
}
