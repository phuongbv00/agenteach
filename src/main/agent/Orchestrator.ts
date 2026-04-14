import { ToolLoopAgent, isLoopFinished } from "ai";
import { BrowserWindow } from "electron";
import { createModel } from "../llm/LLMClient";
import { appConfig } from "../config/AppConfig";
import { WorkspaceManager } from "../workspace/WorkspaceManager";
import { MemoryStore } from "../memory/MemoryStore";
import { buildSystemPrompt } from "./SystemPromptBuilder";
import { createFileTools } from "./tools/FileTools";
import { createMemoryTools } from "./tools/MemoryTools";
import { createPluginTools } from "./tools/PluginTools";
import { getWorkspaceIndex } from "./WorkspaceIndex";
import createTimeTools from "./tools/TimeTools";
import type { ToolsMetaMap } from "./tools/meta";
import { defaultSummarize } from "./tools/meta";

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
  const workspace = workspaceId
    ? await WorkspaceManager.get(workspaceId)
    : null;

  if (!workspace) {
    win.webContents.send(
      "agent:token",
      "Vui lòng chọn workspace trước khi chat.",
    );
    win.webContents.send("agent:done");
    return;
  }

  const memory = MemoryStore.load();
  const systemPrompt = buildSystemPrompt(memory, workspace);
  console.log("System Prompt:", systemPrompt);

  const index = getWorkspaceIndex(workspace.id, workspace.path);

  const { tools: timeTools, meta: timeMeta } = createTimeTools();
  const { tools: fileTools, meta: fileMeta } = createFileTools(
    workspace,
    win,
    index,
    sessionId,
  );
  const { tools: memoryTools, meta: memoryMeta } = createMemoryTools(win);
  const { tools: pluginTools, meta: pluginMeta } = createPluginTools();

  const allMeta: ToolsMetaMap = {
    ...fileMeta,
    ...memoryMeta,
    ...pluginMeta,
    ...timeMeta,
  };

  const agent = new ToolLoopAgent({
    model: createModel(model ?? config.selectedModel),
    instructions: systemPrompt,
    tools: { ...fileTools, ...memoryTools, ...pluginTools, ...timeTools },
    stopWhen: isLoopFinished(),
  });

  try {
    const result = await agent.stream({
      messages,
      abortSignal: signal,
    });

    let prevChunkType: string | null = null;
    await streamToUI(result.fullStream, win, signal, allMeta, (c) => {
      const type = c.type as string;
      if (type === prevChunkType) return;
      if (["text-delta", "reasoning-delta"].includes(type))
        console.log(`[chunk] ${type} ...`);
      else console.log(`[chunk] ${type}`, c);
      prevChunkType = type;
    });
  } catch (err) {
    if (!signal.aborted) {
      win.webContents.send("agent:token", `\n\nLỗi: ${String(err)}`);
    }
  } finally {
    win.webContents.send("agent:done");
    currentAbortController = null;
  }
}

export function cancelAgent(): void {
  currentAbortController?.abort();
}

async function streamToUI(
  fullStream: AsyncIterable<unknown>,
  win: BrowserWindow,
  signal: AbortSignal,
  meta: ToolsMetaMap,
  onChunk?: (c: Record<string, unknown>) => void,
): Promise<void> {
  const pendingToolCalls = new Map<
    string,
    { toolName: string; label: string; args: Record<string, unknown> }
  >();

  const getLabel = (toolName: string, args: Record<string, unknown>) =>
    meta[toolName]?.label(args) ?? toolName;

  const getSummary = (toolName: string, result: string) => {
    if (!result || result === '""') return "";
    return meta[toolName]?.summarize?.(result) ?? defaultSummarize(result);
  };

  for await (const chunk of fullStream) {
    if (signal.aborted) break;
    const c = chunk as unknown as Record<string, unknown>;
    onChunk?.(c);

    switch ((chunk as { type: string }).type) {
      case "text-delta": {
        win.webContents.send("agent:token", c.text as string);
        break;
      }
      case "reasoning-delta": {
        win.webContents.send("agent:reasoning", c.text as string);
        break;
      }
      case "tool-input-start": {
        const toolName = c.toolName as string;
        const label = (c.title as string | undefined) ?? getLabel(toolName, {});
        const pending = { toolName, label, args: {} };
        pendingToolCalls.set(c.id as string, pending);
        win.webContents.send("agent:toolCallStart", pending);
        break;
      }
      case "tool-call": {
        const id = c.toolCallId as string;
        const inputArgs = (c.input ?? {}) as Record<string, unknown>;
        const existing = pendingToolCalls.get(id);
        if (existing) {
          existing.args = inputArgs;
          existing.label = getLabel(existing.toolName, inputArgs);
        } else {
          const toolName = c.toolName as string;
          pendingToolCalls.set(id, {
            toolName,
            label: getLabel(toolName, inputArgs),
            args: inputArgs,
          });
          win.webContents.send("agent:toolCallStart", pendingToolCalls.get(id));
        }
        break;
      }
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
          label: pending?.label ?? getLabel(c.toolName as string, {}),
          args: pending?.args ?? {},
          result: getSummary(c.toolName as string, resultStr),
        };
        win.webContents.send("agent:toolCall", event);
        break;
      }
      case "error": {
        win.webContents.send("agent:token", `\n\nLỗi: ${String(c.error)}`);
        break;
      }
      case "start":
      case "start-step":
      case "finish-step":
      case "finish":
      case "reasoning-start":
      case "reasoning-end":
      case "text-start":
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
}
