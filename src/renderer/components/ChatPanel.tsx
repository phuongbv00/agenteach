import { useEffect, useRef, useState } from "react";
import { ArrowUp, ChevronDown, FolderOpen, GraduationCap, Plus, Square } from "lucide-react";
import { useChatStore } from "../stores/chatStore";
import type { MessageItem } from "../stores/chatStore";
import { useAppStore } from "../stores/appStore";
import {
  MessageBubble,
  ReasoningBubble,
  StreamingBubble,
  ToolCallBubble,
} from "./MessageBubble";
import type { ToolCallEvent } from "../types/api";
import { Button } from "@/renderer/components/ui/button";
import { Textarea } from "@/renderer/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/renderer/components/ui/dropdown-menu";

export default function ChatPanel() {
  const {
    items,
    isStreaming,
    streamingContent,
    reasoningContent,
    pendingItems,
    pendingToolCall,
    addUserMessage,
    appendToken,
    appendReasoning,
    addToolCallStart,
    addToolCall,
    finalizeAssistantMessage,
    setStreaming,
    toMessages,
    savedMessageCount,
    markSaved,
  } = useChatStore();
  const { activeWorkspace, activeSessionId, config, setConfig } = useAppStore();
  const [input, setInput] = useState("");
  const selectedModel = config?.selectedModel ?? "";
  const [models, setModels] = useState<string[]>([]);
  const [, setFileProgress] = useState<{
    fileName: string;
    stage: "reading" | "parsing";
  } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    window.api.listModels().then(setModels);
  }, [config?.activeProviderId]);

  const handleSelectModel = async (model: string) => {
    await window.api.selectModel(model);
    setConfig(await window.api.getConfig());
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [items, streamingContent, reasoningContent, pendingItems]);

  // Append new messages to DB after each completed turn
  useEffect(() => {
    if (!isStreaming && activeWorkspace && activeSessionId && items.length > 0) {
      const all = toMessages();
      const newMessages = all.slice(savedMessageCount);
      if (newMessages.length > 0) {
        window.api.appendSessionMessages(
          activeWorkspace.id,
          activeSessionId,
          newMessages,
          savedMessageCount,
        ).then(() => markSaved(all.length));
      }
    }
  }, [isStreaming]);

  useEffect(() => {
    window.api.offAgentEvents();
    window.api.onToken((token) => appendToken(token));
    window.api.onReasoning((text) => appendReasoning(text));
    window.api.onToolCallStart((event) => {
      setFileProgress(null);
      addToolCallStart(event as Omit<ToolCallEvent, "result">);
    });
    window.api.onToolCall((event) => {
      setFileProgress(null);
      addToolCall(event as ToolCallEvent);
    });
    window.api.onDone(() => {
      setFileProgress(null);
      finalizeAssistantMessage();
    });
    window.api.onFileProgress((info) => setFileProgress(info));
    return () => window.api.offAgentEvents();
  }, []);

  const send = async () => {
    const content = input.trim();
    if (!content || isStreaming) return;

    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    addUserMessage(content);
    setStreaming(true);

    const allMessages = [...toMessages(), { role: "user" as const, content }];
    window.api
      .sendMessage(allMessages, activeSessionId ?? undefined, selectedModel || undefined)
      .catch(() => finalizeAssistantMessage());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send();
    }
  };

  if (!activeWorkspace) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground bg-muted/30">
        <div className="text-center space-y-3">
          <FolderOpen size={48} className="text-muted-foreground/40 mx-auto" />
          <p className="text-sm font-medium">Chọn hoặc tạo workspace để bắt đầu</p>
          <p className="text-xs text-muted-foreground/60">
            Workspace là thư mục chứa tài liệu giảng dạy của bạn
          </p>
        </div>
      </div>
    );
  }

  const modelLabel = selectedModel
    ? (selectedModel.split("/").pop() ?? selectedModel)
    : "Model";

  return (
    <div className="flex-1 flex flex-col min-w-0 relative">
      {/* Header */}
      <div className="border-b flex items-center p-2 bg-background/50 backdrop-blur-md z-10 sticky top-0">
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="p-2 bg-muted text-muted-foreground">
            <FolderOpen size={20} />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-sm text-muted-foreground truncate">
              {activeWorkspace.path}
            </span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-32">
        {items.length === 0 && !isStreaming && (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground space-y-4">
            <GraduationCap size={48} className="text-primary" />
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">
                Tôi có thể giúp gì cho bạn hôm nay?
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Tôi sẽ mặc định sử dụng tài liệu trong workspace của bạn
              </p>
            </div>
            <div className="grid grid-cols-1 gap-2 w-full max-w-xs">
              {[
                "Soạn giáo án cho tiết học tiếp theo",
                "Xem các tài liệu trong workspace",
                "Tạo đề kiểm tra 15 phút",
              ].map((hint) => (
                <Button
                  key={hint}
                  variant="outline"
                  size="sm"
                  className="justify-start h-auto py-2.5 px-3 text-xs"
                  onClick={() => {
                    setInput(hint);
                    textareaRef.current?.focus();
                  }}
                >
                  {hint}
                </Button>
              ))}
            </div>
          </div>
        )}

        {items.map((item, i) => {
          if (item.type === "tool_call")
            return <ToolCallBubble key={item.id} item={item} />;
          if (item.type === "reasoning")
            return <ReasoningBubble key={item.id} item={item} />;
          return (
            <MessageBubble
              key={i}
              message={item as MessageItem}
            />
          );
        })}

        {/* Streaming turn */}
        {isStreaming && (
          <>
            {pendingItems.map((item, i) => {
              if (item.type === "tool_call")
                return <ToolCallBubble key={item.id} item={item} />;
              if (item.type === "reasoning")
                return <ReasoningBubble key={item.id} item={item} />;
              return (
                <MessageBubble
                  key={i}
                  message={item as MessageItem}
                />
              );
            })}
            {pendingToolCall && (
              <ToolCallBubble
                item={{
                  type: "tool_call",
                  id: "pending",
                  toolName: pendingToolCall.toolName,
                  label: pendingToolCall.label,
                  args: pendingToolCall.args,
                  result: "",
                }}
                isLoading
              />
            )}
            <StreamingBubble
              content={streamingContent}
              reasoning={reasoningContent}
            />
          </>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Floating input */}
      <div className="absolute bottom-0 left-0 right-0 p-6 pointer-events-none">
        <div className="max-w-2xl mx-auto pointer-events-auto">
          <div className="bg-background shadow-lg p-3 border">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Nhập yêu cầu..."
              rows={1}
              style={{ resize: "none" }}
              className="w-full border-0 shadow-none p-0 text-sm max-h-40 overflow-y-auto focus-visible:ring-0 bg-transparent"
              onInput={(e) => {
                const t = e.currentTarget;
                t.style.height = "auto";
                t.style.height = `${Math.min(t.scrollHeight, 160)}px`;
              }}
            />
            <div className="flex items-end mt-3 gap-2">
              <Button variant="ghost" size="icon-sm">
                <Plus size={16} />
              </Button>
              <div className="flex-1" />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="xs"
                    className="text-muted-foreground gap-1 rounded-xl"
                  >
                    <span>{modelLabel}</span>
                    <ChevronDown size={12} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="max-h-56 overflow-y-auto">
                  {models.length === 0 && (
                    <p className="text-xs text-muted-foreground px-3 py-2">
                      Không có model khả dụng
                    </p>
                  )}
                  {models.map((m) => (
                    <DropdownMenuItem
                      key={m}
                      onClick={() => handleSelectModel(m)}
                      className={`text-xs truncate ${m === selectedModel ? "text-primary font-medium" : ""}`}
                    >
                      {m}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              {isStreaming ? (
                <Button
                  size="icon-sm"
                  variant="destructive"
                  className="rounded-xl flex-shrink-0"
                  onClick={() => {
                    finalizeAssistantMessage();
                    window.api.cancelMessage();
                  }}
                >
                  <Square size={14} fill="currentColor" strokeWidth={0} />
                </Button>
              ) : (
                <Button
                  size="icon-sm"
                  className="rounded-xl flex-shrink-0"
                  disabled={!input.trim()}
                  onClick={send}
                >
                  <ArrowUp size={14} strokeWidth={2.5} />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
