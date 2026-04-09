import { tool, zodSchema } from "ai";
import { z } from "zod";
import type { ToolsMetaMap } from "./meta";

export default function createTimeTools(): { tools: ReturnType<typeof buildTools>; meta: ToolsMetaMap } {
  const tools = buildTools();
  const meta: ToolsMetaMap = {
    time_now: { label: () => "Lấy ngày hôm nay" },
  };
  return { tools, meta };
}

function buildTools() {
  return {
    time_now: tool({
      description: "Lấy ngày giờ hiện tại",
      inputSchema: zodSchema(z.object({})),
      execute: async () => {
        const now = new Date();
        return now.toLocaleDateString("vi-VN", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        });
      },
    }),
  };
}
