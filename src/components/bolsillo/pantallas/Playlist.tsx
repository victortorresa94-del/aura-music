'use client';

/**
 * Playlists: tocarlas, cambiarlas (nombre, añadir, quitar, ordenar), pedir una
 * nueva que encaje y combinarlas. Víctor, 28-nov-2026: «que pueda añadir,
 * crear y modificar las playlists o combinarlas».
 */

import { useEffect, useMemo, useReducer, useState } from 'react';
import { ArrowDown, ArrowUp, Play, Plus, Shuffle, Trash, X } from '@phosphor-icons/react';
import { T } from '@/components/daw/theme';
import { guardadasRecientes } from '@/lib/bolsillo/biblioteca';
import { pedirCrear } from '@/lib/bolsillo/crear/pendiente';
import { combinar, moverCancion, sinCancion } from '@/lib/bolsillo/playlists/editar';
import { escucharProgresos, progresoDe } from '@/lib/bolsillo/playlists/generarPlaylist';
import { conCanciones, nuevaPlaylist, renombrada, sinViva } from '@/lib/bolsillo/playlists/playlist';
import { textoQuedan, textoRitmo } from '@/lib/bolsillo/playlists/viva';
import type { Playlist } from '@/lib/bolsillo/tipos';
import { useBolsillo } from '../contexto';
import { Aviso, BotonPrincipal, BotonSecundario, Cabecera, Chip, Fila, Portada, Seccion, Vacio } from '../kit';

function useProgreso(playlistId: string) {
  const [, repintar] = useReducer((n: number) => n + 1, 0);
  useEffect(() => escucharProgresos(repintar), []);
  return progresoDe(playlistId);
}

/** Elegir canciones de la biblioteca (o playlists, para combinar). */
function Selector<T2 extends { id: string }>({
  items,
  render,
  elegidos,
  alCambiar,
}: {
  items: T2[];
  render: (item: T2) => { titulo: string; linea?: string; portada?: Playlist['portada'] };
  elegidos: Set<string>;
  alCambiar: (id: string) => void;
}) {
  return (
    <div>
      {items.map((it) => {
        const r = render(it);
        const si = elegidos.has(it.id);
        return (
          <Fila
            key={it.id}
            portada={r.portada}
            titulo={r.titulo}
            linea={r.linea}
            onClick={() => alCambiar(it.id)}
            derecha={
              <span aria-hidden style={{ width: 26, height: 26, borderRadius: 13, display: 'grid', placeItems: 'center', background: si ? T.text : T.fill, color: T.inverse, marginRight: 8 }}>
                {si ? '✓' : ''}
              </span>
            }
          />
        );
      })}
    </div>
  );
}

