import type { HighlightFormat } from "./types.ts";

interface CiteInput {
  quote: string;
  note?: string | null;
  title: string;
  url: string;
}

/** A link that scrolls to and marks the passage in Chromium, Safari and Firefox. */
export function textFragmentUrl(url: string, quote: string): string {
  const clean = quote.replace(/\s+/g, " ").trim();
  if (!clean) return url;
  const base = url.split("#")[0];
  const enc = (s: string) => encodeURIComponent(s).replace(/-/g, "%2D");
  const words = clean.split(" ");
  let directive: string;
  if (words.length <= 10) {
    directive = enc(clean);
  } else {
    directive = `${enc(words.slice(0, 5).join(" "))},${enc(words.slice(-5).join(" "))}`;
  }
  return `${base}#:~:text=${directive}`;
}

/** What goes on the clipboard when you press "Copy with citation". */
export function citeForClipboard(h: CiteInput): string {
  const lines = h.quote.trim().split(/\n+/).map((l) => `> ${l}`);
  lines.push(">");
  lines.push(`> [${h.title || h.url}](${textFragmentUrl(h.url, h.quote)})`);
  if (h.note) lines.push("", h.note.trim());
  return lines.join("\n");
}

/** Plain text variant for pasting into an LLM chat or a doc that ignores markdown. */
export function citeAsPlainText(h: CiteInput): string {
  return `"${h.quote.trim()}"\nSource: ${h.title} (${h.url})${h.note ? `\nMy note: ${h.note.trim()}` : ""}`;
}

/**
 * One highlight rendered for a note.
 * - house:   ==passage==^[comment] ([source](link))  (works with Sidebar Highlights)
 * - callout: an Obsidian quote callout
 * - plain:   a markdown blockquote
 */
export function formatHighlight(h: CiteInput, format: HighlightFormat): string {
  const link = textFragmentUrl(h.url, h.quote);
  const quote = h.quote.replace(/\s+/g, " ").trim();
  switch (format) {
    case "house": {
      const note = h.note ? `^[${h.note.replace(/\]/g, ")").trim()}]` : "";
      return `==${quote.replace(/==/g, "= =")}==${note} ([${escapeMd(h.title)}](${link}))`;
    }
    case "callout":
      return [
        `> [!quote] [${escapeMd(h.title)}](${link})`,
        `> ${quote}`,
        ...(h.note ? [">", `> **Note:** ${h.note.trim()}`] : []),
      ].join("\n");
    case "plain":
    default:
      return [`> ${quote}`, `> [${escapeMd(h.title)}](${link})`, ...(h.note ? ["", h.note.trim()] : [])].join("\n");
  }
}

/** A heading block written once per source, followed by its highlights. */
export function formatSourceBlock(
  source: { title: string; url: string; siteName?: string | null },
  highlights: CiteInput[],
  format: HighlightFormat,
  when = new Date(),
): string {
  const day = when.toISOString().slice(0, 10);
  const head = `\n## ${escapeMd(source.title)}\n${source.siteName ? `${source.siteName} · ` : ""}[source](${source.url}) · clipped ${day}\n`;
  return head + "\n" + highlights.map((h) => formatHighlight(h, format)).join("\n\n") + "\n";
}

function escapeMd(s: string): string {
  return (s || "").replace(/([\[\]])/g, "\\$1");
}
