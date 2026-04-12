#!/usr/bin/env bash
# =============================================================================
# stop.sh — Stop the stack (containers are removed, volumes are kept)
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$DEPLOY_DIR/.env"

echo "[stop] Stopping the stack..."
docker compose \
  -f "$DEPLOY_DIR/docker-compose.yml" \
  --env-file "$ENV_FILE" \
  down

echo "[stop] Done."
