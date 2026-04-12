# Agenteach — GPU Server Deployment

Deploys a self-hosted LLM backend with:

- **[vLLM](https://github.com/vllm-project/vllm)** — high-throughput inference engine (OpenAI-compatible API)
- **[LiteLLM Proxy](https://github.com/BerriAI/litellm)** — unified API gateway (key management, rate limiting, multi-model routing)

```
Agenteach app
     │
     ▼  OpenAI-compatible API  (port 4000)
┌─────────────┐
│   LiteLLM   │  ← API key auth, routing, rate limits
└──────┬──────┘
       │  (internal, port 8000)
┌──────▼──────┐
│    vLLM     │  ← GPU inference
└─────────────┘
```

---

## Prerequisites

| Requirement | Minimum version |
|---|---|
| Linux host (Ubuntu 22.04+ recommended) | — |
| NVIDIA GPU with ≥ 16 GB VRAM | — |
| NVIDIA driver | ≥ 525 |
| Docker Engine | ≥ 26 |
| Docker Compose plugin | ≥ 2.20 |
| NVIDIA Container Toolkit | any recent |

> **Multi-GPU**: increase `VLLM_TENSOR_PARALLEL` and `GPU_COUNT` in `.env`.

---

## Quick Start

```bash
# 1. Clone / copy the deploy/ directory to the GPU server
scp -r deploy/ user@gpu-server:~/agenteach-deploy

# 2. SSH into the server and run setup
cd ~/agenteach-deploy
./scripts/setup.sh          # installs NVIDIA Container Toolkit, creates .env

# 3. Edit configuration
nano .env                   # set VLLM_MODEL and LITELLM_MASTER_KEY at minimum

# 4. Start the stack
./scripts/start.sh

# 5. Verify
./scripts/status.sh
```

---

## Configuration

### `.env` — environment variables

Copy `.env.example` to `.env` (done automatically by `setup.sh`) and edit:

| Variable | Required | Description |
|---|---|---|
| `VLLM_MODEL` | **yes** | HuggingFace model ID, e.g. `Qwen/Qwen2.5-14B-Instruct` |
| `LITELLM_MASTER_KEY` | **yes** | API key Agenteach will use (e.g. `sk-my-key`) |
| `HF_TOKEN` | for gated models | HuggingFace access token |
| `VLLM_SERVED_NAME` | no | Alias advertised by vLLM (default: `default`) |
| `VLLM_MAX_MODEL_LEN` | no | Max context length in tokens (default: `8192`) |
| `VLLM_TENSOR_PARALLEL` | no | Number of GPUs for tensor parallelism (default: `1`) |
| `VLLM_GPU_MEM_UTIL` | no | GPU VRAM fraction for vLLM (default: `0.90`) |
| `VLLM_DTYPE` | no | `auto`, `float16`, or `bfloat16` (default: `auto`) |
| `LITELLM_PORT` | no | Host port for LiteLLM (default: `4000`) |
| `HF_CACHE_DIR` | no | Host path for HuggingFace model cache |

### `litellm-config.yaml` — model routing

Add or remove models under `model_list`. The `model_name` field is the alias
clients send in requests. Keep it in sync with `VLLM_SERVED_NAME`.

```yaml
model_list:
  - model_name: qwen2.5-14b           # what Agenteach sets as "Model ID"
    litellm_params:
      model: openai/qwen2.5-14b       # must match VLLM_SERVED_NAME
      api_base: http://vllm:8000/v1
      api_key: "none"
```

---

## Connecting Agenteach

In the Agenteach desktop app → **Settings**:

| Field | Value |
|---|---|
| API Base URL | `http://<server-ip>:4000/v1` |
| API Key | value of `LITELLM_MASTER_KEY` in your `.env` |
| Model ID | model alias from `litellm-config.yaml` (e.g. `qwen2.5-14b`) |

---

## Scripts

| Script | Description |
|---|---|
| `scripts/setup.sh` | One-time setup: installs NVIDIA toolkit, creates `.env` |
| `scripts/start.sh` | Start (or restart) the stack in detached mode |
| `scripts/stop.sh` | Stop and remove containers (volumes are kept) |
| `scripts/status.sh` | Container status + GPU utilization + health checks |
| `scripts/logs.sh [vllm\|litellm]` | Tail logs (both services by default) |
| `scripts/update.sh` | Pull latest images and restart |

---

## Common Model Recommendations

| Model | VRAM needed | `VLLM_MODEL` |
|---|---|---|
| Qwen2.5-7B-Instruct | ≥ 16 GB | `Qwen/Qwen2.5-7B-Instruct` |
| Qwen2.5-14B-Instruct | ≥ 24 GB | `Qwen/Qwen2.5-14B-Instruct` |
| Qwen2.5-32B-Instruct (4-bit AWQ) | ≥ 24 GB | `Qwen/Qwen2.5-32B-Instruct-AWQ` |
| Llama-3.1-8B-Instruct | ≥ 16 GB | `meta-llama/Llama-3.1-8B-Instruct`* |
| Llama-3.3-70B-Instruct (multi-GPU) | ≥ 80 GB | `meta-llama/Llama-3.3-70B-Instruct`* |

*Requires `HF_TOKEN` with access granted on HuggingFace.

---

## Optional: Monitoring

Start Prometheus + Grafana alongside the stack:

```bash
MONITORING=yes ./scripts/start.sh
```

| Service | URL |
|---|---|
| Grafana | `http://<server-ip>:3000` (admin / `GRAFANA_PASSWORD`) |
| Prometheus | `http://<server-ip>:9090` |

---

## Troubleshooting

**vLLM takes a long time to start**
The first run downloads the model (can be several GB). Check progress with:
```bash
./scripts/logs.sh vllm
```

**`CUDA out of memory`**
Reduce `VLLM_MAX_MODEL_LEN` or `VLLM_GPU_MEM_UTIL`, or use a quantized model.

**LiteLLM returns 401 Unauthorized**
Make sure the Agenteach API Key matches `LITELLM_MASTER_KEY` exactly.

**`nvidia: unknown runtime`**
Run `setup.sh` again — it will install the NVIDIA Container Toolkit and restart Docker.

**Port already in use**
Change `VLLM_PORT` or `LITELLM_PORT` in `.env` and update the Agenteach API Base URL accordingly.
