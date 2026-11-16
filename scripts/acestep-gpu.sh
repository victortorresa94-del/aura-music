#!/usr/bin/env bash
# Compás · levanta ACE-Step 1.5 (el músico con IA) en una GPU alquilada.
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
export PATH="$HOME/.local/bin:$PATH"

echo ">> 1/4 Preparando uv (el instalador de Python que usa ACE-Step)"
command -v uv >/dev/null || curl -LsSf https://astral.sh/uv/install.sh | sh

echo ">> 2/4 Descargando ACE-Step 1.5 e instalando lo que necesita (la primera vez tarda)"
[ -d ACE-Step-1.5 ] || git clone https://github.com/ACE-Step/ACE-Step-1.5.git
cd ACE-Step-1.5
uv sync

echo ">> 3/4 Descargando los modelos (la primera vez son varios GB)"
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
export ACESTEP_CONFIG_PATH=acestep-v15-base ACESTEP_API_HOST=0.0.0.0 ACESTEP_API_PORT=8001 ACESTEP_API_KEY

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
Deja esta terminal abierta mientras uses Compás. La primera vez tarda en estar
listo: carga los modelos en la GPU. Para pararlo: Ctrl+C, y PARA EL POD en RunPod.

AVISO

exec uv run acestep-api
