'use client';

/**
 * Ajustes: solo lo de este equipo y tu cuenta. Entrada, salida, latencia,
 * aspecto, espacio, instalar y el diagnóstico del sonido.
 *
 * Lo de la idea (nombre, ideas guardadas, exportar, copias, borrar) se fue al
 * menú de la idea (Archivo en el PC, el nombre en el móvil) y a «Tus ideas»:
 * estaba aquí mezclado con el micro y no se encontraba ni lo uno ni lo otro.
 * La cuenta va arriba del todo, que es lo primero que se busca al entrar.
 */

import { useCallback, useEffect, useState } from 'react';
import { listInputDevices, listOutputDevices, sePuedeElegirSalida } from '@/lib/daw/recorder';
import type { CanalEntrada } from '@/lib/daw/types';
import type { Studio } from '@/hooks/useStudio';
import { CampoEspacio, CampoInstalar } from '@/components/pwa/AjustesPwa';
import { AvisoCambioEnLaAbierta, CampoCuenta } from '@/components/cuenta/Cuenta';
import type { Nube } from '@/hooks/useNube';
import type { ThemeMode } from './theme';
import { CreditosDeSonidos } from './instrumentos';
import { inputStyle } from './TrackPanel';
import { Field, Readout, Segmented, Sheet, Slider, T, TextButton, Toggle, hintText, label, numeric } from './ui';

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
  nube,
}: {
  studio: Studio;
  theme: { mode: ThemeMode; resolved: 'dark' | 'light'; setMode: (mode: ThemeMode) => void };
  open: boolean;
  onClose: () => void;
  /** Cuenta (pilar D). Sin configuración de Firebase no pinta nada. */
  nube?: Nube;
}) {
  const {
    settings,
    engine,
    currentLatencyMs,
    latencia,
    updateSettings,
    reopenMic,
    runCalibration,
    diagnostics,
  } = studio;

  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [salidas, setSalidas] = useState<MediaDeviceInfo[]>([]);
  const [phase, setPhase] = useState<CalibrationPhase>('idle');
  const [result, setResult] = useState<string | null>(null);
  // Instalar ya no vive aquí: el evento de Android es uno y lo comparte con
  // los avisos (src/lib/pwa/instalacion.ts, campo en AjustesPwa).

  const refresh = useCallback(async () => {
    // El espacio lo mide CampoEspacio con storage.estimate(): leer todo el
    // audio a memoria para sumarlo era lento con muchas ideas.
    setDevices(await listInputDevices());
    if (sePuedeElegirSalida()) setSalidas(await listOutputDevices());
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
      {/* Cuenta (pilar D): si la idea abierta cambió en otro dispositivo, se decide aquí, lo primero. */}
      {nube ? <AvisoCambioEnLaAbierta nube={nube} /> : null}
      {/* Tu cuenta de Aura, arriba del todo: es lo primero que se busca al entrar en Ajustes. */}
      {nube ? <CampoCuenta nube={nube} abierto={open} /> : null}

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
        <label style={{ display: 'block', marginBottom: 10 }}>
          <span style={{ ...hintText, display: 'block', margin: '0 0 6px', fontSize: 13 }}>
            Qué se graba. Si en tu interfaz tienes el micro en una entrada y el teclado en otra, elige cuál.
          </span>
          <select
            value={settings.canalEntrada ?? 'juntas'}
            onChange={(event) => void reopenMic({ canalEntrada: event.target.value as CanalEntrada })}
            aria-label="Qué entrada se graba"
            style={{ ...inputStyle, appearance: 'auto' }}
          >
            <option value="juntas">Las dos entradas juntas</option>
            <option value="entrada-1">Solo la entrada 1 (izquierda)</option>
            <option value="entrada-2">Solo la entrada 2 (derecha)</option>
          </select>
        </label>
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

      {salidas.length > 0 ? (
        <Field
          title="Salida"
          hint="Por dónde suena todo el estudio. Elige tu interfaz de audio para escucharlo en sus cascos. Si no salen los nombres, permite el micro y vuelve a abrir Ajustes."
        >
          <select
            value={settings.outputDeviceId ?? ''}
            onChange={(event) => updateSettings({ outputDeviceId: event.target.value || null })}
            aria-label="Salida de audio"
            style={{ ...inputStyle, appearance: 'auto' }}
          >
            <option value="">Salida del sistema</option>
            {salidas.map((device, i) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label || `Salida ${i + 1}`}
              </option>
            ))}
          </select>
        </Field>
      ) : null}

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


      <Field title="Aspecto">
        <Segmented ariaLabel="Aspecto" value={theme.mode} options={themes} onChange={theme.setMode} />
      </Field>

      <CampoEspacio abierto={open} />
      <CampoInstalar />

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

      {/* Pilar B: de dónde salen los sonidos de los instrumentos (CC BY exige el crédito a la vista). */}
      <CreditosDeSonidos />
    </Sheet>
  );
}
