'use client';

/**
 * Una canción con sus versiones: se retoca hasta que te gusta y se guarda con
 * «Me la quedo». Sueño: docs/bolsillo/suenos/3-cancion.jpg.
 * Cada retoque dice su precio; «Con <motor>» es otro retoque: así se mezclan
 * los motores en la misma canción.
 */

import { useState } from 'react';
import { Pause, Play, Mountains, Trash } from '@phosphor-icons/react';
import { T, haptic } from '@/components/daw/theme';
import { generarCancion } from '@/lib/bolsillo/crear/generar';
import { nombreDeMotor, retoquesDe } from '@/lib/bolsillo/crear/retoques';
import { usaMotorFalso } from '@/lib/bolsillo/motor/motores';
import { textoCreditos } from '@/lib/bolsillo/precios';
import { useBolsillo } from '../contexto';
import { Aviso, BotonPrincipal, BotonSecundario, Cabecera, Chip, Portada, Seccion, Vacio } from '../kit';

export function PantallaCancion({ id }: { id: string }) {
  const { biblioteca, reproductor, cuenta, nav } = useBolsillo();
  const cancion = biblioteca.cancion(id);
  const versiones = biblioteca.versionesDe(id);
  const suena = cancion ? biblioteca.versionQueSuena(cancion) : null;
  const [vista, setVista] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [borrar, setBorrar] = useState(false);

  if (!cancion) return <Vacio texto="Esta canción ya no está." accion={<BotonSecundario onClick={nav.atras}>Volver</BotonSecundario>} />;

  const elegida = versiones.find((v) => v.id === (vista ?? suena?.id)) ?? suena ?? versiones[versiones.length - 1];
  const estaSonando = reproductor.actual?.version.id === elegida?.id && reproductor.sonando;
  const falso = usaMotorFalso();
  const retoques = elegida ? retoquesDe(elegida.receta, { falso }) : [];
  const generando = versiones.some((v) => v.estado === 'generando');

  const retocar = async (retoqueId: string) => {
    const r = retoques.find((x) => x.id === retoqueId);
    if (!r) return;
    if (!falso && !cuenta.usuario) {
      setError('Entra con tu cuenta de aura para retocarla: cada versión se paga con tus créditos.');
      return;
    }
    setOcupado(r.etiqueta);
    setError(null);
    try {
      const hecho = await generarCancion(r.receta, { titulo: cancion.titulo, cancionId: cancion.id, cambio: r.cambio });
      setVista(hecho.versionId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No ha salido. Prueba otra vez.');
    } finally {
      setOcupado(null);
    }
  };

  return (
    <>
      <Cabecera titulo="" onAtras={nav.atras} />
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: -8 }}>
        <Portada portada={cancion.portada} tam="min(72vw, 300px)" radio={20} titulo={cancion.titulo} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 20 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontSize: 28, fontWeight: 650, letterSpacing: '-0.03em', lineHeight: 1.1 }}>{cancion.titulo}</h1>
          {cancion.porque ? <p style={{ fontSize: 15, color: T.dim, marginTop: 6 }}>{cancion.porque}</p> : null}
        </div>
        <button
          type="button"
          className="daw-press daw-sink"
          disabled={!elegida || elegida.estado !== 'lista'}
          aria-label={estaSonando ? 'Pausar' : 'Tocar'}
          onClick={() => {
            haptic(8);
            if (estaSonando) reproductor.pausar();
            else if (elegida) void reproductor.tocar(cancion.id, { versionId: elegida.id });
          }}
          style={{ appearance: 'none', border: 'none', width: 64, height: 64, borderRadius: 32, background: T.text, display: 'grid', placeItems: 'center', boxShadow: T.elev2, cursor: 'pointer', opacity: elegida?.estado === 'lista' ? 1 : 0.4 }}
        >
          {estaSonando ? <Pause size={26} weight="fill" color="currentColor" style={{ color: T.inverse }} /> : <Play size={26} weight="fill" style={{ color: T.inverse }} />}
        </button>
      </div>

      {versiones.length ? (
        <div style={{ marginTop: 18, padding: 6, borderRadius: 18, background: T.surface, boxShadow: T.elev1 }}>
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto' }}>
            {versiones.map((v) => {
              const activa = v.id === elegida?.id;
              return (
                <button
                  key={v.id}
                  type="button"
                  className="daw-press"
                  onClick={() => setVista(v.id)}
                  style={{
                    appearance: 'none',
                    border: 'none',
                    flex: '1 0 64px',
                    minHeight: 44,
                    borderRadius: 14,
                    background: activa ? T.fillStrong : 'transparent',
                    fontWeight: activa ? 650 : 500,
                    color: v.estado === 'fallo' ? T.faint : T.text,
                    cursor: 'pointer',
                  }}
                >
                  v{v.n}
                  {v.estado === 'generando' ? <span className="daw-blink" style={{ color: T.ai }}> ·</span> : null}
                </button>
              );
            })}
          </div>
          {elegida ? (
            <p style={{ textAlign: 'center', fontSize: 13, color: T.dim, padding: '6px 4px 2px' }}>
              {elegida.estado === 'generando' ? 'Se está haciendo…' : elegida.estado === 'fallo' ? (elegida.error ?? 'No salió') : elegida.cambio}
              {elegida.estado === 'lista' ? ` · ${nombreDeMotor(elegida.motor)} · ${textoCreditos(elegida.creditos)}` : ''}
            </p>
          ) : null}
        </div>
      ) : null}

      <Seccion titulo="Retócala">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {retoques.map((r) => (
            <Chip key={r.id} disabled={!!ocupado || generando} onClick={() => void retocar(r.id)}>
              {r.etiqueta}
              <span style={{ color: T.faint, fontWeight: 400 }}>· {r.creditos || 'Gratis'}</span>
            </Chip>
          ))}
          <Chip onClick={() => nav.ir({ tipo: 'paisaje', cancionId: cancion.id })}>
            <Mountains size={16} /> Más larga <span style={{ color: T.faint, fontWeight: 400 }}>· Gratis</span>
          </Chip>
        </div>
        {ocupado ? <p style={{ fontSize: 14, color: T.dim }}>Haciendo «{ocupado}»…</p> : null}
        {error ? <Aviso>{error}</Aviso> : null}
      </Seccion>

      {elegida?.letra ? (
        <Seccion titulo="Letra">
          <p style={{ whiteSpace: 'pre-wrap', fontSize: 15, lineHeight: 1.6, color: T.dim }}>{elegida.letra}</p>
        </Seccion>
      ) : null}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 28 }}>
        {elegida?.estado === 'lista' && (!cancion.guardada || cancion.versionElegida !== elegida.id) ? (
          <BotonPrincipal onClick={() => void biblioteca.quedarme(cancion.id, elegida.id)}>
            {cancion.guardada ? `Quedarme con la v${elegida.n}` : 'Me la quedo'}
          </BotonPrincipal>
        ) : cancion.guardada ? (
          <p style={{ textAlign: 'center', fontSize: 14, color: T.dim }}>Está en tu biblioteca.</p>
        ) : null}
        {borrar ? (
          <div style={{ display: 'flex', gap: 8 }}>
            <BotonSecundario full onClick={() => setBorrar(false)}>
              No
            </BotonSecundario>
            <BotonSecundario
              full
              onClick={async () => {
                await biblioteca.borrarCancion(cancion.id);
                nav.atras();
              }}
            >
              Sí, bórrala
            </BotonSecundario>
          </div>
        ) : (
          <BotonSecundario onClick={() => setBorrar(true)}>
            <Trash size={18} /> Borrar
          </BotonSecundario>
        )}
      </div>
    </>
  );
}
