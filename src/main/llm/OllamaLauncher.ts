import path from 'node:path';
import { spawn } from 'child_process';

let ollamaProcess: ReturnType<typeof spawn> | null = null;

export async function tryStartOllama(): Promise<void> {
  try {
    const res = await fetch('http://localhost:11434/api/tags', {
      signal: AbortSignal.timeout(2000),
    });
    if (res.ok) return;
  } catch {
    // not running, try to start
  }

  const candidates =
    process.platform === 'win32'
      ? [path.join(process.env.LOCALAPPDATA ?? '', 'Programs', 'Ollama', 'ollama.exe')]
      : ['/usr/local/bin/ollama', '/usr/bin/ollama', '/opt/homebrew/bin/ollama'];

  for (const bin of candidates) {
    try {
      ollamaProcess = spawn(bin, ['serve'], { detached: false, stdio: 'ignore' });
      ollamaProcess.unref();
      break;
    } catch {
      // try next candidate
    }
  }
}

export function killOllamaProcess(): void {
  ollamaProcess?.kill();
  ollamaProcess = null;
}
