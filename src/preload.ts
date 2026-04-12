import { contextBridge, ipcRenderer } from "electron";

export type PermissionScope = "once" | "session" | "always";

export interface HitlRequest {
  action: "read" | "write";
  filePath: string;
  replyChannel: string;
}

contextBridge.exposeInMainWorld("api", {
  // System
  checkOllama: (url?: string) => ipcRenderer.invoke("system:checkOllama", url),
  listModels: () => ipcRenderer.invoke("system:listModels"),
  selectModel: (model: string) =>
    ipcRenderer.invoke("system:selectModel", model),
  setOllamaUrl: (url: string) => ipcRenderer.invoke("system:setOllamaUrl", url),
  getConfig: () => ipcRenderer.invoke("system:getConfig"),
  updateConfig: (patch: Record<string, unknown>) =>
    ipcRenderer.invoke("system:updateConfig", patch),

  // Agent
  sendMessage: (
    messages: { role: string; content: string }[],
    sessionId?: string,
    model?: string,
  ) => ipcRenderer.invoke("agent:sendMessage", messages, sessionId, model),
  cancelMessage: () => ipcRenderer.invoke("agent:cancel"),
  onToken: (cb: (token: string) => void) => {
    ipcRenderer.on("agent:token", (_e, token) => cb(token));
  },
  onToolCall: (cb: (event: unknown) => void) => {
    ipcRenderer.on("agent:toolCall", (_e, event) => cb(event));
  },
  onToolCallStart: (cb: (event: unknown) => void) => {
    ipcRenderer.on("agent:toolCallStart", (_e, event) => cb(event));
  },
  onReasoning: (cb: (text: string) => void) => {
    ipcRenderer.on("agent:reasoning", (_e, text) => cb(text));
  },
  onDone: (cb: () => void) => {
    ipcRenderer.on("agent:done", () => cb());
  },
  offAgentEvents: () => {
    ipcRenderer.removeAllListeners("agent:token");
    ipcRenderer.removeAllListeners("agent:toolCall");
    ipcRenderer.removeAllListeners("agent:toolCallStart");
    ipcRenderer.removeAllListeners("agent:reasoning");
    ipcRenderer.removeAllListeners("agent:done");
    ipcRenderer.removeAllListeners("agent:fileProgress");
  },
  onPreviewFile: (
    cb: (data: { type: string; fileName: string; filePath: string }) => void,
  ) => {
    ipcRenderer.on("file:preview", (_e, data) => cb(data));
  },
  offPreviewFile: () => {
    ipcRenderer.removeAllListeners("file:preview");
  },
  onArtifactCreated: (cb: (artifact: unknown) => void) => {
    ipcRenderer.on("artifact:created", (_e, artifact) => cb(artifact));
  },
  offArtifactCreated: () => {
    ipcRenderer.removeAllListeners("artifact:created");
  },
  onFileProgress: (
    cb: (info: { fileName: string; stage: "reading" | "parsing" }) => void,
  ) => {
    ipcRenderer.on("agent:fileProgress", (_e, info) => cb(info));
  },

  // HITL
  onApprovalRequest: (cb: (req: HitlRequest) => void) => {
    ipcRenderer.on("hitl:requestApproval", (_e, req) => cb(req));
  },
  offApprovalRequest: () => {
    ipcRenderer.removeAllListeners("hitl:requestApproval");
  },
  replyApproval: (
    replyChannel: string,
    approved: boolean,
    scope: PermissionScope,
  ) => {
    ipcRenderer.send(replyChannel, approved, scope);
  },

  // Workspace
  createWorkspace: (name: string, folderPath?: string) =>
    ipcRenderer.invoke("workspace:create", name, folderPath),
  listWorkspaces: () => ipcRenderer.invoke("workspace:list"),
  setActiveWorkspace: (id: string) =>
    ipcRenderer.invoke("workspace:setActive", id),
  deleteWorkspace: (id: string) => ipcRenderer.invoke("workspace:delete", id),

  // Sessions
  listSessions: (workspaceId: string) =>
    ipcRenderer.invoke("session:list", workspaceId),
  createSession: (workspaceId: string) =>
    ipcRenderer.invoke("session:create", workspaceId),
  renameSession: (workspaceId: string, sessionId: string, name: string) =>
    ipcRenderer.invoke("session:rename", workspaceId, sessionId, name),
  deleteSession: (workspaceId: string, sessionId: string) =>
    ipcRenderer.invoke("session:delete", workspaceId, sessionId),
  loadSessionMessages: (workspaceId: string, sessionId: string) =>
    ipcRenderer.invoke("session:loadMessages", workspaceId, sessionId),
  saveSessionMessages: (
    workspaceId: string,
    sessionId: string,
    messages: unknown[],
  ) =>
    ipcRenderer.invoke(
      "session:saveMessages",
      workspaceId,
      sessionId,
      messages,
    ),

  // Memory
  getMemory: () => ipcRenderer.invoke("memory:get"),
  updateMemory: (content: string) =>
    ipcRenderer.invoke("memory:update", content),
  onMemoryUpdated: (cb: () => void) => {
    ipcRenderer.on("memory:updated", () => cb());
  },
  offMemoryUpdated: () => {
    ipcRenderer.removeAllListeners("memory:updated");
  },

  // Provider management
  checkProvider: (provider: Record<string, unknown>) =>
    ipcRenderer.invoke("provider:check", provider),
  listProviderModels: (provider: Record<string, unknown>) =>
    ipcRenderer.invoke("provider:listModels", provider),
  saveProvider: (provider: Record<string, unknown>) =>
    ipcRenderer.invoke("provider:save", provider),
  deleteProvider: (id: string) => ipcRenderer.invoke("provider:delete", id),
  setActiveProvider: (id: string) =>
    ipcRenderer.invoke("provider:setActive", id),

  // Artifacts
  listArtifacts: (workspaceId: string, sessionId: string) =>
    ipcRenderer.invoke("artifact:list", workspaceId, sessionId),
  deleteArtifact: (
    workspaceId: string,
    sessionId: string,
    artifactId: string,
  ) =>
    ipcRenderer.invoke("artifact:delete", workspaceId, sessionId, artifactId),

  // File read for preview
  readFileText: (filePath: string) =>
    ipcRenderer.invoke("file:readText", filePath),
  readFileBinary: (filePath: string) =>
    ipcRenderer.invoke("file:readBinary", filePath),
  readDocxHtml: (filePath: string) =>
    ipcRenderer.invoke("file:readDocxHtml", filePath),

  // Open with default app
  openFile: (filePath: string) =>
    ipcRenderer.invoke("shell:openFile", filePath),
  showInFolder: (filePath: string) =>
    ipcRenderer.invoke("shell:showInFolder", filePath),

  // Plugins — Skills
  listSkills: () => ipcRenderer.invoke("plugins:listSkills"),
  saveSkill: (plugin: Record<string, unknown>) =>
    ipcRenderer.invoke("plugins:saveSkill", plugin),
  deleteSkill: (id: string) => ipcRenderer.invoke("plugins:deleteSkill", id),
  openSkillsDir: () => ipcRenderer.invoke("plugins:openSkillsDir"),

  // Plugins — MCP
  listMcp: () => ipcRenderer.invoke("plugins:listMcp"),
  saveMcp: (plugin: Record<string, unknown>) =>
    ipcRenderer.invoke("plugins:saveMcp", plugin),
  deleteMcp: (id: string) => ipcRenderer.invoke("plugins:deleteMcp", id),
  openMcpDir: () => ipcRenderer.invoke("plugins:openMcpDir"),

  // Logs
  exportLogs: () => ipcRenderer.invoke("system:exportLogs"),
});
