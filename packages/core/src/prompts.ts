import type { AIAction } from "./types.ts";

export const READER_SYSTEM = `You are Lumen, a calm reading companion in the margin of an article.
Answer in plain language, in at most 120 words, without preamble. Use short paragraphs or a short list.
Never invent facts about the article beyond the passage and context you are given.`;

/** The user message for a margin question. Shared by the API and the extension. */
export function readerPrompt(action: AIAction, text: string, opts: { question?: string; title?: string; context?: string } = {}): string {
  const where = opts.title ? `\nThe passage is from "${opts.title}".` : "";
  const ctx = opts.context ? `\nSurrounding text: """${opts.context.slice(0, 1500)}"""` : "";
  const passage = `Passage: """${text.slice(0, 6000)}"""${where}${ctx}`;
  const task = {
    explain: "Explain what this passage means and why it matters, as if to a curious friend.",
    summarize: "Summarize this in two or three sentences.",
    define: "Define the key term or concept in this passage, then give one short example.",
    simplify: "Rewrite this passage so a 12 year old understands it, keeping the meaning.",
    ask: `Answer this question about the passage: ${opts.question?.slice(0, 500) || "What is this about?"}`,
  }[action];
  return `${passage}\n\n${task}`;
}
