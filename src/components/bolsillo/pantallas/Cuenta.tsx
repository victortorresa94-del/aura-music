'use client';

/**
 * Tu cuenta: quién eres, cuántos créditos te quedan, recargar en aura Studio,
 * traerte tus canciones de Music Studio y salir.
 *
 * Sin cuenta se explica por qué hace falta (crear gasta créditos de tu
 * monedero de aura) y por qué no (escuchar lo que ya tienes en el móvil va sin
 * cuenta y sin red). Sin configuración de Firebase no hay cuenta que enseñar.
 *
 * Reglas de la casa: tokens `T.*`, el primario negro, nada de rojo ni de verde
 * de relleno; el botón de Google lleva su «G» en monocromo, sin colores de
 * marca encima de la interfaz.
 */

import { useState, type CSSProperties, type ReactNode } from 'react';
import { ArrowClockwise, ArrowSquareOut, CloudArrowDown, GoogleLogo, SignOut } from '@phosphor-icons/react';
import { T, haptic } from '@/components/daw/theme';
import { urlRecargar } from '@/lib/bolsillo/cuenta';
import { textoDelResultado } from '@/lib/bolsillo/importar/importar';
import { creditosDeBoceto, creditosDeReceta } from '@/lib/bolsillo/precios';
import type { CuentaBolsillo, UsuarioBolsillo } from '@/hooks/bolsillo/useCuentaBolsillo';
import { useBolsillo } from '../contexto';
import { Aviso, BotonPrincipal, BotonSecundario, Cabecera, Seccion, Tarjeta, Vacio } from '../kit';

const dim: CSSProperties = { fontSize: 15, color: T.dim, lineHeight: 1.45 };

function Avatar({ usuario }: { usuario: UsuarioBolsillo }) {
  const [rota, setRota] = useState(false);
  const nombre = usuario.nombre || usuario.correo || 'aura';
  const caja: CSSProperties = {
    width: 48,
    height: 48,
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
      {usuario.foto && !rota ? (
        // La foto de Google; sin «referrer», que si no a veces no la sirve.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={usuario.foto}
          alt=""
          width={48}
          height={48}
          referrerPolicy="no-referrer"
          onError={() => setRota(true)}
          style={{ width: 48, height: 48, objectFit: 'cover' }}
        />
      ) : (
        <span style={{ fontSize: 18, fontWeight: 600, color: T.text }}>{nombre.trim().charAt(0).toUpperCase()}</span>
      )}
    </span>
  );
}

/** Un enlace con la forma del botón secundario: se va a otra pestaña. */
function EnlaceSecundario({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="daw-press daw-hover"
      onClick={() => haptic(8)}
      style={{
        minHeight: 44,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: '0 16px',
        borderRadius: 12,
        background: T.fill,
        boxShadow: `inset 0 1px 0 ${T.rim}`,
        color: T.text,
        textDecoration: 'none',
        fontSize: 15,
        fontWeight: 500,
      }}
    >
      {children}
    </a>
  );
}

function ConIcono({ icono, children }: { icono: ReactNode; children: ReactNode }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      {icono}
      {children}
    </span>
  );
}

/* ── Sin cuenta ───────────────────────────────────────────────────────── */

function SinCuenta({ cuenta }: { cuenta: CuentaBolsillo }) {
  const [entrando, setEntrando] = useState(false);
  const entrar = async () => {
    setEntrando(true);
    try {
      await cuenta.entrarConGoogle();
    } finally {
      setEntrando(false);
    }
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Tarjeta style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <p style={{ fontSize: 17, fontWeight: 600, color: T.text, lineHeight: 1.35 }}>Para crear, tu cuenta de aura</p>
        <p style={dim}>
          Hacer una canción gasta créditos de tu monedero de aura, y por eso pide entrar. Escuchar lo que ya tienes en el
          móvil, no: suena sin cuenta y sin red.
        </p>
        <p style={dim}>Es la misma cuenta de aura Studio: tus créditos y tus canciones de allí vienen contigo.</p>
      </Tarjeta>
      <BotonPrincipal onClick={() => void entrar()} disabled={entrando}>
        <ConIcono icono={<GoogleLogo size={20} weight="bold" />}>{entrando ? 'Abriendo Google…' : 'Entrar con Google'}</ConIcono>
      </BotonPrincipal>
      {cuenta.error ? <Aviso>{cuenta.error}</Aviso> : null}
    </div>
  );
}

