# Implementation Plan — Teacher Assistant Agent MVP

**Mục tiêu tuần 1:** App chạy được, agent tự tìm tài liệu trong workspace (như Claude Code), chat tiếng Việt với Gemma 4, có memory cá nhân hoá và plugin system.

---

## Scope MVP (Tuần 1)

| Tính năng                                 | Trong MVP | Ghi chú                         |
| ----------------------------------------- | --------- | ------------------------------- |
| Chat streaming với Ollama                 | ✅        | Core                            |
| Workspace management                      | ✅        | Agent sandbox trong workspace   |
| Agent tự explore/đọc file trong workspace | ✅        | Dùng tools, không pre-index     |
| HITL approve cho read/write               | ✅        | 3 mức: once / session / always  |
| Memory (cá nhân hoá)                      | ✅        | Bắt buộc                        |
| Plugin system cơ bản                      | ✅        | Load skill từ file `.md`        |
| RAG / embedding / vector DB               | ❌        | Không cần — agent đọc trực tiếp |
| Export DOCX                               | ❌        | Phase 2                         |
| PDF parsing                               | ❌        | Phase 2                         |

**Model:** `gemma4:26b` (Gemma 4 26B A4B — 4B active params, chạy hiệu quả trên RAM thấp)

> **Tại sao không dùng embedding/RAG?**
> Claude Code không pre-index file — agent dùng `list_directory`, `search_files` (grep), `read_file` để tự tìm context cần thiết. Cách này đơn giản hơn, không cần LanceDB hay embedding model riêng, và linh hoạt hơn vì agent quyết định đọc gì dựa theo task thực tế.

---

## Các khái niệm cốt lõi

### Workspace

Một thư mục trên máy giáo viên được đăng ký làm "không gian làm việc". Agent mặc định **chỉ được phép hoạt động trong workspace đang active** — không đọc/ghi ra ngoài trừ khi người dùng chỉ định rõ ràng.

- Có thể có nhiều workspace (VD: "Toán lớp 10", "Vật lý lớp 11")
- Khi nhận task, agent tự `list_directory` → `search_files` → `read_file` để tìm tài liệu liên quan
- Path validation cứng: bất kỳ path nào ra ngoài `workspace.path` → tự động từ chối

### HITL (Human-in-the-Loop)

Mỗi khi agent muốn **đọc** hoặc **ghi** file, hỏi người dùng trước. Người dùng chọn 1 trong 3:

| Lựa chọn                | Ý nghĩa                               |
| ----------------------- | ------------------------------------- |
| **Cho phép lần này**    | Thực hiện, lần sau hỏi lại            |
| **Cho phép cả session** | Không hỏi lại cho đến khi đóng app    |
| **Luôn cho phép**       | Lưu vào config, không hỏi lại mãi mãi |

Áp dụng riêng cho từng loại thao tác (`read`, `write`) và per-workspace.

### Memory

Agent ghi nhớ thông tin về giáo viên và sở thích qua các session.
Lưu tại `<userData>/memory/<workspaceId>/memory.json`.

Các loại memory:

- **user** — tên, môn, lớp, sở thích cá nhân
- **style** — phong cách viết, cấu trúc giáo án ưa thích
- **feedback** — những điều agent nên/không nên làm
- **context** — project đang làm, deadline, lưu ý hiện tại

Inject vào system prompt mỗi đầu session. Agent có tool `update_memory()` để tự cập nhật.

### Plugin System

Plugin là file `.md` trong `<userData>/plugins/` hoặc `<workspace>/.plugins/`.

```markdown
---
name: giao-an
description: Soạn giáo án theo chuẩn Bộ GD&ĐT
triggers: ["/giao-an", "soạn giáo án", "lập kế hoạch dạy học"]
---

{nội dung prompt/hướng dẫn cho agent khi plugin được kích hoạt}
```

Kích hoạt bằng `/tên-plugin` hoặc auto-match keyword. Prompt plugin được inject vào system prompt cho turn đó.

---

## Tech stack cần cài thêm

```bash
# Renderer
npm install react react-dom
npm install -D @types/react @types/react-dom @vitejs/plugin-react
npm install -D tailwindcss postcss autoprefixer
npx shadcn@latest init          # shadcn/ui — components copy vào src/renderer/components/ui/
npm install zustand react-markdown remark-gfm

# Main process
npm install ai ollama-ai-provider   # Vercel AI SDK + Ollama provider
npm install mammoth
npm install -D @types/mammoth
```

