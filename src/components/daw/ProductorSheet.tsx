'use client';

/**
 * La hoja del productor.
 *
 * Arriba la conversación, abajo la caja para pedir, siempre a mano del
 * pulgar. Cada respuesta enseña su plan paso a paso mientras se hace, para
 * que nunca haya una espera sin saber qué está pasando. Lo que el productor
 * apunta de ti se ve y se borra aquí mismo.
 *
 * Verde = Aura: el verde marca lo que hace la máquina, igual que en la línea
 * de tiempo. El rojo sigue siendo solo «grabando».
 */

import { useEffect, useRef, useState } from 'react';
import type { Studio } from '@/hooks/useStudio';
import type { Musico, Paso as PasoDelMusico } from '@/hooks/useMusico';
import { tomaObjetivo, type EstadoPaso, type Productor, type Turno } from '@/hooks/useProductor';
import { comprobarCodigo, guardarCodigo, leerCodigo } from '@/lib/acceso';
import { sugerenciasDelCerebro } from '@/lib/productor/cerebro';
import { tituloDelPaso } from '@/lib/productor/plan';
import { haptic } from './theme';
import { IconSend, IconSpark, Sheet, T, TextButton, hintText, label } from './ui';

const TRABAJANDO: Record<PasoDelMusico, string> = {
  mandando: 'Mandando tu toma',
  'en-cola': 'Esperando turno en la GPU',
  generando: 'Tocando',
  bajando: 'Bajando la pista',
  cuadrando: 'Cuadrándola a tu pulso',
};

