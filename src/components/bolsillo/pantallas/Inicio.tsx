'use client';

/**
 * Inicio: lo que tienes y qué poner ahora, por hora del día como daylist.
 * Sueño: docs/bolsillo/suenos/1-inicio.jpg.
 */

import { useMemo } from 'react';
import { CaretRight, UserCircle } from '@phosphor-icons/react';
import { T } from '@/components/daw/theme';
import { OCASIONES } from '@/lib/bolsillo/crear/conversacion';
import { pedirCrear } from '@/lib/bolsillo/crear/pendiente';
import { nombreDelBloque, seccionesDelInicio, type SeccionInicio } from '@/lib/bolsillo/reproductor/inicio';
import { useBolsillo } from '../contexto';
import { BotonPrincipal, Chip, FilaChips, Fila, Portada, Seccion, Tarjeta, Vacio, duracionLegible } from '../kit';

export function PantallaInicio() {
  const { biblioteca, reproductor, nav, cuenta } = useBolsillo();
  const ahora = Date.now();
  const secciones = useMemo(
    () => seccionesDelInicio({ canciones: biblioteca.canciones, versiones: biblioteca.versiones, artistas: biblioteca.artistas, ahora }),
    // La hora cambia el Inicio al volver a la app; no hace falta repintar cada segundo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [biblioteca.canciones, biblioteca.versiones, biblioteca.artistas],
  );
  const titulo = nombreDelBloque(new Date(ahora));
  const tocarDesde = (s: SeccionInicio, id: string) => void reproductor.tocar(id, { cola: s.cancionIds });

  return (
    <>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0 4px' }}>
        <span style={{ fontSize: 22, fontWeight: 650, letterSpacing: '-0.03em' }}>
          aura <span style={{ fontWeight: 400, color: T.dim, fontSize: 18 }}>Music</span>
        </span>
        <button
          type="button"
          onClick={() => nav.ir({ tipo: 'cuenta' })}
          aria-label="Tu cuenta"
          style={{ appearance: 'none', border: 'none', background: 'none', width: 44, height: 44, display: 'grid', placeItems: 'center', cursor: 'pointer', color: T.text }}
        >
          {cuenta.usuario?.foto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cuenta.usuario.foto} alt="" style={{ width: 34, height: 34, borderRadius: 17 }} />
          ) : (
            <UserCircle size={32} />
          )}
        </button>
      </header>
      <h1 style={{ fontSize: 36, fontWeight: 650, letterSpacing: '-0.035em', lineHeight: 1.05, margin: '8px 0 4px' }}>{titulo}</h1>

      {biblioteca.cargando ? null : secciones.length === 0 ? (
        <>
          <Vacio
            texto="Aquí saldrá tu música: la que te hagas para cada momento, y la que más escuches arriba."
            accion={<BotonPrincipal full={false} onClick={() => nav.pestana('crear')}>Haz tu primera canción</BotonPrincipal>}
          />
          <Seccion titulo="O empieza por aquí">
            <FilaChips>
              {OCASIONES.slice(1, 6).map((o) => (
                <Chip
                  key={o.id}
                  onClick={() => {
                    pedirCrear({ frase: o.frase, tipo: o.quiere === 'playlist' ? undefined : o.quiere });
                    nav.pestana('crear');
                  }}
                >
                  {o.etiqueta}
                </Chip>
              ))}
            </FilaChips>
          </Seccion>
        </>
      ) : (
        secciones.map((s) => {
          if (s.id === 'artistas') {
            return (
              <Seccion key={s.id} titulo={s.titulo}>
                <div style={{ display: 'flex', gap: 16, overflowX: 'auto' }}>
                  {s.artistaIds.map((id) => {
                    const a = biblioteca.artistas.find((x) => x.id === id);
                    if (!a) return null;
                    return (
                      <button key={id} type="button" className="daw-press" onClick={() => nav.ir({ tipo: 'artista', id })} style={{ appearance: 'none', border: 'none', background: 'none', padding: 0, width: 96, textAlign: 'center', cursor: 'pointer', color: T.text }}>
                        <Portada portada={a.portada} tam={96} radio={48} />
                        <span style={{ display: 'block', fontSize: 14, marginTop: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.nombre}</span>
                      </button>
                    );
                  })}
                </div>
              </Seccion>
            );
          }
          if (s.id === 'paisajes') {
            return (
              <Seccion key={s.id} titulo={s.titulo}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {s.cancionIds.slice(0, 3).map((id) => {
                    const c = biblioteca.cancion(id);
                    const v = c ? biblioteca.versionQueSuena(c) : null;
                    if (!c) return null;
                    return (
                      <button key={id} type="button" className="daw-press" onClick={() => tocarDesde(s, id)} style={{ appearance: 'none', border: 'none', padding: 0, background: 'none', textAlign: 'left', cursor: 'pointer', color: T.text }}>
                        <Tarjeta style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 12 }}>
                          <Portada portada={c.portada} tam={72} radio={12} />
                          <span style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ display: 'block', fontSize: 17, fontWeight: 600 }}>{c.titulo}</span>
                            <span style={{ display: 'block', fontSize: 14, color: T.dim }}>
                              {[v ? duracionLegible(v.receta.duracionSeg) : null, v?.receta.capas?.tono ? `${v.receta.capas.tono.hz} Hz` : null].filter(Boolean).join(' · ')}
                            </span>
                          </span>
                          <CaretRight size={20} color={T.faint} />
                        </Tarjeta>
                      </button>
                    );
                  })}
                </div>
              </Seccion>
            );
          }
          if (s.id === 'decidir') {
            return (
              <Seccion key={s.id} titulo={s.titulo}>
                {s.linea ? <p style={{ fontSize: 14, color: T.dim, marginTop: -4 }}>{s.linea}</p> : null}
                {s.cancionIds.map((id) => {
                  const c = biblioteca.cancion(id);
                  return c ? <Fila key={id} portada={c.portada} titulo={c.titulo} linea={c.porque} onClick={() => nav.ir({ tipo: 'cancion', id })} /> : null;
                })}
              </Seccion>
            );
          }
          // El bloque de la hora ya es el título grande: aquí va su línea («Para desconectar»).
          const tituloSeccion = s.id === 'franja' && s.titulo === titulo ? (s.linea ?? 'Para ahora') : s.titulo;
          return (
            <Seccion key={s.id} titulo={tituloSeccion}>
              {s.linea && tituloSeccion !== s.linea ? <p style={{ fontSize: 14, color: T.dim, marginTop: -4 }}>{s.linea}</p> : null}
              <div style={{ display: 'grid', gridAutoFlow: 'column', gridAutoColumns: 'minmax(132px, 30%)', gap: 12, overflowX: 'auto', paddingBottom: 4 }}>
                {s.cancionIds.map((id) => {
                  const c = biblioteca.cancion(id);
                  if (!c) return null;
                  const suena = reproductor.actual?.cancion.id === id;
                  return (
                    <button key={id} type="button" className="daw-press" onClick={() => tocarDesde(s, id)} onDoubleClick={() => nav.ir({ tipo: 'cancion', id })} style={{ appearance: 'none', border: 'none', background: 'none', padding: 0, textAlign: 'left', cursor: 'pointer', color: T.text }}>
                      <Portada portada={c.portada} tam="100%" radio={12} titulo={c.titulo} />
                      <span style={{ display: 'block', marginTop: 8, fontSize: 15, fontWeight: 550, color: suena ? T.ai : T.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.titulo}</span>
                      <span style={{ display: 'block', fontSize: 13, color: T.faint }}>{c.tipo === 'paisaje' ? 'Paisaje' : 'Canción'}</span>
                    </button>
                  );
                })}
              </div>
            </Seccion>
          );
        })
      )}
    </>
  );
}
