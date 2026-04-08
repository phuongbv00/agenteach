/// <reference types="vite/client" />
import { createClient, type Client } from "@libsql/client"
import fs from "fs"
import path from "path"
import { dataDir } from "../utils/dataDir"

// Vite resolves glob at build time; import as raw SQL strings, sorted by filename
const SQL_FILES = import.meta.glob<string>("./migrations/*.sql", {
  eager: true,
  query: "?raw",
  import: "default",
})

let _db: Client | null = null

export function getDb(): Client {
  if (!_db) {
    const dbPath = dataDir("db.sqlite")
    fs.mkdirSync(path.dirname(dbPath), { recursive: true })
    _db = createClient({ url: `file:${dbPath}` })
  }
  return _db
}

export async function initDb(): Promise<void> {
  const db = getDb()

  await db.execute(
    `CREATE TABLE IF NOT EXISTS migrations (
      key TEXT PRIMARY KEY,
      done_at INTEGER NOT NULL
    )`,
  )

  const applied = await db.execute("SELECT key FROM migrations")
  const appliedKeys = new Set(applied.rows.map((r) => r.key as string))

  for (const filePath of Object.keys(SQL_FILES).sort()) {
    const key = path.basename(filePath, ".sql")
    if (appliedKeys.has(key)) continue

    const sql = SQL_FILES[filePath]
    // libsql doesn't support multi-statement strings — split on ";"
    for (const stmt of sql.split(";").map((s: string) => s.trim()).filter(Boolean)) {
      await db.execute(stmt)
    }

    await db.execute({
      sql: "INSERT INTO migrations (key, done_at) VALUES (?, ?)",
      args: [key, Date.now()],
    })
  }
}
