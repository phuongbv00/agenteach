import React, { useEffect, useState } from 'react';
import SetupWizard from './components/SetupWizard';
import WorkspaceSidebar from './components/WorkspaceSidebar';
import ChatPanel from './components/ChatPanel';
import HitlApprovalDialog from './components/HitlApprovalDialog';
import SettingsPanel from './components/SettingsPanel';
import PreviewPanel from './components/PreviewPanel';
import { useAppStore } from './stores/appStore';
import { useChatStore } from './stores/chatStore';
import type { PreviewData } from './types/api';

type View = 'loading' | 'setup' | 'main';

export default function App() {
  const [view, setView] = useState<View>('loading');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [preview, setPreview] = useState<PreviewData | null>(null);

  const {
    setConfig, setOllamaOk, setWorkspaces, setActiveWorkspace,
    setSessions, setActiveSessionId, setArtifacts, prependArtifact,
  } = useAppStore();
  const { loadItems, clear } = useChatStore();

  const loadAppState = async () => {
    const [config, workspaces] = await Promise.all([
      window.api.getConfig(),
      window.api.listWorkspaces(),
    ]);

    setConfig(config);
    setWorkspaces(workspaces);

    const active = workspaces.find((w) => w.id === config.activeWorkspaceId) ?? null;
    setActiveWorkspace(active);

    if (active) {
      let sessions = await window.api.listSessions(active.id);
      if (sessions.length === 0) {
        const session = await window.api.createSession(active.id);
        sessions = [session];
      }
      setSessions(sessions);
      const latest = sessions[0];
      setActiveSessionId(latest.id);
      const messages = await window.api.loadSessionMessages(active.id, latest.id);
      if (messages.length > 0) loadItems(messages);
      else clear();
      const artifacts = await window.api.listArtifacts(active.id, latest.id);
      setArtifacts(artifacts);
    }

    const ollamaOk = await window.api.checkOllama();
    setOllamaOk(ollamaOk);

    setView(config.setupComplete ? 'main' : 'setup');
  };

  useEffect(() => {
    loadAppState();
  }, []);

  // Listen for file preview and artifact events from main process
  useEffect(() => {
    window.api.onPreviewFile((data) => setPreview(data));
    window.api.onArtifactCreated((artifact) => prependArtifact(artifact));
    return () => {
      window.api.offPreviewFile();
      window.api.offArtifactCreated();
    };
  }, []);

  const handleSetupComplete = async () => {
    await loadAppState();
    setView('main');
  };

  const handleWorkspaceChange = async () => {
    const [config, workspaces] = await Promise.all([
      window.api.getConfig(),
      window.api.listWorkspaces(),
    ]);
    setConfig(config);
    setWorkspaces(workspaces);
    const active = workspaces.find((w) => w.id === config.activeWorkspaceId) ?? null;
    setActiveWorkspace(active);
  };

  if (view === 'loading') {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50">
        <div className="text-gray-400 text-sm">Đang khởi động...</div>
      </div>
    );
  }

  if (view === 'setup') {
    return <SetupWizard onComplete={handleSetupComplete} />;
  }

  return (
    <div className="flex h-full">
      <WorkspaceSidebar
        onWorkspaceChange={handleWorkspaceChange}
        onOpenSettings={() => setSettingsOpen(true)}
        onPreviewArtifact={(filePath, type, fileName) =>
          setPreview({ filePath, type: type as PreviewData['type'], fileName })
        }
      />
      <ChatPanel />
      {preview && (
        <PreviewPanel data={preview} onClose={() => setPreview(null)} />
      )}
      <HitlApprovalDialog />
      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
