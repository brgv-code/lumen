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

interface Line { text: string; y: number; height: number }

// A gap this many line heights wide ends a paragraph; pdf.js line spacing is about 1.2.
const PARAGRAPH_GAP = 1.6;
// Titles, author lines and licence notes are shorter than this; an abstract is not.
const EXCERPT_MIN_WORDS = 40;

export function isPdfBytes(bytes: Uint8Array): boolean {
  return bytes.length >= 5 && String.fromCharCode(...bytes.subarray(0, 5)) === "%PDF-";
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
