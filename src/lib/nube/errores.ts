/**
 * Qué ha pasado cuando la nube falla, dicho para una persona.
 *
 * Sin red no es un error: es «Sin conexión», y lo pendiente sube solo al
 * volver. Un permiso denegado o el CORS sin poner sí lo son, y se dice dónde
 * se arregla (docs/CUENTA.md).
 */

export type TipoDeError = 'red' | 'permiso' | 'cors' | 'cuota' | 'otro';

function codigo(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error) return String((error as { code: unknown }).code);
  return '';
}

/**
 * @param bajando el fallo fue al bajar audio. Si hay red y Firestore responde,
 *   un audio que no baja casi siempre es el CORS del almacenamiento sin poner:
 *   el navegador bloquea la respuesta y el SDK solo ve «no ha llegado».
 */
export function clasificarError(error: unknown, opciones: { enLinea?: boolean; bajando?: boolean } = {}): TipoDeError {
  const enLinea = opciones.enLinea ?? true;
  const c = codigo(error);
  if (!enLinea) return 'red';
  if (/permission-denied|unauthenticated|unauthorized|storage\/unauthenticated/.test(c)) return 'permiso';
  if (/resource-exhausted|quota-exceeded/.test(c)) return 'cuota';
  if (opciones.bajando && /retry-limit-exceeded|storage\/unknown|network/.test(c)) return 'cors';
  if (/unavailable|deadline-exceeded|network-request-failed|retry-limit-exceeded|storage\/canceled|failed-precondition/.test(c)) return 'red';
  if (error instanceof TypeError && /fetch|network/i.test(error.message)) return 'red';
  return 'otro';
}

export function textoDelError(tipo: TipoDeError): string {
  switch (tipo) {
    case 'red':
      return 'Sin conexión. Lo pendiente sube solo cuando vuelva.';
    case 'permiso':
      return 'La nube no me deja guardar con esta cuenta. Sal y vuelve a entrar.';
    case 'cors':
      return 'No puedo bajar el audio de la nube. Falta permitir esta web en el almacenamiento de Aura (paso 2 de docs/CUENTA.md).';
    case 'cuota':
      return 'La nube de Aura está llena o ha llegado a su límite de hoy.';
    default:
      return 'No he podido sincronizar. Lo vuelvo a intentar en un rato.';
  }
}
