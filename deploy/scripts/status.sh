#!/usr/bin/env bash
# =============================================================================
# status.sh — Show container status and quick health checks
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$DEPLOY_DIR/.env"

source "$ENV_FILE" 2>/dev/null || true

VLLM_PORT="${VLLM_PORT:-8000}"
LITELLM_PORT="${LITELLM_PORT:-4000}"

echo "=== Container Status ==="
docker compose \
  -f "$DEPLOY_DIR/docker-compose.yml" \
  --env-file "$ENV_FILE" \
  ps

echo ""
echo "=== GPU Utilization ==="
nvidia-smi --query-gpu=name,utilization.gpu,memory.used,memory.total,temperature.gpu \
  --format=csv,noheader,nounits \
  | awk -F',' '{printf "  %-30s GPU: %s%%  VRAM: %s/%s MiB  Temp: %s°C\n", $1, $2, $3, $4, $5}'

echo ""
echo "=== Health Checks ==="

check_health() {
  local name="$1"
  local url="$2"
  if curl -sf --max-time 5 "$url" &>/dev/null; then
    echo "  [OK]   $name  ($url)"
  else
    echo "  [FAIL] $name  ($url)"
  fi
}

check_health "vLLM"    "http://localhost:${VLLM_PORT}/health"
check_health "LiteLLM" "http://localhost:${LITELLM_PORT}/health/liveliness"

echo ""
echo "=== LiteLLM Models ==="
curl -sf --max-time 5 \
  -H "Authorization: Bearer ${LITELLM_MASTER_KEY:-}" \
  "http://localhost:${LITELLM_PORT}/v1/models" \
  | python3 -c "
import sys, json
data = json.load(sys.stdin)
for m in data.get('data', []):
    print('  -', m['id'])
" 2>/dev/null || echo "  (could not reach LiteLLM)"
