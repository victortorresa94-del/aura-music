'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { CaretLeft, CaretRight, SkipBack } from '@phosphor-icons/react';
import type { Instrumentos } from '@/hooks/useInstrumentos';
import type { Studio } from '@/hooks/useStudio';
import { getInstrumento } from '@/lib/instrumentos/registro';
import { bloquesDeAudio, compasAnterior, compasDe, compasesVisibles, notasEnVentana, paginaDe, plegar } from '@/lib/instrumentos/tira';
import type { InstrumentoId } from '@/lib/instrumentos/tipos';
import { haptic, T } from '../theme';

/** Lee un color del tema (`var(--daw-…)`) para pintarlo en el lienzo. */
function color(el: Element, token: string): string {
  const nombre = /var\((--[^,)]+)/.exec(token)?.[1];
  return (nombre && getComputedStyle(el).getPropertyValue(nombre).trim()) || '#888';
}

/**
 * La tira de tiempo de «Tocar»: dónde estás mientras tocas, grabas o
 * escuchas, sin salir al estudio. El dueño: «cuando grabo MIDI también
 * debería ver la barra de tiempo, poder echar pa' atrás».
 *
 * - Compases numerados, el cursor (rojo grabando), la zona del loop y, en
 *   pequeño, las notas: lo que estás grabando en tinta, lo del mismo
 *   instrumento en gris y lo demás atenuado; el audio, como una raya.
 * - Tocar o arrastrar lleva el cursor a ese compás, que es donde arranca
 *   «Grabar». Los botones van al principio y un compás atrás o adelante.
 *
 * El lienzo se pinta solo cuando cambia algo (y, grabando, unas ocho veces
 * por segundo para las notas nuevas); el cursor se mueve con rAF desde el
 * reloj del motor, sin pasar por React.
 */
