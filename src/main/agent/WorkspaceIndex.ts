import fs from 'fs';
import path from 'path';

export interface IndexEntry {
  name: string;
  rel: string;      // relative path from workspace root, no trailing slash
  isDir: boolean;
}

export class WorkspaceIndex {
  private entries: IndexEntry[] = [];
  private watcher: fs.FSWatcher | null = null;
  private rebuildTimer: ReturnType<typeof setTimeout> | null = null;

  // macOS APFS: NFD; Windows NTFS: NFC (stores as-is, keyboard input is NFC)
  private static readonly PATH_NORM: "NFD" | "NFC" =
    process.platform === "darwin" ? "NFD" : "NFC";

  constructor(private readonly wsPath: string) {
    this.wsPath = wsPath.normalize(WorkspaceIndex.PATH_NORM);
  }

  build(): void {
    this.entries = [];
    this._walk(this.wsPath, 0);
  }

  private _walk(dir: string, depth: number): void {
    if (depth > 10) return;
    let dirents: fs.Dirent[];
    try {
      dirents = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of dirents) {
      if (e.name.startsWith('.')) continue;
      const name = e.name.normalize(WorkspaceIndex.PATH_NORM);
      const full = path.join(dir, name);
      const rel = path.relative(this.wsPath, full);
      this.entries.push({ name, rel, isDir: e.isDirectory() });
      if (e.isDirectory()) {
        this._walk(full, depth + 1);
      }
    }
  }

  watch(): void {
    try {
      this.watcher = fs.watch(this.wsPath, { recursive: true }, () => {
        if (this.rebuildTimer) clearTimeout(this.rebuildTimer);
        this.rebuildTimer = setTimeout(() => this.build(), 300);
      });
    } catch {
      // fs.watch recursive not supported on some systems, index won't auto-update
    }
  }

  stop(): void {
    this.watcher?.close();
    this.watcher = null;
    if (this.rebuildTimer) {
      clearTimeout(this.rebuildTimer);
      this.rebuildTimer = null;
    }
  }

  /** Bỏ dấu tiếng Việt để so khớp không dấu (VD: "giao an" → "giao an", "giáo án" → "giao an") */
  private static stripDiacritics(s: string): string {
    return s.normalize('NFD').replace(/\p{M}/gu, '')
  }

  /** Tìm file/folder theo tên (token-based, case-insensitive, hỗ trợ không dấu tiếng Việt).
   *  Query được tách thành các từ; tên file được normalize (-, _, . → space).
   *  Ưu tiên: khớp chính xác (có dấu) > khớp không dấu > khớp một phần có dấu > khớp một phần không dấu. */
  find(query: string): IndexEntry[] {
    const normalize = (s: string) => s.normalize('NFC').toLowerCase().replace(/[-_.]/g, ' ');
    const loose = (s: string) => WorkspaceIndex.stripDiacritics(normalize(s));

    const tokens = normalize(query).split(/\s+/).filter(Boolean);
    const looseTokens = loose(query).split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return [];

    const allStrict: IndexEntry[] = [];
    const allLoose: IndexEntry[] = [];
    const anyStrict: IndexEntry[] = [];
    const anyLoose: IndexEntry[] = [];

    for (const e of this.entries) {
      const norm = normalize(e.name);
      const looseNorm = loose(e.name);
      const strictCount = tokens.filter(t => norm.includes(t)).length;
      const looseCount = looseTokens.filter(t => looseNorm.includes(t)).length;

      if (strictCount === tokens.length) allStrict.push(e);
      else if (looseCount === looseTokens.length) allLoose.push(e);
      else if (strictCount > 0) anyStrict.push(e);
      else if (looseCount > 0) anyLoose.push(e);
    }

    return [...allStrict, ...allLoose, ...anyStrict, ...anyLoose];
  }

  /** Liệt kê con trực tiếp của một thư mục */
  listDir(dirRel: string): IndexEntry[] {
    const parentNorm = !dirRel || dirRel === '.' ? '.' : dirRel;
    return this.entries.filter(e => path.dirname(e.rel) === parentNorm);
  }

  /** Liệt kê đệ quy tất cả mục trong một thư mục */
  listRecursive(dirRel: string): IndexEntry[] {
    if (!dirRel || dirRel === '.') return [...this.entries];
    const prefix = dirRel + path.sep;
    return this.entries.filter(e => e.rel.startsWith(prefix));
  }

  /** Lấy tất cả file (không phải thư mục) */
  getFiles(): IndexEntry[] {
    return this.entries.filter(e => !e.isDir);
  }
}

const _indexes = new Map<string, WorkspaceIndex>();

export function getWorkspaceIndex(workspaceId: string, wsPath: string): WorkspaceIndex {
  let idx = _indexes.get(workspaceId);
  if (!idx) {
    idx = new WorkspaceIndex(wsPath);
    idx.build();
    idx.watch();
    _indexes.set(workspaceId, idx);
  }
  return idx;
}

export function disposeWorkspaceIndex(workspaceId: string): void {
  const idx = _indexes.get(workspaceId);
  if (idx) {
    idx.stop();
    _indexes.delete(workspaceId);
  }
}
