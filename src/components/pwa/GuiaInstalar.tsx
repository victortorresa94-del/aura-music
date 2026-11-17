'use client';

/**
 * Primera vez en un iPhone, desde el navegador: antes de grabar nada, cómo se
 * instala. En iPhone no hay botón de instalar que podamos poner nosotros, y lo
 * que se graba en Safari no pasa a la app instalada (cada una guarda lo suyo).
 * Si esto se cuenta después de la primera toma, esa toma se queda atrapada en
 * Safari, que además la borra tras siete días sin abrir la web. Por eso va
 * delante de la intro, una sola vez, y se puede seguir sin instalar.
 */

import { useEffect, useState } from 'react';
import { haptic } from '@/components/daw/theme';
import { T, label, numeric } from '@/components/daw/ui';
import { abiertaComoApp, plataformaActual } from '@/lib/pwa/instalacion';

const CLAVE_VISTA = 'aura-music:guia-iphone';

/** El cuadrado con la flecha de Compartir, tal como lo dibuja iOS. */
export function IconCompartirIos({ size = 18, color = T.text }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden focusable={false}>
      <path d="M12 3.5v11" stroke={color} strokeWidth={1.75} strokeLinecap="round" />
      <path d="m8 7.5 4-4 4 4" stroke={color} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M8.5 10.5H7a2 2 0 0 0-2 2V19a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6.5a2 2 0 0 0-2-2h-1.5"
        stroke={color}
        strokeWidth={1.75}
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Chrome, Firefox y Edge de iPhone también instalan, pero el botón está arriba. */
function enSafari(): boolean {
  const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent;
  return !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
}

/** «Safari» o «el navegador», para no nombrar Safari a quien usa Chrome. */
export function navegadorIphone(): string {
  return enSafari() ? 'Safari' : 'el navegador';
}

/** Los pasos de iPhone. Se usan aquí y en Ajustes. */
export function pasosIphone(): { texto: string; icono?: boolean }[] {
  return [
    {
      texto: enSafari() ? 'Toca Compartir en la barra de Safari.' : 'Toca Compartir en la barra de direcciones.',
      icono: true,
    },
    { texto: 'Elige «Añadir a pantalla de inicio».' },
    { texto: 'Ábrela desde su icono: entera, sin barra y sin cobertura.' },
  ];
}

/** Lo que nadie cuenta y es lo que hace perder ideas. Aquí y en Ajustes. */
export function textoSafariNoPasa(navegador: string): string {
  return (
    `Lo que grabes en ${navegador} no pasa a la app instalada: cada una guarda lo suyo. ` +
    'Y el navegador lo borra si pasas una semana sin abrirla; instalada, no. ' +
    'Si ya tienes ideas aquí, sácalas con Exportar idea en Ajustes y mételas en la app con Importar idea.'
  );
}

export function GuiaInstalarIphone() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (plataformaActual() !== 'iphone' || abiertaComoApp()) return;
    try {
      if (window.localStorage.getItem(CLAVE_VISTA) === '1') return;
    } catch {
      /* sin almacenamiento se enseña: más vale una vez de más */
    }
    setVisible(true);
  }, []);

  if (!visible) return null;

  const cerrar = () => {
    haptic(10);
    try {
      window.localStorage.setItem(CLAVE_VISTA, '1');
    } catch {
      /* volverá a salir la próxima vez */
    }
    setVisible(false);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="guia-instalar-titulo"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 95,
        background: T.bg,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        overflowY: 'auto',
        padding: '32px 24px',
        paddingBottom: 'max(32px, env(safe-area-inset-bottom))',
        paddingTop: 'max(32px, env(safe-area-inset-top))',
      }}
    >
      <div style={{ width: '100%', maxWidth: 440, margin: '0 auto' }}>
        <span style={{ ...label, fontSize: 13 }}>Antes de grabar</span>
        <h2
          id="guia-instalar-titulo"
          style={{
            fontFamily: T.fontBody,
            fontSize: 34,
            fontWeight: 600,
            letterSpacing: '-0.035em',
            lineHeight: 1.08,
            margin: '12px 0 28px',
            color: T.text,
            textWrap: 'balance',
          }}
        >
          Instálala en tu iPhone.
        </h2>

        <ol style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 24 }}>
          {pasosIphone().map((paso, i) => (
            <li key={paso.texto} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <span
                aria-hidden
                style={{
                  ...numeric,
                  width: 26,
                  height: 26,
                  flexShrink: 0,
                  display: 'grid',
                  placeItems: 'center',
                  borderRadius: 8,
                  background: T.fill,
                  boxShadow: `inset 0 1px 0 ${T.rim}`,
                  fontSize: 12,
                  color: T.text,
                }}
              >
                {i + 1}
              </span>
              <span style={{ fontSize: 15, lineHeight: 1.5, color: T.dim, paddingTop: 2 }}>
                {paso.texto}
                {paso.icono ? (
                  <span
                    style={{ display: 'inline-flex', verticalAlign: '-3px', marginLeft: 6 }}
                    aria-label="(el icono del cuadrado con la flecha hacia arriba)"
                  >
                    <IconCompartirIos size={18} color={T.text} />
                  </span>
                ) : null}
              </span>
            </li>
          ))}
        </ol>

        <p
          style={{
            fontFamily: T.fontBody,
            fontSize: 14,
            lineHeight: 1.5,
            color: T.text,
            padding: '14px 16px',
            borderRadius: 14,
            background: T.fill,
            boxShadow: `inset 0 1px 0 ${T.rim}`,
            marginBottom: 28,
            textWrap: 'pretty',
          }}
        >
          {textoSafariNoPasa(navegadorIphone())}
        </p>

        <button
          type="button"
          className="daw-press daw-hover"
          onClick={cerrar}
          style={{
            width: '100%',
            minHeight: 52,
            borderRadius: 14,
            border: 'none',
            background: T.fill,
            boxShadow: `inset 0 1px 0 ${T.rim}`,
            color: T.text,
            fontFamily: T.fontBody,
            fontSize: 15,
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          Seguir en {navegadorIphone()} por ahora
        </button>
      </div>
    </div>
  );
}
