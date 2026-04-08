import { Badge } from "@/renderer/components/ui/badge";
import { Button } from "@/renderer/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/renderer/components/ui/dialog";
import { Input } from "@/renderer/components/ui/input";
import { Label } from "@/renderer/components/ui/label";
import { Separator } from "@/renderer/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/renderer/components/ui/tabs";
import {
  Brain,
  Check,
  CheckCircle2,
  FolderOpen,
  LifeBuoy,
  Pencil,
  Plug,
  Plus,
  Server,
  Trash2,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useAppStore } from "../stores/appStore";
import type { AIProvider, Plugin } from "../types/api";
import { randomUUID } from "../utils/uuid";
import { Textarea } from "@/renderer/components/ui/textarea";

// ── Helpers ──────────────────────────────────────────────────────────────────

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const EMPTY_SKILL: Plugin = {
  id: "", type: "skill", name: "", description: "", triggers: [], prompt: "",
};

const EMPTY_MCP: Plugin = {
  id: "", type: "mcp", name: "", description: "", triggers: [], prompt: "", command: "", args: [],
};

interface Props {
  onClose: () => void;
}

const EMPTY_PROVIDER: AIProvider = {
  id: "",
  name: "",
  baseUrl: "http://localhost:11434/v1",
  apiKey: "",
};

