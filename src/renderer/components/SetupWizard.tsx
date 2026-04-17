import { useState, Fragment } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Folder,
  X,
} from "lucide-react";
import type { AIProvider } from "../types/api";
import iconUrl from "../assets/icon.jpeg";
import { Button } from "@/renderer/components/ui/button";
import { Input } from "@/renderer/components/ui/input";
import { Label } from "@/renderer/components/ui/label";
import { Badge } from "./ui/badge";

interface Props {
  onComplete: () => void;
}

const STEPS = ["ai-provider", "profile", "workspace"] as const;
type Step = (typeof STEPS)[number];

const STEP_LABELS: Record<Step, string> = {
  "ai-provider": "Kết nối AI",
  profile: "Hồ sơ",
  workspace: "Workspace",
};

type ProviderPreset = {
  id: string;
  label: string;
  description: string;
  badge: string;
  badgeVariant: "warning" | "success";
  baseUrl: string;
  needsKey: boolean;
};

const PRESETS: ProviderPreset[] = [
  {
    id: "ollama-local",
    label: "Máy tính cá nhân",
    description:
      "AI chạy trực tiếp trên máy tính này. Không cần internet, dữ liệu không rời khỏi máy tính của bạn.",
    badge: "Yêu cầu máy cá nhân cấu hình mạnh",
    badgeVariant: "warning",
    baseUrl: "http://localhost:11434/v1",
    needsKey: false,
  },
  {
    id: "openai-compatible-remote",
    label: "Máy chủ trung tâm",
    description:
      "Kết nối với AI do nhà trường hoặc đơn vị cung cấp quản lý. Liên hệ bộ phận IT để lấy địa chỉ máy chủ và mã kết nối (API Key).",
    badge: "Dành cho máy cá nhân cấu hình yếu",
    badgeVariant: "success",
    baseUrl: "",
    needsKey: true,
  },
];

