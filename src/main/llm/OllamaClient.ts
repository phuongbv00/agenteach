import { Ollama } from 'ollama';
import { createOllama } from 'ollama-ai-provider';
import { appConfig } from '../config/AppConfig';

function baseUrl(): string {
  return appConfig.get().ollamaUrl || 'http://localhost:11434';
}

function ollamaClient(host?: string): Ollama {
  return new Ollama({ host: host ?? baseUrl() });
}

export async function checkOllamaHealth(url?: string): Promise<boolean> {
  try {
    const client = ollamaClient(url);
    await client.list();
    return true;
  } catch {
    return false;
  }
}

export async function listOllamaModels(): Promise<string[]> {
  try {
    const { models } = await ollamaClient().list();
    return models.map((m) => m.name);
  } catch {
    return [];
  }
}

export function createOllamaModel(modelName: string) {
  const ollama = createOllama({ baseURL: `${baseUrl()}/api` });
  return ollama(modelName);
}
