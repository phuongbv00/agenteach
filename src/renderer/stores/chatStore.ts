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

export interface MessageItem {
  type: 'message';
  role: 'user' | 'assistant';
  thinking?: string;
  content: string;
}

export type ChatItem = MessageItem | ToolCallItem;

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

interface ChatState {
  items: ChatItem[];
  isStreaming: boolean;
  streamingContent: string;
  pendingItems: ChatItem[];

  // For LLM: only user/assistant text (no tool_calls, no thinking markup)
  toMessages(): ChatMessage[];
  // For persistence: full structured items
  toStoredItems(): StoredChatItem[];

  addUserMessage(content: string): void;
  appendToken(token: string): void;
  addToolCall(event: Omit<ToolCallItem, 'type' | 'id'>): void;
  finalizeAssistantMessage(): void;
  setStreaming(v: boolean): void;
  loadItems(items: StoredChatItem[]): void;
  clear(): void;
}

let _toolCallCounter = 0;

export const useChatStore = create<ChatState>((set, get) => ({
  items: [],
  isStreaming: false,
  streamingContent: '',
  pendingItems: [],

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
      return item.role === 'user'
        ? { type: 'user_message', content: item.content }
        : { type: 'assistant_message', thinking: item.thinking, content: item.content };
    });
  },

  addUserMessage: (content) =>
    set((s) => ({
      items: [...s.items, { type: 'message', role: 'user', content }],
      streamingContent: '',
      pendingItems: [],
    })),

  appendToken: (token) =>
    set((s) => ({ streamingContent: s.streamingContent + token })),

  addToolCall: (event) => {
    const toolItem: ToolCallItem = { type: 'tool_call', id: `tc-${++_toolCallCounter}`, ...event };
    set((s) => {
      const newPending: ChatItem[] = [...s.pendingItems];
      // Snapshot any streamed text so far to preserve ordering
      if (s.streamingContent.trim()) {
        const { thinking, text } = extractThinking(s.streamingContent);
        newPending.push({
          type: 'message',
          role: 'assistant',
          thinking: thinking || undefined,
          content: text || s.streamingContent,
        });
      }
      newPending.push(toolItem);
      return { pendingItems: newPending, streamingContent: '' };
    });
  },

  finalizeAssistantMessage: () => {
    const { streamingContent, items, pendingItems } = get();
    const newItems: ChatItem[] = [...items, ...pendingItems];
    if (streamingContent.trim()) {
      const { thinking, text } = extractThinking(streamingContent);
      newItems.push({
        type: 'message',
        role: 'assistant',
        thinking: thinking || undefined,
        content: text || streamingContent,
      });
    }
    set({ items: newItems, isStreaming: false, streamingContent: '', pendingItems: [] });
  },

  setStreaming: (v) => set({ isStreaming: v }),

  loadItems: (storedItems) => {
    const chatItems: ChatItem[] = storedItems.map((item): ChatItem => {
      if (item.type === 'tool_call') {
        return { type: 'tool_call', id: `tc-${++_toolCallCounter}`, ...item };
      }
      if (item.type === 'user_message') {
        return { type: 'message', role: 'user', content: item.content };
      }
      return { type: 'message', role: 'assistant', thinking: item.thinking, content: item.content };
    });
    set({ items: chatItems, streamingContent: '', pendingItems: [], isStreaming: false });
  },

  clear: () => set({ items: [], streamingContent: '', pendingItems: [], isStreaming: false }),
}));
