'use client';

/**
 * «Tus ideas»: la raíz. Aquí se llega al cerrar una idea (o con Abrir…) y
 * desde aquí se empieza todo: una idea nueva, un instrumento, grabar la voz o
 * abrir una que ya tenías.
 *
 * Arriba, la pregunta y los accesos rápidos con su icono; debajo, las ideas en
 * rejilla con buscador. Cada tarjeta dibuja sus pistas como franjas de su
 * color: se reconoce una idea por su forma antes que por su nombre.
 *
 * No se monta encima con animación de entrada: es una pantalla de trabajo, y
 * a una pantalla de trabajo se llega, no se asiste a cómo aparece.
 */

import { DotsThree, MagnifyingGlass, Microphone, Plus, UploadSimple } from '@phosphor-icons/react';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { Archivo } from '@/hooks/useArchivo';
import type { Studio } from '@/hooks/useStudio';
import { haceCuanto } from '@/lib/daw/menus/comandos';
import { listProjects } from '@/lib/daw/storage';
import type { Project } from '@/lib/daw/types';
import { IconoDeFamilia, type IconoFamilia } from '../instrumentos/iconos';
import { PanelDeMenu } from '../menus/PanelDeMenu';
import { haptic, T, trackTint } from '../theme';
import { IconSettings, hintText, label } from '../ui';

export type AccesoRapido = 'pads' | 'teclado' | 'acordes' | 'bajo' | 'voz' | 'loops';

const ACCESOS: { id: AccesoRapido; nombre: string }[] = [
  { id: 'pads', nombre: 'Batería' },
  { id: 'teclado', nombre: 'Teclado' },
  { id: 'acordes', nombre: 'Acordes' },
  { id: 'bajo', nombre: 'Bajo' },
  { id: 'voz', nombre: 'Grabar voz' },
  { id: 'loops', nombre: 'Loops' },
];

