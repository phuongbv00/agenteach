import fs from "fs";
import os from "os";
import path from "path";
import readline from "readline";
import { tool, zodSchema } from "ai";
import { z } from "zod";
import type { ToolsMetaMap } from "./meta";
import { staticLabels } from "./labels";
import { BrowserWindow, ipcMain } from "electron";
import mammoth from "mammoth";
import pdf2md from "@opendocsg/pdf2md";
import { NodeHtmlMarkdown } from "node-html-markdown";
import { Marked } from "marked";
import katex from "katex";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, ImageRun } from "docx";
import { FileCache } from "../FileCache";
import { PermissionManager } from "../PermissionManager";
import { ArtifactStore } from "../../sessions/ArtifactStore";
import type { Workspace } from "../../workspace/WorkspaceManager";
import type { WorkspaceIndex } from "../WorkspaceIndex";
import { dataDir } from "../../utils/dataDir";

export async function requestHitl(
  action: "read" | "write",
  filePath: string,
  workspaceId: string,
  win: BrowserWindow,
): Promise<boolean> {
  const status = PermissionManager.check(action, workspaceId);
  if (status === "granted") return true;
  if (status === "denied") return false;

  return new Promise((resolve) => {
    const channel = `hitl:approval:${Date.now()}`;
    win.webContents.send("hitl:requestApproval", {
      action,
      filePath,
      replyChannel: channel,
    });

    ipcMain.once(
      channel,
      (_event: unknown, approved: boolean, scope: string) => {
        if (approved) {
          PermissionManager.grant(
            action,
            workspaceId,
            scope as "once" | "session" | "always",
          );
        }
        resolve(approved);
      },
    );
  });
}

const nhm = new NodeHtmlMarkdown({ bulletMarker: "-" });

const PARSED_EXTS = new Set([".docx", ".pdf"]);

// ── KaTeX helpers ──────────────────────────────────────────────────────────────

/** Convert \(...\) and \[...\] to $...$ / $$...$$ so remark-math / markedWithMath can parse them. */
function normalizeMathDelimiters(content: string): string {
  return content
    .replace(/\\\[([\s\S]+?)\\\]/g, (_, m: string) => `$$${m}$$`)
    .replace(/\\\((.+?)\\\)/g, (_, m: string) => `$${m}$`);
}

let _katexCss: string | null = null;
function getKatexCss(): string {
  if (!_katexCss) {
    const cssPath = path.join(
      path.dirname(require.resolve("katex")),
      "../dist/katex.min.css",
    );
    _katexCss = fs.readFileSync(cssPath, "utf-8");
  }
  return _katexCss;
}

// marked instance with math block/inline extensions (used for PDF)
const markedWithMath = new Marked();
markedWithMath.use({
  extensions: [
    {
      name: "mathBlock",
      level: "block",
      start(src: string) {
        return src.indexOf("$$");
      },
      tokenizer(src: string) {
        const match = src.match(/^\$\$([\s\S]+?)\$\$/);
        if (match) return { type: "mathBlock", raw: match[0], math: match[1].trim() };
        return undefined;
      },
      renderer(token) {
        try {
          return katex.renderToString(token["math"] as string, {
            displayMode: true,
            throwOnError: false,
          });
        } catch {
          return `<code>${token["math"]}</code>`;
        }
      },
    },
    {
      name: "mathInline",
      level: "inline",
      start(src: string) {
        return src.indexOf("$");
      },
      tokenizer(src: string) {
        const match = src.match(/^\$([^$\n]+?)\$/);
        if (match) return { type: "mathInline", raw: match[0], math: match[1].trim() };
        return undefined;
      },
      renderer(token) {
        try {
          return katex.renderToString(token["math"] as string, {
            displayMode: false,
            throwOnError: false,
          });
        } catch {
          return `<code>${token["math"]}</code>`;
        }
      },
    },
  ],
});

