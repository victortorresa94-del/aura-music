'use client';

/**
 * Lo de la app instalada que vive en Ajustes: copias de seguridad de la idea,
 * cuánto ocupa y cómo instalarla. Cada campo es un componente para que
 * `SettingsSheet` solo tenga que ponerlos en su sitio.
 */

import { useEffect, useRef, useState } from 'react';
import { downloadBlob } from '@/lib/daw/audio';
import * as store from '@/lib/daw/storage';
import {
  audiosDeLaIdea,
  crearZipDeIdea,
  ErrorDeCopia,
  leerZipDeIdea,
  nombreDelZip,
  prepararParaImportar,
  type AudioDeIdea,
} from '@/lib/pwa/copia';
import { esCuotaLlena, formatoBytes, medirEspacio, nivelDeEspacio, type Espacio } from '@/lib/pwa/espacio';
import { pedirInstalacion, plataformaActual } from '@/lib/pwa/instalacion';
import { useInstalacion } from '@/hooks/usePwa';
import type { Studio } from '@/hooks/useStudio';
import { Field, IconDownload, IconImport, T, TextButton, hintText, label, numeric, tabular } from '@/components/daw/ui';
import { IconCompartirIos, navegadorIphone, pasosIphone, textoSafariNoPasa } from './GuiaInstalar';

/* -------------------------------------------------------------------------- */
/* Copias                                                                      */
/* -------------------------------------------------------------------------- */

type Fase = 'quieta' | 'preparando' | 'lista' | 'importando';

/**
 * Exportar va en dos toques a propósito. Safari solo deja abrir la hoja de
 * compartir dentro del toque que la pide, y leer el audio y montar el zip
 * tarda: el primer toque prepara, el segundo comparte con el gesto fresco.
 */
