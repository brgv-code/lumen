// DOM side of PDF pages: pdf.js text layers as quotes and back, shared by the extension viewer and the web reader.
import type { TextQuote } from "./types.ts";
import type { PdfRun } from "./pdf.ts";
import { pdfParagraphs } from "./pdf.ts";
import { matchQuote } from "./text.ts";
import { anchorToRange, describeRange } from "./dom.ts";

/** A text layer whose line ends are marked, so its text matches the runs. */
export const READY_LAYER = ".textLayer[data-lumen-lines]";

/**
 * pdf.js ends a line with an empty <br>, so words on either side of a line break run together.
 * A space after the line's last span keeps them apart; a newline after a hyphen lets quotes join the word.
 */
export function markLineEnds(layer: HTMLElement) {
  for (const br of layer.querySelectorAll("br")) {
    const span = lastTextSpan(br.previousElementSibling);
    const text = span?.textContent ?? "";
    if (!span || !text || /\s$/.test(text)) continue;
    // Its own element: inside the span it would widen a box pdf.js scaled to the glyphs, and a mark over it would run past the line.
    const lineEnd = layer.ownerDocument.createElement("span");
    lineEnd.className = "lumen-eol";
    lineEnd.textContent = text.endsWith("-") ? "\n" : " ";
    span.after(lineEnd);
  }
  layer.dataset.lumenLines = "";
}

function lastTextSpan(element: Element | null): Element | null {
  if (!element || element.tagName !== "SPAN") return null;
  if (!element.classList.contains("markedContent")) return element;
  const spans = element.querySelectorAll("span:not(.markedContent)");
  return spans[spans.length - 1] ?? null;
}

/** The text a page's layer holds once its line ends are marked, built from the same runs. */
function layerText(runs: PdfRun[]): string {
  let text = "";
  for (const run of runs) {
    text += run.text;
    if (run.endsLine && text && !/\s$/.test(text)) text += text.endsWith("-") ? "\n" : " ";
  }
  return text;
}

/** Quotes read like the text view: a word split at a line end is joined again. */
function tidyQuote(quote: string): string {
  return quote.replace(/(\p{Ll})-\n(\p{Ll})/gu, "$1$2").replace(/-\n/g, "-");
}

function pageIndex(layer: HTMLElement): number {
  return Number(layer.closest<HTMLElement>(".page")?.dataset.pageNumber ?? 1) - 1;
}

/** A PDF's whole text, page by page, for anchoring in whichever pages are drawn under `root`. */
export class PdfText {
  readonly runs: PdfRun[][];
  readonly full: string;
  private starts: number[];

  constructor(runs: PdfRun[][]) {
    this.runs = runs;
    const texts = runs.map(layerText);
    this.starts = texts.map((_text, index) => texts.slice(0, index).reduce((length, text) => length + text.length, 0));
    this.full = texts.join("");
  }

  /** One quote per drawn page the range touches: a highlight never crosses a page break. */
  quotesFor(root: ParentNode, range: Range): TextQuote[] {
    const quotes: TextQuote[] = [];
    for (const layer of root.querySelectorAll<HTMLElement>(READY_LAYER)) {
      if (!range.intersectsNode(layer)) continue;
      const part = layer.ownerDocument.createRange();
      part.selectNodeContents(layer);
      if (range.compareBoundaryPoints(Range.START_TO_START, part) > 0) part.setStart(range.startContainer, range.startOffset);
      if (range.compareBoundaryPoints(Range.END_TO_END, part) < 0) part.setEnd(range.endContainer, range.endOffset);
      const found = describeRange(layer, part);
      if (!found) continue;
      quotes.push({ ...found, quote: tidyQuote(found.quote), position: found.position + (this.starts[pageIndex(layer)] ?? 0) });
    }
    return quotes;
  }

  /** The 1 based page a quote sits on, or null when it is not in this PDF. */
  pageOf(quote: TextQuote): number | null {
    const hit = this.full ? matchQuote(this.full, quote) : null;
    return hit ? this.pageIndexAt(hit[0]) + 1 : null;
  }

  /** Find the page in the whole text, then the passage in that page's layer if it is drawn. */
  rangeFor(root: ParentNode, quote: TextQuote): Range | null {
    const hit = this.full ? matchQuote(this.full, quote) : null;
    if (!hit) return null;
    const index = this.pageIndexAt(hit[0]);
    const layer = root.querySelector<HTMLElement>(`.page[data-page-number="${index + 1}"] ${READY_LAYER}`);
    return layer ? anchorToRange(layer, { ...quote, position: hit[0] - this.starts[index] }) : null;
  }

  private pageIndexAt(at: number): number {
    let index = 0;
    while (index + 1 < this.starts.length && this.starts[index + 1] <= at) index++;
    return index;
  }

  /** The first candidate whose text overlaps the quote, so Keep attaches instead of highlighting twice. */
  covering<T extends TextQuote>(quote: TextQuote, candidates: readonly T[]): T | undefined {
    const span = matchQuote(this.full, quote);
    if (!span) return undefined;
    return candidates.find((candidate) => {
      const hit = matchQuote(this.full, candidate);
      return hit !== null && hit[0] < span[1] && span[0] < hit[1];
    });
  }

  /** The text view's paragraphs with the page each sits on, so a TL;DR cites the same passages everywhere. */
  paragraphs(): { text: string; page: number }[] {
    return pdfParagraphs(this.runs).flatMap((paragraphs, index) => paragraphs.map((text) => ({ text, page: index + 1 })));
  }
}
