import fs from 'fs';
import path from 'path';
import { dataDir } from '../utils/dataDir';
import { generateId } from '../utils/generateId';

export interface Session {
  id: string;
  workspaceId: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

// Legacy format (v1) – kept for migration only
export interface StoredMessage {
  role: 'user' | 'assistant';
  content: string;
}

// Structured format (v2)
export type StoredChatItem =
  | { type: 'user_message'; content: string }
  | { type: 'assistant_message'; thinking?: string; content: string }
  | { type: 'tool_call'; toolName: string; label: string; args: Record<string, unknown>; result: string };

function migrateItems(raw: unknown[]): StoredChatItem[] {
  if (!raw.length) return [];
  // v1: items have a `role` field instead of `type`
  if ((raw[0] as Record<string, unknown>).role !== undefined) {
    return (raw as StoredMessage[]).map((m) =>
      m.role === 'user'
        ? { type: 'user_message', content: m.content }
        : { type: 'assistant_message', content: m.content }
    );
  }
  return raw as StoredChatItem[];
}

function sessionsDir(workspaceId: string): string {
  return dataDir('workspaces', workspaceId, 'sessions');
}

function indexPath(workspaceId: string): string {
  return path.join(sessionsDir(workspaceId), 'index.json');
}

function sessionDir(workspaceId: string, sessionId: string): string {
  return path.join(sessionsDir(workspaceId), sessionId);
}

function messagesPath(workspaceId: string, sessionId: string): string {
  return path.join(sessionDir(workspaceId, sessionId), 'messages.json');
}

export const SessionStore = {
  list(workspaceId: string): Session[] {
    try {
      const raw = fs.readFileSync(indexPath(workspaceId), 'utf-8');
      const sessions = JSON.parse(raw) as Session[];
      return sessions.sort((a, b) => b.updatedAt - a.updatedAt);
    } catch {
      return [];
    }
  },

  create(workspaceId: string, name = 'Phiên mới'): Session {
    const session: Session = {
      id: 'SS-' + generateId(),
      workspaceId,
      name,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    fs.mkdirSync(sessionDir(workspaceId, session.id), { recursive: true });

    const existing: Session[] = this.list(workspaceId);
    fs.writeFileSync(indexPath(workspaceId), JSON.stringify([...existing, session], null, 2));
    fs.writeFileSync(messagesPath(workspaceId, session.id), '[]');
    return session;
  },

  rename(workspaceId: string, sessionId: string, name: string): void {
    const sessions: Session[] = this.list(workspaceId);
    const s = sessions.find((x: Session) => x.id === sessionId);
    if (s) {
      s.name = name;
      s.updatedAt = Date.now();
      fs.writeFileSync(indexPath(workspaceId), JSON.stringify(sessions, null, 2));
    }
  },

  delete(workspaceId: string, sessionId: string): void {
    const sessions = this.list(workspaceId).filter((s: Session) => s.id !== sessionId);
    fs.writeFileSync(indexPath(workspaceId), JSON.stringify(sessions, null, 2));
    try { fs.rmSync(sessionDir(workspaceId, sessionId), { recursive: true, force: true }); } catch { /* ok */ }
  },

  loadMessages(workspaceId: string, sessionId: string): StoredChatItem[] {
    try {
      const raw = JSON.parse(fs.readFileSync(messagesPath(workspaceId, sessionId), 'utf-8'));
      return migrateItems(raw);
    } catch {
      return [];
    }
  },

  saveMessages(workspaceId: string, sessionId: string, messages: StoredChatItem[]): void {
    fs.mkdirSync(sessionDir(workspaceId, sessionId), { recursive: true });
    fs.writeFileSync(messagesPath(workspaceId, sessionId), JSON.stringify(messages, null, 2));

    // bump updatedAt in index
    const sessions: Session[] = this.list(workspaceId);
    const s = sessions.find((x: Session) => x.id === sessionId);
    if (s) {
      s.updatedAt = Date.now();
      // auto-name from first user message
      const firstUser = messages.find((m) => m.type === 'user_message') as { type: 'user_message'; content: string } | undefined;
      if (s.name === 'Phiên mới' && firstUser) {
        s.name = firstUser.content.slice(0, 40) + (firstUser.content.length > 40 ? '...' : '');
      }
      fs.writeFileSync(indexPath(workspaceId), JSON.stringify(sessions, null, 2));
    }
  },
};
