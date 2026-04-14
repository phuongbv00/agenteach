import { create } from "zustand";
import type {
  ModelMessage,
  TextPart,
  FilePart,
  ReasoningUIPart,
  ToolCallPart,
  ToolResultPart,
} from "ai";

export interface ToolCallItem {
  type: "tool_call";
  id: string;
  toolName: string;
  label: string;
  args: Record<string, unknown>;
  result: string;
}

export interface ReasoningItem {
  type: "reasoning";
  id: string;
  content: string;
}

export interface MessageItem {
  type: "message";
  role: "user" | "assistant";
  content: string;
}

export type ChatItem = MessageItem | ToolCallItem | ReasoningItem;

// Extract <think>...</think> from raw streaming content
function extractThinking(raw: string): { thinking: string; text: string } {
  const re = /<think(?:ing)?>([\s\S]*?)<\/think(?:ing)?>/gi;
  let thinking = "";
  const text = raw.replace(re, (_, inner) => {
    thinking += (thinking ? "\n\n" : "") + inner.trim();
    return "";
  });
  return { thinking: thinking.trim(), text: text.trim() };
}

export interface PendingToolCall {
  toolName: string;
  label: string;
  args: Record<string, unknown>;
}

interface ChatState {
  items: ChatItem[];
  isStreaming: boolean;
  streamingContent: string;
  reasoningContent: string;
  pendingItems: ChatItem[];
  pendingToolCall: PendingToolCall | null;
  savedMessageCount: number; // # of ModelMessages already persisted in DB

  // For LLM: full conversation history including tool calls and reasoning
  toModelMessages(): ModelMessage[];

  addUserMessage(content: string): void;
  appendToken(token: string): void;
  appendReasoning(text: string): void;
  addToolCallStart(event: PendingToolCall): void;
  addToolCall(event: Omit<ToolCallItem, "type" | "id">): void;
  finalizeAssistantMessage(): void;
  setStreaming(v: boolean): void;
  loadItems(messages: ModelMessage[]): void;
  markSaved(count: number): void;
  clear(): void;
}

let _toolCallCounter = 0;
let _reasoningCounter = 0;

function snapshotItems(
  streamingContent: string,
  reasoningContent: string,
): ChatItem[] {
  const result: ChatItem[] = [];
  const { thinking: tagThinking, text } = extractThinking(streamingContent);
  const reasoning = reasoningContent.trim() || tagThinking;
  if (reasoning) {
    result.push({
      type: "reasoning",
      id: `r-${++_reasoningCounter}`,
      content: reasoning,
    });
  }
  const content = text.trim() || (!reasoning ? streamingContent.trim() : "");
  if (content) {
    result.push({ type: "message", role: "assistant", content });
  }
  return result;
}

