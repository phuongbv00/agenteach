import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { appConfig, type AIProvider } from '../config/AppConfig';

function activeProvider(): AIProvider | null {
  const cfg = appConfig.get();
  return cfg.providers.find((p) => p.id === cfg.activeProviderId) ?? cfg.providers[0] ?? null;
}

function makeClient(provider: AIProvider) {
  return createOpenAICompatible({
    name: provider.id || 'provider',
    baseURL: provider.baseUrl,
    apiKey: provider.apiKey || 'no-key',
  });
}

export async function checkProviderHealth(provider?: AIProvider): Promise<boolean> {
  const p = provider ?? activeProvider();
  if (!p) return false;
  // Try /models endpoint (OpenAI-compatible)
  const base = p.baseUrl.replace(/\/v1\/?$/, '');
  try {
    const res = await fetch(`${base}/v1/models`, {
      headers: p.apiKey ? { Authorization: `Bearer ${p.apiKey}` } : {},
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function listModels(provider?: AIProvider): Promise<string[]> {
  const p = provider ?? activeProvider();
  if (!p) return [];
  const base = p.baseUrl.replace(/\/v1\/?$/, '');
  try {
    const res = await fetch(`${base}/v1/models`, {
      headers: p.apiKey ? { Authorization: `Bearer ${p.apiKey}` } : {},
    });
    if (!res.ok) return [];
    const json = await res.json() as { data: { id: string }[] };
    return json.data.map((m) => m.id).sort();
  } catch {
    return [];
  }
}

export function createModel(modelName: string, provider?: AIProvider) {
  const p = provider ?? activeProvider();
  if (!p) throw new Error('Không có AI provider nào được cấu hình.');
  // createOpenAICompatible always uses Chat Completions API (/v1/chat/completions).
  return makeClient(p)(modelName);
}

// ── Backward-compat shims used by old handlers ───────────────────────────────
export const checkOllamaHealth = (url?: string) => {
  if (url) {
    return checkProviderHealth({ id: '', name: '', baseUrl: url + '/v1', apiKey: '' });
  }
  return checkProviderHealth();
};

export const listOllamaModels = () => listModels();
export const createOllamaModel = createModel;
