import fs from 'fs';
import os from 'os';
import path from 'path';
import { tool, zodSchema } from 'ai';
import { z } from 'zod';
import { BrowserWindow, ipcMain } from 'electron';
import mammoth from 'mammoth';
import pdf2md from '@opendocsg/pdf2md';
import { NodeHtmlMarkdown } from 'node-html-markdown';
import { FileCache } from '../FileCache';
import { PermissionManager } from '../PermissionManager';
import type { Workspace } from '../../workspace/WorkspaceManager';
import type { WorkspaceIndex } from '../WorkspaceIndex';

export async function requestHitl(
  action: 'read' | 'write',
  filePath: string,
  workspaceId: string,
  win: BrowserWindow
): Promise<boolean> {
  const status = PermissionManager.check(action, workspaceId);
  if (status === 'granted') return true;
  if (status === 'denied') return false;

  return new Promise((resolve) => {
    const channel = `hitl:approval:${Date.now()}`;
    win.webContents.send('hitl:requestApproval', { action, filePath, replyChannel: channel });

    ipcMain.once(channel, (_event: unknown, approved: boolean, scope: string) => {
      if (approved) {
        PermissionManager.grant(action, workspaceId, scope as 'once' | 'session' | 'always');
      }
      resolve(approved);
    });
  });
}

const nhm = new NodeHtmlMarkdown({ bulletMarker: '-' });

const PARSED_EXTS = new Set(['.docx', '.pdf']);

async function readFileContent(
  filePath: string,
  onProgress: (stage: 'reading' | 'parsing') => void
): Promise<string> {
  const ext = path.extname(filePath).toLowerCase();

  if (!PARSED_EXTS.has(ext)) {
    return fs.readFileSync(filePath, 'utf-8');
  }

  const cached = await FileCache.get(filePath);
  if (cached !== null) return cached;

  onProgress('reading');
  let content: string;

  if (ext === '.docx') {
    onProgress('parsing');
    const result = await mammoth.convertToHtml({ path: filePath });
    content = nhm.translate(result.value);
  } else {
    const buffer = fs.readFileSync(filePath);
    onProgress('parsing');
    content = await pdf2md(buffer);
  }

  FileCache.set(filePath, content);
  return content;
}

