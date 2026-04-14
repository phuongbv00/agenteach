import { ModelMessage } from "ai";

export type PermissionScope = "once" | "session" | "always";

export interface HitlRequest {
  action: "read" | "write";
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

export interface PluginSkill {
  id: string;
  name: string;
  description: string;
  prompt: string;
  builtin?: boolean;
}

export interface PluginMCP {
  id: string;
  // stdio server
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  // remote server
  url?: string;
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

export interface Artifact {
  id: string;
  sessionId: string;
  workspaceId: string;
  filePath: string;
  fileName: string;
  type: "pdf" | "docx" | "md";
  createdAt: number;
}

export interface PreviewData {
  type: "md" | "pdf" | "docx";
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

      sendMessage(
        messages: ModelMessage[],
        sessionId?: string,
        model?: string,
      ): Promise<void>;
      cancelMessage(): Promise<void>;
      onToken(cb: (token: string) => void): void;
      onToolCall(cb: (event: ToolCallEvent) => void): void;
      onToolCallStart(cb: (event: Omit<ToolCallEvent, "result">) => void): void;
      onReasoning(cb: (text: string) => void): void;
      onDone(cb: () => void): void;
      onFileProgress(
        cb: (info: { fileName: string; stage: "reading" | "parsing" }) => void,
      ): void;
      offAgentEvents(): void;
      onPreviewFile(cb: (data: PreviewData) => void): void;
      offPreviewFile(): void;
      onArtifactCreated(cb: (artifact: Artifact) => void): void;
      offArtifactCreated(): void;

      onApprovalRequest(cb: (req: HitlRequest) => void): void;
      offApprovalRequest(): void;
      replyApproval(
        replyChannel: string,
        approved: boolean,
        scope: PermissionScope,
      ): void;

      createWorkspace(
        name: string,
        folderPath?: string,
      ): Promise<Workspace | null>;
      listWorkspaces(): Promise<Workspace[]>;
      setActiveWorkspace(id: string): Promise<void>;
      deleteWorkspace(id: string): Promise<void>;

      listSessions(workspaceId: string): Promise<Session[]>;
      createSession(workspaceId: string): Promise<Session>;
      renameSession(
        workspaceId: string,
        sessionId: string,
        name: string,
      ): Promise<void>;
      deleteSession(workspaceId: string, sessionId: string): Promise<void>;
      loadSessionMessages(
        workspaceId: string,
        sessionId: string,
      ): Promise<ModelMessage[]>;
      appendSessionMessages(
        workspaceId: string,
        sessionId: string,
        messages: ModelMessage[],
        fromPosition: number,
      ): Promise<void>;

      getMemory: () => Promise<string>;
      updateMemory: (content: string) => Promise<string>;
      onMemoryUpdated: (cb: () => void) => void;
      offMemoryUpdated: () => void;

      checkProvider(provider: AIProvider): Promise<boolean>;
      listProviderModels(provider: AIProvider): Promise<string[]>;
      saveProvider(provider: AIProvider): Promise<void>;
      deleteProvider(id: string): Promise<void>;
      setActiveProvider(id: string): Promise<void>;

      listArtifacts(
        workspaceId: string,
        sessionId: string,
      ): Promise<Artifact[]>;
      deleteArtifact(
        workspaceId: string,
        sessionId: string,
        artifactId: string,
      ): Promise<void>;
      readFileText(filePath: string): Promise<string>;
      readFileBinary(filePath: string): Promise<Uint8Array>;
      readDocxHtml(filePath: string): Promise<string>;
      openFile(filePath: string): Promise<void>;
      showInFolder(filePath: string): Promise<void>;

      // Skills
      listSkills(): Promise<PluginSkill[]>;
      saveSkill(plugin: PluginSkill): Promise<void>;
      deleteSkill(id: string): Promise<void>;
      openSkillsDir(): Promise<void>;
      // MCP
      listMcp(): Promise<PluginMCP[]>;
      saveMcp(plugin: PluginMCP): Promise<void>;
      deleteMcp(id: string): Promise<void>;
      openMcpDir(): Promise<void>;
      exportLogs(): Promise<boolean>;
    };
  }
}
