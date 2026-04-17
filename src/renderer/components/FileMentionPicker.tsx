import { useState, useMemo } from "react"
import { Plus, FolderSearch } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/renderer/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/renderer/components/ui/dialog"
import { Button } from "@/renderer/components/ui/button"
import { Input } from "@/renderer/components/ui/input"
import { ScrollArea } from "@/renderer/components/ui/scroll-area"
import type { WorkspaceFile } from "@/renderer/types/api"

interface FileMentionPickerProps {
  workspaceId: string
  workspacePath: string
  onConfirm: (files: WorkspaceFile[]) => void
}

export function FileMentionPicker({
  workspaceId,
  workspacePath,
  onConfirm,
}: FileMentionPickerProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [files, setFiles] = useState<WorkspaceFile[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)

  const openPicker = async () => {
    setDropdownOpen(false)
    setLoading(true)
    setQuery("")
    setSelected(new Set())
    setDialogOpen(true)
    try {
      const result = await window.api.listWorkspaceFiles(
        workspaceId,
        workspacePath,
      )
      setFiles(result)
    } finally {
      setLoading(false)
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return files
    return files.filter(
      (f) =>
        f.name.toLowerCase().includes(q) || f.rel.toLowerCase().includes(q),
    )
  }, [files, query])

  const toggle = (rel: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(rel) ? next.delete(rel) : next.add(rel)
      return next
    })
  }

  const confirm = () => {
    const chosen = files.filter((f) => selected.has(f.rel))
    onConfirm(chosen)
    setDialogOpen(false)
  }

  return (
    <>
      <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm">
            <Plus size={16} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start">
          <DropdownMenuItem onSelect={openPicker} className="gap-2 text-xs">
            <FolderSearch size={14} />
            Chọn tài liệu
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="min-w-[70dvw] max-w-[90dvw]">
          <DialogHeader>
            <DialogTitle>Chọn tài liệu từ workspace</DialogTitle>
          </DialogHeader>

          <Input
            placeholder="Tìm kiếm tài liệu..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />

          <ScrollArea className="h-[50dvh] overflow-x-auto">
            {loading && (
              <p className="text-xs text-muted-foreground px-1 py-2">
                Đang tải...
              </p>
            )}
            {!loading && filtered.length === 0 && (
              <p className="text-xs text-muted-foreground px-1 py-2">
                Không có tài liệu nào
              </p>
            )}
            {!loading &&
              filtered.map((f) => {
                const checked = selected.has(f.rel)
                return (
                  <button
                    key={f.rel}
                    onClick={() => toggle(f.rel)}
                    className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-sm text-left transition-colors hover:bg-muted ${
                      checked ? "bg-primary/10 text-primary" : ""
                    }`}
                  >
                    <span
                      className={`size-4 shrink-0 rounded border flex items-center justify-center text-xs ${
                        checked
                          ? "bg-primary border-primary text-primary-foreground"
                          : "border-border"
                      }`}
                    >
                      {checked && "✓"}
                    </span>
                    <span className="flex flex-col min-w-0">
                      <span className="truncate font-medium">{f.name}</span>
                      <span className="text-xs text-muted-foreground truncate">
                        {f.rel}
                      </span>
                    </span>
                  </button>
                )
              })}
          </ScrollArea>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Huỷ
            </Button>
            <Button onClick={confirm} disabled={selected.size === 0}>
              Xác nhận ({selected.size})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
