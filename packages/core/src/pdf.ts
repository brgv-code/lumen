// PDF text view: pdf.js text runs in, article HTML with one section per page out.
import { wordCount } from "./text.ts";

export const PDF_MAX_BYTES = 25 * 1024 * 1024;
export const PDF_MAX_PAGES = 500;

/** One pdf.js text item, reduced to what the layout needs. `y` is the baseline, growing upward. */
export interface PdfRun {
  text: string;
  y: number;
  height: number;
  endsLine: boolean;
}

export interface PdfArticle {
  html: string;
  text: string;
  wordCount: number;
  excerpt: string | null;
  pagesWithText: number;
}

/** Text state of a PDF item: pending until a browser has parsed the file once. */
export type PdfTextStatus = "pending" | "ready" | "no_text" | "failed";

export interface PdfInfo {
  text: PdfTextStatus;
  pages: number | null;
  hasFile: boolean;
  /** Trial over and no Pro: highlights stay, the text view and the file do not. */
  locked: boolean;
}

/** A pdf.js text content entry: text with its transform, or a marked content tag with no text. */
export type PdfTextItem = { str: string; transform: number[]; height: number; hasEOL: boolean } | { type: string };

interface Line { text: string; y: number; height: number }

// A gap this many line heights wide ends a paragraph; pdf.js line spacing is about 1.2.
const PARAGRAPH_GAP = 1.6;
// Titles, author lines and licence notes are shorter than this; an abstract is not.
const EXCERPT_MIN_WORDS = 40;

// A heading must be this much bigger than the page's usual text to count as the title.
const TITLE_MIN_RATIO = 1.2;
const TITLE_MAX_LINES = 3;
// Runs this close to the biggest size are full capitals; smaller ones on a title line are small caps.
const TITLE_SIZE_SLACK = 0.95;

type TextRun = Extract<PdfTextItem, { str: string }>;

/** The PDF's own Title when the producer filled it in, else the title as printed on page one. */
export function pdfTitle(info: unknown, firstPage: readonly PdfTextItem[] = []): string | null {
  return metadataTitle(info) ?? headingTitle(firstPage);
}

function metadataTitle(info: unknown): string | null {
  if (!info || typeof info !== "object" || !("Title" in info) || typeof info.Title !== "string") return null;
  const title = info.Title.trim();
  return title && !/\.(pdf|docx?|tex)$/i.test(title) ? title : null;
}

/** The topmost lines holding page one's biggest upright text, joined. LaTeX papers on arXiv leave Title empty. */
function headingTitle(items: readonly PdfTextItem[]): string | null {
  // arXiv stamps its id up the left margin, bigger than any title, so turned text is left out.
  const upright = items.filter((entry): entry is TextRun => "str" in entry && entry.transform[1] === 0 && entry.transform[2] === 0);
  const sized = upright.filter((entry) => entry.height > 0);
  if (!sized.length) return null;
  const biggest = Math.max(...sized.map((entry) => entry.height));
  // The usual size is the one most characters are set in; on a tie the smaller, since body text is the small one.
  const characters = new Map<number, number>();
  for (const entry of sized) characters.set(entry.height, (characters.get(entry.height) ?? 0) + entry.str.length);
  const [usual] = [...characters.entries()].sort(([leftSize, leftCount], [rightSize, rightCount]) => rightCount - leftCount || leftSize - rightSize)[0];
  if (biggest < usual * TITLE_MIN_RATIO) return null;

  const rows = new Map<number, TextRun[]>();
  for (const entry of upright) {
    const y = Math.round(entry.transform[5]);
    rows.set(y, [...(rows.get(y) ?? []), entry]);
  }
  const lines = [...rows.entries()].sort(([upper], [lower]) => lower - upper).map(([, runs]) => runs);
  const isTitleLine = (runs: TextRun[]) => runs.some((entry) => entry.height >= biggest * TITLE_SIZE_SLACK);
  const first = lines.findIndex(isTitleLine);
  const titleLines: TextRun[][] = [];
  for (const runs of lines.slice(first)) {
    if (!isTitleLine(runs) || titleLines.length === TITLE_MAX_LINES) break;
    titleLines.push(runs);
  }
  const lineText = (runs: TextRun[]) => [...runs]
    .sort((left, right) => left.transform[4] - right.transform[4])
    .map((entry) => (entry.height > 0 && entry.height < biggest * TITLE_SIZE_SLACK ? entry.str.toLowerCase() : entry.str))
    .join("");
  // Separate runs leave a space before punctuation ("ReAct :"); close it.
  const title = titleLines.map(lineText).join(" ").replace(/\s+/g, " ").replace(/ ([:,;.])/g, "$1").trim();
  return title.length >= 3 ? title : null;
}

