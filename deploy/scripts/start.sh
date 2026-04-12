#!/usr/bin/env bash
# =============================================================================
# start.sh — Start (or restart) the vLLM + LiteLLM stack
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$DEPLOY_DIR/.env"

[[ -f "$ENV_FILE" ]] || { echo "ERROR: $ENV_FILE not found. Run setup.sh first."; exit 1; }

PROFILE_ARGS=""
if [[ "${MONITORING:-no}" == "yes" ]]; then
  PROFILE_ARGS="--profile monitoring"
fi

echo "[start] Bringing up the stack..."
docker compose \
  -f "$DEPLOY_DIR/docker-compose.yml" \
  --env-file "$ENV_FILE" \
  $PROFILE_ARGS \
  up -d --remove-orphans

echo ""
echo "[start] Stack is starting. Check status with: ./scripts/status.sh"
echo "[start] Tail logs with:                       ./scripts/logs.sh"
