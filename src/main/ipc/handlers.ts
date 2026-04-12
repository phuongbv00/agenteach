import fs from "fs";
import { ipcMain, dialog, BrowserWindow, shell } from "electron";
import { logFilePath } from "../utils/logger";
import mammoth from "mammoth";
import { appConfig } from "../config/AppConfig";
import { checkProviderHealth, listModels } from "../llm/LLMClient";
import { tryStartOllama } from "../llm/OllamaLauncher";
import type { AIProvider } from "../config/AppConfig";
import { WorkspaceManager } from "../workspace/WorkspaceManager";
import { MemoryStore } from "../memory/MemoryStore";
import { PluginLoader } from "../plugins/PluginLoader";
import { SessionStore } from "../sessions/SessionStore";
import { ArtifactStore } from "../sessions/ArtifactStore";
import { runAgent, cancelAgent } from "../agent/Orchestrator";
import type { ChatMessage } from "../agent/Orchestrator";

export function registerHandlers(win: BrowserWindow): void {
  // System
  ipcMain.handle("system:getConfig", () => appConfig.get());
  ipcMain.handle(
    "system:updateConfig",
    (_e, patch: Parameters<typeof appConfig.update>[0]) => {
      appConfig.update(patch);
    },
  );
  ipcMain.handle("system:selectModel", (_e, model: string) => {
    appConfig.update({ selectedModel: model });
  });

  // Provider management
  ipcMain.handle("provider:check", async (_e, provider: AIProvider) => {
    if (provider.id === "ollama-local") await tryStartOllama();
    return checkProviderHealth(provider);
  });
  ipcMain.handle("provider:listModels", (_e, provider: AIProvider) =>
    listModels(provider),
  );
  ipcMain.handle("provider:save", (_e, provider: AIProvider) => {
    const cfg = appConfig.get();
    const existing = cfg.providers.findIndex((p) => p.id === provider.id);
    const providers =
      existing >= 0
        ? cfg.providers.map((p) => (p.id === provider.id ? provider : p))
        : [...cfg.providers, provider];
    appConfig.update({ providers });
  });
  ipcMain.handle("provider:delete", (_e, id: string) => {
    const cfg = appConfig.get();
    const providers = cfg.providers.filter((p) => p.id !== id);
    const activeProviderId =
      cfg.activeProviderId === id
        ? (providers[0]?.id ?? null)
        : cfg.activeProviderId;
    appConfig.update({ providers, activeProviderId });
  });
  ipcMain.handle("provider:setActive", (_e, id: string) => {
    appConfig.update({ activeProviderId: id });
  });

  // Backward-compat shims
  ipcMain.handle("system:checkOllama", (_e, url?: string) => {
    const provider: AIProvider = {
      id: "",
      name: "",
      baseUrl: (url ?? "http://localhost:11434") + "/v1",
      apiKey: "",
    };
    return checkProviderHealth(url ? provider : undefined);
  });
  ipcMain.handle("system:listModels", () => listModels());
  ipcMain.handle("system:setOllamaUrl", (_e, url: string) => {
    const cfg = appConfig.get();
    const providers = cfg.providers.map((p) =>
      p.id === "ollama-local"
        ? { ...p, baseUrl: url.replace(/\/v1\/?$/, "") + "/v1" }
        : p,
    );
    appConfig.update({ providers });
  });

  // Agent
  ipcMain.handle(
    "agent:sendMessage",
    async (_e, messages: ChatMessage[], sessionId?: string, model?: string) => {
      await runAgent(messages, win, sessionId, model);
    },
  );
  ipcMain.handle("agent:cancel", () => cancelAgent());

  // Workspace
  ipcMain.handle("workspace:list", () => WorkspaceManager.list());
  ipcMain.handle(
    "workspace:create",
    async (_e, name: string, folderPath?: string) => {
      let targetPath = folderPath;
      if (!targetPath) {
        const result = await dialog.showOpenDialog(win, {
          properties: ["openDirectory"],
          title: "Chọn thư mục workspace",
        });
        if (result.canceled || !result.filePaths[0]) return null;
        targetPath = result.filePaths[0];
      }
      const ws = await WorkspaceManager.create(name, targetPath);
      appConfig.update({ activeWorkspaceId: ws.id });
      return ws;
    },
  );
  ipcMain.handle("workspace:setActive", async (_e, id: string) => {
    await WorkspaceManager.touch(id);
    appConfig.update({ activeWorkspaceId: id });
  });
  ipcMain.handle("workspace:delete", async (_e, id: string) => {
    await WorkspaceManager.delete(id);
    const config = appConfig.get();
    if (config.activeWorkspaceId === id) {
      const remaining = await WorkspaceManager.list();
      appConfig.update({ activeWorkspaceId: remaining[0]?.id ?? null });
    }
  });

  // Sessions
  ipcMain.handle("session:list", (_e, workspaceId: string) => {
    return SessionStore.list(workspaceId);
  });
  ipcMain.handle("session:create", (_e, workspaceId: string) => {
    return SessionStore.create(workspaceId);
  });
  ipcMain.handle(
    "session:rename",
    async (_e, workspaceId: string, sessionId: string, name: string) => {
      await SessionStore.rename(workspaceId, sessionId, name);
    },
  );
  ipcMain.handle(
    "session:delete",
    async (_e, workspaceId: string, sessionId: string) => {
      await SessionStore.delete(workspaceId, sessionId);
    },
  );
  ipcMain.handle(
    "session:loadMessages",
    (_e, workspaceId: string, sessionId: string) => {
      return SessionStore.loadMessages(workspaceId, sessionId);
    },
  );
  ipcMain.handle(
    "session:saveMessages",
    async (
      _e,
      workspaceId: string,
      sessionId: string,
      items: Parameters<typeof SessionStore.saveMessages>[2],
    ) => {
      await SessionStore.saveMessages(workspaceId, sessionId, items);
    },
  );

  // Memory
  ipcMain.handle("memory:get", () => {
    return MemoryStore.load();
  });
  ipcMain.handle("memory:update", (_e, content: string) => {
    MemoryStore.save(content);
    win.webContents.send("memory:updated");
    return content;
  });

  // Artifacts
  ipcMain.handle(
    "artifact:list",
    (_e, workspaceId: string, sessionId: string) => {
      return ArtifactStore.list(workspaceId, sessionId);
    },
  );
  ipcMain.handle(
    "artifact:delete",
    async (_e, workspaceId: string, sessionId: string, artifactId: string) => {
      await ArtifactStore.delete(workspaceId, sessionId, artifactId);
    },
  );

  // File read helpers for preview
  ipcMain.handle("file:readText", (_e, filePath: string) => {
    return fs.readFileSync(filePath, "utf-8");
  });
  ipcMain.handle("file:readBinary", (_e, filePath: string) => {
    return fs.readFileSync(filePath); // serialized as Buffer/Uint8Array
  });
  ipcMain.handle("file:readDocxHtml", async (_e, filePath: string) => {
    const result = await mammoth.convertToHtml({ path: filePath });
    return result.value;
  });

  // Open file with system default app
  ipcMain.handle("shell:openFile", async (_e, filePath: string) => {
    await shell.openPath(filePath);
  });

  // Show file in folder
  ipcMain.handle("shell:showInFolder", (_e, filePath: string) => {
    shell.showItemInFolder(filePath);
  });

  // Plugins
  ipcMain.handle("plugins:list", () => {
    return PluginLoader.load();
  });
  ipcMain.handle(
    "plugins:save",
    (_e, plugin: Parameters<typeof PluginLoader.save>[0]) => {
      PluginLoader.save(plugin);
    },
  );
  ipcMain.handle("plugins:delete", (_e, pluginId: string) => {
    PluginLoader.delete(pluginId);
  });
  ipcMain.handle("plugins:openDir", () => {
    const dir = PluginLoader.pluginDir();
    fs.mkdirSync(dir, { recursive: true });
    shell.openPath(dir);
  });

  // Logs
  ipcMain.handle("system:exportLogs", async () => {
    const src = logFilePath();
    const { filePath, canceled } = await dialog.showSaveDialog(win, {
      title: "Lưu file log",
      defaultPath: "agenteach-logs.log",
      filters: [{ name: "Log files", extensions: ["log", "txt"] }],
    });
    if (canceled || !filePath) return false;
    fs.copyFileSync(src, filePath);
    shell.showItemInFolder(filePath);
    return true;
  });
}
