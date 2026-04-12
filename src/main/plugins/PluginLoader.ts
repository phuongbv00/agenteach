import fs from 'fs';
import path from 'path';
import { dataDir } from '../utils/dataDir';

export interface PluginSkill {
  id: string;
  name: string;
  description: string;
  prompt: string;
}

export interface PluginMCP {
  id: string;
  // stdio server
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  // remote server
  url?: string;
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

function skillsDir(): string {
  return dataDir('plugins', 'skills');
}

function mcpDir(): string {
  return dataDir('plugins', 'mcp');
}

function loadSkillsFromDir(dir: string): PluginSkill[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      const content = fs.readFileSync(path.join(dir, f), 'utf-8');
      const { meta, body } = parseFrontmatter(content);
      const id = f.replace('.md', '');
      return {
        id,
        name: String(meta.name ?? id),
        description: String(meta.description ?? ''),
        prompt: body,
      };
    });
}

function loadMcpFromDir(dir: string): PluginMCP[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      const raw = fs.readFileSync(path.join(dir, f), 'utf-8');
      const data = JSON.parse(raw) as Omit<PluginMCP, 'id'>;
      const id = f.replace('.json', '');
      // Always spread `command` key so `'command' in p` reliably identifies MCPs
      return { command: undefined, ...data, id } as PluginMCP;
    });
}

export const PluginLoader = {
  skillsDir(): string { return skillsDir(); },
  mcpDir(): string { return mcpDir(); },

  listSkills(): PluginSkill[] { return loadSkillsFromDir(skillsDir()); },
  listMcp(): PluginMCP[] { return loadMcpFromDir(mcpDir()); },

  saveSkill(plugin: PluginSkill): void {
    const dir = skillsDir();
    fs.mkdirSync(dir, { recursive: true });
    const frontmatter = `name: ${plugin.name}\ndescription: ${plugin.description}`;
    const content = `---\n${frontmatter}\n---\n\n${plugin.prompt}`;
    fs.writeFileSync(path.join(dir, `${plugin.id}.md`), content, 'utf-8');
  },

  saveMcp(plugin: PluginMCP): void {
    const dir = mcpDir();
    fs.mkdirSync(dir, { recursive: true });
    const { id, ...data } = plugin;
    fs.writeFileSync(
      path.join(dir, `${id}.json`),
      JSON.stringify(data, null, 2),
      'utf-8',
    );
  },

  deleteSkill(id: string): void {
    const p = path.join(skillsDir(), `${id}.md`);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  },

  deleteMcp(id: string): void {
    const p = path.join(mcpDir(), `${id}.json`);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  },

  match(skills: PluginSkill[], message: string): PluginSkill | null {
    const lower = message.toLowerCase().trimStart();
    for (const skill of skills) {
      if (lower.startsWith(`/${skill.id}`)) return skill;
    }
    return null;
  },
};
