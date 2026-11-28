'use client';

/**
 * El reproductor de bolsillo: UN <audio> para toda la app (plan, partes 3.1 y
 * 3.6; asiento de Encore: un reproductor, el mismo en todas partes).
 *
 * Por qué así, y lo que no hay que descubrir tarde:
 * - Suena con un <audio>, nunca con Web Audio. En el iPhone el AudioContext se
 *   calla al bloquear la pantalla y un <audio> sigue sonando.
 * - El <audio> se crea UNA vez y se reutiliza. En el iPhone un elemento solo
 *   puede empezar a sonar desde un toque; una vez que ha sonado desde un toque,
 *   puede volver a hacerlo solo (la siguiente de la cola, la pantalla de
 *   bloqueo). Por eso `tocar` lo «despierta» con un silencio en el mismo toque,
 *   antes de esperar a leer el audio de IndexedDB: tras un `await` el toque ya
 *   no cuenta y el `play()` de verdad fallaría.
 * - Media Session pone el título, el artista, la portada y los controles en la
 *   pantalla de bloqueo. La portada generativa se pinta a PNG con canvas.
 * - Un paisaje (`version.bucle`) suena con `audio.loop` y la posición que se
 *   enseña es el tiempo TOTAL sonando. Se para solo al llegar a
 *   `receta.duracionSeg` o al temporizador, con un fundido de 8 s.
 * - ⚠️ En el iPhone `audio.volume` es de solo lectura (el volumen es el de los
 *   botones del móvil): ahí no hay fundido de salida ni volumen bajo del modo
 *   cuidado, se para en seco. El «sin picos» del modo cuidado lo hace el render
 *   del paisaje (`renderizarPaisaje(…, { cuidado })`), no este reproductor.
 *   `volumenControlable` dice si el volumen se puede tocar desde aquí.
 * - ⚠️ Con la pantalla bloqueada el navegador puede frenar los avisos de la
 *   página. El final del paisaje y el temporizador se comprueban con la hora de
 *   reloj en cada aviso del <audio>, así que se cumplen en cuanto llega el
 *   siguiente; si el navegador los congela del todo, el bucle sigue. Se mide
 *   en un iPhone de verdad antes de darlo por bueno.
 * - La posición se publica a ~4 Hz, no en cada fotograma: toda la app lee el
 *   reproductor por contexto y repintarla 60 veces por segundo es tirar batería.
 *   Quien necesite el punto exacto (comparar dos versiones en el mismo sitio)
 *   tiene `posicionAhora()`.
 * - Una escucha cuenta a los 30 s sonando de verdad (los saltos del
 *   deslizador no suman), una vez por cada vez que se toca.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Biblioteca } from './useBiblioteca';
import { almacen } from '@/lib/bolsillo/almacen';
import { versionQueSuena } from '@/lib/bolsillo/biblioteca';
import type { Cancion, Pista, Version } from '@/lib/bolsillo/tipos';
import { armarCola, decidirAnterior, siguienteIndice, type Cola } from '@/lib/bolsillo/reproductor/cola';
import {
  VOLUMEN_CUIDADO,
  apagaEnDe,
  cuidadoAlTocar,
  decidirParada,
  limiteDe,
  situarEnBucle,
  sumarSonado,
  totalEnBucle,
  umbralEscucha,
  type MotivoParada,
} from '@/lib/bolsillo/reproductor/tiempo';
import { portadaComoPng } from '@/lib/bolsillo/reproductor/portada';

export interface OpcionesTocar {
  /** Una versión concreta; si no, la que suena (la elegida o la última lista). */
  versionId?: string;
  /** La lista desde la que se toca: se recorre con siguiente y anterior. */
  cola?: string[];
  /** Empezar en este segundo (total, en un paisaje). Para comparar dos versiones en el mismo punto. */
  desde?: number;
}

