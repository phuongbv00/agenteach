import fs from "fs";
import path from "path";
import { dataDir } from "../utils/dataDir";

export interface AlwaysPermission {
  action: "read" | "write";
  workspaceId: string;
}

export interface AIProvider {
  id: string;
  name: string;
  baseUrl: string; // OpenAI-compatible base, e.g. http://localhost:11434/v1
  apiKey: string;  // empty string if not required
}

export interface AppConfigData {
  teacherName: string;
  subject: string;
  // Multi-provider
  providers: AIProvider[];
  activeProviderId: string | null;
  selectedModel: string;
  // Legacy (kept for migration)
  ollamaUrl?: string;
  activeWorkspaceId: string | null;
  alwaysPermissions: AlwaysPermission[];
  setupComplete: boolean;
}

const DEFAULT_OLLAMA_PROVIDER: AIProvider = {
  id: 'ollama-local',
  name: 'Ollama (máy này)',
  baseUrl: 'http://localhost:11434/v1',
  apiKey: '',
};

const DEFAULTS: AppConfigData = {
  teacherName: "",
  subject: "",
  providers: [DEFAULT_OLLAMA_PROVIDER],
  activeProviderId: 'ollama-local',
  selectedModel: "gemma4:26b",
  activeWorkspaceId: null,
  alwaysPermissions: [],
  setupComplete: false,
};

class AppConfig {
  private configPath: string;
  private data: AppConfigData;

  constructor() {
    this.configPath = dataDir("config.json");
    this.data = this.migrate(this.load());
  }

  private migrate(data: AppConfigData): AppConfigData {
    // Migrate legacy ollamaUrl to providers list
    if (data.ollamaUrl && (!data.providers || data.providers.length === 0)) {
      const baseUrl = data.ollamaUrl.replace(/\/?$/, '') + '/v1';
      data.providers = [{ id: 'ollama-local', name: 'Ollama (máy này)', baseUrl, apiKey: '' }];
      data.activeProviderId = 'ollama-local';
      delete data.ollamaUrl;
      fs.mkdirSync(path.dirname(this.configPath), { recursive: true });
      fs.writeFileSync(this.configPath, JSON.stringify(data, null, 2), "utf-8");
    }
    if (!data.providers || data.providers.length === 0) {
      data.providers = [{ ...DEFAULT_OLLAMA_PROVIDER }];
      data.activeProviderId = 'ollama-local';
    }
    return data;
  }

  private load(): AppConfigData {
    try {
      const raw = fs.readFileSync(this.configPath, "utf-8");
      return { ...DEFAULTS, ...JSON.parse(raw) };
    } catch {
      return { ...DEFAULTS };
    }
  }

  private save(): void {
    fs.mkdirSync(path.dirname(this.configPath), { recursive: true });
    fs.writeFileSync(
      this.configPath,
      JSON.stringify(this.data, null, 2),
      "utf-8",
    );
  }

  get(): AppConfigData {
    return { ...this.data };
  }

  update(patch: Partial<AppConfigData>): void {
    this.data = { ...this.data, ...patch };
    this.save();
  }

  hasAlwaysPermission(action: "read" | "write", workspaceId: string): boolean {
    return this.data.alwaysPermissions.some(
      (p) => p.action === action && p.workspaceId === workspaceId,
    );
  }

  addAlwaysPermission(action: "read" | "write", workspaceId: string): void {
    if (!this.hasAlwaysPermission(action, workspaceId)) {
      this.data.alwaysPermissions.push({ action, workspaceId });
      this.save();
    }
  }
}

export const appConfig = new AppConfig();
