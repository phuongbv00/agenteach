import fs from 'fs';
import path from 'path';
import { dataDir } from '../utils/dataDir';

export interface Plugin {
  id: string;
  type: 'skill' | 'mcp';
  name: string;
  description: string;
  // skill-specific
  triggers: string[];
  prompt: string;
  // mcp-specific
  command?: string;
  args?: string[];
}

function parseFrontmatter(content: string): { meta: Record<string, string | string[]>; body: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { meta: {}, body: content };

  const meta: Record<string, string | string[]> = {};
  for (const line of match[1].split('\n')) {
    const [k, ...rest] = line.split(':');
    if (!k) continue;
    const val = rest.join(':').trim();
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

function pluginDir(): string {
  return dataDir('plugins');
}

function loadFromDir(dir: string): Plugin[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      const content = fs.readFileSync(path.join(dir, f), 'utf-8');
      const { meta, body } = parseFrontmatter(content);
      const id = f.replace('.md', '');
      const type = (meta.type === 'mcp' ? 'mcp' : 'skill') as Plugin['type'];
      return {
        id,
        type,
        name: String(meta.name ?? id),
        description: String(meta.description ?? ''),
        triggers: Array.isArray(meta.triggers)
          ? (meta.triggers as string[])
          : meta.triggers
          ? [String(meta.triggers)]
          : [],
        prompt: body,
        command: meta.command ? String(meta.command) : undefined,
        args: Array.isArray(meta.args)
          ? (meta.args as string[])
          : meta.args
          ? [String(meta.args)]
          : undefined,
      };
    });
}

export const PluginLoader = {
  load(): Plugin[] {
    return loadFromDir(pluginDir());
  },

  pluginDir(): string {
    return pluginDir();
  },

  save(plugin: Omit<Plugin, never>): void {
    const dir = pluginDir();
    fs.mkdirSync(dir, { recursive: true });
    let frontmatter = `type: ${plugin.type}\nname: ${plugin.name}\ndescription: ${plugin.description}`;
    if (plugin.type === 'skill') {
      const triggersStr = plugin.triggers.map((t) => `"${t}"`).join(', ');
      frontmatter += `\ntriggers: [${triggersStr}]`;
    } else {
      if (plugin.command) frontmatter += `\ncommand: ${plugin.command}`;
      if (plugin.args?.length) {
        const argsStr = plugin.args.map((a) => `"${a}"`).join(', ');
        frontmatter += `\nargs: [${argsStr}]`;
      }
    }
    const content = `---\n${frontmatter}\n---\n\n${plugin.prompt ?? ''}`;
    fs.writeFileSync(path.join(dir, `${plugin.id}.md`), content, 'utf-8');
  },

  delete(pluginId: string): void {
    const filePath = path.join(pluginDir(), `${pluginId}.md`);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  },

  match(plugins: Plugin[], message: string): Plugin | null {
    const lower = message.toLowerCase();
    for (const plugin of plugins) {
      if (plugin.type !== 'skill') continue;
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