export interface Reproductor {
  actual: Pista | null;
  /** Ids de canción en orden. */
  cola: string[];
  sonando: boolean;
  cargando: boolean;
  /** Segundos. En un paisaje, lo que lleva sonando en total, no la vuelta del bucle. */
  posicion: number;
  duracion: number;
  /** Cuándo se apaga solo (ms de época), o null. */
  apagaEn: number | null;
  modoCuidado: boolean;
  error: string | null;
  tocar(cancionId: string, opciones?: OpcionesTocar): Promise<void>;
  alternar(): void;
  pausar(): void;
  siguiente(): void;
  anterior(): void;
  buscar(segundos: number): void;
  ponerTemporizador(minutos: number | null): void;
  ponerModoCuidado(activo: boolean): void;
  /** Si queda algo que se pueda tocar después en la cola. */
  haySiguiente?: boolean;
  /** Si la página puede bajar el volumen. En el iPhone no: lo mandan los botones del móvil. */
  volumenControlable?: boolean;
  /** La posición en este instante, sin esperar al siguiente repintado. */
  posicionAhora?(): number;
}

/** Un instante de silencio (WAV, 8 kHz, 8 bits, 50 ms): despierta el <audio> dentro del toque. */
function silencio(): string {
  const muestras = 400;
  const bytes = new Uint8Array(44 + muestras);
  const v = new DataView(bytes.buffer);
  const texto = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) bytes[o + i] = s.charCodeAt(i);
  };
  texto(0, 'RIFF');
  v.setUint32(4, 36 + muestras, true);
  texto(8, 'WAVE');
  texto(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, 8000, true);
  v.setUint32(28, 8000, true);
  v.setUint16(32, 1, true);
  v.setUint16(34, 8, true);
  texto(36, 'data');
  v.setUint32(40, muestras, true);
  bytes.fill(128, 44);
  let binario = '';
  for (const b of bytes) binario += String.fromCharCode(b);
  return `data:audio/wav;base64,${btoa(binario)}`;
}

function volumenSeDejaTocar(audio: HTMLAudioElement): boolean {
  try {
    const antes = audio.volume;
    audio.volume = 0.5;
    const ok = Math.abs(audio.volume - 0.5) < 0.01;
    audio.volume = antes;
    return ok;
  } catch {
    return false;
  }
}

interface Motor {
  audio: HTMLAudioElement | null;
  despierto: boolean;
  despertando: boolean;
  /** Cada `tocar` lleva un número; si llega otro antes de que termine, el viejo se calla. */
  turno: number;
  cola: Cola;
  pista: Pista | null;
  /** El audio de la pista está puesto en el <audio>. */
  cargada: boolean;
  remota: boolean;
  bucle: boolean;
  limite: number | null;
  ultimoTotal: number;
  /** Desde cuándo cuenta el reloj (sonando de verdad), o null. */
  ultimoTic: number | null;
  sonado: number;
  escuchaContada: boolean;
  pendienteDesde: number | null;
  apagaEn: number | null;
  cuidado: boolean;
  cuidadoElegido: boolean | null;
  fundido: number;
  publicada: number;
  volumenControlable: boolean;
}

function motorNuevo(): Motor {
  return {
    audio: null,
    despierto: false,
    despertando: false,
    turno: 0,
    cola: { ids: [], indice: 0 },
    pista: null,
    cargada: false,
    remota: false,
    bucle: false,
    limite: null,
    ultimoTotal: 0,
    ultimoTic: null,
    sonado: 0,
    escuchaContada: false,
    pendienteDesde: null,
    apagaEn: null,
    cuidado: false,
    cuidadoElegido: null,
    fundido: 1,
    publicada: -1,
    volumenControlable: true,
  };
}

