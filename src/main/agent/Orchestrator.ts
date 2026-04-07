import { streamText, stepCountIs } from "ai";
import { BrowserWindow } from "electron";
import { createModel } from "../llm/LLMClient";
import { appConfig } from "../config/AppConfig";
import { WorkspaceManager } from "../workspace/WorkspaceManager";
import { MemoryStore } from "../memory/MemoryStore";
import { PluginLoader } from "../plugins/PluginLoader";
import { buildSystemPrompt } from "./SystemPromptBuilder";
import { createFileTools } from "./tools/FileTools";
import { createExportTools } from "./tools/ExportTools";
import { date_tool } from "./tools/DateTool";
import { createMemoryTool } from "./tools/MemoryTool";
import { getWorkspaceIndex } from "./WorkspaceIndex";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ToolCallEvent {
  toolName: string;
  label: string;
  args: Record<string, unknown>;
  result: string;
}

let currentAbortController: AbortController | null = null;

export async function runAgent(
  messages: ChatMessage[],
  win: BrowserWindow,
  sessionId?: string,
  model?: string,
): Promise<void> {
  currentAbortController = new AbortController();
  const signal = currentAbortController.signal;

  const config = appConfig.get();
  const workspaceId = config.activeWorkspaceId;
  const workspace = workspaceId ? WorkspaceManager.get(workspaceId) : null;

  if (!workspace) {
    win.webContents.send(
      "agent:token",
      "Vui lòng chọn workspace trước khi chat.",
    );
    win.webContents.send("agent:done");
    return;
  }

  const memory = MemoryStore.loadAll(workspace.id);
  const allPlugins = PluginLoader.load(workspace.path);
  const lastUserMessage =
    messages.filter((m) => m.role === "user").at(-1)?.content ?? "";
  const activePlugin = PluginLoader.match(allPlugins, lastUserMessage);
  const systemPrompt = buildSystemPrompt(memory, workspace, activePlugin);

  const index = getWorkspaceIndex(workspace.id, workspace.path);
  const fileTools = createFileTools(workspace, win, index);
  const exportTools = createExportTools(workspace, win, index, sessionId);
  const memoryTool = createMemoryTool(workspace.id);

  const chunkRun = { type: "", count: 0 };
  const flushChunkRun = () => {
    if (!chunkRun.type) return;
    console.log(`[chunk] ${chunkRun.type}${chunkRun.count > 1 ? ` x${chunkRun.count}` : ""}`);
    chunkRun.type = "";
    chunkRun.count = 0;
  };

  try {
    const result = streamText({
      model: createModel(model ?? config.selectedModel),
      system: systemPrompt,
      messages,
      tools: {
        list_directory: fileTools.list_directory,
        find_files: fileTools.find_files,
        read_file: fileTools.read_file,
        write_file: fileTools.write_file,
        search_in_files: fileTools.search_in_files,
        create_markdown: exportTools.create_markdown,
        create_pdf: exportTools.create_pdf,
        create_docx: exportTools.create_docx,
        get_date: date_tool,
        update_memory: memoryTool,
      },
      stopWhen: stepCountIs(50),
      abortSignal: signal,
    });

    const pendingToolCalls = new Map<
      string,
      { toolName: string; label: string; args: Record<string, unknown> }
    >();

    const logChunk = (c: Record<string, unknown>) => {
      const type = c.type as string;
      if (type === chunkRun.type) {
        chunkRun.count++;
      } else {
        flushChunkRun();
        chunkRun.type = type;
        chunkRun.count = 1;
      }
    };

    for await (const chunk of result.fullStream) {
      if (signal.aborted) break;
      const c = chunk as unknown as Record<string, unknown>;
      logChunk(c);
      switch (chunk.type) {
        // ── Text ──────────────────────────────────────────────────────────────
        case "text-delta": {
          win.webContents.send("agent:token", c.text as string);
          break;
        }
        // ── Reasoning ─────────────────────────────────────────────────────────
        case "reasoning-delta": {
          win.webContents.send("agent:reasoning", c.text as string);
          break;
        }
        // ── Tool input streaming → send start indicator immediately ───────────
        case "tool-input-start": {
          const toolName = c.toolName as string;
          const label = (c.title as string | undefined) ?? toolLabel(toolName, {});
          const pending = { toolName, label, args: {} };
          pendingToolCalls.set(c.id as string, pending);
          win.webContents.send("agent:toolCallStart", pending);
          break;
        }
        // ── Tool call complete → update pending with full args ────────────────
        case "tool-call": {
          const id = c.toolCallId as string;
          const input = (c.input ?? {}) as Record<string, unknown>;
          const existing = pendingToolCalls.get(id);
          if (existing) {
            existing.args = input;
            existing.label = toolLabel(existing.toolName, input);
          } else {
            // fallback: provider didn't emit tool-input-start
            const toolName = c.toolName as string;
            pendingToolCalls.set(id, {
              toolName,
              label: toolLabel(toolName, input),
              args: input,
            });
            win.webContents.send("agent:toolCallStart", pendingToolCalls.get(id));
          }
          break;
        }
        // ── Tool result → emit final event ────────────────────────────────────
        case "tool-result": {
          const id = c.toolCallId as string;
          const pending = pendingToolCalls.get(id);
          pendingToolCalls.delete(id);
          const rawOutput = c.output;
          const resultStr =
            typeof rawOutput === "string"
              ? rawOutput
              : JSON.stringify(rawOutput ?? "");
          const event: ToolCallEvent = {
            toolName: c.toolName as string,
            label: pending?.label ?? toolLabel(c.toolName as string, {}),
            args: pending?.args ?? {},
            result: summarizeResult(c.toolName as string, resultStr),
          };
          win.webContents.send("agent:toolCall", event);
          break;
        }
        // ── Error ─────────────────────────────────────────────────────────────
        case "error": {
          win.webContents.send("agent:token", `\n\nLỗi: ${String(c.error)}`);
          break;
        }
        // ── Lifecycle / streaming bookkeeping (no-op) ─────────────────────────
        case "start":
        case "start-step":
        case "finish-step":
        case "finish":
        case "reasoning-start":
        case "reasoning-end":
          break;
        // ── Text start → notify UI that text generation is beginning ──────────
        case "text-start": {
          win.webContents.send("agent:textStart");
          break;
        }
        case "text-end":
        case "tool-input-delta":
        case "tool-input-end":
          break;
        default: {
          console.warn("Unknown chunk type:", chunk);
          break;
        }
      }
    }
  } catch (err) {
    if (!signal.aborted) {
      win.webContents.send("agent:token", `\n\nLỗi: ${String(err)}`);
    }
  } finally {
    flushChunkRun();
    win.webContents.send("agent:done");
    currentAbortController = null;
  }
}

