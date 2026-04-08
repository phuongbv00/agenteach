import fs from 'fs';
import path from 'path';
import os from 'os';
import { tool, zodSchema } from 'ai';
import { z } from 'zod';
import { BrowserWindow } from 'electron';
import { marked } from 'marked';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import mammoth from 'mammoth';
import { FileCache } from '../FileCache';
import { ArtifactStore } from '../../sessions/ArtifactStore';
import type { Workspace } from '../../workspace/WorkspaceManager';
import type { WorkspaceIndex } from '../WorkspaceIndex';

// ── Inline markdown parser (bold, italic, code) ───────────────────────────────

function parseInlineText(text: string): TextRun[] {
  const runs: TextRun[] = [];
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      runs.push(new TextRun(text.slice(lastIndex, match.index)));
    }
    const m = match[0];
    if (m.startsWith('**')) {
      runs.push(new TextRun({ text: m.slice(2, -2), bold: true }));
    } else if (m.startsWith('*')) {
      runs.push(new TextRun({ text: m.slice(1, -1), italics: true }));
    } else {
      runs.push(new TextRun({ text: m.slice(1, -1), font: 'Courier New' }));
    }
    lastIndex = match.index + m.length;
  }
  if (lastIndex < text.length) runs.push(new TextRun(text.slice(lastIndex)));
  return runs.length > 0 ? runs : [new TextRun(text)];
}

// ── Markdown → DOCX paragraphs ────────────────────────────────────────────────

function markdownToDocxParagraphs(content: string): Paragraph[] {
  const lines = content.split('\n');
  const result: Paragraph[] = [];
  let inCode = false;
  const codeLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith('```')) {
      if (inCode) {
        result.push(
          new Paragraph({
            children: [new TextRun({ text: codeLines.join('\n'), font: 'Courier New', size: 18 })],
          }),
        );
        codeLines.length = 0;
        inCode = false;
      } else {
        inCode = true;
      }
      continue;
    }
    if (inCode) { codeLines.push(line); continue; }

    if (line.startsWith('#### ')) {
      result.push(new Paragraph({ text: line.slice(5).trim(), heading: HeadingLevel.HEADING_4 }));
    } else if (line.startsWith('### ')) {
      result.push(new Paragraph({ text: line.slice(4).trim(), heading: HeadingLevel.HEADING_3 }));
    } else if (line.startsWith('## ')) {
      result.push(new Paragraph({ text: line.slice(3).trim(), heading: HeadingLevel.HEADING_2 }));
    } else if (line.startsWith('# ')) {
      result.push(new Paragraph({ text: line.slice(2).trim(), heading: HeadingLevel.HEADING_1 }));
    } else if (/^\s{2,}[-*+] /.test(line)) {
      result.push(new Paragraph({ children: parseInlineText(line.replace(/^\s*[-*+] /, '')), bullet: { level: 1 } }));
    } else if (/^[-*+] /.test(line)) {
      result.push(new Paragraph({ children: parseInlineText(line.slice(2)), bullet: { level: 0 } }));
    } else if (/^\d+\. /.test(line)) {
      result.push(new Paragraph({ children: parseInlineText(line.replace(/^\d+\. /, '')) }));
    } else if (line.trim() === '' || /^[-*_]{3,}$/.test(line.trim())) {
      result.push(new Paragraph(''));
    } else {
      result.push(new Paragraph({ children: parseInlineText(line) }));
    }
  }

  return result;
}

// ── DOCX generation ───────────────────────────────────────────────────────────

async function buildDocxBuffer(content: string): Promise<Buffer> {
  const doc = new Document({ sections: [{ children: markdownToDocxParagraphs(content) }] });
  return Packer.toBuffer(doc);
}

// ── PDF generation via hidden BrowserWindow ───────────────────────────────────

const PDF_CSS = `
  body { font-family: Arial, 'Helvetica Neue', sans-serif; margin: 0; padding: 32px 48px; line-height: 1.7; color: #222; }
  h1 { font-size: 22px; border-bottom: 2px solid #333; padding-bottom: 6px; margin-top: 24px; }
  h2 { font-size: 18px; border-bottom: 1px solid #ccc; padding-bottom: 4px; margin-top: 20px; }
  h3 { font-size: 15px; margin-top: 16px; }
  h4 { font-size: 13px; }
  code { background: #f5f5f5; padding: 2px 5px; border-radius: 3px; font-family: 'Courier New', monospace; font-size: 13px; }
  pre { background: #f5f5f5; padding: 12px 16px; border-radius: 4px; margin: 12px 0; }
  pre code { background: none; padding: 0; }
  table { border-collapse: collapse; width: 100%; margin: 14px 0; }
  th, td { border: 1px solid #ccc; padding: 7px 12px; text-align: left; }
  th { background: #f0f0f0; font-weight: 600; }
  blockquote { border-left: 4px solid #bbb; margin: 0 0 0 8px; padding: 4px 16px; color: #555; }
  ul, ol { padding-left: 1.75rem; list-style-type: initial; }
  li { margin: 3px 0; }
  hr { border: none; border-top: 1px solid #ddd; margin: 20px 0; }
  p { margin: 8px 0; }
`;