> LanceDB, apache-arrow, nomic-embed-text **không cần** nữa.

### Tại sao shadcn/ui?

Components (Dialog, Button, Badge, ScrollArea, Sidebar...) copy thẳng vào project, không phải dependency — dễ tuỳ chỉnh, không bị breaking change từ upstream. Dùng Radix UI primitives (accessible) + Tailwind.

### Tại sao Vercel AI SDK?

Thay vì tự viết tool-calling loop trong `Orchestrator.ts`, dùng `generateText` với `maxSteps` — SDK tự xử lý vòng lặp tool call → result → next call:

```typescript
import { generateText, tool } from "ai";
import { createOllama } from "ollama-ai-provider";

const ollama = createOllama();

const { text } = await generateText({
  model: ollama("gemma4:26b"),
  system: systemPrompt,
  messages,
  tools: { list_directory, read_file, write_file, search_files, update_memory },
  maxSteps: 20, // tối đa 20 tool calls liên tiếp
  abortSignal: signal,
  onStepFinish: ({ toolCalls }) => {
    // stream status "đang đọc file X..." về renderer
  },
});
```

SDK xử lý: parse tool call từ model → execute → feed result lại → loop. `Orchestrator.ts` còn ~50 dòng thay vì ~200.

---

## Cấu trúc thư mục

```
src/
  main.ts                          # IPC setup, app lifecycle, Ollama auto-start
  preload.ts                       # contextBridge → window.api
  main/
    llm/
      OllamaClient.ts              # checkHealth, chat (stream)
    agent/
      Orchestrator.ts              # Tool-calling loop (dùng Vercel AI SDK generateText)
      tools/
        FileTools.ts               # list_directory, read_file, write_file, search_files
        DateTool.ts                # get_current_date
        MemoryTool.ts              # update_memory
      FileCache.ts                 # mtime-based cache cho parsed file content
      PermissionManager.ts         # HITL logic: check, grant, persist
      SystemPromptBuilder.ts       # Ghép memory + workspace + plugin + tools
    workspace/
      WorkspaceManager.ts          # CRUD workspaces, active workspace
    memory/
      MemoryStore.ts               # Đọc/ghi memory.json per-workspace
    plugins/
      PluginLoader.ts              # Load .md plugins
      PluginMatcher.ts             # Match trigger với user message
    ipc/
      handlers.ts                  # Đăng ký tất cả ipcMain.handle()
    config/
      AppConfig.ts                 # userData/config.json
  renderer/
    renderer.ts                    # Mount React
    App.tsx                        # Setup ↔ Main routing
    components/
      SetupWizard.tsx              # Ollama check, model, tên giáo viên
      ChatPanel.tsx                # Messages + input
      MessageBubble.tsx            # Markdown, stream tokens, tool status
      HitlApprovalDialog.tsx       # Dialog approve read/write
      WorkspaceSidebar.tsx         # Danh sách workspace, chuyển/tạo mới
      MemoryPanel.tsx              # Xem/sửa memory
      PluginChip.tsx               # Plugin đang active, gợi ý
    stores/
      chatStore.ts                 # messages, isStreaming
      appStore.ts                  # config, ollamaStatus, activeWorkspace
      permissionStore.ts           # session-level permissions
```

---

## Chi tiết module quan trọng

### `src/main/agent/FileCache.ts`

Cache parsed file content theo `mtime` — in-memory, session-scoped (tự clear khi app restart).

```typescript
interface CacheEntry {
  mtime: number    // fs.stat().mtimeMs tại thời điểm parse
  content: string  // plain text đã parse
}

// Map<filePath, CacheEntry>
async get(filePath: string): Promise<string | null>
  // fs.stat() → so sánh mtime → trả content nếu khớp, null nếu stale/miss

set(filePath: string, mtime: number, content: string): void

invalidate(filePath: string): void   // gọi sau write_file
```

`read_file` trong FileTools luôn đi qua cache:

```
FileCache.get(path)
  → hit:  trả ngay, không parse lại
  → miss: parse (mammoth / fs.readFile) → FileCache.set() → trả content
```

Sau `write_file` → `FileCache.invalidate(path)` để lần đọc tiếp theo lấy nội dung mới.

---

### `src/main/agent/tools/FileTools.ts`

