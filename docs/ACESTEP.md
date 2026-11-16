# El músico con IA, en una GPU alquilada

La opción «Con IA» del músico de sesión usa **ACE-Step 1.5**: escucha tu toma
y toca una pista nueva encima (bajo, batería…). Necesita una tarjeta gráfica
NVIDIA y tu PC no la tiene, así que se alquila una por horas en **RunPod** y
Compás habla con ella por internet.

> **Ojo:** `npm run ia:falso` no es la IA. Es un servidor de prueba que toca
> siempre la misma nota. Sirve para probar la app sin pagar GPU (ver el final).

Cómo funciona, en una línea: enciendes una máquina con GPU en RunPod, lanzas
en ella el script `scripts/acestep-gpu.sh`, te da una dirección y una clave,
las pones en `.env.local` y ya está.

---

## Antes de empezar

1. Crea una cuenta en [runpod.io](https://www.runpod.io).
2. Añade saldo en *Billing*. Eso lo haces tú con tu tarjeta; ni Compás ni este
   script tocan pagos.

La primera vez cuenta con un buen rato: se instala todo y se descargan varios
GB de modelos. Las siguientes veces ya está todo en el disco del pod.

## 1. Crear el pod (la máquina con GPU)

1. En RunPod, entra en **Pods** y pulsa **Deploy**.
2. **Elige la GPU.** Una con **16 GB de memoria (VRAM) o más**: RTX 4090,
   RTX A5000, L4 o parecida. El precio por hora sale al lado de cada una,
   mira ese.
3. **Plantilla:** una de **RunPod PyTorch** (la 2.x más reciente que salga).
4. Pulsa **Edit Template** (editar plantilla) y cambia:
   - **Container Disk:** 30 GB.
   - **Volume Disk:** 60 GB. Es el disco que se monta en `/workspace` y **no
     se borra al parar el pod**: ahí se guardan ACE-Step, los modelos y la clave.
   - **Expose HTTP Ports:** añade `8001` a los que ya haya (por ejemplo
     `8888,8001`). Sin esto, Compás no puede llegar al servidor.
5. Elige **On-Demand** (el *Spot* es más barato, pero te lo pueden cortar a
   media sesión) y pulsa **Deploy**.

Tarda un poco en arrancar. Cuando el pod salga como *Running*, sigue.

## 2. Abrir la terminal del pod

En la tarjeta del pod, pulsa **Connect** y abre la **Web Terminal** (si te da
a elegir, *Start* y luego *Connect*). Se abre una pantalla negra en otra
pestaña: eso es la terminal del pod.

También vale abrir **JupyterLab** desde *Connect* y, dentro, *Terminal*.

## 3. Meter el script en el pod

El repositorio aún no está en GitHub, así que el script se pega a mano.

1. En tu PC, abre `scripts/acestep-gpu.sh` (con VS Code o el Bloc de notas),
   selecciónalo todo y cópialo.
2. En la terminal del pod, escribe esta línea y pulsa Intro:

   ```bash
   cat > /workspace/acestep-gpu.sh <<'FIN'
   ```

3. Pega el script: **Ctrl+Mayús+V** o clic derecho y *Pegar* (según el
   navegador, también Ctrl+V).
4. Escribe `FIN` en una línea sola y pulsa Intro. La terminal vuelve a la
   normalidad y el script queda guardado en `/workspace`.

## 4. Lanzarlo

```bash
bash /workspace/acestep-gpu.sh
```

Verás los pasos `1/4` a `4/4`. Al final sale un recuadro como este:

```
==================== COPIA ESTAS DOS LÍNEAS EN .env.local ====================
ACESTEP_API_URL=https://abc123xyz-8001.proxy.runpod.net
ACESTEP_API_KEY=una-clave-larga-y-rara
==============================================================================
```

**Copia esas dos líneas.** La dirección es siempre
`https://<ID-DEL-POD>-8001.proxy.runpod.net` y la clave se genera sola la
primera vez y se guarda en el pod, así que no cambia de un día para otro.

Después el servidor carga los modelos en la GPU. Está listo cuando aparece una
línea parecida a `Uvicorn running on http://0.0.0.0:8001`.

**Deja esa pestaña abierta** mientras uses Compás. Si la cierras y deja de ir,
abre otra vez la terminal y repite el paso 4.

Para comprobarlo sin Compás, abre en el navegador la dirección con `/health`
al final (`https://<ID-DEL-POD>-8001.proxy.runpod.net/health`). Tiene que
salir un texto con `"status":"ok"` y `"service":"ACE-Step API"`.

## 5. Conectar Compás

1. Abre `.env.local` en la carpeta de Compás. Ahora mismo apunta al servidor
   de prueba (`http://localhost:8001`).
2. Cambia las dos líneas `ACESTEP_API_URL=` y `ACESTEP_API_KEY=` por las que
   copiaste.
3. Reinicia Compás: en la terminal donde corre `npm run dev`, Ctrl+C, y otra
   vez `npm run dev`. Las variables solo se leen al arrancar.
4. Abre Compás y el músico de sesión. «Con IA» tiene que salir **conectado**,
   con el nombre ACE-Step 1.5.

Si quieres verlo en crudo, abre `http://localhost:3000/api/musico/estado`:

| Lo que sale | Qué significa |
|---|---|
| `"ia":true, "conectado":true, "prueba":false` | Conectado a la IA de verdad |
| `"prueba":true` | Sigues en el servidor de prueba: revisa `.env.local` y reinicia |
| `"ia":true, "conectado":false` | Configurado, pero el pod no contesta o no acepta la clave |
| `"ia":false` | No hay `ACESTEP_API_URL` en `.env.local` |

**La primera pista tarda bastante más** que las siguientes: el servidor
termina de preparar los modelos. No es que se haya colgado.

## 6. Al terminar: PARA EL POD

En RunPod, en tu pod, pulsa **Stop**.

- **Encendido se paga por segundo**, uses Compás o no. Es lo que más cuesta.
- **Parado se sigue pagando el disco** (los 60 GB de *Volume Disk*), mucho
  menos, pero no es cero.
- **Terminate** borra el pod entero y deja de cobrar del todo. La próxima vez
  se empieza desde el paso 1, con descargas incluidas, y la dirección y la
  clave serán otras.

**La próxima vez:** *Start* en el pod, abre la terminal y lanza otra vez
`bash /workspace/acestep-gpu.sh`. Como todo está en el disco, arranca mucho
antes, y la dirección y la clave son las mismas: no hay que tocar `.env.local`.

A veces, al volver a encenderlo, RunPod dice que en esa máquina no queda esa
GPU libre. Espera un rato o crea un pod nuevo (y entonces sí cambian la
dirección y la clave).

## Si algo no va

| Qué pasa | Qué hacer |
|---|---|
| «Con IA» sin conectar y acabas de lanzar el script | Espera a la línea `Uvicorn running…` y recarga |
| El servidor «no acepta la clave» | Copia otra vez la línea `ACESTEP_API_KEY=` del recuadro y reinicia `npm run dev` |
| `/health` no carga en el navegador | Falta exponer el puerto `8001`: en RunPod, *Edit Pod* y añádelo en *Expose HTTP Ports* |
| En la terminal sale `CUDA out of memory` | La GPU se queda corta: crea el pod con una de 16 GB o más |
| Has cerrado la terminal y ha dejado de ir | Abre otra y lanza `bash /workspace/acestep-gpu.sh` |
| Sigue saliendo «ACE-Step falso» | `.env.local` aún apunta a `localhost:8001`, o no has reiniciado `npm run dev` |

## Probar sin GPU

```bash
npm run ia:falso
```

Y en `.env.local`: `ACESTEP_API_URL=http://localhost:8001`.

Habla el mismo protocolo, pero **no es IA**: toca siempre un La grave (55 Hz)
en cada pulso, 40 ms tarde a propósito para ver que Compás lo cuadra. La app
lo sabe (su `/health` dice «ACE-Step falso») y lo marca como prueba. Con él se
probó el recorrido entero el 16-nov-2026.

## Cuando Compás esté publicado en Vercel

Las mismas dos variables, en Vercel: *Project → Settings → Environment
Variables*, `ACESTEP_API_URL` y `ACESTEP_API_KEY` (y si quieres
`ACESTEP_MODEL` y `ACESTEP_PASOS`). Nunca con `NEXT_PUBLIC_`: la clave no puede
llegar al móvil. Después de cambiarlas, vuelve a desplegar. Y el pod tiene que
estar encendido cuando alguien pida una pista.

---

## Para quien toque el código

- **Protocolo:** `docs/referencias/acestep-api.md`. Compás manda la toma a
  `/release_task` con la tarea `lego`, pregunta en `/query_result` y baja el
  audio de `/v1/audio`, siempre con `Authorization: Bearer <clave>`.
- **Modelo base, no turbo:** `lego` solo funciona con los base. El script
  arranca el servidor con `ACESTEP_CONFIG_PATH=acestep-v15-base` y Compás pide
  ese mismo salvo que digas otro en `ACESTEP_MODEL`.
- **Salud:** `salud()` en `src/lib/ia/acestep.ts`. `/health` no pide clave, así
  que además se pregunta a `/v1/models`, que sí la pide: un 401 ahí es clave
  mala. Todo en 3 s como mucho y sin lanzar nunca. Si el nombre del servicio
  lleva «falso», es el servidor de prueba.
- **El script** (`scripts/acestep-gpu.sh`): instala uv, clona
  `github.com/ACE-Step/ACE-Step-1.5`, `uv sync`, baja los modelos
  (`acestep-download`) y arranca `uv run acestep-api` en `0.0.0.0:8001`. Todo
  vive en `/workspace`, también la caché de uv, el Python y la clave
  (`/workspace/.acestep-clave`).
- **Otros sitios donde ponerlo:** Modal o un Space de Hugging Face con GPU
  valen igual (es el mismo servidor). Una máquina propia compensa a partir de
  unas 500 generaciones al mes (cálculo de agosto).
