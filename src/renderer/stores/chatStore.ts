import { create } from "zustand"
import type {
  ModelMessage,
  TextPart,
  FilePart,
  ReasoningUIPart,
  ToolCallPart,
  ToolResultPart,
} from "ai"

// ── UIBlock types ─────────────────────────────────────────────────────────────

export type MessageContentPart =
  | { type: "text"; text: string }
  | { type: "image"; url: string; mimeType?: string }
  | { type: "file"; name: string; mimeType: string }

export interface MessageUIBlock {
  type: "message"
  role: "user" | "assistant"
  parts: MessageContentPart[]
}

export type ToolOutput =
  | { type: "text"; value: string }
  | { type: "error"; value: string }

export interface ToolUseUIBlock {
  type: "tool-use"
  id: string
  toolName: string
  label: string
  input: Record<string, unknown>
  output?: ToolOutput
}

export interface ReasoningUIBlock {
  type: "reasoning"
  id: string
  content: string
}

export type ChatUIBlock = MessageUIBlock | ToolUseUIBlock | ReasoningUIBlock

// ── Helpers ───────────────────────────────────────────────────────────────────

// Extract <think>...</think> from raw streaming content
function extractThinking(raw: string): { thinking: string; text: string } {
  const re = /<think(?:ing)?>([\s\S]*?)<\/think(?:ing)?>/gi
  let thinking = ""
  const text = raw.replace(re, (_, inner) => {
    thinking += (thinking ? "\n\n" : "") + inner.trim()
    return ""
  })
  return { thinking: thinking.trim(), text: text.trim() }
}

// ── State ─────────────────────────────────────────────────────────────────────

interface ChatState {
  items: ChatUIBlock[]
  isStreaming: boolean
  streamingContent: string
  reasoningContent: string
  pendingItems: ChatUIBlock[]
  pendingToolCall: ToolUseUIBlock | null
  savedMessageCount: number // # of ModelMessages already persisted in DB

  // For LLM: full conversation history including tool calls and reasoning
  toModelMessages(): ModelMessage[]

  addUserMessage(content: string): void
  appendToken(token: string): void
  appendReasoning(text: string): void
  addToolCallStart(event: {
    toolName: string
    label: string
    input: Record<string, unknown>
  }): void
  addToolCall(event: {
    toolName: string
    label: string
    input: Record<string, unknown>
    output: ToolOutput
  }): void
  finalizeAssistantMessage(): void
  setStreaming(v: boolean): void
  loadItems(messages: ModelMessage[]): void
  markSaved(count: number): void
  clear(): void
}

let _toolCallCounter = 0
let _reasoningCounter = 0