export function CampoCopias({ studio, onImportada }: { studio: Studio; onImportada: () => void }) {
  const { project, engine, setStatus, openProject } = studio;
  const [fase, setFase] = useState<Fase>('quieta');
  const [copia, setCopia] = useState<{ fichero: File; compartible: boolean; faltan: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const entrada = useRef<HTMLInputElement | null>(null);

  // Si cambias de idea con la copia preparada, esa copia ya no es la de ahora.
  useEffect(() => {
    setCopia(null);
    setFase('quieta');
  }, [project.id]);

  const preparar = async () => {
    setError(null);
    setFase('preparando');
    try {
      const audios = new Map<string, AudioDeIdea>();
      let faltan = 0;
      for (const bufferId of audiosDeLaIdea(project)) {
        const guardado = await store.getAudio(bufferId);
        if (guardado) {
          audios.set(bufferId, guardado);
          continue;
        }
        // Lo que aún no ha llegado a disco pero suena: también va.
        const enMemoria = engine?.getBuffer(bufferId);
        if (enMemoria) {
          const channels: Float32Array[] = [];
          for (let c = 0; c < enMemoria.numberOfChannels; c++) channels.push(new Float32Array(enMemoria.getChannelData(c)));
          audios.set(bufferId, { channels, sampleRate: enMemoria.sampleRate });
        } else {
          faltan++;
        }
      }
      const zip = crearZipDeIdea(project, audios);
      // fflate reserva su propio ArrayBuffer (nunca uno compartido): el cambio de tipo es seguro.
      const fichero = new File([zip as Uint8Array<ArrayBuffer>], nombreDelZip(project), { type: 'application/zip' });
      const compartible = typeof navigator.canShare === 'function' && navigator.canShare({ files: [fichero] });
      setCopia({ fichero, compartible, faltan });
      setFase('lista');
    } catch {
      setError('No he podido preparar la copia. La idea sigue intacta en el móvil.');
      setFase('quieta');
    }
  };

  const terminar = (mensaje: string) => {
    setCopia(null);
    setFase('quieta');
    setStatus(mensaje);
  };

  const descargar = () => {
    if (!copia) return;
    downloadBlob(copia.fichero, copia.fichero.name);
    terminar(`Copia de «${project.name}» descargada`);
  };

  const compartir = async () => {
    if (!copia) return;
    try {
      await navigator.share({ files: [copia.fichero], title: project.name });
      terminar(`Copia de «${project.name}» hecha`);
    } catch (fallo) {
      // Cerrar la hoja sin elegir no es un fallo; cualquier otra cosa, a descargar.
      if ((fallo as DOMException)?.name === 'AbortError') return;
      descargar();
    }
  };

  const importar = async (fichero: File) => {
    setError(null);
    setFase('importando');
    try {
      const leida = leerZipDeIdea(new Uint8Array(await fichero.arrayBuffer()));
      const yaExiste = (await store.loadProject(leida.proyecto.id)) !== null;
      const { proyecto, audios } = prepararParaImportar(leida.proyecto, leida.audios, yaExiste);
      // El audio primero y el proyecto después: un proyecto nunca apunta a audio que no está.
      for (const [bufferId, audio] of audios) await store.putAudio(bufferId, audio.channels, audio.sampleRate);
      await store.saveProject(proyecto);
      await openProject(proyecto.id);
      setStatus(yaExiste ? `«${leida.proyecto.name}» ya estaba: la he metido como copia` : `Idea importada: «${proyecto.name}»`);
      onImportada();
    } catch (fallo) {
      setError(
        fallo instanceof ErrorDeCopia
          ? fallo.message
          : esCuotaLlena(fallo)
            ? 'No cabe en el móvil. Haz sitio borrando ideas que ya tengas copiadas.'
            : 'No he podido importar esa idea. Lo que tenías sigue igual.',
      );
    } finally {
      setFase((actual) => (actual === 'importando' ? 'quieta' : actual));
      if (entrada.current) entrada.current.value = '';
    }
  };

  const sinPistas = project.tracks.length === 0;
  const ocupada = fase === 'preparando' || fase === 'importando';

  return (
    <Field
      title="Copias de seguridad"
      intro="La idea entera en un zip: el proyecto y un WAV por pista. Guárdala en Archivos o en iCloud, o pásala a otro móvil."
    >
      {fase === 'lista' && copia ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <TextButton full tone="solid" onClick={copia.compartible ? () => void compartir() : descargar}>
            {copia.compartible ? <IconCompartirIos size={18} color={T.inverse} /> : <IconDownload size={18} color={T.inverse} />}
            {`${copia.compartible ? 'Guardar copia' : 'Descargar copia'} · ${formatoBytes(copia.fichero.size)}`}
          </TextButton>
          <TextButton
            full
            onClick={() => {
              setCopia(null);
              setFase('quieta');
            }}
          >
            Cancelar
          </TextButton>
          {copia.faltan > 0 ? (
            <p style={{ ...hintText, marginTop: 4 }}>
              {copia.faltan === 1
                ? 'Una pista no tiene audio guardado en el móvil: va en la copia, pero muda.'
                : `${copia.faltan} pistas no tienen audio guardado en el móvil: van en la copia, pero mudas.`}
            </p>
          ) : null}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <TextButton full disabled={ocupada || sinPistas} onClick={() => void preparar()}>
            {fase === 'preparando' ? (
              'Preparando…'
            ) : (
              <>
                <IconCompartirIos size={18} color={T.text} />
                Exportar idea
              </>
            )}
          </TextButton>
          <TextButton full disabled={ocupada} onClick={() => entrada.current?.click()}>
            {fase === 'importando' ? (
              'Importando…'
            ) : (
              <>
                <IconImport size={18} color={T.text} />
                Importar idea
              </>
            )}
          </TextButton>
        </div>
      )}
      <input
        ref={entrada}
        type="file"
        accept=".zip,application/zip"
        aria-label="Elegir el zip de una idea"
        style={{ display: 'none' }}
        onChange={(event) => {
          const fichero = event.target.files?.[0];
          if (fichero) void importar(fichero);
        }}
      />
      {error ? (
        <p role="alert" style={{ ...hintText, color: T.text, marginTop: 10 }}>
          {error}
        </p>
      ) : sinPistas && fase === 'quieta' ? (
        <p style={{ ...hintText, marginTop: 10 }}>Graba algo primero para poder exportar esta idea.</p>
      ) : null}
    </Field>
  );
}

/* -------------------------------------------------------------------------- */
/* Espacio                                                                     */
/* -------------------------------------------------------------------------- */