// Render a list of LaTeX equations to PNG buffers using an offscreen BrowserWindow
async function batchRenderLatexToPng(
  equations: Array<{ latex: string; display: boolean }>,
): Promise<Buffer[]> {
  if (equations.length === 0) return [];

  const equationHtml = equations
    .map((eq, i) => {
      const rendered = katex.renderToString(eq.latex, {
        displayMode: eq.display,
        throwOnError: false,
      });
      return `<div id="eq-${i}" style="display:inline-block;padding:4px 6px;background:white">${rendered}</div>`;
    })
    .join("\n");

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${getKatexCss()}body{margin:0;padding:8px;background:white}</style></head><body>${equationHtml}</body></html>`;
  const tmpHtml = path.join(os.tmpdir(), `katex-batch-${Date.now()}.html`);
  fs.writeFileSync(tmpHtml, html, "utf-8");

  const win = new BrowserWindow({
    show: false,
    width: 1400,
    height: 2000,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });

  try {
    await win.loadURL(`file://${tmpHtml}`);
    const rects: Array<{ x: number; y: number; width: number; height: number }> =
      await win.webContents.executeJavaScript(`
        Array.from(document.querySelectorAll('[id^="eq-"]')).map(el => {
          const r = el.getBoundingClientRect();
          return { x: Math.floor(r.left), y: Math.floor(r.top), width: Math.ceil(r.width), height: Math.ceil(r.height) };
        })
      `);

    const results: Buffer[] = [];
    for (const rect of rects) {
      const img = await win.webContents.capturePage({
        x: Math.max(rect.x, 0),
        y: Math.max(rect.y, 0),
        width: Math.max(rect.width, 1),
        height: Math.max(rect.height, 1),
      });
      results.push(img.toPNG());
    }
    return results;
  } finally {
    win.close();
    try {
      fs.unlinkSync(tmpHtml);
    } catch {
      /* ignore */
    }
  }
}

async function readFileContent(
  filePath: string,
  onProgress: (stage: "reading" | "parsing") => void,
): Promise<string> {
  const ext = path.extname(filePath).toLowerCase();

  if (!PARSED_EXTS.has(ext)) {
    return fs.readFileSync(filePath, "utf-8");
  }

  const cached = await FileCache.get(filePath);
  if (cached !== null) return cached;

  onProgress("reading");
  let content: string;

  if (ext === ".docx") {
    onProgress("parsing");
    const result = await mammoth.convertToHtml({ path: filePath });
    content = nhm.translate(result.value);
  } else {
    const buffer = fs.readFileSync(filePath);
    onProgress("parsing");
    content = await pdf2md(buffer);
  }

  FileCache.set(filePath, content);
  return content;
}

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
    if (m.startsWith("**")) {
      runs.push(new TextRun({ text: m.slice(2, -2), bold: true }));
    } else if (m.startsWith("*")) {
      runs.push(new TextRun({ text: m.slice(1, -1), italics: true }));
    } else {
      runs.push(new TextRun({ text: m.slice(1, -1), font: "Courier New" }));
    }
    lastIndex = match.index + m.length;
  }
  if (lastIndex < text.length) runs.push(new TextRun(text.slice(lastIndex)));
  return runs.length > 0 ? runs : [new TextRun(text)];
}

// ── Markdown → DOCX paragraphs ────────────────────────────────────────────────

// Replace LaTeX delimiters with null-byte-delimited placeholders and return
// the list of extracted equations in order.
function extractLatex(content: string): {
  processed: string;
  equations: Array<{ latex: string; display: boolean }>;
} {
  const equations: Array<{ latex: string; display: boolean }> = [];

  // Block math $$...$$ (handles multi-line)
  let processed = content.replace(/\$\$([\s\S]+?)\$\$/g, (_, math) => {
    equations.push({ latex: math.replace(/\n/g, " ").trim(), display: true });
    return `\x00B${equations.length - 1}\x00`;
  });

  // Inline math $...$ (single line, non-empty)
  // eslint-disable-next-line no-control-regex
  processed = processed.replace(new RegExp("\\$([^$\\n\\x00]+?)\\$", "g"), (_, math) => {
    equations.push({ latex: math.trim(), display: false });
    return `\x00I${equations.length - 1}\x00`;
  });

  return { processed, equations };
}

// Build docx run children for a line that may contain equation placeholders.
function buildLineChildren(
  line: string,
  pngs: Buffer[],
): Array<TextRun | ImageRun> {
  // eslint-disable-next-line no-control-regex
  const segments = line.split(new RegExp("\\x00([BI]\\d+)\\x00"));
  const children: Array<TextRun | ImageRun> = [];

  for (let i = 0; i < segments.length; i++) {
    if (i % 2 === 0) {
      if (segments[i]) children.push(...parseInlineText(segments[i]));
    } else {
      const idx = parseInt(segments[i].slice(1));
      const isBlock = segments[i][0] === "B";
      const png = pngs[idx];
      if (png && png.length >= 24) {
        const pngW = png.readUInt32BE(16);
        const pngH = png.readUInt32BE(20);
        // capturePage returns physical pixels; divide by DPR for logical size
        const DPR = 2;
        const targetH = isBlock ? 40 : 22;
        const scale = targetH / Math.max(pngH / DPR, 1);
        children.push(
          new ImageRun({
            data: png,
            transformation: {
              width: Math.round((pngW / DPR) * scale),
              height: targetH,
            },
            type: "png",
          }),
        );
      }
    }
  }

  return children;
}

