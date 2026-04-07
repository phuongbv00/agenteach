import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import type { ChatMessage } from "../types/api";
import type { ReasoningItem, ToolCallItem } from "../stores/chatStore";

// ── Thinking parser (for StreamingBubble only) ───────────────────────────────
interface ParsedContent {
  thinking: string;
  thinkingOpen: boolean;
  text: string;
}

function parseThinking(raw: string): ParsedContent {
  const thinkRe = /<think(?:ing)?>([\s\S]*?)<\/think(?:ing)?>/gi;
  let thinking = "";
  let thinkingOpen = false;
  let text = raw;

  text = raw.replace(thinkRe, (_, inner) => {
    thinking += (thinking ? "\n\n" : "") + inner.trim();
    return "";
  });

  const openMatch = text.match(/<think(?:ing)?>([\s\S]*)$/i);
  if (openMatch) {
    thinking += (thinking ? "\n\n" : "") + openMatch[1];
    text = text.slice(0, text.length - openMatch[0].length);
    thinkingOpen = true;
  }

  return { thinking: thinking.trim(), thinkingOpen, text: text.trim() };
}

// ── ToolCallBubble ───────────────────────────────────────────────────────────
const TOOL_ICONS: Record<string, string> = {
  list_directory: "📂",
  read_file: "📄",
  write_file: "✏️",
  search_files: "🔍",
  update_memory: "🧠",
  get_date: "📅",
};

interface ToolCallBubbleProps {
  item: ToolCallItem;
}

export function ToolCallBubble({ item }: ToolCallBubbleProps) {
  const [expanded, setExpanded] = useState(false);
  const icon = TOOL_ICONS[item.toolName] ?? "⚙️";

  return (
    <div className="mb-1.5">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors py-0.5"
      >
        <span className="text-gray-300">{expanded ? "▼" : "▶"}</span>
        <span>{icon}</span>
        <span>{item.label}</span>
      </button>

      {expanded && (
        <div className="mt-1 ml-4 bg-gray-50 border-l-2 border-gray-200 overflow-hidden text-xs">
          {Object.keys(item.args).length > 0 && (
            <div className="px-3 py-2 border-b border-gray-100">
              <p
                className="text-gray-400 font-medium mb-1 uppercase tracking-wide"
                style={{ fontSize: "10px" }}
              >
                Đầu vào
              </p>
              {Object.entries(item.args).map(([k, v]) => (
                <div key={k} className="flex gap-2">
                  <span className="text-gray-400 flex-shrink-0">{k}:</span>
                  <span className="text-gray-600 font-mono break-all">
                    {String(v)}
                  </span>
                </div>
              ))}
            </div>
          )}
          {item.result && (
            <div className="px-3 py-2">
              <p
                className="text-gray-400 font-medium mb-1 uppercase tracking-wide"
                style={{ fontSize: "10px" }}
              >
                Kết quả
              </p>
              <pre className="text-gray-600 whitespace-pre-wrap font-mono leading-relaxed">
                {item.result}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── ReasoningBubble ──────────────────────────────────────────────────────────
interface ReasoningBubbleProps {
  item: ReasoningItem;
  isOpen?: boolean;
}

export function ReasoningBubble({ item, isOpen }: ReasoningBubbleProps) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="mb-1.5">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors py-0.5"
      >
        <span className="text-gray-300">{expanded ? "▼" : "▶"}</span>
        <span className="italic">
          {isOpen ? "Đang suy nghĩ" : "Dòng suy nghĩ"}
        </span>
        {isOpen && (
          <span className="inline-flex gap-0.5 ml-1">
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
        )}
      </button>
      {expanded && item.content && (
        <div className="mt-1 px-3 py-2 bg-gray-50 border-l-2 border-gray-200 text-xs text-gray-500 leading-relaxed whitespace-pre-wrap font-mono max-h-48 overflow-y-auto">
          {item.content}
        </div>
      )}
    </div>
  );
}

// ── MessageBubble ────────────────────────────────────────────────────────────
interface MessageBubbleProps {
  message: ChatMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="flex justify-end mb-4">
        <div className="max-w-[75%] bg-blue-500 text-white rounded-2xl rounded-tr-sm px-4 py-2.5">
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-4">
      <div className="prose prose-sm max-w-none text-gray-800">
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkMath]}
          rehypePlugins={[rehypeKatex]}
        >
          {message.content}
        </ReactMarkdown>
      </div>
    </div>
  );
}

// ── StreamingBubble ──────────────────────────────────────────────────────────
interface StreamingBubbleProps {
  content: string;
  reasoning?: string;
  isWaitingForText?: boolean;
}

export function StreamingBubble({ content, reasoning, isWaitingForText }: StreamingBubbleProps) {
  const parsed = parseThinking(content);
  const thinkingText = reasoning || parsed.thinking;
  // After text-start, reasoning is done — don't show it as still-open
  const thinkingOpen = reasoning
    ? !isWaitingForText && reasoning.length > 0 && !content
    : parsed.thinkingOpen;
  const hasThinking = thinkingText.length > 0 || thinkingOpen;
  const hasText = parsed.text.length > 0;

  // Fake ReasoningItem for display during streaming
  const fakeReasoningItem = {
    type: "reasoning" as const,
    id: "streaming",
    content: thinkingText,
  };

  return (
    <div className="mb-4">
      {hasThinking && (
        <ReasoningBubble item={fakeReasoningItem} isOpen={thinkingOpen} />
      )}
      {hasText ? (
        <div className="prose prose-sm max-w-none text-gray-800">
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[rehypeKatex]}
          >
            {parsed.text}
          </ReactMarkdown>
        </div>
      ) : isWaitingForText ? (
        <div className="flex items-center gap-2 text-xs text-gray-400 py-1">
          <span className="inline-flex gap-0.5">
            <span
              className="w-1.5 h-1.5 bg-blue-300 rounded-full animate-bounce"
              style={{ animationDelay: "0ms" }}
            />
            <span
              className="w-1.5 h-1.5 bg-blue-300 rounded-full animate-bounce"
              style={{ animationDelay: "150ms" }}
            />
            <span
              className="w-1.5 h-1.5 bg-blue-300 rounded-full animate-bounce"
              style={{ animationDelay: "300ms" }}
            />
          </span>
          <span>Đang soạn câu trả lời...</span>
        </div>
      ) : !hasThinking ? (
        <div className="flex gap-1 items-center py-1">
          <span
            className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce"
            style={{ animationDelay: "0ms" }}
          />
          <span
            className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce"
            style={{ animationDelay: "150ms" }}
          />
          <span
            className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce"
            style={{ animationDelay: "300ms" }}
          />
        </div>
      ) : null}
    </div>
  );
}
