'use client';

import { useCallback, useEffect, useState } from 'react';
import { downloadBlob, encodeWav, slugify } from '@/lib/daw/audio';
import { listInputDevices } from '@/lib/daw/recorder';
import { listProjects } from '@/lib/daw/storage';
import type { Project } from '@/lib/daw/types';
import type { Studio } from '@/hooks/useStudio';
import { CampoCopias, CampoEspacio, CampoInstalar } from '@/components/pwa/AjustesPwa';
import type { ThemeMode } from './theme';
import { CreditosDeSonidos } from './instrumentos';
import { inputStyle } from './TrackPanel';
import { Field, IconButton, IconTrash, Readout, Segmented, Sheet, Slider, T, TextButton, Toggle, hintText, label, numeric, tabular } from './ui';

type CalibrationPhase = 'idle' | 'instructions' | 'running' | 'done';

/** De dónde sale la compensación, dicho corto. */
const ORIGEN: Record<Studio['latencia']['origen'], string> = {
  ninguna: 'Sin calibrar',
  estimada: 'Estimada',
  medida: 'Calibrada',
  tomas: 'Ajustada con tus tomas',
};

export function SettingsSheet({
  studio,
  theme,
  open,
  onClose,
}: {
  studio: Studio;
  theme: { mode: ThemeMode; resolved: 'dark' | 'light'; setMode: (mode: ThemeMode) => void };
  open: boolean;
  onClose: () => void;
}) {
  const {
    project,
    settings,
    engine,
    currentLatencyMs,
    latencia,
    updateSettings,
    reopenMic,
    runCalibration,
    renameProject,
    newProject,
    openProject,
    removeProject,
    setStatus,
    diagnostics,
  } = studio;

  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [phase, setPhase] = useState<CalibrationPhase>('idle');
  const [result, setResult] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  // Instalar ya no vive aquí: el evento de Android es uno y lo comparte con
  // los avisos (src/lib/pwa/instalacion.ts, campo en AjustesPwa).

  const refresh = useCallback(async () => {
    setProjects(await listProjects());
    // El espacio lo mide CampoEspacio con storage.estimate(): leer todo el
    // audio a memoria para sumarlo era lento con muchas ideas.
    setDevices(await listInputDevices());
  }, []);

  useEffect(() => {
    if (open) void refresh();
  }, [open, refresh]);

  const calibrate = async () => {
    setPhase('running');
    setResult(null);
    const outcome = await runCalibration();
    setResult(outcome?.message ?? 'No he podido medir.');
    setPhase('done');
  };

  /**
   * Compartir o descargar, con red de seguridad.
   *
   * `navigator.share` fallaba de dos formas que el código anterior confundía
   * con "no he podido generar la mezcla", que es mentira: la mezcla ya está
   * hecha en ese punto.
   *
   *  1. El usuario cierra la hoja de compartir sin elegir nada. Eso lanza
   *     `AbortError` y NO es un fallo: es que se ha arrepentido a mitad.
   *  2. En Safari, `navigator.share` exige llamarse dentro del gesto del
   *     usuario. Si `renderMix` (que mezcla con un OfflineAudioContext) tarda
   *     aunque sea medio segundo, el gesto ya ha caducado y comparte falla con
   *     `NotAllowedError`, con la mezcla ya renderizada y perdida detrás de un
   *     mensaje que sonaba a que no se había hecho nada.
   *
   * Aquí un cancelado no dice nada, cualquier otro fallo de compartir cae a
   * descargar en vez de rendirse, y solo si las dos vías fallan se avisa,
   * dejando claro que la toma en sí sigue a salvo, porque exportar es sacar
   * una copia, no el sitio donde vive el audio.
   */
  const shareOrDownload = async (blob: Blob, filename: string, title: string, share: boolean) => {
    const file = new File([blob], filename, { type: 'audio/wav' });
    if (share) {
      try {
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], title });
          return 'compartida';
        }
      } catch (error) {
        if ((error as DOMException)?.name === 'AbortError') return 'cancelada';
        // Cualquier otro fallo al compartir (gesto caducado, no soportado):
        // se intenta la descarga en vez de darse por vencido.
      }
    }
    downloadBlob(blob, filename);
    return 'descargada';
  };

  const exportMix = async (share: boolean) => {
    if (!engine || project.tracks.length === 0) {
      setStatus('No hay pistas que exportar');
      return;
    }
    setExporting(true);
    try {
      const buffer = await engine.renderMix(project);
      const blob = encodeWav(buffer);
      const filename = `${slugify(project.name)}.wav`;
      const resultado = await shareOrDownload(blob, filename, project.name, share);
      if (resultado === 'cancelada') {
        setStatus(null);
      } else {
        setStatus(
          resultado === 'compartida'
            ? 'Mezcla compartida'
            : 'Mezcla descargada. La toma sigue guardada en el estudio de todos modos.',
        );
      }
    } catch {
      setStatus(
        'No he podido generar el WAV para exportar, pero la grabación sigue guardada en este móvil: no se ha perdido nada.',
      );
    } finally {
      setExporting(false);
    }
  };

  const exportStems = async () => {
    if (!engine || project.tracks.length === 0) return;
    setExporting(true);
    try {
      for (const [index, track] of project.tracks.entries()) {
        const buffer = await engine.renderMix(project, [track]);
        const blob = encodeWav(buffer);
        const filename = `${slugify(project.name)}-${index + 1}-${slugify(track.name)}.wav`;
        // Compartir un fichero a la vez: Safari en iOS descarta el resto si
        // se lanzan varios seguidos desde el mismo gesto.
        await shareOrDownload(blob, filename, track.name, false);
        await new Promise((resolve) => setTimeout(resolve, 350));
      }
      setStatus('Pistas exportadas');
    } catch {
      setStatus('No he podido exportar todas las pistas, pero nada se ha perdido: siguen en el estudio.');
    } finally {
      setExporting(false);
    }
  };

  const themes: { value: ThemeMode; text: string }[] = [
    { value: 'light', text: 'Claro' },
    { value: 'dark', text: 'Oscuro' },
    { value: 'system', text: 'Sistema' },
  ];

  const panel: React.CSSProperties = {
    padding: 16,
    borderRadius: 14,
    background: T.fill,
    boxShadow: `inset 0 1px 0 ${T.rim}`,
  };

  return (
    <Sheet open={open} title="Ajustes" onClose={onClose}>
      {/* Lo que más se toca, arriba: la idea en la que estás y cómo sacarla. */}
      <Field title="Proyecto">
        <input
          value={project.name}
          onChange={(event) => renameProject(event.target.value)}
          maxLength={60}
          aria-label="Nombre del proyecto"
          style={{ ...inputStyle, marginBottom: 10 }}
        />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <TextButton
            full
            onClick={async () => {
              await newProject();
              await refresh();
            }}
          >
            Empezar otra idea
          </TextButton>
          <TextButton full disabled={exporting} onClick={() => void exportMix(true)}>
            {exporting ? 'Generando…' : 'Compartir mezcla'}
          </TextButton>
          <TextButton full disabled={exporting} onClick={() => void exportMix(false)}>
            Descargar WAV
          </TextButton>
          <TextButton full disabled={exporting} onClick={() => void exportStems()}>
            Pistas sueltas
          </TextButton>
        </div>
      </Field>

      <Field title="Ideas guardadas">
        <div style={{ borderRadius: 14, background: T.fill, boxShadow: `inset 0 1px 0 ${T.rim}`, overflow: 'hidden' }}>
          {projects.map((item, i) => {
            const actual = item.id === project.id;
            return (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '0 4px 0 0',
                  background: actual ? T.fillStrong : 'transparent',
                  boxShadow: i > 0 ? `inset 0 1px 0 ${T.rowLine}` : 'none',
                }}
              >
                <button
                  type="button"
                  className="daw-hover"
                  onClick={async () => {
                    await openProject(item.id);
                    onClose();
                  }}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    minHeight: 56,
                    textAlign: 'left',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '8px 12px 8px 16px',
                  }}
                >
                  <span
                    style={{
                      display: 'block',
                      fontFamily: T.fontBody,
                      fontSize: 15,
                      fontWeight: actual ? 600 : 500,
                      letterSpacing: '-0.01em',
                      color: T.text,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {item.name}
                  </span>
                  <span style={{ ...label, display: 'block', marginTop: 2 }}>
                    {actual ? 'Abierta · ' : ''}
                    <span style={tabular}>{item.tracks.length}</span> {item.tracks.length === 1 ? 'pista' : 'pistas'} ·{' '}
                    <span style={tabular}>{new Date(item.updatedAt).toLocaleDateString('es-ES')}</span>
                  </span>
                </button>
                <IconButton
                  title={`Borrar ${item.name}`}
                  onClick={async () => {
                    await removeProject(item);
                    await refresh();
                  }}
                >
                  <IconTrash size={17} color={T.dim} />
                </IconButton>
              </div>
            );
          })}
          {projects.length === 0 ? (
            <p style={{ ...hintText, padding: 16 }}>Todavía no has guardado nada.</p>
          ) : null}
        </div>
      </Field>

      {/* PWA (pilar E): la idea en un zip, y cuánto ocupa todo. */}
      <CampoCopias
        studio={studio}
        onImportada={() => {
          void refresh();
          onClose();
        }}
      />
      <CampoEspacio abierto={open} />

      <Field
        title="Latencia"
        intro="Es el retardo entre lo que suena por los cascos y lo que entra por el micro. El estudio adelanta cada toma exactamente esta cantidad: es lo que hace que la segunda pista caiga donde la tocaste y no medio tiempo tarde."
      >
        <div style={{ ...panel, marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Readout value={currentLatencyMs} unit="ms" size={38} />
              <span style={label}>Compensados en cada toma</span>
            </span>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '5px 10px',
                borderRadius: 999,
                background: latencia.origen === 'ninguna' ? 'transparent' : T.fillStrong,
                boxShadow: latencia.origen === 'ninguna' ? `inset 0 0 0 1px ${T.borderStrong}` : 'none',
                fontFamily: T.fontBody,
                fontSize: 12,
                fontWeight: 600,
                color: T.text,
                whiteSpace: 'nowrap',
              }}
            >
              {ORIGEN[latencia.origen]}
            </span>
          </div>
        </div>

        {phase === 'running' ? (
          <div style={{ ...panel, fontFamily: T.fontBody, fontSize: 15, fontWeight: 500, color: T.text }}>
            Midiendo. No toques el móvil durante unos segundos.
          </div>
        ) : phase === 'instructions' ? (
          <div style={panel}>
            <p style={{ fontFamily: T.fontBody, fontSize: 15, lineHeight: 1.5, color: T.text, marginBottom: 12 }}>
              Voy a lanzar cinco clicks por el altavoz y escucharlos por el micro para medir cuánto tardan en dar
              la vuelta. Necesito que:
            </p>
            <ol style={{ ...hintText, fontSize: 14, lineHeight: 1.7, paddingLeft: 20, marginBottom: 16 }}>
              <li>Te quites los cascos y no tapes el altavoz.</li>
              <li>Subas el volumen del móvil a tope.</li>
              <li>Lo dejes quieto sobre una mesa y no hables.</li>
            </ol>
            <TextButton full tone="solid" onClick={calibrate}>
              Empezar la medición
            </TextButton>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <TextButton tone="solid" onClick={() => setPhase('instructions')}>
              Calibrar automáticamente
            </TextButton>
            {settings.calibrated ? (
              <TextButton onClick={() => updateSettings({ calibrated: false })}>Ajustar a mano</TextButton>
            ) : null}
          </div>
        )}

        {result && phase === 'done' ? (
          <p style={{ ...hintText, color: T.text, marginTop: 12 }}>{result}</p>
        ) : null}

        <div style={{ marginTop: 20 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 2 }}>
            <span style={{ ...label, color: T.text, fontWeight: 600 }}>Ajuste manual</span>
            <span style={{ ...numeric, fontSize: 13, color: T.text }}>{settings.latencyMs} ms</span>
          </div>
          <Slider
            ariaLabel="Compensación de latencia en milisegundos"
            value={settings.latencyMs}
            min={0}
            max={400}
            step={5}
            onChange={(value) => updateSettings({ latencyMs: value })}
          />
          <p style={{ ...hintText, marginTop: 6 }}>
            Con cascos por cable la medición automática vale tal cual. Con Bluetooth el retardo es mucho mayor y
            cambia según el modelo: graba una toma corta contra el metrónomo y sube o baja este valor hasta que
            encaje. Se guarda para la próxima vez.
          </p>
        </div>
      </Field>

      <Field title="Entrada">
        {devices.length > 1 ? (
          <select
            value={settings.inputDeviceId ?? ''}
            onChange={(event) => void reopenMic({ inputDeviceId: event.target.value || null })}
            aria-label="Micrófono"
            style={{ ...inputStyle, marginBottom: 10, appearance: 'auto' }}
          >
            <option value="">Entrada por defecto</option>
            {devices.map((device) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label || 'Micrófono'}
              </option>
            ))}
          </select>
        ) : null}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Toggle
            checked={settings.echoCancellation}
            onChange={(next) => void reopenMic({ echoCancellation: next })}
            title="Cancelación de eco"
            detail="Pensada para videollamadas: recorta transitorios y bombea el volumen. Actívala solo si grabas por altavoz y se te cuela lo que ya sonaba."
          />
          <Toggle
            checked={settings.releaseMicOnStop}
            onChange={(next) => updateSettings({ releaseMicOnStop: next })}
            title="Soltar el micro al parar"
            detail="En iPhone, con el micro abierto el sistema baja el volumen y lo grabado se oye flojo. Soltándolo entre tomas se recupera; a cambio, el vúmetro solo se mueve mientras grabas."
          />
        </div>
      </Field>

      <Field title="Aspecto">
        <Segmented ariaLabel="Aspecto" value={theme.mode} options={themes} onChange={theme.setMode} />
      </Field>

      <CampoInstalar />

      {/* Pilar B: de dónde salen los sonidos de los instrumentos (CC BY exige el crédito a la vista). */}
      <CreditosDeSonidos />

      {/* Lo de cuando algo no suena: abajo, que se busca solo cuando hace falta. */}
      <Field
        title="Sonido"
        intro="Si el tono no se oye, el problema es la salida del iPhone y no las pistas: sube el volumen con los botones laterales y quita el interruptor de silencio."
      >
        <TextButton
          full
          onClick={() => {
            engine?.unlockSync();
            void engine?.playTestTone();
          }}
        >
          Probar sonido
        </TextButton>
        <details style={{ marginTop: 12 }}>
          <summary
            style={{
              ...label,
              cursor: 'pointer',
              minHeight: 44,
              display: 'flex',
              alignItems: 'center',
              listStyle: 'none',
            }}
          >
            Ver diagnóstico
          </summary>
          <pre
            style={{
              margin: 0,
              padding: '12px 14px',
              borderRadius: 12,
              background: T.fill,
              fontFamily: T.fontMono,
              fontSize: 11,
              lineHeight: 1.7,
              color: T.dim,
              whiteSpace: 'pre-wrap',
              overflowX: 'auto',
            }}
          >
            {Object.entries(diagnostics())
              .map(([clave, valor]) => `${clave}: ${valor}`)
              .join('\n')}
          </pre>
        </details>
      </Field>
    </Sheet>
  );
}
