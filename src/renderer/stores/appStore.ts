import { create } from 'zustand';
import type { AppConfigData, Workspace, Session, Artifact } from '../types/api';

interface AppState {
  config: AppConfigData | null;
  ollamaOk: boolean;
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  sessions: Session[];
  activeSessionId: string | null;
  artifacts: Artifact[];

  setConfig(config: AppConfigData): void;
  setOllamaOk(ok: boolean): void;
  setWorkspaces(ws: Workspace[]): void;
  setActiveWorkspace(ws: Workspace | null): void;
  setSessions(sessions: Session[]): void;
  setActiveSessionId(id: string | null): void;
  setArtifacts(artifacts: Artifact[]): void;
  prependArtifact(artifact: Artifact): void;
  removeArtifact(id: string): void;
}

export const useAppStore = create<AppState>((set) => ({
  config: null,
  ollamaOk: false,
  workspaces: [],
  activeWorkspace: null,
  sessions: [],
  activeSessionId: null,
  artifacts: [],

  setConfig: (config) => set({ config }),
  setOllamaOk: (ok) => set({ ollamaOk: ok }),
  setWorkspaces: (workspaces) => set({ workspaces }),
  setActiveWorkspace: (activeWorkspace) => set({ activeWorkspace }),
  setSessions: (sessions) => set({ sessions }),
  setActiveSessionId: (activeSessionId) => set({ activeSessionId }),
  setArtifacts: (artifacts) => set({ artifacts }),
  prependArtifact: (artifact) => set((s) => ({ artifacts: [artifact, ...s.artifacts] })),
  removeArtifact: (id) => set((s) => ({ artifacts: s.artifacts.filter((a) => a.id !== id) })),
}));
