import "katex/dist/katex.min.css";
import {
  ChevronDown,
  ChevronRight
} from "lucide-react";
import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import type { ReasoningItem, ToolCallItem } from "../stores/chatStore";
import type { ChatMessage } from "../types/api";

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

// ── ExpandableBubble (Reusable) ─────────────────────────────────────────────
interface ExpandableBubbleProps {
  label: React.ReactNode;
  children: React.ReactNode;
  defaultExpanded?: boolean;
  isThinking?: boolean;
}

export function ExpandableBubble({
  label,
  children,
  defaultExpanded = false,
  isThinking = false,
}: ExpandableBubbleProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className="mb-1.5">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-0.5 cursor-pointer"
      >
        {expanded ? (
          <ChevronDown size={12} />
        ) : (
          <ChevronRight size={12} />
        )}
        <span className="text-left">{label}</span>
        {isThinking && (
          <span className="inline-flex gap-0.5 ml-1">
            <span
              className="w-1 h-1 bg-muted-foreground rounded-full animate-bounce"
              style={{ animationDelay: "0ms" }}
            />
            <span
              className="w-1 h-1 bg-muted-foreground rounded-full animate-bounce"
              style={{ animationDelay: "150ms" }}
            />
            <span
              className="w-1 h-1 bg-muted-foreground rounded-full animate-bounce"
              style={{ animationDelay: "300ms" }}
            />
          </span>
        )}
      </button>

      {expanded && (
        <div className="mt-1 bg-muted/50 border-l-3 text-xs transition-all animate-in fade-in slide-in-from-top-1 duration-200">
          {children}
        </div>
      )}
    </div>
  );
}

// ── ToolCallBubble ───────────────────────────────────────────────────────────
interface ToolCallBubbleProps {
  item: ToolCallItem;
  isLoading?: boolean;
}

export function ToolCallBubble({ item, isLoading }: ToolCallBubbleProps) {
  const label = (
    <div className="flex items-center gap-1.5">
      <span>{item.label}</span>
    </div>
  );

  return (
    <ExpandableBubble label={label} isThinking={isLoading}>
      <div className="overflow-hidden">
        {Object.keys(item.args).length > 0 && (
          <div className="px-3 py-2 border-b border-dashed">
            <p
              className="text-muted-foreground font-medium mb-1.5 uppercase tracking-wider"
            >
              Tham số
            </p>
            <div className="space-y-1">
              {Object.entries(item.args).map(([k, v]) => (
                <div key={k} className="flex gap-2">
                  <span className="text-muted-foreground/80 flex-shrink-0">
                    {k}:
                  </span>
                  <span className="text-muted-foreground font-mono break-all line-clamp-5 hover:line-clamp-none transition-all">
                    {String(v)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
        {item.result && (
          <div className="px-3 py-2">
            <p
              className="text-muted-foreground font-medium mb-1.5 uppercase tracking-wider"
            >
              Kết quả
            </p>
            <pre className="text-muted-foreground whitespace-pre-wrap font-mono leading-relaxed max-h-60 overflow-y-auto thin-scrollbar">
              {item.result}
            </pre>
          </div>
        )}
      </div>
    </ExpandableBubble>
  );
}

// ── ReasoningBubble ──────────────────────────────────────────────────────────
interface ReasoningBubbleProps {
  item: ReasoningItem;
  isThinking?: boolean;
}

export function ReasoningBubble({ item, isThinking }: ReasoningBubbleProps) {
  const label = (
    <span>{isThinking ? "Đang suy nghĩ" : "Dòng suy nghĩ"}</span>
  );

  return (
    <ExpandableBubble label={label} isThinking={isThinking}>
      <div className="px-3 py-2 text-muted-foreground leading-relaxed whitespace-pre-wrap font-mono max-h-60 overflow-y-auto thin-scrollbar">
        {item.content}
      </div>
    </ExpandableBubble>
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
      <div className="flex justify-end my-4">
        <div className="bg-primary text-primary-foreground px-4 py-2.5">
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="my-4 prose prose-sm max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
      >
        {message.content}
      </ReactMarkdown>
    </div>
  );
}

// ── StreamingBubble ──────────────────────────────────────────────────────────
interface StreamingBubbleProps {
  content: string;
  reasoning?: string;
}

export function StreamingBubble({
  content,
  reasoning,
}: StreamingBubbleProps) {
  const parsed = parseThinking(content);
  const thinkingText = reasoning || parsed.thinking;
  const thinkingOpen = reasoning
    ? reasoning.length > 0 && !content
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
    <>
      {hasThinking && (
        <ReasoningBubble item={fakeReasoningItem} isThinking={thinkingOpen} />
      )}
      {hasText ? (
        <div className="my-4 prose prose-sm max-w-none text-gray-800">
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[rehypeKatex]}
          >
            {parsed.text}
          </ReactMarkdown>
        </div>
      ) : !hasThinking ? (
        <div className="flex items-center gap-2 text-xs text-gray-400 py-1">
          <span className="inline-flex gap-0.5">
            <span
              className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce"
              style={{ animationDelay: "0ms" }}
            />
            <span
              className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce"
              style={{ animationDelay: "150ms" }}
            />
            <span
              className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce"
              style={{ animationDelay: "300ms" }}
            />
          </span>
        </div>
      ) : null}
    </>
  );
}
