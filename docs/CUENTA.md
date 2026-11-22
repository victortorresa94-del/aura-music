# Tu cuenta de Aura en Aura Music

Para tener las mismas ideas en el móvil y en el PC. Son tres pasos, en este
orden, y se hacen una sola vez. Unos 15 minutos.

Lo que necesitas:
- entrar en la consola de Firebase con la cuenta de Google que administra
  Aura (el proyecto se llama **aether-app-59bd1**);
- entrar en Vercel, en el proyecto **aura-music**.

Hasta que no hagas el paso 3, la app sigue exactamente como hoy: todo se
guarda solo en cada dispositivo y no aparece nada de la cuenta.

---

## Paso 1 · Dejar que Aura Music use el inicio de sesión de Aura

Firebase solo deja entrar desde las webs que tú le digas.

1. Abre <https://console.firebase.google.com/project/aether-app-59bd1/authentication/settings>.
2. Arriba, pestaña **Configuración** (en inglés, *Settings*).
3. En el menú de la izquierda, **Dominios autorizados** (*Authorized domains*).
4. Botón **Añadir dominio** (*Add domain*).
5. Escribe, tal cual, sin `https://` y sin barra al final:

   ```
   aura-music-olive-three.vercel.app
   ```

6. **Añadir**. Tiene que salir en la lista, junto a `localhost` y los de Aura.

De paso, comprueba en la pestaña **Método de inicio de sesión** (*Sign-in
method*) que **Google** y **Correo electrónico/contraseña** salen como
*Habilitado*. Deberían, porque Aura los usa.

---

## Paso 2 · Dejar que Aura Music baje el audio del almacenamiento de Aura

El audio de tus ideas va al almacenamiento (Storage) de Aura. Subir funciona
sin tocar nada, pero para **bajarlo** en el otro dispositivo el navegador
exige que el almacenamiento diga «esta web puede leerme». Eso se llama CORS.

Ojo: el almacenamiento tiene una sola lista de webs permitidas, y el comando
de Google la **sustituye entera**. Por eso los comandos de abajo leen primero
la que haya (por si Aura ya tiene alguna) y le **añaden** Aura Music sin
quitar nada.

1. Abre <https://console.cloud.google.com/home/dashboard?project=aether-app-59bd1>.
2. Arriba a la derecha, el icono **>_** (*Activar Cloud Shell*). Se abre una
   terminal abajo. Si pregunta, **Autorizar**.
3. Copia este bloque entero, pégalo en la terminal y pulsa Intro:

   ```bash
   BUCKET=gs://aether-app-59bd1.firebasestorage.app
   gsutil cors get $BUCKET > cors-actual.json 2>/dev/null || true
   python3 - <<'EOF'
   import json
   nuevo = {
     "origin": [
       "https://aura-music-olive-three.vercel.app",
       "http://localhost:3000"
     ],
     "method": ["GET", "HEAD"],
     "responseHeader": ["Content-Type", "Content-Length", "Content-Range"],
     "maxAgeSeconds": 3600
   }
   try:
     actual = json.load(open("cors-actual.json"))
     if not isinstance(actual, list):
       actual = []
   except Exception:
     actual = []  # no había ninguna lista
   if nuevo not in actual:
     actual.append(nuevo)
   json.dump(actual, open("cors-final.json", "w"), indent=2)
   print("Lista que se va a poner:")
   print(json.dumps(actual, indent=2))
   EOF
   gsutil cors set cors-final.json $BUCKET
   echo "Comprobación:"
   gsutil cors get $BUCKET
   ```

4. Al final tiene que salir una lista que incluya
   `https://aura-music-olive-three.vercel.app`. Si había otras webs (las de
   Aura), siguen ahí.

Si `gsutil` dijera que no existe (Google lo va retirando), lo mismo con el
comando nuevo: `gcloud storage buckets update gs://aether-app-59bd1.firebasestorage.app --cors-file=cors-final.json`.

Solo lectura: esto no deja a nadie leer tus ideas. Quién puede leer qué lo
deciden las reglas de Aura (cada cuenta solo lo suyo); el CORS solo deja que
el navegador entregue a Aura Music lo que esas reglas ya permiten.

---

## Paso 3 · Poner la configuración en Vercel

Son seis valores. Son públicos por diseño (van dentro del JavaScript de
cualquier web con Firebase, también en el de Aura) y no abren nada por sí
solos; por eso pueden ir con `NEXT_PUBLIC_`.

