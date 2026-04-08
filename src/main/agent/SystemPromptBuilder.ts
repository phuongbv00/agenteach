import type { AllMemory, MemoryLayer } from "../memory/MemoryStore";
import type { Workspace } from "../workspace/WorkspaceManager";
import type { Plugin } from "../plugins/PluginLoader";

import identityTpl from "./prompts/identity.md?raw";
import workspaceTpl from "./prompts/workspace.md?raw";
import memoryUpdateTpl from "./prompts/memory-update.md?raw";
import actionPrinciplesTpl from "./prompts/action-principles.md?raw";

function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}

function renderLayer(layer: MemoryLayer, includeUser: boolean): string[] {
  const lines: string[] = [];
  if (includeUser) {
    if (layer.user.name) lines.push(`- Tên: ${layer.user.name}`);
    if (layer.user.subject) lines.push(`- Môn dạy: ${layer.user.subject}`);
    if (layer.user.grades.length)
      lines.push(`- Lớp: ${layer.user.grades.join(", ")}`);
  }
  for (const [k, v] of Object.entries(layer.style)) {
    lines.push(`- Phong cách ${k}: ${v}`);
  }
  if (layer.feedback.length)
    lines.push(`- Lưu ý: ${layer.feedback.join("; ")}`);
  if (layer.context.length)
    lines.push(`- Bối cảnh: ${layer.context.join("; ")}`);
  return lines;
}

export function buildSystemPrompt(
  memory: AllMemory,
  workspace: Workspace,
  activePlugin: Plugin | null = null,
): string {
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

  const globalLines = renderLayer(memory.global, true);
  if (globalLines.length) {
    parts.push(`[MEMORY - Toàn cục]\n${globalLines.join("\n")}`);
  }

  const wsLines = renderLayer(memory.workspace, false);
  if (wsLines.length) {
    parts.push(
      `[MEMORY - Workspace "${workspace.name}"]\n${wsLines.join("\n")}`,
    );
  }

  parts.push(
    fill(workspaceTpl, {
      WORKSPACE_NAME: workspace.name,
      WORKSPACE_PATH: workspace.path,
    }),
  );

  if (activePlugin && activePlugin.type === "skill") {
    parts.push(`[ACTIVE SKILL: ${activePlugin.name}]\n${activePlugin.prompt}`);
  }

  parts.push(memoryUpdateTpl);
  parts.push(actionPrinciplesTpl);

  return parts.join("\n\n");
}
