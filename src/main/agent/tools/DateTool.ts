import { tool, zodSchema } from 'ai';
import { z } from 'zod';

export const date_tool = tool({
  description: 'Lấy ngày giờ hiện tại',
  inputSchema: zodSchema(z.object({})),
  execute: async () => {
    const now = new Date();
    return now.toLocaleDateString('vi-VN', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
  },
});