export function createFileTools(workspace: Workspace, win: BrowserWindow, index: WorkspaceIndex) {
  const wsPath = path.resolve(workspace.path);

  function resolveWorkspacePath(filePath: string): string {
    const expanded = filePath.startsWith('~/') || filePath === '~'
      ? path.join(os.homedir(), filePath.slice(1))
      : filePath;
    if (path.isAbsolute(expanded)) {
      return path.resolve(expanded);
    }
    const normalised = (!expanded || expanded === '.' || expanded === workspace.name) ? '.' : expanded;
    return path.resolve(wsPath, normalised);
  }

  function inWorkspace(resolved: string): boolean {
    return resolved.startsWith(wsPath + path.sep) || resolved === wsPath;
  }

  return {
    list_directory: tool({
      description: `Liệt kê file và thư mục. Workspace root = "${wsPath}". Dùng dir_path="" hoặc "." để liệt kê workspace root. Hỗ trợ đường dẫn tuyệt đối (/Users/..., ~/...) để xem thư mục ngoài workspace.`,
      inputSchema: zodSchema(z.object({
        dir_path: z.string().describe(`Thư mục cần liệt kê. "" hoặc "." = workspace root (${wsPath}). Tương đối: "subfolder". Tuyệt đối: "/Users/foo/bar" hoặc "~/Projects"`),
        recursive: z.boolean().optional().describe('Liệt kê đệ quy các thư mục con'),
      })),
      execute: async (input: { dir_path: string; recursive?: boolean }) => {
        const { dir_path, recursive = false } = input;
        try {
          const resolved = resolveWorkspacePath(dir_path);
          const relDir = path.relative(wsPath, resolved);
          const entries = recursive
            ? index.listRecursive(relDir)
            : index.listDir(relDir);
          const items = entries.map(e => e.isDir ? e.rel + '/' : e.rel);
          const header = `[${resolved}]`;
          return items.length > 0 ? `${header}\n${items.join('\n')}` : `${header}\n(thư mục trống)`;
        } catch (e) {
          return `Lỗi: ${String(e)}`;
        }
      },
    }),

    find_files: tool({
      description: 'Tìm kiếm file hoặc thư mục theo tên trong workspace (dùng index, nhanh). Query được tách thành token và so khớp linh hoạt với tên file (VD: "Spring Web" khớp "spring-web.docx", "spring-boot.pdf"). Dùng tool này khi cần tìm file/folder theo tên thay vì list_directory.',
      inputSchema: zodSchema(z.object({
        query: z.string().describe('Tên file hoặc thư mục cần tìm (có thể là một phần của tên)'),
        type: z.enum(['file', 'dir', 'all']).optional().describe('Loại: "file" chỉ tìm file, "dir" chỉ tìm thư mục, "all" tìm cả hai (mặc định)'),
      })),
      execute: async (input: { query: string; type?: 'file' | 'dir' | 'all' }) => {
        const { query, type = 'all' } = input;
        const matches = index.find(query).filter(e => {
          if (type === 'file') return !e.isDir;
          if (type === 'dir') return e.isDir;
          return true;
        });
        if (matches.length === 0) return 'Không tìm thấy kết quả.';
        return matches.map(e => e.isDir ? e.rel + '/' : e.rel).join('\n');
      },
    }),

    read_file: tool({
      description: `Đọc nội dung file (.txt, .md, .docx, .pdf). Nội dung .docx và .pdf được parse về Markdown. Ưu tiên dùng đường dẫn tuyệt đối. Hỗ trợ: tuyệt đối ("/Users/foo/file.md", "~/Projects/file.md"), tương đối trong workspace ("folder/file.md").`,
      inputSchema: zodSchema(z.object({
        file_path: z.string().describe('Đường dẫn file. Ưu tiên absolute path: "/Users/foo/file.md" hoặc "~/Projects/file.md". Hoặc tương đối trong workspace: "folder/file.md"'),
      })),
      execute: async (input: { file_path: string }) => {
        try {
          const resolved = resolveWorkspacePath(input.file_path);
          if (!inWorkspace(resolved)) {
            const approved = await requestHitl('read', resolved, workspace.id, win);
            if (!approved) return 'Người dùng từ chối cho phép đọc file này.';
          }
          const fileName = path.basename(resolved);
          return await readFileContent(resolved, (stage) => {
            win.webContents.send('agent:fileProgress', { fileName, stage });
          });
        } catch (e) {
          return `Lỗi khi đọc file: ${String(e)}`;
        }
      },
    }),

    write_file: tool({
      description: 'Ghi nội dung vào file. Hỗ trợ đường dẫn tuyệt đối (/Users/..., ~/...) và tương đối trong workspace.',
      inputSchema: zodSchema(z.object({
        file_path: z.string().describe('Đường dẫn file cần ghi. Ưu tiên absolute path: "/Users/foo/file.md" hoặc "~/Projects/file.md"'),
        content: z.string().describe('Nội dung cần ghi vào file'),
      })),
      execute: async (input: { file_path: string; content: string }) => {
        const resolved = resolveWorkspacePath(input.file_path);
        const approved = await requestHitl('write', resolved, workspace.id, win);
        if (!approved) return 'Người dùng từ chối cho phép ghi file này.';
        try {
          fs.mkdirSync(path.dirname(resolved), { recursive: true });
          fs.writeFileSync(resolved, input.content, 'utf-8');
          FileCache.invalidate(resolved);
          index.build();
          return `Đã ghi file thành công: ${path.relative(wsPath, resolved)}`;
        } catch (e) {
          return `Lỗi khi ghi file: ${String(e)}`;
        }
      },
    }),

    search_in_files: tool({
      description: 'Tìm kiếm nội dung văn bản trong các file của workspace',
      inputSchema: zodSchema(z.object({
        query: z.string().describe('Chuỗi cần tìm kiếm'),
        file_glob: z.string().optional().describe('Pattern lọc file, ví dụ: *.txt, *.docx'),
      })),
      execute: async (input: { query: string; file_glob?: string }) => {
        const { query, file_glob } = input;
        const results: string[] = [];
        const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');

        const files = index.getFiles().filter(e => {
          const ext = path.extname(e.name).toLowerCase();
          if (!['.txt', '.md', '.docx'].includes(ext)) return false;
          if (file_glob) {
            const pattern = file_glob.replace('.', '\\.').replace('*', '.*');
            if (!new RegExp(pattern).test(e.name)) return false;
          }
          return true;
        });

        for (const fileEntry of files) {
          if (results.length >= 20) break;
          const ext = path.extname(fileEntry.name).toLowerCase();
          if (ext === '.docx') continue;
          const full = path.join(wsPath, fileEntry.rel);
          try {
            const text = fs.readFileSync(full, 'utf-8');
            const lines = text.split('\n');
            for (let i = 0; i < lines.length; i++) {
              if (results.length >= 20) break;
              if (regex.test(lines[i])) {
                results.push(`${fileEntry.rel}:${i + 1}: ${lines[i].trim()}`);
              }
              regex.lastIndex = 0;
            }
          } catch {
            // skip unreadable files
          }
        }

        return results.length > 0 ? results.join('\n') : 'Không tìm thấy kết quả.';
      },
    }),
  };
}
