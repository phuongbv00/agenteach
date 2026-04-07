import fs from 'fs';
import path from 'path';
import { dataDir } from '../utils/dataDir';

export interface MemoryLayer {
  user: { name: string; subject: string; grades: string[] };
  style: Record<string, string>;
  feedback: string[];
  context: string[];
  updatedAt: number;
}

// backward compat alias
export type Memory = MemoryLayer;

export interface AllMemory {
  global: MemoryLayer;
  workspace: MemoryLayer;
}

const DEFAULT_LAYER = (): MemoryLayer => ({
  user: { name: '', subject: '', grades: [] },
  style: {},
  feedback: [],
  context: [],
  updatedAt: 0,
});

function readLayer(filePath: string): MemoryLayer {
  try {
    return { ...DEFAULT_LAYER(), ...JSON.parse(fs.readFileSync(filePath, 'utf-8')) };
  } catch {
    return DEFAULT_LAYER();
  }
}

function writeLayer(filePath: string, layer: MemoryLayer): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify({ ...layer, updatedAt: Date.now() }, null, 2), 'utf-8');
}

function mergeLayer(base: MemoryLayer, patch: Partial<MemoryLayer>): MemoryLayer {
  return {
    ...base,
    ...patch,
    user: { ...base.user, ...(patch.user ?? {}) },
    style: { ...base.style, ...(patch.style ?? {}) },
    feedback: patch.feedback ?? base.feedback,
    context: patch.context ?? base.context,
  };
}

export const MemoryStore = {
  // ── Global ──────────────────────────────────────────────────────────
  globalPath(): string {
    return dataDir('memory', 'global.json');
  },

  loadGlobal(): MemoryLayer {
    return readLayer(this.globalPath());
  },

  saveGlobal(layer: MemoryLayer): void {
    writeLayer(this.globalPath(), layer);
  },

  updateGlobal(patch: Partial<MemoryLayer>): MemoryLayer {
    const updated = mergeLayer(this.loadGlobal(), patch);
    this.saveGlobal(updated);
    return updated;
  },

  // ── Workspace ────────────────────────────────────────────────────────
  workspacePath(workspaceId: string): string {
    return dataDir('memory', `${workspaceId}.json`);
  },

  loadWorkspace(workspaceId: string): MemoryLayer {
    return readLayer(this.workspacePath(workspaceId));
  },

  saveWorkspace(workspaceId: string, layer: MemoryLayer): void {
    writeLayer(this.workspacePath(workspaceId), layer);
  },

  updateWorkspace(workspaceId: string, patch: Partial<MemoryLayer>): MemoryLayer {
    const updated = mergeLayer(this.loadWorkspace(workspaceId), patch);
    this.saveWorkspace(workspaceId, updated);
    return updated;
  },

  // ── Both layers ──────────────────────────────────────────────────────
  loadAll(workspaceId: string): AllMemory {
    return {
      global: this.loadGlobal(),
      workspace: this.loadWorkspace(workspaceId),
    };
  },

  // ── Backward-compat aliases ──────────────────────────────────────────
  load(workspaceId: string): MemoryLayer {
    return this.loadWorkspace(workspaceId);
  },

  save(workspaceId: string, layer: MemoryLayer): void {
    this.saveWorkspace(workspaceId, layer);
  },

  update(workspaceId: string, patch: Partial<MemoryLayer>): MemoryLayer {
    return this.updateWorkspace(workspaceId, patch);
  },
};
