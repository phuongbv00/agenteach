import fs from 'fs';
import os from 'os';
import path from 'path';

const CACHE_ROOT = path.join(os.homedir(), '.agenteach', '.cache', 'files');

interface CacheMeta {
  mtime: number;
}

function cacheContentPath(filePath: string): string {
  // Strip leading slash so path.join works correctly
  const relative = filePath.startsWith('/') ? filePath.slice(1) : filePath;
  const base = path.join(CACHE_ROOT, relative);
  // Parsed binary formats are stored as Markdown: file.pdf → file.pdf.md
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.pdf' || ext === '.docx') return base + '.md';
  return base;
}

function cacheMetaPath(contentPath: string): string {
  return contentPath + '.meta.json';
}

export const FileCache = {
  async get(filePath: string): Promise<string | null> {
    try {
      const stat = fs.statSync(filePath);
      const mtime = stat.mtimeMs;

      const contentPath = cacheContentPath(filePath);
      const metaPath = cacheMetaPath(contentPath);

      if (!fs.existsSync(contentPath) || !fs.existsSync(metaPath)) return null;

      const meta: CacheMeta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
      if (meta.mtime !== mtime) return null;

      return fs.readFileSync(contentPath, 'utf-8');
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
      fs.writeFileSync(contentPath, content, 'utf-8');
      fs.writeFileSync(metaPath, JSON.stringify({ mtime: stat.mtimeMs }), 'utf-8');
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
