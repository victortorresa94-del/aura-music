/**
 * La latencia del toque: lo que tarda tu dedo en convertirse en un evento,
 * más lo que tardas tú en reaccionar a lo que oyes.
 *
 * Es otra cifra que la del micro (ver `daw/latency.ts`): aquí no hay audio que
 * dé la vuelta, hay una pantalla. Se mide con «Toca 8 veces con la claqueta»:
 * cada toque se compara con el click más cercano y la mediana (que no se deja
 * engañar por un toque despistado) se guarda en este dispositivo y se resta al
 * grabar.
 */

const CLAVE = 'aura-music:toque-ms';

/** Mediana de los desvíos, en ms. null si hay menos de 6 toques válidos. */
export function medirToque(toques: number[], clicks: number[], o: { maxMs?: number; minimo?: number } = {}): number | null {
  const max = (o.maxMs ?? 250) / 1000;
  const desvios: number[] = [];
  for (const t of toques) {
    let mejor = Infinity;
    for (const c of clicks) {
      if (Math.abs(t - c) < Math.abs(mejor)) mejor = t - c;
    }
    if (Math.abs(mejor) <= max) desvios.push(mejor * 1000);
  }
  if (desvios.length < (o.minimo ?? 6)) return null;
  desvios.sort((a, b) => a - b);
  const medio = Math.floor(desvios.length / 2);
  const mediana = desvios.length % 2 ? desvios[medio] : (desvios[medio - 1] + desvios[medio]) / 2;
  return Math.round(mediana);
}

/** Cuánto bailan los toques entre sí: si es mucho, la medida no vale. */
export function dispersionToque(toques: number[], clicks: number[]): number {
  const desvios = toques.map((t) => {
    let mejor = Infinity;
    for (const c of clicks) if (Math.abs(t - c) < Math.abs(mejor)) mejor = t - c;
    return mejor * 1000;
  });
  if (desvios.length < 2) return 0;
  const media = desvios.reduce((a, b) => a + b, 0) / desvios.length;
  return Math.sqrt(desvios.reduce((a, b) => a + (b - media) ** 2, 0) / desvios.length);
}

export function leerToqueMs(): number | null {
  try {
    const valor = window.localStorage.getItem(CLAVE);
    if (valor === null) return null;
    const ms = Number(valor);
    return Number.isFinite(ms) ? ms : null;
  } catch {
    return null;
  }
}

export function guardarToqueMs(ms: number | null) {
  try {
    if (ms === null) window.localStorage.removeItem(CLAVE);
    else window.localStorage.setItem(CLAVE, String(Math.round(ms)));
  } catch {
    /* almacenamiento bloqueado: se queda sin calibrar */
  }
}

/**
 * El instante en que se OYÓ lo que sonaba cuando tocaste, en el reloj del
 * contexto. Con `getOutputTimestamp` el navegador dice qué instante del
 * contexto está saliendo por el altavoz en cada momento: casándolo con la
 * hora del evento táctil se sabe a qué sonido respondía tu dedo, y la
 * latencia de salida queda fuera de la cuenta. Sin él, se resta la latencia
 * de salida que declara el navegador.
 */
export function instanteDelToque(ctx: AudioContext, horaEvento?: number): number {
  const ahora = performance.now();
  const hora = horaEvento !== undefined && horaEvento > 0 && Math.abs(ahora - horaEvento) < 1000 ? horaEvento : ahora;
  const salida = (ctx.outputLatency || 0) + (ctx.baseLatency || 0);
  const respaldo = ctx.currentTime - salida - (ahora - hora) / 1000;
  try {
    const marca = ctx.getOutputTimestamp?.();
    if (marca && marca.contextTime && marca.performanceTime) {
      const t = marca.contextTime + (hora - marca.performanceTime) / 1000;
      // Algún navegador devuelve marcas viejas o a cero al arrancar.
      if (Math.abs(t - respaldo) < 0.25) return t;
    }
  } catch {
    /* sin marca de salida */
  }
  return respaldo;
}
