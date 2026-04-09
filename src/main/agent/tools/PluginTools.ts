import { tool, zodSchema } from "ai";
import { z } from "zod";
import { PluginLoader } from "../../plugins/PluginLoader";
import type { ToolsMetaMap } from "./meta";

export function createPluginTools() {
  const tools = {
    plugin_find_skills: tool({
      description:
        "Tìm các skill phù hợp với yêu cầu hiện tại và trả về hướng dẫn chi tiết để thực thi. Gọi tool này khi cảm thấy có thể có skill hỗ trợ task, sau đó làm theo hướng dẫn trả về.",
      inputSchema: zodSchema(
        z.object({
          query: z
            .string()
            .describe("Mô tả ngắn về yêu cầu cần tìm skill phù hợp"),
        }),
      ),
      execute: async (input: { query: string }) => {
        const allPlugins = PluginLoader.load();
        const skills = allPlugins.filter((p) => p.type === "skill");
        if (skills.length === 0) return "Không có skill nào được cài đặt.";

        const queryLower = input.query.toLowerCase();
        const scored = skills.map((skill) => {
          let score = 0;
          for (const trigger of skill.triggers) {
            const t = trigger.toLowerCase();
            if (t.startsWith("/")) {
              if (queryLower.startsWith(t)) score += 3;
            } else {
              if (queryLower.includes(t)) score += 2;
            }
          }
          if (queryLower.includes(skill.name.toLowerCase())) score += 1;
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

  return { tools, meta };
}