export function CampoEspacio({ abierto }: { abierto: boolean }) {
  const [espacio, setEspacio] = useState<Espacio | null>(null);
  const [medido, setMedido] = useState(false);

  useEffect(() => {
    if (!abierto) return;
    let vigente = true;
    void medirEspacio().then((medida) => {
      if (!vigente) return;
      setEspacio(medida);
      setMedido(true);
    });
    return () => {
      vigente = false;
    };
  }, [abierto]);

  if (!medido) return null;
  if (!espacio || espacio.cuota <= 0) {
    return (
      <Field title="Espacio">
        <p style={hintText}>Este navegador no dice cuánto ocupa la app.</p>
      </Field>
    );
  }

  const nivel = nivelDeEspacio(espacio);
  const proporcion = Math.min(1, espacio.usado / espacio.cuota);

  return (
    <Field title="Espacio">
      <div
        style={{
          padding: 16,
          borderRadius: 14,
          background: T.fill,
          boxShadow: `inset 0 1px 0 ${T.rim}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
          <span style={{ ...numeric, fontSize: 22, fontWeight: 500, color: T.text }}>{formatoBytes(espacio.usado)}</span>
          <span style={{ ...label, ...tabular }}>de {formatoBytes(espacio.cuota)}</span>
        </div>
        <div
          role="meter"
          aria-label="Espacio usado"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(proporcion * 100)}
          style={{ height: 4, borderRadius: 2, background: T.fillStrong, marginTop: 12, overflow: 'hidden' }}
        >
          <div
            style={{
              // Mínimo visible: 2 MB de 2 GB tienen que verse como «algo», no como nada.
              width: `${Math.max(proporcion * 100, espacio.usado > 0 ? 1.5 : 0)}%`,
              height: '100%',
              borderRadius: 2,
              background: T.text,
            }}
          />
        </div>
        {nivel !== 'holgado' ? (
          <p style={{ fontFamily: T.fontBody, fontSize: 14, fontWeight: 500, lineHeight: 1.45, color: T.text, marginTop: 12 }}>
            {nivel === 'lleno'
              ? 'No queda sitio: lo próximo que grabes no se podrá guardar. Exporta las ideas que no uses y bórralas.'
              : 'Queda poco sitio. Exporta las ideas que no uses y bórralas antes de grabar mucho más.'}
          </p>
        ) : null}
      </div>
      <p style={{ ...hintText, marginTop: 10 }}>
        {espacio.protegido === true
          ? 'Protegido: el navegador no lo borrará por su cuenta. Es todo lo que guarda la app, ideas y sonidos incluidos.'
          : espacio.protegido === false
            ? 'Sin proteger todavía: si al móvil le falta sitio, el navegador podría borrarlo. Instalar la app y grabar la primera toma lo protege.'
            : 'Es todo lo que guarda la app, ideas y sonidos incluidos.'}
      </p>
    </Field>
  );
}

/* -------------------------------------------------------------------------- */
/* Instalar                                                                    */
/* -------------------------------------------------------------------------- */

export function CampoInstalar() {
  const { instalada, puedePedir } = useInstalacion();
  const iphone = plataformaActual() === 'iphone';

  if (instalada) {
    return (
      <Field title="Instalar en el móvil" hint="Se abre a pantalla completa y funciona sin cobertura.">
        <span style={{ ...label, color: T.text }}>Instalada</span>
      </Field>
    );
  }

  if (puedePedir) {
    return (
      <Field title="Instalar en el móvil" hint="Se abre a pantalla completa, sin barra del navegador, y funciona sin cobertura.">
        <TextButton tone="solid" full onClick={() => void pedirInstalacion()}>
          Añadir a la pantalla de inicio
        </TextButton>
      </Field>
    );
  }

  if (iphone) {
    return (
      <Field title="Instalar en el móvil">
        <ol style={{ ...hintText, fontSize: 14, color: T.text, lineHeight: 1.7, paddingLeft: 20 }}>
          {pasosIphone().map((paso) => (
            <li key={paso.texto}>{paso.texto}</li>
          ))}
        </ol>
        <p style={{ ...hintText, marginTop: 10 }}>{textoSafariNoPasa(navegadorIphone())}</p>
      </Field>
    );
  }

  return (
    <Field
      title="Instalar en el móvil"
      hint="Desde el menú del navegador: «Instalar app» o «Añadir a pantalla de inicio». Se abre a pantalla completa y funciona sin cobertura."
    >
      <span style={label}>Desde el menú del navegador</span>
    </Field>
  );
}
