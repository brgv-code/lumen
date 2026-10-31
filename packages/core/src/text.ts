import type { TextQuote } from "./types.ts";

export const CONTEXT_CHARS = 32;

/** Collapse whitespace so quotes survive reflowed markup. */
export function normalize(s: string): string {
  return s.replace(/\s+/g, " ");
}

/**
 * Find a quote inside text, using prefix, suffix and the position hint to pick
 * the right occurrence. Returns [start, end) in `text`, or null.
 */
export function matchQuote(text: string, sel: TextQuote): [number, number] | null {
  const quote = sel.quote;
  if (!quote) return null;
  const hits: number[] = [];
  let from = 0;
  while (true) {
    const i = text.indexOf(quote, from);
    if (i === -1) break;
    hits.push(i);
    from = i + 1;
    if (hits.length > 500) break;
  }
  if (hits.length === 0) return fuzzyFallback(text, sel);
  if (hits.length === 1) return [hits[0], hits[0] + quote.length];

  let best = hits[0];
  let bestScore = -Infinity;
  for (const i of hits) {
    const before = text.slice(Math.max(0, i - sel.prefix.length), i);
    const after = text.slice(i + quote.length, i + quote.length + sel.suffix.length);
    const score =
      commonSuffix(before, sel.prefix) +
      commonPrefix(after, sel.suffix) -
      Math.abs(i - sel.position) / 10_000;
    if (score > bestScore) { bestScore = score; best = i; }
  }
  return [best, best + quote.length];
}

/** When the exact quote moved or changed whitespace, try a normalised search. */
function fuzzyFallback(text: string, sel: TextQuote): [number, number] | null {
  const q = normalize(sel.quote).trim();
  if (q.length < 3) return null;
  // map normalised index back to raw index
  const map: number[] = [];
  let norm = "";
  let prevSpace = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const space = /\s/.test(ch);
    if (space && prevSpace) continue;
    norm += space ? " " : ch;
    map.push(i);
    prevSpace = space;
  }
  const j = norm.indexOf(q);
  if (j === -1) return null;
  return [map[j], map[j + q.length - 1] + 1];
}

function commonSuffix(a: string, b: string): number {
  let n = 0;
  while (n < a.length && n < b.length && a[a.length - 1 - n] === b[b.length - 1 - n]) n++;
  return n;
}
function commonPrefix(a: string, b: string): number {
  let n = 0;
  while (n < a.length && n < b.length && a[n] === b[n]) n++;
  return n;
}

/** Build a selector from a full text and a [start, end) range in it. */
export function quoteFromText(text: string, start: number, end: number): TextQuote {
  return {
    quote: text.slice(start, end),
    prefix: text.slice(Math.max(0, start - CONTEXT_CHARS), start),
    suffix: text.slice(end, end + CONTEXT_CHARS),
    position: start,
  };
}

export function wordCount(text: string): number {
  const m = text.trim().match(/\S+/g);
  return m ? m.length : 0;
}

export function readingMinutes(words: number): number {
  return Math.max(1, Math.round(words / 230));
}
