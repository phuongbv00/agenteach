import { tool, zodSchema } from 'ai';
import { z } from 'zod';
import { MemoryStore } from '../../memory/MemoryStore';

const memoryInputSchema = z.object({
  layer: z.enum(['global', 'workspace']).describe('Lớp memory: global (áp dụng toàn bộ) / workspace (áp dụng trong workspace này)'),
  type: z.enum(['user', 'style', 'feedback', 'context']).describe('Loại thông tin'),
  content: z.string().describe('Nội dung cần ghi nhớ'),
  key: z.string().optional().describe('Key cho style (VD: "lesson_plan_format")'),
});

type MemoryInput = z.infer<typeof memoryInputSchema>;

export function createMemoryTool(workspaceId: string) {
  return tool({
    description: 'Ghi nhớ thông tin quan trọng vào memory: global (áp dụng toàn bộ) hoặc workspace (áp dụng trong workspace này)',
    inputSchema: zodSchema(memoryInputSchema),
    execute: async (input: MemoryInput) => {
      const { layer, type, content, key } = input;
      const patch = buildPatch(type, content, key, workspaceId, layer);

      if (layer === 'global') {
        MemoryStore.updateGlobal(patch);
      } else {
        MemoryStore.updateWorkspace(workspaceId, patch);
      }

      return `Đã ghi nhớ (${layer}/${type}).`;
    },
  });
}

function buildPatch(
  type: 'user' | 'style' | 'feedback' | 'context',
  content: string,
  key: string | undefined,
  workspaceId: string,
  layer: string,
): Record<string, unknown> {
  const current = layer === 'global'
    ? MemoryStore.loadGlobal()
    : MemoryStore.loadWorkspace(workspaceId);

  if (type === 'feedback') {
    return { feedback: [...current.feedback.slice(-9), content] };
  }
  if (type === 'context') {
    return { context: [...current.context.slice(-4), content] };
  }
  if (type === 'style' && key) {
    return { style: { ...current.style, [key]: content } };
  }
  if (type === 'user') {
    const [k, ...rest] = content.split(':');
    if (k && rest.length) {
      return { user: { ...current.user, [k.trim()]: rest.join(':').trim() } };
    }
  }
  return {};
}
