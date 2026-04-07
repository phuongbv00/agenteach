import React, { useEffect, useRef, useState } from "react";
import { ArrowUp, ChevronDown, FolderOpen, GraduationCap, Plus, Square } from "lucide-react";
import { useChatStore } from "../stores/chatStore";
import { useAppStore } from "../stores/appStore";
import {
  MessageBubble,
  ReasoningBubble,
  StreamingBubble,
  ToolCallBubble,
} from "./MessageBubble";
import type { ToolCallEvent } from "../types/api";

export default function ChatPanel() {
  const {
    items,
    isStreaming,
    streamingContent,
    reasoningContent,
    pendingItems,
    pendingToolCall,
    isWaitingForText,
    addUserMessage,
    appendToken,
    appendReasoning,
    setWaitingForText,
    addToolCallStart,
    addToolCall,
    finalizeAssistantMessage,
    setStreaming,
    toMessages,
    toStoredItems,
  } = useChatStore();
  const { activeWorkspace, activeSessionId } = useAppStore();
  const [input, setInput] = useState("");
  const [selectedModel, setSelectedModel] = useState("");
  const [models, setModels] = useState<string[]>([]);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [fileProgress, setFileProgress] = useState<{
    fileName: string;
    stage: "reading" | "parsing";
  } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const modelBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    window.api.getConfig().then((c) => setSelectedModel(c.selectedModel ?? ""));
    window.api.listModels().then(setModels);
  }, []);

  useEffect(() => {
    if (!modelMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        modelBtnRef.current &&
        !modelBtnRef.current
          .closest("[data-model-menu]")
          ?.contains(e.target as Node)
      ) {
        setModelMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [modelMenuOpen]);

  const handleSelectModel = async (model: string) => {
    await window.api.selectModel(model);
    setSelectedModel(model);
    setModelMenuOpen(false);
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [
    items,
    streamingContent,
    reasoningContent,
    pendingItems,
    isWaitingForText,
  ]);

  // Save session after each completed turn
  useEffect(() => {
    if (
      !isStreaming &&
      activeWorkspace &&
      activeSessionId &&
      items.length > 0
    ) {
      window.api.saveSessionMessages(
        activeWorkspace.id,
        activeSessionId,
        toStoredItems(),
      );
    }
  }, [isStreaming]);

  useEffect(() => {
    window.api.offAgentEvents();
    window.api.onToken((token) => appendToken(token));
    window.api.onReasoning((text) => appendReasoning(text));
    window.api.onTextStart(() => setWaitingForText());
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
      .sendMessage(
        allMessages,
        activeSessionId ?? undefined,
        selectedModel || undefined,
      )
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
      <div className="flex-1 flex items-center justify-center text-gray-400 bg-gray-50">
        <div className="text-center space-y-3">
          <FolderOpen size={48} className="text-gray-300" />
          <p className="text-sm font-medium">
            Chọn hoặc tạo workspace để bắt đầu
          </p>
          <p className="text-xs text-gray-300">
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
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-36">
        {items.length === 0 && !isStreaming && (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 space-y-4">
            <GraduationCap size={48} className="text-gray-300" />
            <div className="text-center">
              <p className="text-sm font-medium text-gray-600">
                Tôi có thể giúp gì cho bạn hôm nay?
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Tôi sẽ tự tìm tài liệu trong workspace của bạn
              </p>
            </div>
            <div className="grid grid-cols-1 gap-2 w-full max-w-xs">
              {[
                "Soạn giáo án cho tiết học tiếp theo",
                "Xem các tài liệu trong workspace",
                "Tạo đề kiểm tra 15 phút",
              ].map((hint) => (
                <button
                  key={hint}
                  onClick={() => {
                    setInput(hint);
                    textareaRef.current?.focus();
                  }}
                  className="text-left text-xs bg-white border border-gray-200 rounded-xl px-3 py-2.5 hover:bg-blue-50 hover:border-blue-200 transition-colors text-gray-600"
                >
                  {hint}
                </button>
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
              message={{ role: item.role, content: item.content }}
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
                  message={{ role: item.role, content: item.content }}
                />
              );
            })}
            {pendingToolCall && (
              <div className="flex items-center gap-2 text-xs text-gray-400 py-1 mb-1">
                <span className="inline-flex gap-0.5">
                  <span
                    className="w-1 h-1 bg-gray-300 rounded-full animate-bounce"
                    style={{ animationDelay: "0ms" }}
                  />
                  <span
                    className="w-1 h-1 bg-gray-300 rounded-full animate-bounce"
                    style={{ animationDelay: "150ms" }}
                  />
                  <span
                    className="w-1 h-1 bg-gray-300 rounded-full animate-bounce"
                    style={{ animationDelay: "300ms" }}
                  />
                </span>
                <span>{pendingToolCall.label}</span>
              </div>
            )}
            {fileProgress && (
              <div className="flex items-center gap-2 text-xs text-gray-400 py-1 mb-1">
                <span className="inline-flex gap-0.5">
                  <span
                    className="w-1 h-1 bg-blue-300 rounded-full animate-bounce"
                    style={{ animationDelay: "0ms" }}
                  />
                  <span
                    className="w-1 h-1 bg-blue-300 rounded-full animate-bounce"
                    style={{ animationDelay: "150ms" }}
                  />
                  <span
                    className="w-1 h-1 bg-blue-300 rounded-full animate-bounce"
                    style={{ animationDelay: "300ms" }}
                  />
                </span>
                <span>
                  {fileProgress.stage === "reading"
                    ? "Đang đọc"
                    : "Đang phân tích"}{" "}
                  <span className="font-mono text-gray-500">
                    {fileProgress.fileName}
                  </span>
                </span>
              </div>
            )}
            <StreamingBubble
              content={streamingContent}
              reasoning={reasoningContent}
              isWaitingForText={isWaitingForText}
            />
          </>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Floating input */}
      <div className="absolute bottom-0 left-0 right-0 p-6 pointer-events-none">
        <div className="max-w-2xl mx-auto pointer-events-auto">
          <div className="bg-white rounded-xl shadow-lg p-3 border">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Nhập yêu cầu..."
              rows={1}
              style={{ resize: "none" }}
              className="w-full bg-transparent outline-none text-sm text-gray-800 placeholder-gray-400 max-h-40 overflow-y-auto"
              onInput={(e) => {
                const t = e.currentTarget;
                t.style.height = "auto";
                t.style.height = `${Math.min(t.scrollHeight, 160)}px`;
              }}
            />
            <div className="flex items-end mt-2 gap-2">
              <button
                className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-100"
                disabled
              >
                <Plus size={16} />
              </button>
              <div className="flex-1" />
              <div className="relative" data-model-menu>
                <button
                  ref={modelBtnRef}
                  onClick={() => setModelMenuOpen((o) => !o)}
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 transition-colors px-2 py-1 rounded-xl hover:bg-gray-100"
                >
                  <span>{modelLabel}</span>
                  <ChevronDown size={12} />
                </button>
                {modelMenuOpen && (
                  <div className="absolute bottom-full right-0 mb-1 bg-white border border-gray-200 rounded-xl shadow-lg py-1 max-h-56 overflow-y-auto z-50">
                    {models.length === 0 && (
                      <p className="text-xs text-gray-400 px-3 py-2">
                        Không có model khả dụng
                      </p>
                    )}
                    {models.map((m) => (
                      <button
                        key={m}
                        onClick={() => handleSelectModel(m)}
                        className={`w-full text-left text-xs px-3 py-2 hover:bg-gray-50 transition-colors truncate ${m === selectedModel ? "text-blue-600 font-medium" : "text-gray-700"}`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {isStreaming ? (
                <button
                  onClick={() => window.api.cancelMessage()}
                  className="w-8 h-8 flex items-center justify-center bg-red-500 hover:bg-red-600 text-white rounded-xl transition-colors flex-shrink-0"
                >
                  <Square size={14} fill="currentColor" strokeWidth={0} />
                </button>
              ) : (
                <button
                  onClick={send}
                  disabled={!input.trim()}
                  className="w-8 h-8 flex items-center justify-center bg-blue-500 hover:bg-blue-600 disabled:bg-gray-200 text-white rounded-xl transition-colors flex-shrink-0"
                >
                  <ArrowUp size={14} strokeWidth={2.5} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
