'use client';

/**
 * Tu cuenta de Aura, en Ajustes, y el estado de la nube en la cabecera.
 *
 * Sin configuración de Firebase nada de esto se pinta (`nube.disponible`).
 *
 * Diseño: registro de producto y restringido (taste → impeccable →
 * emil-design-eng). Sin colores nuevos: en este estudio el rojo es grabar y
 * el verde es Aura tocando; la cuenta es gris como el resto de Ajustes. El
 * botón de Google lleva su «G» porque es como se reconoce ese botón en
 * cualquier sitio. El formulario del correo se abre en su sitio, sin modal.
 * Campos a 16 px para que el iPhone no haga zoom al tocarlos.
 */

import { useEffect, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import type { Nube } from '@/hooks/useNube';
import { textoDelEstado, textoDelIndicador } from '@/lib/nube/textos';
import type { EstadoNube } from '@/lib/nube/tipos';
import { inputStyle } from '@/components/daw/TrackPanel';
import { Field, T, TextButton, hintText, label } from '@/components/daw/ui';

/* -------------------------------------------------------------------------- */
/* Iconos (la misma familia que ui.tsx: trazo de 1,75 sobre 24)               */
/* -------------------------------------------------------------------------- */

const NUBE = 'M7.5 18.5h9.25a4.25 4.25 0 0 0 .55-8.46 5.75 5.75 0 0 0-11.2 1.12A3.7 3.7 0 0 0 7.5 18.5z';

function IconoNube({ fase, cambio, size = 16, color = T.dim }: { fase: EstadoNube['fase']; cambio: boolean; size?: number; color?: string }) {
  const trazo = { stroke: color, strokeWidth: 1.75, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden focusable={false}>
      <path d={NUBE} {...trazo} />
      {cambio ? (
        // Ha llegado algo: flecha hacia abajo.
        <path d="M12 11v4.5M10 13.6l2 1.9 2-1.9" {...trazo} />
      ) : fase === 'al-dia' ? (
        <path d="M9.6 13.4l1.7 1.7 3.2-3.3" {...trazo} />
      ) : fase === 'trabajando' ? (
        <path d="M12 15.8v-4.5M10 13.2l2-1.9 2 1.9" {...trazo} />
      ) : fase === 'sin-conexion' ? (
        <path d="M4 4l16 16" {...trazo} />
      ) : fase === 'error' ? (
        <path d="M12 11.2v2.6M12 16.1v.01" {...trazo} />
      ) : null}
    </svg>
  );
}

function GoogleG({ size = 18 }: { size?: number }) {
  // La «G» oficial de Google: sus cuatro colores son la marca del botón, no un acento de la app.
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden focusable={false}>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/* Cabecera: el estado, en un icono                                            */
/* -------------------------------------------------------------------------- */

/**
 * Va dentro del subtítulo de la cabecera («3 pistas · ☁»). No es un botón: la
 * cabecera entera ya abre Ajustes, donde está el detalle. Sin sesión no ocupa
 * sitio.
 */
export function IndicadorNube({ nube }: { nube: Nube }) {
  const { estado } = nube;
  if (!nube.disponible || !nube.usuario) return null;
  const texto = textoDelIndicador(estado);
  if (!texto) return null;
  const fuerte = estado.fase === 'error' || !!estado.cambioEnLaAbierta;
  return (
    <span
      role="img"
      aria-label={texto}
      title={texto}
      style={{ display: 'inline-flex', verticalAlign: '-3px', marginLeft: 6, transition: `opacity 200ms ${T.easeOut}` }}
    >
      <IconoNube fase={estado.fase} cambio={!!estado.cambioEnLaAbierta} size={15} color={fuerte ? T.text : T.dim} />
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Ajustes: «Esta idea ha cambiado en el PC»                                   */
/* -------------------------------------------------------------------------- */

const panel: CSSProperties = {
  padding: 16,
  borderRadius: 14,
  background: T.fill,
  boxShadow: `inset 0 1px 0 ${T.rim}`,
};

/** Arriba del todo en Ajustes, solo cuando hace falta decidir. */
export function AvisoCambioEnLaAbierta({ nube, onHecho }: { nube: Nube; onHecho?: () => void }) {
  const cambio = nube.estado.cambioEnLaAbierta;
  const [ocupado, setOcupado] = useState(false);
  if (!nube.disponible || !cambio) return null;
  const elegir = async (accion: () => Promise<void> | undefined) => {
    setOcupado(true);
    try {
      await accion();
      onHecho?.();
    } finally {
      setOcupado(false);
    }
  };
  return (
    <section aria-live="polite" className="daw-land" style={{ ...panel, marginBottom: 28 }}>
      <p style={{ fontFamily: T.fontBody, fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em', color: T.text, marginBottom: 4 }}>
        Esta idea ha cambiado en el {cambio.dispositivo}
      </p>
      <p style={{ ...hintText, marginBottom: 14 }}>
        Puedes cargar esa versión o seguir con la tuya. Si la que dejas tiene tomas que la otra no tiene, se guarda aparte como copia: no se pierde nada.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <TextButton full tone="solid" disabled={ocupado} onClick={() => void elegir(nube.cargarLaDeLaNube)}>
          Cargar la del {cambio.dispositivo}
        </TextButton>
        <TextButton full disabled={ocupado} onClick={() => void elegir(nube.quedarmeConLaMia)}>
          Seguir con la mía
        </TextButton>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Ajustes: la cuenta                                                          */
/* -------------------------------------------------------------------------- */

function Avatar({ nombre, foto }: { nombre: string; foto: string | null }) {
  const [rota, setRota] = useState(false);
  const inicial = nombre.trim().charAt(0).toUpperCase() || 'A';
  const caja: CSSProperties = {
    width: 40,
    height: 40,
    flexShrink: 0,
    borderRadius: '50%',
    overflow: 'hidden',
    background: T.fillStrong,
    boxShadow: `inset 0 0 0 1px ${T.border}`,
    display: 'grid',
    placeItems: 'center',
  };
  return (
    <span style={caja} aria-hidden>
      {foto && !rota ? (
        // La foto de Google; sin «referrer», que si no a veces no la sirve.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={foto} alt="" width={40} height={40} referrerPolicy="no-referrer" onError={() => setRota(true)} style={{ width: 40, height: 40, objectFit: 'cover' }} />
      ) : (
        <span style={{ fontFamily: T.fontBody, fontSize: 16, fontWeight: 600, color: T.text }}>{inicial}</span>
      )}
    </span>
  );
}

/** Reloj de un minuto para que «hace 3 min» no se quede quieto con Ajustes abierto. */
function useAhora(activo: boolean): number {
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    if (!activo) return;
    setAhora(Date.now());
    const id = window.setInterval(() => setAhora(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, [activo]);
  return ahora;
}

function Campo({ id, titulo, children }: { id: string; titulo: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label htmlFor={id} style={{ ...label, color: T.text, fontWeight: 600 }}>
        {titulo}
      </label>
      {children}
    </div>
  );
}

function FormularioCorreo({ nube, onCancelar }: { nube: Nube; onCancelar: () => void }) {
  const [correo, setCorreo] = useState('');
  const [clave, setClave] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const entrar = async (e: FormEvent) => {
    e.preventDefault();
    if (enviando) return;
    setError(null);
    setAviso(null);
    setEnviando(true);
    const fallo = await nube.entrarConCorreo(correo, clave);
    setEnviando(false);
    if (fallo) setError(fallo);
  };

  const recuperar = async () => {
    setError(null);
    setAviso(null);
    if (!correo.includes('@')) {
      setError('Escribe primero tu correo y vuelve a tocar aquí.');
      return;
    }
    const fallo = await nube.recuperarClave(correo);
    if (fallo) setError(fallo);
    else setAviso(`Te he mandado un correo a ${correo.trim()} para cambiar la contraseña.`);
  };

  return (
    // Sin caja propia: los campos ya tienen su relleno, y una caja gris con campos grises dentro es caja dentro de caja.
    <form onSubmit={(e) => void entrar(e)} className="daw-land" style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 12 }}>
      <Campo id="cuenta-correo" titulo="Correo">
        <input
          id="cuenta-correo"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          enterKeyHint="next"
          required
          value={correo}
          onChange={(e) => setCorreo(e.target.value)}
          style={inputStyle}
        />
      </Campo>
      <Campo id="cuenta-clave" titulo="Contraseña">
        <input
          id="cuenta-clave"
          type="password"
          autoComplete="current-password"
          enterKeyHint="go"
          required
          value={clave}
          onChange={(e) => setClave(e.target.value)}
          style={inputStyle}
        />
      </Campo>
      {error ? (
        <p role="alert" style={{ ...hintText, color: T.text }}>
          {error}
        </p>
      ) : null}
      {aviso ? (
        <p role="status" style={{ ...hintText, color: T.text }}>
          {aviso}
        </p>
      ) : null}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
        <button
          type="submit"
          className="daw-press"
          disabled={enviando}
          style={{
            minHeight: 48,
            border: 'none',
            borderRadius: 12,
            background: T.text,
            color: T.inverse,
            boxShadow: T.elev1,
            fontFamily: T.fontBody,
            fontSize: 15,
            fontWeight: 500,
            letterSpacing: '-0.01em',
            opacity: enviando ? 0.6 : 1,
            cursor: enviando ? 'default' : 'pointer',
          }}
        >
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>
        <TextButton onClick={onCancelar}>Cancelar</TextButton>
      </div>
      <button
        type="button"
        className="daw-press"
        onClick={() => void recuperar()}
        style={{
          alignSelf: 'flex-start',
          minHeight: 44,
          padding: 0,
          border: 'none',
          background: 'transparent',
          ...label,
          fontSize: 13,
          color: T.text,
          textDecoration: 'underline',
          textUnderlineOffset: 3,
          cursor: 'pointer',
        }}
      >
        He olvidado la contraseña
      </button>
    </form>
  );
}

/**
 * «Tu cuenta de Aura». Fuera: entrar con Google o con correo. Dentro: quién
 * eres, cómo va la nube y salir.
 */
export function CampoCuenta({ nube, abierto }: { nube: Nube; abierto: boolean }) {
  const [conCorreo, setConCorreo] = useState(false);
  const [entrando, setEntrando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ahora = useAhora(abierto && !!nube.usuario);

  useEffect(() => {
    if (nube.usuario) {
      setConCorreo(false);
      setError(null);
    }
  }, [nube.usuario]);

  if (!nube.disponible) return null;

  if (nube.comprobando) {
    return (
      <Field title="Tu cuenta de Aura">
        {/* Lo que ocupará la fila de la cuenta, en gris, mientras se recupera la sesión. */}
        <div aria-busy style={{ ...panel, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ width: 40, height: 40, borderRadius: '50%', background: T.fillStrong }} />
          <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ width: '45%', height: 12, borderRadius: 6, background: T.fillStrong }} />
            <span style={{ width: '70%', height: 10, borderRadius: 5, background: T.fill }} />
          </span>
        </div>
      </Field>
    );
  }

  if (!nube.usuario) {
    const conGoogle = async () => {
      setError(null);
      setEntrando(true);
      const fallo = await nube.entrarConGoogle();
      setEntrando(false);
      if (fallo) setError(fallo);
    };
    return (
      <Field
        title="Tu cuenta de Aura"
        intro="Entra con la misma cuenta que usas en Aura y tendrás tus ideas en el móvil y en el PC. Todo se sigue guardando primero aquí: sin red, grabas igual."
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            type="button"
            className="daw-press daw-hover"
            disabled={entrando}
            onClick={() => void conGoogle()}
            style={{
              minHeight: 48,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              border: 'none',
              borderRadius: 12,
              background: T.raised,
              boxShadow: `inset 0 0 0 1px ${T.borderStrong}, ${T.elev1}`,
              color: T.text,
              fontFamily: T.fontBody,
              fontSize: 15,
              fontWeight: 500,
              letterSpacing: '-0.01em',
              opacity: entrando ? 0.6 : 1,
              cursor: entrando ? 'default' : 'pointer',
            }}
          >
            <GoogleG />
            {entrando ? 'Abriendo Google…' : 'Entrar con Google'}
          </button>
          {conCorreo ? (
            <FormularioCorreo nube={nube} onCancelar={() => setConCorreo(false)} />
          ) : (
            <TextButton full onClick={() => setConCorreo(true)}>
              Entrar con correo y contraseña
            </TextButton>
          )}
          {error ? (
            <p role="alert" style={{ ...hintText, color: T.text, marginTop: 4 }}>
              {error}
            </p>
          ) : null}
        </div>
      </Field>
    );
  }

  const { usuario, estado } = nube;
  const nombre = usuario.nombre || usuario.correo || 'Tu cuenta';
  const linea = textoDelEstado(estado, ahora);
  return (
    <Field title="Tu cuenta de Aura">
      <div style={{ ...panel, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <Avatar nombre={nombre} foto={usuario.foto} />
          <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span
              style={{
                fontFamily: T.fontBody,
                fontSize: 15,
                fontWeight: 600,
                letterSpacing: '-0.01em',
                color: T.text,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {nombre}
            </span>
            {usuario.nombre && usuario.correo ? (
              <span style={{ ...label, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{usuario.correo}</span>
            ) : null}
          </span>
        </div>
        <div
          role="status"
          aria-live="polite"
          style={{ display: 'flex', alignItems: 'flex-start', gap: 8, paddingTop: 12, boxShadow: `inset 0 1px 0 ${T.rowLine}` }}
        >
          <span style={{ paddingTop: 1, flexShrink: 0 }}>
            <IconoNube fase={estado.fase} cambio={false} size={16} color={estado.fase === 'error' ? T.text : T.dim} />
          </span>
          <span style={{ ...hintText, color: estado.fase === 'error' ? T.text : T.dim }}>{linea}</span>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {estado.fase === 'error' || estado.fase === 'sin-conexion' ? (
            <TextButton onClick={nube.reintentar}>Reintentar</TextButton>
          ) : null}
          <TextButton onClick={() => void nube.salir()}>Salir</TextButton>
        </div>
      </div>
      <p style={{ ...hintText, marginTop: 10 }}>Al salir, tus ideas se quedan en este dispositivo.</p>
    </Field>
  );
}
