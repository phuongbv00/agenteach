import fs from 'fs';
import path from 'path';
import { dataDir } from '../utils/dataDir';
import { generateId } from '../utils/generateId';

export interface Workspace {
  id: string;
  name: string;
  path: string;
  createdAt: number;
  lastOpenedAt: number;
}

const workspacesPath = () => dataDir('workspaces', 'index.json');

function loadAll(): Workspace[] {
  try {
    return JSON.parse(fs.readFileSync(workspacesPath(), 'utf-8')) as Workspace[];
  } catch {
    return [];
  }
}

function saveAll(workspaces: Workspace[]): void {
  const p = workspacesPath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(workspaces, null, 2), 'utf-8');
}

export const WorkspaceManager = {
  list(): Workspace[] {
    return loadAll();
  },

  create(name: string, folderPath: string): Workspace {
    const workspaces = loadAll();
    const ws: Workspace = {
      id: 'WS-' + generateId(),
      name,
      path: folderPath,
      createdAt: Date.now(),
      lastOpenedAt: Date.now(),
    };
    workspaces.push(ws);
    saveAll(workspaces);
    return ws;
  },

  get(id: string): Workspace | null {
    return loadAll().find((w) => w.id === id) ?? null;
  },

  touch(id: string): void {
    const workspaces = loadAll();
    const ws = workspaces.find((w) => w.id === id);
    if (ws) {
      ws.lastOpenedAt = Date.now();
      saveAll(workspaces);
    }
  },

  delete(id: string): void {
    const workspaces = loadAll().filter((w) => w.id !== id);
    saveAll(workspaces);
  },

  isPathInWorkspace(filePath: string, workspace: Workspace): boolean {
    const normalized = path.resolve(filePath);
    const wsPath = path.resolve(workspace.path);
    return normalized.startsWith(wsPath + path.sep) || normalized === wsPath;
  },
};
