import React, { useState, useEffect } from "react";
import {
  ChevronDown,
  ChevronRight,
  ClipboardList,
  ExternalLink,
  FileEdit,
  FileText,
  Folder,
  Plus,
  Settings,
  X,
} from "lucide-react";
import { useAppStore } from "../stores/appStore";
import { useChatStore } from "../stores/chatStore";
import type { Workspace, Session, Artifact } from "../types/api";

interface Props {
  onWorkspaceChange: () => void;
  onOpenSettings: () => void;
  onPreviewArtifact: (filePath: string, type: string, fileName: string) => void;
}

export default function WorkspaceSidebar({
  onWorkspaceChange,
  onOpenSettings,
  onPreviewArtifact,
}: Props) {
  const {
    workspaces,
    activeWorkspace,
    setActiveWorkspace,
    setWorkspaces,
    sessions,
    setSessions,
    activeSessionId,
    setActiveSessionId,
    artifacts,
    setArtifacts,
    removeArtifact,
  } = useAppStore();
  const { loadItems, clear } = useChatStore();

  const [creatingWorkspace, setCreatingWorkspace] = useState(false);
  const [newWsName, setNewWsName] = useState("");
  const [renamingSessionId, setRenamingSessionId] = useState<string | null>(
    null,
  );
  const [renameValue, setRenameValue] = useState("");
  const [artifactsOpen, setArtifactsOpen] = useState(true);

  // Load sessions when workspace changes
  useEffect(() => {
    if (activeWorkspace) {
      window.api.listSessions(activeWorkspace.id).then(setSessions);
    } else {
      setSessions([]);
    }
  }, [activeWorkspace?.id]);

  // Load artifacts when session changes
  useEffect(() => {
    if (activeWorkspace && activeSessionId) {
      window.api
        .listArtifacts(activeWorkspace.id, activeSessionId)
        .then(setArtifacts);
    } else {
      setArtifacts([]);
    }
  }, [activeWorkspace?.id, activeSessionId]);

  const handleDeleteArtifact = async (
    e: React.MouseEvent,
    artifact: Artifact,
  ) => {
    e.stopPropagation();
    if (!activeWorkspace || !activeSessionId) return;
    await window.api.deleteArtifact(
      activeWorkspace.id,
      activeSessionId,
      artifact.id,
    );
    removeArtifact(artifact.id);
  };

  const handleCreateWorkspace = async () => {
    if (!newWsName.trim()) return;
    const ws = await window.api.createWorkspace(newWsName.trim());
    if (ws) {
      const list = await window.api.listWorkspaces();
      setWorkspaces(list);
      setActiveWorkspace(ws);
      // auto-create first session
      const session = await window.api.createSession(ws.id);
      setSessions([session]);
      setActiveSessionId(session.id);
      clear();
      onWorkspaceChange();
    }
    setCreatingWorkspace(false);
    setNewWsName("");
  };

  const handleSelectWorkspace = async (ws: Workspace) => {
    if (ws.id === activeWorkspace?.id) return;
    await window.api.setActiveWorkspace(ws.id);
    setActiveWorkspace(ws);
    const sessionList = await window.api.listSessions(ws.id);
    setSessions(sessionList);
    if (sessionList.length > 0) {
      await loadSession(ws.id, sessionList[0]);
    } else {
      const session = await window.api.createSession(ws.id);
      setSessions([session]);
      setActiveSessionId(session.id);
      clear();
    }
    onWorkspaceChange();
  };

  const handleDeleteWorkspace = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm("Xoá workspace này? (Thư mục trên máy không bị xoá)")) return;
    await window.api.deleteWorkspace(id);
    const list = await window.api.listWorkspaces();
    setWorkspaces(list);
    const config = await window.api.getConfig();
    const newActive =
      list.find((w) => w.id === config.activeWorkspaceId) ?? null;
    setActiveWorkspace(newActive);
    if (newActive) {
      const sessionList = await window.api.listSessions(newActive.id);
      setSessions(sessionList);
      if (sessionList.length > 0)
        await loadSession(newActive.id, sessionList[0]);
      else clear();
    } else {
      setSessions([]);
      clear();
    }
    onWorkspaceChange();
  };

  const loadSession = async (workspaceId: string, session: Session) => {
    setActiveSessionId(session.id);
    const messages = await window.api.loadSessionMessages(
      workspaceId,
      session.id,
    );
    loadItems(messages);
  };

  const handleSelectSession = async (session: Session) => {
    if (!activeWorkspace || session.id === activeSessionId) return;
    await loadSession(activeWorkspace.id, session);
  };

  const handleNewSession = async () => {
    if (!activeWorkspace) return;
    const session = await window.api.createSession(activeWorkspace.id);
    const list = await window.api.listSessions(activeWorkspace.id);
    setSessions(list);
    setActiveSessionId(session.id);
    clear();
  };

  const handleDeleteSession = async (
    e: React.MouseEvent,
    sessionId: string,
  ) => {
    e.stopPropagation();
    if (!activeWorkspace) return;
    await window.api.deleteSession(activeWorkspace.id, sessionId);
    const list = await window.api.listSessions(activeWorkspace.id);
    setSessions(list);
    if (activeSessionId === sessionId) {
      if (list.length > 0) {
        await loadSession(activeWorkspace.id, list[0]);
      } else {
        const session = await window.api.createSession(activeWorkspace.id);
        setSessions([session]);
        setActiveSessionId(session.id);
        clear();
      }
    }
  };

  const handleRenameSession = async (sessionId: string) => {
    if (!activeWorkspace || !renameValue.trim()) {
      setRenamingSessionId(null);
      return;
    }
    await window.api.renameSession(
      activeWorkspace.id,
      sessionId,
      renameValue.trim(),
    );
    const list = await window.api.listSessions(activeWorkspace.id);
    setSessions(list);
    setRenamingSessionId(null);
  };

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    const now = new Date();
    const diff = now.getTime() - ts;
    if (diff < 86400000 && d.getDate() === now.getDate()) {
      return d.toLocaleTimeString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
      });
    }
    return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 text-gray-100 w-60 flex-shrink-0 border-r border-gray-800">
      {/* Workspaces section */}
      <div className="flex-shrink-0">
        <div className="px-3 pt-4 pb-2 flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Workspace
          </span>
        </div>
        <div className="px-2 space-y-0.5">
          {workspaces.map((ws) => (
            <div
              key={ws.id}
              onClick={() => handleSelectWorkspace(ws)}
              className={`group flex items-center justify-between px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${
                activeWorkspace?.id === ws.id
                  ? "bg-gray-700 text-white"
                  : "hover:bg-gray-800 text-gray-400"
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <Folder size={14} className="flex-shrink-0" />
                <span className="text-sm truncate">{ws.name}</span>
              </div>
              <button
                onClick={(e) => handleDeleteWorkspace(e, ws.id)}
                className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 px-1 flex-shrink-0"
              >
                <X size={10} />
              </button>
            </div>
          ))}
          {workspaces.length === 0 && (
            <p className="text-xs text-gray-600 px-2 py-1">Chưa có workspace</p>
          )}
        </div>

        {/* Create workspace */}
        <div className="px-2 mt-1 mb-2">
          {creatingWorkspace ? (
            <div className="space-y-1.5 p-2 bg-gray-800 rounded-lg">
              <input
                autoFocus
                type="text"
                placeholder="Tên workspace..."
                value={newWsName}
                onChange={(e) => setNewWsName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateWorkspace();
                  if (e.key === "Escape") {
                    setCreatingWorkspace(false);
                    setNewWsName("");
                  }
                }}
                className="w-full bg-gray-700 text-white text-xs px-2 py-1.5 rounded border border-gray-600 outline-none focus:border-blue-400"
              />
              <div className="flex gap-1">
                <button
                  onClick={handleCreateWorkspace}
                  className="flex-1 text-xs bg-blue-600 hover:bg-blue-700 text-white py-1 rounded"
                >
                  Chọn thư mục
                </button>
                <button
                  onClick={() => {
                    setCreatingWorkspace(false);
                    setNewWsName("");
                  }}
                  className="text-xs text-gray-500 px-2"
                >
                  Huỷ
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setCreatingWorkspace(true)}
              className="w-full text-xs text-gray-500 hover:text-gray-300 hover:bg-gray-800 py-1.5 px-2 rounded-lg transition-colors text-left"
            >
              + Workspace mới
            </button>
          )}
        </div>
      </div>

      <div className="border-t border-gray-800 my-1" />

      {/* Sessions section */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="px-3 py-2 flex items-center justify-between flex-shrink-0">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Phiên làm việc
          </span>
          {activeWorkspace && (
            <button
              onClick={handleNewSession}
              className="text-gray-500 hover:text-gray-300 transition-colors"
              title="Phiên làm việc mới"
            >
              <Plus size={14} />
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-2 space-y-0.5 pb-2">
          {!activeWorkspace && (
            <p className="text-xs text-gray-600 px-2">
              Chọn workspace để xem phiên làm việc
            </p>
          )}
          {sessions.map((session) => (
            <div
              key={session.id}
              onClick={() => handleSelectSession(session)}
              onDoubleClick={() => {
                setRenamingSessionId(session.id);
                setRenameValue(session.name);
              }}
              className={`group flex items-start justify-between px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${
                activeSessionId === session.id
                  ? "bg-blue-600 text-white"
                  : "hover:bg-gray-800 text-gray-400"
              }`}
            >
              {renamingSessionId === session.id ? (
                <input
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleRenameSession(session.id);
                    if (e.key === "Escape") setRenamingSessionId(null);
                  }}
                  onBlur={() => handleRenameSession(session.id)}
                  onClick={(e) => e.stopPropagation()}
                  className="flex-1 bg-gray-700 text-white text-xs px-1 py-0.5 rounded outline-none"
                />
              ) : (
                <>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs leading-tight truncate">
                      {session.name}
                    </p>
                    <p
                      className={`text-xs mt-0.5 ${activeSessionId === session.id ? "text-blue-200" : "text-gray-600"}`}
                    >
                      {formatDate(session.updatedAt)}
                    </p>
                  </div>
                  <button
                    onClick={(e) => handleDeleteSession(e, session.id)}
                    className="opacity-0 group-hover:opacity-100 text-white hover:text-red-400 flex-shrink-0 -mr-1"
                  >
                    <X size={14} />
                  </button>
                </>
              )}
            </div>
          ))}
          {activeWorkspace && sessions.length === 0 && (
            <p className="text-xs text-gray-600 px-2">
              Chưa có phiên làm việc nào
            </p>
          )}
        </div>
      </div>

      {/* Artifacts section */}
      {activeSessionId && (
        <>
          <div className="border-t border-gray-800 flex-shrink-0">
            <button
              onClick={() => setArtifactsOpen((o) => !o)}
              className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-300 transition-colors"
            >
              <span>Tài liệu đã tạo</span>
              {artifactsOpen ? (
                <ChevronDown size={14} className="text-gray-600" />
              ) : (
                <ChevronRight size={14} className="text-gray-600" />
              )}
            </button>
          </div>
          {artifactsOpen && (
            <div className="flex-shrink-0 max-h-44 overflow-y-auto px-2 pb-2 space-y-0.5">
              {artifacts.length === 0 && (
                <p className="text-xs text-gray-600 px-2 py-1">
                  Chưa có tài liệu nào
                </p>
              )}
              {artifacts.map((artifact) => {
                const ArtifactIcon =
                  artifact.type === "pdf"
                    ? FileText
                    : artifact.type === "docx"
                      ? FileEdit
                      : ClipboardList;
                return (
                  <div
                    key={artifact.id}
                    onClick={() =>
                      onPreviewArtifact(
                        artifact.filePath,
                        artifact.type,
                        artifact.fileName,
                      )
                    }
                    className="group flex items-center gap-1.5 px-2 py-1.5 rounded-lg cursor-pointer hover:bg-gray-800 transition-colors"
                  >
                    <ArtifactIcon
                      size={14}
                      className="flex-shrink-0 text-gray-500"
                    />
                    <span className="text-xs text-gray-400 group-hover:text-gray-200 truncate flex-1">
                      {artifact.fileName}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        window.api.openFile(artifact.filePath);
                      }}
                      title="Mở ngoài"
                      className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-blue-400 flex-shrink-0 px-0.5"
                    >
                      <ExternalLink size={12} />
                    </button>
                    <button
                      onClick={(e) => handleDeleteArtifact(e, artifact)}
                      title="Xoá khỏi danh sách"
                      className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 flex-shrink-0 px-0.5"
                    >
                      <X size={10} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Settings button */}
      <div className="border-t border-gray-800 p-2 flex-shrink-0">
        <button
          onClick={onOpenSettings}
          className="w-full flex items-center gap-2 p-2 text-gray-500 hover:text-gray-300 hover:bg-gray-800 rounded-lg transition-colors text-sm"
        >
          <Settings size={14} />
          <span>Cài đặt</span>
        </button>
      </div>
    </div>
  );
}
