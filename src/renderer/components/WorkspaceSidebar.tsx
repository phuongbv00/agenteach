import { useState, useEffect } from "react";
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Folder,
  FolderOpen,
  Plus,
  Settings,
  X,
} from "lucide-react";
import { useAppStore } from "../stores/appStore";
import { useChatStore } from "../stores/chatStore";
import type { Workspace, Session, Artifact } from "../types/api";
import { Button } from "@/renderer/components/ui/button";
import { Input } from "@/renderer/components/ui/input";
import { Badge } from "@/renderer/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/renderer/components/ui/collapsible";

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
  const [renamingSessionId, setRenamingSessionId] = useState<string | null>(null);
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
      window.api.listArtifacts(activeWorkspace.id, activeSessionId).then(setArtifacts);
    } else {
      setArtifacts([]);
    }
  }, [activeWorkspace?.id, activeSessionId]);

  const handleDeleteArtifact = async (e: React.MouseEvent, artifact: Artifact) => {
    e.stopPropagation();
    if (!activeWorkspace || !activeSessionId) return;
    await window.api.deleteArtifact(activeWorkspace.id, activeSessionId, artifact.id);
    removeArtifact(artifact.id);
  };

  const handleCreateWorkspace = async () => {
    if (!newWsName.trim()) return;
    const ws = await window.api.createWorkspace(newWsName.trim());
    if (ws) {
      const list = await window.api.listWorkspaces();
      setWorkspaces(list);
      setActiveWorkspace(ws);
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
    const newActive = list.find((w) => w.id === config.activeWorkspaceId) ?? null;
    setActiveWorkspace(newActive);
    if (newActive) {
      const sessionList = await window.api.listSessions(newActive.id);
      setSessions(sessionList);
      if (sessionList.length > 0) await loadSession(newActive.id, sessionList[0]);
      else clear();
    } else {
      setSessions([]);
      clear();
    }
    onWorkspaceChange();
  };

  const loadSession = async (workspaceId: string, session: Session) => {
    setActiveSessionId(session.id);
    const messages = await window.api.loadSessionMessages(workspaceId, session.id);
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

  const handleDeleteSession = async (e: React.MouseEvent, sessionId: string) => {
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
    await window.api.renameSession(activeWorkspace.id, sessionId, renameValue.trim());
    const list = await window.api.listSessions(activeWorkspace.id);
    setSessions(list);
    setRenamingSessionId(null);
  };

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    const now = new Date();
    const diff = now.getTime() - ts;
    if (diff < 86400000 && d.getDate() === now.getDate()) {
      return d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
    }
    return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
  };

  return (
    <div className="flex flex-col h-full bg-sidebar w-60 flex-shrink-0 border-r">
      {/* Workspaces section */}
      <div className="flex-shrink-0">
        <div className="px-3 py-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
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
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "hover:bg-muted"
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                {activeWorkspace?.id === ws.id ? (
                  <FolderOpen size={14} className="flex-shrink-0" />
                ) : (
                  <Folder size={14} className="flex-shrink-0" />
                )}
                <span className="text-sm truncate">{ws.name}</span>
              </div>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={(e) => handleDeleteWorkspace(e, ws.id)}
                className="opacity-0 group-hover:opacity-100 hover:text-destructive hover:bg-transparent flex-shrink-0 -mr-1"
              >
                <X size={14} />
              </Button>
            </div>
          ))}
        </div>

        {/* Create workspace */}
        <div className="px-2 mt-1 mb-2">
          {creatingWorkspace ? (
            <div className="space-y-1.5">
              <Input
                autoFocus
                placeholder="Tên workspace..."
                value={newWsName}
                onChange={(e) => setNewWsName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateWorkspace();
                  if (e.key === "Escape") { setCreatingWorkspace(false); setNewWsName(""); }
                }}
                className="h-7 text-xs"
              />
              <div className="flex gap-1">
                <Button
                  size="xs"
                  onClick={handleCreateWorkspace}
                  className="flex-1 text-xs"
                  disabled={!newWsName.trim()}
                >
                  Chọn thư mục
                </Button>
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => { setCreatingWorkspace(false); setNewWsName(""); }}
                >
                  Huỷ
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCreatingWorkspace(true)}
              className="w-full text-xs justify-start"
            >
              + Workspace mới
            </Button>
          )}
        </div>
      </div>

      <div className="border-t" />

      {/* Sessions section */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="px-3 py-2 flex items-center justify-between flex-shrink-0">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Phiên làm việc
          </span>
          {activeWorkspace && (
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={handleNewSession}
              title="Phiên làm việc mới"
            >
              <Plus size={14} />
            </Button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-2 space-y-0.5 pb-2">
          {!activeWorkspace && (
            <p className="text-xs text-muted-foreground px-2">Vui lòng chọn workspace</p>
          )}
          {sessions.map((session) => (
            <div
              key={session.id}
              onClick={() => handleSelectSession(session)}
              onDoubleClick={() => {
                setRenamingSessionId(session.id);
                setRenameValue(session.name);
              }}
              className={`group flex items-center justify-between px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${
                activeSessionId === session.id
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "hover:bg-muted"
              }`}
            >
              {renamingSessionId === session.id ? (
                <Input
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleRenameSession(session.id);
                    if (e.key === "Escape") setRenamingSessionId(null);
                  }}
                  onBlur={() => handleRenameSession(session.id)}
                  onClick={(e) => e.stopPropagation()}
                  className="flex-1 h-6 text-xs border-0 px-1 focus-visible:ring-0"
                />
              ) : (
                <>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs leading-tight truncate">{session.name}</p>
                    <p className={`text-xs mt-0.5 ${activeSessionId === session.id ? "text-sidebar-primary-foreground/70" : "text-muted-foreground"}`}>
                      {formatDate(session.updatedAt)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={(e) => handleDeleteSession(e, session.id)}
                    className="opacity-0 group-hover:opacity-100 hover:text-destructive hover:bg-transparent flex-shrink-0 -mr-1"
                  >
                    <X size={14} />
                  </Button>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Artifacts section */}
      {activeSessionId && (
        <Collapsible open={artifactsOpen} onOpenChange={setArtifactsOpen}>
          <div className="border-t flex-shrink-0">
            <CollapsibleTrigger className="w-full flex items-center justify-between px-3 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider transition-colors">
              <span>Tài liệu đã tạo {artifacts.length ? `(${artifacts.length})` : ""}</span>
              {artifactsOpen ? (
                <ChevronDown size={14} />
              ) : (
                <ChevronRight size={14} />
              )}
            </CollapsibleTrigger>
          </div>
          <CollapsibleContent>
            <div className="flex-shrink-0 max-h-44 overflow-y-auto px-2 pb-2 space-y-0.5">
              {artifacts.length === 0 && (
                <p className="text-xs text-muted-foreground py-1 px-2">Chưa có tài liệu nào</p>
              )}
              {artifacts.map((artifact) => {
                const getExtColor = (type: string) => {
                  switch (type.toLowerCase()) {
                    case "pdf": return "bg-destructive text-white";
                    case "docx": return "bg-blue-600 text-white";
                    case "md": return "bg-primary text-primary-foreground";
                    default: return "bg-slate-600 text-white";
                  }
                };

                return (
                  <div
                    key={artifact.id}
                    onClick={() =>
                      onPreviewArtifact(artifact.filePath, artifact.type, artifact.fileName)
                    }
                    className="group flex items-center px-2 py-1.5 cursor-pointer hover:bg-muted transition-colors"
                  >
                    <Badge
                      className={`${getExtColor(artifact.type)} text-[0.6rem]`}
                    >
                      {artifact.type}
                    </Badge>
                    <span className="text-xs truncate flex-1 ml-1.5">
                      {artifact.fileName}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      title="Mở bằng ứng dụng mặc định"
                      onClick={(e) => { e.stopPropagation(); window.api.openFile(artifact.filePath); }}
                      className="opacity-0 group-hover:opacity-100 hover:text-sidebar-primary hover:bg-transparent flex-shrink-0"
                    >
                      <ExternalLink size={12} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      title="Xoá khỏi danh sách"
                      onClick={(e) => handleDeleteArtifact(e, artifact)}
                      className="opacity-0 group-hover:opacity-100 hover:text-destructive hover:bg-transparent flex-shrink-0"
                    >
                      <X size={10} />
                    </Button>
                  </div>
                );
              })}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Settings button */}
      <div className="border-t p-2 flex-shrink-0">
        <button
          onClick={onOpenSettings}
          className="w-full flex items-center gap-2 p-2 hover:bg-muted transition-colors text-sm"
        >
          <Settings size={14} />
          <span>Cài đặt</span>
        </button>
      </div>
    </div>
  );
}
