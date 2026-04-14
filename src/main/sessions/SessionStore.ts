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
  | { type: "reasoning_block"; content: string }
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
  if (type === "reasoning_block") {
    return { type: "reasoning_block", content: row.content as string }
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
    const rows = db
      .prepare(
        "SELECT * FROM sessions WHERE workspace_id = ? ORDER BY updated_at DESC",
      )
      .all(workspaceId) as Record<string, unknown>[]
    return rows.map(rowToSession)
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
    db.prepare(
      "INSERT INTO sessions (id, workspace_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
    ).run(
      session.id,
      session.workspaceId,
      session.name,
      session.createdAt,
      session.updatedAt,
    )
    return session
  },

  async rename(
    workspaceId: string,
    sessionId: string,
    name: string,
  ): Promise<void> {
    const db = getDb()
    db.prepare(
      "UPDATE sessions SET name = ?, updated_at = ? WHERE id = ? AND workspace_id = ?",
    ).run(name, Date.now(), sessionId, workspaceId)
  },

  async delete(workspaceId: string, sessionId: string): Promise<void> {
    const db = getDb()
    db.exec("BEGIN")
    try {
      db.prepare(
        "DELETE FROM messages WHERE session_id = ? AND workspace_id = ?",
      ).run(sessionId, workspaceId)
      db.prepare(
        "DELETE FROM artifacts WHERE session_id = ? AND workspace_id = ?",
      ).run(sessionId, workspaceId)
      db.prepare(
        "DELETE FROM sessions WHERE id = ? AND workspace_id = ?",
      ).run(sessionId, workspaceId)
      db.exec("COMMIT")
    } catch (e) {
      db.exec("ROLLBACK")
      throw e
    }
  },

  async loadMessages(
    workspaceId: string,
    sessionId: string,
  ): Promise<StoredChatItem[]> {
    const db = getDb()
    const rows = db
      .prepare(
        "SELECT * FROM messages WHERE session_id = ? AND workspace_id = ? ORDER BY position ASC",
      )
      .all(sessionId, workspaceId) as Record<string, unknown>[]
    return rows.map(rowToItem)
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

    // Check current session name to conditionally auto-rename
    const sessionRows = db
      .prepare("SELECT name FROM sessions WHERE id = ?")
      .all(sessionId) as Record<string, unknown>[]
    const currentName =
      sessionRows.length > 0
        ? (sessionRows[0].name as string | null)
        : null
    const newName =
      autoName && currentName === "Phiên mới"
        ? autoName
        : (currentName ?? "Phiên mới")

    db.exec("BEGIN")
    try {
      db.prepare(
        "DELETE FROM messages WHERE session_id = ? AND workspace_id = ?",
      ).run(sessionId, workspaceId)

      for (let i = 0; i < messages.length; i++) {
        const item = messages[i]
        if (item.type === "user_message") {
          db.prepare(
            "INSERT INTO messages (session_id, workspace_id, position, type, content) VALUES (?, ?, ?, ?, ?)",
          ).run(sessionId, workspaceId, i, "user_message", item.content)
        } else if (item.type === "assistant_message") {
          db.prepare(
            "INSERT INTO messages (session_id, workspace_id, position, type, content, thinking) VALUES (?, ?, ?, ?, ?, ?)",
          ).run(
            sessionId,
            workspaceId,
            i,
            "assistant_message",
            item.content,
            item.thinking ?? null,
          )
        } else if (item.type === "reasoning_block") {
          db.prepare(
            "INSERT INTO messages (session_id, workspace_id, position, type, content) VALUES (?, ?, ?, ?, ?)",
          ).run(sessionId, workspaceId, i, "reasoning_block", item.content)
        } else if (item.type === "tool_call") {
          db.prepare(
            "INSERT INTO messages (session_id, workspace_id, position, type, tool_name, label, args, result) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          ).run(
            sessionId,
            workspaceId,
            i,
            "tool_call",
            item.toolName,
            item.label,
            JSON.stringify(item.args),
            item.result,
          )
        }
      }

      db.prepare(
        "UPDATE sessions SET updated_at = ?, name = ? WHERE id = ?",
      ).run(Date.now(), newName, sessionId)

      db.exec("COMMIT")
    } catch (e) {
      db.exec("ROLLBACK")
      throw e
    }
  },
}
