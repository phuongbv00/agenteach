import React, { useEffect, useRef, useState } from "react";
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
  const [fileProgress, setFileProgress] = useState<{
    fileName: string;
    stage: "reading" | "parsing";
  } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
      .sendMessage(allMessages, activeSessionId ?? undefined)
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
          <p className="text-5xl">📁</p>
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

  return (
    <div className="flex-1 flex flex-col bg-gray-50 min-w-0">
      {/* Header */}
      <div className="bg-white border-b px-4 py-2.5 flex items-center gap-3 flex-shrink-0">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-800 truncate">
            {activeWorkspace.name}
          </p>
          <p className="text-xs text-gray-400 font-mono truncate">
            {activeWorkspace.path}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {items.length === 0 && !isStreaming && (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 space-y-4">
            <p className="text-5xl">👩‍🏫</p>
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

      {/* Input */}
      <div className="bg-white border-t px-4 py-3 flex-shrink-0">
        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Nhập yêu cầu... (Enter để gửi, Shift+Enter xuống dòng)"
            rows={1}
            style={{ resize: "none" }}
            className="flex-1 border rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-300 max-h-40 overflow-y-auto"
            onInput={(e) => {
              const t = e.currentTarget;
              t.style.height = "auto";
              t.style.height = `${Math.min(t.scrollHeight, 160)}px`;
            }}
          />
          {isStreaming ? (
            <button
              onClick={() => window.api.cancelMessage()}
              className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm transition-colors flex-shrink-0"
            >
              Dừng
            </button>
          ) : (
            <button
              onClick={send}
              disabled={!input.trim()}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl text-sm disabled:opacity-40 transition-colors flex-shrink-0"
            >
              Gửi
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
