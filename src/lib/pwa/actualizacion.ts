/**
 * Registro del service worker y versiones nuevas, sin sustos.
 *
 * Una versión nueva se instala sola en segundo plano y se queda esperando: no
 * hay `skipWaiting` automático, porque activarla a media sesión cambia el
 * código bajo los pies de una toma. La app avisa con «Nueva versión ·
 * Actualizar» y solo al tocarlo se activa y se recarga, y nunca mientras se
 * graba o suena: perder trabajo tras actualizar es de lo que más odia la
 * gente de los estudios de móvil.
 *
 * `updateViaCache: 'none'` y el `Cache-Control: no-cache` de `next.config.ts`
 * hacen que el navegador pregunte de verdad por `sw.js` cada vez, en vez de
 * fiarse de su caché HTTP durante horas.
 */

import type { TransportState } from '@/lib/daw/types';

export const URL_SERVICE_WORKER = '/sw.js';

/** Cada cuánto se pregunta por una versión nueva con la app abierta. */
const CADA_CUANTO_MIRAR = 60 * 60 * 1000;

/**
 * Se puede recargar sin perder nada: el transporte parado y ninguna tarea a
 * medias (exportar, el músico generando, una importación).
 */
export function sePuedeActualizar(transporte: TransportState, ocupado: boolean): boolean {
  return transporte === 'stopped' && !ocupado;
}

/**
 * Registra el worker y llama a `alHaberVersion` cuando hay una esperando.
 * Solo en producción: en desarrollo no hay worker (Serwist no lo genera) y
 * un `sw.js` viejo de otra compilación serviría código caducado.
 */
export async function registrarServiceWorker(
  alHaberVersion: (registro: ServiceWorkerRegistration) => void,
): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null;
  if (process.env.NODE_ENV !== 'production') return null;
  if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') return null;

  let registro: ServiceWorkerRegistration;
  try {
    registro = await navigator.serviceWorker.register(URL_SERVICE_WORKER, {
      scope: '/',
      updateViaCache: 'none',
    });
  } catch {
    // Sin worker la app sigue funcionando, solo que sin conexión no abre.
    return null;
  }

  // Hay versión nueva si alguien espera Y ya había una mandando. La primera
  // instalación no cuenta: no hay nada que actualizar.
  const mirar = () => {
    if (registro.waiting && navigator.serviceWorker.controller) alHaberVersion(registro);
  };
  mirar();
  registro.addEventListener('updatefound', () => {
    const nuevo = registro.installing;
    nuevo?.addEventListener('statechange', () => {
      if (nuevo.state === 'installed') mirar();
    });
  });

  /* Una app instalada puede pasar días abierta en segundo plano: se pregunta
     al volver a ella y, con ella delante, cada hora. */
  const buscar = () => void registro.update().catch(() => undefined);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') buscar();
  });
  window.setInterval(buscar, CADA_CUANTO_MIRAR);

  return registro;
}

/**
 * Activa la versión que espera y recarga cuando ya manda. Solo se recarga si
 * lo hemos pedido nosotros: `controllerchange` también salta cuando otra
 * pestaña actualiza, y esa recarga no es nuestra.
 */
export function activarVersionNueva(registro: ServiceWorkerRegistration): void {
  const esperando = registro.waiting;
  if (!esperando) {
    window.location.reload();
    return;
  }
  let recargando = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (recargando) return;
    recargando = true;
    window.location.reload();
  });
  esperando.postMessage({ type: 'SKIP_WAITING' });
}
