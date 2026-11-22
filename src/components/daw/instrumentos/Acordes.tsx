'use client';

import { useEffect, useMemo, useRef } from 'react';
import {
  fuerzaDeRasgueo,
  patronAuto,
  posturaDeGuitarra,
  posturaDeTeclas,
  rasgueo,
  separacionDeRasgueo,
  tirasDeAcordes,
  type NotaRasgueada,
  type PasoAuto,
  type TiraDeAcorde,
} from '@/lib/instrumentos/acordes';
import type { Atril } from '@/lib/instrumentos/directo';
import type { DefInstrumento } from '@/lib/instrumentos/registro';
import type { Tonalidad } from '@/lib/musico/teoria';
import { T } from '../theme';

/** Lo que hay que mover el dedo (px) para que cuente como otro rasgueo. */
const TRAMO = 26;

/**
 * Las tiras de acordes: ocho acordes de la tonalidad.
 *
 * Con la guitarra, apoyar el dedo rasguea hacia abajo al momento; arrastrar
 * arriba y abajo por la tira rasguea en esa dirección, con la separación entre
 * cuerdas que pide la velocidad del gesto (de 25 ms despacio a 8 ms con un
 * golpe de muñeca). Con piano o cuerdas, el acorde suena mientras lo pisas.
 *
 * En automático, tocar una tira pone a sonar el patrón a tu tempo en ese
 * acorde; tocar otra cambia de acorde a tiempo; tocar la misma lo para.
 */
