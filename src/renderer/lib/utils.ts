import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Normalize LaTeX delimiters to the $...$ / $$...$$ style that remark-math
 * understands.  LLMs often emit \(...\) and \[...\] which remark-math ignores.
 */
export function normalizeMathDelimiters(content: string): string {
  return content
    .replace(/\\\[([\s\S]+?)\\\]/g, (_, m) => `$$${m}$$`)
    .replace(/\\\((.+?)\\\)/g, (_, m) => `$${m}$`);
}
