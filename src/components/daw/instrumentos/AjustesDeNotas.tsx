'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { rehacerPistaDeNotas } from '@/hooks/useInstrumentos';
import type { Studio } from '@/hooks/useStudio';
import type { Track } from '@/lib/daw/types';
import { INSTRUMENTOS, getInstrumento } from '@/lib/instrumentos/registro';
import { AJUSTES_SIN_TOCAR, type AjustesGroove, type InstrumentoId } from '@/lib/instrumentos/tipos';
import { ajustesParaCuadrar, describirDiagnostico, diagnosticar, PLANTILLAS } from '@/lib/musico/groove';
import { haptic, T } from '../theme';
import { Field, Segmented, Slider, Toggle, hintText, label } from '../ui';
import { BotonBarra } from './Teclado';

const REJILLAS: { value: string; text: string; paso: number }[] = [
  { value: '1', text: 'Negras', paso: 1 },
  { value: '0.5', text: 'Corcheas', paso: 0.5 },
  { value: '0.333', text: 'Tresillos', paso: 1 / 3 },
  { value: '0.25', text: 'Semis', paso: 0.25 },
];

/**
 * «La IA lo graba bien», desde la pista: cuadrar (fuerza, swing, rejilla y
 * plantilla), humanizar, quitar dobles golpes y cambiar el sonido. Nada borra
 * lo que tocaste: la pista guarda el original y esto solo cambia los ajustes.
 */
