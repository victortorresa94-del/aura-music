/**
 * Lo de este dispositivo para el motor de la nube: IndexedDB (las ideas y su
 * audio, `storage.ts`) y localStorage (el cerebro y lo que se recuerda de la
 * cuenta).
 *
 * Lo que escribe la nube va en silencio: si `saveProject` avisara, la idea
 * recién bajada se volvería a subir.
 */

import * as store from '@/lib/daw/storage';
import { CLAVE_CEREBRO, leerCerebro } from '@/lib/productor/cerebro';
import { EVENTO_CEREBRO_DE_LA_NUBE, avisar } from './eventos';
import { estadoVacio, type EstadoGuardado, type Local } from './tipos';

export const local: Local = {
  listarProyectos: () => store.listProjects(),
  leerProyecto: (id) => store.loadProject(id),
  guardarProyecto: (p) => store.saveProject(p, { silencioso: true }),
  borrarProyecto: (p) => store.deleteProject(p, { silencioso: true }),
  leerAudio: (id) => store.getAudioPcm16(id),
  guardarAudio: (id, audio) => store.putAudioPcm16(id, audio),
  tieneAudio: (id) => store.hasAudio(id),
  leerCerebro: () => {
    try {
      return leerCerebro(window.localStorage.getItem(CLAVE_CEREBRO));
    } catch {
      return leerCerebro(null);
    }
  },
  guardarCerebro: (cerebro) => {
    try {
      window.localStorage.setItem(CLAVE_CEREBRO, JSON.stringify(cerebro));
    } catch {
      /* sin almacenamiento: el productor sigue con el suyo */
    }
    avisar(EVENTO_CEREBRO_DE_LA_NUBE);
  },
};

const claveDeCuenta = (uid: string) => `aura-music:nube:${uid}`;

/** Lo que este dispositivo recuerda de una cuenta: bases, borrados y la cola pendiente. */
export function leerEstadoDeCuenta(uid: string): EstadoGuardado {
  try {
    const crudo = window.localStorage.getItem(claveDeCuenta(uid));
    if (!crudo) return estadoVacio();
    const leido = JSON.parse(crudo) as Partial<EstadoGuardado>;
    if (leido.version !== 1) return estadoVacio();
    return { ...estadoVacio(), ...leido } as EstadoGuardado;
  } catch {
    return estadoVacio();
  }
}

export function guardarEstadoDeCuenta(uid: string, estado: EstadoGuardado): void {
  try {
    window.localStorage.setItem(claveDeCuenta(uid), JSON.stringify(estado));
  } catch {
    /* lleno o bloqueado: la siguiente vuelta lo recalcula comparando con la nube */
  }
}
