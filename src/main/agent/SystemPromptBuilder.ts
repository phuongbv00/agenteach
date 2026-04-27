import fs from "fs";
import { MemoryStore } from "../memory/MemoryStore";
import type { Workspace } from "../workspace/WorkspaceManager";

import identityTpl from "./prompts/identity.md?raw";
import workspaceTpl from "./prompts/workspace.md?raw";
import toolsTpl from "./prompts/tools.md?raw";
import memoryUpdateTpl from "./prompts/memory-update.md?raw";
import actionPrinciplesTpl from "./prompts/action-principles.md?raw";

function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}

export function buildSystemPrompt(_memory: string, workspace: Workspace): string {
  const parts: string[] = [];

  parts.push(
    fill(identityTpl, {
      DATE: new Date().toLocaleDateString("vi-VN", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    }),
  );

  try {
    const mdPath = MemoryStore.mdPath();
    if (fs.existsSync(mdPath)) {
      const content = fs.readFileSync(mdPath, 'utf-8');
      if (content.trim()) {
        parts.push(`[MEMORY]\n${content.trim()}`);
      }
    }
  } catch (err) {
    console.error("Failed to read memory index.md", err);
  }

  parts.push(
    fill(workspaceTpl, {
      WORKSPACE_NAME: workspace.name,
      WORKSPACE_PATH: workspace.path.replace(/\\/g, "/"),
    }),
  );

  parts.push(toolsTpl);
  parts.push(memoryUpdateTpl);
  parts.push(actionPrinciplesTpl);

  return parts.join("\n\n");
}
