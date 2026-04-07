import { streamText, stepCountIs } from 'ai';
import { BrowserWindow } from 'electron';
import { createModel } from '../llm/LLMClient';
import { appConfig } from '../config/AppConfig';
import { WorkspaceManager } from '../workspace/WorkspaceManager';
import { MemoryStore } from '../memory/MemoryStore';
import { PluginLoader } from '../plugins/PluginLoader';
import { buildSystemPrompt } from './SystemPromptBuilder';
import { createFileTools } from './tools/FileTools';
import { createExportTools } from './tools/ExportTools';
import { date_tool } from './tools/DateTool';
import { createMemoryTool } from './tools/MemoryTool';
import { getWorkspaceIndex } from './WorkspaceIndex';

export interface ChatMessage {
  role: 'user' | 'assistant';
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
  sessionId?: string
): Promise<void> {
  currentAbortController = new AbortController();
  const signal = currentAbortController.signal;

  const config = appConfig.get();
  const workspaceId = config.activeWorkspaceId;
  const workspace = workspaceId ? WorkspaceManager.get(workspaceId) : null;

  if (!workspace) {
    win.webContents.send('agent:token', 'Vui lòng chọn workspace trước khi chat.');
    win.webContents.send('agent:done');
    return;
  }

  const memory = MemoryStore.loadAll(workspace.id);
  const allPlugins = PluginLoader.load(workspace.path);
  const lastUserMessage = messages.filter((m) => m.role === 'user').at(-1)?.content ?? '';
  const activePlugin = PluginLoader.match(allPlugins, lastUserMessage);
  const systemPrompt = buildSystemPrompt(memory, workspace, activePlugin);

  const index = getWorkspaceIndex(workspace.id, workspace.path);
  const fileTools = createFileTools(workspace, win, index);
  const exportTools = createExportTools(workspace, win, index, sessionId);
  const memoryTool = createMemoryTool(workspace.id);

  try {
    const result = streamText({
      model: createModel(config.selectedModel),
      system: systemPrompt,
      messages,
      tools: {
        list_directory: fileTools.list_directory,
        find_files: fileTools.find_files,
        read_file: fileTools.read_file,
        write_file: fileTools.write_file,
        search_files: fileTools.search_files,
        create_markdown: exportTools.create_markdown,
        create_pdf: exportTools.create_pdf,
        create_docx: exportTools.create_docx,
        get_date: date_tool,
        update_memory: memoryTool,
      },
      stopWhen: stepCountIs(20),
      abortSignal: signal,
      onStepFinish: ({ toolCalls, toolResults }) => {
        if (!toolCalls?.length) return;
        toolCalls.forEach((tc, i) => {
          const anyTc = tc as unknown as { input?: Record<string, unknown>; args?: Record<string, unknown> };
          const input: Record<string, unknown> = anyTc.input ?? anyTc.args ?? {};
          const anyResult = (toolResults as unknown as Array<Record<string, unknown>>)?.[i];
          const rawOutput = anyResult?.output ?? anyResult?.result;
          const resultStr = typeof rawOutput === 'string' ? rawOutput : JSON.stringify(rawOutput ?? '');
          const event: ToolCallEvent = {
            toolName: tc.toolName,
            label: toolLabel(tc.toolName, input),
            args: input,
            result: summarizeResult(tc.toolName, resultStr),
          };
          win.webContents.send('agent:toolCall', event);
        });
      },
    });

    for await (const chunk of result.textStream) {
      if (signal.aborted) break;
      win.webContents.send('agent:token', chunk);
    }
  } catch (err) {
    if (!signal.aborted) {
      win.webContents.send('agent:token', `\n\nLỗi: ${String(err)}`);
    }
  } finally {
    win.webContents.send('agent:done');
    currentAbortController = null;
  }
}

export function cancelAgent(): void {
  currentAbortController?.abort();
}

function toolLabel(toolName: string, args: Record<string, unknown>): string {
  switch (toolName) {
    case 'list_directory': return `Xem thư mục: ${args.dir_path ?? '.'}`;
    case 'find_files': return `Tìm file: "${args.query ?? ''}"`;
    case 'read_file': return `Đọc file: ${args.file_path ?? ''}`;
    case 'write_file': return `Ghi file: ${args.file_path ?? ''}`;
    case 'search_files': return `Tìm kiếm: "${args.query ?? ''}"`;
    case 'create_markdown': return `Tạo file Markdown: ${args.file_path ?? ''}`;
    case 'create_pdf': return `Tạo file PDF: ${args.file_path ?? ''}`;
    case 'create_docx': return `Tạo file Word: ${args.file_path ?? ''}`;
    case 'update_memory': return `Ghi nhớ thông tin`;
    case 'get_date': return `Lấy ngày hôm nay`;
    default: return toolName;
  }
}

function summarizeResult(toolName: string, result: string): string {
  if (!result || result === '""') return '';
  if (toolName === 'list_directory') {
    const lines = result.split('\n').filter(Boolean);
    if (lines.length <= 5) return result;
    return `${lines.slice(0, 5).join('\n')}\n... (${lines.length} mục)`;
  }
  if (toolName === 'read_file') {
    if (result.length <= 300) return result;
    return result.slice(0, 300) + `\n... (${result.length} ký tự)`;
  }
  if (['create_markdown', 'create_pdf', 'create_docx'].includes(toolName)) return result;
  if (result.length > 200) return result.slice(0, 200) + '...';
  return result;
}
