import path from "node:path"
import fs from "node:fs"
import https from "node:https"
import { execFile, execFileSync } from "node:child_process"
import { BrowserWindow } from "electron"
import { dataDir } from "../utils/dataDir"

const MODEL_FILENAME = "gemma-4-E2B-it-Q4_K_M.gguf"
const MODEL_URL = `https://huggingface.co/unsloth/gemma-4-E2B-it-GGUF/resolve/main/${MODEL_FILENAME}`

export function getDefaultModelPath(): string {
  return dataDir("models", MODEL_FILENAME)
}

// Resolve the llama-server binary path by looking it up in PATH
function resolveServerBin(): string | null {
  const bin = process.platform === "win32" ? "llama-server.exe" : "llama-server"
  const cmd = process.platform === "win32" ? "where" : "which"
  try {
    return execFileSync(cmd, [bin], { encoding: "utf-8" }).trim().split("\n")[0]
  } catch {
    return null
  }
}

export function getLlamaServerPath(): string {
  return resolveServerBin() ?? (process.platform === "win32" ? "llama-server.exe" : "llama-server")
}

export function getInstallStatus(modelPath?: string): {
  llamacppReady: boolean
  modelReady: boolean
} {
  return {
    llamacppReady: resolveServerBin() !== null,
    modelReady: fs.existsSync(modelPath ?? getDefaultModelPath()),
  }
}

// ── Package manager install ───────────────────────────────────────────────────

function findBrew(): string | null {
  for (const p of ["/opt/homebrew/bin/brew", "/usr/local/bin/brew"]) {
    if (fs.existsSync(p)) return p
  }
  return null
}

function installViaBrew(brew: string, onOutput: (line: string) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = execFile(brew, ["install", "llama.cpp"])
    proc.stdout?.on("data", (d: Buffer) => onOutput(d.toString().trim()))
    proc.stderr?.on("data", (d: Buffer) => onOutput(d.toString().trim()))
    proc.on("close", (code) => {
      if (code === 0) resolve()
      else reject(new Error(`brew install exited with code ${code}`))
    })
    proc.on("error", reject)
  })
}

function installViaWinget(onOutput: (line: string) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = execFile("winget", [
      "install", "llama.cpp",
      "--accept-package-agreements",
      "--accept-source-agreements",
    ])
    proc.stdout?.on("data", (d: Buffer) => onOutput(d.toString().trim()))
    proc.stderr?.on("data", (d: Buffer) => onOutput(d.toString().trim()))
    proc.on("close", (code) => {
      if (code === 0) resolve()
      else reject(new Error(`winget install exited with code ${code}`))
    })
    proc.on("error", reject)
  })
}

// ── Model download ────────────────────────────────────────────────────────────

function downloadFile(
  url: string,
  destPath: string,
  onProgress: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const tmpPath = destPath + ".tmp"
    try { fs.unlinkSync(tmpPath) } catch { /* ignore */ }

    function doRequest(reqUrl: string): void {
      https
        .get(reqUrl, { headers: { "User-Agent": "agenteach-app" } }, (res) => {
          if (
            res.statusCode &&
            res.statusCode >= 300 &&
            res.statusCode < 400 &&
            res.headers.location
          ) {
            doRequest(res.headers.location)
            return
          }
          if (res.statusCode !== 200) {
            reject(new Error(`HTTP ${res.statusCode} for ${reqUrl}`))
            return
          }
          const total = parseInt(res.headers["content-length"] ?? "0", 10)
          let downloaded = 0
          const out = fs.createWriteStream(tmpPath)
          res.on("data", (chunk: Buffer) => {
            downloaded += chunk.length
            if (total > 0) onProgress(Math.round((downloaded / total) * 100))
          })
          res.pipe(out)
          out.on("finish", () => { fs.renameSync(tmpPath, destPath); resolve() })
          out.on("error", reject)
          res.on("error", reject)
        })
        .on("error", reject)
    }

    doRequest(url)
  })
}

// ── Main entry point ──────────────────────────────────────────────────────────

export async function installLlamaCpp(
  win: BrowserWindow,
  modelPath: string,
): Promise<void> {
  function send(phase: string, percent: number): void {
    win.webContents.send("llamacpp:progress", { phase, percent })
  }

  // 1. Install llama-server via package manager (if not already in PATH)
  if (!resolveServerBin()) {
    if (process.platform === "darwin") {
      const brew = findBrew()
      if (!brew) {
        throw new Error(
          "Homebrew chưa được cài đặt. Vui lòng cài Homebrew tại https://brew.sh rồi thử lại.",
        )
      }
      send("Đang cài đặt llama.cpp qua Homebrew...", 0)
      let tick = 0
      const pulse = setInterval(() => {
        tick = Math.min(tick + 2, 90)
        send("Đang cài đặt llama.cpp qua Homebrew...", tick)
      }, 2000)
      try {
        await installViaBrew(brew, (line) => {
          if (line) send(line.slice(0, 80), tick)
        })
      } finally {
        clearInterval(pulse)
      }
    } else if (process.platform === "win32") {
      send("Đang cài đặt llama.cpp qua winget...", 0)
      let tick = 0
      const pulse = setInterval(() => {
        tick = Math.min(tick + 2, 90)
        send("Đang cài đặt llama.cpp qua winget...", tick)
      }, 2000)
      try {
        await installViaWinget((line) => {
          if (line) send(line.slice(0, 80), tick)
        })
      } finally {
        clearInterval(pulse)
      }
    } else {
      throw new Error("Nền tảng không được hỗ trợ.")
    }

    send("Đang cài đặt llama.cpp qua Homebrew...", 100)

    if (!resolveServerBin()) {
      throw new Error("Cài đặt xong nhưng không tìm thấy llama-server trong PATH.")
    }
  }

  // 2. Download model (still needs to be done manually)
  fs.mkdirSync(path.dirname(modelPath), { recursive: true })
  if (!fs.existsSync(modelPath)) {
    send("Đang tải mô hình AI...", 0)
    await downloadFile(MODEL_URL, modelPath, (pct) =>
      send("Đang tải mô hình AI...", pct),
    )
  }

  send("Hoàn tất!", 100)
}