export default function SettingsPanel({ onClose }: Props) {
  const { config, setConfig } = useAppStore();

  // ── Provider state ───────────────────────────────────────────
  const [providers, setProviders] = useState<AIProvider[]>(
    config?.providers ?? [],
  );
  const [activeProviderId, setActiveProviderIdState] = useState(
    config?.activeProviderId ?? null,
  );
  const [editingProvider, setEditingProvider] = useState<AIProvider | null>(
    null,
  );
  const [providerModels, setProviderModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState(
    config?.selectedModel ?? "",
  );
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<"ok" | "fail" | null>(null);

  // ── Memory state ────────────────────────────────────────────
  const [memory, setMemory] = useState<string>("");
  const [memSaving, setMemSaving] = useState(false);
  const [memSaved, setMemSaved] = useState(false);

  const [tab, setTab] = useState("connection");

  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [editingPlugin, setEditingPlugin] = useState<Plugin | null>(null);
  const [editTriggers, setEditTriggers] = useState("");
  const [editArgs, setEditArgs] = useState("");
  const [isNewPlugin, setIsNewPlugin] = useState(false);

  const reloadPlugins = () => window.api.listPlugins().then(setPlugins);

  const openEditForm = (plugin: Plugin, isNew: boolean) => {
    setEditingPlugin({ ...plugin });
    setEditTriggers(plugin.triggers?.join(", ") ?? "");
    setEditArgs(plugin.args?.join(" ") ?? "");
    setIsNewPlugin(isNew);
  };

  const handleSavePlugin = async () => {
    if (!editingPlugin) return;
    const id = editingPlugin.id || slugify(editingPlugin.name);
    const plugin: Plugin = {
      ...editingPlugin,
      id,
      triggers: editTriggers.split(",").map(t => t.trim()).filter(Boolean),
      args: editingPlugin.type === 'mcp' ? editArgs.split(/\s+/).filter(Boolean) : undefined,
    };
    await window.api.savePlugin(plugin);
    setEditingPlugin(null);
    reloadPlugins();
  };

  const handleDeletePlugin = async (plugin: Plugin) => {
    const label = plugin.type === 'mcp' ? 'MCP server' : 'skill';
    if (!confirm(`Xoá ${label} "${plugin.name}"?`)) return;
    await window.api.deletePlugin(plugin.id);
    reloadPlugins();
  };

  useEffect(() => {
    window.api.getMemory().then((m) => setMemory(m || ""));
    reloadPlugins();

    window.api.onMemoryUpdated(() => {
      window.api.getMemory().then((m) => setMemory(m || ""));
    });
    return () => window.api.offMemoryUpdated();
  }, []);

  useEffect(() => {
    const active = providers.find((p) => p.id === activeProviderId);
    if (active) window.api.listProviderModels(active).then(setProviderModels);
  }, [activeProviderId]);

  // ── Provider handlers ────────────────────────────────────────
  const handleCheckProvider = async (provider: AIProvider) => {
    setChecking(true);
    setCheckResult(null);
    const ok = await window.api.checkProvider(provider);
    setCheckResult(ok ? "ok" : "fail");
    setChecking(false);
    if (ok) {
      const list = await window.api.listProviderModels(provider);
      setProviderModels(list);
    }
  };

  const handleSaveProvider = async (provider: AIProvider) => {
    await window.api.saveProvider(provider);
    const cfg = await window.api.getConfig();
    setConfig(cfg);
    setProviders(cfg.providers);
    setEditingProvider(null);
  };

  const handleDeleteProvider = async (id: string) => {
    if (!confirm("Xoá kết nối này?")) return;
    await window.api.deleteProvider(id);
    const cfg = await window.api.getConfig();
    setConfig(cfg);
    setProviders(cfg.providers);
    setActiveProviderIdState(cfg.activeProviderId);
  };

  const handleSetActiveProvider = async (id: string) => {
    await window.api.setActiveProvider(id);
    setActiveProviderIdState(id);
    const cfg = await window.api.getConfig();
    setConfig(cfg);
    const active = cfg.providers.find((p) => p.id === id);
    if (active) {
      const list = await window.api.listProviderModels(active);
      setProviderModels(list);
    }
  };

  const handleSelectModel = async (model: string) => {
    setSelectedModel(model);
    await window.api.selectModel(model);
    setConfig(await window.api.getConfig());
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
  const [exportResult, setExportResult] = useState<"ok" | "cancel" | null>(
    null,
  );

  const handleExportLogs = async () => {
    setExporting(true);
    setExportResult(null);
    const ok = await window.api.exportLogs();
    setExportResult(ok ? "ok" : "cancel");
    setExporting(false);
    setTimeout(() => setExportResult(null), 3000);
  };

  // ── Plugins Form Helper ────────────────────────────────────
  const renderPluginForm = () => (
    <div className="border p-4 space-y-3 bg-muted/30 my-2">
      <h4 className="text-sm font-semibold">
        {isNewPlugin 
          ? (editingPlugin?.type === 'skill' ? "Thêm Skill mới" : "Thêm MCP Server mới")
          : (editingPlugin?.type === 'skill' ? "Cập nhật Skill" : "Cập nhật MCP Server")
        }
      </h4>
      <div className="flex items-center gap-3">
        <Label className="text-xs w-20 flex-shrink-0">Tên</Label>
        <Input
          value={editingPlugin?.name || ""}
          onChange={(e) =>
            setEditingPlugin((prev) =>
              prev ? { ...prev, name: e.target.value } : null,
            )
          }
          placeholder={
            editingPlugin?.type === "skill"
              ? "VD: Soạn giáo án"
              : "VD: Search Google"
          }
          className="h-8 text-sm"
        />
      </div>
      <div className="flex items-center gap-3">
        <Label className="text-xs w-20 flex-shrink-0">Mô tả</Label>
        <Input
          value={editingPlugin?.description || ""}
          onChange={(e) =>
            setEditingPlugin((prev) =>
              prev ? { ...prev, description: e.target.value } : null,
            )
          }
          placeholder="Mô tả ngắn về plugin"
          className="h-8 text-sm"
        />
      </div>

      {editingPlugin?.type === "skill" && (
        <div className="flex items-center gap-3">
          <Label className="text-xs w-20 flex-shrink-0">Triggers</Label>
          <Input
            value={editTriggers}
            onChange={(e) => setEditTriggers(e.target.value)}
            placeholder="soạn giáo án, lesson plan (cách nhau bằng dấu phẩy)"
            className="h-8 text-sm"
          />
        </div>
      )}

      {editingPlugin?.type === "mcp" && (
        <>
          <div className="flex items-center gap-3">
            <Label className="text-xs w-20 flex-shrink-0">Command</Label>
            <Input
              value={editingPlugin?.command || ""}
              onChange={(e) =>
                setEditingPlugin((prev) =>
                  prev ? { ...prev, command: e.target.value } : null,
                )
              }
              placeholder="node, python, npx..."
              className="h-8 text-sm font-mono"
            />
          </div>
          <div className="flex items-center gap-3">
            <Label className="text-xs w-20 flex-shrink-0">Args</Label>
            <Input
              value={editArgs}
              onChange={(e) => setEditArgs(e.target.value)}
              placeholder="-y @modelcontextprotocol/server-sqlite --db /path/to/db"
              className="h-8 text-sm font-mono"
            />
          </div>
        </>
      )}

      <div className="flex flex-col gap-1.5">
        <Label className="text-xs text-muted-foreground">
          {editingPlugin?.type === "skill"
            ? "Nội dung skill (instructions)"
            : "Instructions bổ sung (nếu có)"}
        </Label>
        <Textarea
          value={editingPlugin?.prompt || ""}
          onChange={(e) =>
            setEditingPlugin((prev) =>
              prev ? { ...prev, prompt: e.target.value } : null,
            )
          }
          placeholder={
            editingPlugin?.type === "skill"
              ? "Viết instructions chi tiết để agent biết cách thực hiện skill này..."
              : "Hướng dẫn thêm cho agent khi dùng MCP tool này..."
          }
          rows={6}
          className="w-full border rounded-md px-3 py-2 text-sm bg-background resize-y font-mono focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>
      <div className="flex gap-2 justify-end pt-1">
        <Button variant="ghost" size="sm" onClick={() => setEditingPlugin(null)}>
          Huỷ
        </Button>
        <Button
          size="sm"
          onClick={handleSavePlugin}
          disabled={!editingPlugin?.name.trim()}
        >
          Lưu
        </Button>
      </div>
    </div>
  );

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="flex flex-col min-w-xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>Cài đặt</DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab} className="flex flex-col flex-1 min-h-0">
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
              {/* Provider list */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold">Kết nối AI</h3>
                  <Button
                    variant="ghost"
                    size="xs"
                    className="text-primary"
                    onClick={() =>
                      setEditingProvider({ ...EMPTY_PROVIDER, id: randomUUID() })
                    }
                  >
                    + Thêm kết nối
                  </Button>
                </div>
                <div className="space-y-2">
                  {providers.map((p) => (
                    <div
                      key={p.id}
                      className={`flex items-center gap-3 p-3 border transition-colors ${p.id === activeProviderId ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}
                      onClick={(e) => { e.stopPropagation(); handleSetActiveProvider(p.id); }}
                    >
                      <button
                        className={`w-4 h-4 rounded-full border flex-shrink-0 flex items-center justify-center ${p.id === activeProviderId ? "border-primary" : "border-muted-foreground/40"}`}
                      >
                        {p.id === activeProviderId && (
                          <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                        )}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {p.name || "(chưa đặt tên)"}
                        </p>
                        <p className="text-xs text-muted-foreground font-mono truncate">
                          {p.baseUrl}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={(e) => { e.stopPropagation(); setEditingProvider({ ...p }) }}
                        className="text-muted-foreground"
                      >
                        <Pencil size={12} />
                      </Button>
                      {providers.length > 1 && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={(e) => { e.stopPropagation(); handleDeleteProvider(p.id) }}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <X size={12} />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Edit/Add provider form */}
              {editingProvider && (
                <div className="border p-4 space-y-3 bg-muted/30 mt-2">
                  <h4 className="text-sm font-semibold">
                    {providers.find((p) => p.id === editingProvider.id)
                      ? "Sửa kết nối"
                      : "Thêm kết nối"}
                  </h4>
                  {(
                    [
                      { label: "Tên", key: "name", placeholder: "VD: Ollama local", mono: false },
                      { label: "Base URL", key: "baseUrl", placeholder: "http://localhost:11434/v1", mono: true },
                      { label: "API Key", key: "apiKey", placeholder: "Để trống nếu không cần", mono: true },
                    ] as const
                  ).map(({ label, key, placeholder, mono }) => (
                    <div key={key} className="flex items-center gap-3">
                      <Label className="text-xs w-16 flex-shrink-0">{label}</Label>
                      <Input
                        type={key === "apiKey" ? "password" : "text"}
                        value={editingProvider[key]}
                        onChange={(e) =>
                          setEditingProvider({ ...editingProvider, [key]: e.target.value })
                        }
                        placeholder={placeholder}
                        className={`h-8 text-sm ${mono ? "font-mono" : ""}`}
                      />
                    </div>
                  ))}
                  <div className="flex gap-2 pt-1 items-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCheckProvider(editingProvider)}
                      disabled={checking}
                    >
                      {checking ? "Đang kiểm tra..." : "Kiểm tra kết nối"}
                    </Button>
                    {checkResult === "ok" && (
                      <span className="flex items-center gap-1 text-xs text-primary">
                        <CheckCircle2 size={14} /> OK
                      </span>
                    )}
                    {checkResult === "fail" && (
                      <span className="flex items-center gap-1 text-xs text-destructive">
                        <XCircle size={14} /> ERROR
                      </span>
                    )}
                    <div className="flex-1" />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { setEditingProvider(null); setCheckResult(null); }}
                    >
                      Huỷ
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleSaveProvider(editingProvider)}
                    >
                      Lưu
                    </Button>
                  </div>
                </div>
              )}

              <Separator className="my-4" />

              {/* Model selection */}
              <div>
                <h3 className="text-sm font-semibold mb-3">Model AI mặc định</h3>
                <div className="space-y-2">
                  {providerModels.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      Chưa có model — kiểm tra kết nối provider.
                    </p>
                  )}
                  {providerModels.map((m) => (
                    <label
                      key={m}
                      className={`flex items-center gap-3 p-3 border cursor-pointer transition-colors ${selectedModel === m ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}
                    >
                      <input
                        type="radio"
                        name="model"
                        value={m}
                        checked={selectedModel === m}
                        onChange={() => handleSelectModel(m)}
                        className="accent-primary"
                      />
                      <span className="text-sm font-mono">{m}</span>
                    </label>
                  ))}
                </div>
              </div>
            </TabsContent>

            {/* ── Tab: Memory ── */}
            <TabsContent value="memory">
              {!memory && memory !== "" ? (
                <p className="text-sm text-muted-foreground">Đang tải...</p>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-primary bg-primary/10">
                      Cá nhân hoá
                    </Badge>
                  </div>
                  <Textarea
                    value={memory}
                    onChange={(e) => setMemory(e.target.value)}
                    placeholder="Nhập thông tin cá nhân hoá. Cú pháp khuyến nghị: Markdown"
                    className="min-h-50"
                  />
                </div>
              )}
            </TabsContent>

            {/* ── Tab: Plugins ── */}
            <TabsContent value="plugins">
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold">Quản lý Plugins</h3>
                  </div>
                  <Button
                    variant="ghost"
                    size="xs"
                    className="text-muted-foreground"
                    onClick={() => window.api.openPluginsDir()}
                  >
                    <FolderOpen size={13} className="mr-1" /> Mở thư mục
                  </Button>
                </div>

                {/* ── Skills Section ── */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b pb-1.5">
                    <div className="flex items-center gap-2">
                      <Zap size={14} className="text-primary" />
                      <span className="text-sm font-medium">Skills</span>
                      <Badge variant="secondary" className="text-[10px] h-4 px-1">
                        {plugins.filter(p => p.type === 'skill').length}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="xs"
                      className="text-primary h-7"
                      onClick={() => openEditForm({ ...EMPTY_SKILL, id: "" }, true)}
                    >
                      <Plus size={13} className="mr-1" /> Thêm
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {plugins.filter(p => p.type === 'skill').length === 0 && (
                      <p className="text-xs text-muted-foreground italic py-1">Chưa có skill nào.</p>
                    )}
                    {plugins.filter(p => p.type === 'skill').map(p => (
                      <div key={p.id} className="border p-3 space-y-1 bg-background/50 hover:bg-muted/30 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-medium text-sm truncate">{p.name}</span>
                            <span className="font-mono text-[10px] text-muted-foreground">/{p.id}</span>
                          </div>
                          <div className="flex gap-1 flex-shrink-0">
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
                        {p.description && (
                          <p className="text-xs text-muted-foreground">{p.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                  {editingPlugin?.type === "skill" && renderPluginForm()}
                </div>

                {/* ── MCP Section ── */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between border-b pb-1.5">
                    <div className="flex items-center gap-2">
                      <Server size={14} className="text-primary" />
                      <span className="text-sm font-medium">MCP Servers</span>
                      <Badge variant="secondary" className="text-[10px] h-4 px-1">
                        {plugins.filter(p => p.type === 'mcp').length}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="xs"
                      className="text-primary h-7"
                      onClick={() => openEditForm({ ...EMPTY_MCP, id: "" }, true)}
                    >
                      <Plus size={13} className="mr-1" /> Thêm
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {plugins.filter(p => p.type === 'mcp').length === 0 && (
                      <p className="text-xs text-muted-foreground italic py-1">Chưa có MCP server nào.</p>
                    )}
                    {plugins.filter(p => p.type === 'mcp').map(p => (
                      <div key={p.id} className="border p-3 space-y-1 bg-background/50 hover:bg-muted/30 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-medium text-sm truncate">{p.name}</span>
                            <span className="font-mono text-[10px] text-muted-foreground">/{p.id}</span>
                          </div>
                          <div className="flex gap-1 flex-shrink-0">
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
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px] font-mono font-normal flex-shrink-0">
                            {p.command}
                          </Badge>
                          {p.description && (
                            <p className="text-xs text-muted-foreground truncate">{p.description}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  {editingPlugin?.type === "mcp" && renderPluginForm()}
                </div>

              </div>
            </TabsContent>

            {/* ── Tab: Support ── */}
            <TabsContent value="support">
              <div className="border rounded-xl p-4 space-y-3">
                <h3 className="text-sm font-semibold">Logs ứng dụng</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  File log ghi lại toàn bộ hoạt động của ứng dụng (main process,
                  renderer, lỗi). Gửi file này khi báo lỗi để được hỗ trợ nhanh hơn.
                </p>
                <div className="flex items-center gap-3">
                  <Button
                    variant="secondary"
                    onClick={handleExportLogs}
                    disabled={exporting}
                  >
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
