/**
 * ACE-Step 1.5 como músico de sesión.
 *
 * Es el único modelo con la primitiva exacta que necesita Compás: la tarea
 * `lego`, que recibe tu toma y genera UNA pista nueva (bajo, batería…)
 * escuchándola. Código y pesos con licencia MIT.
 *
 * Habla con el servidor oficial de ACE-Step (`acestep-api`), que se puede
 * levantar en cualquier GPU: Modal, RunPod, un Space de Hugging Face o una
 * máquina propia. El protocolo es el de su documentación:
 *
 *   POST /release_task   (multipart con la toma)  → task_id
 *   POST /query_result   {"task_id_list": [id]}   → estado y fichero
 *   GET  /v1/audio?path=…                          → el audio
 *   GET  /health                                   → si está vivo (sin clave)
 *
 * Ojo: `lego` solo funciona con los modelos base (no con los turbo).
 */

import {
  ErrorDeProveedor,
  type Instrumento,
  type PeticionCancion,
  type PeticionPista,
  type ProveedorDePistas,
  type SaludProveedor,
  type Tarea,
} from './tipos';

export interface ConfigAceStep {
  url: string;
  clave?: string;
  /** Modelo DiT. Tiene que ser base: los turbo no saben hacer `lego`. */
  modelo?: string;
  pasos?: number;
}

/** Los nombres de pista que entiende el modelo (TRACK_NAMES en su código). */
export const PISTAS_ACESTEP: Record<Instrumento, string> = {
  bajo: 'bass',
  bateria: 'drums',
  guitarra: 'guitar',
  teclado: 'keyboard',
  cuerdas: 'strings',
  metales: 'brass',
  percusion: 'percussion',
  sinte: 'synth',
};

const DESCRIPCION_POR_DEFECTO: Record<Instrumento, string> = {
  bajo: 'fingerstyle electric bass, warm and round, locked tight to the groove, follows the chords',
  bateria: 'live acoustic drum kit, natural room, tight groove that follows the feel',
  guitarra: 'rhythm guitar comping that supports the song',
  teclado: 'warm keys comping, supporting the harmony',
  cuerdas: 'string section pad, legato, supporting the harmony',
  metales: 'brass section stabs, punchy',
  percusion: 'hand percussion, shakers and congas, following the groove',
  sinte: 'analog synth pad, wide and soft',
};

const PREFIJO_AUDIO = '/v1/audio?path=';

/** Lo que más espera la comprobación de salud, contando sus dos peticiones. */
const ESPERA_SALUD_MS = 3000;

interface Sobre<T> {
  data: T;
  code: number;
  error: string | null;
}

/** Lo que contesta `/health`: `{"status":"ok","service":"ACE-Step API","version":"1.0",…}`. */
interface DatosSalud {
  status?: unknown;
  service?: unknown;
  version?: unknown;
  loaded_model?: unknown;
}

const texto = (valor: unknown): string | undefined =>
  typeof valor === 'string' && valor.trim() ? valor.trim() : undefined;

const esTiempoAgotado = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && (error as { name?: unknown }).name === 'TimeoutError';