export function useReproductor(biblioteca: Biblioteca): Reproductor {
  const [pista, setPista] = useState<Pista | null>(null);
  const [cola, setCola] = useState<string[]>([]);
  const [indice, setIndice] = useState(0);
  const [sonando, setSonando] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [posicion, setPosicion] = useState(0);
  const [duracion, setDuracion] = useState(0);
  const [apagaEn, setApagaEn] = useState<number | null>(null);
  const [modoCuidado, setModoCuidado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [volumenControlable, setVolumenControlable] = useState(true);

  // La biblioteca cambia en cada repintado: las acciones la leen de aquí.
  const biblio = useRef(biblioteca);
  biblio.current = biblioteca;
  const motor = useRef<Motor>(null as unknown as Motor);
  if (!motor.current) motor.current = motorNuevo();

  /* Las acciones se crean una vez: así `tocar` y compañía son siempre la misma
     función y las listas memorizadas no se repintan con cada tic. */
  const acciones = useMemo(() => {
    const m = motor.current;

    const duracionVuelta = (): number => {
      const d = m.audio?.duration;
      if (d !== undefined && Number.isFinite(d) && d > 0) return d;
      return m.pista?.version.duracionSeg ?? 0;
    };

    const duracionVisible = (): number => m.limite ?? duracionVuelta();

    const medir = (ahora = Date.now()): number => {
      const a = m.audio;
      if (!a || !m.pista || !m.cargada) return m.ultimoTotal;
      const t = a.currentTime || 0;
      if (!m.bucle) return t;
      const estimado = m.ultimoTotal + (m.ultimoTic !== null ? (ahora - m.ultimoTic) / 1000 : 0);
      return totalEnBucle(t, duracionVuelta(), estimado);
    };

    const aplicarVolumen = (fundido: number) => {
      m.fundido = fundido;
      const a = m.audio;
      if (!a || !m.volumenControlable) return;
      const v = Math.max(0, Math.min(1, (m.cuidado ? VOLUMEN_CUIDADO : 1) * fundido));
      if (Math.abs(a.volume - v) > 0.004) {
        try {
          a.volume = v;
        } catch {
          /* en algunos navegadores el volumen es solo de lectura */
        }
      }
    };

    const publicar = (total: number, forzar = false) => {
      // ~4 Hz: suficiente para una línea de progreso y un reloj de segundos.
      if (!forzar && Math.abs(total - m.publicada) < 0.2) return;
      m.publicada = total;
      setPosicion(total);
    };

    const sesion = (): MediaSession | null =>
      typeof navigator !== 'undefined' && 'mediaSession' in navigator ? navigator.mediaSession : null;

    const ponerEstadoPosicion = () => {
      const ms = sesion();
      if (!ms || typeof ms.setPositionState !== 'function') return;
      try {
        const d = duracionVisible();
        if (!m.pista || !(d > 0) || !Number.isFinite(d)) {
          ms.setPositionState();
          return;
        }
        ms.setPositionState({ duration: d, position: Math.max(0, Math.min(m.ultimoTotal, d)), playbackRate: 1 });
      } catch {
        /* un navegador viejo que no lo entiende no debe parar la música */
      }
    };

    const contarEscucha = () => {
      if (m.escuchaContada || !m.pista) return;
      if (m.sonado < umbralEscucha(duracionVisible())) return;
      m.escuchaContada = true;
      const id = m.pista.cancion.id;
      void biblio.current.registrarEscucha(id).catch(() => {
        /* una escucha sin apuntar no merece un aviso */
      });
    };

    const pararSolo = (motivo: MotivoParada | null) => {
      const a = m.audio;
      if (!a) return;
      a.pause();
      aplicarVolumen(1);
      if (motivo === 'temporizador') {
        m.apagaEn = null;
        setApagaEn(null);
      }
      if (motivo === 'final' && m.limite !== null) {
        m.ultimoTotal = m.limite;
        publicar(m.limite, true);
      }
    };

    const tic = (forzar = false) => {
      const a = m.audio;
      if (!a || !m.pista || !m.cargada) return;
      const ahora = Date.now();
      const total = medir(ahora);
      const suena = !a.paused;
      if (suena && m.ultimoTic !== null) {
        m.sonado = sumarSonado(m.sonado, m.ultimoTotal, total);
        m.ultimoTic = ahora;
      }
      m.ultimoTotal = total;
      contarEscucha();
      if (suena) {
        const parada = decidirParada({ total, limite: m.limite, ahora, apagaEn: m.apagaEn });
        if (parada.parar) {
          pararSolo(parada.motivo);
          return;
        }
        aplicarVolumen(parada.volumen);
      }
      publicar(total, forzar);
    };

    const ponerMetadatos = (p: Pista, artista: string | undefined) => {
      const ms = sesion();
      if (!ms || typeof MediaMetadata === 'undefined') return;
      try {
        const portada = portadaComoPng(p.cancion.portada);
        ms.metadata = new MediaMetadata({
          title: p.cancion.titulo,
          artist: artista ?? 'aura Music',
          artwork: !portada
            ? []
            : portada.startsWith('data:image/png')
              ? [{ src: portada, sizes: '512x512', type: 'image/png' }]
              : [{ src: portada }],
        });
      } catch {
        /* sin metadatos suena igual */
      }
    };

    const esJugable = (id: string): boolean => {
      const b = biblio.current;
      const c = b.cancion(id);
      return !!c && b.versionQueSuena(c) !== null;
    };

    const fallarAlTocar = (e: unknown, turno: number) => {
      if (turno !== m.turno) return;
      const nombre = e instanceof Error || (typeof e === 'object' && e !== null) ? (e as { name?: string }).name : '';
      if (nombre === 'AbortError') return; // otro `tocar` ha cambiado el audio: no es un fallo
      setCargando(false);
      setSonando(false);
      if (nombre === 'NotAllowedError') {
        setError('Toca el botón de play para que empiece a sonar.');
        return;
      }
      // El audio no vale: el siguiente play lo vuelve a buscar en vez de insistir con el mismo.
      m.cargada = false;
      setError(
        m.remota && typeof navigator !== 'undefined' && navigator.onLine === false
          ? 'Sin conexión no llega el audio de esta versión.'
          : 'No he podido tocar esta versión.',
      );
    };

    /**
     * El primer `play()` de la página, dentro del toque: un silencio que deja
     * el <audio> listo para sonar luego sin toque (el iPhone lo exige).
     */
    const despertar = (a: HTMLAudioElement) => {
      if (m.despierto) return;
      m.despierto = true;
      m.despertando = true;
      try {
        a.src = silencio();
        void a.play().catch(() => {
          /* se interrumpe al poner el audio de verdad: es lo esperado */
        });
      } catch {
        /* sin silencio, el play de verdad lo intentará igual */
      }
    };

    const reanudar = () => {
      const a = m.audio;
      const p = m.pista;
      if (!a || !p) return;
      if (!m.cargada) {
        void tocarInterno(p.cancion.id, { versionId: p.version.id, cola: m.cola.ids }, m.cola.indice);
        return;
      }
      if (m.apagaEn !== null && Date.now() >= m.apagaEn) {
        m.apagaEn = null;
        setApagaEn(null);
      }
      if (m.limite !== null && m.ultimoTotal >= m.limite - 0.5) buscar(0);
      aplicarVolumen(1);
      setError(null);
      const turno = m.turno;
      void a.play().catch((e: unknown) => fallarAlTocar(e, turno));
    };

    const pausar = () => {
      m.audio?.pause();
    };

    const buscar = (segundos: number) => {
      const a = m.audio;
      if (!a || !m.pista) return;
      const tope = duracionVisible();
      const s = Math.max(0, Math.min(Number.isFinite(segundos) ? segundos : 0, tope > 0 ? tope : Infinity));
      m.ultimoTotal = s;
      if (m.ultimoTic !== null) m.ultimoTic = Date.now();
      if (!m.cargada || a.readyState === 0) {
        m.pendienteDesde = s;
      } else {
        try {
          a.currentTime = m.bucle ? situarEnBucle(s, duracionVuelta()).tiempo : s;
        } catch {
          m.pendienteDesde = s;
        }
      }
      aplicarVolumen(1);
      publicar(s, true);
      ponerEstadoPosicion();
    };

    const tocarInterno = async (cancionId: string, opciones: OpcionesTocar = {}, indicePedido?: number): Promise<void> => {
      const a = asegurarAudio();
      if (!a) return;
      despertar(a);
      const turno = ++m.turno;
      const b = biblio.current;

      // La misma que ya está puesta: no se vuelve a cargar, se sigue.
      const p = m.pista;
      if (
        p &&
        m.cargada &&
        p.cancion.id === cancionId &&
        (!opciones.versionId || opciones.versionId === p.version.id) &&
        opciones.desde === undefined
      ) {
        if (opciones.cola) {
          m.cola = armarCola(cancionId, opciones.cola);
          setCola(m.cola.ids);
          setIndice(m.cola.indice);
        }
        if (a.paused) reanudar();
        return;
      }

      setError(null);
      let cancion: Cancion | null = b.cancion(cancionId) ?? null;
      if (!cancion) cancion = await almacen().canciones.leer(cancionId);
      if (turno !== m.turno) return;
      if (!cancion) {
        setError('No encuentro esta canción.');
        return;
      }
      let version: Version | null = null;
      if (opciones.versionId) {
        version = b.versiones.find((v) => v.id === opciones.versionId) ?? (await almacen().versiones.leer(opciones.versionId));
      } else {
        version = b.versionQueSuena(cancion);
        // Acaba de nacer y la biblioteca aún no la ha leído: se mira en el almacén.
        if (!version) version = versionQueSuena(cancion, await almacen().versiones.todos());
      }
      if (turno !== m.turno) return;
      if (!version) {
        setError('Esta canción todavía no tiene ninguna versión que se pueda escuchar.');
        return;
      }
      if (version.estado === 'generando') {
        setError('Esta versión todavía se está haciendo.');
        return;
      }
      if (version.estado === 'fallo') {
        setError('Esta versión no salió bien. Prueba con otra.');
        return;
      }

      // Se enseña ya, aunque el audio tarde: el mini reproductor no se queda en blanco.
      a.pause();
      const nueva: Pista = { cancion, version };
      m.pista = nueva;
      m.cargada = false;
      m.bucle = !!version.bucle;
      m.limite = limiteDe(version);
      m.sonado = 0;
      m.escuchaContada = false;
      m.ultimoTotal = opciones.desde ?? 0;
      m.ultimoTic = null;
      m.pendienteDesde = opciones.desde ?? null;
      m.publicada = -1;
      m.cola =
        indicePedido !== undefined && opciones.cola && opciones.cola[indicePedido] === cancionId
          ? { ids: [...opciones.cola], indice: indicePedido }
          : armarCola(cancionId, opciones.cola);
      m.cuidado = cuidadoAlTocar({ tipo: cancion.tipo, momento: version.receta.momento }, m.cuidadoElegido);
      setPista(nueva);
      setCola(m.cola.ids);
      setIndice(m.cola.indice);
      setModoCuidado(m.cuidado);
      setPosicion(m.ultimoTotal);
      setDuracion(m.limite ?? version.duracionSeg ?? 0);
      setSonando(false);
      setCargando(true);

      let url: string | null = null;
      try {
        url = await b.urlDeAudio(version);
      } catch {
        url = null;
      }
      if (turno !== m.turno) return;
      if (!url) {
        setCargando(false);
        setError('No encuentro el audio de esta versión.');
        return;
      }
      m.remota = !version.audioId || url === version.urlRemota;
      m.despertando = false;
      m.cargada = true;
      a.loop = m.bucle;
      a.src = url;
      aplicarVolumen(1);
      try {
        await a.play();
      } catch (e) {
        fallarAlTocar(e, turno);
      }
    };

    const irA = (i: number) => {
      const id = m.cola.ids[i];
      if (id) void tocarInterno(id, { cola: m.cola.ids }, i);
    };

    const siguiente = () => {
      const i = siguienteIndice(m.cola, esJugable);
      if (i !== null) irA(i);
    };

    const anterior = () => {
      if (!m.pista) return;
      const decision = decidirAnterior(medir(), m.cola, esJugable);
      if (decision.tipo === 'ir') irA(decision.indice);
      else buscar(0);
    };

    /* ── Los avisos del <audio> ─────────────────────────────────────────── */

    const alSonar = () => {
      if (m.despertando) return;
      m.ultimoTic = Date.now();
      setSonando(true);
      setCargando(false);
      const ms = sesion();
      if (ms) ms.playbackState = 'playing';
      ponerEstadoPosicion();
    };
    const alEmpezar = () => {
      if (!m.despertando) setSonando(true);
    };
    const alPausar = () => {
      if (m.despertando) return;
      tic(true);
      m.ultimoTic = null;
      setSonando(false);
      const ms = sesion();
      if (ms) ms.playbackState = 'paused';
      ponerEstadoPosicion();
    };
    const alEsperar = () => {
      if (m.despertando || !m.cargada) return;
      tic();
      m.ultimoTic = null;
      setCargando(true);
    };
    const alPoderSonar = () => {
      if (!m.despertando) setCargando(false);
    };
    const alTenerDatos = () => {
      if (m.despertando || !m.cargada) return;
      const a = m.audio;
      if (a && m.pendienteDesde !== null) {
        const desde = m.pendienteDesde;
        m.pendienteDesde = null;
        try {
          a.currentTime = m.bucle ? situarEnBucle(desde, duracionVuelta()).tiempo : Math.min(desde, duracionVuelta() || desde);
        } catch {
          /* empieza desde el principio */
        }
      }
      setDuracion(duracionVisible());
      ponerEstadoPosicion();
    };
    const alAvanzar = () => {
      if (!m.despertando) tic();
    };
    const alAcabar = () => {
      if (m.despertando || !m.cargada) return;
      tic(true);
      m.ultimoTic = null;
      setSonando(false);
      // Un paisaje no pasa a la siguiente: si acaba, es que tenía que acabar.
      if (!m.bucle) siguiente();
    };
    const alFallar = () => {
      if (m.despertando || !m.cargada) return;
      fallarAlTocar(new Error('error'), m.turno);
    };

    const OYENTES: [keyof HTMLMediaElementEventMap, () => void][] = [
      ['playing', alSonar],
      ['play', alEmpezar],
      ['pause', alPausar],
      ['waiting', alEsperar],
      ['canplay', alPoderSonar],
      ['loadedmetadata', alTenerDatos],
      ['durationchange', alTenerDatos],
      ['timeupdate', alAvanzar],
      ['ended', alAcabar],
      ['error', alFallar],
    ];

    function asegurarAudio(): HTMLAudioElement | null {
      if (m.audio) return m.audio;
      if (typeof Audio === 'undefined') return null;
      const a = new Audio();
      a.preload = 'auto';
      for (const [evento, oyente] of OYENTES) a.addEventListener(evento, oyente);
      m.audio = a;
      m.volumenControlable = volumenSeDejaTocar(a);
      setVolumenControlable(m.volumenControlable);
      return a;
    }

    const soltarAudio = () => {
      const a = m.audio;
      if (!a) return;
      for (const [evento, oyente] of OYENTES) a.removeEventListener(evento, oyente);
      try {
        a.pause();
        a.removeAttribute('src');
        a.load();
      } catch {
        /* nada que soltar */
      }
      m.audio = null;
      m.despierto = false;
      m.cargada = false;
    };

    return {
      asegurarAudio,
      soltarAudio,
      ponerMetadatos,
      sesion,
      medir,
      publicas: {
        tocar: (cancionId: string, opciones?: OpcionesTocar) => tocarInterno(cancionId, opciones),
        alternar() {
          const a = m.audio;
          if (!a || !m.pista) return;
          if (a.paused || !m.cargada) reanudar();
          else a.pause();
        },
        pausar,
        siguiente,
        anterior,
        buscar,
        ponerTemporizador(minutos: number | null) {
          m.apagaEn = apagaEnDe(minutos, Date.now());
          setApagaEn(m.apagaEn);
          if (m.apagaEn === null) aplicarVolumen(1);
        },
        ponerModoCuidado(activo: boolean) {
          m.cuidadoElegido = activo;
          m.cuidado = activo;
          setModoCuidado(activo);
          aplicarVolumen(m.fundido);
        },
        posicionAhora: () => medir(),
      },
    };
  }, []);

  // El <audio> y los mandos de la pantalla de bloqueo, una vez.
  useEffect(() => {
    acciones.asegurarAudio();
    const ms = acciones.sesion();
    const { publicas } = acciones;
    const mandos: [MediaSessionAction, MediaSessionActionHandler][] = [
      ['play', () => publicas.alternar()],
      ['pause', () => publicas.pausar()],
      ['stop', () => publicas.pausar()],
      ['nexttrack', () => publicas.siguiente()],
      ['previoustrack', () => publicas.anterior()],
      [
        'seekto',
        (d) => {
          if (typeof d.seekTime === 'number') publicas.buscar(d.seekTime);
        },
      ],
    ];
    if (ms) {
      for (const [accion, mando] of mandos) {
        try {
          ms.setActionHandler(accion, mando);
        } catch {
          /* acción que este navegador no conoce */
        }
      }
    }
    return () => {
      acciones.soltarAudio();
      if (ms) {
        for (const [accion] of mandos) {
          try {
            ms.setActionHandler(accion, null);
          } catch {
            /* nada */
          }
        }
        try {
          ms.metadata = null;
        } catch {
          /* nada */
        }
      }
    };
  }, [acciones]);

  // Lo que suena, al día: si la canción cambia de título o se queda, se ve.
  const { canciones, versiones, artistas } = biblioteca;
  const actual = useMemo<Pista | null>(() => {
    if (!pista) return null;
    const c = canciones.find((x) => x.id === pista.cancion.id) ?? pista.cancion;
    const v = versiones.find((x) => x.id === pista.version.id) ?? pista.version;
    return c === pista.cancion && v === pista.version ? pista : { cancion: c, version: v };
  }, [pista, canciones, versiones]);

  useEffect(() => {
    if (actual) motor.current.pista = actual;
  }, [actual]);

  const artista = actual?.cancion.artistaId ? artistas.find((x) => x.id === actual.cancion.artistaId)?.nombre : undefined;
  const portada = actual?.cancion.portada;
  const clavePortada = portada ? (portada.tipo === 'imagen' ? portada.url : String(portada.semilla)) : '';
  const titulo = actual?.cancion.titulo;
  useEffect(() => {
    const p = motor.current.pista;
    if (p && titulo !== undefined) acciones.ponerMetadatos(p, artista);
  }, [acciones, titulo, artista, clavePortada]);

  const haySiguiente = useMemo(() => {
    if (!cola.length) return false;
    const porId = new Map(canciones.map((c) => [c.id, c]));
    return (
      siguienteIndice({ ids: cola, indice }, (id) => {
        const c = porId.get(id);
        return !!c && versionQueSuena(c, versiones) !== null;
      }) !== null
    );
  }, [cola, indice, canciones, versiones]);

  return useMemo<Reproductor>(
    () => ({
      actual,
      cola,
      sonando,
      cargando,
      posicion,
      duracion,
      apagaEn,
      modoCuidado,
      error,
      haySiguiente,
      volumenControlable,
      ...acciones.publicas,
    }),
    [actual, cola, sonando, cargando, posicion, duracion, apagaEn, modoCuidado, error, haySiguiente, volumenControlable, acciones],
  );
}
