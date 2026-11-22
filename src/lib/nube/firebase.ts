/**
 * Firebase de verdad: la cuenta de Aura, Firestore y Storage.
 *
 * Se carga a trozos y solo si hay configuración (`config.ts`): sin ella, el
 * SDK ni se descarga y la app pesa y arranca igual que antes. Se usa
 * `firestore/lite` (peticiones normales, sin canal abierto ni caché propia):
 * la caché ya es IndexedDB, que es nuestra, y así no hay dos fuentes de
 * verdad peleándose en el iPhone como le pasó a Aura con la de Firestore.
 *
 * Entrar con Google: primero la ventana emergente, que funciona en el PC y
 * también en la app instalada del iPhone (es lo que usa Aura); si el
 * navegador la bloquea o no la admite, redirección. Ver docs/CUENTA.md para
 * cuando la redirección no vuelve en el iPhone.
 */

import type { FirebaseApp } from 'firebase/app';
import type { Auth, User } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore/lite';
import type { FirebaseStorage } from 'firebase/storage';
import { cerebroVacio, leerCerebro, type Cerebro } from '@/lib/productor/cerebro';
import type { ConfigFirebase } from './config';
import { aProyectoRemoto, empaquetar } from './documento';
import type { CerebroRemoto, Dispositivo, MetaAudio, ProyectoRemoto, Remoto } from './tipos';

export interface Usuario {
  uid: string;
  nombre: string | null;
  correo: string | null;
  foto: string | null;
}

type ModApp = typeof import('firebase/app');
type ModAuth = typeof import('firebase/auth');
type ModFs = typeof import('firebase/firestore/lite');
type ModSt = typeof import('firebase/storage');

export interface Conexion {
  observar(cb: (usuario: Usuario | null) => void): () => void;
  /** `redirigiendo`: la página se va a Google y vuelve sola. */
  entrarConGoogle(): Promise<'dentro' | 'redirigiendo' | 'cancelado'>;
  entrarConCorreo(correo: string, clave: string): Promise<void>;
  recuperarClave(correo: string): Promise<void>;
  salir(): Promise<void>;
  remoto(uid: string): Remoto;
}

let conexion: Promise<Conexion> | null = null;

/** Una sola vez por página. Lanza si no se puede cargar (sin red la primera vez, por ejemplo). */
export function conectar(config: ConfigFirebase): Promise<Conexion> {
  if (!conexion) {
    conexion = montar(config).catch((error: unknown) => {
      conexion = null;
      throw error;
    });
  }
  return conexion;
}

function aUsuario(u: User): Usuario {
  return { uid: u.uid, nombre: u.displayName, correo: u.email, foto: u.photoURL };
}

