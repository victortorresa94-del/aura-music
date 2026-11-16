'use client';

import { useRef, useState } from 'react';
import type { Studio } from '@/hooks/useStudio';
import { haptic, trackTint } from './theme';
import {
  Field,
  IconButton,
  IconChevronRight,
  IconCopy,
  IconMinus,
  IconPlus,
  IconRepeat,
  IconTrash,
  IconVolume,
  Readout,
  Segmented,
  Sheet,
  Slider,
  T,
  TextButton,
  Toggle,
  hintText,
  label,
  numeric,
  tabular,
} from './ui';

/** Ganancia lineal a decibelios, como la escribe un músico: «−6,0 dB». */
function decibelios(lineal: number): string {
  if (lineal <= 0.0001) return '−∞ dB';
  const db = 20 * Math.log10(lineal);
  const texto = Math.abs(db).toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  if (Math.abs(db) < 0.05) return '0,0 dB';
  return `${db < 0 ? '−' : '+'}${texto} dB`;
}

/** Campo de texto de la casa: 16 px para que Safari no amplíe al enfocar. */
export const inputStyle: React.CSSProperties = {
  width: '100%',
  minHeight: 48,
  padding: '0 14px',
  borderRadius: 12,
  border: 'none',
  background: T.fill,
  boxShadow: `inset 0 0 0 1px ${T.border}`,
  color: T.text,
  fontFamily: T.fontBody,
  fontSize: 16,
  letterSpacing: '-0.01em',
  outline: 'none',
};

/**
 * La pista elegida, siempre a mano: su nombre (que abre todo lo demás) y su
 * volumen. Vive en lo alto del dock del transporte y solo aparece cuando hay
 * una pista elegida; sin pista, no ocupa sitio diciendo «toca una pista».
 */
