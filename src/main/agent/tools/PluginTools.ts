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
        "Tìm các skill phù hợp với yêu cầu hoặc lấy hướng dẫn của một skill cụ thể qua ID. Gọi tool này khi cần khám phá các khả năng hỗ trợ hoặc muốn lấy prompt chi tiết của một skill đã biết.",
      inputSchema: zodSchema(
        z.object({
          query: z
            .string()
            .optional()
            .describe("Mô tả ngắn về yêu cầu cần tìm skill phù hợp"),
          skill_id: z
            .string()
            .optional()
            .describe("ID chính xác của skill (ví dụ: 'create-exercises')"),
        }),
      ),
      execute: async (input: { query?: string; skill_id?: string }) => {
        const skills = PluginLoader.listSkills();
        if (skills.length === 0) return "Không có skill nào được cài đặt.";

        // Priority 1: Exact ID match
        if (input.skill_id) {
          const s = skills.find((s) => s.id === input.skill_id);
          if (s) return `## Skill: ${s.name}\n${s.prompt}`;
          return `Không tìm thấy skill có ID là "${input.skill_id}".`;
        }

        // Priority 2: Search by query
        const queryLower = (input.query ?? "").toLowerCase();
        if (!queryLower) {
          return skills
            .map((s) => `- \`/${s.id}\`: ${s.name} - ${s.description}`)
            .join("\n");
        }

        const scored = skills.map((skill) => {
          let score = 0;
          if (queryLower === skill.id.toLowerCase()) score += 10;
          if (queryLower.includes(skill.id.toLowerCase())) score += 5;
          if (queryLower.includes(skill.name.toLowerCase())) score += 3;
          if (queryLower.includes(skill.description.toLowerCase())) score += 1;
          return { skill, score };
        });

        const relevant = scored
          .filter((s) => s.score > 0)
          .sort((a, b) => b.score - a.score);

        if (relevant.length === 0) return "Không tìm thấy skill nào phù hợp.";

        return relevant
          .map((s) => `## Skill: ${s.skill.name}\n${s.skill.prompt}`)
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
        return skill.prompt;
      },
    });

    meta[toolName] = {
      label: () => `Skill: ${skill.name}`,
    };
  }

  return { tools, meta };
}
