import fs from "fs";
import os from "os";
import path from "path";

const CACHE_ROOT = path.join(os.homedir(), ".agenteach", "cache");

interface CacheMeta {
  mtime: number;
}

function cacheContentPath(filePath: string): string {
  // Normalize to forward slashes; encode drive letter (C:/ → C/) to keep it in the key
  // without the colon, then strip the leading slash on Unix paths.
  const normalized = filePath.replace(/\\/g, "/");
  const stripped = normalized.replace(/^([A-Za-z]):\//, "$1/").replace(/^\//, "");
  const base = path.join(CACHE_ROOT, "fs_read_file", stripped);
  // Parsed binary formats are stored as Markdown: file.pdf → file.pdf.md
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".pdf" || ext === ".docx") return base + ".md";
  return base;
}

function cacheMetaPath(contentPath: string): string {
  return contentPath + ".meta.json";
}

export const FileCache = {
  async get(filePath: string): Promise<string | null> {
    try {
      const stat = fs.statSync(filePath);
      const mtime = stat.mtimeMs;

      const contentPath = cacheContentPath(filePath);
      const metaPath = cacheMetaPath(contentPath);

      if (!fs.existsSync(contentPath) || !fs.existsSync(metaPath)) return null;

      const meta: CacheMeta = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
      if (meta.mtime !== mtime) return null;

      return fs.readFileSync(contentPath, "utf-8");
    } catch {
      return null;
    }
  },

  set(filePath: string, content: string): void {
    try {
      const stat = fs.statSync(filePath);
      const contentPath = cacheContentPath(filePath);
      const metaPath = cacheMetaPath(contentPath);

      fs.mkdirSync(path.dirname(contentPath), { recursive: true });
      fs.writeFileSync(contentPath, content, "utf-8");
      fs.writeFileSync(
        metaPath,
        JSON.stringify({ mtime: stat.mtimeMs }),
        "utf-8",
      );
    } catch {
      // ignore
    }
  },

  invalidate(filePath: string): void {
    try {
      const contentPath = cacheContentPath(filePath);
      const metaPath = cacheMetaPath(contentPath);
      if (fs.existsSync(contentPath)) fs.rmSync(contentPath);
      if (fs.existsSync(metaPath)) fs.rmSync(metaPath);
    } catch {
      // ignore
    }
  },
};
