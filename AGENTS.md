# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Commands

```bash
npm start          # Run the app in development mode (Electron + Vite HMR)
npm run lint       # Run ESLint on .ts and .tsx files
npm run typecheck  # Run TypeScript compiler check (no emit)
npm run package    # Package the app for distribution
npm run make       # Create installer for the current platform
npm run make:mac   # Create macOS DMG
npm run make:win   # Create Windows Squirrel installer
```

There are no automated tests — rely on `npm run typecheck` and `npm run lint` for correctness checking.

## Architecture

**Agenteach** is an Electron desktop app for Vietnamese teachers: an AI assistant that helps create teaching materials, backed by OpenAI-compatible APIs or local Ollama.

### Process Split

The app follows standard Electron architecture with strict process separation:

- **Main process** (`src/main/`) — Node.js, full OS access, runs the AI agent
- **Renderer process** (`src/renderer/`) — React UI, no direct Node access
- **Preload bridge** (`src/preload.ts`) — Secure IPC API surface exposed to renderer as `window.api`

All AI agent logic, file I/O, and LLM calls happen in the main process. The renderer communicates exclusively through typed IPC handlers defined in `src/main/ipc/handlers.ts`.

### Agent Core (`src/main/agent/`)

The key architectural component. When a user sends a message:

1. `handlers.ts` calls `runAgent()` from `Orchestrator.ts`
2. `Orchestrator` builds a system prompt via `SystemPromptBuilder` (includes memory + workspace context + loaded plugins)
3. Streams LLM output using the Vercel `ai` SDK (`streamText`)
4. Handles tool calls in a loop, emitting IPC events back to renderer: `agent:token`, `agent:toolCall`, `agent:reasoning`, `agent:done`, `agent:error`

**Tools available to the agent:**
- `FileTools` — list, read, write, search files within the workspace
- `ExportTools` — generate Markdown, PDF, DOCX artifacts
- `MemoryTool` — read/write memory layers
- `DateTool` — get current date

### Data Layers (`src/main/`)

| Module | Purpose |
|---|---|
| `config/AppConfig.ts` | User settings persistence (API key, model, language) |
| `workspace/WorkspaceManager.ts` | Multi-workspace CRUD, each workspace is a directory |
| `sessions/SessionStore.ts` | Chat session and message history (JSON files) |
| `sessions/ArtifactStore.ts` | Tracks generated documents per session |
| `memory/MemoryStore.ts` | Two-tier memory: global (teacher profile) + workspace-specific |
| `llm/LLMClient.ts` | OpenAI-compatible LLM abstraction (supports Ollama + remote APIs) |
| `plugins/PluginLoader.ts` | Loads `.md` files with YAML frontmatter from `.plugins/` dirs |

### Renderer (`src/renderer/`)

React 19 + Zustand. Two stores:
- `stores/appStore.ts` — workspaces, current workspace/session, settings, UI state
- `stores/chatStore.ts` — messages, streaming state, tool call display

The `App.tsx` root has three view states: `loading` → `setup` (SetupWizard) → `main`.

### Key Concepts

- **Workspaces**: User-selected directories containing teaching materials. The agent can read/write files within these.
- **Sessions**: Chat conversations scoped to a workspace, stored as JSON.
- **Memory layers**: Persisted context—global memory for teacher profile, workspace memory for class-specific info.
- **Plugins**: Markdown files with YAML frontmatter in `.plugins/` subdirectories of a workspace. Loaded into the system prompt.
- **HITL (Human-in-the-Loop)**: File write operations can require user approval via `HitlApprovalDialog`.
- **Artifacts**: AI-generated documents (MD/PDF/DOCX) tracked per session and previewable in `PreviewPanel`.

## Code Style

Prettier config (enforced, no semicolons, double quotes, 2-space indent, trailing commas):
```json
{ "semi": false, "singleQuote": false, "tabWidth": 2, "trailingComma": "es5", "printWidth": 80 }
```

Path alias `@/*` maps to `./src/*`. Use this for all cross-directory imports.

UI components use shadcn/ui (Radix + Tailwind CSS v4). New components go in `src/renderer/components/ui/`.
