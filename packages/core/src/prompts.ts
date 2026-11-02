import type { AIAction } from "./types.ts";

export const READER_SYSTEM = `You are Lumen, a calm reading companion in the margin of an article.
Answer in plain language, in at most 120 words, without preamble. Use short paragraphs or a short list.
Read the passage in the context of its surrounding text and the article title; technical terms usually have their technical meaning.
Never invent facts about the article beyond the passage and context you are given. No analogies unless asked.`;

/** The user message for a margin question. Shared by the API and the extension. */
export function readerPrompt(action: AIAction, text: string, opts: { question?: string; title?: string; context?: string } = {}): string {
  const where = opts.title ? `\nThe passage is from "${opts.title}".` : "";
  const ctx = opts.context ? `\nSurrounding text: """${opts.context.slice(0, 1500)}"""` : "";
  const passage = `Passage: """${text.slice(0, 6000)}"""${where}${ctx}`;
  const task = {
    explain: "Explain what this passage means here, using the surrounding text and the article title for context. Be concrete and specific to this article; do not generalise beyond it.",
    summarize: "Summarize this in two or three sentences.",
    define: "Define the term or concept as it is used in this article (use the surrounding text), then give one short example.",
    simplify: "Rewrite this passage so a 12 year old understands it, keeping the meaning.",
    counterpoint: "Give the strongest counterpoint to this passage: the argument or evidence a careful critic would raise, in the article's own terms. End with one sentence on what would settle it. Keep it under 120 words.",
    expand: "Expand on this passage: the background it assumes, why it is true or contested, and one concrete example. Keep it under 150 words.",
    ask: `Answer this question about the passage: ${opts.question?.slice(0, 500) || "What is this about?"}`,
  }[action];
  return `${passage}\n\n${task}`;
}

export const TLDR_SYSTEM = `You write the TL;DR of an article for a busy reader.
Give 3 to 5 bullet points, one plain sentence each, most important first. No preamble and no heading.
End every point with the paragraph it comes from, written like [p3]. Only cite paragraph numbers that appear in the text.`;

/** Hosted TL;DR reads this much in one call; longer articles are chunked, then combined. */
export const TLDR_CHARS = 40_000;
/** Local models get one call on the start of the article. */
export const LOCAL_TLDR_CHARS = 24_000;

/** Paragraphs numbered for citation; numbering starts at `first` so chunks keep the article's numbers. */
export function tldrPrompt(title: string, paragraphs: readonly string[], first = 1): string {
  const body = paragraphs.map((text, index) => `[p${first + index}] ${text}`).join("\n\n");
  return `Article: "${title}"\n\n${body}\n\nWrite the TL;DR.`;
}

export function tldrCombinePrompt(title: string, partials: readonly string[]): string {
  return `Article: "${title}"\n\nThese are TL;DRs of consecutive parts of the article, with paragraph citations:\n\n${partials.join("\n\n")}\n\nMerge them into one TL;DR of 3 to 5 points for the whole article. Keep the [pN] citations exactly as written.`;
}

/** Consecutive runs of paragraphs under `limit` characters each, with the number of their first paragraph. */
export function chunkParagraphs(paragraphs: readonly string[], limit = TLDR_CHARS): { first: number; paragraphs: string[] }[] {
  const chunks: { first: number; paragraphs: string[] }[] = [];
  let current: string[] = [];
  let size = 0;
  paragraphs.forEach((text, index) => {
    if (current.length && size + text.length > limit) {
      chunks.push({ first: index + 1 - current.length, paragraphs: current });
      current = [];
      size = 0;
    }
    current.push(text.slice(0, limit));
    size += Math.min(text.length, limit);
  });
  if (current.length) chunks.push({ first: paragraphs.length + 1 - current.length, paragraphs: current });
  return chunks;
}

/** The leading paragraphs that fit in `limit` characters. */
export function paragraphsWithin(paragraphs: readonly string[], limit: number): string[] {
  const kept: string[] = [];
  let size = 0;
  for (const text of paragraphs) {
    if (size + text.length > limit) break;
    kept.push(text);
    size += text.length;
  }
  return kept.length ? kept : paragraphs.slice(0, 1).map((text) => text.slice(0, limit));
}

export const LIBRARY_SYSTEM = `You are Lumen, the reader's research assistant inside their browser.
You get up to three kinds of context: PAGE (the article open right now), SELECTION (text they highlighted) and LIBRARY (numbered items from their own saved articles, highlights and notes).
Rules:
- When a PAGE is given, questions are about that page unless they clearly are not. Answer from the page first, specifically and concretely, using its own terms and names.
- Use LIBRARY items only when they genuinely relate; cite them inline as [1], [2]. Never cite a number that was not given. Ignore unrelated library items silently.
- If neither the page nor the library covers it, say so in one short sentence, then answer from general knowledge.
- Never invent authors, people, quotes, products or titles that are not in the context.
- Never say "without specific context" when a PAGE is given.
- Format: a direct first sentence, then short paragraphs or a short "- " list. Use **bold** sparingly. At most 200 words.`;