export function crearAceStep(config: ConfigAceStep, pedir: typeof fetch = fetch): ProveedorDePistas {
  const base = config.url.replace(/\/+$/, '');
  const cabeceras = (extra: Record<string, string> = {}): Record<string, string> =>
    config.clave ? { ...extra, Authorization: `Bearer ${config.clave}` } : extra;

  async function llamar<T>(ruta: string, init: RequestInit): Promise<T> {
    let respuesta: Response;
    try {
      respuesta = await pedir(`${base}${ruta}`, init);
    } catch {
      throw new ErrorDeProveedor('No llego al servidor de ACE-Step. ¿Está encendido?', 503);
    }
    if (respuesta.status === 401 || respuesta.status === 403) {
      throw new ErrorDeProveedor('El servidor de ACE-Step no acepta la clave.', 502);
    }
    if (!respuesta.ok) {
      throw new ErrorDeProveedor(`El servidor de ACE-Step ha respondido ${respuesta.status}.`, 502);
    }
    const sobre = (await respuesta.json()) as Sobre<T>;
    if (sobre.code !== 200 || sobre.error) {
      throw new ErrorDeProveedor(`ACE-Step: ${sobre.error ?? `código ${sobre.code}`}`, 502);
    }
    return sobre.data;
  }

  return {
    id: 'acestep',
    nombre: 'ACE-Step 1.5',

    async iniciar(p: PeticionPista): Promise<Tarea> {
      const form = new FormData();
      form.set('src_audio', p.audio, 'toma.wav');
      form.set('task_type', 'lego');
      form.set('track_name', PISTAS_ACESTEP[p.instrumento]);
      form.set('prompt', p.descripcion?.trim() || DESCRIPCION_POR_DEFECTO[p.instrumento]);
      form.set('lyrics', '[inst]');
      form.set('bpm', String(Math.round(p.bpm)));
      if (p.tonalidad) form.set('key_scale', p.tonalidad);
      form.set('time_signature', String(p.pulsosPorCompas ?? 4));
      form.set('audio_duration', p.duracion.toFixed(2));
      form.set('repainting_start', '0');
      form.set('repainting_end', '-1');
      form.set('audio_format', 'wav');
      form.set('inference_steps', String(config.pasos ?? 32));
      form.set('guidance_scale', '7');
      form.set('thinking', 'false');
      if (config.modelo) form.set('model', config.modelo);
      if (p.semilla !== undefined) form.set('seed', String(p.semilla));

      const data = await llamar<{ task_id: string; status?: string }>('/release_task', {
        method: 'POST',
        headers: cabeceras(),
        body: form,
      });
      if (!data?.task_id) throw new ErrorDeProveedor('ACE-Step no ha devuelto una tarea.');
      return { id: data.task_id, estado: 'en-cola' };
    },

    /* La canción entera: `text2music`, sin toma. Sale en MP3 y no en WAV
       porque una canción de dos minutos en WAV pesa más de 20 MB y no cabe
       por el proxy; aquí no hay nada que cuadrar contra una toma, así que el
       retardo del códec no molesta. */
    async iniciarCancion(p: PeticionCancion): Promise<Tarea> {
      const form = new FormData();
      form.set('task_type', 'text2music');
      form.set('prompt', p.descripcion.trim());
      form.set('lyrics', p.letra?.trim() || '[inst]');
      if (p.letra?.trim()) form.set('vocal_language', 'es');
      form.set('audio_duration', String(Math.round(p.segundos)));
      if (p.bpm) form.set('bpm', String(Math.round(p.bpm)));
      if (p.tonalidad) form.set('key_scale', p.tonalidad);
      form.set('time_signature', String(p.pulsosPorCompas ?? 4));
      form.set('audio_format', 'mp3');
      form.set('inference_steps', String(config.pasos ?? 32));
      form.set('guidance_scale', '7');
      form.set('thinking', 'false');
      if (config.modelo) form.set('model', config.modelo);
      if (p.semilla !== undefined) form.set('seed', String(p.semilla));

      const data = await llamar<{ task_id: string }>('/release_task', {
        method: 'POST',
        headers: cabeceras(),
        body: form,
      });
      if (!data?.task_id) throw new ErrorDeProveedor('ACE-Step no ha devuelto una tarea.');
      return { id: data.task_id, estado: 'en-cola' };
    },

    async consultar(id: string): Promise<Tarea> {
      const data = await llamar<{ task_id: string; status: number; result?: string }[]>('/query_result', {
        method: 'POST',
        headers: cabeceras({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ task_id_list: [id] }),
      });
      const item = data?.[0];
      if (!item) return { id, estado: 'fallo', error: 'La tarea no existe.' };
      if (item.status === 0) return { id, estado: 'generando' };
      if (item.status === 2) return { id, estado: 'fallo', error: 'El modelo no ha podido generar la pista.' };

      let archivo: string | undefined;
      try {
        const resultados = JSON.parse(item.result ?? '[]') as { file?: string }[];
        archivo = resultados.find((r) => r.file)?.file;
      } catch {
        /* se trata abajo como fallo */
      }
      if (!archivo || !archivo.startsWith(PREFIJO_AUDIO)) {
        return { id, estado: 'fallo', error: 'La pista ha salido sin audio.' };
      }
      return { id, estado: 'listo', archivo };
    },

    async descargar(archivo: string): Promise<Response> {
      // Solo se sirve audio del propio servidor de ACE-Step, nada más.
      if (!archivo.startsWith(PREFIJO_AUDIO) || archivo.includes('://')) {
        throw new ErrorDeProveedor('Ruta de audio no válida.', 400);
      }
      let respuesta: Response;
      try {
        respuesta = await pedir(`${base}${archivo}`, { headers: cabeceras() });
      } catch {
        throw new ErrorDeProveedor('No llego al servidor de ACE-Step.', 503);
      }
      if (!respuesta.ok) throw new ErrorDeProveedor(`No he podido bajar la pista (${respuesta.status}).`);
      return respuesta;
    },

    async salud(): Promise<SaludProveedor> {
      // Un solo reloj para las dos peticiones: la app nunca espera más de 3 s.
      const signal = AbortSignal.timeout(ESPERA_SALUD_MS);
      const desconectado = (detalle: string): SaludProveedor => ({ conectado: false, prueba: false, detalle });

      let respuesta: Response;
      try {
        respuesta = await pedir(`${base}/health`, { headers: cabeceras(), signal });
      } catch (error) {
        return desconectado(
          esTiempoAgotado(error)
            ? 'El servidor de ACE-Step no ha contestado en 3 segundos.'
            : 'No llego al servidor de ACE-Step. ¿Está encendido?',
        );
      }
      if (respuesta.status >= 502 && respuesta.status <= 504) {
        // Es lo que da el proxy de RunPod mientras el servidor arranca o carga los modelos.
        return desconectado('El servidor de ACE-Step aún no escucha. Si acabas de encenderlo, espera a que arranque.');
      }
      if (!respuesta.ok) return desconectado(`El servidor de ACE-Step ha respondido ${respuesta.status}.`);

      let datos: DatosSalud | undefined;
      try {
        datos = ((await respuesta.json()) as Sobre<DatosSalud> | null)?.data;
      } catch {
        /* se trata abajo */
      }
      if (datos?.status !== 'ok') return desconectado('En esa dirección contesta algo que no es ACE-Step.');

      const servicio = texto(datos.service) ?? 'ACE-Step';
      if (/falso/i.test(servicio)) return { conectado: true, prueba: true, detalle: servicio };

      // `/health` no pide clave y `/v1/models` sí: así se sabe si la clave vale
      // antes de mandar una toma.
      try {
        const modelos = await pedir(`${base}/v1/models`, { headers: cabeceras(), signal });
        void modelos.body?.cancel().catch(() => undefined);
        if (modelos.status === 401 || modelos.status === 403) {
          return desconectado(
            config.clave
              ? 'El servidor de ACE-Step no acepta la clave (ACESTEP_API_KEY).'
              : 'El servidor de ACE-Step pide una clave y falta ACESTEP_API_KEY.',
          );
        }
      } catch {
        // Si esta segunda pregunta no llega, de la clave no se sabe nada: vale con /health.
      }

      const version = texto(datos.version);
      const modelo = texto(datos.loaded_model);
      return {
        conectado: true,
        prueba: false,
        detalle: [version ? `${servicio} ${version}` : servicio, modelo].filter(Boolean).join(' · '),
      };
    },
  };
}
