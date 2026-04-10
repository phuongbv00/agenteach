/// <reference types="vite/client" />
import { DatabaseSync } from "node:sqlite"
import fs from "fs"
import path from "path"
import { dataDir } from "../utils/dataDir"

// Vite resolves glob at build time; import as raw SQL strings, sorted by filename
const SQL_FILES = import.meta.glob<string>("./migrations/*.sql", {
  eager: true,
  query: "?raw",
  import: "default",
})

let _db: DatabaseSync | null = null

export function getDb(): DatabaseSync {
  if (!_db) {
    const dbPath = dataDir("db.sqlite")
    fs.mkdirSync(path.dirname(dbPath), { recursive: true })
    _db = new DatabaseSync(dbPath)
  }
  return _db
}

export async function initDb(): Promise<void> {
  const db = getDb()

  db.exec(
    `CREATE TABLE IF NOT EXISTS migrations (
      key TEXT PRIMARY KEY,
      done_at INTEGER NOT NULL
    )`,
  )

  const applied = db.prepare("SELECT key FROM migrations").all() as Array<{
    key: string
  }>
  const appliedKeys = new Set(applied.map((r) => r.key))

  for (const filePath of Object.keys(SQL_FILES).sort()) {
    const key = path.basename(filePath, ".sql")
    if (appliedKeys.has(key)) continue

    const sql = SQL_FILES[filePath]
    // node:sqlite doesn't support multi-statement strings — split on ";"
    for (const stmt of sql
      .split(";")
      .map((s: string) => s.trim())
      .filter(Boolean)) {
      db.exec(stmt)
    }

    db.prepare("INSERT INTO migrations (key, done_at) VALUES (?, ?)").run(
      key,
      Date.now(),
    )
  }
}
