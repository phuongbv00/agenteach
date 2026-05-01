import { spawn } from "node:child_process"
import path from "node:path"
import { appConfig } from "../config/AppConfig"
import { getLlamaServerPath, getInstallStatus } from "./LlamaCppInstaller"

const LLAMACPP_PORT = 8080
const HEALTH_URL = `http://127.0.0.1:${LLAMACPP_PORT}/v1/models`

let llamaProcess: ReturnType<typeof spawn> | null = null

async function isServerRunning(): Promise<boolean> {
  try {
    const res = await fetch(HEALTH_URL, { signal: AbortSignal.timeout(2000) })
    const json = await res.json()
    console.log("Llama.cpp server health check response:", JSON.stringify(json))
    return res.ok
  } catch {
    return false
  }
}

async function waitForServer(timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await isServerRunning()) return
    await new Promise((r) => setTimeout(r, 500))
  }
}

export async function tryStartLlamaCpp(): Promise<void> {
  if (await isServerRunning()) return

  const modelPath = appConfig.get().localModelPath
  const { llamacppReady, modelReady } = getInstallStatus(modelPath || undefined)
  if (!llamacppReady || !modelReady) return

  const bin = getLlamaServerPath()
  llamaProcess = spawn(
    bin,
    [
      "--model",
      modelPath,
      "--alias",
      path.basename(modelPath, path.extname(modelPath)),
      "--port",
      String(LLAMACPP_PORT),
      "--host",
      "127.0.0.1",
      // "-c",    // TODO: test context compress by adding these params back
      // "4096",
    ],
    { detached: false, stdio: "ignore" },
  )
  llamaProcess.unref()

  await waitForServer(30_000)
}

export function killLlamaCppProcess(): void {
  llamaProcess?.kill()
  llamaProcess = null
}