async function montar(config: ConfigFirebase): Promise<Conexion> {
  const [app, auth, fs, st] = await Promise.all([
    import('firebase/app') as Promise<ModApp>,
    import('firebase/auth') as Promise<ModAuth>,
    import('firebase/firestore/lite') as Promise<ModFs>,
    import('firebase/storage') as Promise<ModSt>,
  ]);

  // Una app con nombre propio: si algún día se carga otra cosa de Firebase en la página, no se pisan.
  const nombre = 'aura-music';
  const firebase: FirebaseApp = app.getApps().find((a) => a.name === nombre) ?? app.initializeApp(config, nombre);
  let cuenta: Auth;
  try {
    cuenta = auth.initializeAuth(firebase, {
      // La sesión sobrevive a cerrar la app y a abrirla sin red.
      persistence: [auth.indexedDBLocalPersistence, auth.browserLocalPersistence],
      popupRedirectResolver: auth.browserPopupRedirectResolver,
    });
  } catch {
    // Ya estaba (al recargar el código en desarrollo): la misma.
    cuenta = auth.getAuth(firebase);
  }
  cuenta.languageCode = 'es';
  const db: Firestore = fs.getFirestore(firebase);
  const almacen: FirebaseStorage = st.getStorage(firebase);
  // El SDK reintenta sin red hasta 10 min por subida y 2 por bajada; la cola
  // ya reintenta por su cuenta, y así el estado dice «Sin conexión» antes.
  almacen.maxUploadRetryTime = 90_000;
  almacen.maxOperationRetryTime = 30_000;

  // Si se entró por redirección, aquí se recoge. Los errores se ven al observar la cuenta.
  void auth.getRedirectResult(cuenta).catch(() => undefined);

  const google = new auth.GoogleAuthProvider();
  // Como en Aura: siempre el selector de cuentas, para poder entrar con otra.
  google.setCustomParameters({ prompt: 'select_account' });

  return {
    observar(cb) {
      return auth.onAuthStateChanged(cuenta, (u) => cb(u ? aUsuario(u) : null));
    },

    async entrarConGoogle() {
      try {
        await auth.signInWithPopup(cuenta, google);
        return 'dentro';
      } catch (error) {
        const codigo = (error as { code?: string }).code ?? '';
        if (codigo === 'auth/popup-closed-by-user' || codigo === 'auth/cancelled-popup-request') return 'cancelado';
        if (
          codigo === 'auth/popup-blocked' ||
          codigo === 'auth/operation-not-supported-in-this-environment' ||
          codigo === 'auth/web-storage-unsupported'
        ) {
          await auth.signInWithRedirect(cuenta, google);
          return 'redirigiendo';
        }
        throw error;
      }
    },

    async entrarConCorreo(correo, clave) {
      await auth.signInWithEmailAndPassword(cuenta, correo.trim(), clave);
    },

    async recuperarClave(correo) {
      await auth.sendPasswordResetEmail(cuenta, correo.trim());
    },

    async salir() {
      await auth.signOut(cuenta);
    },

    remoto(uid) {
      return remotoDe(fs, st, db, almacen, uid);
    },
  };
}