export const useChatStore = create<ChatState>((set, get) => ({
  items: [],
  isStreaming: false,
  streamingContent: "",
  reasoningContent: "",
  pendingItems: [],
  pendingToolCall: null,
  savedMessageCount: 0,

  // TODO: Replace ChatItem type with UIMessage type
  toModelMessages(): ModelMessage[] {
    const result: ModelMessage[] = [];
    const items = get().items;
    let i = 0;
    let tcCounter = 0;

    while (i < items.length) {
      const item = items[i];

      if (item.type === "message" && item.role === "user") {
        result.push({ role: "user", content: item.content });
        i++;
        continue;
      }

      // Collect a step: reasoning* + assistant? + tool_call?
      if (
        item.type === "reasoning" ||
        item.type === "message" ||
        item.type === "tool_call"
      ) {
        const parts: Array<TextPart | FilePart | ToolCallPart> = [];

        // Skip reasoning blocks — display-only, not sent to LLM
        while (i < items.length && items[i].type === "reasoning") {
          i++;
        }

        // Collect assistant text
        if (
          i < items.length &&
          items[i].type === "message" &&
          (items[i] as MessageItem).role === "assistant"
        ) {
          const msg = items[i] as MessageItem;
          if (msg.content) parts.push({ type: "text", text: msg.content });
          i++;
        }

        // Check for following tool call
        if (i < items.length && items[i].type === "tool_call") {
          const tc = items[i] as ToolCallItem;
          const tcId = `hist-${++tcCounter}`;
          parts.push({
            type: "tool-call",
            toolCallId: tcId,
            toolName: tc.toolName,
            input: tc.args,
          });
          result.push({ role: "assistant", content: parts });
          result.push({
            role: "tool",
            content: [
              {
                type: "tool-result",
                toolCallId: tcId,
                toolName: tc.toolName,
                output: { type: "text", value: tc.result },
              },
            ],
          });
          i++;
        } else if (parts.length > 0) {
          result.push({ role: "assistant", content: parts });
        }
        continue;
      }

      i++;
    }

    return result;
  },

  addUserMessage: (content) =>
    set((s) => ({
      items: [...s.items, { type: "message", role: "user", content }],
      streamingContent: "",
      reasoningContent: "",
      pendingItems: [],
    })),

  appendToken: (token) =>
    set((s) =>
      s.isStreaming ? { streamingContent: s.streamingContent + token } : s,
    ),

  appendReasoning: (text) =>
    set((s) =>
      s.isStreaming ? { reasoningContent: s.reasoningContent + text } : s,
    ),

  addToolCallStart: (event) => {
    set((s) => {
      if (!s.isStreaming) return s;
      const newPending: ChatItem[] = [
        ...s.pendingItems,
        ...snapshotItems(s.streamingContent, s.reasoningContent),
      ];
      return {
        pendingItems: newPending,
        streamingContent: "",
        reasoningContent: "",
        pendingToolCall: event,
      };
    });
  },

  addToolCall: (event) => {
    const toolItem: ToolCallItem = {
      type: "tool_call",
      id: `tc-${++_toolCallCounter}`,
      ...event,
    };
    set((s) => {
      if (!s.isStreaming) return s;
      const newPending: ChatItem[] = [
        ...s.pendingItems,
        ...snapshotItems(s.streamingContent, s.reasoningContent),
        toolItem,
      ];
      return {
        pendingItems: newPending,
        streamingContent: "",
        reasoningContent: "",
        pendingToolCall: null,
      };
    });
  },

  finalizeAssistantMessage: () => {
    const { streamingContent, reasoningContent, items, pendingItems } = get();
    const newItems: ChatItem[] = [
      ...items,
      ...pendingItems,
      ...snapshotItems(streamingContent, reasoningContent),
    ];
    set({
      items: newItems,
      isStreaming: false,
      streamingContent: "",
      reasoningContent: "",
      pendingItems: [],
      pendingToolCall: null,
    });
  },

  setStreaming: (v) => set({ isStreaming: v }),

  markSaved: (count) => set({ savedMessageCount: count }),

  // TODO: Replace ChatItem type with UIMessage type
  loadItems: (messages) => {
    const chatItems: ChatItem[] = [];
    let i = 0;

    while (i < messages.length) {
      const msg = messages[i];

      if (msg.role === "user") {
        chatItems.push({
          type: "message",
          role: "user",
          content: typeof msg.content === "string" ? msg.content : "",
        });
        i++;
        continue;
      }

      if (msg.role === "assistant") {
        const content = msg.content;

        // AssistantContent can be a plain string
        if (typeof content === "string") {
          if (content)
            chatItems.push({ type: "message", role: "assistant", content });
          i++;
          continue;
        }

        const toolCallParts: Array<ToolCallPart> = [];
        for (const part of content) {
          if (part.type === "reasoning") {
            chatItems.push({
              type: "reasoning",
              id: `r-${++_reasoningCounter}`,
              content: (part as ReasoningUIPart).text,
            });
          } else if (part.type === "text") {
            if (part.text)
              chatItems.push({
                type: "message",
                role: "assistant",
                content: part.text,
              });
          } else if (part.type === "tool-call") {
            toolCallParts.push(part as ToolCallPart);
          }
        }

        if (toolCallParts.length > 0) {
          const nextMsg = messages[i + 1];
          const toolResults = nextMsg?.role === "tool" ? nextMsg.content : [];
          for (const tcPart of toolCallParts) {
            const resultPart = toolResults.find(
              (r): r is ToolResultPart =>
                r.type === "tool-result" && r.toolCallId === tcPart.toolCallId,
            );
            chatItems.push({
              type: "tool_call",
              id: `tc-${++_toolCallCounter}`,
              toolName: tcPart.toolName,
              label:
                (tcPart.providerOptions?.["agenteach"]?.["label"] as
                  | string
                  | undefined) ?? tcPart.toolName,
              args: tcPart.input as Record<string, unknown>,
              result: resultPart ? String(resultPart.output) : "",
            });
          }
          i += nextMsg?.role === "tool" ? 2 : 1;
        } else {
          i++;
        }
        continue;
      }

      // tool messages are consumed above
      i++;
    }

    set({
      items: chatItems,
      streamingContent: "",
      reasoningContent: "",
      pendingItems: [],
      isStreaming: false,
      savedMessageCount: messages.length,
    });
  },

  clear: () =>
    set({
      items: [],
      streamingContent: "",
      reasoningContent: "",
      pendingItems: [],
      pendingToolCall: null,
      isStreaming: false,
      savedMessageCount: 0,
    }),
}));