function snapshotItems(
  streamingContent: string,
  reasoningContent: string,
): ChatUIBlock[] {
  const result: ChatUIBlock[] = []
  const { thinking: tagThinking, text } = extractThinking(streamingContent)
  const reasoning = reasoningContent.trim() || tagThinking
  if (reasoning) {
    result.push({
      type: "reasoning",
      id: `r-${++_reasoningCounter}`,
      content: reasoning,
    })
  }
  const content = text.trim() || (!reasoning ? streamingContent.trim() : "")
  if (content) {
    result.push({
      type: "message",
      role: "assistant",
      parts: [{ type: "text", text: content }],
    })
  }
  return result
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useChatStore = create<ChatState>((set, get) => ({
  items: [],
  isStreaming: false,
  streamingContent: "",
  reasoningContent: "",
  pendingItems: [],
  pendingToolCall: null,
  savedMessageCount: 0,

  toModelMessages(): ModelMessage[] {
    const result: ModelMessage[] = []
    const items = get().items
    let i = 0
    let tcCounter = 0

    while (i < items.length) {
      const item = items[i]

      if (item.type === "message" && item.role === "user") {
        const text = item.parts.find((p) => p.type === "text")
        result.push({ role: "user", content: text?.text ?? "" })
        i++
        continue
      }

      // Collect a step: reasoning* + assistant? + tool-use?
      if (
        item.type === "reasoning" ||
        item.type === "message" ||
        item.type === "tool-use"
      ) {
        const parts: Array<TextPart | FilePart | ToolCallPart> = []

        // Skip reasoning blocks — display-only, not sent to LLM
        while (i < items.length && items[i].type === "reasoning") {
          i++
        }

        // Collect assistant text
        if (
          i < items.length &&
          items[i].type === "message" &&
          (items[i] as MessageUIBlock).role === "assistant"
        ) {
          const msg = items[i] as MessageUIBlock
          const text = msg.parts.find((p) => p.type === "text")
          if (text?.text) parts.push({ type: "text", text: text.text })
          i++
        }

        // Check for following tool-use block
        if (i < items.length && items[i].type === "tool-use") {
          const tc = items[i] as ToolUseUIBlock
          const tcId = `hist-${++tcCounter}`
          parts.push({
            type: "tool-call",
            toolCallId: tcId,
            toolName: tc.toolName,
            input: tc.input,
          })
          result.push({ role: "assistant", content: parts })
          result.push({
            role: "tool",
            content: [
              {
                type: "tool-result",
                toolCallId: tcId,
                toolName: tc.toolName,
                output: {
                  type: "text",
                  value: tc.output?.value ?? "",
                },
              },
            ],
          })
          i++
        } else if (parts.length > 0) {
          result.push({ role: "assistant", content: parts })
        }
        continue
      }

      i++
    }

    return result
  },

  addUserMessage: (content) =>
    set((s) => ({
      items: [
        ...s.items,
        {
          type: "message",
          role: "user",
          parts: [{ type: "text", text: content }],
        },
      ],
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

  addToolCallStart: ({ toolName, label, input }) => {
    set((s) => {
      if (!s.isStreaming) return s
      const block: ToolUseUIBlock = {
        type: "tool-use",
        id: `tc-${++_toolCallCounter}`,
        toolName,
        label,
        input,
      }
      const newPending: ChatUIBlock[] = [
        ...s.pendingItems,
        ...snapshotItems(s.streamingContent, s.reasoningContent),
      ]
      return {
        pendingItems: newPending,
        streamingContent: "",
        reasoningContent: "",
        pendingToolCall: block,
      }
    })
  },

  addToolCall: ({ toolName, label, input, output }) => {
    set((s) => {
      if (!s.isStreaming) return s
      const existing = s.pendingToolCall
      const toolBlock: ToolUseUIBlock = existing
        ? { ...existing, label, input, output }
        : {
            type: "tool-use",
            id: `tc-${++_toolCallCounter}`,
            toolName,
            label,
            input,
            output,
          }
      const newPending: ChatUIBlock[] = [
        ...s.pendingItems,
        ...snapshotItems(s.streamingContent, s.reasoningContent),
        toolBlock,
      ]
      return {
        pendingItems: newPending,
        streamingContent: "",
        reasoningContent: "",
        pendingToolCall: null,
      }
    })
  },

  finalizeAssistantMessage: () => {
    const { streamingContent, reasoningContent, items, pendingItems } = get()
    const newItems: ChatUIBlock[] = [
      ...items,
      ...pendingItems,
      ...snapshotItems(streamingContent, reasoningContent),
    ]
    set({
      items: newItems,
      isStreaming: false,
      streamingContent: "",
      reasoningContent: "",
      pendingItems: [],
      pendingToolCall: null,
    })
  },

  setStreaming: (v) => set({ isStreaming: v }),

  markSaved: (count) => set({ savedMessageCount: count }),

  loadItems: (messages) => {
    const chatItems: ChatUIBlock[] = []
    let i = 0

    while (i < messages.length) {
      const msg = messages[i]

      if (msg.role === "user") {
        chatItems.push({
          type: "message",
          role: "user",
          parts: [
            {
              type: "text",
              text: typeof msg.content === "string" ? msg.content : "",
            },
          ],
        })
        i++
        continue
      }

      if (msg.role === "assistant") {
        const content = msg.content

        // AssistantContent can be a plain string
        if (typeof content === "string") {
          if (content)
            chatItems.push({
              type: "message",
              role: "assistant",
              parts: [{ type: "text", text: content }],
            })
          i++
          continue
        }

        const toolCallParts: Array<ToolCallPart> = []
        for (const part of content) {
          if (part.type === "reasoning") {
            chatItems.push({
              type: "reasoning",
              id: `r-${++_reasoningCounter}`,
              content: (part as ReasoningUIPart).text,
            })
          } else if (part.type === "text") {
            if (part.text)
              chatItems.push({
                type: "message",
                role: "assistant",
                parts: [{ type: "text", text: part.text }],
              })
          } else if (part.type === "tool-call") {
            toolCallParts.push(part as ToolCallPart)
          }
        }

        if (toolCallParts.length > 0) {
          const nextMsg = messages[i + 1]
          const toolResults = nextMsg?.role === "tool" ? nextMsg.content : []
          for (const tcPart of toolCallParts) {
            const resultPart = toolResults.find(
              (r): r is ToolResultPart =>
                r.type === "tool-result" && r.toolCallId === tcPart.toolCallId,
            )
            chatItems.push({
              type: "tool-use",
              id: `tc-${++_toolCallCounter}`,
              toolName: tcPart.toolName,
              label:
                (tcPart.providerOptions?.["agenteach"]?.["label"] as
                  | string
                  | undefined) ?? tcPart.toolName,
              input: tcPart.input as Record<string, unknown>,
              output: resultPart
                ? { type: "text", value: String(resultPart.output) }
                : undefined,
            })
          }
          i += nextMsg?.role === "tool" ? 2 : 1
        } else {
          i++
        }
        continue
      }

      // tool messages are consumed above
      i++
    }

    set({
      items: chatItems,
      streamingContent: "",
      reasoningContent: "",
      pendingItems: [],
      isStreaming: false,
      savedMessageCount: messages.length,
    })
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
}))
