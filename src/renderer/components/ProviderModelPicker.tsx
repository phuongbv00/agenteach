import { useEffect, useState } from "react"
import { Bot, ChevronDown, WifiOff } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/renderer/components/ui/dropdown-menu"
import { useAppStore } from "../stores/appStore"
import type { AIProvider } from "../types/api"

export function ProviderModelPicker() {
  const { config, setConfig } = useAppStore()
  const [modelsByProvider, setModelsByProvider] = useState<Record<string, string[]>>({})
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null)
  const [providerOnline, setProviderOnline] = useState<boolean | null>(null)

  const providers = config?.providers ?? []
  const activeProvider = providers.find((p) => p.id === config?.activeProviderId) ?? providers[0]
  const selectedModel = config?.selectedModel ?? ""
  const modelShort = selectedModel.split("/").pop() ?? selectedModel

  // Poll active provider health every 15s
  useEffect(() => {
    if (!activeProvider) return
    let cancelled = false
    const check = async () => {
      const ok = await window.api.checkProvider(activeProvider)
      if (!cancelled) setProviderOnline(ok)
    }
    check()
    const id = setInterval(check, 15_000)
    return () => { cancelled = true; clearInterval(id) }
  }, [activeProvider?.id])

  const loadModels = async (provider: AIProvider) => {
    if (modelsByProvider[provider.id] !== undefined) return
    setLoadingProvider(provider.id)
    try {
      const list = await window.api.listProviderModels(provider)
      setModelsByProvider((prev) => ({ ...prev, [provider.id]: list }))
    } finally {
      setLoadingProvider(null)
    }
  }

  const handleOpenChange = (open: boolean) => {
    if (open && activeProvider) loadModels(activeProvider)
  }

  const handleSelectProvider = async (provider: AIProvider) => {
    await window.api.setActiveProvider(provider.id)
    setConfig(await window.api.getConfig())
    loadModels(provider)
  }

  const handleSelectModel = async (model: string) => {
    await window.api.selectModel(model)
    setConfig(await window.api.getConfig())
  }

  const displayModels = modelsByProvider[activeProvider?.id ?? ""] ?? []
  const isOffline = providerOnline === false

  return (
    <DropdownMenu onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <button className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs hover:bg-muted/50 transition-colors max-w-56 ${isOffline ? "border-destructive/50 text-destructive" : "border-border bg-background"}`}>
          {isOffline ? (
            <WifiOff size={11} className="shrink-0" />
          ) : (
            <Bot size={11} className="text-primary shrink-0" />
          )}
          <span className="text-muted-foreground truncate">{activeProvider?.name ?? "—"}</span>
          <span className="text-muted-foreground">·</span>
          <span className="font-medium truncate">{modelShort || "—"}</span>
          <ChevronDown size={10} className="text-muted-foreground shrink-0" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64">
        {providers.length > 1 && (
          <>
            <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground font-normal">
              Provider
            </DropdownMenuLabel>
            {providers.map((p) => (
              <DropdownMenuItem
                key={p.id}
                onClick={() => handleSelectProvider(p)}
                className={`text-xs gap-2 ${p.id === activeProvider?.id ? "text-primary font-medium" : ""}`}
              >
                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${p.id === activeProvider?.id ? "bg-primary" : "bg-muted-foreground/30"}`} />
                {p.name}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
          </>
        )}

        <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground font-normal">
          Model
        </DropdownMenuLabel>
        {loadingProvider === activeProvider?.id ? (
          <p className="text-xs text-muted-foreground px-2 py-1.5">Đang tải...</p>
        ) : displayModels.length === 0 ? (
          <p className="text-xs text-muted-foreground px-2 py-1.5">
            {isOffline ? "Không kết nối được" : "Chưa có model"}
          </p>
        ) : (
          displayModels.map((m) => (
            <DropdownMenuItem
              key={m}
              onClick={() => handleSelectModel(m)}
              className={`text-xs truncate ${m === selectedModel ? "text-primary font-medium" : ""}`}
            >
              {m}
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