export default function SetupWizard({ onComplete }: Props) {
  const [step, setStep] = useState<Step>("ai-provider");

  // ── Step 1: Provider ────────────────────────────────────────
  const [selectedPresetId, setSelectedPresetId] = useState(PRESETS[0].id);
  const [customUrl, setCustomUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [checking, setChecking] = useState(false);
  const [connectionOk, setConnectionOk] = useState<boolean | null>(null);

  // ── Step 2: Model ───────────────────────────────────────────
  const [models, setModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState("");

  // ── Step 3: Profile ─────────────────────────────────────────
  const [teacherName, setTeacherName] = useState("");
  const [subject, setSubject] = useState("");

  // ── Step 4: Workspace ────────────────────────────────────────
  const [wsName, setWsName] = useState("");
  const [wsPath, setWsPath] = useState("");
  const [wsCreating, setWsCreating] = useState(false);

  // ── Helpers ─────────────────────────────────────────────────
  const activePreset =
    PRESETS.find((p) => p.id === selectedPresetId) ?? PRESETS[0];
  const effectiveUrl =
    selectedPresetId === PRESETS[0].id
      ? activePreset.baseUrl
      : customUrl.trim() || activePreset.baseUrl;

  function buildProvider(): AIProvider {
    return {
      id: activePreset.id,
      name: activePreset.label.split("—")[0].trim(),
      baseUrl: effectiveUrl,
      apiKey: apiKey.trim(),
    };
  }

  const goBack = () => {
    const idx = STEPS.indexOf(step);
    if (idx > 0) setStep(STEPS[idx - 1]);
  };

  const handleConnect = async () => {
    setChecking(true);
    setConnectionOk(null);
    const provider = buildProvider();
    const ok = await window.api.checkProvider(provider);
    setConnectionOk(ok);
    setChecking(false);
    if (ok) {
      await window.api.saveProvider(provider);
      await window.api.setActiveProvider(provider.id);
      const list = await window.api.listProviderModels(provider);
      setModels(list);
      if (list.length > 0) setSelectedModel(list[0]);
    }
  };

  const handleModelNext = async () => {
    if (!selectedModel) return;
    await window.api.selectModel(selectedModel);
    setStep("profile");
  };

  const handleFinish = async () => {
    await window.api.updateConfig({
      teacherName: teacherName.trim(),
      subject: subject.trim(),
      setupComplete: false,
    });
    await window.api.updateMemory(
      `## PROFILE\n- Tên: ${teacherName.trim()}\n- Môn dạy: ${subject.trim()}\n\n## PREFERENCES\n\n## BRIEF HISTORY\n`,
    );
    setStep("workspace");
  };

  const handlePickFolder = async () => {
    const ws = await window.api.createWorkspace(
      wsName.trim() || "My Workspace",
    );
    if (ws) {
      setWsPath(ws.path);
      if (!wsName.trim()) setWsName(ws.name);
    }
  };

  const handleCreateWorkspace = async () => {
    setWsCreating(true);
    await window.api.updateConfig({ setupComplete: true });
    onComplete();
  };

  const handleSkipWorkspace = async () => {
    await window.api.updateConfig({ setupComplete: true });
    onComplete();
  };

  const currentIdx = STEPS.indexOf(step);

  return (
    <div className="flex items-center justify-center h-full bg-muted/30">
      <div className="bg-card text-card-foreground shadow-lg p-8 w-full max-w-2xl max-h-[90dvh] rounded-2xl flex flex-col">
        {/* Header */}
        <div className="text-center mb-6">
          <img
            src={iconUrl}
            alt="Agenteach"
            className="w-24 h-24 mx-auto mb-2 rounded-xl"
          />
          <h1 className="text-2xl font-bold text-foreground">Agenteach</h1>
        </div>

        {/* Progress */}
        <div className="flex items-center mb-8">
          {STEPS.map((s, i) => (
            <Fragment key={i}>
              <div className="flex flex-col justify-center items-center flex-1">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                    i < currentIdx
                      ? "bg-primary text-primary-foreground"
                      : i === currentIdx
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground/60"
                  }`}
                >
                  {i < currentIdx ? <Check size={14} /> : i + 1}
                </div>
                <span
                  className={`text-xs mt-1 ${i === currentIdx ? "text-primary font-medium" : "text-muted-foreground/60"}`}
                >
                  {STEP_LABELS[s]}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-2 mb-4 ${i < currentIdx ? "bg-primary" : "bg-border"}`}
                />
              )}
            </Fragment>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto min-h-0 pr-2 -mr-2">
          {/* ── Step 1: Kết nối AI ── */}
          {step === "ai-provider" && (
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-semibold text-foreground mb-1">
                  Kết nối AI
                </h2>
                <p className="text-sm text-muted-foreground">
                  Chọn cách kết nối phù hợp với bạn. Nếu không chắc, hãy liên hệ
                  bộ phận IT của trường để được hướng dẫn.
                </p>
              </div>

              <div className="space-y-2">
                {PRESETS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setSelectedPresetId(p.id);
                      setConnectionOk(null);
                      setCustomUrl("");
                      setApiKey("");
                    }}
                    className={`w-full flex items-center gap-3 p-3 border rounded-xl text-left transition-colors ${
                      selectedPresetId === p.id
                        ? "border-primary bg-primary/5"
                        : "hover:bg-muted/30 border-border"
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
                        selectedPresetId === p.id
                          ? "border-primary"
                          : "border-border"
                      }`}
                    >
                      {selectedPresetId === p.id && (
                        <div className="w-2 h-2 rounded-full bg-primary" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-foreground">
                          {p.label}
                        </p>
                        <Badge
                          className={`${
                            p.badgeVariant === "success"
                              ? "bg-green-100 text-green-700"
                              : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {p.badge}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground/70 mt-0.5 leading-relaxed">
                        {p.description}
                      </p>
                    </div>
                  </button>
                ))}
              </div>

              {selectedPresetId !== "ollama-local" && (
                <div className="space-y-2">
                  <Input
                    autoFocus
                    value={customUrl}
                    onChange={(e) => {
                      setCustomUrl(e.target.value);
                      setConnectionOk(null);
                    }}
                    onKeyDown={(e) => e.key === "Enter" && handleConnect()}
                    placeholder={`Địa chỉ (${activePreset.baseUrl || "https://api.example.com/v1"})`}
                    className="font-mono"
                  />
                  <Input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="API Key"
                    required={activePreset.needsKey}
                    className="font-mono"
                  />
                </div>
              )}

              {connectionOk === false && (
                <div className="bg-orange-50 border border-orange-200 text-orange-800 rounded-xl p-4 text-sm space-y-1">
                  <p className="font-medium">Không kết nối được. Kiểm tra:</p>
                  <ul className="text-xs space-y-1 text-orange-700 list-disc list-inside">
                    {selectedPresetId === "ollama-local" && (
                      <li>Ollama đã bật chưa?</li>
                    )}
                    {selectedPresetId !== PRESETS[0].id && (
                      <li>Địa chỉ URL có đúng không?</li>
                    )}
                    {activePreset.needsKey && <li>API key có hợp lệ không?</li>}
                    <li>Liên hệ bộ phận IT để được hỗ trợ chi tiết</li>
                  </ul>
                </div>
              )}

              {connectionOk !== true && (
                <Button
                  className="w-full rounded-xl"
                  onClick={handleConnect}
                  disabled={
                    checking ||
                    (selectedPresetId !== PRESETS[0].id && !customUrl.trim())
                  }
                >
                  {checking ? "Đang kiểm tra..." : "Kết nối"}
                </Button>
              )}

              {connectionOk === true && (
                <div className="space-y-4">
                  <div className="bg-primary/5 border border-primary/20 text-primary p-3 text-sm flex items-center">
                    <CheckCircle2 size={16} />
                    <span className="ml-3">
                      Kết nối thành công! Vui lòng chọn mô hình AI bên dưới đề
                      tiếp tục.
                    </span>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-2">
                      Chọn mô hình AI
                    </h3>
                    <div className="space-y-2">
                      {models.length === 0 ? (
                        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-sm text-orange-800 space-y-2">
                          <p className="font-medium">
                            Chưa có model nào được cài đặt.
                          </p>
                          <ul className="text-xs space-y-1 text-orange-700 list-disc list-inside">
                            {selectedPresetId === "ollama-local" ? (
                              <li>
                                Tải model qua terminal:{" "}
                                <code className="bg-orange-100 px-1 rounded font-mono">
                                  ollama pull &lt;model&gt;
                                </code>
                              </li>
                            ) : (
                              <li>Kiểm tra lại địa chỉ URL và API Key</li>
                            )}
                            <li>Liên hệ bộ phận IT nếu cần hỗ trợ</li>
                          </ul>
                        </div>
                      ) : (
                        models.map((m) => (
                          <label
                            key={m}
                            className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-colors ${
                              selectedModel === m
                                ? "border-primary bg-primary/5"
                                : "hover:bg-muted/30"
                            }`}
                          >
                            <input
                              type="radio"
                              name="model"
                              value={m}
                              checked={selectedModel === m}
                              onChange={() => setSelectedModel(m)}
                              className="accent-primary"
                            />
                            <span className="text-sm font-mono text-foreground">
                              {m}
                            </span>
                          </label>
                        ))
                      )}
                    </div>
                  </div>

                  <Button
                    className="w-full rounded-xl"
                    onClick={handleModelNext}
                    disabled={!selectedModel}
                  >
                    Tiếp tục <ArrowRight size={14} className="ml-1" />
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* ── Step 2: Hồ sơ ── */}
          {step === "profile" && (
            <div className="space-y-5">
              <div>
                <h2 className="text-base font-semibold text-foreground mb-1">
                  Cho trợ lý biết về bạn
                </h2>
                <p className="text-sm text-muted-foreground">
                  Trợ lý dùng thông tin này để xưng hô và cá nhân hoá câu trả
                  lời. Có thể thay đổi sau.
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <Label className="text-sm font-medium text-foreground mb-1.5 block">
                    Tên của bạn <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    placeholder="VD: Nguyễn Thị Lan"
                    value={teacherName}
                    onChange={(e) => setTeacherName(e.target.value)}
                    autoFocus
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium text-foreground mb-1.5 block">
                    Môn dạy
                  </Label>
                  <Input
                    placeholder="VD: Toán, Ngữ văn, Lịch sử..."
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    Không bắt buộc — có thể điền sau
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="rounded-xl"
                  onClick={goBack}
                >
                  <ArrowLeft size={14} /> Quay lại
                </Button>
                <Button
                  className="flex-1 rounded-xl"
                  onClick={handleFinish}
                  disabled={!teacherName.trim()}
                >
                  Tiếp tục <ArrowRight size={14} />
                </Button>
              </div>
            </div>
          )}

          {/* ── Step 3: Workspace ── */}
          {step === "workspace" && (
            <div className="space-y-5">
              <div>
                <h2 className="text-base font-semibold text-foreground mb-1">
                  Chọn thư mục làm việc
                </h2>
                <p className="text-sm text-muted-foreground">
                  Workspace là thư mục chứa tài liệu giảng dạy của bạn. Trợ lý
                  sẽ tìm và đọc file trong thư mục này.
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <Label className="text-sm font-medium text-foreground mb-1.5 block">
                    Tên workspace
                  </Label>
                  <Input
                    autoFocus
                    placeholder="VD: Tài liệu Toán 10"
                    value={wsName}
                    onChange={(e) => setWsName(e.target.value)}
                  />
                </div>

                {wsPath ? (
                  <div className="flex items-center gap-2 p-3 bg-primary/5 border border-primary/20 rounded-xl">
                    <Folder size={14} className="text-primary shrink-0" />
                    <span className="text-sm text-primary font-mono truncate flex-1">
                      {wsPath}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => setWsPath("")}
                      className="text-muted-foreground/60 hover:text-destructive"
                    >
                      <X size={12} />
                    </Button>
                  </div>
                ) : (
                  <button
                    onClick={handlePickFolder}
                    className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-border hover:border-primary hover:bg-primary/5 rounded-xl text-sm text-muted-foreground hover:text-primary transition-colors"
                  >
                    <Folder size={14} /> Chọn thư mục...
                  </button>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="rounded-xl"
                  onClick={goBack}
                >
                  <ArrowLeft size={14} /> Quay lại
                </Button>
                <Button
                  className="flex-1 rounded-xl bg-primary hover:bg-primary/80"
                  onClick={wsPath ? handleCreateWorkspace : handlePickFolder}
                  disabled={wsCreating}
                >
                  {wsCreating ? (
                    "Đang tạo..."
                  ) : wsPath ? (
                    <span className="flex items-center justify-center gap-1">
                      Bắt đầu sử dụng <Check size={14} />
                    </span>
                  ) : (
                    "Chọn thư mục..."
                  )}
                </Button>
              </div>

              <button
                onClick={handleSkipWorkspace}
                className="w-full text-xs text-muted-foreground/60 hover:text-muted-foreground text-center"
              >
                Bỏ qua, tạo workspace sau
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
