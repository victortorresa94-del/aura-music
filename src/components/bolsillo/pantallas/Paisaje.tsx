'use client';

/**
 * Un paisaje largo, gratis: el móvil alarga una canción (o solo capas) y le
 * pone encima un tono, ruido, binaural o pulso. Sueño:
 * docs/bolsillo/suenos/4-paisaje-cuidado.jpg. Se dice para qué está pensado
 * («para bajar el ritmo»), nunca qué cura.
 */

import { useState } from 'react';
import { T } from '@/components/daw/theme';
import { almacen } from '@/lib/bolsillo/almacen';
import { nuevaCancion, nuevaVersion, quedarme } from '@/lib/bolsillo/biblioteca';
import { pedirCrear } from '@/lib/bolsillo/crear/pendiente';
import { renderizarPaisaje, tonoGraveParaAltavoz } from '@/lib/bolsillo/paisaje/render';
import type { CapasPaisaje, Receta } from '@/lib/bolsillo/tipos';
import { useBolsillo } from '../contexto';
import { Aviso, BotonPrincipal, BotonSecundario, Cabecera, Chip, Seccion, Tarjeta } from '../kit';

const DURACIONES = [
  { seg: 1200, texto: '20 min' },
  { seg: 3600, texto: '1 h' },
  { seg: 7200, texto: '2 h' },
  { seg: 28800, texto: 'Hasta que lo pare' },
];

type Color = 'blanco' | 'rosa' | 'marron';

function Deslizador({ etiqueta, valor, alCambiar }: { etiqueta: string; valor: number; alCambiar: (v: number) => void }) {
  return (
    <input
      type="range"
      className="daw-slider"
      min={0}
      max={1}
      step={0.05}
      value={valor}
      aria-label={etiqueta}
      onChange={(e) => alCambiar(Number(e.target.value))}
      style={{ ['--p' as string]: `${valor * 100}%` }}
    />
  );
}

