export type PermissionScope = 'once' | 'session' | 'always';

export interface HitlRequest {
  action: 'read' | 'write';
  filePath: string;
  replyChannel: string;
}

export interface Workspace {
  id: string;
  name: string;
  path: string;
  createdAt: number;
  lastOpenedAt: number;
}

export interface Session {
  id: string;
  workspaceId: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

export interface MemoryLayer {
  user: { name: string; subject: string; grades: string[] };
  style: Record<string, string>;
  feedback: string[];
  context: string[];
  updatedAt: number;
}

// backward compat
export type Memory = MemoryLayer;

export interface AllMemory {
  global: MemoryLayer;
  workspace: MemoryLayer;
}

export interface Plugin {
  id: string;
  type: 'skill' | 'mcp';
  name: string;
  description: string;
  // skill-specific
  triggers: string[];
  prompt: string;
  // mcp-specific
  command?: string;
  args?: string[];
}

export interface AIProvider {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string;
}

export interface AppConfigData {
  teacherName: string;
  subject: string;
  providers: AIProvider[];
  activeProviderId: string | null;
  selectedModel: string;
  activeWorkspaceId: string | null;
  setupComplete: boolean;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export type StoredChatItem =
  | { type: 'user_message'; content: string }
  | { type: 'assistant_message'; content: string }
  | { type: 'reasoning_block'; content: string }
  | { type: 'tool_call'; toolName: string; label: string; args: Record<string, unknown>; result: string };

export interface Artifact {
  id: string;
  sessionId: string;
  workspaceId: string;
  filePath: string;
  fileName: string;
  type: 'pdf' | 'docx' | 'md';
  createdAt: number;
}

export interface PreviewData {
  type: 'md' | 'pdf' | 'docx';
  fileName: string;
  filePath: string;
}

export interface ToolCallEvent {
  toolName: string;
  label: string;
  args: Record<string, unknown>;
  result: string;
}

declare global {
  interface Window {
    api: {
      checkOllama(url?: string): Promise<boolean>;
      listModels(): Promise<string[]>;
      selectModel(model: string): Promise<void>;
      setOllamaUrl(url: string): Promise<void>;
      getConfig(): Promise<AppConfigData>;
      updateConfig(patch: Partial<AppConfigData>): Promise<void>;

      sendMessage(messages: ChatMessage[], sessionId?: string, model?: string): Promise<void>;
      cancelMessage(): Promise<void>;
      onToken(cb: (token: string) => void): void;
      onToolCall(cb: (event: ToolCallEvent) => void): void;
      onToolCallStart(cb: (event: Omit<ToolCallEvent, 'result'>) => void): void;
      onReasoning(cb: (text: string) => void): void;
      onDone(cb: () => void): void;
      onFileProgress(cb: (info: { fileName: string; stage: 'reading' | 'parsing' }) => void): void;
      offAgentEvents(): void;
      onPreviewFile(cb: (data: PreviewData) => void): void;
      offPreviewFile(): void;
      onArtifactCreated(cb: (artifact: Artifact) => void): void;
      offArtifactCreated(): void;

      onApprovalRequest(cb: (req: HitlRequest) => void): void;
      offApprovalRequest(): void;
      replyApproval(replyChannel: string, approved: boolean, scope: PermissionScope): void;

      createWorkspace(name: string, folderPath?: string): Promise<Workspace | null>;
      listWorkspaces(): Promise<Workspace[]>;
      setActiveWorkspace(id: string): Promise<void>;
      deleteWorkspace(id: string): Promise<void>;

      listSessions(workspaceId: string): Promise<Session[]>;
      createSession(workspaceId: string): Promise<Session>;
      renameSession(workspaceId: string, sessionId: string, name: string): Promise<void>;
      deleteSession(workspaceId: string, sessionId: string): Promise<void>;
      loadSessionMessages(workspaceId: string, sessionId: string): Promise<StoredChatItem[]>;
      saveSessionMessages(workspaceId: string, sessionId: string, items: StoredChatItem[]): Promise<void>;

      getAllMemory(): Promise<AllMemory | null>;
      updateGlobalMemory(patch: Partial<MemoryLayer>): Promise<MemoryLayer>;
      updateWorkspaceMemory(patch: Partial<MemoryLayer>): Promise<MemoryLayer>;
      onMemoryUpdated(cb: () => void): void;
      offMemoryUpdated(): void;
      getMemory(): Promise<Memory | null>;
      updateMemory(patch: Partial<Memory>): Promise<Memory>;

      checkProvider(provider: AIProvider): Promise<boolean>;
      listProviderModels(provider: AIProvider): Promise<string[]>;
      saveProvider(provider: AIProvider): Promise<void>;
      deleteProvider(id: string): Promise<void>;
      setActiveProvider(id: string): Promise<void>;

      listArtifacts(workspaceId: string, sessionId: string): Promise<Artifact[]>;
      deleteArtifact(workspaceId: string, sessionId: string, artifactId: string): Promise<void>;
      readFileText(filePath: string): Promise<string>;
      readFileBinary(filePath: string): Promise<Uint8Array>;
      readDocxHtml(filePath: string): Promise<string>;
      openFile(filePath: string): Promise<void>;

      listPlugins(): Promise<Plugin[]>;
      savePlugin(plugin: Plugin): Promise<void>;
      deletePlugin(pluginId: string): Promise<void>;
      openPluginsDir(): Promise<void>;
      exportLogs(): Promise<boolean>;
    };
  }
}
