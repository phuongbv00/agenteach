import { Tool, tool, zodSchema } from "ai";
import { z } from "zod";
import { PluginLoader } from "../../plugins/PluginLoader";
import type { ToolsMetaMap } from "./meta";

export function createPluginTools() {
  const skills = PluginLoader.listSkills();

  const tools: Record<string, Tool> = {};
  const meta: ToolsMetaMap = {};

  for (const skill of skills) {
    // Tool name must be a valid identifier — replace hyphens with underscores
    const toolName = `plugin_skill_${skill.id.replace(/-/g, "_")}`;

    tools[toolName] = tool({
      description: skill.description,
      inputSchema: zodSchema(z.object({})),
      execute: async () => {
        return skill.prompt;
      },
    });

    meta[toolName] = {
      label: () => `Skill: ${skill.name}`,
    };
  }

  return { tools, meta };
}
