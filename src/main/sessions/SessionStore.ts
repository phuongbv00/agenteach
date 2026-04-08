import type { InValue } from "@libsql/client"
import { getDb } from "../db"
import { generateId } from "../utils/generateId"

export interface Session {
  id: string
  workspaceId: string
  name: string
  createdAt: number
  updatedAt: number
}

export type StoredChatItem =
  | { type: "user_message"; content: string }
  | { type: "assistant_message"; thinking?: string; content: string }
  | {
      type: "tool_call"
      toolName: string
      label: string
      args: Record<string, unknown>
      result: string
    }

function rowToSession(row: Record<string, unknown>): Session {
  return {
    id: row.id as string,
    workspaceId: row.workspace_id as string,
    name: row.name as string,
    createdAt: row.created_at as number,
    updatedAt: row.updated_at as number,
  }
}

function rowToItem(row: Record<string, unknown>): StoredChatItem {
  const type = row.type as string
  if (type === "user_message") {
    return { type: "user_message", content: row.content as string }
  }
  if (type === "assistant_message") {
    return {
      type: "assistant_message",
      content: row.content as string,
      ...(row.thinking ? { thinking: row.thinking as string } : {}),
    }
  }
  return {
    type: "tool_call",
    toolName: row.tool_name as string,
    label: row.label as string,
    args: JSON.parse((row.args as string) ?? "{}"),
    result: (row.result as string) ?? "",
  }
}

export const SessionStore = {
  async list(workspaceId: string): Promise<Session[]> {
    const db = getDb()
    const res = await db.execute({
      sql: "SELECT * FROM sessions WHERE workspace_id = ? ORDER BY updated_at DESC",
      args: [workspaceId],
    })
    return res.rows.map((r) => rowToSession(r as Record<string, unknown>))
  },

  async create(workspaceId: string, name = "Phiên mới"): Promise<Session> {
    const db = getDb()
    const session: Session = {
      id: "SS-" + generateId(),
      workspaceId,
      name,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    await db.execute({
      sql: "INSERT INTO sessions (id, workspace_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
      args: [
        session.id,
        session.workspaceId,
        session.name,
        session.createdAt,
        session.updatedAt,
      ],
    })
    return session
  },

  async rename(
    workspaceId: string,
    sessionId: string,
    name: string,
  ): Promise<void> {
    const db = getDb()
    await db.execute({
      sql: "UPDATE sessions SET name = ?, updated_at = ? WHERE id = ? AND workspace_id = ?",
      args: [name, Date.now(), sessionId, workspaceId],
    })
  },

  async delete(workspaceId: string, sessionId: string): Promise<void> {
    const db = getDb()
    await db.batch(
      [
        {
          sql: "DELETE FROM messages WHERE session_id = ? AND workspace_id = ?",
          args: [sessionId, workspaceId],
        },
        {
          sql: "DELETE FROM artifacts WHERE session_id = ? AND workspace_id = ?",
          args: [sessionId, workspaceId],
        },
        {
          sql: "DELETE FROM sessions WHERE id = ? AND workspace_id = ?",
          args: [sessionId, workspaceId],
        },
      ],
      "write",
    )
  },

  async loadMessages(
    workspaceId: string,
    sessionId: string,
  ): Promise<StoredChatItem[]> {
    const db = getDb()
    const res = await db.execute({
      sql: "SELECT * FROM messages WHERE session_id = ? AND workspace_id = ? ORDER BY position ASC",
      args: [sessionId, workspaceId],
    })
    return res.rows.map((r) => rowToItem(r as Record<string, unknown>))
  },

  async saveMessages(
    workspaceId: string,
    sessionId: string,
    messages: StoredChatItem[],
  ): Promise<void> {
    const db = getDb()

    // Auto-name from first user message
    let autoName: string | null = null
    const firstUser = messages.find(
      (m) => m.type === "user_message",
    ) as Extract<StoredChatItem, { type: "user_message" }> | undefined
    if (firstUser) {
      autoName =
        firstUser.content.slice(0, 40) +
        (firstUser.content.length > 40 ? "..." : "")
    }

    const stmts: Array<{ sql: string; args: InValue[] }> = [
      {
        sql: "DELETE FROM messages WHERE session_id = ? AND workspace_id = ?",
        args: [sessionId, workspaceId],
      },
    ]

    for (let i = 0; i < messages.length; i++) {
      const item = messages[i]
      if (item.type === "user_message") {
        stmts.push({
          sql: "INSERT INTO messages (session_id, workspace_id, position, type, content) VALUES (?, ?, ?, ?, ?)",
          args: [sessionId, workspaceId, i, "user_message", item.content],
        })
      } else if (item.type === "assistant_message") {
        stmts.push({
          sql: "INSERT INTO messages (session_id, workspace_id, position, type, content, thinking) VALUES (?, ?, ?, ?, ?, ?)",
          args: [
            sessionId,
            workspaceId,
            i,
            "assistant_message",
            item.content,
            item.thinking ?? null,
          ],
        })
      } else if (item.type === "tool_call") {
        stmts.push({
          sql: "INSERT INTO messages (session_id, workspace_id, position, type, tool_name, label, args, result) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          args: [
            sessionId,
            workspaceId,
            i,
            "tool_call",
            item.toolName,
            item.label,
            JSON.stringify(item.args),
            item.result,
          ],
        })
      }
    }

    // Check current session name to conditionally auto-rename
    const sessionRes = await db.execute({
      sql: "SELECT name FROM sessions WHERE id = ?",
      args: [sessionId],
    })
    const currentName =
      sessionRes.rows.length > 0
        ? ((sessionRes.rows[0] as Record<string, unknown>).name as string | null)
        : null
    const newName =
      autoName && currentName === "Phiên mới" ? autoName : (currentName ?? "Phiên mới")

    stmts.push({
      sql: "UPDATE sessions SET updated_at = ?, name = ? WHERE id = ?",
      args: [Date.now(), newName, sessionId],
    })

    await db.batch(stmts, "write")
  },
}
