import React, { useState } from "react";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Folder, X } from "lucide-react";
import type { AIProvider } from "../types/api";
import iconUrl from "../assets/icon.jpeg";

interface Props {
  onComplete: () => void;
}

const STEPS = ["ai-provider", "ai-model", "profile", "workspace"] as const;
type Step = (typeof STEPS)[number];

const STEP_LABELS: Record<Step, string> = {
  "ai-provider": "Kết nối",
  "ai-model": "Mô hình",
  profile: "Hồ sơ",
  workspace: "Workspace",
};

type ProviderPreset = {
  id: string;
  label: string;
  sublabel: string;
  baseUrl: string;
  needsKey: boolean;
};

const PRESETS: ProviderPreset[] = [
  {
    id: "ollama-local",
    label: "Ollama — trên máy này",
    sublabel: "localhost:11434",
    baseUrl: "http://localhost:11434/v1",
    needsKey: false,
  },
  {
    id: "ollama-remote",
    label: "Ollama — máy chủ trong trường",
    sublabel: "Nhập địa chỉ IP",
    baseUrl: "",
    needsKey: false,
  },
  // {
  //   id: "openai",
  //   label: "OpenAI",
  //   sublabel: "Cần API key từ openai.com",
  //   baseUrl: "https://api.openai.com/v1",
  //   needsKey: true,
  // },
  // {
  //   id: "openai-compatible",
  //   label: "Khác (OpenAI-compatible)",
  //   sublabel: "LM Studio, vLLM, Azure...",
  //   baseUrl: "",
  //   needsKey: false,
  // },
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
      setStep("ai-model");
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
      setupComplete: false, // not complete until workspace is created
    });
    await window.api.updateGlobalMemory({
      user: { name: teacherName.trim(), subject: subject.trim(), grades: [] },
    });
    setStep("workspace");
  };

  const handlePickFolder = async () => {
    // Opens native folder picker; IPC returns null if cancelled
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
    // wsPath already set from handlePickFolder — workspace already created
    await window.api.updateConfig({ setupComplete: true });
    onComplete();
  };

  const handleSkipWorkspace = async () => {
    await window.api.updateConfig({ setupComplete: true });
    onComplete();
  };

  const currentIdx = STEPS.indexOf(step);

  return (
    <div className="flex items-center justify-center h-full bg-gray-50">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-6">
          <img
            src={iconUrl}
            alt="Agenteach"
            className="w-24 h-24 mx-auto mb-2 rounded-xl"
          />
          <h1 className="text-2xl font-bold text-gray-800">Agenteach</h1>
        </div>

        {/* Progress */}
        <div className="flex items-center mb-8">
          {STEPS.map((s, i) => (
            <React.Fragment key={s}>
              <div className="flex flex-col items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                    i < currentIdx
                      ? "bg-green-500 text-white"
                      : i === currentIdx
                        ? "bg-blue-500 text-white"
                        : "bg-gray-100 text-gray-400"
                  }`}
                >
                  {i < currentIdx ? <Check size={14} /> : i + 1}
                </div>
                <span
                  className={`text-xs mt-1 ${i === currentIdx ? "text-blue-500 font-medium" : "text-gray-400"}`}
                >
                  {STEP_LABELS[s]}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-2 mb-4 ${i < currentIdx ? "bg-green-400" : "bg-gray-200"}`}
                />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* ── Step 1: Kết nối ── */}
        {step === "ai-provider" && (
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-semibold text-gray-800 mb-1">
                Chọn nguồn AI
              </h2>
              <p className="text-sm text-gray-500">
                Agenteach kết nối với bất kỳ AI nào theo chuẩn OpenAI — dữ liệu
                không rời khỏi mạng của bạn.
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
                  }}
                  className={`w-full flex items-center gap-3 p-3 border rounded-xl text-left transition-colors ${
                    selectedPresetId === p.id
                      ? "border-blue-400 bg-blue-50"
                      : "hover:bg-gray-50 border-gray-200"
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                      selectedPresetId === p.id
                        ? "border-blue-500"
                        : "border-gray-300"
                    }`}
                  >
                    {selectedPresetId === p.id && (
                      <div className="w-2 h-2 rounded-full bg-blue-500" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-700">
                      {p.label}
                    </p>
                    <p className="text-xs text-gray-400">{p.sublabel}</p>
                  </div>
                </button>
              ))}
            </div>

            {/* Custom URL input for non-localhost presets */}
            {selectedPresetId !== "ollama-local" && (
              <div className="space-y-2">
                <input
                  type="text"
                  autoFocus
                  value={customUrl}
                  onChange={(e) => {
                    setCustomUrl(e.target.value);
                    setConnectionOk(null);
                  }}
                  onKeyDown={(e) => e.key === "Enter" && handleConnect()}
                  placeholder={
                    "Địa chỉ (" +
                    (selectedPresetId === "ollama-remote"
                      ? "http://192.168.1.10:11434/v1"
                      : activePreset.baseUrl || "https://api.example.com/v1") +
                    ")"
                  }
                  className="w-full border rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="API Key"
                  required={activePreset.needsKey}
                  className="w-full border rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>
            )}

            {connectionOk === true && (
              <div className="bg-green-50 border border-green-200 text-green-700 rounded-xl p-3 text-sm flex items-center gap-2">
                <CheckCircle2 size={16} /> <span>Kết nối thành công!</span>
              </div>
            )}
            {connectionOk === false && (
              <div className="bg-orange-50 border border-orange-200 text-orange-800 rounded-xl p-4 text-sm space-y-1">
                <p className="font-medium">Không kết nối được. Kiểm tra:</p>
                <ul className="text-xs space-y-1 text-orange-700 list-disc list-inside">
                  {(selectedPresetId === "ollama-local" ||
                    selectedPresetId === "ollama-remote") && (
                    <li>
                      Ollama đã bật chưa? (chạy <code>ollama serve</code>)
                    </li>
                  )}
                  {selectedPresetId !== PRESETS[0].id && (
                    <li>Địa chỉ URL có đúng không?</li>
                  )}
                  {activePreset.needsKey && <li>API key có hợp lệ không?</li>}
                  <li>Nhờ bộ phận IT hỗ trợ nếu cần</li>
                </ul>
              </div>
            )}

            <button
              onClick={handleConnect}
              disabled={
                checking ||
                (selectedPresetId !== PRESETS[0].id && !customUrl.trim())
              }
              className="w-full py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium disabled:opacity-50 transition-colors"
            >
              {checking ? "Đang kiểm tra..." : "Kết nối"}
            </button>
          </div>
        )}

        {/* ── Step 2: Chọn AI model ── */}
        {step === "ai-model" && (
          <div className="space-y-5">
            <div>
              <h2 className="text-base font-semibold text-gray-800 mb-1">
                Chọn model AI
              </h2>
              <p className="text-sm text-gray-500">
                Mỗi model có tốc độ và chất lượng khác nhau. Nếu không chắc,
                chọn cái đầu tiên.
              </p>
            </div>

            <div className="space-y-2 max-h-52 overflow-y-auto">
              {models.length === 0 ? (
                <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-sm text-orange-800 space-y-2">
                  <p className="font-medium">Chưa có model nào được cài đặt.</p>
                  <ul className="text-xs space-y-1 text-orange-700 list-disc list-inside">
                    <li>Liên hệ bộ phận IT để được cài model phù hợp</li>
                    <li>
                      Hoặc tự tải model qua terminal:{" "}
                      <code className="bg-orange-100 px-1 rounded font-mono">
                        ollama pull &lt;tên-model&gt;
                      </code>
                    </li>
                  </ul>
                </div>
              ) : (
                models.map((m) => (
                  <label
                    key={m}
                    className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-colors ${
                      selectedModel === m
                        ? "border-blue-400 bg-blue-50"
                        : "hover:bg-gray-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="model"
                      value={m}
                      checked={selectedModel === m}
                      onChange={() => setSelectedModel(m)}
                      className="accent-blue-500"
                    />
                    <span className="text-sm font-mono text-gray-700">{m}</span>
                  </label>
                ))
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={goBack}
                className="px-4 py-2.5 text-gray-500 hover:text-gray-700 border rounded-xl text-sm transition-colors"
              >
                <ArrowLeft size={14} /> Quay lại
              </button>
              <button
                onClick={handleModelNext}
                disabled={!selectedModel}
                className="flex-1 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium disabled:opacity-50 transition-colors"
              >
                Tiếp tục
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: Giới thiệu ── */}
        {step === "profile" && (
          <div className="space-y-5">
            <div>
              <h2 className="text-base font-semibold text-gray-800 mb-1">
                Cho trợ lý biết về bạn
              </h2>
              <p className="text-sm text-gray-500">
                Trợ lý dùng thông tin này để xưng hô và cá nhân hoá câu trả lời.
                Có thể thay đổi sau.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Tên của bạn <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="VD: Nguyễn Thị Lan"
                  value={teacherName}
                  onChange={(e) => setTeacherName(e.target.value)}
                  autoFocus
                  className="w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Môn dạy
                </label>
                <input
                  type="text"
                  placeholder="VD: Toán, Ngữ văn, Lịch sử..."
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Không bắt buộc — có thể điền sau
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={goBack}
                className="px-4 py-2.5 text-gray-500 hover:text-gray-700 border rounded-xl text-sm transition-colors"
              >
                <ArrowLeft size={14} /> Quay lại
              </button>
              <button
                onClick={handleFinish}
                disabled={!teacherName.trim()}
                className="flex-1 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium disabled:opacity-50 transition-colors"
              >
                Tiếp tục <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}

        {/* ── Step 4: Workspace ── */}
        {step === "workspace" && (
          <div className="space-y-5">
            <div>
              <h2 className="text-base font-semibold text-gray-800 mb-1">
                Chọn thư mục làm việc
              </h2>
              <p className="text-sm text-gray-500">
                Workspace là thư mục chứa tài liệu giảng dạy của bạn. Trợ lý sẽ
                tìm và đọc file trong thư mục này.
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Tên workspace
                </label>
                <input
                  type="text"
                  autoFocus
                  placeholder="VD: Tài liệu Toán 10"
                  value={wsName}
                  onChange={(e) => setWsName(e.target.value)}
                  className="w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>

              {wsPath ? (
                <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl">
                  <Folder size={14} className="text-green-600 flex-shrink-0" />
                  <span className="text-sm text-green-700 font-mono truncate flex-1">
                    {wsPath}
                  </span>
                  <button
                    onClick={() => setWsPath("")}
                    className="text-gray-400 hover:text-red-500"
                  >
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={handlePickFolder}
                  className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-gray-300 hover:border-blue-400 hover:bg-blue-50 rounded-xl text-sm text-gray-500 hover:text-blue-600 transition-colors"
                >
                  <Folder size={14} /> Chọn thư mục...
                </button>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={goBack}
                className="px-4 py-2.5 text-gray-500 hover:text-gray-700 border rounded-xl text-sm transition-colors"
              >
                <ArrowLeft size={14} /> Quay lại
              </button>
              <button
                onClick={wsPath ? handleCreateWorkspace : handlePickFolder}
                disabled={wsCreating}
                className="flex-1 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-xl font-medium disabled:opacity-50 transition-colors"
              >
                {wsCreating
                  ? "Đang tạo..."
                  : wsPath
                    ? <span className="flex items-center justify-center gap-1">Bắt đầu sử dụng <Check size={14} /></span>
                    : "Chọn thư mục..."}
              </button>
            </div>

            <button
              onClick={handleSkipWorkspace}
              className="w-full text-xs text-gray-400 hover:text-gray-600 text-center"
            >
              Bỏ qua, tạo workspace sau
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