async function markdownToDocxParagraphs(content: string): Promise<Paragraph[]> {
  const { processed, equations } = extractLatex(normalizeMathDelimiters(content));
  const pngs = await batchRenderLatexToPng(equations);

  const lines = processed.split("\n");
  const result: Paragraph[] = [];
  let inCode = false;
  const codeLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith("```")) {
      if (inCode) {
        result.push(
          new Paragraph({
            children: [
              new TextRun({
                text: codeLines.join("\n"),
                font: "Courier New",
                size: 18,
              }),
            ],
          }),
        );
        codeLines.length = 0;
        inCode = false;
      } else {
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      codeLines.push(line);
      continue;
    }

    if (line.startsWith("#### ")) {
      result.push(
        new Paragraph({
          children: buildLineChildren(line.slice(5).trim(), pngs),
          heading: HeadingLevel.HEADING_4,
        }),
      );
    } else if (line.startsWith("### ")) {
      result.push(
        new Paragraph({
          children: buildLineChildren(line.slice(4).trim(), pngs),
          heading: HeadingLevel.HEADING_3,
        }),
      );
    } else if (line.startsWith("## ")) {
      result.push(
        new Paragraph({
          children: buildLineChildren(line.slice(3).trim(), pngs),
          heading: HeadingLevel.HEADING_2,
        }),
      );
    } else if (line.startsWith("# ")) {
      result.push(
        new Paragraph({
          children: buildLineChildren(line.slice(2).trim(), pngs),
          heading: HeadingLevel.HEADING_1,
        }),
      );
    } else if (/^\s{2,}[-*+] /.test(line)) {
      result.push(
        new Paragraph({
          children: buildLineChildren(line.replace(/^\s*[-*+] /, ""), pngs),
          bullet: { level: 1 },
        }),
      );
    } else if (/^[-*+] /.test(line)) {
      result.push(
        new Paragraph({
          children: buildLineChildren(line.slice(2), pngs),
          bullet: { level: 0 },
        }),
      );
    } else if (/^\d+\. /.test(line)) {
      result.push(
        new Paragraph({
          children: buildLineChildren(line.replace(/^\d+\. /, ""), pngs),
        }),
      );
    } else if (line.trim() === "" || /^[-*_]{3,}$/.test(line.trim())) {
      result.push(new Paragraph(""));
    } else {
      result.push(new Paragraph({ children: buildLineChildren(line, pngs) }));
    }
  }

  return result;
}

async function buildDocxBuffer(content: string): Promise<Buffer> {
  const doc = new Document({
    sections: [{ children: await markdownToDocxParagraphs(content) }],
  });
  return Packer.toBuffer(doc);
}

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
  const normalized = normalizeMathDelimiters(content);
  const html = markedWithMath.parse(normalized) as string;
  const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${getKatexCss()}\n${PDF_CSS}</style></head><body>${html}</body></html>`;

  const tmpHtml = path.join(os.tmpdir(), `agenteach-pdf-${Date.now()}.html`);
  fs.writeFileSync(tmpHtml, fullHtml, "utf-8");

  const pdfWin = new BrowserWindow({
    show: false,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });

  try {
    await pdfWin.loadURL(`file://${tmpHtml}`);
    return await pdfWin.webContents.printToPDF({
      printBackground: true,
      pageSize: "A4",
    });
  } finally {
    pdfWin.close();
    try {
      fs.unlinkSync(tmpHtml);
    } catch {
      /* ignore */
    }
  }
}

export async function docxToHtml(filePath: string): Promise<string> {
  const result = await mammoth.convertToHtml({ path: filePath });
  return result.value;
}

// ── Tool factory ──────────────────────────────────────────────────────────────

