'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { notasDeEscala } from '@/lib/instrumentos/acordes';
import type { Atril } from '@/lib/instrumentos/directo';
import type { DefInstrumento } from '@/lib/instrumentos/registro';
import { NOTAS, type Tonalidad } from '@/lib/musico/teoria';
import { haptic, T } from '../theme';
import { IconChevronRight } from '../ui';

export type ModoTeclado = 'escala' | 'cromatico';
export type TamanoTeclas = 'pequeno' | 'mediano' | 'grande';

/** Ancho de tecla por tamaño: en escala cada tecla es una nota; en cromático, la blanca. */
const ANCHO: Record<ModoTeclado, Record<TamanoTeclas, number>> = {
  escala: { pequeno: 48, mediano: 60, grande: 84 },
  cromatico: { pequeno: 36, mediano: 46, grande: 62 },
};

const NEGRAS = new Set([1, 3, 6, 8, 10]);

/** Alto máximo de cada fila de teclas, en px (en el móvil no se llega). */
const ALTO_MAXIMO = 240;

interface Tecla {
  nota: number;
  x: number;
  y: number;
  w: number;
  h: number;
  negra: boolean;
  tonica: boolean;
}

/**
 * El teclado. Por defecto, en ESCALA: solo están las notas de la tonalidad,
 * así no hay nota que desafine (en GarageBand es el modo «escala»). Dos filas:
 * la de arriba sigue donde acaba la de abajo. «Todas» lo convierte en un
 * piano con sus negras. El tamaño de las teclas se ajusta; las flechas
 * mueven el registro.
 *
 * Se toca como los pads: escuchas nativas, sin estado de React, un dedo por
 * `pointerId`. Arrastrar de una tecla a otra hace glissando.
 */
