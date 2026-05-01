import { useState, useEffect, useRef, Fragment } from "react"
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Folder,
  X,
} from "lucide-react"
import type { AIProvider } from "../types/api"
import iconUrl from "../assets/icon.jpeg"
import { Button } from "@/renderer/components/ui/button"
import { Input } from "@/renderer/components/ui/input"
import { Label } from "@/renderer/components/ui/label"
import { Badge } from "./ui/badge"

interface Props {
  onComplete: () => void
}

const STEPS = ["data-dir", "connection", "ai-setup", "profile", "workspace"] as const
type Step = (typeof STEPS)[number]

const STEP_LABELS: Record<Step, string> = {
  "data-dir": "Dữ liệu",
  connection: "Kết nối",
  "ai-setup": "Cài đặt",
  profile: "Hồ sơ",
  workspace: "Workspace",
}

type ConnectionChoice = "local" | "remote"
type InstallPhase = "idle" | "installing" | "done" | "error"

export default function SetupWizard({ onComplete }: Props) {
  const [step, setStep] = useState<Step>("data-dir")

  // ── Step 1: Data dir ─────────────────────────────────────────
  const [dataRoot, setDataRoot] = useState("")

  // ── Step 2: Connection ───────────────────────────────────────
  const [connectionChoice, setConnectionChoice] = useState<ConnectionChoice>("local")

  // ── Step 3: AI setup (local) ─────────────────────────────────
  const [modelDir, setModelDir] = useState("")
  const [installPhase, setInstallPhase] = useState<InstallPhase>("idle")
  const [installProgress, setInstallProgress] = useState(0)
  const [installLogs, setInstallLogs] = useState<string[]>([])
  const [installBytes, setInstallBytes] = useState<{ dl: number; total: number } | null>(null)
  const logsEndRef = useRef<HTMLDivElement>(null)

  // ── Step 3: AI setup (remote) ────────────────────────────────
  const [customUrl, setCustomUrl] = useState("")
  const [apiKey, setApiKey] = useState("")
  const [checking, setChecking] = useState(false)
  const [connectionOk, setConnectionOk] = useState<boolean | null>(null)
  const [models, setModels] = useState<string[]>([])
  const [selectedModel, setSelectedModel] = useState("")

  // ── Step 4: Profile ──────────────────────────────────────────
  const [teacherName, setTeacherName] = useState("")
  const [subject, setSubject] = useState("")

  // ── Step 5: Workspace ────────────────────────────────────────
  const [wsName, setWsName] = useState("")
  const [wsPath, setWsPath] = useState("")
  const [wsCreating, setWsCreating] = useState(false)

  useEffect(() => {
    window.api.getDataRoot().then((root) => {
      setDataRoot(root)
      setModelDir(root + "/models")
    })
  }, [])

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [installLogs])

  const MODEL_FILENAME = "gemma-4-E2B-it-Q4_K_M.gguf"

  function effectiveModelPath(): string {
    const dir = modelDir.trim() || dataRoot + "/models"
    return dir.replace(/\/+$/, "") + "/" + MODEL_FILENAME
  }

  // ── Navigation ───────────────────────────────────────────────
  const currentIdx = STEPS.indexOf(step)

  const goBack = () => {
    if (step === "ai-setup" && installPhase === "installing") return
    if (currentIdx > 0) setStep(STEPS[currentIdx - 1])
  }

  // ── Step 1 handlers ──────────────────────────────────────────
  const handlePickDataRoot = async () => {
    const picked = await window.api.pickFolder()
    if (picked) {
      setDataRoot(picked)
      setModelDir(picked + "/models")
    }
  }

  const handleDataDirNext = async () => {
    await window.api.setDataRoot(dataRoot)
    // Refresh default model dir in case dataRoot changed
    setModelDir(dataRoot + "/models")
    setStep("connection")
  }

  // ── Step 3 handlers (local) ──────────────────────────────────
  const handlePickModelDir = async () => {
    const picked = await window.api.pickFolder()
    if (picked) setModelDir(picked)
  }

  const handleStartInstall = async () => {
    const modelPath = effectiveModelPath()
    setInstallPhase("installing")
    setInstallProgress(0)
    setInstallLogs(["Đang chuẩn bị..."])

    window.api.onLlamacppProgress(({ phase, percent, downloaded, total }) => {
      setInstallProgress(percent)
      if (downloaded !== undefined && total !== undefined) {
        setInstallBytes({ dl: downloaded, total })
      }
      if (phase) {
        setInstallLogs((prev) => {
          if (prev[prev.length - 1] === phase) return prev
          return [...prev, phase]
        })
      }
    })

    try {
      await window.api.llamacppInstall(modelPath)

      const provider: AIProvider = {
        id: "llamacpp-local",
        name: "AI local",
        baseUrl: "http://localhost:8080/v1",
        apiKey: "",
      }
      await window.api.saveProvider(provider)
      await window.api.setActiveProvider("llamacpp-local")
      await window.api.updateConfig({ localModelPath: modelPath })

      // Start server so we can list the model
      await window.api.checkProvider(provider)
      const list = await window.api.listProviderModels(provider)
      const modelId = list[0] ?? "gemma-4-E2B-it-Q4_K_M"
      await window.api.selectModel(modelId)

      setInstallPhase("done")
    } catch {
      setInstallPhase("error")
    } finally {
      window.api.offLlamacppProgress()
    }
  }

  // ── Step 3 handlers (remote) ─────────────────────────────────
  const handleRemoteConnect = async () => {
    setChecking(true)
    setConnectionOk(null)
    const provider: AIProvider = {
      id: "openai-compatible-remote",
      name: "Máy chủ trung tâm",
      baseUrl: customUrl.trim(),
      apiKey: apiKey.trim(),
    }
    const ok = await window.api.checkProvider(provider)
    setConnectionOk(ok)
    setChecking(false)
    if (ok) {
      await window.api.saveProvider(provider)
      await window.api.setActiveProvider(provider.id)
      const list = await window.api.listProviderModels(provider)
      setModels(list)
      if (list.length > 0) setSelectedModel(list[0])
    }
  }

  const handleRemoteModelNext = async () => {
    if (!selectedModel) return
    await window.api.selectModel(selectedModel)
    setStep("profile")
  }

  // ── Step 4 handlers ──────────────────────────────────────────
  const handleFinish = async () => {
    await window.api.updateConfig({
      teacherName: teacherName.trim(),
      subject: subject.trim(),
      setupComplete: false,
    })
    await window.api.updateMemory(
      `## PROFILE\n- Tên: ${teacherName.trim()}\n- Môn dạy: ${subject.trim()}\n\n## PREFERENCES\n\n## BRIEF HISTORY\n`,
    )
    setStep("workspace")
  }

  // ── Step 5 handlers ──────────────────────────────────────────
  const handlePickFolder = async () => {
    const ws = await window.api.createWorkspace(wsName.trim() || "My Workspace")
    if (ws) {
      setWsPath(ws.path)
      if (!wsName.trim()) setWsName(ws.name)
    }
  }

  const handleCreateWorkspace = async () => {
    setWsCreating(true)
    await window.api.updateConfig({ setupComplete: true })
    onComplete()
  }

  const handleSkipWorkspace = async () => {
    await window.api.updateConfig({ setupComplete: true })
    onComplete()
  }

  return (
    <div className="flex items-center justify-center h-full bg-muted/30">
      <div className="bg-card text-card-foreground shadow-lg p-8 w-full max-w-2xl max-h-[90dvh] rounded-2xl flex flex-col">
        {/* Header */}
        <div className="text-center mb-6">
          <img
            src={iconUrl}
            alt="Agenteach"
            className="w-24 h-24 mx-auto mb-2"
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
          {/* ── Step 1: Dữ liệu ── */}
          {step === "data-dir" && (
            <div className="space-y-5">
              <div>
                <h2 className="text-base font-semibold text-foreground mb-1">
                  Thư mục lưu trữ dữ liệu
                </h2>
                <p className="text-sm text-muted-foreground">
                  Tất cả dữ liệu ứng dụng (cấu hình, lịch sử chat, mô hình AI)
                  sẽ được lưu tại thư mục này.
                </p>
              </div>

              <div>
                <Label className="text-sm font-medium text-foreground mb-1.5 block">
                  Thư mục dữ liệu
                </Label>
                {dataRoot ? (
                  <div className="flex items-center gap-2 p-3 bg-primary/5 border border-primary/20">
                    <Folder size={14} className="text-primary shrink-0" />
                    <span className="text-sm text-primary font-mono truncate flex-1">
                      {dataRoot}
                    </span>
                  </div>
                ) : (
                  <div className="h-10 bg-muted animate-pulse" />
                )}
              </div>

              <Button
                variant="outline"
                className="w-full"
                onClick={handlePickDataRoot}
              >
                <Folder size={14} className="mr-2" /> Chọn thư mục khác
              </Button>

              <Button
                className="w-full"
                onClick={handleDataDirNext}
                disabled={!dataRoot}
              >
                Tiếp tục <ArrowRight size={14} className="ml-1" />
              </Button>
            </div>
          )}

          {/* ── Step 2: Kết nối ── */}
          {step === "connection" && (
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-semibold text-foreground mb-1">
                  Kết nối AI
                </h2>
                <p className="text-sm text-muted-foreground">
                  Chọn cách kết nối phù hợp với bạn. Nếu không chắc, hãy liên
                  hệ bộ phận IT của trường để được hướng dẫn.
                </p>
              </div>

              <div className="space-y-2">
                {(
                  [
                    {
                      id: "local",
                      label: "Máy tính cá nhân",
                      description:
                        "AI chạy trực tiếp trên máy tính này. Không cần internet, dữ liệu không rời khỏi máy tính của bạn.",
                      badge: "Yêu cầu máy cá nhân cấu hình mạnh",
                      badgeVariant: "warning",
                    },
                    {
                      id: "remote",
                      label: "Máy chủ trung tâm",
                      description:
                        "Kết nối với AI do nhà trường hoặc đơn vị cung cấp quản lý. Liên hệ bộ phận IT để lấy địa chỉ máy chủ và mã kết nối.",
                      badge: "Dành cho máy cá nhân cấu hình yếu",
                      badgeVariant: "success",
                    },
                  ] as {
                    id: ConnectionChoice
                    label: string
                    description: string
                    badge: string
                    badgeVariant: "warning" | "success"
                  }[]
                ).map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setConnectionChoice(opt.id)}
                    className={`w-full flex items-center gap-3 p-3 border text-left transition-colors ${
                      connectionChoice === opt.id
                        ? "border-primary bg-primary/5"
                        : "hover:bg-muted/30 border-border"
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
                        connectionChoice === opt.id
                          ? "border-primary"
                          : "border-border"
                      }`}
                    >
                      {connectionChoice === opt.id && (
                        <div className="w-2 h-2 rounded-full bg-primary" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-foreground">
                          {opt.label}
                        </p>
                        <Badge
                          className={
                            opt.badgeVariant === "success"
                              ? "bg-green-100 text-green-700"
                              : "bg-amber-100 text-amber-700"
                          }
                        >
                          {opt.badge}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground/70 mt-0.5 leading-relaxed">
                        {opt.description}
                      </p>
                    </div>
                  </button>
                ))}
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="rounded-xl" onClick={goBack}>
                  <ArrowLeft size={14} /> Quay lại
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => setStep("ai-setup")}
                >
                  Tiếp tục <ArrowRight size={14} className="ml-1" />
                </Button>
              </div>
            </div>
          )}

          {/* ── Step 3: Cài đặt AI (local) ── */}
          {step === "ai-setup" && connectionChoice === "local" && (
            <div className="space-y-5">
              {installPhase === "idle" && (
                <>
                  <div>
                    <h2 className="text-base font-semibold text-foreground mb-1">
                      Cài đặt AI local
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Ứng dụng sẽ tải xuống và cài đặt:
                    </p>
                    <ul className="mt-2 space-y-1 text-sm text-muted-foreground list-disc list-inside">
                      <li>llama.cpp — chương trình giúp máy tính chạy mô hình AI</li>
                      <li>Gemma 4 E2B — mô hình AI (~3GB)</li>
                    </ul>
                  </div>

                  <div>
                    <Label className="text-sm font-medium text-foreground mb-1.5 block">
                      Thư mục lưu mô hình AI
                    </Label>
                    <div className="flex gap-2">
                      <div className="flex items-center gap-2 flex-1 py-2 px-2.5 bg-muted/40 border border-border min-w-0">
                        <Folder size={13} className="text-muted-foreground shrink-0" />
                        <span className="text-xs font-mono text-muted-foreground truncate">
                          {effectiveModelPath()}
                        </span>
                      </div>
                      <Button
                        variant="outline"
                        className="shrink-0"
                        onClick={handlePickModelDir}
                      >
                        Thay đổi
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground/60 mt-1">
                      Mặc định lưu tại thư mục dữ liệu ứng dụng. Yêu cầu ít nhất 4GB dung lượng bộ nhớ.
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" className="rounded-xl" onClick={goBack}>
                      <ArrowLeft size={14} /> Quay lại
                    </Button>
                    <Button className="flex-1" onClick={handleStartInstall}>
                      Bắt đầu cài đặt <ArrowRight size={14} className="ml-1" />
                    </Button>
                  </div>
                </>
              )}

              {installPhase === "installing" && (
                <div className="space-y-3">
                  <div>
                    <h2 className="text-base font-semibold text-foreground mb-1">
                      Đang cài đặt...
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Vui lòng không đóng ứng dụng trong khi cài đặt.
                    </p>
                  </div>
                  <div className="bg-zinc-950 rounded-lg border border-zinc-800 p-3 h-40 overflow-y-auto font-mono text-xs text-zinc-300 leading-relaxed">
                    {installLogs.map((line, i) => (
                      <div key={i} className="whitespace-pre-wrap break-all">
                        <span className="text-zinc-500 select-none mr-2">$</span>
                        {line}
                      </div>
                    ))}
                    <div ref={logsEndRef} />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-muted rounded-full h-2">
                        <div
                          className="bg-primary h-2 rounded-full transition-all duration-300"
                          style={{ width: `${installProgress}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground text-right shrink-0">
                        {installProgress}%
                        {installBytes && (
                          <> ({(installBytes.dl / 1073741824).toFixed(1)}/{(installBytes.total / 1073741824).toFixed(1)} GB)</>
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {installPhase === "done" && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-primary">
                    <CheckCircle2 size={20} />
                    <h2 className="text-base font-semibold">Cài đặt hoàn tất!</h2>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Mô hình AI đã sẵn sàng. Tiếp tục để thiết lập hồ sơ của bạn.
                  </p>
                  <Button
                    className="w-full"
                    onClick={() => setStep("profile")}
                  >
                    Tiếp tục <ArrowRight size={14} className="ml-1" />
                  </Button>
                </div>
              )}

              {installPhase === "error" && (
                <div className="space-y-4">
                  <div>
                    <h2 className="text-base font-semibold text-foreground mb-1">
                      Cài đặt thất bại
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Kiểm tra kết nối internet và thử lại.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" className="rounded-xl" onClick={goBack}>
                      <ArrowLeft size={14} /> Quay lại
                    </Button>
                    <Button
                      className="flex-1"
                      onClick={() => {
                        setInstallPhase("idle")
                        setInstallProgress(0)
                      }}
                    >
                      Thử lại
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Step 3: Kết nối AI (remote) ── */}
          {step === "ai-setup" && connectionChoice === "remote" && (
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-semibold text-foreground mb-1">
                  Kết nối máy chủ AI
                </h2>
                <p className="text-sm text-muted-foreground">
                  Nhập địa chỉ và mã kết nối do bộ phận IT cung cấp.
                </p>
              </div>

              <div className="space-y-2">
                <Input
                  autoFocus
                  value={customUrl}
                  onChange={(e) => {
                    setCustomUrl(e.target.value)
                    setConnectionOk(null)
                  }}
                  onKeyDown={(e) => e.key === "Enter" && handleRemoteConnect()}
                  placeholder="https://api.example.com/v1"
                  className="font-mono"
                />
                <Input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="API Key"
                  className="font-mono"
                />
              </div>

              {connectionOk === false && (
                <div className="bg-orange-50 border border-orange-200 text-orange-800 p-4 text-sm space-y-1">
                  <p className="font-medium">Không kết nối được. Kiểm tra:</p>
                  <ul className="text-xs space-y-1 text-orange-700 list-disc list-inside">
                    <li>Địa chỉ URL có đúng không?</li>
                    <li>API key có hợp lệ không?</li>
                    <li>Liên hệ bộ phận IT để được hỗ trợ</li>
                  </ul>
                </div>
              )}

              {connectionOk !== true && (
                <div className="flex gap-2">
                  <Button variant="outline" className="rounded-xl" onClick={goBack}>
                    <ArrowLeft size={14} /> Quay lại
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={handleRemoteConnect}
                    disabled={checking || !customUrl.trim()}
                  >
                    {checking ? "Đang kiểm tra..." : "Kết nối"}
                  </Button>
                </div>
              )}

              {connectionOk === true && (
                <div className="space-y-4">
                  <div className="bg-primary/5 border border-primary/20 text-primary p-3 text-sm flex items-center gap-2">
                    <CheckCircle2 size={16} />
                    <span>Kết nối thành công! Vui lòng chọn mô hình AI.</span>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-2">
                      Chọn mô hình AI
                    </h3>
                    <div className="space-y-2">
                      {models.length === 0 ? (
                        <div className="bg-orange-50 border border-orange-200 p-4 text-sm text-orange-800">
                          <p className="font-medium">Chưa có model nào trên máy chủ.</p>
                          <p className="text-xs text-orange-700 mt-1">
                            Liên hệ bộ phận IT để được hỗ trợ.
                          </p>
                        </div>
                      ) : (
                        models.map((m) => (
                          <label
                            key={m}
                            className={`flex items-center gap-3 p-3 border cursor-pointer transition-colors ${
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
                    className="w-full"
                    onClick={handleRemoteModelNext}
                    disabled={!selectedModel}
                  >
                    Tiếp tục <ArrowRight size={14} className="ml-1" />
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* ── Step 4: Hồ sơ ── */}
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
                <Button variant="outline" className="rounded-xl" onClick={goBack}>
                  <ArrowLeft size={14} /> Quay lại
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleFinish}
                  disabled={!teacherName.trim()}
                >
                  Tiếp tục <ArrowRight size={14} />
                </Button>
              </div>
            </div>
          )}

          {/* ── Step 5: Workspace ── */}
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
                  <div className="flex items-center gap-2 p-3 bg-primary/5 border border-primary/20">
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
                    className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-border hover:border-primary hover:bg-primary/5 text-sm text-muted-foreground hover:text-primary transition-colors"
                  >
                    <Folder size={14} /> Chọn thư mục...
                  </button>
                )}
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="rounded-xl" onClick={goBack}>
                  <ArrowLeft size={14} /> Quay lại
                </Button>
                <Button
                  className="flex-1 bg-primary hover:bg-primary/80"
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
  )
}
