import { Tool, tool, zodSchema } from "ai";
import { z } from "zod";
import { PluginLoader } from "../../plugins/PluginLoader";
import type { ToolsMetaMap } from "./meta";

/**
 * Dynamically creates one tool per installed skill + a general find_skills tool.
 * The specific tools' descriptions = skill.description, so the LLM can decide
 * which skill to invoke based on the user's request.
 *
 * plugin_find_skills is kept for discovery or lazy-loading discovery in the future.
 */
export function createPluginTools() {
  const skills = PluginLoader.listSkills();

  const tools: Record<string, Tool> = {
    plugin_find_skills: tool({
      description:
        "Tìm các skill phù hợp với yêu cầu hiện tại và trả về hướng dẫn chi tiết để thực thi. Gọi tool này khi cảm thấy có thể có skill hỗ trợ task nhưng không chắc chắn tên skill.",
      inputSchema: zodSchema(
        z.object({
          query: z
            .string()
            .describe("Mô tả ngắn về yêu cầu cần tìm skill phù hợp"),
        }),
      ),
      execute: async (input: { query: string }) => {
        const skills = PluginLoader.listSkills();
        if (skills.length === 0) return "Không có skill nào được cài đặt.";

        const queryLower = input.query.toLowerCase();
        const scored = skills.map((skill) => {
          let score = 0;
          if (queryLower.startsWith(`/${skill.id}`)) score += 3;
          if (queryLower.includes(skill.name.toLowerCase())) score += 2;
          if (queryLower.includes(skill.description.toLowerCase())) score += 1;
          return { skill, score };
        });

        const relevant = scored
          .filter((s) => s.score > 0)
          .sort((a, b) => b.score - a.score);
        const toShow =
          relevant.length > 0 ? relevant.map((s) => s.skill) : skills;

        return toShow
          .map((s) => `## Skill: ${s.name}\n${s.prompt}`)
          .join("\n\n---\n\n");
      },
    }),
  };

  const meta: ToolsMetaMap = {
    plugin_find_skills: { label: (args) => `Tìm skill: "${args.query ?? ""}"` },
  };

  for (const skill of skills) {
    // Tool name must be a valid identifier — replace hyphens with underscores
    const toolName = `plugin_skill_${skill.id.replace(/-/g, "_")}`;

    tools[toolName] = tool({
      description: skill.description,
      inputSchema: zodSchema(z.object({})),
      execute: async () => {
        console.log(`[skill] Tool called: ${skill.id}`);
        return `[SKILL: ${skill.name}]\n\n${skill.prompt}`;
      },
    });

    meta[toolName] = {
      label: () => `Skill: ${skill.name}`,
    };
  }

  return { tools, meta };
}
