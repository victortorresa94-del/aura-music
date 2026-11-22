/**
 * La configuración web de Firebase (el proyecto de Aura, `aether-app-59bd1`).
 *
 * Es pública por diseño: va en el JavaScript de cualquier web con Firebase y
 * no abre nada por sí sola. Lo que protege tus ideas son las reglas de
 * Firestore y Storage de Aura (cada cuenta solo lee y escribe `users/{su uid}`).
 * Por eso puede ir en `NEXT_PUBLIC_*`; las claves de verdad siguen solo en el
 * servidor (regla 4 de CLAUDE.md).
 *
 * Sin estas variables no hay nube y la app es la de siempre: todo en el móvil.
 * Next solo las mete en el código si se escriben enteras, una a una.
 */

export interface ConfigFirebase {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  appId: string;
  messagingSenderId?: string;
}

export function leerConfig(entorno: Record<string, string | undefined>): ConfigFirebase | null {
  const apiKey = entorno.apiKey?.trim();
  const authDomain = entorno.authDomain?.trim();
  const projectId = entorno.projectId?.trim();
  const storageBucket = entorno.storageBucket?.trim();
  const appId = entorno.appId?.trim();
  if (!apiKey || !authDomain || !projectId || !storageBucket || !appId) return null;
  const messagingSenderId = entorno.messagingSenderId?.trim() || undefined;
  return { apiKey, authDomain, projectId, storageBucket, appId, messagingSenderId };
}

export function configFirebase(): ConfigFirebase | null {
  return leerConfig({
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  });
}

/** ¿Hay nube en esta compilación? Si no, nada de la cuenta se carga ni se enseña. */
export function hayNube(): boolean {
  return configFirebase() !== null;
}
