import { Badge } from "@/renderer/components/ui/badge";
import { Button } from "@/renderer/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/renderer/components/ui/dialog";
import { Input } from "@/renderer/components/ui/input";
import { Label } from "@/renderer/components/ui/label";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/renderer/components/ui/tabs";
import {
  AlertTriangle,
  Brain,
  Check,
  CheckCircle2,
  Copy,
  Folder,
  LifeBuoy,
  Pencil,
  Plug,
  Plus,
  Search,
  Server,
  Trash2,
  XCircle,
  Zap,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useAppStore } from "../stores/appStore";
import type { AIProvider, PluginSkill, PluginMCP } from "../types/api";
import { randomUUID } from "../utils/uuid";
import { Textarea } from "@/renderer/components/ui/textarea";

// ── Helpers ──────────────────────────────────────────────────────────────────

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const EMPTY_SKILL: PluginSkill = {
  id: "",
  name: "",
  description: "",
  prompt: "",
};

const EMPTY_MCP: PluginMCP = {
  id: "",
  command: "",
  args: [],
  env: {},
  url: "",
};

interface Props {
  onClose: () => void;
}

export default function SettingsPanel({ onClose }: Props) {
  const { config, setConfig } = useAppStore();

  // ── Provider state ───────────────────────────────────────────
  const [providers, setProviders] = useState<AIProvider[]>(
    config?.providers ?? [],
  );
  const [activeProviderId, setActiveProviderIdState] = useState(
    config?.activeProviderId ?? null,
  );
  const [selectedModel, setSelectedModel] = useState(
    config?.selectedModel ?? "",
  );

  // ── Two-panel state ──────────────────────────────────────────
  const [viewedProviderId, setViewedProviderId] = useState<string | null>(null);
  const [isNewProvider, setIsNewProvider] = useState(false);
  const [newProviderType, setNewProviderType] = useState<"remote" | "local">("remote");
  const [formName, setFormName] = useState("");
  const [formBaseUrl, setFormBaseUrl] = useState("https://");
  const [formApiKey, setFormApiKey] = useState("");
  const [formDirty, setFormDirty] = useState(false);
  const [providerModels, setProviderModels] = useState<Record<string, string[]>>({});
  const [loadingModels, setLoadingModels] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<"ok" | "fail" | null>(null);

  // ── Connection polling (active provider) ─────────────────────
  const [providerOnline, setProviderOnline] = useState<boolean | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const activeProvider = providers.find((p) => p.id === activeProviderId);
    if (!activeProvider) { setProviderOnline(null); return; }

    const check = async () => {
      const ok = await window.api.checkProvider(activeProvider);
      setProviderOnline(ok);
    };

    check();
    pollIntervalRef.current = setInterval(check, 15_000);
    return () => { if (pollIntervalRef.current) clearInterval(pollIntervalRef.current); };
  }, [activeProviderId, providers]);

  // ── LlamaCpp install state ───────────────────────────────────
  type LlamaInstallPhase = "idle" | "checking" | "installing" | "done" | "error";
  const [llamaInstallPhase, setLlamaInstallPhase] = useState<LlamaInstallPhase>("idle");
  const [llamaInstallProgress, setLlamaInstallProgress] = useState(0);
  const [llamaInstallLabel, setLlamaInstallLabel] = useState("");
  const [llamaModelPath, setLlamaModelPath] = useState("");

  // ── Memory state ────────────────────────────────────────────
  const [memory, setMemory] = useState<string>("");
  const [memSaving, setMemSaving] = useState(false);
  const [memSaved, setMemSaved] = useState(false);

  const [tab, setTab] = useState("connection");
  const [pluginTab, setPluginTab] = useState("skills");

  const [skills, setSkills] = useState<PluginSkill[]>([]);
  const [mcps, setMcps] = useState<PluginMCP[]>([]);
  const [editingPlugin, setEditingPlugin] = useState<PluginSkill | PluginMCP | null>(null);
  const [editArgs, setEditArgs] = useState("");
  const [editEnv, setEditEnv] = useState("");
  const [isNewPlugin, setIsNewPlugin] = useState(false);
  const [skillSearch, setSkillSearch] = useState("");
  const [mcpSearch, setMcpSearch] = useState("");

  const reloadPlugins = () => {
    window.api.listSkills().then(setSkills);
    window.api.listMcp().then(setMcps);
  };

  const isSkill = (p: PluginSkill | PluginMCP): p is PluginSkill =>
    !("command" in p);

  const envToText = (env?: Record<string, string>) =>
    Object.entries(env ?? {})
      .map(([k, v]) => `${k}=${v}`)
      .join("\n");

  const textToEnv = (text: string): Record<string, string> =>
    Object.fromEntries(
      text
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.includes("="))
        .map((l) => {
          const idx = l.indexOf("=");
          return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()] as [string, string];
        }),
    );

  const openEditForm = (plugin: PluginSkill | PluginMCP, isNew: boolean) => {
    setEditingPlugin({ ...plugin });
    if (!isSkill(plugin)) {
      setEditArgs(plugin.args?.join(" ") ?? "");
      setEditEnv(envToText(plugin.env));
    }
    setIsNewPlugin(isNew);
  };

  const handleSavePlugin = async () => {
    if (!editingPlugin) return;
    if (isSkill(editingPlugin)) {
      const id = editingPlugin.id || slugify(editingPlugin.name);
      await window.api.saveSkill({ ...editingPlugin, id });
    } else {
      await window.api.saveMcp({
        ...editingPlugin,
        args: editArgs.split(/\s+/).filter(Boolean),
        env: textToEnv(editEnv),
      });
    }
    setEditingPlugin(null);
    reloadPlugins();
  };

  const handleDeletePlugin = async (plugin: PluginSkill | PluginMCP) => {
    const label = isSkill(plugin) ? "skill" : "MCP server";
    const display = isSkill(plugin) ? plugin.name : plugin.id;
    if (!confirm(`Xoá ${label} "${display}"?`)) return;
    if (isSkill(plugin)) await window.api.deleteSkill(plugin.id);
    else await window.api.deleteMcp(plugin.id);
    reloadPlugins();
  };

  const handleCloneSkill = (skill: PluginSkill) => {
    openEditForm({
      ...skill,
      id: `${skill.id}-copy`,
      name: `${skill.name} (Bản sao)`,
      builtin: false,
    }, true);
  };

  useEffect(() => {
    window.api.getMemory().then((m) => setMemory(m || ""));
    reloadPlugins();
    window.api.getDataRoot().then((root) => {
      setLlamaModelPath(root + "/models/gemma-4-E2B-it-Q4_K_M.gguf");
    });
    window.api.onMemoryUpdated(() => {
      window.api.getMemory().then((m) => setMemory(m || ""));
    });
    return () => window.api.offMemoryUpdated();
  }, []);

  // ── Provider handlers ────────────────────────────────────────

  const loadProviderModels = async (provider: AIProvider) => {
    if (providerModels[provider.id] !== undefined) return;
    setLoadingModels(true);
    try {
      const list = await window.api.listProviderModels(provider);
      setProviderModels((prev) => ({ ...prev, [provider.id]: list }));
    } finally {
      setLoadingModels(false);
    }
  };

  const handleSelectProvider = (p: AIProvider) => {
    setViewedProviderId(p.id);
    setIsNewProvider(false);
    setFormName(p.name);
    setFormBaseUrl(p.baseUrl);
    setFormApiKey(p.apiKey);
    setFormDirty(false);
    setCheckResult(null);

    if (p.id === "llamacpp-local") {
      setLlamaInstallPhase("checking");
      window.api
        .llamacppGetStatus(config?.localModelPath || undefined)
        .then(async (status) => {
          if (status.llamacppReady && status.modelReady) {
            setLlamaInstallPhase("done");
            setChecking(true);
            const ok = await window.api.checkProvider(p);
            setCheckResult(ok ? "ok" : "fail");
            setChecking(false);
            if (ok) {
              const list = await window.api.listProviderModels(p);
              setProviderModels((prev) => ({ ...prev, [p.id]: list }));
            }
          } else {
            setLlamaInstallPhase("idle");
          }
        });
    } else {
      loadProviderModels(p);
    }
  };

  const openLlamaCppPanel = async () => {
    const existing = providers.find((p) => p.id === "llamacpp-local");
    if (existing) {
      handleSelectProvider(existing);
      return;
    }
    const provider: AIProvider = {
      id: "llamacpp-local",
      name: "AI local",
      baseUrl: "http://localhost:8080/v1",
      apiKey: "",
    };
    await window.api.saveProvider(provider);
    const cfg = await window.api.getConfig();
    setConfig(cfg);
    setProviders(cfg.providers);
    handleSelectProvider(provider);
  };

  const openNewProviderPanel = () => {
    setViewedProviderId(null);
    setIsNewProvider(true);
    setNewProviderType("remote");
    setFormName("");
    setFormBaseUrl("https://");
    setFormApiKey("");
    setFormDirty(false);
    setCheckResult(null);
  };

  const handleNewProviderTypeChange = async (type: "remote" | "local") => {
    if (type === "local") {
      await openLlamaCppPanel();
    } else {
      setNewProviderType("remote");
    }
  };

  const handleSaveForm = async () => {
    const id =
      viewedProviderId && !isNewProvider ? viewedProviderId : randomUUID();
    const existing = providers.find((p) => p.id === viewedProviderId);
    const provider: AIProvider = {
      id,
      name: formName,
      baseUrl: formBaseUrl,
      apiKey: formApiKey,
      selectedModel: existing?.selectedModel,
    };
    await window.api.saveProvider(provider);
    const cfg = await window.api.getConfig();
    setConfig(cfg);
    setProviders(cfg.providers);
    setViewedProviderId(id);
    setIsNewProvider(false);
    setFormDirty(false);
  };

  const handleSetActive = async (id: string) => {
    await window.api.setActiveProvider(id);
    const cfg = await window.api.getConfig();
    setConfig(cfg);
    setActiveProviderIdState(cfg.activeProviderId);
    setSelectedModel(cfg.selectedModel);
    setProviders(cfg.providers);
  };

  const handleDeleteProvider = async (id: string) => {
    if (!confirm("Xoá kết nối này?")) return;
    await window.api.deleteProvider(id);
    const cfg = await window.api.getConfig();
    setConfig(cfg);
    setProviders(cfg.providers);
    setActiveProviderIdState(cfg.activeProviderId);
    if (viewedProviderId === id) {
      setViewedProviderId(null);
      setIsNewProvider(false);
    }
  };

  const handleCheckProvider = async () => {
    const p = viewedProviderId
      ? providers.find((pr) => pr.id === viewedProviderId)
      : null;
    if (!p) return;
    setChecking(true);
    setCheckResult(null);
    const ok = await window.api.checkProvider(p);
    setCheckResult(ok ? "ok" : "fail");
    setChecking(false);
    if (ok) {
      const list = await window.api.listProviderModels(p);
      setProviderModels((prev) => ({ ...prev, [p.id]: list }));
    }
  };

  const handleSelectModel = async (model: string, providerId: string) => {
    const p = providers.find((pr) => pr.id === providerId);
    if (!p) return;
    if (providerId === activeProviderId) {
      await window.api.selectModel(model);
      setSelectedModel(model);
    } else {
      await window.api.saveProvider({ ...p, selectedModel: model });
    }
    const cfg = await window.api.getConfig();
    setConfig(cfg);
    setProviders(cfg.providers);
  };

  // ── LlamaCpp install handlers ────────────────────────────────

  const handleLlamaInstall = async () => {
    setLlamaInstallPhase("installing");
    setLlamaInstallProgress(0);
    setLlamaInstallLabel("Đang chuẩn bị...");
    window.api.onLlamacppProgress(({ phase, percent }) => {
      if (phase) setLlamaInstallLabel(phase);
      setLlamaInstallProgress(percent);
    });
    try {
      await window.api.llamacppInstall(llamaModelPath);
      await window.api.updateConfig({ localModelPath: llamaModelPath });
      setLlamaInstallPhase("done");
      const llamaProvider = providers.find((p) => p.id === "llamacpp-local");
      if (llamaProvider) {
        setChecking(true);
        const ok = await window.api.checkProvider(llamaProvider);
        setCheckResult(ok ? "ok" : "fail");
        setChecking(false);
        if (ok) {
          const list = await window.api.listProviderModels(llamaProvider);
          setProviderModels((prev) => ({ ...prev, "llamacpp-local": list }));
        }
      }
    } catch {
      setLlamaInstallPhase("error");
    } finally {
      window.api.offLlamacppProgress();
    }
  };

  const handlePickLlamaModelDir = async () => {
    const picked = await window.api.pickFolder();
    if (picked) setLlamaModelPath(picked + "/gemma-4-E2B-it-Q4_K_M.gguf");
  };

  // ── Memory save ──────────────────────────────────────────────
  const handleSaveMemory = async () => {
    setMemSaving(true);
    await window.api.updateMemory(memory);
    setMemSaving(false);
    setMemSaved(true);
    setTimeout(() => setMemSaved(false), 2000);
  };

  const [exporting, setExporting] = useState(false);
  const [exportResult, setExportResult] = useState<"ok" | "cancel" | null>(null);

  const handleExportLogs = async () => {
    setExporting(true);
    setExportResult(null);
    const ok = await window.api.exportLogs();
    setExportResult(ok ? "ok" : "cancel");
    setExporting(false);
    setTimeout(() => setExportResult(null), 3000);
  };

  // ── Plugin form ──────────────────────────────────────────────
  const renderPluginForm = () => {
    const isMcp = editingPlugin && !isSkill(editingPlugin);
    const canSave = isMcp
      ? !!editingPlugin.id.trim()
      : !!(editingPlugin as PluginSkill | null)?.name?.trim();
    return (
      <div className="border p-4 space-y-3 bg-muted/30 my-2">
        <h4 className="text-sm font-semibold">
          {isNewPlugin
            ? isMcp ? "Thêm MCP Server mới" : "Thêm Skill mới"
            : isMcp ? "Cập nhật MCP Server" : "Cập nhật Skill"}
        </h4>

        {!isMcp && (
          <>
            {isNewPlugin && (
              <div className="flex items-center gap-3">
                <Label className="text-xs w-20 shrink-0">
                  ID <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={editingPlugin?.id || ""}
                  onChange={(e) =>
                    setEditingPlugin((prev) =>
                      prev ? { ...prev, id: e.target.value } : null,
                    )
                  }
                  placeholder="create-syllabus"
                  className="h-8 text-sm font-mono"
                />
              </div>
            )}
            <div className="flex items-center gap-3">
              <Label className="text-xs w-20 shrink-0">
                Tên <span className="text-destructive">*</span>
              </Label>
              <Input
                value={(editingPlugin as PluginSkill)?.name || ""}
                onChange={(e) =>
                  setEditingPlugin((prev) =>
                    prev ? { ...prev, name: e.target.value } : null,
                  )
                }
                placeholder="VD: Soạn giáo án"
                className="h-8 text-sm"
              />
            </div>
            <div className="flex items-center gap-3">
              <Label className="text-xs w-20 shrink-0">
                Mô tả <span className="text-destructive">*</span>
              </Label>
              <Textarea
                value={(editingPlugin as PluginSkill)?.description || ""}
                onChange={(e) =>
                  setEditingPlugin((prev) =>
                    prev ? { ...prev, description: e.target.value } : null,
                  )
                }
                placeholder="Mô tả ngắn về skill"
                className="w-full min-h-20 max-h-40"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">
                Nội dung skill <span className="text-destructive">*</span>
              </Label>
              <Textarea
                value={(editingPlugin as PluginSkill)?.prompt || ""}
                onChange={(e) =>
                  setEditingPlugin((prev) =>
                    prev ? { ...prev, prompt: e.target.value } : null,
                  )
                }
                placeholder="Viết instructions chi tiết..."
                className="w-full min-h-20 max-h-100"
              />
            </div>
          </>
        )}

        {isMcp && (
          <>
            {isNewPlugin && (
              <div className="flex items-center gap-3">
                <Label className="text-xs w-20 shrink-0">
                  ID <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={editingPlugin.id}
                  onChange={(e) =>
                    setEditingPlugin((prev) =>
                      prev ? { ...prev, id: e.target.value } : null,
                    )
                  }
                  placeholder="my-mcp-server"
                  className="h-8 text-sm font-mono"
                />
              </div>
            )}
            <div className="flex items-center gap-3">
              <Label className="text-xs w-20 shrink-0">URL</Label>
              <Input
                value={editingPlugin.url || ""}
                onChange={(e) =>
                  setEditingPlugin((prev) =>
                    prev ? { ...prev, url: e.target.value } : null,
                  )
                }
                placeholder="https://mcp.example.com/mcp"
                className="h-8 text-sm font-mono"
              />
            </div>
            <div className="flex items-center gap-3">
              <Label className="text-xs w-20 shrink-0">Command</Label>
              <Input
                value={editingPlugin.command || ""}
                onChange={(e) =>
                  setEditingPlugin((prev) =>
                    prev ? { ...prev, command: e.target.value } : null,
                  )
                }
                placeholder="npx, node, uv..."
                className="h-8 text-sm font-mono"
              />
            </div>
            <div className="flex items-center gap-3">
              <Label className="text-xs w-20 shrink-0">Args</Label>
              <Input
                value={editArgs}
                onChange={(e) => setEditArgs(e.target.value)}
                placeholder="-y @modelcontextprotocol/server-sqlite --db /path/to/db"
                className="h-8 text-sm font-mono"
              />
            </div>
            <div className="flex items-start gap-3">
              <Label className="text-xs w-20 shrink-0 pt-1.5">Env</Label>
              <Textarea
                value={editEnv}
                onChange={(e) => setEditEnv(e.target.value)}
                placeholder={"API_KEY=your_secret\nOTHER_VAR=value"}
                rows={3}
                className="w-full border rounded-md px-3 py-2 text-sm bg-background resize-y font-mono focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </>
        )}

        <div className="flex gap-2 justify-end pt-1">
          <Button variant="ghost" size="sm" onClick={() => setEditingPlugin(null)}>
            Huỷ
          </Button>
          <Button size="sm" onClick={handleSavePlugin} disabled={!canSave}>
            Lưu
          </Button>
        </div>
      </div>
    );
  };

  // ── Derived values for the right panel ───────────────────────
  const viewedProvider = viewedProviderId
    ? providers.find((p) => p.id === viewedProviderId)
    : null;
  const viewedModels = viewedProviderId ? (providerModels[viewedProviderId] ?? []) : [];
  const viewedSelectedModel =
    viewedProviderId === activeProviderId
      ? selectedModel
      : (viewedProvider?.selectedModel ?? "");

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="flex flex-col min-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>Cài đặt</DialogTitle>
        </DialogHeader>

        <Tabs
          value={tab}
          onValueChange={setTab}
          className="flex flex-col flex-1 min-h-0"
        >
          <TabsList className="w-full">
            <TabsTrigger value="connection">
              <Plug size={14} /> Kết nối AI
            </TabsTrigger>
            <TabsTrigger value="memory">
              <Brain size={14} /> Bộ nhớ
            </TabsTrigger>
            <TabsTrigger value="plugins">
              <Zap size={14} /> Plugins
            </TabsTrigger>
            <TabsTrigger value="support">
              <LifeBuoy size={14} /> Hỗ trợ
            </TabsTrigger>
          </TabsList>

          <div className="overflow-y-auto mt-2 flex-1 min-h-0">

            {/* ── Tab: Connection ── */}
            <TabsContent value="connection">
              <div className="flex gap-0 min-h-72">

                {/* Left: provider list */}
                <div className="w-52 shrink-0 flex flex-col pr-3">
                  <div className="flex gap-1.5 mb-3">
                    <Button
                      variant="outline"
                      size="xs"
                      className="w-full"
                      onClick={openNewProviderPanel}
                    >
                      + Thêm kết nối AI
                    </Button>
                  </div>
                  <div className="space-y-1 flex-1 overflow-y-auto">
                    {providers.map((p) => {
                      const isActive = p.id === activeProviderId;
                      const isOffline = isActive && providerOnline === false;
                      const isViewed = p.id === viewedProviderId && !isNewProvider;
                      const displayModel =
                        p.selectedModel ?? (isActive ? selectedModel : undefined);
                      return (
                        <button
                          key={p.id}
                          onClick={() => handleSelectProvider(p)}
                          className={`w-full text-left px-2.5 py-2 rounded-lg transition-colors border ${isViewed ? "bg-muted border-border" : "border-transparent hover:bg-muted/50"}`}
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className={`w-2 h-2 rounded-full shrink-0 ${isOffline ? "bg-destructive" : isActive ? "bg-primary" : "bg-muted-foreground/30"}`}
                            />
                            <span className="text-xs font-medium truncate flex-1">
                              {p.name || "(chưa đặt tên)"}
                            </span>
                            {isOffline && (
                              <AlertTriangle size={10} className="text-destructive shrink-0" />
                            )}
                          </div>
                          {displayModel && (
                            <p className="text-[10px] text-muted-foreground font-mono truncate mt-0.5 pl-4">
                              {displayModel}
                            </p>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Divider */}
                <div className="border-l mx-1" />

                {/* Right: detail panel */}
                <div className="flex-1 pl-3 overflow-y-auto">
                  {viewedProviderId === null && !isNewProvider ? (
                    <div className="h-full flex items-center justify-center min-h-48">
                      <p className="text-xs text-muted-foreground">
                        Chọn một kết nối để xem chi tiết
                      </p>
                    </div>
                  ) : viewedProviderId === "llamacpp-local" ? (
                    /* ── LlamaCpp detail panel ── */
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold">AI local (llama.cpp)</h4>
                        {providers.length > 1 && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="text-muted-foreground hover:text-destructive"
                            onClick={() => handleDeleteProvider("llamacpp-local")}
                          >
                            <Trash2 size={13} />
                          </Button>
                        )}
                      </div>

                      {llamaInstallPhase === "checking" && (
                        <p className="text-xs text-muted-foreground">Đang kiểm tra...</p>
                      )}

                      {(llamaInstallPhase === "idle" || llamaInstallPhase === "error") && (
                        <>
                          <p className="text-xs text-muted-foreground">
                            Chưa cài đặt. Ứng dụng sẽ tải xuống llama.cpp và mô hình Gemma 4 (~3GB).
                          </p>
                          <div className="space-y-1">
                            <Label className="text-xs">Thư mục lưu mô hình</Label>
                            <div className="flex gap-2">
                              <div className="flex items-center gap-2 flex-1 p-2 bg-background border rounded-md min-w-0">
                                <Folder size={12} className="text-muted-foreground shrink-0" />
                                <span className="text-xs font-mono text-muted-foreground truncate">
                                  {llamaModelPath}
                                </span>
                              </div>
                              <Button variant="outline" size="sm" onClick={handlePickLlamaModelDir}>
                                Đổi
                              </Button>
                            </div>
                          </div>
                          {llamaInstallPhase === "error" && (
                            <p className="flex items-center gap-1 text-xs text-destructive">
                              <XCircle size={12} /> Cài đặt thất bại. Kiểm tra mạng và thử lại.
                            </p>
                          )}
                          <div className="flex gap-2 pt-1">
                            <Button size="sm" className="flex-1" onClick={handleLlamaInstall}>
                              Bắt đầu cài đặt
                            </Button>
                          </div>
                        </>
                      )}

                      {llamaInstallPhase === "installing" && (
                        <div className="space-y-2">
                          <p className="text-xs text-muted-foreground">{llamaInstallLabel}</p>
                          <div className="w-full bg-muted rounded-full h-2">
                            <div
                              className="bg-primary h-2 rounded-full transition-all duration-300"
                              style={{ width: `${llamaInstallProgress}%` }}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground text-right">
                            {llamaInstallProgress}%
                          </p>
                        </div>
                      )}

                      {llamaInstallPhase === "done" && (
                        <>
                          <p className="flex items-center gap-1 text-xs text-primary">
                            <CheckCircle2 size={13} /> Đã cài đặt — sẵn sàng sử dụng
                          </p>
                          <div className="border-t pt-2 space-y-1">
                            <Label className="text-xs">Mô hình</Label>
                            {loadingModels ? (
                              <p className="text-xs text-muted-foreground">Đang tải...</p>
                            ) : viewedModels.length === 0 ? (
                              <p className="text-xs text-muted-foreground">
                                Chưa có model — thử khởi động & kiểm tra
                              </p>
                            ) : (
                              <div className="space-y-1 max-h-28 overflow-y-auto">
                                {viewedModels.map((m) => (
                                  <label
                                    key={m}
                                    className="flex items-center gap-2 px-1 py-1 rounded hover:bg-muted/50 cursor-pointer"
                                  >
                                    <input
                                      type="radio"
                                      name="llama-model"
                                      value={m}
                                      checked={m === viewedSelectedModel}
                                      onChange={() => handleSelectModel(m, "llamacpp-local")}
                                      className="accent-primary"
                                    />
                                    <span className="text-xs font-mono truncate">{m}</span>
                                  </label>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2 flex-wrap pt-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleCheckProvider}
                              disabled={checking}
                            >
                              {checking ? "Đang khởi động..." : "Khởi động & kiểm tra"}
                            </Button>
                            {checkResult === "ok" && (
                              <span className="flex items-center gap-1 text-xs text-primary">
                                <CheckCircle2 size={13} /> Sẵn sàng
                              </span>
                            )}
                            {checkResult === "fail" && (
                              <span className="flex items-center gap-1 text-xs text-destructive">
                                <XCircle size={13} /> Không khởi động được
                              </span>
                            )}
                            <div className="flex-1" />
                            {activeProviderId !== "llamacpp-local" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleSetActive("llamacpp-local")}
                              >
                                Đặt làm AI đang dùng
                              </Button>
                            )}
                            {activeProviderId === "llamacpp-local" && (
                              <Badge variant="secondary" className="text-xs">
                                Đang dùng
                              </Badge>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  ) : (
                    /* ── Generic provider form ── */
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold">
                          {isNewProvider
                            ? "Thêm kết nối mới"
                            : viewedProvider?.name || "Kết nối"}
                        </h4>
                        {!isNewProvider && viewedProviderId && providers.length > 1 && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="text-muted-foreground hover:text-destructive"
                            onClick={() => handleDeleteProvider(viewedProviderId)}
                          >
                            <Trash2 size={13} />
                          </Button>
                        )}
                      </div>

                      {isNewProvider && (
                        <div className="flex items-center gap-3">
                          <Label className="text-xs w-16 shrink-0">Loại</Label>
                          <select
                            value={newProviderType}
                            onChange={(e) =>
                              handleNewProviderTypeChange(
                                e.target.value as "remote" | "local",
                              )
                            }
                            className="h-8 flex-1 rounded-md border bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                          >
                            <option value="remote">Máy chủ khác (API)</option>
                            <option value="local">AI local (llama.cpp)</option>
                          </select>
                        </div>
                      )}

                      {(
                        [
                          { label: "Tên", value: formName, setter: setFormName, placeholder: "VD: OpenAI, LM Studio...", mono: false, password: false },
                          { label: "Địa chỉ", value: formBaseUrl, setter: setFormBaseUrl, placeholder: "https://api.example.com/v1", mono: true, password: false },
                          { label: "API Key", value: formApiKey, setter: setFormApiKey, placeholder: "Để trống nếu không cần", mono: true, password: true },
                        ] as const
                      ).map(({ label, value, setter, placeholder, mono, password }) => (
                        <div key={label} className="flex items-center gap-3">
                          <Label className="text-xs w-16 shrink-0">{label}</Label>
                          <Input
                            type={password ? "password" : "text"}
                            value={value}
                            onChange={(e) => {
                              setter(e.target.value as never);
                              setFormDirty(true);
                              setCheckResult(null);
                            }}
                            placeholder={placeholder}
                            className={`h-8 text-sm ${mono ? "font-mono" : ""}`}
                          />
                        </div>
                      ))}

                      {/* Model list for existing providers */}
                      {!isNewProvider && viewedProviderId && (
                        <div className="border-t pt-2 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs">Mô hình</Label>
                            <Button
                              variant="ghost"
                              size="xs"
                              className="text-xs h-6"
                              onClick={handleCheckProvider}
                              disabled={checking}
                            >
                              {checking ? "Đang tải..." : "Làm mới"}
                            </Button>
                          </div>
                          {loadingModels ? (
                            <p className="text-xs text-muted-foreground">Đang tải danh sách model...</p>
                          ) : viewedModels.length === 0 ? (
                            <p className="text-xs text-muted-foreground">
                              Chưa có model — thử kiểm tra kết nối
                            </p>
                          ) : (
                            <div className="space-y-0.5 max-h-32 overflow-y-auto">
                              {viewedModels.map((m) => (
                                <label
                                  key={m}
                                  className="flex items-center gap-2 px-1 py-1 rounded hover:bg-muted/50 cursor-pointer"
                                >
                                  <input
                                    type="radio"
                                    name="provider-model"
                                    value={m}
                                    checked={m === viewedSelectedModel}
                                    onChange={() => handleSelectModel(m, viewedProviderId)}
                                    className="accent-primary"
                                  />
                                  <span className="text-xs font-mono truncate">{m}</span>
                                </label>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-2 flex-wrap pt-1">
                        {!isNewProvider && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleCheckProvider}
                            disabled={checking}
                          >
                            {checking ? "Đang kiểm tra..." : "Kiểm tra kết nối"}
                          </Button>
                        )}
                        {checkResult === "ok" && (
                          <span className="flex items-center gap-1 text-xs text-primary">
                            <CheckCircle2 size={13} /> Kết nối OK
                          </span>
                        )}
                        {checkResult === "fail" && (
                          <span className="flex items-center gap-1 text-xs text-destructive">
                            <XCircle size={13} /> Không kết nối được
                          </span>
                        )}
                        <div className="flex-1" />
                        {(formDirty || isNewProvider) && (
                          <Button
                            size="sm"
                            onClick={handleSaveForm}
                            disabled={!formName.trim() || !formBaseUrl.trim()}
                          >
                            {isNewProvider ? "Thêm" : "Lưu thay đổi"}
                          </Button>
                        )}
                        {!formDirty && !isNewProvider && viewedProviderId && viewedProviderId !== activeProviderId && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleSetActive(viewedProviderId)}
                          >
                            Đặt làm AI đang dùng
                          </Button>
                        )}
                        {!formDirty && !isNewProvider && viewedProviderId === activeProviderId && (
                          <Badge variant="secondary" className="text-xs">
                            Đang dùng
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* ── Tab: Memory ── */}
            <TabsContent value="memory">
              {!memory && memory !== "" ? (
                <p className="text-sm text-muted-foreground">Đang tải...</p>
              ) : (
                <Textarea
                  value={memory}
                  onChange={(e) => setMemory(e.target.value)}
                  placeholder="Nhập thông tin cá nhân hoá. Cú pháp khuyến nghị: Markdown"
                  className="min-h-50"
                />
              )}
            </TabsContent>

            {/* ── Tab: Plugins ── */}
            <TabsContent value="plugins">
              <Tabs
                value={pluginTab}
                onValueChange={(v) => {
                  setPluginTab(v);
                  setEditingPlugin(null);
                }}
              >
                <div className="flex items-center justify-between">
                  <TabsList className="w-full">
                    <TabsTrigger value="skills">
                      <Zap size={13} className="mr-1" /> Skills
                      <Badge variant="secondary" className="ml-1.5 text-[10px] h-4 px-1">
                        {skills.length}
                      </Badge>
                    </TabsTrigger>
                    <TabsTrigger value="mcp">
                      <Server size={13} className="mr-1" /> MCP Servers
                      <Badge variant="secondary" className="ml-1.5 text-[10px] h-4 px-1">
                        {mcps.length}
                      </Badge>
                    </TabsTrigger>
                  </TabsList>
                </div>

                {/* ── Skills Tab ── */}
                <TabsContent value="skills">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Search
                          size={13}
                          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                        />
                        <Input
                          value={skillSearch}
                          onChange={(e) => setSkillSearch(e.target.value)}
                          placeholder="Tìm kiếm..."
                          className="h-7 pl-7 text-xs"
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="xs"
                        className="text-primary h-7 shrink-0"
                        onClick={() => openEditForm({ ...EMPTY_SKILL, id: "" }, true)}
                      >
                        <Plus size={13} className="mr-1" /> Thêm
                      </Button>
                    </div>
                    {editingPlugin && isSkill(editingPlugin) && renderPluginForm()}
                    {(() => {
                      const filtered = skills.filter(
                        (p) =>
                          skillSearch === "" ||
                          p.name.toLowerCase().includes(skillSearch.toLowerCase()) ||
                          p.id.toLowerCase().includes(skillSearch.toLowerCase()),
                      );
                      if (filtered.length === 0)
                        return (
                          <p className="text-xs text-muted-foreground italic py-1">
                            {skillSearch ? "Không tìm thấy skill phù hợp." : "Chưa có skill nào."}
                          </p>
                        );
                      return filtered.map((p) => (
                        <div
                          key={p.id}
                          className="border p-3 space-y-1 bg-background/50 hover:bg-muted/30 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-medium text-sm truncate">{p.name}</span>
                              <span className="font-mono text-[10px] text-muted-foreground">
                                /{p.id}
                              </span>
                            </div>
                            <div className="flex gap-1 shrink-0">
                              {p.builtin ? (
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  className="text-primary"
                                  title="Tạo bản sao"
                                  onClick={() => handleCloneSkill(p as PluginSkill)}
                                >
                                  <Copy size={12} />
                                </Button>
                              ) : (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    className="text-muted-foreground"
                                    onClick={() => openEditForm(p, false)}
                                  >
                                    <Pencil size={12} />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    className="text-muted-foreground hover:text-destructive"
                                    onClick={() => handleDeletePlugin(p)}
                                  >
                                    <Trash2 size={12} />
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                          {p.description && (
                            <p className="text-xs text-muted-foreground">{p.description}</p>
                          )}
                        </div>
                      ));
                    })()}
                  </div>
                </TabsContent>

                {/* ── MCP Tab ── */}
                <TabsContent value="mcp">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Search
                          size={13}
                          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                        />
                        <Input
                          value={mcpSearch}
                          onChange={(e) => setMcpSearch(e.target.value)}
                          placeholder="Tìm kiếm..."
                          className="h-7 pl-7 text-xs"
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="xs"
                        className="text-primary h-7 shrink-0"
                        onClick={() => openEditForm({ ...EMPTY_MCP, id: "" }, true)}
                      >
                        <Plus size={13} className="mr-1" /> Thêm
                      </Button>
                    </div>
                    {editingPlugin && !isSkill(editingPlugin) && renderPluginForm()}
                    {(() => {
                      const filtered = mcps.filter(
                        (p) =>
                          mcpSearch === "" ||
                          p.id.toLowerCase().includes(mcpSearch.toLowerCase()) ||
                          (p.url ?? "").toLowerCase().includes(mcpSearch.toLowerCase()) ||
                          (p.command ?? "").toLowerCase().includes(mcpSearch.toLowerCase()),
                      );
                      if (filtered.length === 0)
                        return (
                          <p className="text-xs text-muted-foreground italic py-1">
                            {mcpSearch
                              ? "Không tìm thấy MCP server phù hợp."
                              : "Chưa có MCP server nào."}
                          </p>
                        );
                      return filtered.map((p) => (
                        <div
                          key={p.id}
                          className="border p-3 space-y-1 bg-background/50 hover:bg-muted/30 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-medium text-sm font-mono truncate">{p.id}</span>
                              {(p.command || p.url) && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] font-mono font-normal shrink-0 max-w-40 truncate"
                                >
                                  {p.url ?? p.command}
                                </Badge>
                              )}
                            </div>
                            <div className="flex gap-1 shrink-0">
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                className="text-muted-foreground"
                                onClick={() => openEditForm(p, false)}
                              >
                                <Pencil size={12} />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                className="text-muted-foreground hover:text-destructive"
                                onClick={() => handleDeletePlugin(p)}
                              >
                                <Trash2 size={12} />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                </TabsContent>
              </Tabs>
            </TabsContent>

            {/* ── Tab: Support ── */}
            <TabsContent value="support">
              <div className="border rounded-xl p-4 space-y-3">
                <h3 className="text-sm font-semibold">Logs ứng dụng</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  File log ghi lại toàn bộ hoạt động của ứng dụng. Gửi file này khi báo lỗi.
                </p>
                <div className="flex items-center gap-3">
                  <Button variant="secondary" onClick={handleExportLogs} disabled={exporting}>
                    {exporting ? "Đang xuất..." : "Tải xuống logs"}
                  </Button>
                  {exportResult === "ok" && (
                    <span className="flex items-center gap-1 text-xs text-primary">
                      <Check size={14} /> Đã lưu file
                    </span>
                  )}
                  {exportResult === "cancel" && (
                    <span className="text-xs text-muted-foreground">Đã huỷ</span>
                  )}
                </div>
              </div>
            </TabsContent>
          </div>
        </Tabs>

        {/* Footer */}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Đóng
          </Button>
          {tab === "memory" && memory !== null && (
            <Button onClick={handleSaveMemory} disabled={memSaving}>
              {memSaved ? (
                <span className="flex items-center gap-1">
                  <Check size={14} /> Đã lưu
                </span>
              ) : memSaving ? (
                "Đang lưu..."
              ) : (
                "Lưu"
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
