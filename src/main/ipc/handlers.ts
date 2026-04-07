import fs from 'fs';
import { ipcMain, dialog, BrowserWindow, shell } from 'electron';
import mammoth from 'mammoth';
import { appConfig } from '../config/AppConfig';
import { checkProviderHealth, listModels } from '../llm/LLMClient';
import type { AIProvider } from '../config/AppConfig';
import { WorkspaceManager } from '../workspace/WorkspaceManager';
import { MemoryStore } from '../memory/MemoryStore';
import { PluginLoader } from '../plugins/PluginLoader';
import { SessionStore } from '../sessions/SessionStore';
import { ArtifactStore } from '../sessions/ArtifactStore';
import { runAgent, cancelAgent } from '../agent/Orchestrator';
import type { ChatMessage } from '../agent/Orchestrator';

export function registerHandlers(win: BrowserWindow): void {
  // System
  ipcMain.handle('system:getConfig', () => appConfig.get());
  ipcMain.handle('system:updateConfig', (_e, patch: Parameters<typeof appConfig.update>[0]) => {
    appConfig.update(patch);
  });
  ipcMain.handle('system:selectModel', (_e, model: string) => {
    appConfig.update({ selectedModel: model });
  });

  // Provider management
  ipcMain.handle('provider:check', (_e, provider: AIProvider) => checkProviderHealth(provider));
  ipcMain.handle('provider:listModels', (_e, provider: AIProvider) => listModels(provider));
  ipcMain.handle('provider:save', (_e, provider: AIProvider) => {
    const cfg = appConfig.get();
    const existing = cfg.providers.findIndex((p) => p.id === provider.id);
    const providers = existing >= 0
      ? cfg.providers.map((p) => p.id === provider.id ? provider : p)
      : [...cfg.providers, provider];
    appConfig.update({ providers });
  });
  ipcMain.handle('provider:delete', (_e, id: string) => {
    const cfg = appConfig.get();
    const providers = cfg.providers.filter((p) => p.id !== id);
    const activeProviderId = cfg.activeProviderId === id ? (providers[0]?.id ?? null) : cfg.activeProviderId;
    appConfig.update({ providers, activeProviderId });
  });
  ipcMain.handle('provider:setActive', (_e, id: string) => {
    appConfig.update({ activeProviderId: id });
  });

  // Backward-compat shims
  ipcMain.handle('system:checkOllama', (_e, url?: string) => {
    const provider: AIProvider = { id: '', name: '', baseUrl: (url ?? 'http://localhost:11434') + '/v1', apiKey: '' };
    return checkProviderHealth(url ? provider : undefined);
  });
  ipcMain.handle('system:listModels', () => listModels());
  ipcMain.handle('system:setOllamaUrl', (_e, url: string) => {
    const cfg = appConfig.get();
    const providers = cfg.providers.map((p) =>
      p.id === 'ollama-local' ? { ...p, baseUrl: url.replace(/\/v1\/?$/, '') + '/v1' } : p
    );
    appConfig.update({ providers });
  });

  // Agent
  ipcMain.handle('agent:sendMessage', async (_e, messages: ChatMessage[], sessionId?: string) => {
    await runAgent(messages, win, sessionId);
  });
  ipcMain.handle('agent:cancel', () => cancelAgent());

  // Workspace
  ipcMain.handle('workspace:list', () => WorkspaceManager.list());
  ipcMain.handle('workspace:create', async (_e, name: string, folderPath?: string) => {
    let targetPath = folderPath;
    if (!targetPath) {
      const result = await dialog.showOpenDialog(win, {
        properties: ['openDirectory'],
        title: 'Chọn thư mục workspace',
      });
      if (result.canceled || !result.filePaths[0]) return null;
      targetPath = result.filePaths[0];
    }
    const ws = WorkspaceManager.create(name, targetPath);
    appConfig.update({ activeWorkspaceId: ws.id });
    // Seed global memory with teacher profile saved during setup (once, if not yet set)
    const cfg = appConfig.get();
    if (cfg.teacherName && !MemoryStore.loadGlobal().user.name) {
      MemoryStore.updateGlobal({
        user: { name: cfg.teacherName, subject: cfg.subject, grades: [] },
      });
    }
    return ws;
  });
  ipcMain.handle('workspace:setActive', (_e, id: string) => {
    WorkspaceManager.touch(id);
    appConfig.update({ activeWorkspaceId: id });
  });
  ipcMain.handle('workspace:delete', (_e, id: string) => {
    WorkspaceManager.delete(id);
    const config = appConfig.get();
    if (config.activeWorkspaceId === id) {
      const remaining = WorkspaceManager.list();
      appConfig.update({ activeWorkspaceId: remaining[0]?.id ?? null });
    }
  });

  // Sessions
  ipcMain.handle('session:list', (_e, workspaceId: string) => {
    return SessionStore.list(workspaceId);
  });
  ipcMain.handle('session:create', (_e, workspaceId: string) => {
    return SessionStore.create(workspaceId);
  });
  ipcMain.handle('session:rename', (_e, workspaceId: string, sessionId: string, name: string) => {
    SessionStore.rename(workspaceId, sessionId, name);
  });
  ipcMain.handle('session:delete', (_e, workspaceId: string, sessionId: string) => {
    SessionStore.delete(workspaceId, sessionId);
  });
  ipcMain.handle('session:loadMessages', (_e, workspaceId: string, sessionId: string) => {
    return SessionStore.loadMessages(workspaceId, sessionId);
  });
  ipcMain.handle('session:saveMessages', (_e, workspaceId: string, sessionId: string, items: Parameters<typeof SessionStore.saveMessages>[2]) => {
    SessionStore.saveMessages(workspaceId, sessionId, items);
  });

  // Memory
  ipcMain.handle('memory:getAll', () => {
    const { activeWorkspaceId } = appConfig.get();
    if (!activeWorkspaceId) return null;
    return MemoryStore.loadAll(activeWorkspaceId);
  });
  ipcMain.handle('memory:updateGlobal', (_e, patch: Parameters<typeof MemoryStore.updateGlobal>[0]) => {
    return MemoryStore.updateGlobal(patch);
  });
  ipcMain.handle('memory:updateWorkspace', (_e, patch: Parameters<typeof MemoryStore.updateWorkspace>[1]) => {
    const { activeWorkspaceId } = appConfig.get();
    if (!activeWorkspaceId) return;
    return MemoryStore.updateWorkspace(activeWorkspaceId, patch);
  });

  // Backward compat
  ipcMain.handle('memory:get', () => {
    const { activeWorkspaceId } = appConfig.get();
    if (!activeWorkspaceId) return null;
    return MemoryStore.loadWorkspace(activeWorkspaceId);
  });
  ipcMain.handle('memory:update', (_e, patch: Parameters<typeof MemoryStore.update>[1]) => {
    const { activeWorkspaceId } = appConfig.get();
    if (!activeWorkspaceId) return;
    return MemoryStore.update(activeWorkspaceId, patch);
  });

  // Artifacts
  ipcMain.handle('artifact:list', (_e, workspaceId: string, sessionId: string) => {
    return ArtifactStore.list(workspaceId, sessionId);
  });
  ipcMain.handle('artifact:delete', (_e, workspaceId: string, sessionId: string, artifactId: string) => {
    ArtifactStore.delete(workspaceId, sessionId, artifactId);
  });

  // File read helpers for preview
  ipcMain.handle('file:readText', (_e, filePath: string) => {
    return fs.readFileSync(filePath, 'utf-8');
  });
  ipcMain.handle('file:readBinary', (_e, filePath: string) => {
    return fs.readFileSync(filePath); // serialized as Buffer/Uint8Array
  });
  ipcMain.handle('file:readDocxHtml', async (_e, filePath: string) => {
    const result = await mammoth.convertToHtml({ path: filePath });
    return result.value;
  });

  // Open file with system default app
  ipcMain.handle('shell:openFile', async (_e, filePath: string) => {
    await shell.openPath(filePath);
  });

  // Plugins
  ipcMain.handle('plugins:list', () => {
    const { activeWorkspaceId } = appConfig.get();
    const ws = activeWorkspaceId ? WorkspaceManager.get(activeWorkspaceId) : null;
    return PluginLoader.load(ws?.path);
  });
}