export function Teclado({
  atril,
  def,
  tonalidad,
  modo,
  tamano,
  onModo,
  onTamano,
  teclaDe,
}: {
  atril: Atril | null;
  def: DefInstrumento;
  tonalidad: Tonalidad;
  modo: ModoTeclado;
  tamano: TamanoTeclas;
  onModo?: (modo: ModoTeclado) => void;
  onTamano: (tamano: TamanoTeclas) => void;
  /** La tecla del ordenador que toca cada nota, para escribirla debajo. */
  teclaDe?: (nota: number) => string | null;
}) {
  const raizRef = useRef<HTMLDivElement | null>(null);
  const [caja, setCaja] = useState({ w: 340, h: 300 });
  // Dónde empieza el teclado: la tónica más cercana a la base del instrumento.
  const [inicio, setInicio] = useState(() => def.base - ((def.base - tonalidad.tonica + 120) % 12));
  useEffect(() => {
    setInicio(def.base - ((def.base - tonalidad.tonica + 120) % 12));
  }, [def.base, tonalidad.tonica]);

  useLayoutEffect(() => {
    const nodo = raizRef.current;
    if (!nodo) return;
    const medir = () => setCaja({ w: nodo.clientWidth, h: nodo.clientHeight });
    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(nodo);
    return () => observador.disconnect();
  }, []);

  const teclas = useMemo<Tecla[]>(() => {
    const filas = 2;
    // Con tope: en un PC alto, una tecla de medio metro no se toca mejor.
    // Las filas se quedan abajo, donde está la mano.
    const altoFila = Math.min(ALTO_MAXIMO, (caja.h - 8) / filas);
    const arriba = Math.max(0, caja.h - (filas * altoFila + (filas - 1) * 8));
    const salida: Tecla[] = [];
    if (modo === 'escala') {
      const porFila = Math.max(4, Math.floor(caja.w / ANCHO.escala[tamano]));
      const notas = notasDeEscala(tonalidad, inicio, inicio + 48).slice(0, porFila * filas);
      const w = caja.w / porFila;
      notas.forEach((nota, i) => {
        const fila = Math.floor(i / porFila);
        salida.push({
          nota,
          x: (i % porFila) * w,
          y: arriba + (filas - 1 - fila) * (altoFila + 8),
          w,
          h: altoFila,
          negra: false,
          tonica: ((nota - tonalidad.tonica) % 12 + 12) % 12 === 0,
        });
      });
      return salida;
    }
    // Cromático: blancas en fila y negras encima, en dos teclados apilados.
    const ancho = ANCHO.cromatico[tamano];
    const blancasPorFila = Math.max(5, Math.floor(caja.w / ancho));
    const w = caja.w / blancasPorFila;
    let nota = inicio;
    while (NEGRAS.has(((nota % 12) + 12) % 12)) nota--;
    for (let fila = 0; fila < filas; fila++) {
      const y = arriba + (filas - 1 - fila) * (altoFila + 8);
      for (let b = 0; b < blancasPorFila; b++) {
        salida.push({ nota, x: b * w, y, w, h: altoFila, negra: false, tonica: ((nota - tonalidad.tonica) % 12 + 12) % 12 === 0 });
        const siguiente = nota + 1;
        if (NEGRAS.has(siguiente % 12) && b < blancasPorFila - 1) {
          salida.push({ nota: siguiente, x: (b + 1) * w - w * 0.32, y, w: w * 0.64, h: altoFila * 0.6, negra: true, tonica: false });
          nota += 2;
        } else {
          nota += 1;
        }
        while (NEGRAS.has(nota % 12)) nota++;
      }
    }
    // Las negras se pintan encima: al final de la lista.
    return [...salida.filter((t) => !t.negra), ...salida.filter((t) => t.negra)];
  }, [caja, modo, tamano, tonalidad, inicio]);

  const atrilRef = useRef(atril);
  const defRef = useRef(def);
  atrilRef.current = atril;
  defRef.current = def;

  useEffect(() => {
    const raiz = raizRef.current;
    if (!raiz) return;
    const dedos = new Map<number, { tecla: HTMLElement; soltar: (hora?: number) => void }>();

    const teclaEn = (x: number, y: number): HTMLElement | null => {
      const elemento = document.elementFromPoint(x, y) as HTMLElement | null;
      const tecla = elemento?.closest<HTMLElement>('[data-nota]') ?? null;
      return tecla && raiz.contains(tecla) ? tecla : null;
    };
    const fuerza = (evento: PointerEvent, tecla: HTMLElement): number => {
      if (evento.pointerType === 'pen' && evento.pressure > 0) return Math.round(40 + 87 * evento.pressure);
      // Como en un piano de verdad: más abajo en la tecla, más fuerte.
      const caja = tecla.getBoundingClientRect();
      const abajo = Math.max(0, Math.min(1, (evento.clientY - caja.top) / caja.height));
      return Math.round(72 + 50 * abajo);
    };
    const empezar = (evento: PointerEvent, tecla: HTMLElement) => {
      const a = atrilRef.current;
      if (!a) return;
      const soltar = a.tocar(defRef.current.id, Number(tecla.dataset.nota), fuerza(evento, tecla), evento.timeStamp);
      tecla.dataset.on = '1';
      dedos.set(evento.pointerId, { tecla, soltar });
    };
    const acabar = (pointerId: number, hora?: number) => {
      const dedo = dedos.get(pointerId);
      if (!dedo) return;
      dedo.soltar(hora);
      // Otra mano puede seguir en la misma tecla.
      if (![...dedos.values()].some((d) => d !== dedo && d.tecla === dedo.tecla)) delete dedo.tecla.dataset.on;
      dedos.delete(pointerId);
    };

    const alBajar = (evento: PointerEvent) => {
      const tecla = (evento.target as HTMLElement | null)?.closest<HTMLElement>('[data-nota]');
      if (!tecla || !raiz.contains(tecla)) return;
      evento.preventDefault();
      try {
        raiz.setPointerCapture(evento.pointerId);
      } catch {
        /* sin captura no hay glissando, pero suena */
      }
      empezar(evento, tecla);
    };
    const alMover = (evento: PointerEvent) => {
      const dedo = dedos.get(evento.pointerId);
      if (!dedo) return;
      const tecla = teclaEn(evento.clientX, evento.clientY);
      if (!tecla || tecla === dedo.tecla) return;
      acabar(evento.pointerId, evento.timeStamp);
      empezar(evento, tecla);
    };
    const alSubir = (evento: PointerEvent) => acabar(evento.pointerId, evento.timeStamp);

    raiz.addEventListener('pointerdown', alBajar);
    raiz.addEventListener('pointermove', alMover);
    raiz.addEventListener('pointerup', alSubir);
    raiz.addEventListener('pointercancel', alSubir);
    return () => {
      raiz.removeEventListener('pointerdown', alBajar);
      raiz.removeEventListener('pointermove', alMover);
      raiz.removeEventListener('pointerup', alSubir);
      raiz.removeEventListener('pointercancel', alSubir);
      for (const id of [...dedos.keys()]) acabar(id);
    };
  }, []);

  const primera = teclas.length ? Math.min(...teclas.map((t) => t.nota)) : inicio;
  const ultima = teclas.length ? Math.max(...teclas.map((t) => t.nota)) : inicio;
  const nombre = (n: number) => `${NOTAS[((n % 12) + 12) % 12]}${Math.floor(n / 12) - 1}`;
  const puedeBajar = inicio - 12 >= def.rango[0] - 12;
  const puedeSubir = inicio + 12 <= def.rango[1];
  const siguienteTamano: Record<TamanoTeclas, TamanoTeclas> = { pequeno: 'mediano', mediano: 'grande', grande: 'pequeno' };
  const nombreTamano: Record<TamanoTeclas, string> = { pequeno: 'Pequeñas', mediano: 'Medianas', grande: 'Grandes' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', height: '100%', minHeight: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <BotonBarra
          titulo="Más grave"
          onClick={() => puedeBajar && setInicio((i) => i - 12)}
          desactivado={!puedeBajar}
        >
          <span style={{ display: 'grid', transform: 'scaleX(-1)' }}>
            <IconChevronRight size={14} color={T.text} />
          </span>
        </BotonBarra>
        <span
          aria-live="polite"
          style={{ fontFamily: T.fontBody, fontVariantNumeric: 'tabular-nums', fontSize: 13, fontWeight: 500, color: T.dim, minWidth: 76, textAlign: 'center' }}
        >
          {nombre(primera)} a {nombre(ultima)}
        </span>
        <BotonBarra titulo="Más agudo" onClick={() => puedeSubir && setInicio((i) => i + 12)} desactivado={!puedeSubir}>
          <IconChevronRight size={14} color={T.text} />
        </BotonBarra>
        <span style={{ flex: 1 }} />
        {onModo ? (
          <BotonBarra
            titulo={modo === 'escala' ? 'Enseñar todas las notas' : 'Solo las notas de la escala'}
            ancho
            onClick={() => onModo(modo === 'escala' ? 'cromatico' : 'escala')}
          >
            {modo === 'escala' ? 'Escala' : 'Todas'}
          </BotonBarra>
        ) : null}
        <BotonBarra titulo={`Teclas ${nombreTamano[tamano].toLowerCase()}. Cambiar tamaño`} ancho onClick={() => onTamano(siguienteTamano[tamano])}>
          {nombreTamano[tamano]}
        </BotonBarra>
      </div>
      <div
        ref={raizRef}
        role="group"
        aria-label={`Teclado de ${def.nombre}`}
        className="tocar-superficie"
        style={{ position: 'relative', flex: 1, minHeight: 0 }}
      >
        {teclas.map((tecla) => {
          const pc = teclaDe?.(tecla.nota) ?? null;
          return (
          <button
            key={`${tecla.nota}-${tecla.x}-${tecla.y}`}
            type="button"
            data-nota={tecla.nota}
            className={tecla.negra ? 'tocar-tecla tocar-tecla-negra' : 'tocar-tecla'}
            aria-label={pc ? `${nombre(tecla.nota)}, tecla ${pc}` : nombre(tecla.nota)}
            style={{
              position: 'absolute',
              left: tecla.x + (tecla.negra ? 0 : 2),
              top: tecla.y,
              width: tecla.w - (tecla.negra ? 0 : 4),
              height: tecla.h,
              border: 'none',
              borderRadius: tecla.negra ? '0 0 8px 8px' : 10,
              background: tecla.negra ? T.text : tecla.tonica ? T.fillStrong : T.surface,
              boxShadow: tecla.negra ? T.elev1 : `inset 0 0 0 1px ${T.border}, inset 0 -3px 0 ${T.fill}`,
              zIndex: tecla.negra ? 2 : 1,
              padding: 0,
              cursor: 'pointer',
            }}
          >
            {pc && tecla.h >= 72 ? (
              <span
                aria-hidden
                style={{
                  position: 'absolute',
                  left: '50%',
                  bottom: tecla.negra ? 6 : 8,
                  transform: 'translateX(-50%)',
                  minWidth: 18,
                  height: 18,
                  padding: '0 4px',
                  display: 'grid',
                  placeItems: 'center',
                  borderRadius: 5,
                  background: tecla.negra ? 'rgba(255,255,255,0.14)' : T.fill,
                  fontFamily: T.fontMono,
                  fontSize: 10.5,
                  fontWeight: 600,
                  color: tecla.negra ? 'rgba(255,255,255,0.78)' : T.dim,
                  pointerEvents: 'none',
                }}
              >
                {pc}
              </span>
            ) : null}
            {!tecla.negra ? (
              <span
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  bottom: pc && tecla.h >= 72 ? 32 : 8,
                  textAlign: 'center',
                  fontFamily: T.fontBody,
                  fontSize: 12,
                  fontWeight: tecla.tonica ? 700 : 500,
                  color: tecla.tonica ? T.text : T.faint,
                  pointerEvents: 'none',
                }}
              >
                {NOTAS[((tecla.nota % 12) + 12) % 12]}
              </span>
            ) : null}
          </button>
          );
        })}
      </div>
    </div>
  );
}

export function BotonBarra({
  children,
  titulo,
  onClick,
  activo,
  desactivado,
  ancho,
}: {
  children: React.ReactNode;
  titulo: string;
  onClick: () => void;
  activo?: boolean;
  desactivado?: boolean;
  ancho?: boolean;
}) {
  return (
    <button
      type="button"
      className="daw-press daw-hover"
      title={titulo}
      aria-label={titulo}
      aria-pressed={activo}
      disabled={desactivado}
      onClick={() => {
        haptic(8);
        onClick();
      }}
      style={{
        minWidth: 40,
        height: 36,
        padding: ancho ? '0 12px' : 0,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: 'none',
        borderRadius: 10,
        background: activo ? T.text : T.fill,
        boxShadow: activo ? 'none' : `inset 0 1px 0 ${T.rim}`,
        color: activo ? T.inverse : T.text,
        fontFamily: T.fontBody,
        fontSize: 13,
        fontWeight: 600,
        whiteSpace: 'nowrap',
        opacity: desactivado ? 0.35 : 1,
        cursor: desactivado ? 'default' : 'pointer',
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  );
}