export function isPdfBytes(bytes: Uint8Array): boolean {
  return bytes.length >= 5 && String.fromCharCode(...bytes.subarray(0, 5)) === "%PDF-";
}

/** One page of pdf.js text content as runs; the y of the baseline is the transform's last term. */
export function pdfRuns(items: readonly PdfTextItem[]): PdfRun[] {
  return items.flatMap((entry) => ("str" in entry ? [{ text: entry.str, y: entry.transform[5], height: entry.height || Math.abs(entry.transform[3]), endsLine: entry.hasEOL }] : []));
}

/** Browser side: each page's runs become that page's paragraphs, in reading order. */
export function pdfParagraphs(pages: PdfRun[][]): string[][] {
  return pages.map((runs) => paragraphsOf(linesOf(runs)));
}

/** Server side: paragraphs per page become the stored article. The server escapes, so it never stores markup it did not build. */
export function pdfArticle(pages: string[][]): PdfArticle {
  const sections: string[] = [];
  const texts: string[] = [];
  pages.forEach((paragraphs, index) => {
    const kept = paragraphs.map((paragraph) => paragraph.replace(/\s+/g, " ").trim()).filter(Boolean);
    if (!kept.length) return;
    sections.push(`<section data-page="${index + 1}">${kept.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")}</section>`);
    texts.push(...kept);
  });
  const text = texts.join("\n\n");
  return {
    html: sections.join(""),
    text,
    wordCount: wordCount(text),
    excerpt: texts.find((paragraph) => wordCount(paragraph) >= EXCERPT_MIN_WORDS)?.slice(0, 300) ?? null,
    pagesWithText: sections.length,
  };
}

function linesOf(runs: PdfRun[]): Line[] {
  const lines: Line[] = [];
  let current: Line | null = null;
  for (const run of runs) {
    current ??= { text: "", y: run.y, height: run.height };
    current.text += run.text;
    current.height = Math.max(current.height, run.height);
    if (run.endsLine) { lines.push(current); current = null; }
  }
  if (current) lines.push(current);
  return lines;
}

function paragraphsOf(lines: Line[]): string[] {
  const paragraphs: string[] = [];
  let open: string | null = null;
  let previous: Line | null = null;
  const close = () => { if (open !== null && !/^\d{1,4}$/.test(open)) paragraphs.push(open); open = null; };
  for (const line of lines) {
    const text = line.text.replace(/\s+/g, " ").trim();
    if (!text) { close(); previous = null; continue; }
    const gap = previous ? previous.y - line.y : 0;
    // A jump back up the page is the next column.
    if (previous && (gap > PARAGRAPH_GAP * Math.max(previous.height, line.height) || gap < -previous.height)) close();
    open = open === null ? text : joinLines(open, text);
    previous = line;
  }
  close();
  return paragraphs;
}

/** "transduc-" + "tion" is one word; "GPT-" + "4" and "self-" + "Attention" keep the hyphen. */
function joinLines(before: string, after: string): string {
  if (/\p{Ll}-$/u.test(before) && /^\p{Ll}/u.test(after)) return before.slice(0, -1) + after;
  if (before.endsWith("-")) return before + after;
  return `${before} ${after}`;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