```typescript
// Tools agent có thể gọi — giống Claude Code
list_directory(path: string, recursive?: boolean): string[]
  // Liệt kê file/folder trong path
  // Validation: path phải nằm trong workspace.path

read_file(path: string): string
  // .docx → dùng mammoth để extract text
  // .txt, .md → đọc thẳng UTF-8
  // Validation: path trong workspace + HITL check

write_file(path: string, content: string): void
  // Validation: path trong workspace + HITL check

search_files(query: string, fileGlob?: string): SearchResult[]
  // Grep-like: tìm query trong tất cả file text của workspace
  // Trả về: [{ filePath, lineNumber, lineContent }]
  // Dùng Node.js fs + regex, không cần ripgrep
```

Tất cả tools đều nhận `workspacePath` từ context, validate trước khi thực hiện.

---

### `src/main/agent/PermissionManager.ts`

```typescript
type Action = 'read' | 'write'
type Scope = 'once' | 'session' | 'always'

checkPermission(action: Action, filePath: string): 'granted' | 'denied' | 'pending'
grantPermission(action: Action, filePath: string, scope: Scope): void
```

Flow trong `FileTools.ts`:

```
agent gọi read_file(path)
  → path validation (trong workspace?) → nếu không: throw "access denied"
  → PermissionManager.checkPermission('read', path)
  → 'pending': await IPC 'hitl:requestApproval' (renderer hiển thị dialog)
  → user chọn scope → IPC 'hitl:grantApproval'
  → PermissionManager.grantPermission(...)
  → đọc file, trả kết quả cho agent
```

`'always'` permissions được persist vào `AppConfig` (per action, per workspace).

---

### `src/main/agent/SystemPromptBuilder.ts`

```
[IDENTITY]
Bạn là trợ lý AI hỗ trợ giáo viên soạn tài liệu giảng dạy.
Luôn trả lời bằng tiếng Việt, lịch sự và chuyên nghiệp.

[MEMORY]
Giáo viên: {memory.user.name}, Môn: {memory.user.subject}, Lớp: {memory.user.grades}
Phong cách: {memory.style}
Lưu ý: {memory.feedback}
Hiện tại: {memory.context}

[WORKSPACE]
Workspace: "{workspace.name}" tại {workspace.path}
Bạn CHỈ được phép đọc/ghi file trong workspace này.
Dùng list_directory để khám phá, search_files để tìm kiếm, read_file để đọc nội dung.

[ACTIVE PLUGIN]
{plugin.prompt nếu có}

[TOOLS]
{tools manifest — list_directory, read_file, write_file, search_files, get_date, update_memory}
```

---

### `src/main/workspace/WorkspaceManager.ts`

```typescript
interface Workspace {
  id: string
  name: string
  path: string
  createdAt: number
  lastOpenedAt: number
}

createWorkspace(name: string, folderPath: string): Promise<Workspace>
listWorkspaces(): Promise<Workspace[]>
setActiveWorkspace(id: string): Promise<void>
getActiveWorkspace(): Workspace | null
deleteWorkspace(id: string): Promise<void>   // chỉ xoá record, không xoá folder
```

---

### `src/main/memory/MemoryStore.ts`

```typescript
interface Memory {
  user: { name: string; subject: string; grades: string[] }
  style: Record<string, string>
  feedback: string[]
  context: string[]
  updatedAt: number
}

load(workspaceId: string): Promise<Memory>
update(workspaceId: string, patch: DeepPartial<Memory>): Promise<void>
```

Lưu tại `<userData>/memory/<workspaceId>/memory.json`.

---

### IPC Channels

| Channel                | Direction     | Mô tả                    |
| ---------------------- | ------------- | ------------------------ |
| `system:checkOllama`   | invoke        | Health check             |
| `system:listModels`    | invoke        | Models có sẵn            |
| `system:selectModel`   | invoke        | Lưu model vào config     |
| `agent:sendMessage`    | invoke        | Gửi message, nhận stream |
| `agent:cancel`         | invoke        | Hủy request              |
| `agent:token`          | main→renderer | Stream token             |
| `agent:status`         | main→renderer | "đang đọc file X..."     |
| `hitl:requestApproval` | main→renderer | Yêu cầu approve          |
| `hitl:grantApproval`   | invoke        | User approve với scope   |
| `workspace:create`     | invoke        | Tạo workspace mới        |
| `workspace:list`       | invoke        | Danh sách workspace      |
| `workspace:setActive`  | invoke        | Chuyển workspace         |
| `workspace:delete`     | invoke        | Xoá workspace            |
| `memory:get`           | invoke        | Lấy memory hiện tại      |
| `memory:update`        | invoke        | Cập nhật memory thủ công |
| `plugins:list`         | invoke        | Danh sách plugins        |