export function Acordes({
  atril,
  def,
  tonalidad,
  automatico,
  bpm,
  pulsosPorCompas,
  activa,
  onActiva,
}: {
  atril: Atril | null;
  def: DefInstrumento;
  tonalidad: Tonalidad;
  automatico: boolean;
  bpm: number;
  pulsosPorCompas: number;
  /** Tira sonando en automático (para pintarla), o null. */
  activa: number | null;
  onActiva: (indice: number | null) => void;
}) {
  const tiras = useMemo(() => tirasDeAcordes(tonalidad), [tonalidad]);
  const raizRef = useRef<HTMLDivElement | null>(null);
  const vivo = useRef({ atril, def, tiras, automatico, bpm, pulsosPorCompas, activa, onActiva });
  vivo.current = { atril, def, tiras, automatico, bpm, pulsosPorCompas, activa, onActiva };
  const previaRef = useRef<number[] | null>(null);

  // Al cambiar de instrumento, de tonalidad o de modo, el automático se para.
  useEffect(() => {
    return () => {
      atril?.pararAuto();
    };
  }, [atril, def.id, tonalidad, automatico]);

  useEffect(() => {
    const raiz = raizRef.current;
    if (!raiz) return;
    const dedos = new Map<number, { tira: HTMLElement; y: number; t: number; dir: 1 | -1 | 0; soltar: ((h?: number) => void)[] }>();

    // Piano y cuerdas enlazan las voces con el acorde anterior.
    const notasDeTeclas = (tira: TiraDeAcorde) => {
      const voz = posturaDeTeclas(tira, previaRef.current, true);
      previaRef.current = voz.slice(1);
      return voz;
    };

    const alBajar = (evento: PointerEvent) => {
      const elemento = (evento.target as HTMLElement | null)?.closest<HTMLElement>('[data-tira]');
      const { atril: a, def: d, tiras: lista, automatico: auto } = vivo.current;
      if (!elemento || !raiz.contains(elemento) || !a) return;
      evento.preventDefault();
      const indice = Number(elemento.dataset.tira);
      const tira = lista[indice];

      if (auto) {
        if (vivo.current.activa === indice) {
          a.pararAuto();
          vivo.current.onActiva(null);
          return;
        }
        const familiaAuto = d.familia === 'guitarra' ? 'guitarra' : d.id === 'cuerdas' ? 'cuerdas' : 'teclas';
        const postura = d.familia === 'guitarra' ? posturaDeGuitarra(tira) : posturaDeTeclas(tira, null, true);
        a.autoAcorde({
          id: d.id,
          patron: patronAuto(familiaAuto, vivo.current.pulsosPorCompas),
          pulsosPorCompas: vivo.current.pulsosPorCompas,
          bpm: vivo.current.bpm,
          notas: (paso: PasoAuto): NotaRasgueada[] => {
            if (d.familia === 'guitarra') return rasgueo(postura, paso.direccion, 11, paso.vel);
            const [bajo, ...derecha] = postura as number[];
            return paso.bajo
              ? [{ nota: bajo, desfase: 0, vel: paso.vel }]
              : derecha.map((nota) => ({ nota, desfase: 0, vel: paso.vel }));
          },
        });
        vivo.current.onActiva(indice);
        return;
      }

      try {
        elemento.setPointerCapture(evento.pointerId);
      } catch {
        /* sin captura: solo el primer rasgueo */
      }
      elemento.dataset.on = '1';
      const dedo = { tira: elemento, y: evento.clientY, t: evento.timeStamp, dir: 0 as 1 | -1 | 0, soltar: [] as ((h?: number) => void)[] };
      if (d.familia === 'guitarra') {
        a.rasguear(d.id, rasgueo(posturaDeGuitarra(tira), 'abajo', 12, 100), evento.timeStamp);
      } else {
        // Piano y cuerdas: el acorde entero, con el bajo un poco más fuerte,
        // sostenido mientras lo pisas.
        const notas = notasDeTeclas(tira);
        dedo.soltar = notas.map((nota, i) => a.tocar(d.id, nota, i === 0 ? 92 : 84, evento.timeStamp));
      }
      dedos.set(evento.pointerId, dedo);
    };

    const alMover = (evento: PointerEvent) => {
      const dedo = dedos.get(evento.pointerId);
      const { atril: a, def: d, tiras: lista } = vivo.current;
      if (!dedo || !a || d.familia !== 'guitarra') return;
      const dy = evento.clientY - dedo.y;
      if (Math.abs(dy) < TRAMO) return;
      const dir: 1 | -1 = dy > 0 ? 1 : -1;
      const velocidad = Math.abs(dy) / Math.max(1, evento.timeStamp - dedo.t);
      const tira = lista[Number(dedo.tira.dataset.tira)];
      a.rasguear(
        d.id,
        rasgueo(posturaDeGuitarra(tira), dir > 0 ? 'abajo' : 'arriba', separacionDeRasgueo(velocidad), fuerzaDeRasgueo(velocidad)),
        evento.timeStamp,
      );
      dedo.y = evento.clientY;
      dedo.t = evento.timeStamp;
      dedo.dir = dir;
    };

    const alSubir = (evento: PointerEvent) => {
      const dedo = dedos.get(evento.pointerId);
      if (!dedo) return;
      for (const soltar of dedo.soltar) soltar(evento.timeStamp);
      delete dedo.tira.dataset.on;
      dedos.delete(evento.pointerId);
    };

    raiz.addEventListener('pointerdown', alBajar);
    raiz.addEventListener('pointermove', alMover);
    raiz.addEventListener('pointerup', alSubir);
    raiz.addEventListener('pointercancel', alSubir);
    return () => {
      raiz.removeEventListener('pointerdown', alBajar);
      raiz.removeEventListener('pointermove', alMover);
      raiz.removeEventListener('pointerup', alSubir);
      raiz.removeEventListener('pointercancel', alSubir);
    };
  }, []);

  return (
    <div
      ref={raizRef}
      role="group"
      aria-label={`Acordes de ${def.nombre}`}
      className="tocar-superficie"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, minmax(64px, 1fr))',
        gridTemplateRows: 'repeat(2, minmax(120px, 1fr))',
        gap: 8,
        width: '100%',
        height: '100%',
        maxWidth: 720,
        // Como las teclas: en un PC alto, las tiras no pasan de unos 250 px.
        maxHeight: 520,
        margin: '0 auto',
      }}
    >
      {tiras.map((tira, i) => {
        const sonando = automatico && activa === i;
        return (
          <button
            key={`${tira.nombre}-${tira.grado}`}
            type="button"
            data-tira={i}
            className="tocar-tira"
            aria-label={`${tira.nombre}, grado ${tira.grado}`}
            aria-pressed={automatico ? sonando : undefined}
            style={{
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              padding: '12px 10px',
              border: 'none',
              borderRadius: 14,
              // Sonando en automático lo está tocando la máquina: verde.
              background: sonando ? T.aiSoft : T.fill,
              boxShadow: sonando ? `inset 0 0 0 1.5px ${T.ai}` : `inset 0 1px 0 ${T.rim}, inset 0 0 0 1px ${T.border}`,
              color: T.text,
              cursor: 'pointer',
              overflow: 'hidden',
            }}
          >
            <span style={{ fontFamily: T.fontBody, fontSize: 17, fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.1, pointerEvents: 'none' }}>
              {tira.nombre}
            </span>
            {/* Las cuerdas, dibujadas: dicen sin palabras que aquí se rasguea. */}
            {def.familia === 'guitarra' ? (
              <span aria-hidden style={{ position: 'absolute', inset: '44px 10px 30px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', pointerEvents: 'none' }}>
                {[0, 1, 2, 3, 4, 5].map((c) => (
                  <span key={c} style={{ height: c < 3 ? 1.5 : 1, background: T.borderStrong, borderRadius: 1 }} />
                ))}
              </span>
            ) : null}
            <span style={{ fontFamily: T.fontBody, fontSize: 11, fontWeight: 600, color: sonando ? T.ai : T.faint, pointerEvents: 'none' }}>
              {tira.grado}
            </span>
          </button>
        );
      })}
    </div>
  );
}
