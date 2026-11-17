'use client';

/**
 * Los avisos de la app instalada, bajo la cabecera: versión nueva, un audio
 * que te han compartido, instalar (Android) y el móvil lleno.
 *
 * Arriba y no abajo porque abajo vive el aviso de estado del estudio («toma
 * adelantada 12 ms») y el dock: estos esperan a que decidas, aquellos se van
 * solos. Son cristal porque flotan sobre la línea de tiempo, que se mueve.
 * Ninguno sale mientras se graba o suena: no se interrumpe una toma para
 * contar que hay una versión nueva.
 */

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { useInstalacion, type Pwa } from '@/hooks/usePwa';
import { pedirInstalacion } from '@/lib/pwa/instalacion';
import type { Studio } from '@/hooks/useStudio';
import { haptic } from '@/components/daw/theme';
import { IconClose, T } from '@/components/daw/ui';

const CLAVE_INSTALAR_VISTO = 'aura-music:instalar-visto';

export function AvisosPwa({
  studio,
  pwa,
  onAbrirAjustes,
}: {
  studio: Studio;
  pwa: Pwa;
  onAbrirAjustes: () => void;
}) {
  const instalacion = useInstalacion();
  const [instalarVisto, setInstalarVisto] = useState(true);
  const [tactil, setTactil] = useState(false);

  useEffect(() => {
    try {
      setInstalarVisto(window.localStorage.getItem(CLAVE_INSTALAR_VISTO) === '1');
    } catch {
      setInstalarVisto(false);
    }
    // En el PC el botón de instalar ya está en Ajustes; el aviso es para el móvil.
    setTactil(window.matchMedia('(pointer: coarse)').matches);
  }, []);

  const libre = studio.transport === 'stopped';
  if (!libre) return null;

  const cerrarInstalar = () => {
    setInstalarVisto(true);
    try {
      window.localStorage.setItem(CLAVE_INSTALAR_VISTO, '1');
    } catch {
      /* sin almacenamiento, volverá a salir: no es grave */
    }
  };

  const avisos: ReactNode[] = [];

  if (pwa.lleno) {
    avisos.push(
      <Aviso
        key="lleno"
        titulo="El móvil está lleno"
        texto="Lo último no se ha podido guardar. Exporta las ideas que no uses y bórralas para hacer sitio."
        onCerrar={pwa.cerrarLleno}
      >
        <Boton
          principal
          onClick={() => {
            pwa.cerrarLleno();
            onAbrirAjustes();
          }}
        >
          Ir a Ajustes
        </Boton>
      </Aviso>,
    );
  }

  if (pwa.compartidos.length > 0) {
    const nombres = pwa.compartidos.map((f) => f.name).join(', ');
    avisos.push(
      <Aviso
        key="compartido"
        titulo={pwa.compartidos.length === 1 ? 'Te ha llegado un audio' : `Te han llegado ${pwa.compartidos.length} audios`}
        texto={nombres}
        onCerrar={pwa.descartarCompartidos}
      >
        <Boton principal onClick={() => void pwa.meterCompartidos()}>
          Meter en la idea
        </Boton>
      </Aviso>,
    );
  }

  if (pwa.versionNueva && pwa.puedeActualizarAhora) {
    avisos.push(
      <Pastilla key="version" onCerrar={pwa.aplazarVersion}>
        <span style={{ fontFamily: T.fontBody, fontSize: 14, fontWeight: 500, color: T.text, whiteSpace: 'nowrap' }}>
          Nueva versión
        </span>
        <Boton principal compacto onClick={() => void pwa.actualizar()}>
          Actualizar
        </Boton>
      </Pastilla>,
    );
  }

  if (instalacion.puedePedir && !instalarVisto && tactil && avisos.length === 0) {
    avisos.push(
      <Aviso
        key="instalar"
        titulo="Instala Aura Music"
        texto="Se abre a pantalla completa, sin barra del navegador, y funciona sin cobertura."
        onCerrar={cerrarInstalar}
      >
        <Boton
          principal
          onClick={async () => {
            cerrarInstalar();
            await pedirInstalacion();
          }}
        >
          Instalar
        </Boton>
      </Aviso>,
    );
  }

  if (avisos.length === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        // Justo bajo la cabecera: su alto (48 + 2 × 6) más la barra de estado.
        top: 'calc(max(6px, env(safe-area-inset-top)) + 62px)',
        zIndex: 40,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        padding: '0 12px',
        pointerEvents: 'none',
      }}
    >
      {avisos}
      <style>{`
        @keyframes pwa-baja {
          from { opacity: 0; transform: translateY(-6px) scale(.985); }
          to { opacity: 1; transform: none; }
        }
        .pwa-baja { animation: pwa-baja 220ms ${T.easeOut}; }
        @media (prefers-reduced-motion: reduce) { .pwa-baja { animation: none; } }
      `}</style>
    </div>
  );
}

