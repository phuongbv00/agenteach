import fs from 'fs';
import path from 'path';
import { dataDir } from '../utils/dataDir';

export interface Artifact {
  id: string;
  sessionId: string;
  workspaceId: string;
  filePath: string;
  fileName: string;
  type: 'pdf' | 'docx' | 'md';
  createdAt: number;
}

function artifactFile(workspaceId: string, sessionId: string): string {
  return dataDir('workspaces', workspaceId, 'sessions', sessionId, 'artifacts.json');
}

function loadRaw(workspaceId: string, sessionId: string): Artifact[] {
  const p = artifactFile(workspaceId, sessionId);
  if (!fs.existsSync(p)) return [];
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8')) as Artifact[];
  } catch {
    return [];
  }
}

function saveRaw(workspaceId: string, sessionId: string, artifacts: Artifact[]): void {
  const p = artifactFile(workspaceId, sessionId);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(artifacts, null, 2), 'utf-8');
}

export const ArtifactStore = {
  list(workspaceId: string, sessionId: string): Artifact[] {
    return loadRaw(workspaceId, sessionId);
  },

  add(artifact: Omit<Artifact, 'id' | 'createdAt'>): Artifact {
    const artifacts = loadRaw(artifact.workspaceId, artifact.sessionId);
    const newArtifact: Artifact = {
      ...artifact,
      id: Date.now().toString(),
      createdAt: Date.now(),
    };
    artifacts.unshift(newArtifact);
    saveRaw(artifact.workspaceId, artifact.sessionId, artifacts);
    return newArtifact;
  },

  delete(workspaceId: string, sessionId: string, artifactId: string): void {
    const artifacts = loadRaw(workspaceId, sessionId).filter((a) => a.id !== artifactId);
    saveRaw(workspaceId, sessionId, artifacts);
  },
};