async function buildPdfBuffer(content: string): Promise<Buffer> {
  const html = marked.parse(content) as string;
  const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${PDF_CSS}</style></head><body>${html}</body></html>`;

  const tmpHtml = path.join(os.tmpdir(), `agenteach-pdf-${Date.now()}.html`);
  fs.writeFileSync(tmpHtml, fullHtml, 'utf-8');

  const pdfWin = new BrowserWindow({
    show: false,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });

  try {
    await pdfWin.loadURL(`file://${tmpHtml}`);
    return await pdfWin.webContents.printToPDF({ printBackground: true, pageSize: 'A4' });
  } finally {
    pdfWin.close();
    try { fs.unlinkSync(tmpHtml); } catch { /* ignore */ }
  }
}

// ── DOCX → HTML preview ───────────────────────────────────────────────────────

export async function docxToHtml(filePath: string): Promise<string> {
  const result = await mammoth.convertToHtml({ path: filePath });
  return result.value;
}

// ── Tool factory ──────────────────────────────────────────────────────────────

export function createExportTools(
  workspace: Workspace,
  win: BrowserWindow,
  _index: WorkspaceIndex,
  sessionId: string | undefined,
) {
  function artifactsDir(): string {
    return path.join(os.homedir(), '.agenteach', 'cache', 'artifacts', workspace.id, sessionId ?? 'default');
  }

  function resolveArtifactPath(fileName: string): string {
    const dir = artifactsDir();
    fs.mkdirSync(dir, { recursive: true });
    return path.join(dir, path.basename(fileName));
  }

  async function trackAndPreview(filePath: string, type: 'md' | 'pdf' | 'docx'): Promise<void> {
    const fileName = path.basename(filePath);
    if (sessionId) {
      const artifact = await ArtifactStore.add({ sessionId, workspaceId: workspace.id, filePath, fileName, type });
      win.webContents.send('artifact:created', artifact);
    }
    win.webContents.send('file:preview', { type, fileName, filePath });
  }

  return {
    create_markdown: tool({
      description:
        'Tạo file Markdown (.md) với nội dung được cung cấp. File sẽ tự động mở xem trước ở thanh bên phải và được lưu vào danh sách tài liệu của phiên làm việc.',
      inputSchema: zodSchema(
        z.object({
          file_name: z.string().describe('Tên file .md cần tạo, VD: "tuan1.md"'),
          content: z.string().describe('Nội dung Markdown của file'),
        }),
      ),
      execute: async (input: { file_name: string; content: string }) => {
        try {
          const resolved = resolveArtifactPath(input.file_name);
          fs.writeFileSync(resolved, input.content, 'utf-8');
          FileCache.invalidate(resolved);
          await trackAndPreview(resolved, 'md');
          return `Đã tạo file Markdown: ${resolved}`;
        } catch (e) {
          return `Lỗi khi tạo file: ${String(e)}`;
        }
      },
    }),

    create_pdf: tool({
      description:
        'Tạo file PDF từ nội dung Markdown với định dạng đẹp (tiêu đề, đoạn văn, bảng, danh sách...). File sẽ tự động mở xem trước và được lưu vào danh sách tài liệu của phiên làm việc.',
      inputSchema: zodSchema(
        z.object({
          file_name: z.string().describe('Tên file .pdf cần tạo, VD: "hoc_ky1.pdf"'),
          content: z.string().describe('Nội dung Markdown sẽ được chuyển đổi thành PDF'),
        }),
      ),
      execute: async (input: { file_name: string; content: string }) => {
        try {
          const resolved = resolveArtifactPath(input.file_name);
          win.webContents.send('agent:fileProgress', { fileName: input.file_name, stage: 'parsing' });
          const buf = await buildPdfBuffer(input.content);
          fs.writeFileSync(resolved, buf);
          await trackAndPreview(resolved, 'pdf');
          return `Đã tạo file PDF: ${resolved}`;
        } catch (e) {
          return `Lỗi khi tạo PDF: ${String(e)}`;
        }
      },
    }),

    create_docx: tool({
      description:
        'Tạo file Word (.docx) từ nội dung Markdown với các kiểu định dạng: tiêu đề các cấp, đoạn văn, danh sách, in đậm/nghiêng. File sẽ tự động mở xem trước và được lưu vào danh sách tài liệu của phiên làm việc.',
      inputSchema: zodSchema(
        z.object({
          file_name: z.string().describe('Tên file .docx cần tạo, VD: "tuan2.docx"'),
          content: z.string().describe('Nội dung Markdown sẽ được chuyển đổi thành DOCX'),
        }),
      ),
      execute: async (input: { file_name: string; content: string }) => {
        try {
          const resolved = resolveArtifactPath(input.file_name);
          const buf = await buildDocxBuffer(input.content);
          fs.writeFileSync(resolved, buf);
          await trackAndPreview(resolved, 'docx');
          return `Đã tạo file Word: ${resolved}`;
        } catch (e) {
          return `Lỗi khi tạo DOCX: ${String(e)}`;
        }
      },
    }),
  };
}
