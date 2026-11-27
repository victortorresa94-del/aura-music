/**
 * La cuenta de aura vista desde bolsillo, sin React. CONTRATO: lo implementa
 * el agente de Cuenta e importar (ola 1); lo usa Crear para pagar.
 *
 * Crear se pide a aura Studio (`/api/fal`, `op:'music'`) con el token de
 * Firebase de la cuenta: mismo proyecto (`aether-app-59bd1`), así que aura
 * Studio lo acepta, cobra del monedero de aura y pone sus frenos.
 */

/** La dirección de aura Studio. No es secreta: `NEXT_PUBLIC_AURA_STUDIO_URL`. */
export function urlAuraStudio(): string {
  const v = process.env.NEXT_PUBLIC_AURA_STUDIO_URL?.trim();
  return (v || 'https://aurastudio.cat').replace(/\/+$/, '');
}

/** El token de Firebase de la cuenta que ha entrado, o null si no hay nadie. */
export async function obtenerToken(): Promise<string | null> {
  return null;
}
