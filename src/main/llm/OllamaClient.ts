import { createOllama } from 'ollama-ai-provider';
import { appConfig } from '../config/AppConfig';

function baseUrl(): string {
  return appConfig.get().ollamaUrl || 'http://localhost:11434';
}

export async function checkOllamaHealth(url?: string): Promise<boolean> {
  const target = url ?? baseUrl();
  try {
    const res = await fetch(`${target}/api/tags`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

export async function listOllamaModels(): Promise<string[]> {
  try {
    const res = await fetch(`${baseUrl()}/api/tags`);
    if (!res.ok) return [];
    const json = await res.json() as { models: { name: string }[] };
    return json.models.map((m) => m.name);
  } catch {
    return [];
  }
}

export function createOllamaModel(modelName: string) {
  const ollama = createOllama({ baseURL: `${baseUrl()}/api` });
  return ollama(modelName);
}
