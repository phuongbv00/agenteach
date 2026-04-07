import fs from 'fs';
import path from 'path';
import { dataDir } from '../utils/dataDir';

export interface Plugin {
  name: string;
  description: string;
  triggers: string[];
  prompt: string;
}

function parseFrontmatter(content: string): { meta: Record<string, string | string[]>; body: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { meta: {}, body: content };

  const meta: Record<string, string | string[]> = {};
  for (const line of match[1].split('\n')) {
    const [k, ...rest] = line.split(':');
    if (!k) continue;
    const val = rest.join(':').trim();
    // triggers: ["/giao-an", "soạn giáo án"]
    if (val.startsWith('[')) {
      meta[k.trim()] = val
        .slice(1, -1)
        .split(',')
        .map((s) => s.trim().replace(/^["']|["']$/g, ''));
    } else {
      meta[k.trim()] = val;
    }
  }
  return { meta, body: match[2].trim() };
}

function loadFromDir(dir: string): Plugin[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      const content = fs.readFileSync(path.join(dir, f), 'utf-8');
      const { meta, body } = parseFrontmatter(content);
      return {
        name: String(meta.name ?? f.replace('.md', '')),
        description: String(meta.description ?? ''),
        triggers: Array.isArray(meta.triggers)
          ? (meta.triggers as string[])
          : meta.triggers
          ? [String(meta.triggers)]
          : [],
        prompt: body,
      };
    });
}

export const PluginLoader = {
  load(workspacePath?: string): Plugin[] {
    const globalDir = dataDir('plugins');
    const plugins = loadFromDir(globalDir);
    if (workspacePath) {
      const localDir = path.join(workspacePath, '.plugins');
      plugins.push(...loadFromDir(localDir));
    }
    return plugins;
  },

  match(plugins: Plugin[], message: string): Plugin | null {
    const lower = message.toLowerCase();
    for (const plugin of plugins) {
      for (const trigger of plugin.triggers) {
        if (trigger.startsWith('/')) {
          if (lower.startsWith(trigger.toLowerCase())) return plugin;
        } else {
          if (lower.includes(trigger.toLowerCase())) return plugin;
        }
      }
    }
    return null;
  },
};
