'use client';

/**
 * Crear: una conversación corta que pregunta lo clave con chips y enseña la
 * receta y el precio antes de gastar. Sueño: docs/bolsillo/suenos/2-crear.jpg.
 * Sin caja en blanco: se empieza con ocasiones de un toque.
 */

import { useEffect, useRef, useState } from 'react';
import { ArrowUp, ArrowCounterClockwise } from '@phosphor-icons/react';
import { T, haptic } from '@/components/daw/theme';
import { useCrear } from '@/hooks/bolsillo/useCrear';
import { OCASIONES } from '@/lib/bolsillo/crear/conversacion';
import { useBolsillo } from '../contexto';
import { Aviso, BotonPrincipal, BotonSecundario, Cabecera, Chip, Tarjeta } from '../kit';

export function PantallaCrear() {
  const { biblioteca, cuenta, nav } = useBolsillo();
  const crear = useCrear(biblioteca, { hayCuenta: !!cuenta.usuario });
  const [texto, setTexto] = useState('');
  const final = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    final.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [crear.mensajes.length, crear.receta, crear.plan]);

  const enviar = () => {
    if (!texto.trim()) return;
    crear.escribir(texto);
    setTexto('');
  };

  const hacer = async (boceto?: boolean) => {
    const destino = await crear.generar({ boceto });
    if (!destino) return;
    crear.reiniciar();
    nav.ir(destino.tipo === 'cancion' ? { tipo: 'cancion', id: destino.id } : { tipo: 'playlist', id: destino.id });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      <Cabecera
        titulo="Crear"
        subtitulo={crear.empezado ? undefined : 'Dime qué te apetece escuchar, o empieza por aquí.'}
        acciones={
          crear.empezado ? (
            <button
              type="button"
              className="daw-press"
              onClick={crear.reiniciar}
              aria-label="Empezar de nuevo"
              style={{ appearance: 'none', border: 'none', background: T.fill, width: 44, height: 44, borderRadius: 22, display: 'grid', placeItems: 'center', cursor: 'pointer' }}
            >
              <ArrowCounterClockwise size={20} color={T.text} />
            </button>
          ) : undefined
        }
      />

      {!crear.empezado ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
          {OCASIONES.map((o) => (
            <button
              key={o.id}
              type="button"
              className="daw-press"
              onClick={() => {
                haptic(6);
                crear.escribir(o.frase, o.quiere, o.quiere === 'playlist' ? o.etiqueta : undefined);
              }}
              style={{
                appearance: 'none',
                border: 'none',
                textAlign: 'left',
                padding: '14px 14px',
                minHeight: 72,
                borderRadius: 16,
                background: T.surface,
                boxShadow: T.elev1,
                color: T.text,
                fontSize: 15,
                fontWeight: 550,
                lineHeight: 1.3,
                cursor: 'pointer',
              }}
            >
              {o.etiqueta}
              <span style={{ display: 'block', marginTop: 4, fontSize: 13, fontWeight: 400, color: T.faint }}>
                {o.quiere === 'playlist' ? 'Playlist' : o.quiere === 'paisaje' ? 'Larga, en bucle · gratis de alargar' : 'Una canción'}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {crear.mensajes.map((m) =>
            m.de === 'aura' ? (
              <p key={m.id} style={{ fontSize: 17, lineHeight: 1.4, color: T.text, maxWidth: '85%' }}>
                {m.texto}
              </p>
            ) : (
              <p
                key={m.id}
                style={{
                  alignSelf: 'flex-end',
                  maxWidth: '82%',
                  padding: '10px 14px',
                  borderRadius: '18px 18px 6px 18px',
                  background: T.fillStrong,
                  fontSize: 16,
                  lineHeight: 1.35,
                }}
              >
                {m.texto}
              </p>
            ),
          )}

          {crear.pregunta ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {crear.pregunta.opciones.map((o) => (
                <Chip key={o.valor} onClick={() => crear.responder(o.valor, o.etiqueta)}>
                  {o.etiqueta}
                </Chip>
              ))}
            </div>
          ) : null}

          {crear.receta ? (
            <Tarjeta style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p style={{ fontSize: 16, lineHeight: 1.45 }}>{crear.resumen}</p>
              {crear.receta.capas?.tono && crear.receta.capas.tono.hz < 200 ? (
                <p style={{ fontSize: 13, color: T.dim }}>El altavoz del móvil casi no da {crear.receta.capas.tono.hz} Hz: mejor con auriculares.</p>
              ) : null}
              <BotonPrincipal creditos={crear.creditos} onClick={() => void hacer()} disabled={crear.fase === 'generando'}>
                {crear.fase === 'generando' ? (crear.avance ?? 'Un momento') : 'Hazla'}
              </BotonPrincipal>
              {crear.receta.tipo === 'cancion' ? (
                <BotonSecundario full creditos={crear.creditosBoceto} onClick={() => void hacer(true)} disabled={crear.fase === 'generando'}>
                  Primero 30 segundos
                </BotonSecundario>
              ) : null}
            </Tarjeta>
          ) : null}

          {crear.plan ? (
            <Tarjeta style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <p style={{ fontSize: 17, fontWeight: 650 }}>{crear.plan.nombre}</p>
                <p style={{ fontSize: 14, color: T.dim, marginTop: 2 }}>{crear.plan.porque}</p>
              </div>
              <ol style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {crear.plan.entradas.map((e, i) => (
                  <li key={i} style={{ display: 'flex', gap: 10 }}>
                    <span style={{ width: 20, color: T.faint, fontVariantNumeric: 'tabular-nums' }}>{i + 1}</span>
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 15, fontWeight: 550 }}>{e.titulo}</span>
                      <span style={{ display: 'block', fontSize: 13, color: T.dim }}>{e.porque}</span>
                    </span>
                  </li>
                ))}
              </ol>
              <BotonPrincipal creditos={crear.creditos} onClick={() => void hacer()} disabled={crear.fase === 'generando'}>
                Hazla
              </BotonPrincipal>
            </Tarjeta>
          ) : null}

          {crear.error ? (
            <Aviso>
              {crear.error}
              {!cuenta.usuario && cuenta.hayNube ? (
                <div style={{ marginTop: 10 }}>
                  <BotonSecundario onClick={() => nav.ir({ tipo: 'cuenta' })}>Entrar con mi cuenta de aura</BotonSecundario>
                </div>
              ) : null}
            </Aviso>
          ) : null}
          {crear.falso ? <p style={{ fontSize: 12, color: T.faint }}>Modo de prueba: suena en el móvil y no gasta créditos.</p> : null}
          <div ref={final} />
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          enviar();
        }}
        style={{
          position: 'sticky',
          bottom: 0,
          marginTop: 'auto',
          paddingTop: 16,
          background: `linear-gradient(to bottom, transparent, ${T.bg} 30%)`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 6, paddingLeft: 16, borderRadius: 26, background: T.surface, boxShadow: T.elev2 }}>
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Escribe o elige"
            aria-label="Qué quieres escuchar"
            enterKeyHint="send"
            style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', fontSize: 16, height: 40 }}
          />
          <button
            type="submit"
            aria-label="Enviar"
            disabled={!texto.trim()}
            className="daw-press"
            style={{
              appearance: 'none',
              border: 'none',
              width: 40,
              height: 40,
              borderRadius: 20,
              display: 'grid',
              placeItems: 'center',
              background: texto.trim() ? T.text : T.fill,
              cursor: texto.trim() ? 'pointer' : 'default',
            }}
          >
            <ArrowUp size={20} weight="bold" color={texto.trim() ? 'currentColor' : T.faint} style={{ color: texto.trim() ? T.inverse : undefined }} />
          </button>
        </div>
      </form>
    </div>
  );
}
