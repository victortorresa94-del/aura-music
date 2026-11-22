/**
 * El tipo de bajo que elegiste, recordado en este móvil. Lo comparten la
 * pantalla «Tocar» y el músico al momento: si tocas con el 808, el músico
 * también te lo pone con el 808.
 */

import { BAJO_POR_DEFECTO, INSTRUMENTOS } from './registro';
import type { InstrumentoId } from './tipos';

const CLAVE = 'aura-music:tipo-de-bajo';

export function leerBajoElegido(): InstrumentoId {
  try {
    const guardado = window.localStorage.getItem(CLAVE) as InstrumentoId | null;
    const def = INSTRUMENTOS.find((d) => d.id === guardado);
    return def && def.familia === 'bajo' && !def.oculto ? def.id : BAJO_POR_DEFECTO;
  } catch {
    return BAJO_POR_DEFECTO;
  }
}

export function guardarBajoElegido(id: InstrumentoId) {
  try {
    window.localStorage.setItem(CLAVE, id);
  } catch {
    /* sin almacenamiento: se queda el de por defecto */
  }
}