---

### `preload.ts`

```typescript
contextBridge.exposeInMainWorld("api", {
  checkOllama: () => ipcRenderer.invoke("system:checkOllama"),
  listModels: () => ipcRenderer.invoke("system:listModels"),
  selectModel: (model: string) =>
    ipcRenderer.invoke("system:selectModel", model),

  sendMessage: (messages) => ipcRenderer.invoke("agent:sendMessage", messages),
  cancelMessage: () => ipcRenderer.invoke("agent:cancel"),
  onToken: (cb) => ipcRenderer.on("agent:token", (_, token) => cb(token)),
  onStatus: (cb) => ipcRenderer.on("agent:status", (_, status) => cb(status)),
  offToken: (cb) => ipcRenderer.removeListener("agent:token", cb),

  onApprovalRequest: (cb) =>
    ipcRenderer.on("hitl:requestApproval", (_, req) => cb(req)),
  grantApproval: (req, scope) =>
    ipcRenderer.invoke("hitl:grantApproval", req, scope),

  createWorkspace: (name, path) =>
    ipcRenderer.invoke("workspace:create", name, path),
  listWorkspaces: () => ipcRenderer.invoke("workspace:list"),
  setActiveWorkspace: (id) => ipcRenderer.invoke("workspace:setActive", id),
  deleteWorkspace: (id) => ipcRenderer.invoke("workspace:delete", id),

  getMemory: () => ipcRenderer.invoke("memory:get"),
  updateMemory: (patch) => ipcRenderer.invoke("memory:update", patch),

  listPlugins: () => ipcRenderer.invoke("plugins:list"),
});
```

---

### `forge.config.ts` (cần sửa)

Thay `asar: true` thành:

```typescript
asar: {
  unpack: "**/*.node";
}
```

### `vite.renderer.config.ts` (cần sửa)

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  css: {
    postcss: { plugins: [require("tailwindcss"), require("autoprefixer")] },
  },
});
```

---

## Thứ tự implement

1. **Renderer setup** — React, Tailwind, mount `App.tsx`
2. **OllamaClient** — `checkHealth`, `listModels`, streaming `chat`
3. **AppConfig + WorkspaceManager** — CRUD workspace, persist
4. **PermissionManager** — check/grant, session + persist
5. **MemoryStore + MemoryTool** — đọc/ghi memory.json
6. **PluginLoader + PluginMatcher** — load + match từ file `.md`
7. **FileTools** — `list_directory`, `read_file` (mammoth cho .docx), `write_file`, `search_files` — tất cả có HITL + path validation
8. **SystemPromptBuilder** — ghép memory + workspace + plugin + tools manifest
9. **Orchestrator** — tool-calling loop, stream status, AbortController
10. **IPC handlers** — wire tất cả
11. **preload.ts** — expose `window.api`
12. **SetupWizard UI** — Ollama check, chọn model, nhập tên/môn
13. **WorkspaceSidebar UI** — tạo/chọn workspace, folder picker
14. **ChatPanel + MessageBubble** — stream tokens, inline tool status
15. **HitlApprovalDialog UI** — dialog 3 lựa chọn, block agent cho đến khi user trả lời
16. **MemoryPanel + PluginChip UI** — xem memory, plugin active

---

## Definition of Done (MVP)

- [ ] App khởi động, SetupWizard nếu chưa cấu hình
- [ ] Tạo workspace mới bằng cách chọn thư mục từ folder picker
- [ ] Agent dùng `list_directory` + `search_files` + `read_file` để tự tìm tài liệu liên quan
- [ ] Đọc/ghi file → HITL dialog với 3 scope; `always` được persist qua session
- [ ] File ngoài workspace path → tự động từ chối, agent nhận thông báo lỗi
- [ ] Memory inject vào system prompt; agent tự gọi `update_memory` sau conversation
- [ ] Plugin `.md` được load, kích hoạt bằng `/tên-plugin` hoặc auto-match
- [ ] Chat streaming với Gemma 4 26B, hiển thị status "đang đọc file X..."
- [ ] Hủy request đang chạy được (AbortController)
- [ ] `npm start` không có lỗi TypeScript
