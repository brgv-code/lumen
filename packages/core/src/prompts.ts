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
    expand: "Expand on this passage: the background it assumes, why it is true or contested, and one concrete example. Keep it under 150 words.",
    ask: `Answer this question about the passage: ${opts.question?.slice(0, 500) || "What is this about?"}`,
  }[action];
  return `${passage}\n\n${task}`;
}

export const LIBRARY_SYSTEM = `You are Lumen, the reader's own research assistant. You answer from two places:
the page they are reading (if given) and their Lumen library: articles they saved, passages they highlighted and notes they wrote.
Prefer their own highlights and notes when they are relevant, and cite them inline as [1], [2] using the numbers given.
If the library does not cover the question, say so briefly and answer from general knowledge, marked as such.
Never invent authors, people, quotes or titles: only name what appears in the page text or the numbered sources.
Plain language, at most 180 words, short paragraphs or a short list, no preamble.`;
