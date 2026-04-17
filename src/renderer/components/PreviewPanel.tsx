import { Button } from "@/renderer/components/ui/button";
import "katex/dist/katex.min.css";
import { ExternalLink, FolderOpen, X } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import type { PreviewData } from "../types/api";
import { normalizeMathDelimiters } from "../lib/utils";

interface Props {
  data: PreviewData;
  onClose: () => void;
}

type LoadState = "loading" | "ready" | "error";

export default function PreviewPanel({ data, onClose }: Props) {
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [mdContent, setMdContent] = useState("");
  const [blobUrl, setBlobUrl] = useState("");
  const prevBlobUrl = useRef("");
  const [width, setWidth] = useState(500);
  const isResizing = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const onMouseDown = (e: React.MouseEvent) => {
    isResizing.current = true;
    startX.current = e.clientX;
    startWidth.current = width;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const onMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      const delta = startX.current - e.clientX;
      setWidth(Math.max(280, Math.min(900, startWidth.current + delta)));
    };

    const onMouseUp = () => {
      isResizing.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  useEffect(() => {
    setLoadState("loading");
    setMdContent("");
    if (prevBlobUrl.current) {
      URL.revokeObjectURL(prevBlobUrl.current);
      prevBlobUrl.current = "";
    }
    setBlobUrl("");

    let cancelled = false;

    async function load() {
      try {
        if (data.type === "md") {
          const text = await window.api.readFileText(data.filePath);
          if (!cancelled) {
            setMdContent(text);
            setLoadState("ready");
          }
        } else if (data.type === "pdf") {
          const buf = await window.api.readFileBinary(data.filePath);
          if (cancelled) return;
          const blob = new Blob([buf as BlobPart], { type: "application/pdf" });
          const url = URL.createObjectURL(blob);
          prevBlobUrl.current = url;
          setBlobUrl(url);
          setLoadState("ready");
        } else {
          const html = await window.api.readDocxHtml(data.filePath);
          if (cancelled) return;
          const styled = `<html><head><meta charset="utf-8"><style>
            body{font-family:Arial,sans-serif;margin:24px 32px;line-height:1.6;color:#222;}
            h1{font-size:22px;border-bottom:2px solid #333;padding-bottom:4px;}
            h2{font-size:18px;border-bottom:1px solid #ccc;padding-bottom:2px;}
            h3{font-size:15px;}table{border-collapse:collapse;width:100%;}
            th,td{border:1px solid #ccc;padding:6px 10px;}th{background:#f0f0f0;}
            ul,ol{padding-left:22px;}p{margin:6px 0;}
          </style></head><body>${html}</body></html>`;
          const blob = new Blob([styled], { type: "text/html" });
          const url = URL.createObjectURL(blob);
          prevBlobUrl.current = url;
          setBlobUrl(url);
          setLoadState("ready");
        }
      } catch {
        if (!cancelled) setLoadState("error");
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [data.filePath, data.type]);

  // Cleanup blob on unmount
  useEffect(() => {
    return () => {
      if (prevBlobUrl.current) URL.revokeObjectURL(prevBlobUrl.current);
    };
  }, []);

  return (
    <div className="flex h-full shrink-0" style={{ width }}>
      {/* Resize handle */}
      <div
        onMouseDown={onMouseDown}
        className="w-1 h-full cursor-col-resize hover:bg-primary/50 transition-colors shrink-0"
      />
      <div className="flex flex-col flex-1 border-l overflow-hidden">
        {/* Header */}
        <div className="flex items-center pl-4 p-2 border-b shrink-0">
          <span
            className="flex-1 text-sm font-medium truncate"
            title={data.filePath}
          >
            {data.fileName}
          </span>
          <Button
            onClick={() => window.api.showInFolder(data.filePath)}
            title="Mở thư mục chứa file"
            variant="ghost"
            size="icon"
          >
            <FolderOpen size={14} />
          </Button>
          <Button
            onClick={() => window.api.openFile(data.filePath)}
            title="Mở bằng ứng dụng mặc định"
            variant="ghost"
            size="icon"
          >
            <ExternalLink size={14} />
          </Button>
          <Button onClick={onClose} variant="ghost" size="icon" title="Đóng">
            <X size={14} />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {loadState === "loading" && (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              Đang tải...
            </div>
          )}
          {loadState === "error" && (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              Không thể đọc file này.
            </div>
          )}
          {loadState === "ready" && data.type === "md" && (
            <div className="h-full overflow-y-auto px-4 py-2 prose prose-sm max-w-none">
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeKatex]}
              >
                {normalizeMathDelimiters(mdContent)}
              </ReactMarkdown>
            </div>
          )}
          {loadState === "ready" &&
            (data.type === "pdf" || data.type === "docx") &&
            blobUrl && (
              <iframe
                src={blobUrl}
                className="w-full h-full border-0"
                title={data.fileName}
              />
            )}
        </div>
      </div>
    </div>
  );
}