export function TrackStrip({
  studio,
  onOpenTrack,
  theme = 'dark',
}: {
  studio: Studio;
  onOpenTrack: () => void;
  theme?: 'dark' | 'light';
}) {
  const { selectedTrack, setVolume, project } = studio;
  if (!selectedTrack) return null;

  const index = project.tracks.findIndex((track) => track.id === selectedTrack.id);
  const tint = trackTint(Math.max(0, index), theme);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        paddingBottom: 10,
        marginBottom: 12,
        boxShadow: `inset 0 -1px 0 ${T.rowLine}`,
      }}
    >
      {/* Chip: tiene que parecer un botón, no una etiqueta. Un texto que hace
          algo pero no lo parece es la forma más barata de esconder una función. */}
      <button
        type="button"
        className="daw-press daw-hover"
        onClick={() => {
          haptic(8);
          onOpenTrack();
        }}
        aria-label={`Editar ${selectedTrack.name}`}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          minHeight: 40,
          padding: '0 8px 0 10px',
          border: 'none',
          borderRadius: 10,
          background: T.fill,
          boxShadow: `inset 0 1px 0 ${T.rim}`,
          color: T.text,
          cursor: 'pointer',
          minWidth: 0,
          maxWidth: '46%',
          flexShrink: 0,
          touchAction: 'manipulation',
        }}
      >
        {selectedTrack.ia ? (
          <span style={{ padding: '2px 4px', borderRadius: 4, background: T.aiSoft, color: T.ai, fontSize: 10, fontWeight: 700, lineHeight: 1, flexShrink: 0 }}>
            IA
          </span>
        ) : (
          <span aria-hidden style={{ width: 10, height: 10, borderRadius: 3, background: tint, flexShrink: 0 }} />
        )}
        <span
          style={{
            fontFamily: T.fontBody,
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: '-0.01em',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {selectedTrack.name}
        </span>
        <IconChevronRight size={12} color={T.dim} />
      </button>

      {/* En pantallas anchas el volumen no se estira a 800 px: un fader
          largo no es más preciso, solo más lejano. */}
      <div style={{ flex: 1, minWidth: 0, maxWidth: 380, marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
        <IconVolume size={16} color={T.dim} />
        <Slider
          ariaLabel={`Volumen de ${selectedTrack.name}`}
          value={Math.round(selectedTrack.volume * 100)}
          min={0}
          max={150}
          onChange={(value) => setVolume(selectedTrack.id, value / 100)}
        />
        <span style={{ ...numeric, fontSize: 12, color: T.dim, width: 58, textAlign: 'right', flexShrink: 0 }}>
          {decibelios(selectedTrack.volume)}
        </span>
      </div>
    </div>
  );
}

/** Todo lo demás de la pista, en un panel que se abre solo cuando hace falta. */
export function TrackSheet({
  studio,
  open,
  onClose,
  onOpenMusico,
}: {
  studio: Studio;
  open: boolean;
  onClose: () => void;
  onOpenMusico: () => void;
}) {
  const { selectedTrack, updateTrack, updateClip, deleteTrack, duplicateTrack, analizarTempo, setBpm } =
    studio;
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [tempo, setTempo] = useState<{
    bpm: number;
    confianza: number;
    alternativas: number[];
  } | null>(null);

  if (!selectedTrack) return <Sheet open={open} title="Pista" onClose={onClose}>{null}</Sheet>;

  const { clip } = selectedTrack;
  const nudge = (ms: number) => {
    updateClip(selectedTrack.id, { start: Math.max(0, clip.start + ms / 1000) });
  };
  const segundos = (valor: number) =>
    `${valor.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} s`;

  return (
    <Sheet open={open} title="Pista" onClose={onClose}>
      <Field title="Nombre">
        <input
          value={selectedTrack.name}
          onChange={(event) => updateTrack(selectedTrack.id, { name: event.target.value }, { history: false })}
          maxLength={40}
          aria-label="Nombre de la pista"
          style={inputStyle}
        />
      </Field>

      <Field
        title="Repetir el bloque"
        hint="Repite la toma tal cual, una detrás de otra. Útil para dejar un patrón de base sonando mientras grabas encima."
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Segmented
              ariaLabel="Repeticiones"
              mono
              value={clip.repeats}
              options={[1, 2, 4, 8].map((value) => ({ value, text: `×${value}` }))}
              onChange={(value) => updateClip(selectedTrack.id, { repeats: value })}
            />
          </div>
          <IconButton
            size={46}
            variant="filled"
            title="Una repetición más"
            onClick={() => updateClip(selectedTrack.id, { repeats: Math.min(32, clip.repeats + 1) })}
          >
            <IconRepeat size={18} />
          </IconButton>
        </div>
        {![1, 2, 4, 8].includes(clip.repeats) ? (
          <p style={{ ...hintText, marginTop: 8 }}>
            Ahora suena <span style={{ ...tabular, color: T.text, fontWeight: 600 }}>×{clip.repeats}</span>.
          </p>
        ) : null}
      </Field>

      <Field
        title="A qué tempo va esto"
        hint="Se analiza en el propio móvil y sale al momento. Si te lo saca a la mitad o al doble, ahí tienes los botones: pasa mucho con la bulería, que a 200 se parece igual a 100."
      >
        {tempo ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <Readout value={tempo.bpm || '?'} unit="BPM" />
              <span style={{ ...label, flex: 1 }}>
                {tempo.confianza > 0.6 ? 'Pulso claro' : tempo.confianza > 0.25 ? 'Pulso dudoso' : 'Sin pulso claro'}
              </span>
              <TextButton
                tone="solid"
                disabled={!tempo.bpm}
                onClick={() => {
                  setBpm(Math.max(40, Math.min(300, tempo.bpm)));
                  onClose();
                }}
              >
                Usar
              </TextButton>
            </div>

            {/* Las otras candidatas, a un toque. Sacar el tempo es ambiguo por
                naturaleza (una bulería a 200 se parece igual a 100) y es más
                honesto enseñar las opciones que fingir una certeza que no hay. */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
              {[
                Math.round(tempo.bpm / 2),
                Math.round(tempo.bpm * 2),
                ...tempo.alternativas,
              ]
                .filter((valor, i, todos) => valor >= 40 && valor <= 300 && todos.indexOf(valor) === i && valor !== tempo.bpm)
                .slice(0, 4)
                .map((valor) => (
                  <button
                    key={valor}
                    type="button"
                    className="daw-press daw-hover"
                    onClick={() => setTempo({ ...tempo, bpm: valor })}
                    style={{
                      minHeight: 40,
                      padding: '0 14px',
                      borderRadius: 10,
                      border: 'none',
                      background: T.fill,
                      boxShadow: `inset 0 1px 0 ${T.rim}`,
                      color: T.text,
                      ...numeric,
                      fontSize: 13,
                      cursor: 'pointer',
                    }}
                  >
                    {valor}
                  </button>
                ))}
            </div>
          </div>
        ) : (
          <TextButton full onClick={() => setTempo(analizarTempo(selectedTrack.id))}>
            Analizar el tempo de esta toma
          </TextButton>
        )}
      </Field>

      {selectedTrack.ia ? null : (
        <Field
          title="Músico de sesión"
          hint="Escucha esta toma, saca el tempo y los acordes, y te toca bajo, batería o teclas a tu tempo. Al momento en el móvil, o con IA en la nube."
        >
          {/* En ámbar: lo que sale de aquí lo toca la máquina. */}
          <TextButton full tone="ai" onClick={onOpenMusico}>
            Ponle algo debajo
          </TextButton>
        </Field>
      )}

      <Field
        title="Ajuste fino"
        hint="Si la toma ha quedado un pelín adelantada o atrasada respecto al resto, muévela de 10 en 10 milisegundos hasta que encaje."
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.3fr 1fr 1fr', gap: 6, alignItems: 'center' }}>
          {[-100, -10].map((ms) => (
            <NudgeButton key={ms} ms={ms} onClick={() => nudge(ms)} />
          ))}
          <span style={{ ...numeric, textAlign: 'center', fontSize: 13, color: T.text }}>{segundos(clip.start)}</span>
          {[10, 100].map((ms) => (
            <NudgeButton key={ms} ms={ms} onClick={() => nudge(ms)} />
          ))}
        </div>
      </Field>

      <Field title="Recorte">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 12,
            marginBottom: 12,
            ...hintText,
          }}
        >
          <span>
            Entra en <span style={{ ...tabular, color: T.text, fontWeight: 600 }}>{segundos(clip.offset)}</span>
          </span>
          <span>
            Dura <span style={{ ...tabular, color: T.text, fontWeight: 600 }}>{segundos(clip.duration)}</span>
          </span>
        </div>
        <TextButton
          full
          onClick={() =>
            updateClip(selectedTrack.id, {
              offset: 0,
              duration: selectedTrack.sourceDuration,
            })
          }
        >
          Deshacer el recorte
        </TextButton>
      </Field>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
        <TextButton full onClick={() => duplicateTrack(selectedTrack.id)}>
          <IconCopy size={16} /> Duplicar
        </TextButton>
        {confirmDelete ? (
          <TextButton
            full
            tone="solid"
            onClick={() => {
              deleteTrack(selectedTrack.id);
              setConfirmDelete(false);
              onClose();
            }}
          >
            Confirmar borrado
          </TextButton>
        ) : (
          <TextButton full tone="danger" onClick={() => setConfirmDelete(true)}>
            <IconTrash size={16} /> Borrar
          </TextButton>
        )}
      </div>
    </Sheet>
  );
}

