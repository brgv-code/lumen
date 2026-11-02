import type { AIAction, HighlightFormat } from "./types.ts";
import { answerLabel } from "./answers.ts";

interface CiteInput {
  quote: string;
  note?: string | null;
  title: string;
  url: string;
  answers?: KeptInput[];
  /** Obsidian block id written after the passage, so later versions can insert answers in place. */
  blockId?: string;
}

interface KeptInput { action: AIAction; question: string | null; answer: string }

/** A stable Obsidian block id for a highlight: letters, digits and dashes only. */
export function blockIdFor(highlightId: string): string {
  return `lumen-${highlightId.replace(/^hl_/, "").replace(/[^a-z0-9]/gi, "").slice(0, 10)}`;
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
  return [formatPassage(h, format), ...(h.answers ?? []).map((kept) => formatAnswer(kept, format))].join("\n\n");
}

/** One kept answer: a collapsed callout in Obsidian formats, a bold paragraph in plain. */
function formatAnswer(kept: KeptInput, format: HighlightFormat): string {
  const heading = kept.question ? `${answerLabel(kept.action)}: ${kept.question.trim()}` : answerLabel(kept.action);
  const body = kept.answer.trim();
  if (format === "plain") return `**${heading}:** ${body}`;
  return [`> [!${kept.action}]- ${heading}`, ...body.split("\n").map((line) => (line ? `> ${line}` : ">"))].join("\n");
}

/** "↳ Explain on "first six words…"": names the passage a late answer belongs to. */
export function lateAnswerHeading(quote: string, action: AIAction): string {
  const words = quote.replace(/\s+/g, " ").trim().split(" ");
  return `↳ ${answerLabel(action)} on "${words.slice(0, 6).join(" ")}${words.length > 6 ? "…" : ""}"`;
}

/** An answer kept after its highlight reached the note: its own block, pointing back at the passage. */
export function formatLateAnswer(h: Pick<CiteInput, "quote" | "url">, kept: KeptInput, format: HighlightFormat): string {
  const pointer = `${lateAnswerHeading(h.quote, kept.action)} ([source](${textFragmentUrl(h.url, h.quote)}))`;
  return `${pointer}${format === "plain" ? "\n\n" : "\n"}${formatAnswer(kept, format)}`;
}

function formatPassage(h: CiteInput, format: HighlightFormat): string {
  const link = textFragmentUrl(h.url, h.quote);
  const quote = h.quote.replace(/\s+/g, " ").trim();
  switch (format) {
    case "house": {
      const note = h.note ? `^[${h.note.replace(/\]/g, ")").trim()}]` : "";
      return `==${quote.replace(/==/g, "= =")}==${note} ([${escapeMd(h.title)}](${link}))${h.blockId ? ` ^${h.blockId}` : ""}`;
    }
    case "callout":
      return [
        `> [!quote] [${escapeMd(h.title)}](${link})`,
        `> ${quote}`,
        ...(h.note ? [">", `> **Note:** ${h.note.trim()}`] : []),
        ...(h.blockId ? ["", `^${h.blockId}`] : []),
      ].join("\n");
    case "plain":
    default:
      return [`> ${quote}`, `> [${escapeMd(h.title)}](${link})`, ...(h.blockId ? ["", `^${h.blockId}`] : []), ...(h.note ? ["", h.note.trim()] : [])].join("\n");
  }
}

/** A heading block written once per source, followed by its new highlights, then answers kept late. */
export function formatSourceBlock(
  source: { title: string; url: string; siteName?: string | null },
  highlights: CiteInput[],
  format: HighlightFormat,
  when = new Date(),
  late: { highlight: Pick<CiteInput, "quote" | "url">; answer: KeptInput }[] = [],
): string {
  const day = when.toISOString().slice(0, 10);
  const head = `\n## ${escapeMd(source.title)}\n${source.siteName ? `${source.siteName} · ` : ""}[source](${source.url}) · clipped ${day}\n`;
  const blocks = [...highlights.map((h) => formatHighlight(h, format)), ...late.map((entry) => formatLateAnswer(entry.highlight, entry.answer, format))];
  return head + "\n" + blocks.join("\n\n") + "\n";
}

function escapeMd(s: string): string {
  return (s || "").replace(/([\[\]])/g, "\\$1");
}
