import path from "path"
import { getDb } from "../db"
import { generateId } from "../utils/generateId"

export interface Workspace {
  id: string
  name: string
  path: string
  createdAt: number
  lastOpenedAt: number
}

function rowToWorkspace(row: Record<string, unknown>): Workspace {
  return {
    id: row.id as string,
    name: row.name as string,
    path: row.path as string,
    createdAt: row.created_at as number,
    lastOpenedAt: row.last_opened_at as number,
  }
}

export const WorkspaceManager = {
  async list(): Promise<Workspace[]> {
    const db = getDb()
    const res = await db.execute(
      "SELECT * FROM workspaces ORDER BY last_opened_at DESC",
    )
    return res.rows.map((r) => rowToWorkspace(r as Record<string, unknown>))
  },

  async create(name: string, folderPath: string): Promise<Workspace> {
    const db = getDb()
    const ws: Workspace = {
      id: "WS-" + generateId(),
      name,
      path: folderPath,
      createdAt: Date.now(),
      lastOpenedAt: Date.now(),
    }
    await db.execute({
      sql: "INSERT INTO workspaces (id, name, path, created_at, last_opened_at) VALUES (?, ?, ?, ?, ?)",
      args: [ws.id, ws.name, ws.path, ws.createdAt, ws.lastOpenedAt],
    })
    return ws
  },

  async get(id: string): Promise<Workspace | null> {
    const db = getDb()
    const res = await db.execute({
      sql: "SELECT * FROM workspaces WHERE id = ?",
      args: [id],
    })
    if (!res.rows.length) return null
    return rowToWorkspace(res.rows[0] as Record<string, unknown>)
  },

  async touch(id: string): Promise<void> {
    const db = getDb()
    await db.execute({
      sql: "UPDATE workspaces SET last_opened_at = ? WHERE id = ?",
      args: [Date.now(), id],
    })
  },

  async delete(id: string): Promise<void> {
    const db = getDb()
    await db.execute({ sql: "DELETE FROM workspaces WHERE id = ?", args: [id] })
  },

  isPathInWorkspace(filePath: string, workspace: Workspace): boolean {
    const normalized = path.resolve(filePath)
    const wsPath = path.resolve(workspace.path)
    return normalized.startsWith(wsPath + path.sep) || normalized === wsPath
  },
}
