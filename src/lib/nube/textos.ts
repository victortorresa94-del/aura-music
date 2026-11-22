/**
 * Lo que dice la interfaz del estado de la nube. Corto, en castellano y sin
 * jerga: «Al día», no «sincronizado»; «Sin conexión», no «offline».
 */

import type { EstadoNube } from './tipos';

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/** Hace cuánto, en palabras: «ahora», «hace 3 min», «hace 2 h». */
export function haceCuanto(desde: number, ahora: number): string {
  const s = Math.max(0, Math.round((ahora - desde) / 1000));
  if (s < 45) return 'ahora';
  const min = Math.round(s / 60);
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${plural(Math.round(h / 24), 'día', 'días')}`;
}

/** La línea de estado bajo tu nombre en Ajustes. */
export function textoDelEstado(estado: EstadoNube, ahora: number): string {
  switch (estado.fase) {
    case 'trabajando':
      if (estado.subiendo) return `Subiendo audio ${Math.min(estado.subiendo.hechos + 1, estado.subiendo.total)} de ${estado.subiendo.total}`;
      if (estado.bajando) return 'Bajando audio de la nube';
      if (estado.pendientes > 0) return `Subiendo ${plural(estado.pendientes, 'cambio', 'cambios')}`;
      return 'Poniéndose al día';
    case 'sin-conexion':
      return estado.pendientes > 0
        ? `Sin conexión · ${plural(estado.pendientes, 'cambio espera', 'cambios esperan')} para subir`
        : 'Sin conexión · lo nuevo sube al volver';
    case 'error':
      return estado.error ?? 'No he podido sincronizar';
    case 'al-dia':
      return estado.ultimaVez !== null ? `Al día · ${haceCuanto(estado.ultimaVez, ahora)}` : 'Al día';
    default:
      return '';
  }
}

/** Lo que oye un lector de pantalla del indicador de la cabecera. */
export function textoDelIndicador(estado: EstadoNube): string | null {
  if (estado.cambioEnLaAbierta) return `Esta idea ha cambiado en el ${estado.cambioEnLaAbierta.dispositivo}`;
  switch (estado.fase) {
    case 'al-dia':
      return 'En la nube, al día';
    case 'trabajando':
      return 'Subiendo a la nube';
    case 'sin-conexion':
      return 'Sin conexión: se sube al volver';
    case 'error':
      return 'La nube tiene un problema';
    default:
      return null;
  }
}
