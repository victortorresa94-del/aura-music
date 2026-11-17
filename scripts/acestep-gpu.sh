#!/usr/bin/env bash
# Aura Music · levanta ACE-Step 1.5 (el músico con IA) en una GPU alquilada.
# Pensado para un pod de RunPod (Linux, NVIDIA, plantilla PyTorch).
# Uso: bash acestep-gpu.sh    Guía paso a paso: docs/ACESTEP.md
# Se puede lanzar las veces que haga falta: lo que ya está hecho no se repite.
set -euo pipefail

# En RunPod solo /workspace sobrevive al parar el pod: todo va ahí.
BASE=/workspace
[ -d "$BASE" ] || BASE="$HOME"
cd "$BASE"
export UV_CACHE_DIR="$BASE/.uv/cache" UV_PYTHON_INSTALL_DIR="$BASE/.uv/python"
export HF_HOME="$BASE/.cache/huggingface"
# La plantilla PyTorch de RunPod trae HF_HUB_ENABLE_HF_TRANSFER=1, pero el
# entorno de ACE-Step no tiene el paquete hf_transfer: con eso activado, la
# descarga de Hugging Face falla y el servidor no arranca («Failed to download
# main model»). Se apaga y se baja por la vía normal.
export HF_HUB_ENABLE_HF_TRANSFER=0
export PATH="$HOME/.local/bin:$PATH"

echo ">> 1/4 Preparando uv (el instalador de Python que usa ACE-Step)"
command -v uv >/dev/null || curl -LsSf https://astral.sh/uv/install.sh | sh

echo ">> 2/4 Descargando ACE-Step 1.5 e instalando lo que necesita (la primera vez tarda)"
[ -d ACE-Step-1.5 ] || git clone https://github.com/ACE-Step/ACE-Step-1.5.git
cd ACE-Step-1.5
uv sync

echo ">> 3/4 Descargando los modelos (la primera vez son varios GB)"
# Una descarga que se cortó deja la carpeta del modelo creada pero vacía o a
# medias, el descargador la da por buena y el servidor muere al cargarla
# («Unrecognized model … Should have a `model_type` key»). Si el config.json
# no está completo, se borra la carpeta y se baja de nuevo.
for MODELO in checkpoints/acestep-v15-base checkpoints/acestep-v15-turbo; do
  if [ -d "$MODELO" ] && ! grep -q '"model_type"' "$MODELO/config.json" 2>/dev/null; then
    echo "!! $MODELO quedó a medias: la borro y la bajo otra vez"
    rm -rf "$MODELO"
  fi
done
uv run acestep-download ||
  echo "!! No he podido bajar los modelos ahora. No pasa nada: el servidor los baja al arrancar (tardará más)."
uv run acestep-download --model acestep-v15-base ||
  echo "!! No he podido bajar el modelo base ahora. No pasa nada: el servidor lo baja al arrancar (tardará más)."

echo ">> 4/4 Arrancando el servidor"
# La clave se guarda en /workspace para que no cambie cada vez que enciendes el pod.
FICHERO_CLAVE="$BASE/.acestep-clave"
if [ -z "${ACESTEP_API_KEY:-}" ]; then
  [ -s "$FICHERO_CLAVE" ] || python3 -c 'import secrets; print(secrets.token_urlsafe(32))' > "$FICHERO_CLAVE"
  chmod 600 "$FICHERO_CLAVE"
  ACESTEP_API_KEY="$(cat "$FICHERO_CLAVE")"
fi
# El modelo base: el turbo no sabe tocar sobre tu toma (tarea lego).
# ACESTEP_NO_INIT=false: carga el modelo en la GPU AL ARRANCAR. Por defecto
# ACE-Step lo carga con la primera petición, y esa primera pista tardaría más
# de los 3 minutos que espera la app (acestep/api/startup_model_init.py).
export ACESTEP_CONFIG_PATH=acestep-v15-base ACESTEP_API_HOST=0.0.0.0 ACESTEP_API_PORT=8001 ACESTEP_API_KEY
export ACESTEP_NO_INIT=false

if [ -n "${RUNPOD_POD_ID:-}" ]; then
  URL="https://${RUNPOD_POD_ID}-8001.proxy.runpod.net"
else
  URL="http://LA-IP-DE-ESTA-MAQUINA:8001"
fi
cat <<AVISO

==================== COPIA ESTAS DOS LÍNEAS EN .env.local ====================
ACESTEP_API_URL=$URL
ACESTEP_API_KEY=$ACESTEP_API_KEY
==============================================================================
Está listo cuando abajo salga «Uvicorn running on http://0.0.0.0:8001».
Antes carga el modelo en la GPU: uno o dos minutos. Puedes cerrar esta
pestaña, el servidor sigue.

AVISO

# ── Apagado automático ──────────────────────────────────────────────────
# Un pod encendido cobra por segundo aunque nadie le pida nada (17-nov-2026,
# el dueño: «se me han cobrado 10 $ por nada»). Cada petición que llega al
# servidor (pistas, canciones, la comprobación de la app al abrirse) deja
# una marca; si pasan APAGAR_TRAS_MIN minutos sin ninguna, el pod se para
# solo con runpodctl, que RunPod trae instalado en cada pod con una clave
# limitada a él mismo. Se vuelve a encender desde la app («Encender la
# GPU») o con Start en RunPod. APAGAR_TRAS_MIN=0 lo desactiva.
ACTIVIDAD="$BASE/.acestep-ultima-peticion"
MINUTOS="${APAGAR_TRAS_MIN:-15}"
LIMITE="${APAGAR_TRAS_SEG:-$((MINUTOS * 60))}"
CADA="${VIGILAR_CADA_SEG:-60}"
touch "$ACTIVIDAD"
if [ -n "${RUNPOD_POD_ID:-}" ] && [ "$LIMITE" -gt 0 ] && command -v runpodctl >/dev/null 2>&1; then
  (
    while sleep "$CADA"; do
      quieto=$(( $(date +%s) - $(stat -c %Y "$ACTIVIDAD") ))
      if [ "$quieto" -ge "$LIMITE" ]; then
        echo ">> $((LIMITE / 60)) minutos sin pedidos: apago el pod para que no cobre."
        runpodctl pod stop "$RUNPOD_POD_ID" 2>/dev/null || runpodctl stop pod "$RUNPOD_POD_ID" ||
          echo "!! No he podido pararlo solo: páralo con Stop en RunPod."
        exit 0
      fi
    done
  ) &
  echo ">> Apagado automático: si pasan $((LIMITE / 60)) minutos sin pedidos, el pod se para solo."
else
  echo "!! Sin apagado automático (no estoy en RunPod o falta runpodctl): acuérdate de pulsar Stop."
fi

# El servidor escribe una línea por petición («"POST /release_task …"»):
# cada una renueva la marca de actividad.
uv run acestep-api 2>&1 | while IFS= read -r linea; do
  printf '%s\n' "$linea"
  case "$linea" in
    *'"GET /'* | *'"POST /'*) touch "$ACTIVIDAD" ;;
  esac
done
