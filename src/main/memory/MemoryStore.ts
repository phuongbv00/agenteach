import fs from 'fs';
import path from 'path';
import { dataDir } from '../utils/dataDir';

export const MemoryStore = {
  mdPath(): string {
    return dataDir('memory', 'index.md');
  },

  load(): string {
    try {
      const mdPath = this.mdPath();
      if (!fs.existsSync(mdPath)) {
        return "";
      }
      return fs.readFileSync(mdPath, 'utf-8');
    } catch {
      return "";
    }
  },

  save(content: string): void {
    const mdPath = this.mdPath();
    fs.mkdirSync(path.dirname(mdPath), { recursive: true });
    fs.writeFileSync(mdPath, content, 'utf-8');
  },

  update(content: string): string {
    this.save(content);
    return content;
  },

  append(content: string): string {
    const current = this.load();
    const updated = current ? `${current}\n\n${content}` : content;
    this.save(updated);
    return updated;
  }
};
