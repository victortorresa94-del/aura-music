'use client';

import { Pause, Play, SkipForward } from '@phosphor-icons/react';
import { T, haptic } from '@/components/daw/theme';
import { useBolsillo } from '../contexto';
import { Portada } from '../kit';

/** El mini reproductor, el mismo en todas las pantallas, fijo encima de la barra. */
export function MiniReproductor({ onAbrir }: { onAbrir: () => void }) {
  const { reproductor, biblioteca } = useBolsillo();
  const actual = reproductor.actual;
  if (!actual) return null;
  const artista = actual.cancion.artistaId ? biblioteca.artistas.find((a) => a.id === actual.cancion.artistaId)?.nombre : null;
  const progreso = reproductor.duracion > 0 ? Math.min(1, reproductor.posicion / reproductor.duracion) : 0;
  const boton = { appearance: 'none' as const, border: 'none', background: 'none', width: 44, height: 44, display: 'grid', placeItems: 'center', cursor: 'pointer', color: T.text };
  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 10, padding: '8px 8px 8px 8px', marginBottom: 6, borderRadius: 16, background: T.surface, boxShadow: T.elev2, overflow: 'hidden' }}>
      <button type="button" onClick={onAbrir} className="daw-press" style={{ appearance: 'none', border: 'none', background: 'none', padding: 0, flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', textAlign: 'left', color: T.text }}>
        <Portada portada={actual.cancion.portada} tam={40} radio={8} />
        <span style={{ minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 15, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{actual.cancion.titulo}</span>
          <span style={{ display: 'block', fontSize: 13, color: T.dim, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {reproductor.error ?? artista ?? `v${actual.version.n} · aura Music`}
          </span>
        </span>
      </button>
      <button type="button" aria-label={reproductor.sonando ? 'Pausar' : 'Seguir'} onClick={() => { haptic(6); reproductor.alternar(); }} style={boton}>
        {reproductor.sonando ? <Pause size={24} weight="fill" /> : <Play size={24} weight="fill" />}
      </button>
      {reproductor.haySiguiente ? (
        <button type="button" aria-label="Siguiente" onClick={reproductor.siguiente} style={boton}>
          <SkipForward size={22} weight="fill" />
        </button>
      ) : null}
      <span aria-hidden style={{ position: 'absolute', left: 12, right: 12, bottom: 3, height: 2, borderRadius: 1, background: T.fill }}>
        <span style={{ display: 'block', height: '100%', width: `${progreso * 100}%`, background: T.ai, borderRadius: 1 }} />
      </span>
    </div>
  );
}
