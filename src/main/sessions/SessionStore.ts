import type { ModelMessage } from "ai";
import { getDb } from "../db";
import { generateId } from "../utils/generateId";

export interface Session {
  id: string;
  workspaceId: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

function rowToSession(row: Record<string, unknown>): Session {
  return {
    id: row.id as string,
    workspaceId: row.workspace_id as string,
    name: row.name as string,
    createdAt: row.created_at as number,
    updatedAt: row.updated_at as number,
  };
}

export const SessionStore = {
  async list(workspaceId: string): Promise<Session[]> {
    const db = getDb();
    const rows = db
      .prepare(
        "SELECT * FROM sessions WHERE workspace_id = ? ORDER BY updated_at DESC",
      )
      .all(workspaceId) as Record<string, unknown>[];
    return rows.map(rowToSession);
  },

  async create(workspaceId: string, name = "Phiên mới"): Promise<Session> {
    const db = getDb();
    const session: Session = {
      id: "SS-" + generateId(),
      workspaceId,
      name,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    db.prepare(
      "INSERT INTO sessions (id, workspace_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
    ).run(
      session.id,
      session.workspaceId,
      session.name,
      session.createdAt,
      session.updatedAt,
    );
    return session;
  },

  async rename(
    workspaceId: string,
    sessionId: string,
    name: string,
  ): Promise<void> {
    const db = getDb();
    db.prepare(
      "UPDATE sessions SET name = ?, updated_at = ? WHERE id = ? AND workspace_id = ?",
    ).run(name, Date.now(), sessionId, workspaceId);
  },

  async delete(workspaceId: string, sessionId: string): Promise<void> {
    const db = getDb();
    db.exec("BEGIN");
    try {
      db.prepare(
        "DELETE FROM messages WHERE session_id = ? AND workspace_id = ?",
      ).run(sessionId, workspaceId);
      db.prepare(
        "DELETE FROM artifacts WHERE session_id = ? AND workspace_id = ?",
      ).run(sessionId, workspaceId);
      db.prepare("DELETE FROM sessions WHERE id = ? AND workspace_id = ?").run(
        sessionId,
        workspaceId,
      );
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  },

  async loadMessages(
    workspaceId: string,
    sessionId: string,
  ): Promise<ModelMessage[]> {
    const db = getDb();
    const rows = db
      .prepare(
        "SELECT role, content FROM messages WHERE session_id = ? AND workspace_id = ? ORDER BY position ASC",
      )
      .all(sessionId, workspaceId) as Array<{ role: string; content: string }>;
    return rows.map((row) => ({
      role: row.role,
      content: JSON.parse(row.content),
    })) as ModelMessage[];
  },

  async appendMessages(
    workspaceId: string,
    sessionId: string,
    messages: ModelMessage[],
    fromPosition: number,
  ): Promise<void> {
    if (messages.length === 0) return;
    const db = getDb();

    // Auto-name from first user message in this batch if session still has default name
    const firstUser = messages.find((m) => m.role === "user");
    let autoName: string | null = null;
    if (firstUser && typeof firstUser.content === "string") {
      autoName =
        firstUser.content.slice(0, 40) +
        (firstUser.content.length > 40 ? "..." : "");
    }

    db.exec("BEGIN");
    try {
      const stmt = db.prepare(
        "INSERT INTO messages (session_id, workspace_id, position, role, content) VALUES (?, ?, ?, ?, ?)",
      );
      for (let i = 0; i < messages.length; i++) {
        stmt.run(
          sessionId,
          workspaceId,
          fromPosition + i,
          messages[i].role,
          JSON.stringify(messages[i].content),
        );
      }

      if (autoName) {
        db.prepare(
          "UPDATE sessions SET updated_at = ?, name = CASE WHEN name = ? THEN ? ELSE name END WHERE id = ?",
        ).run(Date.now(), "Phiên mới", autoName, sessionId);
      } else {
        db.prepare("UPDATE sessions SET updated_at = ? WHERE id = ?").run(
          Date.now(),
          sessionId,
        );
      }

      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  },

};