export function TusIdeas({
  studio,
  archivo,
  abierta,
  tema,
  onAbrirIdea,
  onNueva,
  onAcceso,
  onImportar,
  onAjustes,
}: {
  studio: Studio;
  archivo: Archivo;
  abierta: boolean;
  tema: 'light' | 'dark';
  onAbrirIdea: (id: string) => void;
  onNueva: () => void;
  onAcceso: (acceso: AccesoRapido) => void;
  onImportar: (fichero: File) => void;
  onAjustes: () => void;
}) {
  const [ideas, setIdeas] = useState<Project[] | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [orden, setOrden] = useState<'recientes' | 'nombre'>('recientes');
  const [menuDe, setMenuDe] = useState<string | null>(null);
  const [ahora, setAhora] = useState(() => Date.now());
  const entrada = useRef<HTMLInputElement | null>(null);

  // Se relee al abrirse y cada vez que cambia algo (borrar una idea, por ejemplo).
  useEffect(() => {
    if (!abierta) return;
    setAhora(Date.now());
    let vivo = true;
    void listProjects().then((lista) => vivo && setIdeas(lista), () => vivo && setIdeas([]));
    return () => {
      vivo = false;
    };
  }, [abierta, studio.project.id, archivo.porBorrar]);

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLocaleLowerCase('es');
    const lista = (ideas ?? []).filter((p) => !q || p.name.toLocaleLowerCase('es').includes(q));
    return orden === 'nombre' ? [...lista].sort((a, b) => a.name.localeCompare(b.name, 'es')) : lista;
  }, [ideas, busqueda, orden]);

  if (!abierta) return null;

  return (
    <div
      role="region"
      aria-label="Tus ideas"
      style={{
        position: 'fixed',
        inset: 0,
        // Por encima del estudio y su cabecera; por debajo de las hojas (Ajustes, borrar).
        zIndex: 40,
        overflowY: 'auto',
        overscrollBehavior: 'contain',
        background: T.bg,
        color: T.text,
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'max(32px, env(safe-area-inset-bottom))',
      }}
    >
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '0 16px' }}>
        {/* Arriba: la marca y Ajustes, nada más. */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56 }}>
          <span style={{ fontFamily: T.fontBody, fontSize: 15, letterSpacing: '-0.03em', color: T.text }}>
            <span style={{ fontWeight: 650 }}>aura</span> <span style={{ fontWeight: 450, color: T.dim }}>music</span>
          </span>
          <button type="button" className="daw-press daw-hover" onClick={onAjustes} style={botonFantasma}>
            <IconSettings size={18} color={T.dim} />
            Ajustes
          </button>
        </div>

        {/* La pregunta y lo que se puede hacer ya. */}
        <section className="daw-inicio-cabeza" style={{ padding: '20px 0 36px' }}>
          <div>
            <h1
              style={{
                fontFamily: T.fontBody,
                fontWeight: 650,
                letterSpacing: '-0.04em',
                lineHeight: 1.02,
                color: T.text,
                textWrap: 'balance',
              }}
              className="daw-inicio-titulo"
            >
              ¿Qué tocamos hoy?
            </h1>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 22 }}>
              <button
                type="button"
                className="daw-press daw-sink"
                onClick={() => {
                  haptic(10);
                  onNueva();
                }}
                style={{ ...pildora, background: T.text, color: T.inverse, boxShadow: T.elev1 }}
              >
                <Plus size={16} weight="bold" aria-hidden />
                Nueva idea
              </button>
              <button type="button" className="daw-press daw-hover" onClick={() => entrada.current?.click()} style={{ ...pildora, background: T.raised, color: T.text, boxShadow: T.elev1 }}>
                <UploadSimple size={16} aria-hidden />
                Importar audio
              </button>
            </div>
          </div>

          <div role="group" aria-label="Empezar con" className="daw-inicio-accesos">
            {ACCESOS.map((acceso) => (
              <button
                key={acceso.id}
                type="button"
                className="daw-press daw-tarjeta"
                onClick={() => {
                  haptic(10);
                  onAcceso(acceso.id);
                }}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                  minHeight: 108,
                  padding: '14px 8px',
                  border: 'none',
                  borderRadius: 16,
                  background: T.raised,
                  boxShadow: T.elev1,
                  color: T.text,
                  cursor: 'pointer',
                }}
              >
                {acceso.id === 'voz' ? (
                  <Microphone size={34} weight="duotone" color={T.text} aria-hidden />
                ) : (
                  <IconoDeFamilia familia={acceso.id as IconoFamilia} size={34} color={T.text} />
                )}
                <span style={{ fontFamily: T.fontBody, fontSize: 13.5, fontWeight: 500, letterSpacing: '-0.005em' }}>{acceso.nombre}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Las ideas. */}
        <section aria-labelledby="titulo-ideas">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
            <h2 id="titulo-ideas" style={{ flex: '1 1 auto', fontFamily: T.fontBody, fontSize: 22, fontWeight: 650, letterSpacing: '-0.025em', color: T.text }}>
              Tus ideas
            </h2>
            <label className="daw-inicio-buscar" style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <MagnifyingGlass size={16} color={T.faint} aria-hidden style={{ position: 'absolute', left: 12, pointerEvents: 'none' }} />
              <input
                type="search"
                value={busqueda}
                onChange={(event) => setBusqueda(event.target.value)}
                placeholder="Buscar ideas"
                aria-label="Buscar ideas"
                style={{
                  width: '100%',
                  height: 38,
                  padding: '0 14px 0 36px',
                  border: 'none',
                  borderRadius: 19,
                  background: T.raised,
                  boxShadow: T.elev1,
                  color: T.text,
                  fontFamily: T.fontBody,
                  // 16 px: con menos, iOS hace zoom al enfocar.
                  fontSize: 16,
                  outline: 'none',
                }}
              />
            </label>
            <select
              value={orden}
              onChange={(event) => setOrden(event.target.value as 'recientes' | 'nombre')}
              aria-label="Ordenar"
              style={{
                height: 38,
                padding: '0 12px',
                border: 'none',
                borderRadius: 19,
                background: T.raised,
                boxShadow: T.elev1,
                color: T.text,
                fontFamily: T.fontBody,
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              <option value="recientes">Recientes</option>
              <option value="nombre">Por nombre</option>
            </select>
          </div>

          {ideas === null ? (
            <div className="daw-inicio-rejilla" aria-busy>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} style={{ height: 128, borderRadius: 16, background: T.fill }} />
              ))}
            </div>
          ) : visibles.length === 0 ? (
            <p style={{ ...hintText, fontSize: 15, padding: '24px 0' }}>
              {ideas.length === 0
                ? 'Todavía no hay ideas. Empieza una con «Nueva idea» o toca un instrumento de arriba.'
                : `Ninguna idea se llama «${busqueda.trim()}».`}
            </p>
          ) : (
            <ul className="daw-inicio-rejilla" style={{ listStyle: 'none', padding: 0 }}>
              {visibles.map((idea) => (
                <li key={idea.id} style={{ position: 'relative' }}>
                  <TarjetaIdea idea={idea} abierta={idea.id === studio.project.id} tema={tema} ahora={ahora} onAbrir={() => onAbrirIdea(idea.id)} onMas={() => setMenuDe(idea.id)} />
                  {menuDe === idea.id ? (
                    <>
                      <div aria-hidden onPointerDown={() => setMenuDe(null)} style={{ position: 'fixed', inset: 0, zIndex: 1 }} />
                      <PanelDeMenu
                        etiqueta={`Opciones de ${idea.name}`}
                        onCerrar={() => setMenuDe(null)}
                        entradas={[
                          { tipo: 'item', clave: 'abrir', texto: 'Abrir', alElegir: () => onAbrirIdea(idea.id) },
                          { tipo: 'separador', clave: 's' },
                          {
                            tipo: 'item',
                            clave: 'borrar',
                            texto: 'Borrar idea…',
                            peligro: true,
                            alElegir: () => archivo.pedirBorrado(idea),
                          },
                        ]}
                        style={{ position: 'absolute', right: 8, top: 'calc(100% - 40px)', zIndex: 2, minWidth: 200 }}
                      />
                    </>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <input
        ref={entrada}
        type="file"
        accept="audio/*,.m4a,.mp3,.wav,.aac,.caf,.aiff,.ogg"
        aria-hidden
        tabIndex={-1}
        style={{ display: 'none' }}
        onChange={(event) => {
          const fichero = event.target.files?.[0];
          if (fichero) onImportar(fichero);
          event.target.value = '';
        }}
      />

      <style>{`
        .daw-inicio-titulo { font-size: 34px; }
        .daw-inicio-accesos { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin-top: 28px; }
        .daw-inicio-rejilla { display: grid; grid-template-columns: repeat(auto-fill, minmax(158px, 1fr)); gap: 12px; }
        .daw-inicio-buscar { flex: 1 1 100%; order: 3; }
        .daw-tarjeta { transition: transform 160ms ${T.easeOut}, box-shadow 200ms ${T.easeOut}; }
        @media (hover: hover) { .daw-tarjeta:hover { box-shadow: ${T.elev2} !important; } }
        @media (min-width: 720px) {
          .daw-inicio-buscar { flex: 0 1 240px; order: 0; }
          .daw-inicio-rejilla { grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; }
        }
        @media (min-width: 1024px) {
          .daw-inicio-cabeza { display: grid; grid-template-columns: minmax(280px, 1fr) minmax(0, 2fr); gap: 40px; align-items: center; }
          .daw-inicio-titulo { font-size: 46px; }
          .daw-inicio-accesos { grid-template-columns: repeat(6, minmax(0, 1fr)); margin-top: 0; }
        }
      `}</style>
    </div>
  );
}

const pildora: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  height: 44,
  padding: '0 18px 0 16px',
  border: 'none',
  borderRadius: 22,
  fontFamily: T.fontBody,
  fontSize: 15,
  fontWeight: 600,
  letterSpacing: '-0.01em',
  whiteSpace: 'nowrap',
  cursor: 'pointer',
};

const botonFantasma: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  height: 40,
  padding: '0 12px',
  border: 'none',
  borderRadius: 10,
  background: 'transparent',
  color: T.text,
  fontFamily: T.fontBody,
  fontSize: 14,
  fontWeight: 500,
  cursor: 'pointer',
};

/** Una idea: sus pistas como franjas de su color, el nombre y de qué va. */
function TarjetaIdea({
  idea,
  abierta,
  tema,
  ahora,
  onAbrir,
  onMas,
}: {
  idea: Project;
  abierta: boolean;
  tema: 'light' | 'dark';
  ahora: number;
  onAbrir: () => void;
  onMas: () => void;
}) {
  const pistas = idea.tracks.length;
  const franjas = Math.min(4, pistas);
  return (
    <div className="daw-tarjeta" style={{ position: 'relative', borderRadius: 16, background: T.raised, boxShadow: T.elev1 }}>
      <button
        type="button"
        className="daw-press"
        onClick={() => {
          haptic(8);
          onAbrir();
        }}
        aria-label={`Abrir ${idea.name}`}
        style={{ display: 'block', width: '100%', padding: 14, paddingRight: 14, border: 'none', borderRadius: 16, background: 'transparent', textAlign: 'left', cursor: 'pointer' }}
      >
        <span aria-hidden style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 14 }}>
          {franjas === 0
            ? [0, 1, 2].map((i) => <span key={i} style={{ height: 6, borderRadius: 3, background: T.fill, width: `${90 - i * 22}%` }} />)
            : idea.tracks.slice(0, 4).map((pista, i) => (
                <span
                  key={pista.id}
                  style={{
                    height: 6,
                    borderRadius: 3,
                    background: trackTint(i, tema),
                    opacity: pista.muted ? 0.3 : 0.75,
                    // Cada franja empieza donde empieza la pista: la forma de la idea.
                    marginLeft: `${Math.min(40, (pista.clip.start / Math.max(1, ...idea.tracks.map((t) => t.clip.start + t.clip.duration))) * 100)}%`,
                  }}
                />
              ))}
        </span>
        <span style={{ display: 'block', fontFamily: T.fontBody, fontSize: 14.5, fontWeight: 600, letterSpacing: '-0.01em', color: T.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', paddingRight: 28 }}>
          {idea.name}
        </span>
        <span style={{ ...label, display: 'block', marginTop: 3, fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', paddingRight: abierta ? 0 : 30 }}>
          {pistas === 0 ? 'Sin pistas' : `${pistas} ${pistas === 1 ? 'pista' : 'pistas'}`} · {idea.bpm} BPM · {haceCuanto(idea.updatedAt, ahora)}
        </span>
        {abierta ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 6, fontFamily: T.fontBody, fontSize: 12, fontWeight: 500, color: T.dim }}>
            <span aria-hidden style={{ width: 6, height: 6, borderRadius: 3, background: T.text }} />
            La última que abriste
          </span>
        ) : null}
      </button>
      <button
        type="button"
        className="daw-press daw-hover"
        onClick={onMas}
        aria-label={`Más opciones de ${idea.name}`}
        aria-haspopup="menu"
        style={{ position: 'absolute', right: 6, bottom: abierta ? 30 : 8, width: 36, height: 36, display: 'grid', placeItems: 'center', border: 'none', borderRadius: 10, background: 'transparent', color: T.dim, cursor: 'pointer' }}
      >
        <DotsThree size={20} weight="bold" />
      </button>
    </div>
  );
}