export function PantallaPlaylist({ id }: { id: string }) {
  const { biblioteca, reproductor, nav } = useBolsillo();
  const playlist = biblioteca.playlists.find((p) => p.id === id);
  const progreso = useProgreso(id);
  const [modo, setModo] = useState<'ver' | 'editar' | 'anadir' | 'combinar' | 'borrar'>('ver');
  const [nombre, setNombre] = useState('');
  const [elegidos, setElegidos] = useState<Set<string>>(new Set());
  const guardadas = useMemo(() => guardadasRecientes(biblioteca.canciones), [biblioteca.canciones]);

  if (!playlist) return <Vacio texto="Esta playlist ya no está." accion={<BotonSecundario onClick={nav.atras}>Volver</BotonSecundario>} />;

  const guardar = (p: Playlist) => biblioteca.guardarPlaylist(p);
  const alternar = (x: string) =>
    setElegidos((s) => {
      const n = new Set(s);
      if (n.has(x)) n.delete(x);
      else n.add(x);
      return n;
    });
  const canciones = playlist.cancionIds.map((cid) => biblioteca.cancion(cid)).filter((c): c is NonNullable<typeof c> => !!c);
  const otras = biblioteca.playlists.filter((p) => p.id !== playlist.id);
  const generandose = !!progreso?.enMarcha;

  return (
    <>
      <Cabecera
        titulo=""
        onAtras={nav.atras}
        acciones={
          <BotonSecundario onClick={() => setModo(modo === 'editar' ? 'ver' : 'editar')}>{modo === 'editar' ? 'Hecho' : 'Editar'}</BotonSecundario>
        }
      />
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end' }}>
        <Portada portada={playlist.portada} tam={120} radio={16} titulo={playlist.nombre} />
        <div style={{ minWidth: 0, flex: 1 }}>
          {modo === 'editar' ? (
            <input
              defaultValue={playlist.nombre}
              onChange={(e) => setNombre(e.target.value)}
              onBlur={() => nombre.trim() && void guardar(renombrada(playlist, nombre))}
              aria-label="Nombre de la playlist"
              style={{ width: '100%', fontSize: 24, fontWeight: 650, border: 'none', borderBottom: `1px solid ${T.borderStrong}`, background: 'transparent', outline: 'none', padding: '4px 0' }}
            />
          ) : (
            <h1 style={{ fontSize: 26, fontWeight: 650, letterSpacing: '-0.03em', lineHeight: 1.1 }}>{playlist.nombre}</h1>
          )}
          <p style={{ fontSize: 14, color: T.dim, marginTop: 6 }}>
            {playlist.cancionIds.length} canciones{playlist.porque ? ` · ${playlist.porque}` : ''}
          </p>
        </div>
      </div>

      {generandose ? (
        <Aviso>
          Haciendo las canciones: {progreso!.estados.filter((e) => e === 'hecha').length} de {progreso!.estados.length}. Puedes ir escuchando las que ya están.
        </Aviso>
      ) : null}
      {progreso?.parada ? <Aviso>{progreso.parada.texto}</Aviso> : null}

      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <BotonPrincipal disabled={!canciones.length} onClick={() => canciones[0] && void reproductor.tocar(canciones[0].id, { cola: canciones.map((c) => c.id) })}>
          <Play size={18} weight="fill" style={{ verticalAlign: '-3px' }} /> Tocar todo
        </BotonPrincipal>
      </div>

      {playlist.viva ? (
        <Aviso>
          Se renueva sola {textoRitmo(playlist.viva)}. {textoQuedan(playlist.viva, Date.now())}
          <div style={{ marginTop: 8 }}>
            <BotonSecundario onClick={() => void guardar(sinViva(playlist))}>Que no se renueve</BotonSecundario>
          </div>
        </Aviso>
      ) : null}

      <Seccion titulo="Canciones">
        {canciones.length === 0 ? <Vacio texto="Todavía no tiene canciones." /> : null}
        {canciones.map((c, i) => (
          <Fila
            key={c.id}
            portada={c.portada}
            titulo={c.titulo}
            linea={playlist.porques?.[c.id] ?? c.porque}
            activa={reproductor.actual?.cancion.id === c.id}
            onClick={() => (modo === 'editar' ? undefined : void reproductor.tocar(c.id, { cola: canciones.map((x) => x.id) }))}
            derecha={
              modo === 'editar' ? (
                <span style={{ display: 'flex' }}>
                  <button type="button" aria-label="Subir" disabled={i === 0} onClick={() => void guardar(moverCancion(playlist, c.id, -1))} style={iconoBoton}>
                    <ArrowUp size={18} />
                  </button>
                  <button type="button" aria-label="Bajar" disabled={i === canciones.length - 1} onClick={() => void guardar(moverCancion(playlist, c.id, 1))} style={iconoBoton}>
                    <ArrowDown size={18} />
                  </button>
                  <button type="button" aria-label="Quitar de la playlist" onClick={() => void guardar(sinCancion(playlist, c.id))} style={iconoBoton}>
                    <X size={18} />
                  </button>
                </span>
              ) : undefined
            }
          />
        ))}
      </Seccion>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 20 }}>
        <Chip onClick={() => { setElegidos(new Set()); setModo('anadir'); }}>
          <Plus size={16} /> De mis canciones
        </Chip>
        <Chip
          onClick={() => {
            pedirCrear({ frase: `Una canción nueva que encaje en la playlist «${playlist.nombre}». ${playlist.porque ?? ''}`, playlistId: playlist.id, tipo: 'cancion' });
            nav.pestana('crear');
          }}
        >
          <Plus size={16} /> Una nueva que encaje
        </Chip>
        {otras.length ? (
          <Chip onClick={() => { setElegidos(new Set()); setModo('combinar'); }}>
            <Shuffle size={16} /> Combinar con otra
          </Chip>
        ) : null}
        <Chip onClick={() => setModo('borrar')}>
          <Trash size={16} /> Borrar
        </Chip>
      </div>

      {modo === 'anadir' ? (
        <Seccion titulo="Añadir de mis canciones">
          <Selector
            items={guardadas.filter((c) => !playlist.cancionIds.includes(c.id))}
            render={(c) => ({ titulo: c.titulo, linea: c.porque, portada: c.portada })}
            elegidos={elegidos}
            alCambiar={alternar}
          />
          <BotonPrincipal disabled={!elegidos.size} onClick={() => { void guardar(conCanciones(playlist, [...elegidos])); setModo('ver'); }}>
            Añadir {elegidos.size || ''}
          </BotonPrincipal>
        </Seccion>
      ) : null}

      {modo === 'combinar' ? (
        <Seccion titulo="Combinar con">
          <p style={{ fontSize: 14, color: T.dim }}>Sale una playlist nueva con las canciones mezcladas, una de cada. Estas no se tocan.</p>
          <Selector items={otras} render={(p) => ({ titulo: p.nombre, linea: `${p.cancionIds.length} canciones`, portada: p.portada })} elegidos={elegidos} alCambiar={alternar} />
          <BotonPrincipal
            disabled={!elegidos.size}
            onClick={async () => {
              const nueva = combinar([playlist, ...otras.filter((p) => elegidos.has(p.id))]);
              await guardar(nueva);
              setModo('ver');
              nav.ir({ tipo: 'playlist', id: nueva.id });
            }}
          >
            Combinarlas
          </BotonPrincipal>
        </Seccion>
      ) : null}

      {modo === 'borrar' ? (
        <Aviso>
          ¿Borrar «{playlist.nombre}»? Las canciones se quedan en tu biblioteca.
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <BotonSecundario onClick={() => setModo('ver')}>No</BotonSecundario>
            <BotonSecundario
              onClick={async () => {
                await biblioteca.borrarPlaylist(playlist.id);
                nav.atras();
              }}
            >
              Sí, bórrala
            </BotonSecundario>
          </div>
        </Aviso>
      ) : null}
    </>
  );
}