export function ProductorSheet({
  studio,
  musico,
  productor,
  open,
  onClose,
}: {
  studio: Studio;
  musico: Musico;
  productor: Productor;
  open: boolean;
  onClose: () => void;
}) {
  const { turnos, cerebro, ocupado, necesitaCodigo, pedir, olvidar, olvidarTodo, codigoGuardado } = productor;
  const [texto, setTexto] = useState('');
  const [verCerebro, setVerCerebro] = useState(false);
  const finalRef = useRef<HTMLDivElement | null>(null);

  const sinClave = musico.ia !== null && !musico.ia.productor;
  const pideCodigo = necesitaCodigo || (Boolean(musico.ia?.candado) && !leerCodigo());

  // Lo último que ha pasado, siempre a la vista.
  const ultimo = turnos[turnos.length - 1];
  useEffect(() => {
    if (open) finalRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [open, turnos.length, ultimo?.estado, ultimo?.pasos]);

  const toma = tomaObjetivo(studio);
  const sugerencias =
    ultimo?.sugerencias.length && ultimo.estado === 'listo'
      ? ultimo.sugerencias
      : turnos.length === 0
        ? sugerenciasDelCerebro(cerebro, {
            hayToma: Boolean(toma),
            pistas: studio.project.tracks.length,
            nombresDePistas: studio.project.tracks.map((t) => t.name),
          })
        : [];

  const mandar = (pedido: string) => {
    if (!pedido.trim() || ocupado || sinClave || pideCodigo) return;
    haptic(10);
    setTexto('');
    void pedir(pedido);
  };

  return (
    <Sheet open={open} title="Productor" onClose={onClose}>
      {sinClave ? (
        <Aviso titulo="Al productor le falta su clave">
          Piensa con Claude, y la clave de Anthropic tiene que estar en el servidor (ANTHROPIC_API_KEY). Mientras
          tanto, el músico de siempre sigue en «Ponle algo debajo».
        </Aviso>
      ) : null}

      {pideCodigo && !sinClave ? <PedirCodigo onGuardado={codigoGuardado} /> : null}

      {turnos.length === 0 && !sinClave ? (
        <div style={{ padding: '4px 0 20px' }}>
          <p
            style={{
              fontFamily: T.fontBody,
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: '-0.025em',
              lineHeight: 1.2,
              color: T.text,
              margin: '0 0 8px',
              textWrap: 'balance',
            }}
          >
            ¿Qué le ponemos?
          </p>
          <p style={{ ...hintText, fontSize: 14 }}>
            {toma
              ? `Toco sobre «${toma.name}». Pídeme instrumentos, estilos o una canción entera.`
              : 'Pídeme una canción entera, o graba una toma y le pongo lo que quieras debajo.'}
          </p>
        </div>
      ) : null}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {turnos.map((turno) => (
          <TurnoVista key={turno.id} turno={turno} trabajando={musico.paso} avisoMusico={musico.error} />
        ))}
      </div>

      {sugerencias.length && !ocupado && !sinClave ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: turnos.length ? 20 : 0 }}>
          {sugerencias.map((s) => (
            <button
              key={s}
              type="button"
              className="daw-press daw-hover"
              onClick={() => mandar(s)}
              disabled={pideCodigo}
              style={{
                minHeight: 40,
                padding: '8px 14px',
                border: 'none',
                borderRadius: 999,
                background: T.fill,
                boxShadow: `inset 0 0 0 1px ${T.border}`,
                color: T.text,
                fontFamily: T.fontBody,
                fontSize: 14,
                fontWeight: 500,
                textAlign: 'left',
                cursor: 'pointer',
                touchAction: 'manipulation',
              }}
            >
              {s}
            </button>
          ))}
        </div>
      ) : null}

      {/* La caja para pedir: pegada abajo mientras la conversación crece. */}
      <div
        ref={finalRef}
        style={{
          position: 'sticky',
          bottom: 0,
          marginTop: 20,
          paddingTop: 12,
          paddingBottom: 4,
          background: T.sheet,
          boxShadow: `0 -1px 0 ${T.rowLine}`,
        }}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            mandar(texto);
          }}
          style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}
        >
          <label htmlFor="pedido-productor" style={visualmenteOculto}>
            Tu pedido al productor
          </label>
          <textarea
            id="pedido-productor"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                mandar(texto);
              }
            }}
            rows={1}
            maxLength={600}
            disabled={sinClave}
            placeholder={ocupado ? 'Estoy en ello…' : 'Ponle un bajo funky y una batería'}
            style={{
              flex: 1,
              minHeight: 48,
              maxHeight: 140,
              resize: 'none',
              padding: '13px 14px',
              border: 'none',
              borderRadius: 14,
              background: T.fill,
              boxShadow: `inset 0 0 0 1px ${T.border}`,
              color: T.text,
              // 16 px: con menos, Safari en iPhone acerca la página al escribir.
              fontFamily: T.fontBody,
              fontSize: 16,
              lineHeight: 1.35,
              outline: 'none',
              fieldSizing: 'content',
            } as React.CSSProperties}
          />
          <button
            type="submit"
            aria-label="Pedírselo al productor"
            className="daw-press"
            disabled={!texto.trim() || ocupado || sinClave || pideCodigo}
            style={{
              width: 48,
              height: 48,
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: 'none',
              borderRadius: 14,
              background: T.ai,
              boxShadow: T.elev1,
              opacity: !texto.trim() || ocupado || sinClave || pideCodigo ? 0.35 : 1,
              cursor: 'pointer',
              touchAction: 'manipulation',
              transition: `opacity 160ms ${T.easeOut}`,
            }}
          >
            <IconSend size={20} color={T.inverse} />
          </button>
        </form>

        <button
          type="button"
          onClick={() => setVerCerebro((v) => !v)}
          aria-expanded={verCerebro}
          style={{
            marginTop: 10,
            padding: '6px 2px',
            border: 'none',
            background: 'transparent',
            color: T.dim,
            fontFamily: T.fontBody,
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          {verCerebro ? 'Ocultar lo que sé de ti' : `Lo que sé de ti${cerebro.notas.length ? ` (${cerebro.notas.length})` : ''}`}
        </button>
        {verCerebro ? <CerebroVista cerebro={cerebro} olvidar={olvidar} olvidarTodo={olvidarTodo} /> : null}
      </div>
    </Sheet>
  );
}