export function PantallaPaisaje({ cancionId }: { cancionId?: string }) {
  const { biblioteca, reproductor, nav } = useBolsillo();
  const base = cancionId ? biblioteca.cancion(cancionId) : undefined;
  const versionBase = base ? biblioteca.versionQueSuena(base) : null;
  const [duracion, setDuracion] = useState(3600);
  const [tono, setTono] = useState({ activo: !base, hz: 142, nivel: 0.2 });
  const [ruido, setRuido] = useState({ activo: !base, color: 'marron' as Color, nivel: 0.35 });
  const [binaural, setBinaural] = useState({ activo: false, baseHz: 142, difHz: 6, nivel: 0.2 });
  const [cuidado, setCuidado] = useState(true);
  const [progreso, setProgreso] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const capas: CapasPaisaje = {
    ...(tono.activo ? { tono: { hz: tono.hz, nivel: tono.nivel } } : {}),
    ...(ruido.activo ? { ruido: { color: ruido.color, nivel: ruido.nivel } } : {}),
    ...(binaural.activo ? { binaural: { baseHz: binaural.baseHz, difHz: binaural.difHz, nivel: binaural.nivel } } : {}),
  };
  const nada = !base && !Object.keys(capas).length;

  const preparar = async () => {
    setError(null);
    setProgreso(0);
    try {
      let audioBase: Blob | null = null;
      if (versionBase?.audioId) audioBase = await almacen().audios.leer(versionBase.audioId);
      if (!audioBase && versionBase?.urlRemota) {
        try {
          const r = await fetch(versionBase.urlRemota);
          if (r.ok) audioBase = await r.blob();
        } catch {
          /* sin CORS */
        }
      }
      if (base && !audioBase) {
        setError('No puedo leer el audio de esa canción en este móvil. Puedo hacer el paisaje solo con las capas.');
        setProgreso(null);
        return;
      }
      const wav = await renderizarPaisaje(audioBase, capas, { cuidado, alAvanzar: setProgreso });
      const receta: Receta = {
        tipo: 'paisaje',
        momento: 'desconectar',
        frase: base ? `Alargar «${base.titulo}»` : 'Paisaje con capas',
        conVoz: false,
        duracionSeg: duracion,
        capas,
        motor: 'falso',
      };
      const titulo = base ? `${base.titulo}, larga` : tono.activo ? `Para bajar el ritmo a ${tono.hz} Hz` : 'Para bajar el ritmo';
      const cancion = nuevaCancion(receta, { titulo, porque: base ? `«${base.titulo}» alargada para escucharla un buen rato.` : 'Para bajar el ritmo, sin prisa.' });
      const version = { ...nuevaVersion(cancion, [], receta, { cambio: 'Hecho en el móvil', creditos: 0 }), estado: 'lista' as const, audioId: `aud_${cancion.id}`, bucle: true };
      await almacen().audios.poner(version.audioId, wav);
      await almacen().versiones.poner(version);
      await almacen().canciones.poner(quedarme(cancion, version.id));
      reproductor.ponerModoCuidado(cuidado);
      await reproductor.tocar(cancion.id, { versionId: version.id });
      nav.atras();
      setTimeout(() => nav.ir({ tipo: 'cancion', id: cancion.id }), 60);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No ha salido. Prueba otra vez.');
    } finally {
      setProgreso(null);
    }
  };

  const fila = (titulo: string, activo: boolean, alternar: () => void, hijos?: React.ReactNode, nota?: string) => (
    <div style={{ padding: '12px 0', borderTop: `1px solid ${T.rowLine}` }}>
      <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 44, fontSize: 16 }}>
        <span>
          {titulo}
          {nota ? <span style={{ display: 'block', fontSize: 13, color: T.dim }}>{nota}</span> : null}
        </span>
        <input type="checkbox" checked={activo} onChange={alternar} style={{ width: 24, height: 24, accentColor: T.ai }} />
      </label>
      {activo ? hijos : null}
    </div>
  );

  return (
    <>
      <Cabecera
        titulo={base ? `«${base.titulo}», larga` : 'Para bajar el ritmo'}
        subtitulo={base ? 'Se repite sin cortes el tiempo que quieras. Gratis: lo hace el móvil.' : 'Capas que hace el móvil, sin gastar nada. Para concentrarte, desconectar o dormir.'}
        onAtras={nav.atras}
      />

      <Seccion titulo="Cuánto dura">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {DURACIONES.map((d) => (
            <Chip key={d.seg} elegido={duracion === d.seg} onClick={() => setDuracion(d.seg)}>
              {d.texto}
            </Chip>
          ))}
        </div>
      </Seccion>

      <Tarjeta style={{ marginTop: 20, paddingTop: 4, paddingBottom: 4 }}>
        {fila(
          `Tono de ${tono.hz} Hz`,
          tono.activo,
          () => setTono({ ...tono, activo: !tono.activo }),
          <>
            <input
              type="number"
              inputMode="numeric"
              min={40}
              max={1000}
              value={tono.hz}
              onChange={(e) => setTono({ ...tono, hz: Math.max(40, Math.min(1000, Number(e.target.value) || 142)) })}
              aria-label="Frecuencia del tono en Hz"
              style={{ width: 96, fontSize: 16, padding: '8px 10px', borderRadius: 10, border: 'none', background: T.fill, marginBottom: 6 }}
            />
            <Deslizador etiqueta="Volumen del tono" valor={tono.nivel} alCambiar={(v) => setTono({ ...tono, nivel: v })} />
          </>,
        )}
        {fila(
          'Ruido',
          ruido.activo,
          () => setRuido({ ...ruido, activo: !ruido.activo }),
          <>
            <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
              {(['marron', 'rosa', 'blanco'] as Color[]).map((c) => (
                <Chip key={c} elegido={ruido.color === c} onClick={() => setRuido({ ...ruido, color: c })}>
                  {c === 'marron' ? 'Marrón' : c === 'rosa' ? 'Rosa' : 'Blanco'}
                </Chip>
              ))}
            </div>
            <Deslizador etiqueta="Volumen del ruido" valor={ruido.nivel} alCambiar={(v) => setRuido({ ...ruido, nivel: v })} />
          </>,
        )}
        {fila(
          'Binaural',
          binaural.activo,
          () => setBinaural({ ...binaural, activo: !binaural.activo }),
          <Deslizador etiqueta="Volumen del binaural" valor={binaural.nivel} alCambiar={(v) => setBinaural({ ...binaural, nivel: v })} />,
          'Necesita auriculares: un tono distinto en cada oído.',
        )}
        {fila('Modo cuidado', cuidado, () => setCuidado(!cuidado), undefined, 'Más bajo, sin picos y la pantalla a oscuras.')}
      </Tarjeta>

      {tonoGraveParaAltavoz(capas) ? (
        <p style={{ fontSize: 14, color: T.dim, marginTop: 12 }}>El altavoz del móvil casi no da {tono.hz} Hz. Mejor con auriculares.</p>
      ) : null}

      {error ? <div style={{ marginTop: 12 }}><Aviso>{error}</Aviso></div> : null}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 20 }}>
        <BotonPrincipal creditos={0} disabled={nada || progreso !== null} onClick={() => void preparar()}>
          {progreso !== null ? `Preparándolo ${Math.round(progreso * 100)} %` : 'Prepararlo'}
        </BotonPrincipal>
        {!base ? (
          <BotonSecundario
            full
            onClick={() => {
              pedirCrear({ tipo: 'paisaje', frase: `Para bajar el ritmo, lenta y sin voz${tono.activo ? `, con un tono de ${tono.hz} Hz` : ''}` });
              nav.pestana('crear');
            }}
          >
            Con música nueva
          </BotonSecundario>
        ) : null}
        <p style={{ textAlign: 'center', fontSize: 13, color: T.faint }}>Si te molesta, páralo.</p>
      </div>
    </>
  );
}
