import { tool, zodSchema } from 'ai';
import { z } from 'zod';
import { MemoryStore } from '../../memory/MemoryStore';
import { BrowserWindow } from 'electron';

const memoryInputSchema = z.object({
  action: z.enum(['append', 'replace']).describe('Gắn thêm (append) hoặc ghi đè toàn bộ (replace) memory'),
  content: z.string().describe('Nội dung markdown cần lưu cho bộ nhớ'),
});

type MemoryInput = z.infer<typeof memoryInputSchema>;

export function createMemoryTool(win?: BrowserWindow) {
  return tool({
    description: 'Cập nhật bộ nhớ chung. Chỉ gồm markdown',
    inputSchema: zodSchema(memoryInputSchema),
    execute: async (input: MemoryInput) => {
      if (input.action === 'append') {
        MemoryStore.append(input.content);
      } else {
        MemoryStore.update(input.content);
      }

      if (win) {
        win.webContents.send('memory:updated');
      }

      return `Đã cập nhật bộ nhớ.`;
    },
  });
}
