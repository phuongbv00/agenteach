export interface ToolMeta {
  /** Short human-readable label shown in the UI tool-call widget. */
  label: (args: Record<string, unknown>) => string;
  /** Optional: condense the raw result string for UI display. */
  summarize?: (result: string) => string;
}

export type ToolsMetaMap = Record<string, ToolMeta>;

/** Default summarize: truncate long results to 200 chars. */
export function defaultSummarize(result: string): string {
  if (!result || result === '""') return "";
  if (result.length > 200) return result.slice(0, 200) + "...";
  return result;
}