export function cancelAgent(): void {
  currentAbortController?.abort();
}

function toolLabel(toolName: string, args: Record<string, unknown>): string {
  switch (toolName) {
    case "list_directory":
      return `Xem thư mục: ${args.dir_path ?? "."}`;
    case "find_files":
      return `Tìm file: "${args.query ?? ""}"`;
    case "read_file":
      return `Đọc file: ${args.file_path ?? ""}`;
    case "write_file":
      return `Ghi file: ${args.file_path ?? ""}`;
    case "search_in_files":
      return `Tìm kiếm: "${args.query ?? ""}"`;
    case "create_markdown":
      return `Tạo file Markdown: ${args.file_path ?? ""}`;
    case "create_pdf":
      return `Tạo file PDF: ${args.file_path ?? ""}`;
    case "create_docx":
      return `Tạo file Word: ${args.file_path ?? ""}`;
    case "update_memory":
      return `Ghi nhớ thông tin`;
    case "get_date":
      return `Lấy ngày hôm nay`;
    default:
      return toolName;
  }
}

function summarizeResult(toolName: string, result: string): string {
  if (!result || result === '""') return "";
  if (toolName === "list_directory") {
    const lines = result.split("\n").filter(Boolean);
    if (lines.length <= 5) return result;
    return `${lines.slice(0, 5).join("\n")}\n... (${lines.length} mục)`;
  }
  if (toolName === "read_file") {
    if (result.length <= 300) return result;
    return result.slice(0, 300) + `\n... (${result.length} ký tự)`;
  }
  if (["create_markdown", "create_pdf", "create_docx"].includes(toolName))
    return result;
  if (result.length > 200) return result.slice(0, 200) + "...";
  return result;
}