export function TiraDeTiempo({
  studio,
  instrumentos,
  instrumento,
  bucleCompases,
}: {
  studio: Studio;
  instrumentos: Instrumentos;
  /** Lo que tienes abierto: sus pistas se ven más que las demás. */
  instrumento: InstrumentoId;
  /** Compases del modo loop (0: sin loop). */
  bucleCompases: number;
}) {
  const { engine, project } = studio;
  const { atril, estado, irA, bucleActual, pulsosPorCompas } = instrumentos;
  const grabando = estado !== 'libre';
  const pulso = 60 / Math.max(1, project.bpm);
  const compasSeg = pulso * pulsosPorCompas;

  const tiraRef = useRef<HTMLDivElement | null>(null);
  const lienzoRef = useRef<HTMLCanvasElement | null>(null);
  const cursorRef = useRef<HTMLSpanElement | null>(null);
  const [ancho, setAncho] = useState(240);
  const [pagina, setPagina] = useState(0);
  /** Mientras arrastras, el compás que señala el dedo (manda sobre el motor). */
  const arrastre = useRef<number | null>(null);

  const visibles = compasesVisibles(ancho);

  useLayoutEffect(() => {
    const nodo = tiraRef.current;
    if (!nodo) return;
    const medir = () => setAncho(nodo.clientWidth);
    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(nodo);
    return () => observador.disconnect();
  }, []);

  /** El loop que se pinta: el de la toma en curso o, si está elegido, el que empezaría en el cursor. */
  const zonaBucle = useCallback((): { desde: number; largo: number } | null => {
    const enCurso = bucleActual();
    if (enCurso) return enCurso;
    if (bucleCompases <= 0 || !engine) return null;
    return { desde: compasDe(engine.position, compasSeg) * compasSeg, largo: bucleCompases * compasSeg };
  }, [bucleActual, bucleCompases, engine, compasSeg]);

  const vivo = useRef({ project, instrumento, pagina, visibles, compasSeg, grabando, zonaBucle, atril, engine });
  vivo.current = { project, instrumento, pagina, visibles, compasSeg, grabando, zonaBucle, atril, engine };

  /** Pinta compases, loop y notas. Barato: unos cientos de rectángulos como mucho. */
  const pintar = useCallback(() => {
    const lienzo = lienzoRef.current;
    const ctx = lienzo?.getContext('2d');
    if (!lienzo || !ctx) return;
    const v = vivo.current;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const w = lienzo.clientWidth;
    const h = lienzo.clientHeight;
    if (lienzo.width !== Math.round(w * dpr) || lienzo.height !== Math.round(h * dpr)) {
      lienzo.width = Math.round(w * dpr);
      lienzo.height = Math.round(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const desde = v.pagina * v.compasSeg;
    const hasta = desde + v.visibles * v.compasSeg;
    const x = (t: number) => ((t - desde) / (hasta - desde)) * w;
    const anchoCompas = w / v.visibles;

    // La zona del loop: un fondo un punto más fuerte, con sus dos bordes.
    const bucle = v.zonaBucle();
    if (bucle) {
      const a = Math.max(0, x(bucle.desde));
      const b = Math.min(w, x(bucle.desde + bucle.largo));
      if (b > a) {
        ctx.fillStyle = color(lienzo, T.fillStrong);
        ctx.fillRect(a, 0, b - a, h);
        ctx.fillStyle = color(lienzo, T.text);
        ctx.globalAlpha = 0.5;
        ctx.fillRect(a, 0, 1, h);
        ctx.fillRect(b - 1, 0, 1, h);
        ctx.globalAlpha = 1;
      }
    }

    // Compases y pulsos.
    ctx.fillStyle = color(lienzo, T.gridBar);
    for (let i = 1; i < v.visibles; i++) ctx.fillRect(Math.round(i * anchoCompas), 0, 1, h);
    // Los pulsos, una muesca abajo, solo si hay sitio para verlos.
    const porCompas = Math.max(1, Math.round(v.compasSeg / (60 / Math.max(1, v.project.bpm))));
    if (anchoCompas / porCompas >= 6) {
      ctx.fillStyle = color(lienzo, T.grid);
      for (let i = 0; i < v.visibles; i++) {
        for (let p = 1; p < porCompas; p++) ctx.fillRect(Math.round(i * anchoCompas + (p / porCompas) * anchoCompas), h - 4, 1, 4);
      }
    }

    // Números de compás, arriba a la izquierda de cada uno.
    const fuente = getComputedStyle(lienzo).getPropertyValue('--font-body').trim() || 'Inter, system-ui, sans-serif';
    ctx.font = `600 10px ${fuente}`;
    ctx.textBaseline = 'top';
    ctx.fillStyle = color(lienzo, T.faint);
    const salto = anchoCompas < 22 ? 2 : 1;
    for (let i = 0; i < v.visibles; i++) {
      const numero = v.pagina + i + 1;
      if ((numero - 1) % salto === 0) ctx.fillText(String(numero), i * anchoCompas + 4, 4);
    }

    // El audio grabado: una raya fina abajo, donde lo hay.
    ctx.fillStyle = color(lienzo, T.wave);
    for (const bloque of bloquesDeAudio(v.project.tracks, desde, hasta)) {
      ctx.fillRect(x(bloque.desde), h - 7, Math.max(2, x(bloque.hasta) - x(bloque.desde)), 2);
    }

    // Las notas: las de las pistas y las de la toma en curso.
    const notas: { t: number; dur: number; nota: number; tono: 'toma' | 'propia' | 'otra' }[] = notasEnVentana(
      v.project.tracks,
      v.project.bpm,
      desde,
      hasta,
      v.instrumento,
    ).map((n) => ({ ...n, tono: n.tipo }));
    if (v.grabando && v.atril && v.engine) {
      // En loop, cada vuelta cae encima de la anterior, como suena.
      const enCurso = bucleActual();
      for (const e of v.atril.eventosDeLaToma) {
        const t = plegar(e.pos ?? v.engine.posicionEn(e.t), enCurso);
        if (t >= desde && t < hasta) notas.push({ t, dur: e.dur ?? 0.12, nota: e.nota, tono: 'toma' });
      }
    }
    if (notas.length) {
      let bajo = Infinity;
      let alto = -Infinity;
      for (const n of notas) {
        bajo = Math.min(bajo, n.nota);
        alto = Math.max(alto, n.nota);
      }
      // Menos de una octava de registro: se centra, que no salten de arriba abajo.
      if (alto - bajo < 12) {
        const medio = (alto + bajo) / 2;
        bajo = medio - 6;
        alto = medio + 6;
      }
      const arriba = 17;
      const zona = h - arriba - 10;
      const tonos = { toma: color(lienzo, T.text), propia: color(lienzo, T.dim), otra: color(lienzo, T.faint) };
      for (const tono of ['otra', 'propia', 'toma'] as const) {
        ctx.fillStyle = tonos[tono];
        ctx.globalAlpha = tono === 'otra' ? 0.55 : 1;
        for (const n of notas) {
          if (n.tono !== tono) continue;
          const y = arriba + (1 - (n.nota - bajo) / (alto - bajo)) * zona;
          ctx.fillRect(x(n.t), Math.round(y), Math.max(2, Math.min(x(n.t + n.dur) - x(n.t), anchoCompas)), 3);
        }
      }
      ctx.globalAlpha = 1;
    }
  }, [bucleActual]);

  // Se repinta cuando cambia lo que se ve.
  useEffect(() => {
    pintar();
  }, [pintar, ancho, pagina, visibles, project.tracks, project.bpm, pulsosPorCompas, instrumento, bucleCompases, grabando]);

  // El cursor, a 60 fps; la página sigue al cursor; grabando, las notas nuevas.
  useEffect(() => {
    let raf = 0;
    let ultimoPintado = 0;
    let ultimoCompas = -1;
    const bucle = (ahora: number) => {
      const v = vivo.current;
      const cursor = cursorRef.current;
      const tira = tiraRef.current;
      if (v.engine && cursor && tira) {
        const posicion = arrastre.current !== null ? arrastre.current * v.compasSeg : v.engine.position;
        const compas = compasDe(posicion, v.compasSeg);
        const enCurso = bucleActual();
        const zona = enCurso ? { desdeCompas: compasDe(enCurso.desde, v.compasSeg), compases: Math.round(enCurso.largo / v.compasSeg) } : null;
        const nueva = paginaDe(compas, v.visibles, zona);
        if (nueva !== v.pagina) setPagina(nueva);
        const desde = v.pagina * v.compasSeg;
        const fraccion = (posicion - desde) / (v.visibles * v.compasSeg);
        const dentro = fraccion >= 0 && fraccion <= 1;
        cursor.style.opacity = dentro ? '1' : '0';
        cursor.style.transform = `translateX(${Math.round(fraccion * tira.clientWidth)}px)`;
        if (compas !== ultimoCompas) {
          ultimoCompas = compas;
          tira.setAttribute('aria-valuenow', String(compas + 1));
          tira.setAttribute('aria-valuetext', `Compás ${compas + 1}`);
        }
        if (v.grabando && ahora - ultimoPintado > 120) {
          ultimoPintado = ahora;
          pintar();
        }
      }
      raf = requestAnimationFrame(bucle);
    };
    raf = requestAnimationFrame(bucle);
    return () => cancelAnimationFrame(raf);
  }, [bucleActual, pintar]);

  /* ---------------------------------------------------------------- */
  /* Mover el cursor                                                   */
  /* ---------------------------------------------------------------- */

  const compasEn = (clientX: number): number => {
    const tira = tiraRef.current;
    if (!tira) return pagina;
    const caja = tira.getBoundingClientRect();
    const f = Math.max(0, Math.min(0.9999, (clientX - caja.left) / caja.width));
    return pagina + Math.floor(f * visibles);
  };

  const sonando = studio.transport !== 'stopped';
  const ir = (compas: number) => {
    haptic(6);
    void irA(Math.max(0, compas) * compasSeg);
  };

  const alBajar = (evento: React.PointerEvent<HTMLDivElement>) => {
    // Grabando no se mueve: se perdería la toma. Un segundo dedo tampoco.
    if (grabando || arrastre.current !== null || !evento.isPrimary) return;
    evento.preventDefault();
    try {
      // Con captura, el arrastre sigue aunque el dedo se salga de la tira.
      evento.currentTarget.setPointerCapture(evento.pointerId);
    } catch {
      /* sin captura: se mueve igual mientras el dedo esté encima */
    }
    const compas = compasEn(evento.clientX);
    arrastre.current = compas;
    // Parado, el cursor se mueve ya; escuchando, al soltar (saltar relanza el sonido).
    if (!sonando) ir(compas);
  };
  const alMover = (evento: React.PointerEvent<HTMLDivElement>) => {
    if (arrastre.current === null) return;
    const compas = compasEn(evento.clientX);
    if (compas === arrastre.current) return;
    arrastre.current = compas;
    if (!sonando) ir(compas);
  };
  const alSoltar = () => {
    const compas = arrastre.current;
    arrastre.current = null;
    if (compas !== null && sonando) ir(compas);
  };

  const posicion = () => engine?.position ?? 0;
  const alTeclear = (evento: React.KeyboardEvent<HTMLDivElement>) => {
    if (grabando) return;
    const actual = compasDe(posicion(), compasSeg);
    const destino =
      evento.key === 'ArrowLeft' ? compasAnterior(posicion(), compasSeg, pulso) : evento.key === 'ArrowRight' ? actual + 1 : evento.key === 'Home' ? 0 : null;
    if (destino === null) return;
    // Solo con el foco en la tira: no se cruza con los atajos del estudio.
    evento.preventDefault();
    evento.stopPropagation();
    ir(destino);
  };

  const nombre = getInstrumento(instrumento).nombre;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <BotonTira titulo="Al principio" onClick={() => ir(0)} desactivado={grabando}>
        <SkipBack size={18} weight="fill" color={T.text} />
      </BotonTira>
      <BotonTira titulo="Un compás atrás" onClick={() => ir(compasAnterior(posicion(), compasSeg, pulso))} desactivado={grabando}>
        <CaretLeft size={18} weight="bold" color={T.text} />
      </BotonTira>
      <div
        ref={tiraRef}
        role="slider"
        tabIndex={0}
        aria-label={`Dónde está el cursor. Se ven los compases ${pagina + 1} a ${pagina + visibles}; en pequeño, las notas de ${nombre} y de las demás pistas`}
        aria-valuemin={1}
        aria-valuenow={1}
        aria-disabled={grabando}
        onPointerDown={alBajar}
        onPointerMove={alMover}
        onPointerUp={alSoltar}
        onPointerCancel={alSoltar}
        onKeyDown={alTeclear}
        className="tocar-tira-tiempo"
        style={{
          position: 'relative',
          flex: 1,
          minWidth: 0,
          height: 44,
          borderRadius: 10,
          overflow: 'hidden',
          background: T.fill,
          boxShadow: `inset 0 0 0 1px ${T.border}`,
          touchAction: 'none',
          cursor: grabando ? 'default' : 'pointer',
          outline: 'none',
        }}
      >
        <canvas ref={lienzoRef} aria-hidden style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
        <span
          ref={cursorRef}
          aria-hidden
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: -1,
            width: 2,
            borderRadius: 1,
            // Grabando, rojo: es lo mismo que dice el marco de la pantalla.
            background: grabando ? T.rec : T.text,
            willChange: 'transform',
            pointerEvents: 'none',
          }}
        />
      </div>
      <BotonTira titulo="Un compás adelante" onClick={() => ir(compasDe(posicion(), compasSeg) + 1)} desactivado={grabando}>
        <CaretRight size={18} weight="bold" color={T.text} />
      </BotonTira>
    </div>
  );
}

function BotonTira({ children, titulo, onClick, desactivado }: { children: React.ReactNode; titulo: string; onClick: () => void; desactivado?: boolean }) {
  return (
    <button
      type="button"
      className="daw-press daw-hover"
      aria-label={titulo}
      title={titulo}
      disabled={desactivado}
      onClick={onClick}
      style={{
        width: 36,
        height: 44,
        flexShrink: 0,
        display: 'grid',
        placeItems: 'center',
        padding: 0,
        border: 'none',
        borderRadius: 10,
        background: 'transparent',
        opacity: desactivado ? 0.35 : 1,
        cursor: desactivado ? 'default' : 'pointer',
      }}
    >
      {children}
    </button>
  );
}