function remotoDe(fs: ModFs, st: ModSt, db: Firestore, almacen: FirebaseStorage, uid: string): Remoto {
  const ideas = fs.collection(db, 'users', uid, 'auraMusicProjects');
  const docCerebro = fs.doc(db, 'users', uid, 'auraMusic', 'cerebro');
  const audio = (proyectoId: string, bufferId: string) => st.ref(almacen, `users/${uid}/aura-music/${proyectoId}/${bufferId}`);
  const carpeta = (proyectoId: string) => st.ref(almacen, `users/${uid}/aura-music/${proyectoId}`);

  const leer = (id: string, datos: Record<string, unknown>): ProyectoRemoto | null => {
    const gz = datos.gz instanceof fs.Bytes ? datos.gz.toUint8Array() : undefined;
    const hora = datos.servidorEn instanceof fs.Timestamp ? datos.servidorEn.toMillis() : 0;
    return aProyectoRemoto(id, { ...datos, gz }, hora);
  };

  const noEsta = (error: unknown) => (error as { code?: string }).code === 'storage/object-not-found';

  return {
    async listarProyectos(desde) {
      const consulta = desde ? fs.query(ideas, fs.where('servidorEn', '>', fs.Timestamp.fromMillis(desde))) : ideas;
      const instantanea = await fs.getDocs(consulta);
      return instantanea.docs.map((d) => leer(d.id, d.data())).filter((p): p is ProyectoRemoto => p !== null);
    },

    async leerProyecto(id) {
      const d = await fs.getDoc(fs.doc(ideas, id));
      return d.exists() ? leer(d.id, d.data()) : null;
    },

    async escribirProyecto(proyecto, buffers, dispositivo: Dispositivo) {
      const paquete = empaquetar(proyecto);
      // `merge`: los campos de la limpieza (huérfanos) no se pisan al guardar.
      await fs.setDoc(
        fs.doc(ideas, proyecto.id),
        {
          esquema: 1,
          id: proyecto.id,
          nombre: proyecto.name,
          pistas: proyecto.tracks.length,
          updatedAt: proyecto.updatedAt,
          borrado: false,
          audioBorrado: false,
          buffers,
          dispositivo,
          json: paquete.json ?? fs.deleteField(),
          gz: paquete.gz ? fs.Bytes.fromUint8Array(paquete.gz) : fs.deleteField(),
          servidorEn: fs.serverTimestamp(),
        },
        { merge: true },
      );
    },

    async escribirBorrado(id, updatedAt, dispositivo) {
      await fs.setDoc(
        fs.doc(ideas, id),
        {
          esquema: 1,
          id,
          updatedAt,
          borrado: true,
          audioBorrado: false,
          buffers: [],
          dispositivo,
          json: fs.deleteField(),
          gz: fs.deleteField(),
          servidorEn: fs.serverTimestamp(),
        },
        { merge: true },
      );
    },

    async marcarLimpieza(id, huerfanos, audioBorrado) {
      await fs.updateDoc(fs.doc(ideas, id), audioBorrado === undefined ? { huerfanos } : { huerfanos, audioBorrado });
    },

    subirAudio(proyectoId, bufferId, flac, meta: MetaAudio, alProgreso) {
      return new Promise<void>((resolver, rechazar) => {
        // Subida reanudable: si la red parpadea, sigue donde iba en vez de empezar de cero.
        const tarea = st.uploadBytesResumable(audio(proyectoId, bufferId), flac, {
          contentType: 'audio/flac',
          cacheControl: 'private, max-age=31536000, immutable',
          customMetadata: {
            app: 'aura-music',
            formato: 'flac-16',
            sampleRate: String(meta.sampleRate),
            canales: String(meta.canales),
            muestras: String(meta.muestras),
          },
        });
        tarea.on('state_changed', (s) => alProgreso?.(s.bytesTransferred), rechazar, () => resolver());
      });
    },

    async bajarAudio(proyectoId, bufferId) {
      try {
        return new Uint8Array(await st.getBytes(audio(proyectoId, bufferId)));
      } catch (error) {
        if (noEsta(error)) return null;
        throw error;
      }
    },

    async listarAudios(proyectoId) {
      const lista = await st.listAll(carpeta(proyectoId));
      return lista.items.map((item) => item.name);
    },

    async borrarAudio(proyectoId, bufferId) {
      try {
        await st.deleteObject(audio(proyectoId, bufferId));
      } catch (error) {
        if (!noEsta(error)) throw error;
      }
    },

    async leerCerebro(): Promise<CerebroRemoto | null> {
      const d = await fs.getDoc(docCerebro);
      if (!d.exists()) return null;
      const datos = d.data();
      const cerebro: Cerebro = typeof datos.json === 'string' ? leerCerebro(datos.json) : cerebroVacio();
      return { cerebro, updatedAt: typeof datos.updatedAt === 'number' ? datos.updatedAt : 0 };
    },

    async escribirCerebro(cerebro, dispositivo) {
      await fs.setDoc(docCerebro, {
        json: JSON.stringify(cerebro),
        updatedAt: Date.now(),
        dispositivo,
        servidorEn: fs.serverTimestamp(),
      });
    },
  };
}

/** El error al entrar, dicho para una persona. */
export function textoDelErrorAlEntrar(error: unknown): string {
  const codigo = (error as { code?: string })?.code ?? '';
  switch (codigo) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-login-credentials':
      return 'El correo o la contraseña no son correctos.';
    case 'auth/invalid-email':
      return 'Ese correo no parece un correo.';
    case 'auth/missing-password':
      return 'Falta la contraseña.';
    case 'auth/too-many-requests':
      return 'Demasiados intentos seguidos. Espera un poco o cambia la contraseña.';
    case 'auth/user-disabled':
      return 'Esta cuenta está desactivada en Aura.';
    case 'auth/network-request-failed':
      return 'Sin conexión. Prueba cuando vuelva la red.';
    case 'auth/unauthorized-domain':
      return 'Esta web todavía no está autorizada en Firebase (paso 1 de docs/CUENTA.md).';
    case 'auth/account-exists-with-different-credential':
      return 'Ese correo ya entra en Aura de otra forma. Usa la que usas allí.';
    default:
      return 'No he podido entrar. Vuelve a probar en un momento.';
  }
}
