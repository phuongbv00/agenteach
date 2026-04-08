import { getDb } from "../db"

export interface Artifact {
  id: string
  sessionId: string
  workspaceId: string
  filePath: string
  fileName: string
  type: "pdf" | "docx" | "md"
  createdAt: number
}

function rowToArtifact(row: Record<string, unknown>): Artifact {
  return {
    id: row.id as string,
    sessionId: row.session_id as string,
    workspaceId: row.workspace_id as string,
    filePath: row.file_path as string,
    fileName: row.file_name as string,
    type: row.type as "pdf" | "docx" | "md",
    createdAt: row.created_at as number,
  }
}

export const ArtifactStore = {
  async list(workspaceId: string, sessionId: string): Promise<Artifact[]> {
    const db = getDb()
    const res = await db.execute({
      sql: "SELECT * FROM artifacts WHERE workspace_id = ? AND session_id = ? ORDER BY created_at DESC",
      args: [workspaceId, sessionId],
    })
    return res.rows.map((r) => rowToArtifact(r as Record<string, unknown>))
  },

  async add(artifact: Omit<Artifact, "id" | "createdAt">): Promise<Artifact> {
    const db = getDb()
    const newArtifact: Artifact = {
      ...artifact,
      id: Date.now().toString(),
      createdAt: Date.now(),
    }
    await db.execute({
      sql: "INSERT INTO artifacts (id, session_id, workspace_id, file_path, file_name, type, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      args: [
        newArtifact.id,
        newArtifact.sessionId,
        newArtifact.workspaceId,
        newArtifact.filePath,
        newArtifact.fileName,
        newArtifact.type,
        newArtifact.createdAt,
      ],
    })
    return newArtifact
  },

  async delete(
    workspaceId: string,
    sessionId: string,
    artifactId: string,
  ): Promise<void> {
    const db = getDb()
    await db.execute({
      sql: "DELETE FROM artifacts WHERE id = ? AND workspace_id = ? AND session_id = ?",
      args: [artifactId, workspaceId, sessionId],
    })
  },
}
