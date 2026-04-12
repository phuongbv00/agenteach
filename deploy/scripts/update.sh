#!/usr/bin/env bash
# =============================================================================
# update.sh — Pull latest images and restart the stack with zero manual steps
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$DEPLOY_DIR/.env"

[[ -f "$ENV_FILE" ]] || { echo "ERROR: $ENV_FILE not found."; exit 1; }

echo "[update] Pulling latest images..."
docker compose \
  -f "$DEPLOY_DIR/docker-compose.yml" \
  --env-file "$ENV_FILE" \
  pull

echo "[update] Restarting stack with new images..."
docker compose \
  -f "$DEPLOY_DIR/docker-compose.yml" \
  --env-file "$ENV_FILE" \
  up -d --remove-orphans

echo "[update] Done. Run ./scripts/status.sh to verify."
