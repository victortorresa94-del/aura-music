'use client';

import { useEffect, useState } from 'react';
import { getCompas } from '@/lib/daw/rhythm/compases';
import { GROOVES, familias, type Groove } from '@/lib/daw/rhythm/grooves';
import { duracionPatron } from '@/lib/daw/rhythm/player';
import { tempoParaRitmo } from '@/lib/musico/bateria';
import type { Studio } from '@/hooks/useStudio';
import { haptic } from './theme';
import { Field, Readout, Segmented, Sheet, Slider, T, TextButton, hintText, label, tabular } from './ui';

/**
 * Panel de ritmos.
 *
 * La idea central la inventó GarageBand y la ha copiado todo el mundo, Apple
 * incluida en sus Session Players: el acompañamiento no se presenta como un
 * secuenciador de rejilla, se presenta como UN MÚSICO al que le dices dos
 * cosas: cuánto toca y cuánto pega. Programar una batería es una tarea de
 * ingeniero; pedirle a alguien que toque más flojo, no.
 */
export function RhythmSheet({
  studio,
  open,
  onClose,
}: {
  studio: Studio;
  open: boolean;
  onClose: () => void;
}) {
  const { engine, project, setBpm, grooveId, setGroove, printGroove, transport } = studio;
  const [complejidad, setComplejidad] = useState(0.75);
  const [fuerza, setFuerza] = useState(0.8);
  const [vueltas, setVueltas] = useState(4);

  // Al cerrar el panel se calla la escucha suelta, pero no si está sonando el
  // transporte: ahí el ritmo forma parte de lo que estás tocando.
  useEffect(() => {
    if (!open) engine?.stopGroovePreview();
  }, [open, engine]);

  const activo = GROOVES.find((groove) => groove.id === grooveId) ?? null;

  const elegir = (groove: Groove) => {
    haptic(10);
    if (grooveId === groove.id) {
      setGroove(null);
      return;
    }
    setGroove(groove, { complejidad, fuerza });
    /* Con tomas grabadas manda tu tempo, no el del palo: el audio no se
       estira, y cambiar el tempo lo dejaría descuadrado con el ritmo. Si tu
       tempo cae fuera del palo, se prueba al doble o a la mitad, que siguen
       cayendo en tus pulsos. En un proyecto vacío, el palo trae su tempo. */
    const hayTomas = project.tracks.some((track) => !track.ia);
    const tempo = hayTomas ? tempoParaRitmo(project.bpm, groove.bpm) : project.bpm;
    if (tempo !== project.bpm) setBpm(tempo);
    else if (!hayTomas && (project.bpm < groove.bpm[0] || project.bpm > groove.bpm[1])) {
      setBpm(groove.bpmPorDefecto);
    }
  };

  return (
    <Sheet open={open} title="Ritmos" onClose={onClose}>
      <Field
        title="El compás manda"
        intro="Cada ritmo trae su propio ciclo. El doce flamenco no es un 4/4 con adornos: se cuenta 12-1-2-3… con los acentos en 12, 3, 6, 8 y 10, y así está montado por dentro."
      >
        {activo ? null : (
          <p style={{ ...hintText, marginBottom: 16 }}>
            Toca uno para escucharlo. Suena en bucle mientras el panel esté abierto, y si le das al play va
            contigo.
          </p>
        )}
        {familias().map((familia) => (
          <div key={familia} style={{ marginBottom: 20 }}>
            <div style={{ ...label, marginBottom: 8, paddingLeft: 4 }}>{familia}</div>
            {/* Una lista agrupada, con separadores finos: no una pila de tarjetas iguales. */}
            <div
              role="radiogroup"
              aria-label={familia}
              style={{
                borderRadius: 14,
                background: T.fill,
                boxShadow: `inset 0 1px 0 ${T.rim}`,
                overflow: 'hidden',
              }}
            >
              {GROOVES.filter((groove) => groove.familia === familia).map((groove, i) => {
                const seleccionado = grooveId === groove.id;
                const compas = getCompas(groove.compasId);
                return (
                  <button
                    key={groove.id}
                    type="button"
                    role="radio"
                    aria-checked={seleccionado}
                    className="daw-hover"
                    onClick={() => elegir(groove)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      width: '100%',
                      minHeight: 58,
                      padding: '10px 16px',
                      border: 'none',
                      boxShadow: i > 0 ? `inset 0 1px 0 ${T.rowLine}` : 'none',
                      background: seleccionado ? T.fillStrong : 'transparent',
                      color: T.text,
                      cursor: 'pointer',
                      textAlign: 'left',
                      touchAction: 'manipulation',
                      transition: `background-color 160ms ${T.easeOut}`,
                    }}
                  >
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span
                        style={{
                          display: 'block',
                          fontFamily: T.fontBody,
                          fontSize: 15,
                          fontWeight: seleccionado ? 600 : 500,
                          letterSpacing: '-0.01em',
                          color: T.text,
                        }}
                      >
                        {groove.nombre}
                      </span>
                      <span style={{ ...label, display: 'block', marginTop: 2 }}>
                        <span style={tabular}>{compas.pulsos}</span> pulsos ·{' '}
                        <span style={tabular}>
                          {groove.bpm[0]}–{groove.bpm[1]}
                        </span>{' '}
                        BPM
                      </span>
                    </span>
                    {seleccionado ? (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '4px 8px',
                          borderRadius: 999,
                          background: T.text,
                          color: T.inverse,
                          fontFamily: T.fontBody,
                          fontSize: 12,
                          fontWeight: 600,
                          flexShrink: 0,
                        }}
                      >
                        <span aria-hidden style={{ width: 6, height: 6, borderRadius: '50%', background: T.inverse }} />
                        Sonando
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </Field>

      {activo ? (
        <>
          <Field title="Cómo toca" hint={activo.nota}>
            <div style={{ display: 'grid', gridTemplateColumns: '64px 1fr', alignItems: 'center', columnGap: 12, rowGap: 4 }}>
              <span style={label}>Cuánto</span>
              <Slider
                ariaLabel="Cuánto toca"
                value={Math.round(complejidad * 100)}
                min={0}
                max={100}
                onChange={(value) => {
                  setComplejidad(value / 100);
                  engine?.setGrooveOptions({ complejidad: value / 100 });
                }}
              />
              <span style={label}>Fuerza</span>
              <Slider
                ariaLabel="Cuánto pega"
                value={Math.round(fuerza * 100)}
                min={10}
                max={100}
                onChange={(value) => {
                  setFuerza(value / 100);
                  engine?.setGrooveOptions({ fuerza: value / 100 });
                }}
              />
            </div>
          </Field>

          <Field
            title="Tempo"
            hint={`Un ciclo entero dura ${duracionPatron(activo, project.bpm).toLocaleString('es-ES', { maximumFractionDigits: 1, minimumFractionDigits: 1 })} s.`}
          >
            <div style={{ marginBottom: 4 }}>
              <Readout value={project.bpm} unit="BPM" size={28} />
            </div>
            <Slider
              ariaLabel="Tempo del ritmo"
              value={project.bpm}
              min={activo.bpm[0]}
              max={activo.bpm[1]}
              onChange={setBpm}
            />
          </Field>

          <Field
            title="Pasar a pista"
            hint="El ritmo se graba como una pista más y a partir de ahí se mueve, se recorta y se exporta como cualquier otra. Mientras no lo pases, suena pero no entra en la mezcla."
          >
            <div style={{ marginBottom: 10 }}>
              <Segmented
                ariaLabel="Vueltas"
                mono
                value={vueltas}
                options={[2, 4, 8, 16].map((n) => ({ value: n, text: `×${n}` }))}
                onChange={setVueltas}
              />
            </div>
            {/* En ámbar: la pista que sale la toca la máquina. */}
            <TextButton
              full
              tone="ai"
              disabled={transport !== 'stopped'}
              onClick={() => void printGroove(activo, vueltas, { complejidad, fuerza })}
            >
              {transport === 'stopped'
                ? `Pasar ${vueltas} vueltas a una pista`
                : 'Para el transporte para pasarlo'}
            </TextButton>
          </Field>
        </>
      ) : null}
    </Sheet>
  );
}