const cristal: CSSProperties = {
  pointerEvents: 'auto',
  background: T.glass,
  backdropFilter: 'blur(20px) saturate(160%)',
  WebkitBackdropFilter: 'blur(20px) saturate(160%)',
  transform: 'translateZ(0)',
  boxShadow: `${T.elev2}, inset 0 0 0 1px ${T.border}`,
};

/** El aviso corto: una línea y un botón. */
function Pastilla({ children, onCerrar }: { children: ReactNode; onCerrar: () => void }) {
  return (
    <div
      role="status"
      className="pwa-baja"
      style={{
        ...cristal,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        minHeight: 48,
        padding: '6px 4px 6px 16px',
        borderRadius: 999,
      }}
    >
      {children}
      <Cerrar onClick={onCerrar} titulo="Ahora no" />
    </div>
  );
}

/** El aviso que necesita explicarse: título, una frase y lo que se puede hacer. */
function Aviso({
  titulo,
  texto,
  children,
  onCerrar,
}: {
  titulo: string;
  texto: string;
  children: ReactNode;
  onCerrar: () => void;
}) {
  return (
    <section
      role="status"
      aria-label={titulo}
      className="pwa-baja"
      style={{
        ...cristal,
        width: '100%',
        maxWidth: 440,
        borderRadius: 16,
        padding: '12px 6px 14px 16px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0, paddingTop: 4 }}>
          <p
            style={{
              fontFamily: T.fontBody,
              fontSize: 15,
              fontWeight: 600,
              letterSpacing: '-0.01em',
              lineHeight: 1.3,
              color: T.text,
            }}
          >
            {titulo}
          </p>
          <p
            style={{
              fontFamily: T.fontBody,
              fontSize: 14,
              lineHeight: 1.45,
              color: T.dim,
              marginTop: 2,
              overflowWrap: 'anywhere',
            }}
          >
            {texto}
          </p>
        </div>
        <Cerrar onClick={onCerrar} titulo="Cerrar" />
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 12, paddingRight: 10 }}>{children}</div>
    </section>
  );
}

function Boton({
  children,
  onClick,
  principal,
  compacto,
}: {
  children: ReactNode;
  onClick: () => void;
  principal?: boolean;
  compacto?: boolean;
}) {
  return (
    <button
      type="button"
      className="daw-press daw-sink"
      onClick={() => {
        haptic(8);
        onClick();
      }}
      style={{
        minHeight: compacto ? 36 : 44,
        padding: compacto ? '0 14px' : '0 16px',
        border: 'none',
        borderRadius: compacto ? 999 : 11,
        background: principal ? T.text : T.fill,
        boxShadow: principal ? T.elev1 : `inset 0 1px 0 ${T.rim}`,
        color: principal ? T.inverse : T.text,
        fontFamily: T.fontBody,
        fontSize: compacto ? 14 : 15,
        fontWeight: 600,
        letterSpacing: '-0.01em',
        whiteSpace: 'nowrap',
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}

function Cerrar({ onClick, titulo }: { onClick: () => void; titulo: string }) {
  return (
    <button
      type="button"
      className="daw-press daw-hover"
      onClick={onClick}
      aria-label={titulo}
      title={titulo}
      style={{
        width: 40,
        height: 40,
        flexShrink: 0,
        display: 'grid',
        placeItems: 'center',
        border: 'none',
        borderRadius: 999,
        background: 'transparent',
        cursor: 'pointer',
      }}
    >
      <IconClose size={16} color={T.dim} />
    </button>
  );
}