function TurnoVista({
  turno,
  trabajando,
  avisoMusico,
}: {
  turno: Turno;
  trabajando: PasoDelMusico | null;
  avisoMusico: string | null;
}) {
  const algunoFalla = turno.pasos.some((p) => p.estado === 'fallo');
  return (
    <article style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <p
        style={{
          alignSelf: 'flex-end',
          maxWidth: '85%',
          margin: 0,
          padding: '10px 14px',
          borderRadius: '16px 16px 4px 16px',
          background: T.fillStrong,
          color: T.text,
          fontFamily: T.fontBody,
          fontSize: 15,
          lineHeight: 1.4,
        }}
      >
        {turno.pedido}
      </p>

      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <span
          aria-hidden
          style={{
            width: 28,
            height: 28,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 9,
            background: T.aiSoft,
          }}
        >
          <IconSpark size={16} color={T.ai} />
        </span>
        <div style={{ flex: 1, minWidth: 0, paddingTop: 3 }}>
          {turno.estado === 'pensando' ? (
            <p role="status" style={{ ...hintText, fontSize: 15, margin: 0 }}>
              <span style={{ animation: 'daw-blink 1.4s ease-in-out infinite' }}>Pensándolo</span>
            </p>
          ) : null}
          {turno.respuesta ? (
            <p style={{ margin: 0, fontFamily: T.fontBody, fontSize: 15, lineHeight: 1.5, color: T.text }}>
              {turno.respuesta}
            </p>
          ) : null}
          {turno.error ? (
            <p role="alert" style={{ margin: 0, fontFamily: T.fontBody, fontSize: 15, lineHeight: 1.5, color: T.text }}>
              {turno.error}
            </p>
          ) : null}

          {turno.pasos.length ? (
            <ol style={{ listStyle: 'none', margin: '12px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
              {turno.pasos.map((p, i) => (
                <li key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '6px 0' }}>
                  <Marca estado={p.estado} />
                  <span style={{ minWidth: 0 }}>
                    <span
                      style={{
                        display: 'block',
                        fontFamily: T.fontBody,
                        fontSize: 14,
                        fontWeight: 600,
                        color: p.estado === 'saltado' ? T.dim : T.text,
                      }}
                    >
                      {tituloDelPaso(p.paso)}
                    </span>
                    <span style={{ ...label, display: 'block', marginTop: 2, fontSize: 13 }}>
                      {p.estado === 'haciendo' && trabajando ? TRABAJANDO[trabajando] : (p.nota ?? p.paso.porque)}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          ) : null}

          {algunoFalla && avisoMusico ? <p style={{ ...hintText, marginTop: 6 }}>{avisoMusico}</p> : null}

          {turno.aprendido.length ? (
            <p style={{ ...label, marginTop: 10, fontSize: 13, color: T.ai }}>
              Apuntado: {turno.aprendido.join(' · ')}
            </p>
          ) : null}
        </div>
      </div>
    </article>
  );
}

/** Cómo va cada paso, de un vistazo y sin depender solo del color. */
function Marca({ estado }: { estado: EstadoPaso }) {
  const base: React.CSSProperties = {
    width: 18,
    height: 18,
    flexShrink: 0,
    marginTop: 1,
    borderRadius: 9,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: T.fontBody,
    fontSize: 12,
    fontWeight: 700,
    lineHeight: 1,
  };
  if (estado === 'hecho') {
    return (
      <span aria-label="Hecho" style={{ ...base, background: T.ai, color: T.inverse }}>
        ✓
      </span>
    );
  }
  if (estado === 'haciendo') {
    return (
      <span
        aria-label="Haciéndolo"
        style={{ ...base, boxShadow: `inset 0 0 0 2px ${T.ai}`, animation: 'daw-blink 1.2s ease-in-out infinite' }}
      />
    );
  }
  if (estado === 'fallo') {
    return (
      <span aria-label="No ha salido" style={{ ...base, background: T.fillStrong, color: T.text }}>
        !
      </span>
    );
  }
  if (estado === 'saltado') {
    return (
      <span aria-label="Saltado" style={{ ...base, boxShadow: `inset 0 0 0 1.5px ${T.borderStrong}`, color: T.dim }}>
        –
      </span>
    );
  }
  return <span aria-label="Pendiente" style={{ ...base, boxShadow: `inset 0 0 0 1.5px ${T.borderStrong}` }} />;
}

function CerebroVista({
  cerebro,
  olvidar,
  olvidarTodo,
}: {
  cerebro: Productor['cerebro'];
  olvidar: (i: number) => void;
  olvidarTodo: () => void;
}) {
  const [confirmar, setConfirmar] = useState(false);
  const vacio = cerebro.notas.length === 0 && cerebro.pedidos.length === 0;
  return (
    <section style={{ marginTop: 6, paddingBottom: 8 }}>
      <p style={{ ...hintText, marginBottom: 10 }}>
        Se guarda solo en este móvil. Con cada pedido le mando al productor un resumen de unas líneas, nunca tu audio.
      </p>
      {vacio ? (
        <p style={{ ...hintText }}>Todavía no sé nada de ti. Pídeme cosas y voy apuntando lo que te gusta.</p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {cerebro.notas.map((n, i) => (
            <li
              key={`${n.texto}-${i}`}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', boxShadow: `inset 0 -1px 0 ${T.rowLine}` }}
            >
              <span style={{ flex: 1, fontFamily: T.fontBody, fontSize: 14, color: T.text }}>{n.texto}</span>
              <button
                type="button"
                onClick={() => olvidar(i)}
                aria-label={`Olvidar: ${n.texto}`}
                style={{
                  minWidth: 44,
                  minHeight: 36,
                  border: 'none',
                  borderRadius: 10,
                  background: 'transparent',
                  color: T.dim,
                  fontFamily: T.fontBody,
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                Olvidar
              </button>
            </li>
          ))}
        </ul>
      )}
      {!vacio ? (
        <div style={{ marginTop: 12 }}>
          {confirmar ? (
            <div style={{ display: 'flex', gap: 8 }}>
              <TextButton tone="danger" onClick={() => (olvidarTodo(), setConfirmar(false))}>
                Sí, olvídalo todo
              </TextButton>
              <TextButton onClick={() => setConfirmar(false)}>No</TextButton>
            </div>
          ) : (
            <TextButton onClick={() => setConfirmar(true)}>Olvidar todo</TextButton>
          )}
        </div>
      ) : null}
    </section>
  );
}

function PedirCodigo({ onGuardado }: { onGuardado: () => void }) {
  const [codigo, setCodigo] = useState('');
  const [estado, setEstado] = useState<'escribiendo' | 'comprobando' | 'no-vale' | 'sin-red'>('escribiendo');
  return (
    <Aviso titulo="Código de acceso">
      El mismo que pusiste en Vercel (AURA_MUSIC_CODIGO). Da igual mayúsculas o minúsculas. Se escribe una vez y se queda
      en este móvil.
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!codigo.trim() || estado === 'comprobando') return;
          // Se comprueba antes de guardar: así sabes al momento si es el bueno.
          setEstado('comprobando');
          const resultado = await comprobarCodigo(codigo);
          if (resultado !== 'vale') {
            setEstado(resultado);
            return;
          }
          guardarCodigo(codigo);
          setCodigo('');
          setEstado('escribiendo');
          onGuardado();
        }}
        style={{ display: 'flex', gap: 8, marginTop: 12 }}
      >
        {/* Texto y no contraseña: ves lo que escribes, y el iPhone no ofrece
            inventarse una «contraseña segura» ni pone la primera en mayúscula. */}
        <input
          type="text"
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="done"
          aria-label="Código de acceso"
          aria-invalid={estado === 'no-vale'}
          value={codigo}
          onChange={(e) => {
            setCodigo(e.target.value);
            if (estado !== 'comprobando') setEstado('escribiendo');
          }}
          style={{
            flex: 1,
            minWidth: 0,
            minHeight: 48,
            padding: '0 14px',
            border: 'none',
            borderRadius: 12,
            background: T.sheet,
            boxShadow: `inset 0 0 0 1px ${T.borderStrong}`,
            color: T.text,
            fontFamily: T.fontBody,
            fontSize: 16,
          }}
        />
        <button
          type="submit"
          className="daw-press"
          style={{
            minHeight: 48,
            padding: '0 18px',
            border: 'none',
            borderRadius: 12,
            background: T.text,
            color: T.inverse,
            fontFamily: T.fontBody,
            fontSize: 15,
            fontWeight: 500,
            cursor: 'pointer',
            touchAction: 'manipulation',
            opacity: estado === 'comprobando' ? 0.6 : 1,
          }}
        >
          {estado === 'comprobando' ? 'Comprobando' : 'Guardar'}
        </button>
      </form>
      {estado === 'no-vale' ? (
        <p role="alert" style={{ margin: '10px 0 0', fontFamily: T.fontBody, fontSize: 14, color: T.rec }}>
          Ese no es. Mira en Vercel, en Settings → Environment Variables, el valor de AURA_MUSIC_CODIGO. Si lo
          cambiaste allí después de desplegar, hay que volver a desplegar para que cuente.
        </p>
      ) : null}
      {estado === 'sin-red' ? (
        <p role="alert" style={{ margin: '10px 0 0', fontFamily: T.fontBody, fontSize: 14, color: T.text }}>
          No he podido comprobarlo: mira la conexión y vuelve a probar.
        </p>
      ) : null}
    </Aviso>
  );
}

function Aviso({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        marginBottom: 20,
        padding: '14px 16px',
        borderRadius: 14,
        background: T.fill,
        boxShadow: `inset 0 0 0 1px ${T.border}`,
      }}
    >
      <p style={{ margin: '0 0 4px', fontFamily: T.fontBody, fontSize: 15, fontWeight: 600, color: T.text }}>{titulo}</p>
      <div style={{ ...hintText, fontSize: 14 }}>{children}</div>
    </div>
  );
}

const visualmenteOculto: React.CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
  border: 0,
};