export function AjustesDeNotas({ studio, track }: { studio: Studio; track: Track }) {
  const notas = track.notas;
  const [trabajando, setTrabajando] = useState(false);
  // Los deslizadores se mueven al momento; el audio se rehace al soltar.
  const [borrador, setBorrador] = useState<AjustesGroove>(notas?.ajustes ?? AJUSTES_SIN_TOCAR);
  useEffect(() => {
    if (notas) setBorrador(notas.ajustes);
  }, [track.id, notas]);
  const pendiente = useRef<number | null>(null);

  const pulso = 60 / studio.project.bpm;
  const inicioBeat = track.clip.start / pulso;
  const diagnostico = useMemo(
    () => (notas ? diagnosticar(notas.bruto, { bpm: notas.bpm, inicioBeat, pulsosPorCompas: notas.pulsosPorCompas }) : null),
    [notas, inicioBeat],
  );

  if (!notas) return null;
  const def = getInstrumento(notas.instrumento);
  const esBateria = !!def.pads;
  // Los sonidos que se ofrecen: los de su clase (batería con batería), sin los
  // retirados; si la pista usa uno retirado, se sigue enseñando el suyo.
  const alternativas = INSTRUMENTOS.filter((i) => !!i.pads === esBateria && (!i.oculto || i.id === notas.instrumento));

  const aplicar = (ajustes: AjustesGroove, aviso?: string) => {
    setBorrador(ajustes);
    if (pendiente.current) window.clearTimeout(pendiente.current);
    pendiente.current = window.setTimeout(async () => {
      setTrabajando(true);
      await rehacerPistaDeNotas(studio, track.id, { ajustes }, { aviso });
      setTrabajando(false);
    }, 120);
  };

  const cuadrarPorDefecto = () => {
    // La IA elige la rejilla escuchando lo que tocaste; la fuerza se queda en
    // el 70 %, que corrige sin dejarlo de máquina.
    aplicar(ajustesParaCuadrar(notas.bruto, borrador, { fuerza: 0.7, swing: 0, humanizar: false, inicioBeat }), 'Cuadrado al 70 %');
  };

  const cuadrar = borrador.cuadrar;
  const humanizar = borrador.humanizar;
  const hayAjustes = !!(cuadrar || humanizar || !borrador.limpiar);

  return (
    <>
      <Field
        title="La IA lo graba bien"
        intro={
          diagnostico && notas.bruto.length > 3
            ? textoDiagnostico(diagnostico)
            : 'Cuadra lo que tocaste a la rejilla sin dejarlo de máquina, o dale un poco de mano. Lo tocado no se pierde nunca.'
        }
      >
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button
            type="button"
            className="daw-press daw-sink"
            disabled={trabajando}
            onClick={() => {
              haptic(10);
              if (cuadrar) aplicar({ ...borrador, cuadrar: null }, 'Sin cuadrar');
              else cuadrarPorDefecto();
            }}
            style={{
              flex: 1,
              minHeight: 46,
              borderRadius: 12,
              border: 'none',
              // Verde: aquí actúa la máquina.
              background: cuadrar ? T.aiSoft : T.ai,
              color: cuadrar ? T.ai : T.inverse,
              boxShadow: cuadrar ? `inset 0 0 0 1.5px ${T.ai}` : T.elev1,
              fontFamily: T.fontBody,
              fontSize: 15,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {cuadrar ? 'Cuadrado · quitar' : 'Cuadrar'}
          </button>
          <button
            type="button"
            className="daw-press daw-hover"
            disabled={trabajando}
            onClick={() => {
              haptic(10);
              aplicar(
                { ...borrador, humanizar: humanizar ? null : { cantidad: 0.45, semilla: (Date.now() % 9973) + 1 } },
                humanizar ? 'Sin humanizar' : 'Humanizado',
              );
            }}
            style={{
              flex: 1,
              minHeight: 46,
              borderRadius: 12,
              border: 'none',
              background: humanizar ? T.aiSoft : T.fill,
              color: humanizar ? T.ai : T.text,
              boxShadow: humanizar ? `inset 0 0 0 1.5px ${T.ai}` : `inset 0 1px 0 ${T.rim}`,
              fontFamily: T.fontBody,
              fontSize: 15,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {humanizar ? 'Humanizado · quitar' : 'Humanizar'}
          </button>
        </div>

        {cuadrar ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 14 }}>
            <Segmented
              ariaLabel="Rejilla"
              value={cuadrar.plantilla ? 'plantilla' : (REJILLAS.find((r) => Math.abs(r.paso - cuadrar.rejilla) < 0.01)?.value ?? '')}
              options={REJILLAS.map(({ value, text }) => ({ value, text }))}
              onChange={(value) => {
                const paso = REJILLAS.find((r) => r.value === value)?.paso ?? 0.25;
                aplicar({ ...borrador, cuadrar: { ...cuadrar, rejilla: paso, plantilla: null } });
              }}
            />
            <Deslizador
              nombre="Fuerza"
              valor={cuadrar.fuerza}
              onCambio={(fuerza) => setBorrador({ ...borrador, cuadrar: { ...cuadrar, fuerza } })}
              onSoltar={(fuerza) => aplicar({ ...borrador, cuadrar: { ...cuadrar, fuerza } })}
            />
            {cuadrar.plantilla ? null : (
              <Deslizador
                nombre="Swing"
                valor={cuadrar.swing}
                onCambio={(swing) => setBorrador({ ...borrador, cuadrar: { ...cuadrar, swing } })}
                onSoltar={(swing) => aplicar({ ...borrador, cuadrar: { ...cuadrar, swing } })}
              />
            )}
            <div>
              <span style={{ ...label, display: 'block', marginBottom: 8 }}>Groove</span>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <BotonBarra
                  titulo="Rejilla pura"
                  ancho
                  activo={!cuadrar.plantilla}
                  onClick={() => aplicar({ ...borrador, cuadrar: { ...cuadrar, plantilla: null } })}
                >
                  Rejilla
                </BotonBarra>
                {PLANTILLAS.map((p) => (
                  <BotonBarra
                    key={p.id}
                    titulo={p.descripcion}
                    ancho
                    activo={cuadrar.plantilla === p.id}
                    onClick={() => aplicar({ ...borrador, cuadrar: { ...cuadrar, plantilla: p.id } }, p.nombre)}
                  >
                    {p.nombre}
                  </BotonBarra>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {humanizar ? (
          <div style={{ marginBottom: 14 }}>
            <Deslizador
              nombre="Mano"
              valor={humanizar.cantidad}
              onCambio={(cantidad) => setBorrador({ ...borrador, humanizar: { ...humanizar, cantidad } })}
              onSoltar={(cantidad) => aplicar({ ...borrador, humanizar: { ...humanizar, cantidad } })}
            />
          </div>
        ) : null}

        <Toggle
          checked={borrador.limpiar}
          onChange={(limpiar) => aplicar({ ...borrador, limpiar })}
          title="Quitar dobles golpes"
          detail="Lo que suena dos veces en menos de 30 ms es el dedo que rebota, no tú."
        />
        {hayAjustes ? (
          <button
            type="button"
            className="daw-press daw-hover"
            onClick={() => aplicar(AJUSTES_SIN_TOCAR, 'Como lo tocaste')}
            style={{
              marginTop: 10,
              minHeight: 40,
              padding: '0 12px',
              border: 'none',
              borderRadius: 10,
              background: 'transparent',
              color: T.dim,
              fontFamily: T.fontBody,
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Volver a como lo tocaste
          </button>
        ) : null}
        {trabajando ? <p style={{ ...hintText, marginTop: 6 }}>Rehaciendo el sonido…</p> : null}
      </Field>

      <Field title="Sonido" hint={notas.sonido === 'sintesis' && def.paquete ? 'Suena con el sintetizado: las muestras no estaban. Se cambiará solo cuando se bajen.' : undefined}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {alternativas.map((alternativa) => (
            <BotonBarra
              key={alternativa.id}
              titulo={alternativa.nombre}
              ancho
              activo={alternativa.id === notas.instrumento}
              onClick={() => {
                if (alternativa.id === notas.instrumento) return;
                void rehacerPistaDeNotas(studio, track.id, { instrumento: alternativa.id as InstrumentoId }, { aviso: alternativa.nombre });
              }}
            >
              {alternativa.corto}
            </BotonBarra>
          ))}
        </div>
      </Field>
    </>
  );
}

function textoDiagnostico(d: ReturnType<typeof diagnosticar>): string {
  return `Te he escuchado: ${describirDiagnostico(d)}. Cuadrar lo arregla sin dejarlo de máquina.`;
}

function Deslizador({
  nombre,
  valor,
  onCambio,
  onSoltar,
}: {
  nombre: string;
  valor: number;
  onCambio: (valor: number) => void;
  onSoltar: (valor: number) => void;
}) {
  const ultimo = useRef(valor);
  ultimo.current = valor;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <span style={{ ...label, width: 52, flexShrink: 0, color: T.text, fontSize: 13 }}>{nombre}</span>
      <Slider
        ariaLabel={nombre}
        value={Math.round(valor * 100)}
        min={0}
        max={100}
        onChange={(v) => onCambio(v / 100)}
        onCommit={() => onSoltar(ultimo.current)}
      />
      <span style={{ fontFamily: T.fontBody, fontVariantNumeric: 'tabular-nums', fontSize: 13, color: T.dim, width: 40, textAlign: 'right', flexShrink: 0 }}>
        {Math.round(valor * 100)} %
      </span>
    </div>
  );
}
