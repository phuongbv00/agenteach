#!/usr/bin/env bash
# =============================================================================
# setup.sh — One-time setup for the Agenteach GPU server
# Run as root or a user with sudo + docker privileges
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(dirname "$SCRIPT_DIR")"

log()  { echo "[setup] $*"; }
die()  { echo "[setup] ERROR: $*" >&2; exit 1; }
need() { command -v "$1" &>/dev/null || die "'$1' not found — install it first"; }

# ---------------------------------------------------------------------------
# 1. Check prerequisites
# ---------------------------------------------------------------------------
log "Checking prerequisites..."
need docker
need nvidia-smi

DOCKER_VERSION=$(docker version --format '{{.Server.Version}}' 2>/dev/null)
log "Docker: $DOCKER_VERSION"

GPU_COUNT=$(nvidia-smi --list-gpus | wc -l)
log "GPUs found: $GPU_COUNT"
nvidia-smi --query-gpu=name,memory.total,driver_version --format=csv,noheader

# ---------------------------------------------------------------------------
# 2. Install NVIDIA Container Toolkit (if missing)
# ---------------------------------------------------------------------------
if ! docker info 2>/dev/null | grep -q "Runtimes.*nvidia"; then
  log "NVIDIA Container Toolkit not detected — installing..."
  # Ubuntu / Debian
  if command -v apt-get &>/dev/null; then
    curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey \
      | sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg
    curl -s -L https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list \
      | sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' \
      | sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list
    sudo apt-get update -qq
    sudo apt-get install -y nvidia-container-toolkit
    sudo nvidia-ctk runtime configure --runtime=docker
    sudo systemctl restart docker
    log "NVIDIA Container Toolkit installed."
  else
    die "Unsupported OS. Install nvidia-container-toolkit manually: https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html"
  fi
else
  log "NVIDIA Container Toolkit already configured."
fi

# ---------------------------------------------------------------------------
# 3. Create .env from example (skip if already exists)
# ---------------------------------------------------------------------------
ENV_FILE="$DEPLOY_DIR/.env"
if [[ ! -f "$ENV_FILE" ]]; then
  cp "$DEPLOY_DIR/.env.example" "$ENV_FILE"
  log ".env created from .env.example — EDIT IT before starting the stack."
  log "  Required: VLLM_MODEL, LITELLM_MASTER_KEY"
  log "  Optional: HF_TOKEN (for gated models)"
else
  log ".env already exists — skipping copy."
fi

# ---------------------------------------------------------------------------
# 4. Pull images in advance (optional, saves time on first `up`)
# ---------------------------------------------------------------------------
if [[ "${PULL_IMAGES:-yes}" == "yes" ]]; then
  log "Pulling Docker images (this may take a while)..."
  docker compose -f "$DEPLOY_DIR/docker-compose.yml" --env-file "$ENV_FILE" pull
fi

log ""
log "Setup complete. Next steps:"
log "  1. Edit $ENV_FILE"
log "  2. cd $DEPLOY_DIR && ./scripts/start.sh"
