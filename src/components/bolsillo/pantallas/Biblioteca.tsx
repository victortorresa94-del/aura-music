'use client';

/** Biblioteca: Canciones · Playlists · Artistas · Paisajes. Solo lo que te has quedado. */

import { useMemo, useState } from 'react';
import { DotsThree, Plus } from '@phosphor-icons/react';
import { T } from '@/components/daw/theme';
import { Segmented } from '@/components/daw/ui';
import { guardadasRecientes } from '@/lib/bolsillo/biblioteca';
import { useBolsillo } from '../contexto';
import { BotonSecundario, Cabecera, Fila, Vacio, duracionLegible } from '../kit';

type Vista = 'canciones' | 'playlists' | 'artistas' | 'paisajes';

export function PantallaBiblioteca() {
  const { biblioteca, reproductor, nav } = useBolsillo();
  const [vista, setVista] = useState<Vista>('canciones');
  const guardadas = useMemo(() => guardadasRecientes(biblioteca.canciones), [biblioteca.canciones]);
  const canciones = guardadas.filter((c) => c.tipo === 'cancion');
  const paisajes = guardadas.filter((c) => c.tipo === 'paisaje');
  const lista = vista === 'canciones' ? canciones : paisajes;

  const linea = (id: string) => {
    const c = biblioteca.cancion(id);
    if (!c) return '';
    const v = biblioteca.versionQueSuena(c);
    const artista = c.artistaId ? biblioteca.artistas.find((a) => a.id === c.artistaId)?.nombre : null;
    return [artista, c.tipo === 'paisaje' && v ? duracionLegible(v.receta.duracionSeg) : null, v?.receta.estilo, c.origen === 'aura-studio' ? 'de aura Studio' : null]
      .filter(Boolean)
      .join(' · ');
  };

  const masBoton = (id: string) => (
    <button type="button" aria-label="Abrir" onClick={() => nav.ir({ tipo: 'cancion', id })} style={{ appearance: 'none', border: 'none', background: 'none', width: 44, height: 44, display: 'grid', placeItems: 'center', cursor: 'pointer', color: T.dim }}>
      <DotsThree size={24} weight="bold" />
    </button>
  );

  return (
    <>
      <Cabecera titulo="Biblioteca" />
      <Segmented<Vista>
        value={vista}
        onChange={setVista}
        ariaLabel="Qué ver"
        options={[
          { value: 'canciones', text: 'Canciones' },
          { value: 'playlists', text: 'Playlists' },
          { value: 'artistas', text: 'Artistas' },
          { value: 'paisajes', text: 'Paisajes' },
        ]}
      />
      <div style={{ marginTop: 12 }}>
        {vista === 'playlists' ? (
          <>
            <BotonSecundario full onClick={() => nav.ir({ tipo: 'nueva-playlist' })}>
              <Plus size={18} /> Nueva playlist
            </BotonSecundario>
            {biblioteca.playlists.length === 0 ? (
              <Vacio texto="Aún no tienes playlists. Haz una con tus canciones, pídele una nueva a aura o combina dos." />
            ) : (
              [...biblioteca.playlists]
                .sort((a, b) => b.actualizadaEn - a.actualizadaEn)
                .map((p) => <Fila key={p.id} portada={p.portada} titulo={p.nombre} linea={`${p.cancionIds.length} canciones${p.viva ? ' · se renueva sola' : ''}`} onClick={() => nav.ir({ tipo: 'playlist', id: p.id })} />)
            )}
          </>
        ) : vista === 'artistas' ? (
          <>
            <BotonSecundario full onClick={() => nav.ir({ tipo: 'nuevo-artista' })}>
              <Plus size={18} /> Nuevo artista
            </BotonSecundario>
            {biblioteca.artistas.length === 0 ? (
              <Vacio texto="Un artista es una banda inventada que siempre suena a sí misma. Es tuyo." />
            ) : (
              biblioteca.artistas.map((a) => <Fila key={a.id} portada={a.portada} titulo={a.nombre} linea={a.adn.estilo} onClick={() => nav.ir({ tipo: 'artista', id: a.id })} />)
            )}
          </>
        ) : lista.length === 0 ? (
          <Vacio
            texto={vista === 'paisajes' ? 'Un paisaje es música larga para un fin: dormir, concentrarte, bajar el ritmo. Se alarga en el móvil, gratis.' : 'Lo que te quedas sale aquí. Haz una en Crear.'}
            accion={<BotonSecundario onClick={() => (vista === 'paisajes' ? nav.ir({ tipo: 'paisaje' }) : nav.pestana('crear'))}>{vista === 'paisajes' ? 'Hacer un paisaje' : 'Crear'}</BotonSecundario>}
          />
        ) : (
          lista.map((c) => (
            <Fila
              key={c.id}
              portada={c.portada}
              titulo={c.titulo}
              linea={linea(c.id)}
              activa={reproductor.actual?.cancion.id === c.id}
              onClick={() => void reproductor.tocar(c.id, { cola: lista.map((x) => x.id) })}
              derecha={masBoton(c.id)}
            />
          ))
        )}
      </div>
    </>
  );
}
