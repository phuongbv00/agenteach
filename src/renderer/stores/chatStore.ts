import { create } from 'zustand';
import type { ChatMessage, StoredChatItem } from '../types/api';

export interface ToolCallItem {
  type: 'tool_call';
  id: string;
  toolName: string;
  label: string;
  args: Record<string, unknown>;
  result: string;
}

export interface ReasoningItem {
  type: 'reasoning';
  id: string;
  content: string;
}

export interface MessageItem {
  type: 'message';
  role: 'user' | 'assistant';
  content: string;
}

export type ChatItem = MessageItem | ToolCallItem | ReasoningItem;

// Extract <think>...</think> from raw streaming content
function extractThinking(raw: string): { thinking: string; text: string } {
  const re = /<think(?:ing)?>([\s\S]*?)<\/think(?:ing)?>/gi;
  let thinking = '';
  const text = raw.replace(re, (_, inner) => {
    thinking += (thinking ? '\n\n' : '') + inner.trim();
    return '';
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
  isWaitingForText: boolean;

  // For LLM: only user/assistant text (no tool_calls, no thinking markup)
  toMessages(): ChatMessage[];
  // For persistence: full structured items
  toStoredItems(): StoredChatItem[];

  addUserMessage(content: string): void;
  appendToken(token: string): void;
  appendReasoning(text: string): void;
  setWaitingForText(): void;
  addToolCallStart(event: PendingToolCall): void;
  addToolCall(event: Omit<ToolCallItem, 'type' | 'id'>): void;
  finalizeAssistantMessage(): void;
  setStreaming(v: boolean): void;
  loadItems(items: StoredChatItem[]): void;
  clear(): void;
}

let _toolCallCounter = 0;
let _reasoningCounter = 0;

function snapshotItems(streamingContent: string, reasoningContent: string): ChatItem[] {
  const result: ChatItem[] = [];
  const { thinking: tagThinking, text } = extractThinking(streamingContent);
  const reasoning = reasoningContent.trim() || tagThinking;
  if (reasoning) {
    result.push({ type: 'reasoning', id: `r-${++_reasoningCounter}`, content: reasoning });
  }
  const content = text.trim() || (!reasoning ? streamingContent.trim() : '');
  if (content) {
    result.push({ type: 'message', role: 'assistant', content });
  }
  return result;
}

export const useChatStore = create<ChatState>((set, get) => ({
  items: [],
  isStreaming: false,
  streamingContent: '',
  reasoningContent: '',
  pendingItems: [],
  pendingToolCall: null,
  isWaitingForText: false,

  toMessages(): ChatMessage[] {
    return get().items
      .filter((i): i is MessageItem => i.type === 'message')
      .map(({ role, content }) => ({ role, content }));
  },

  toStoredItems(): StoredChatItem[] {
    return get().items.map((item): StoredChatItem => {
      if (item.type === 'tool_call') {
        return { type: 'tool_call', toolName: item.toolName, label: item.label, args: item.args, result: item.result };
      }
      if (item.type === 'reasoning') {
        return { type: 'reasoning_block', content: item.content };
      }
      return item.role === 'user'
        ? { type: 'user_message', content: item.content }
        : { type: 'assistant_message', content: item.content };
    });
  },

  addUserMessage: (content) =>
    set((s) => ({
      items: [...s.items, { type: 'message', role: 'user', content }],
      streamingContent: '',
      reasoningContent: '',
      pendingItems: [],
      isWaitingForText: false,
    })),

  appendToken: (token) =>
    set((s) => ({ streamingContent: s.streamingContent + token, isWaitingForText: false })),

  appendReasoning: (text) =>
    set((s) => ({ reasoningContent: s.reasoningContent + text })),

  setWaitingForText: () => set({ isWaitingForText: true }),

  addToolCallStart: (event) => {
    set((s) => {
      const newPending: ChatItem[] = [...s.pendingItems, ...snapshotItems(s.streamingContent, s.reasoningContent)];
      return { pendingItems: newPending, streamingContent: '', reasoningContent: '', pendingToolCall: event, isWaitingForText: false };
    });
  },

  addToolCall: (event) => {
    const toolItem: ToolCallItem = { type: 'tool_call', id: `tc-${++_toolCallCounter}`, ...event };
    set((s) => {
      const newPending: ChatItem[] = [...s.pendingItems, ...snapshotItems(s.streamingContent, s.reasoningContent), toolItem];
      return { pendingItems: newPending, streamingContent: '', reasoningContent: '', pendingToolCall: null };
    });
  },

  finalizeAssistantMessage: () => {
    const { streamingContent, reasoningContent, items, pendingItems } = get();
    const newItems: ChatItem[] = [...items, ...pendingItems, ...snapshotItems(streamingContent, reasoningContent)];
    set({ items: newItems, isStreaming: false, streamingContent: '', reasoningContent: '', pendingItems: [], pendingToolCall: null, isWaitingForText: false });
  },

  setStreaming: (v) => set({ isStreaming: v }),

  loadItems: (storedItems) => {
    const chatItems: ChatItem[] = storedItems.map((item): ChatItem => {
      if (item.type === 'tool_call') {
        return { type: 'tool_call', id: `tc-${++_toolCallCounter}`, ...item };
      }
      if (item.type === 'reasoning_block') {
        return { type: 'reasoning', id: `r-${++_reasoningCounter}`, content: item.content };
      }
      if (item.type === 'user_message') {
        return { type: 'message', role: 'user', content: item.content };
      }
      return { type: 'message', role: 'assistant', content: item.content };
    });
    set({ items: chatItems, streamingContent: '', reasoningContent: '', pendingItems: [], isStreaming: false });
  },

  clear: () => set({ items: [], streamingContent: '', reasoningContent: '', pendingItems: [], pendingToolCall: null, isStreaming: false, isWaitingForText: false }),
}));