/* ── Con cuenta ───────────────────────────────────────────────────────── */

function frasePrincipal(saldo: number): string {
  if (saldo < 0) return saldo === -1 ? 'Debes 1 crédito' : `Debes ${-saldo} créditos`;
  return saldo === 1 ? 'Te queda 1 crédito' : `Te quedan ${saldo} créditos`;
}

function Creditos({ cuenta }: { cuenta: CuentaBolsillo }) {
  const d = cuenta.detalleSaldo ?? null;
  const grande: CSSProperties = { fontSize: 24, fontWeight: 650, letterSpacing: '-0.02em', color: T.text, fontVariantNumeric: 'tabular-nums' };

  let cuerpo: ReactNode;
  if (cuenta.sinCobro) {
    cuerpo = (
      <>
        <p style={grande}>Tu cuenta no paga</p>
        <p style={dim}>{d?.pagaCon ? `Gastas los créditos de ${d.pagaCon}, que no paga: crear no te descuenta nada.` : 'Crear no te descuenta nada.'}</p>
      </>
    );
  } else if (cuenta.saldo !== null) {
    const lineas: string[] = [];
    if (cuenta.saldo < 0) lineas.push('Se devolvió un pago que ya se había gastado. Hasta que recargues no se puede crear.');
    else if (d?.tarifa !== 'socio') {
      lineas.push(`Una canción entera son ${creditosDeReceta({ tipo: 'cancion', duracionSeg: 180, motor: 'lyria3' })}; un boceto de 30 s, ${creditosDeBoceto()}.`);
    }
    if (d?.plan) lineas.push(d.plan.estado === 'impago' ? `Tu plan ${d.plan.nombre} tiene un pago pendiente.` : `Con tu plan ${d.plan.nombre}.`);
    if (d?.pagaCon) lineas.push(`Son los de ${d.pagaCon}.`);
    if (d && d.dePrueba > 0) lineas.push(`Los ${d.dePrueba} de prueba que tienes en aura no valen para música.`);
    cuerpo = (
      <>
        <p style={grande}>{frasePrincipal(cuenta.saldo)}</p>
        {lineas.map((l) => (
          <p key={l} style={dim}>
            {l}
          </p>
        ))}
        {cuenta.avisoSaldo ? <p style={{ ...dim, fontSize: 14 }}>Puede no estar al día. {cuenta.avisoSaldo}</p> : null}
      </>
    );
  } else if (cuenta.avisoSaldo) {
    cuerpo = (
      <>
        <p style={{ ...dim, color: T.text }}>{cuenta.avisoSaldo}</p>
        <div>
          <BotonSecundario onClick={() => void cuenta.refrescarSaldo()} disabled={cuenta.leyendoSaldo}>
            <ConIcono icono={<ArrowClockwise size={18} />}>Volver a mirar</ConIcono>
          </BotonSecundario>
        </div>
      </>
    );
  } else {
    cuerpo = <p style={dim}>Mirando tus créditos…</p>;
  }

  return (
    <Seccion titulo="Tus créditos">
      <Tarjeta style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div role="status" aria-live="polite" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {cuerpo}
        </div>
      </Tarjeta>
      {!cuenta.sinCobro ? (
        <>
          <EnlaceSecundario href={urlRecargar()}>
            <ArrowSquareOut size={18} aria-hidden />
            Recargar en aura Studio
          </EnlaceSecundario>
          <p style={{ ...dim, fontSize: 14 }}>Se abre en otra pestaña. Recargar va con el plan: si no tienes uno, allí mismo lo coges.</p>
        </>
      ) : null}
    </Seccion>
  );
}

