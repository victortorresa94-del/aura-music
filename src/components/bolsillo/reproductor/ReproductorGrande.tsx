'use client';

/**
 * La pantalla grande del reproductor. Con el modo cuidado se oscurece entera
 * y nada brilla (sueño: docs/bolsillo/suenos/4-paisaje-cuidado.jpg): es para
 * el dolor de cabeza o para dormir.
 */

import { CaretDown, Pause, Play, SkipBack, SkipForward } from '@phosphor-icons/react';
import { T, haptic } from '@/components/daw/theme';
import { useBolsillo } from '../contexto';
import { Chip, Portada, duracionLegible } from '../kit';

const TEMPORIZADOR = [
  { min: 15, texto: '15 min' },
  { min: 30, texto: '30 min' },
  { min: 60, texto: '1 h' },
];

export function ReproductorGrande({ abierto, onCerrar }: { abierto: boolean; onCerrar: () => void }) {
  const { reproductor, biblioteca, nav } = useBolsillo();
  const actual = reproductor.actual;
  const cuidado = reproductor.modoCuidado;
  // En cuidado, la pantalla se pone en el tema oscuro aunque la app esté en claro
  // (`data-daw-theme` en el propio diálogo: los tokens cambian solo aquí dentro).
  const fondo = T.bg;
  const tinta = cuidado ? T.dim : T.text;
  const apagada = cuidado ? T.faint : T.dim;
  const total = actual?.version.bucle ? actual.version.receta.duracionSeg : reproductor.duracion;
  const artista = actual?.cancion.artistaId ? biblioteca.artistas.find((a) => a.id === actual.cancion.artistaId)?.nombre : null;
  const minutosQuedan = reproductor.apagaEn ? Math.max(0, Math.round((reproductor.apagaEn - Date.now()) / 60000)) : null;
  const boton = { appearance: 'none' as const, border: 'none', background: 'none', width: 56, height: 56, display: 'grid', placeItems: 'center', cursor: 'pointer', color: tinta };

  return (
    <div
      role="dialog"
      aria-modal={abierto}
      aria-label="Reproductor"
      aria-hidden={!abierto}
      data-daw-theme={cuidado ? 'dark' : undefined}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 70,
        background: fondo,
        color: tinta,
        transform: abierto ? 'translateY(0)' : 'translateY(100%)',
        transition: `transform ${abierto ? 320 : 240}ms ${T.easeDrawer}, background-color 400ms ${T.easeOut}`,
        visibility: abierto ? 'visible' : 'hidden',
        overflowY: 'auto',
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'calc(24px + env(safe-area-inset-bottom))',
      }}
    >
      <div style={{ maxWidth: 520, margin: '0 auto', padding: '8px 20px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <button type="button" onClick={onCerrar} aria-label="Cerrar el reproductor" style={{ ...boton, width: 44, height: 44, marginLeft: -10 }}>
          <CaretDown size={26} />
        </button>
        {actual ? (
          <>
            {!cuidado ? (
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <Portada portada={actual.cancion.portada} tam="min(78vw, 340px)" radio={22} titulo={actual.cancion.titulo} />
              </div>
            ) : null}
            <div style={{ textAlign: cuidado ? 'center' : 'left', marginTop: cuidado ? 48 : 0 }}>
              <h2 style={{ fontSize: cuidado ? 30 : 26, fontWeight: cuidado ? 450 : 650, letterSpacing: '-0.02em' }}>{actual.cancion.titulo}</h2>
              <p style={{ fontSize: 15, color: apagada, marginTop: 6 }}>
                {[artista, actual.version.bucle ? duracionLegible(actual.version.receta.duracionSeg) : null, cuidado ? 'modo cuidado' : null].filter(Boolean).join(' · ') || actual.cancion.porque}
              </p>
            </div>
            <div>
              <input
                type="range"
                className="daw-slider"
                min={0}
                max={Math.max(1, total)}
                step={1}
                value={Math.min(reproductor.posicion, total || 0)}
                onChange={(e) => reproductor.buscar(Number(e.target.value))}
                aria-label="Posición"
                style={{ ['--p' as string]: `${total ? (reproductor.posicion / total) * 100 : 0}%`, opacity: cuidado ? 0.6 : 1 }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: apagada, fontVariantNumeric: 'tabular-nums' }}>
                <span>{duracionLegible(reproductor.posicion)}</span>
                <span>{duracionLegible(total)}</span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
              <button type="button" aria-label="Anterior" onClick={reproductor.anterior} style={boton}>
                <SkipBack size={28} weight="fill" />
              </button>
              <button
                type="button"
                className="daw-press daw-sink"
                aria-label={reproductor.sonando ? 'Pausar' : 'Seguir'}
                onClick={() => {
                  haptic(8);
                  reproductor.alternar();
                }}
                style={{ ...boton, width: 76, height: 76, borderRadius: 38, background: cuidado ? T.fillStrong : T.text, color: cuidado ? tinta : T.inverse }}
              >
                {reproductor.sonando ? <Pause size={32} weight="fill" /> : <Play size={32} weight="fill" />}
              </button>
              <button type="button" aria-label="Siguiente" onClick={reproductor.siguiente} style={{ ...boton, opacity: reproductor.haySiguiente ? 1 : 0.35 }}>
                <SkipForward size={28} weight="fill" />
              </button>
            </div>
            <div>
              <p style={{ fontSize: 14, color: apagada, marginBottom: 8 }}>
                {minutosQuedan !== null ? `Se apaga en ${minutosQuedan} min` : 'Apagar en'}
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {TEMPORIZADOR.map((t) => (
                  <Chip key={t.min} onClick={() => reproductor.ponerTemporizador(t.min)}>
                    {t.texto}
                  </Chip>
                ))}
                {reproductor.apagaEn ? <Chip onClick={() => reproductor.ponerTemporizador(null)}>No apagar</Chip> : null}
              </div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 48, fontSize: 15 }}>
              <span>
                Modo cuidado
                <span style={{ display: 'block', fontSize: 13, color: apagada }}>Pantalla oscura y nada que brille</span>
              </span>
              <input type="checkbox" checked={cuidado} onChange={(e) => reproductor.ponerModoCuidado(e.target.checked)} style={{ width: 24, height: 24, accentColor: T.ai }} />
            </label>
            {!cuidado ? (
              <button
                type="button"
                onClick={() => {
                  onCerrar();
                  setTimeout(() => nav.ir({ tipo: 'cancion', id: actual.cancion.id }), 260);
                }}
                style={{ appearance: 'none', border: 'none', background: 'none', color: tinta, fontSize: 15, fontWeight: 550, minHeight: 44, cursor: 'pointer' }}
              >
                Ver versiones y retocar
              </button>
            ) : (
              <p style={{ textAlign: 'center', fontSize: 13, color: apagada }}>Si te molesta, páralo.</p>
            )}
          </>
        ) : (
          <p style={{ color: apagada }}>No suena nada.</p>
        )}
      </div>
    </div>
  );
}
