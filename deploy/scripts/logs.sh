#!/usr/bin/env bash
# =============================================================================
# logs.sh — Tail logs for vLLM and/or LiteLLM
# Usage: ./logs.sh [vllm|litellm]   (default: both)
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$DEPLOY_DIR/.env"

SERVICE="${1:-}"   # optional: vllm | litellm

if [[ -n "$SERVICE" ]]; then
  docker compose \
    -f "$DEPLOY_DIR/docker-compose.yml" \
    --env-file "$ENV_FILE" \
    logs -f --tail=100 "$SERVICE"
else
  docker compose \
    -f "$DEPLOY_DIR/docker-compose.yml" \
    --env-file "$ENV_FILE" \
    logs -f --tail=50
fi