export function createFileTools(
  workspace: Workspace,
  win: BrowserWindow,
  index: WorkspaceIndex,
  sessionId?: string,
) {
  // macOS APFS stores filenames as NFD; Windows NTFS stores as-is (typically NFC).
  const PATH_NORM: "NFD" | "NFC" = process.platform === "darwin" ? "NFD" : "NFC";
  const wsPath = path.resolve(workspace.path).normalize(PATH_NORM);

  function resolveWorkspacePath(filePath: string): string {
    const normalisedInput = filePath.normalize(PATH_NORM);
    const expanded =
      normalisedInput.startsWith("~/") || normalisedInput === "~"
        ? path.join(os.homedir(), normalisedInput.slice(1))
        : normalisedInput;
    if (path.isAbsolute(expanded)) {
      return path.resolve(expanded).normalize(PATH_NORM);
    }
    const normalised =
      !expanded || expanded === "." || expanded === workspace.name
        ? "."
        : expanded;
    return path.resolve(wsPath, normalised).normalize(PATH_NORM);
  }

  function inWorkspace(resolved: string): boolean {
    return resolved.startsWith(wsPath + path.sep) || resolved === wsPath;
  }

  function artifactsDir(): string {
    return dataDir("workspaces", workspace.id, "artifacts", sessionId ?? "default");
  }

  function resolveArtifactPath(fileName: string): string {
    const dir = artifactsDir();
    fs.mkdirSync(dir, { recursive: true });
    return path.join(dir, path.basename(fileName));
  }

  async function trackAndPreview(
    filePath: string,
    type: "md" | "pdf" | "docx",
  ): Promise<void> {
    const fileName = path.basename(filePath);
    if (sessionId) {
      const artifact = await ArtifactStore.add({
        sessionId,
        workspaceId: workspace.id,
        filePath,
        fileName,
        type,
      });
      win.webContents.send("artifact:created", artifact);
    }
    win.webContents.send("file:preview", { type, fileName, filePath });
  }

  const tools = {
    fs_list_dir: tool({
      description: `Liệt kê file và thư mục. Workspace root = "${wsPath}". Dùng dir_path="" hoặc "." để liệt kê workspace root. Hỗ trợ đường dẫn tuyệt đối (/Users/..., ~/...) để xem thư mục ngoài workspace.`,
      inputSchema: zodSchema(
        z.object({
          dir_path: z
            .string()
            .describe(
              `Thư mục cần liệt kê. "" hoặc "." = workspace root (${wsPath}). Tương đối: "subfolder". Tuyệt đối: "/Users/foo/bar" hoặc "~/Projects"`,
            ),
          recursive: z
            .boolean()
            .optional()
            .describe("Liệt kê đệ quy các thư mục con"),
        }),
      ),
      execute: async (input: { dir_path: string; recursive?: boolean }) => {
        const { dir_path, recursive = false } = input;
        try {
          const resolved = resolveWorkspacePath(dir_path);
          const relDir = path.relative(wsPath, resolved);
          const entries = recursive
            ? index.listRecursive(relDir)
            : index.listDir(relDir);
          const items = entries.map((e) => (e.isDir ? e.rel + "/" : e.rel));
          const header = `[${resolved}]`;
          return items.length > 0
            ? `${header}\n${items.join("\n")}`
            : `${header}\n(thư mục trống)`;
        } catch (e) {
          return `Lỗi: ${String(e)}`;
        }
      },
    }),

    fs_find_files: tool({
      description:
        'Tìm kiếm file hoặc thư mục theo tên trong workspace (dùng index, nhanh). Query được tách thành token và so khớp linh hoạt với tên file (VD: "Spring Web" khớp "spring-web.docx", "spring-boot.pdf"). Dùng tool này khi cần tìm file/folder theo tên thay vì fs_list_dir.',
      inputSchema: zodSchema(
        z.object({
          query: z
            .string()
            .describe(
              "Tên file hoặc thư mục cần tìm (có thể là một phần của tên)",
            ),
          type: z
            .enum(["file", "dir", "all"])
            .optional()
            .describe(
              'Loại: "file" chỉ tìm file, "dir" chỉ tìm thư mục, "all" tìm cả hai (mặc định)',
            ),
        }),
      ),
      execute: async (input: {
        query: string;
        type?: "file" | "dir" | "all";
      }) => {
        const { query, type = "all" } = input;
        const matches = index.find(query).filter((e) => {
          if (type === "file") return !e.isDir;
          if (type === "dir") return e.isDir;
          return true;
        });
        if (matches.length === 0) return "Không tìm thấy kết quả.";
        return matches.map((e) => (e.isDir ? e.rel + "/" : e.rel)).join("\n");
      },
    }),

    fs_read_file: tool({
      description: `Đọc nội dung file (.txt, .md, .docx, .pdf). Nội dung .docx và .pdf được parse về Markdown. Ưu tiên dùng đường dẫn tuyệt đối. Hỗ trợ: tuyệt đối ("/Users/foo/file.md", "~/Projects/file.md"), tương đối trong workspace ("folder/file.md").`,
      inputSchema: zodSchema(
        z.object({
          file_path: z
            .string()
            .describe(
              'Đường dẫn file. Ưu tiên absolute path: "/Users/foo/file.md" hoặc "~/Projects/file.md". Hoặc tương đối trong workspace: "folder/file.md"',
            ),
        }),
      ),
      execute: async (input: { file_path: string }) => {
        try {
          const resolved = resolveWorkspacePath(input.file_path);
          if (!inWorkspace(resolved)) {
            const approved = await requestHitl(
              "read",
              resolved,
              workspace.id,
              win,
            );
            if (!approved) return "Người dùng từ chối cho phép đọc file này.";
          }
          const fileName = path.basename(resolved);
          return await readFileContent(resolved, (stage) => {
            win.webContents.send("agent:fileProgress", { fileName, stage });
          });
        } catch (e) {
          return `Lỗi khi đọc file: ${String(e)}`;
        }
      },
    }),

    fs_write_file: tool({
      description:
        "Ghi nội dung vào file. Hỗ trợ đường dẫn tuyệt đối (/Users/..., ~/...) và tương đối trong workspace.",
      inputSchema: zodSchema(
        z.object({
          file_path: z
            .string()
            .describe(
              'Đường dẫn file cần ghi. Ưu tiên absolute path: "/Users/foo/file.md" hoặc "~/Projects/file.md"',
            ),
          content: z.string().describe("Nội dung cần ghi vào file"),
        }),
      ),
      execute: async (input: { file_path: string; content: string }) => {
        const resolved = resolveWorkspacePath(input.file_path);
        const approved = await requestHitl(
          "write",
          resolved,
          workspace.id,
          win,
        );
        if (!approved) return "Người dùng từ chối cho phép ghi file này.";
        try {
          fs.mkdirSync(path.dirname(resolved), { recursive: true });
          fs.writeFileSync(resolved, input.content, "utf-8");
          FileCache.invalidate(resolved);
          index.build();
          return `Đã ghi file thành công: ${path.relative(wsPath, resolved)}`;
        } catch (e) {
          return `Lỗi khi ghi file: ${String(e)}`;
        }
      },
    }),

    fs_search_in_files: tool({
      description:
        "Tìm kiếm nội dung văn bản trong các file của workspace (streaming line-by-line, hiệu quả). Hỗ trợ thu hẹp phạm vi theo thư mục — dùng sau khi đã xác nhận phạm vi với user.",
      inputSchema: zodSchema(
        z.object({
          query: z.string().describe("Chuỗi cần tìm kiếm"),
          dir_path: z
            .string()
            .optional()
            .describe(
              'Thư mục cần tìm (tương đối trong workspace hoặc tuyệt đối). Mặc định: toàn workspace. VD: "Lop10/HK1"',
            ),
        }),
      ),
      execute: async (input: { query: string; dir_path?: string }) => {
        const { query, dir_path } = input;
        const searchDir = dir_path ? resolveWorkspacePath(dir_path) : wsPath;
        const relSearchDir = path.relative(wsPath, searchDir);
        const regex = new RegExp(
          query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
          "i",
        );
        const MAX_RESULTS = 30;
        const results: string[] = [];

        const files = index.getFiles().filter((e) => {
          const ext = path.extname(e.name).toLowerCase();
          if (![".txt", ".md"].includes(ext)) return false;
          if (relSearchDir && relSearchDir !== ".") {
            if (
              !e.rel.startsWith(relSearchDir + path.sep) &&
              e.rel !== relSearchDir
            )
              return false;
          }
          return true;
        });

        for (const fileEntry of files) {
          if (results.length >= MAX_RESULTS) break;
          const fullPath = path.join(wsPath, fileEntry.rel);
          await new Promise<void>((resolve) => {
            const rl = readline.createInterface({
              input: fs.createReadStream(fullPath, { encoding: "utf-8" }),
              crlfDelay: Infinity,
            });
            let lineNum = 0;
            rl.on("line", (line: string) => {
              lineNum++;
              if (results.length >= MAX_RESULTS) {
                rl.close();
                return;
              }
              if (regex.test(line)) {
                results.push(`${fileEntry.rel}:${lineNum}: ${line.trim()}`);
              }
            });
            rl.on("close", resolve);
            rl.on("error", resolve);
          });
        }

        return results.length > 0
          ? results.join("\n")
          : "Không tìm thấy kết quả.";
      },
    }),

    // ── Export tools ────────────────────────────────────────────────────────

    fs_create_markdown: tool({
      description:
        "Tạo file Markdown (.md) với nội dung được cung cấp. File sẽ tự động mở xem trước ở thanh bên phải và được lưu vào danh sách tài liệu của phiên làm việc.",
      inputSchema: zodSchema(
        z.object({
          file_name: z
            .string()
            .describe('Tên file .md cần tạo, VD: "tuan1.md"'),
          content: z.string().describe("Nội dung Markdown của file"),
        }),
      ),
      execute: async (input: { file_name: string; content: string }) => {
        try {
          const resolved = resolveArtifactPath(input.file_name);
          fs.writeFileSync(resolved, input.content, "utf-8");
          FileCache.invalidate(resolved);
          await trackAndPreview(resolved, "md");
          return `Đã tạo file Markdown: ${resolved}`;
        } catch (e) {
          return `Lỗi khi tạo file: ${String(e)}`;
        }
      },
    }),

    fs_create_pdf: tool({
      description:
        "Tạo file PDF từ nội dung Markdown với định dạng đẹp (tiêu đề, đoạn văn, bảng, danh sách...). File sẽ tự động mở xem trước và được lưu vào danh sách tài liệu của phiên làm việc.",
      inputSchema: zodSchema(
        z.object({
          file_name: z
            .string()
            .describe('Tên file .pdf cần tạo, VD: "hoc_ky1.pdf"'),
          content: z
            .string()
            .describe("Nội dung Markdown sẽ được chuyển đổi thành PDF"),
        }),
      ),
      execute: async (input: { file_name: string; content: string }) => {
        try {
          const resolved = resolveArtifactPath(input.file_name);
          win.webContents.send("agent:fileProgress", {
            fileName: input.file_name,
            stage: "parsing",
          });
          const buf = await buildPdfBuffer(input.content);
          fs.writeFileSync(resolved, buf);
          await trackAndPreview(resolved, "pdf");
          return `Đã tạo file PDF: ${resolved}`;
        } catch (e) {
          return `Lỗi khi tạo PDF: ${String(e)}`;
        }
      },
    }),

    fs_create_docx: tool({
      description:
        "Tạo file Word (.docx) từ nội dung Markdown với các kiểu định dạng: tiêu đề các cấp, đoạn văn, danh sách, in đậm/nghiêng. File sẽ tự động mở xem trước và được lưu vào danh sách tài liệu của phiên làm việc.",
      inputSchema: zodSchema(
        z.object({
          file_name: z
            .string()
            .describe('Tên file .docx cần tạo, VD: "tuan2.docx"'),
          content: z
            .string()
            .describe("Nội dung Markdown sẽ được chuyển đổi thành DOCX"),
        }),
      ),
      execute: async (input: { file_name: string; content: string }) => {
        try {
          const resolved = resolveArtifactPath(input.file_name);
          const buf = await buildDocxBuffer(input.content);
          fs.writeFileSync(resolved, buf);
          await trackAndPreview(resolved, "docx");
          return `Đã tạo file Word: ${resolved}`;
        } catch (e) {
          return `Lỗi khi tạo DOCX: ${String(e)}`;
        }
      },
    }),
  };

  const meta: ToolsMetaMap = {
    fs_list_dir: {
      label: staticLabels.fs_list_dir,
      summarize: (result) => {
        const lines = result.split("\n").filter(Boolean);
        if (lines.length <= 5) return result;
        return `${lines.slice(0, 5).join("\n")}\n... (${lines.length} mục)`;
      },
    },
    fs_find_files: { label: staticLabels.fs_find_files },
    fs_read_file: {
      label: staticLabels.fs_read_file,
      summarize: (result) =>
        result.length <= 300
          ? result
          : result.slice(0, 300) + `\n... (${result.length} ký tự)`,
    },
    fs_write_file: { label: staticLabels.fs_write_file },
    fs_search_in_files: { label: staticLabels.fs_search_in_files },
    fs_create_markdown: { label: staticLabels.fs_create_markdown },
    fs_create_pdf: { label: staticLabels.fs_create_pdf },
    fs_create_docx: { label: staticLabels.fs_create_docx },
  };

  return { tools, meta };
}
