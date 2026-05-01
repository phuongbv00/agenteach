import os from "os"
import path from "path"
import fs from "fs"

const BOOTSTRAP_DIR = path.join(os.homedir(), ".agenteach")
const DATAROOT_FILE = path.join(BOOTSTRAP_DIR, ".dataroot")

let _cachedRoot: string | null = null

export function getDataRoot(): string {
  if (_cachedRoot) return _cachedRoot
  try {
    const stored = fs.readFileSync(DATAROOT_FILE, "utf-8").trim()
    if (stored) {
      _cachedRoot = stored
      return _cachedRoot
    }
  } catch {
    // no file yet, use bootstrap dir
  }
  _cachedRoot = BOOTSTRAP_DIR
  return _cachedRoot
}

export function setDataRoot(newRoot: string): void {
  fs.mkdirSync(BOOTSTRAP_DIR, { recursive: true })
  fs.writeFileSync(DATAROOT_FILE, newRoot, "utf-8")
  _cachedRoot = newRoot
}

export function dataDir(...segments: string[]): string {
  return path.join(getDataRoot(), ...segments)
}
