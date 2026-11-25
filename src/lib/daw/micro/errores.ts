/**
 * Por qué no se ha abierto el micro, dicho de forma que se pueda arreglar.
 *
 * Antes todo acababa en «No he podido abrir el micrófono», y en el iPhone
 * había dos causas que no se veían:
 *   · la app abierta por http (el enlace del ordenador por la red de casa):
 *     Safari solo da el micro en https, y ni siquiera existe la API;
 *   · una entrada elegida en Ajustes que iOS ya no reconoce (cambia los ids
 *     de los dispositivos): `deviceId: exact` falla siempre. Ahí se vuelve a
 *     probar con la entrada por defecto, sin preguntar.
 */

export interface EntornoDeMicro {
  /** `window.isSecureContext`: https o localhost. */
  seguro: boolean;
  /** Existe `navigator.mediaDevices.getUserMedia`. */
  hayApi: boolean;
  /** Había una entrada concreta elegida en Ajustes. */
  conEntradaElegida: boolean;
}

export interface DiagnosticoDeMicro {
  mensaje: string;
  /** Permiso denegado (se pinta distinto en la interfaz). */
  denegado: boolean;
  /** Merece la pena volver a probar con la entrada por defecto. */
  reintentarConLaDeSiempre: boolean;
}

/** Antes de pedirlo: si no se puede ni intentar, por qué. */
export function microImposible(entorno: EntornoDeMicro): string | null {
  if (!entorno.seguro) {
    return 'El micro solo funciona con la app abierta en https (la dirección de Aura Music o la app instalada), no con un enlace http.';
  }
  if (!entorno.hayApi) return 'Este navegador no deja usar el micro. Prueba con Safari o Chrome al día.';
  return null;
}

export function diagnosticoDeMicro(error: unknown, entorno: EntornoDeMicro): DiagnosticoDeMicro {
  const imposible = microImposible(entorno);
  if (imposible) return { mensaje: imposible, denegado: false, reintentarConLaDeSiempre: false };
  const nombre = (error as { name?: string } | null)?.name ?? '';
  switch (nombre) {
    case 'NotAllowedError':
    case 'SecurityError':
      return {
        mensaje:
          'Sin permiso de micrófono. En el iPhone: Ajustes › Safari › Micrófono (o el «aA» de la barra de direcciones) y permítelo para Aura Music.',
        denegado: true,
        reintentarConLaDeSiempre: false,
      };
    case 'OverconstrainedError':
    case 'NotFoundError':
      return entorno.conEntradaElegida
        ? { mensaje: 'La entrada que tenías elegida ya no está. Grabo con la del dispositivo.', denegado: false, reintentarConLaDeSiempre: true }
        : { mensaje: 'No encuentro ningún micro conectado.', denegado: false, reintentarConLaDeSiempre: false };
    case 'NotReadableError':
    case 'AbortError':
      return {
        mensaje: 'El micro está ocupado (una llamada, otra app grabando). Ciérrala y vuelve a probar.',
        denegado: false,
        reintentarConLaDeSiempre: false,
      };
    default:
      return { mensaje: 'No he podido abrir el micrófono. Vuelve a tocar grabar.', denegado: false, reintentarConLaDeSiempre: false };
  }
}
