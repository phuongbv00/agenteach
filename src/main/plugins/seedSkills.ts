import fs from 'fs'
import path from 'node:path'
import { app } from 'electron'
import { PluginLoader } from './PluginLoader'

/**
 * Seeds built-in skill files into ~/.agenteach/plugins/skills on first run.
 * Existing files are never overwritten, so user edits are preserved.
 */
export function seedSkills(): void {
  // In packaged app, extraResource copies `plugins/skills/` → `<resources>/skills/`
  const sourceDir = app.isPackaged
    ? path.join(process.resourcesPath, 'skills')
    : path.join(app.getAppPath(), 'plugins', 'skills')

  if (!fs.existsSync(sourceDir)) return

  const destDir = path.join(PluginLoader.pluginDir(), 'skills')
  fs.mkdirSync(destDir, { recursive: true })

  for (const file of fs.readdirSync(sourceDir)) {
    if (!file.endsWith('.md')) continue
    const dest = path.join(destDir, file)
    if (fs.existsSync(dest)) continue
    fs.copyFileSync(path.join(sourceDir, file), dest)
  }
}