const iconoBoton = { appearance: 'none' as const, border: 'none', background: 'none', width: 40, height: 44, display: 'grid', placeItems: 'center', cursor: 'pointer', color: T.dim };

/** Hacer una playlist: con tus canciones, con canciones nuevas (en Crear) o combinando varias. */
export function PantallaNuevaPlaylist() {
  const { biblioteca, nav } = useBolsillo();
  const [camino, setCamino] = useState<'elegir' | 'mias' | 'combinar'>('elegir');
  const [nombre, setNombre] = useState('');
  const [elegidos, setElegidos] = useState<Set<string>>(new Set());
  const guardadas = useMemo(() => guardadasRecientes(biblioteca.canciones), [biblioteca.canciones]);
  const alternar = (x: string) =>
    setElegidos((s) => {
      const n = new Set(s);
      if (n.has(x)) n.delete(x);
      else n.add(x);
      return n;
    });

  return (
    <>
      <Cabecera titulo="Nueva playlist" onAtras={camino === 'elegir' ? nav.atras : () => setCamino('elegir')} />
      {camino === 'elegir' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <BotonPrincipal
            onClick={() => {
              pedirCrear({ frase: 'Una playlist' });
              nav.pestana('crear');
            }}
          >
            Con canciones nuevas
          </BotonPrincipal>
          <BotonSecundario full onClick={() => setCamino('mias')} disabled={!guardadas.length}>
            Con mis canciones
          </BotonSecundario>
          <BotonSecundario full onClick={() => setCamino('combinar')} disabled={biblioteca.playlists.length < 2}>
            <Shuffle size={18} /> Combinar varias
          </BotonSecundario>
          <p style={{ fontSize: 14, color: T.dim, marginTop: 6 }}>Con canciones nuevas, aura te pregunta el momento, te enseña el plan con el porqué de cada una y lo que cuesta antes de hacerla.</p>
        </div>
      ) : camino === 'mias' ? (
        <>
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Cómo se llama"
            aria-label="Nombre de la playlist"
            style={{ width: '100%', fontSize: 16, padding: '12px 14px', borderRadius: 12, border: 'none', background: T.surface, boxShadow: T.elev1, outline: 'none', marginBottom: 12 }}
          />
          <Selector items={guardadas} render={(c) => ({ titulo: c.titulo, linea: c.porque, portada: c.portada })} elegidos={elegidos} alCambiar={alternar} />
          <div style={{ marginTop: 12 }}>
            <BotonPrincipal
              disabled={!elegidos.size || !nombre.trim()}
              onClick={async () => {
                const p = nuevaPlaylist({ nombre, cancionIds: [...elegidos] });
                await biblioteca.guardarPlaylist(p);
                nav.atras();
                setTimeout(() => nav.ir({ tipo: 'playlist', id: p.id }), 50);
              }}
            >
              Crear con {elegidos.size || ''} canciones
            </BotonPrincipal>
          </div>
        </>
      ) : (
        <>
          <p style={{ fontSize: 14, color: T.dim, marginBottom: 8 }}>Elige dos o más. Sale una nueva con las canciones mezcladas; las de origen no se tocan.</p>
          <Selector items={biblioteca.playlists} render={(p) => ({ titulo: p.nombre, linea: `${p.cancionIds.length} canciones`, portada: p.portada })} elegidos={elegidos} alCambiar={alternar} />
          <div style={{ marginTop: 12 }}>
            <BotonPrincipal
              disabled={elegidos.size < 2}
              onClick={async () => {
                const nueva = combinar(biblioteca.playlists.filter((p) => elegidos.has(p.id)));
                await biblioteca.guardarPlaylist(nueva);
                nav.atras();
                setTimeout(() => nav.ir({ tipo: 'playlist', id: nueva.id }), 50);
              }}
            >
              Combinarlas
            </BotonPrincipal>
          </div>
        </>
      )}
    </>
  );
}
