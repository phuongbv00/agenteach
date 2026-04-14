import { tool, zodSchema } from "ai";
import { z } from "zod";
import { MemoryStore } from "../../memory/MemoryStore";
import { BrowserWindow } from "electron";
import type { ToolsMetaMap } from "./meta";
import { staticLabels } from "./labels";

const memoryInputSchema = z.object({
  content: z
    .string()
    .describe("Toàn bộ nội dung memory mới (Markdown đầy đủ, ghi đè bản cũ)"),
});

type MemoryInput = z.infer<typeof memoryInputSchema>;

export function createMemoryTools(win?: BrowserWindow) {
  const tools = {
    memory_update: tool({
      description:
        "Ghi đè toàn bộ memory. Trước khi gọi, PHẢI đọc memory hiện tại từ system prompt [MEMORY], giữ lại mọi thông tin cũ, rồi ghi lại bản đầy đủ đã cập nhật.",
      inputSchema: zodSchema(memoryInputSchema),
      execute: async (input: MemoryInput) => {
        MemoryStore.save(input.content);
        if (win) win.webContents.send("memory:updated");
        return "Đã cập nhật bộ nhớ.";
      },
    }),
  };

  const meta: ToolsMetaMap = {
    memory_update: { label: staticLabels.memory_update },
  };

  return { tools, meta };
}
