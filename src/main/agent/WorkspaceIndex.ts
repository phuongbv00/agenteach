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

  constructor(private readonly wsPath: string) {}

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
      const full = path.join(dir, e.name);
      const rel = path.relative(this.wsPath, full);
      this.entries.push({ name: e.name, rel, isDir: e.isDirectory() });
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

  /** Tìm file/folder theo tên (substring, case-insensitive) */
  find(query: string): IndexEntry[] {
    const lq = query.toLowerCase();
    return this.entries.filter(e => e.name.toLowerCase().includes(lq));
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