function Importar({ cuenta }: { cuenta: CuentaBolsillo }) {
  const { nav } = useBolsillo();
  const r = cuenta.importacion ?? null;
  const progreso = cuenta.progresoImportar ?? null;
  const texto = cuenta.importando
    ? progreso
      ? `Trayendo ${progreso.hechas} de ${progreso.total}…`
      : 'Mirando aura Studio…'
    : 'Traer mis canciones de aura Studio';
  return (
    <Seccion titulo="Tus canciones de aura Studio">
      <p style={dim}>Las que hiciste en Music Studio pasan a tu biblioteca y se guardan en el móvil para sonar sin red. Las que ya trajiste no se repiten.</p>
      <BotonSecundario full onClick={() => void cuenta.importarDeAuraStudio()} disabled={cuenta.importando}>
        <ConIcono icono={<CloudArrowDown size={20} />}>{texto}</ConIcono>
      </BotonSecundario>
      <div role="status" aria-live="polite">
        {r && !cuenta.importando ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-start' }}>
            <p style={{ ...dim, color: T.text }}>{textoDelResultado(r)}</p>
            {r.nuevas > 0 ? <BotonSecundario onClick={() => nav.pestana('biblioteca')}>Verlas en tu biblioteca</BotonSecundario> : null}
          </div>
        ) : null}
      </div>
    </Seccion>
  );
}

function ConCuenta({ cuenta, usuario }: { cuenta: CuentaBolsillo; usuario: UsuarioBolsillo }) {
  const [saliendo, setSaliendo] = useState(false);
  const nombre = usuario.nombre || usuario.correo || 'Tu cuenta';
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
        <Avatar usuario={usuario} />
        <span style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 17, fontWeight: 600, color: T.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {nombre}
          </span>
          {usuario.nombre && usuario.correo ? (
            <span style={{ fontSize: 14, color: T.dim, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{usuario.correo}</span>
          ) : null}
        </span>
      </div>

      <Creditos cuenta={cuenta} />
      <Importar cuenta={cuenta} />

      <Seccion titulo="Si tocas un instrumento">
        <p style={dim}>El estudio de aura Music graba lo que tocas y te pone una banda debajo, a tu tempo.</p>
        <a href="/" style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, color: T.text, fontWeight: 550 }}>
          Abrir el estudio
        </a>
      </Seccion>

      <Seccion titulo="Salir">
        <p style={dim}>Al salir, tus canciones se quedan en este móvil y siguen sonando.</p>
        <BotonSecundario
          full
          disabled={saliendo}
          onClick={() => {
            setSaliendo(true);
            void cuenta.salir().finally(() => setSaliendo(false));
          }}
        >
          <ConIcono icono={<SignOut size={20} />}>Salir</ConIcono>
        </BotonSecundario>
        {cuenta.error ? <Aviso>{cuenta.error}</Aviso> : null}
      </Seccion>
    </>
  );
}

/* ── La pantalla ──────────────────────────────────────────────────────── */

function Esqueleto() {
  return (
    <div aria-busy="true" aria-label="Mirando tu cuenta" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <span style={{ width: 48, height: 48, borderRadius: '50%', background: T.fillStrong }} />
      <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span style={{ width: '45%', height: 14, borderRadius: 7, background: T.fillStrong }} />
        <span style={{ width: '70%', height: 12, borderRadius: 6, background: T.fill }} />
      </span>
    </div>
  );
}

export function PantallaCuenta() {
  const { nav, cuenta } = useBolsillo();
  let cuerpo: ReactNode;
  if (!cuenta.hayNube) {
    cuerpo = <Vacio texto="Esta copia de aura Music no tiene cuenta. Lo que tienes en el móvil suena igual, con red y sin ella." />;
  } else if (cuenta.cargando) {
    cuerpo = <Esqueleto />;
  } else if (!cuenta.usuario) {
    cuerpo = <SinCuenta cuenta={cuenta} />;
  } else {
    cuerpo = <ConCuenta cuenta={cuenta} usuario={cuenta.usuario} />;
  }
  return (
    <>
      <Cabecera titulo="Tu cuenta" onAtras={nav.atras} />
      {cuerpo}
    </>
  );
}