1. Abre <https://vercel.com>, proyecto **aura-music** → **Settings** →
   **Environment Variables**.
2. Añade estas seis, una a una, marcando **Production** y **Preview**:

   | Nombre | Valor |
   |---|---|
   | `NEXT_PUBLIC_FIREBASE_API_KEY` | `AIzaSyADVBVjyLik8D54SLlE9-8jqkKV5JlRl_I` |
   | `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `aether-app-59bd1.firebaseapp.com` |
   | `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | `aether-app-59bd1` |
   | `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | `aether-app-59bd1.firebasestorage.app` |
   | `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | `462116144844` |
   | `NEXT_PUBLIC_FIREBASE_APP_ID` | `1:462116144844:web:b1985be915ecbeffe36469` |

   (Son los de la web de Aura; los mismos están en `.env.example`.)
3. **Vuelve a desplegar**: pestaña **Deployments** → los tres puntos del
   último → **Redeploy**. Hace falta porque estos valores se meten en la app
   al compilarla: sin desplegar otra vez no aparecen.

---

## Paso 4 · Probarlo

1. **En el PC**, abre <https://aura-music-olive-three.vercel.app>. Toca el
   nombre de la idea (arriba a la izquierda) para abrir **Ajustes**. Sale
   **Tu cuenta de Aura** → **Entrar con Google** (o con tu correo y
   contraseña de Aura). Al entrar, tus ideas de ese PC empiezan a subir; bajo
   tu nombre pone «Subiendo…» y luego «Al día».
2. **En el móvil**, lo mismo. Las ideas del PC aparecen en **Ideas
   guardadas**; al abrir una, pone «Bajando el audio de la nube…» y suena.
3. En el iPhone, **la app instalada y Safari son dos sitios distintos**:
   entra con la cuenta en la que uses (o en las dos).

Junto al número de pistas, arriba, un icono de nube dice cómo va: con
marca, al día; con flecha hacia arriba, subiendo; tachada, sin conexión (lo
pendiente sube solo al volver); con exclamación, algo falla y Ajustes dice
qué y deja reintentar.

---

## Si algo no va

- **«Esta web todavía no está autorizada en Firebase»** al entrar: falta el
  paso 1, o el dominio tiene una errata.
- **Las ideas aparecen pero el audio no baja** («No puedo bajar el audio de
  la nube»): falta el paso 2. Repite el bloque y mira que en la
  comprobación salga el dominio.
- **No sale «Tu cuenta de Aura» en Ajustes**: falta el paso 3 o el
  *Redeploy*.
- **En la app instalada del iPhone, tras elegir la cuenta de Google, vuelve
  sin haber entrado.** Es raro (la ventana de Google suele funcionar ahí,
  como en Aura), pero si te pasa:
  1. En Vercel cambia `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` a
     `aura-music-olive-three.vercel.app` y vuelve a desplegar. La app ya
     sirve las páginas de inicio de sesión de Firebase desde su propio
     dominio (`/__/auth/…`), así que Safari no las trata como de otra web.
  2. En <https://console.cloud.google.com/apis/credentials?project=aether-app-59bd1>,
     abre el cliente **Web client (auto created by Google Service)**, y en
     **URIs de redireccionamiento autorizados** añade
     `https://aura-music-olive-three.vercel.app/__/auth/handler`. Guardar.
     No afecta a Aura: solo añade una dirección más.

## Qué pasa con tus ideas

- **Se guardan primero en el dispositivo**, como siempre. La nube se pone al
  día por detrás: grabar no espera nunca a la red.
- **Cada idea** va a `users/{tu cuenta}/auraMusicProjects` en Firestore, y
  **cada audio** a `users/{tu cuenta}/aura-music/{idea}/` en Storage, en FLAC
  (sin pérdidas, unos 3,4 MB por minuto de toma; el silencio casi no ocupa).
  El cerebro del productor, en `users/{tu cuenta}/auraMusic/cerebro`.
- **Si cambias la misma idea en los dos sin red**, gana la última
  modificación; si la otra tenía tomas que esta no, se guarda aparte como
  «Nombre · copia del iPhone». Nunca se pierde una toma.
- **Si la idea que tienes abierta cambia en el otro dispositivo**, Ajustes
  te pregunta: cargar esa o seguir con la tuya.
- **Al borrar una idea** se borra en todos tus dispositivos; su audio se
  queda 30 días en la nube por si acaso y luego se va.
- **Al salir de la cuenta**, tus ideas siguen en ese dispositivo.