function NudgeButton({ ms, onClick }: { ms: number; onClick: () => void }) {
  return (
    <button
      type="button"
      className="daw-press daw-hover"
      onClick={() => {
        haptic(6);
        onClick();
      }}
      aria-label={`${ms > 0 ? 'Atrasar' : 'Adelantar'} ${Math.abs(ms)} milisegundos`}
      style={{
        minHeight: 44,
        border: 'none',
        borderRadius: 10,
        background: T.fill,
        boxShadow: `inset 0 1px 0 ${T.rim}`,
        color: T.text,
        ...numeric,
        fontSize: 13,
        cursor: 'pointer',
        touchAction: 'manipulation',
      }}
    >
      {ms > 0 ? `+${ms}` : `−${Math.abs(ms)}`}
    </button>
  );
}

/** Tempo y claqueta: tempo, click, compases de entrada y rejilla. */
export function ClickSheet({
  studio,
  open,
  onClose,
}: {
  studio: Studio;
  open: boolean;
  onClose: () => void;
}) {
  const { project, settings, setBpm, updateSettings, toggleMetronome, engine } = studio;
  const tapsRef = useRef<number[]>([]);
  const [tapHint, setTapHint] = useState('Marcar el tempo');

  const tap = () => {
    const now = performance.now();
    const taps = tapsRef.current;
    // Si has parado más de dos segundos, empezamos a contar de cero.
    if (taps.length > 0 && now - taps[taps.length - 1] > 2500) taps.length = 0;
    taps.push(now);
    while (taps.length > 5) taps.shift();
    engine?.previewClick(false);
    if (taps.length >= 2) {
      const gaps: number[] = [];
      for (let i = 1; i < taps.length; i++) gaps.push(taps[i] - taps[i - 1]);
      const average = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
      const bpm = Math.round(60000 / average);
      if (bpm >= 40 && bpm <= 220) {
        setBpm(bpm);
        setTapHint(`${bpm} BPM`);
      }
    } else {
      setTapHint('Sigue marcando');
    }
  };

  return (
    <Sheet open={open} title="Tempo y claqueta" onClose={onClose}>
      <Field title="Tempo">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
          <IconButton size={48} variant="filled" title="Un BPM menos" onClick={() => setBpm(Math.max(40, project.bpm - 1))}>
            <IconMinus size={18} />
          </IconButton>
          <Readout value={project.bpm} unit="BPM" size={44} />
          <IconButton size={48} variant="filled" title="Un BPM más" onClick={() => setBpm(Math.min(220, project.bpm + 1))}>
            <IconPlus size={18} />
          </IconButton>
        </div>
        <Slider ariaLabel="Tempo" value={project.bpm} min={40} max={220} onChange={setBpm} />
        <div style={{ marginTop: 12 }}>
          <TextButton full onClick={tap}>
            {tapHint}
          </TextButton>
        </div>
      </Field>

      <Field title="Metrónomo">
        <Toggle
          checked={settings.metronome}
          onChange={() => toggleMetronome()}
          title="Click"
          detail="Suena en cada pulso mientras reproduces y grabas."
        />
        <div style={{ marginTop: 8 }}>
          <TextButton full onClick={() => engine?.previewClick(true)}>
            Probar el click
          </TextButton>
        </div>
      </Field>

      <Field
        title="Compases de entrada"
        hint="Los clicks que suenan antes de que empiece a grabar, para que entres a tiempo."
      >
        <Segmented
          ariaLabel="Compases de entrada"
          value={settings.countInBars}
          options={[0, 1, 2].map((bars) => ({
            value: bars,
            text: bars === 0 ? 'Sin cuenta' : `${bars} compás${bars > 1 ? 'es' : ''}`,
          }))}
          onChange={(bars) => updateSettings({ countInBars: bars })}
        />
      </Field>

      <Field title="Rejilla">
        <Toggle
          checked={settings.snapToGrid}
          onChange={(next) => updateSettings({ snapToGrid: next })}
          title="Pegar al pulso"
          detail="Al mover una pista, se pega al pulso más cercano. Si tocas sin metrónomo, déjalo apagado."
        />
      </Field>
    </Sheet>
  );
}
