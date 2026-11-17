/**
 * Instalar la app en la pantalla de inicio.
 *
 * En Android (Chrome, Edge, Samsung) el navegador lanza `beforeinstallprompt`
 * y podemos enseñar nuestro propio botón. En iPhone no hay nada parecido: se
 * instala a mano desde Compartir. Y en iPhone instalar importa más, porque
 * Safari borra lo que guarda una web tras siete días sin abrirla, mientras
 * que la app instalada no caduca. Pero Safari y la app instalada guardan cada
 * una lo suyo: lo grabado en Safari no aparece en la app.
 *
 * El evento llega una vez y solo se puede usar una vez, así que vive aquí y no
 * en un componente: lo leen igual el aviso y Ajustes, sin que cada uno tenga
 * su copia caducada.
 */

export interface EventoInstalar extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export type Plataforma = 'iphone' | 'android' | 'otro';

export interface EstadoInstalacion {
  /** Ya abierta como app (pantalla de inicio o escritorio). */
  instalada: boolean;
  /** Hay botón de instalar de verdad (Android y Chrome de escritorio). */
  puedePedir: boolean;
}

/** iPhone o iPad. iPadOS se hace pasar por un Mac; lo delata el táctil. */
export function plataformaDe(ua: string, puntosTactiles: number): Plataforma {
  if (/iPad|iPhone|iPod/.test(ua) || (puntosTactiles > 1 && /Macintosh/.test(ua))) return 'iphone';
  if (/Android/i.test(ua)) return 'android';
  return 'otro';
}

export function plataformaActual(): Plataforma {
  if (typeof navigator === 'undefined') return 'otro';
  return plataformaDe(navigator.userAgent, navigator.maxTouchPoints ?? 0);
}

export function abiertaComoApp(): boolean {
  if (typeof window === 'undefined') return false;
  const ios = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return (
    ios ||
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches
  );
}

/* -------------------------------------------------------------------------- */
/* El evento de Android, compartido                                            */
/* -------------------------------------------------------------------------- */

let evento: EventoInstalar | null = null;
let instalada = false;
let escuchando = false;
let estado: EstadoInstalacion = { instalada: false, puedePedir: false };
const oyentes = new Set<() => void>();

function avisar() {
  estado = { instalada, puedePedir: !instalada && evento !== null };
  oyentes.forEach((oyente) => oyente());
}

function escuchar() {
  if (escuchando || typeof window === 'undefined') return;
  escuchando = true;
  instalada = abiertaComoApp();
  window.addEventListener('beforeinstallprompt', (e) => {
    // Sin esto Chrome saca su barra por su cuenta, en el peor momento.
    e.preventDefault();
    evento = e as EventoInstalar;
    avisar();
  });
  window.addEventListener('appinstalled', () => {
    instalada = true;
    evento = null;
    avisar();
  });
  avisar();
}

export function suscribirInstalacion(oyente: () => void): () => void {
  escuchar();
  oyentes.add(oyente);
  return () => oyentes.delete(oyente);
}

export function estadoInstalacion(): EstadoInstalacion {
  escuchar();
  return estado;
}

const SIN_VENTANA: EstadoInstalacion = { instalada: false, puedePedir: false };
export const estadoInstalacionServidor = () => SIN_VENTANA;

/** Saca el diálogo del sistema. Devuelve si se ha instalado. */
export async function pedirInstalacion(): Promise<boolean> {
  const actual = evento;
  if (!actual) return false;
  // El evento no se puede reutilizar: si se rechaza, Chrome mandará otro más adelante.
  evento = null;
  avisar();
  await actual.prompt();
  const { outcome } = await actual.userChoice;
  return outcome === 'accepted';
}
