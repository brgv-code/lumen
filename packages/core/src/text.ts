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

/** A loosened copy of a text, with the raw index of each character kept. */
interface Loosened { loose: string; map: number[] }

// Squeezing out every space makes short quotes ambiguous ("aton" in "a ton"), so it needs a longer quote.
const SQUEEZED_MIN = 10;

/** When the exact quote moved or changed whitespace, search with spaces collapsed, then with spaces and line end hyphens dropped. */
function fuzzyFallback(text: string, sel: TextQuote): [number, number] | null {
  return looseMatch(text, sel, collapseSpaces, 3) ?? looseMatch(text, sel, squeeze, SQUEEZED_MIN);
}

/** Every occurrence in the loosened text is scored by the loosened prefix and suffix, as in the exact search. */
function looseMatch(text: string, sel: TextQuote, loosen: (raw: string) => Loosened, minLength: number): [number, number] | null {
  const quote = loosen(sel.quote).loose.trim();
  if (quote.length < minLength) return null;
  const { loose, map } = loosen(text);
  const prefix = loosen(sel.prefix).loose;
  const suffix = loosen(sel.suffix).loose;
  let best: number | null = null;
  let bestScore = -Infinity;
  for (let at = loose.indexOf(quote); at !== -1; at = loose.indexOf(quote, at + 1)) {
    const score = commonSuffix(loose.slice(Math.max(0, at - prefix.length), at), prefix)
      + commonPrefix(loose.slice(at + quote.length, at + quote.length + suffix.length), suffix)
      - Math.abs(map[at] - sel.position) / 10_000;
    if (score > bestScore) { bestScore = score; best = at; }
  }
  return best === null ? null : [map[best], map[best + quote.length - 1] + 1];
}

function collapseSpaces(raw: string): Loosened {
  const map: number[] = [];
  let loose = "";
  let previousSpace = false;
  for (let index = 0; index < raw.length; index++) {
    const space = /\s/.test(raw[index]);
    if (space && previousSpace) continue;
    loose += space ? " " : raw[index];
    map.push(index);
    previousSpace = space;
  }
  return { loose, map };
}

/** PDF lines end in a break or a hyphen that the text view joins, and paragraphs there sit with no space between. */
function squeeze(raw: string): Loosened {
  const map: number[] = [];
  let loose = "";
  for (let index = 0; index < raw.length; index++) {
    if (/\s/.test(raw[index]) || (raw[index] === "-" && /\s/.test(raw[index + 1] ?? ""))) continue;
    loose += raw[index];
    map.push(index);
  }
  return { loose, map };
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
