// The PDF viewer as a Lumen surface: quotes come from pdf.js text layers, one page at a time.
import { matchQuote, pdfParagraphs, type PdfRun, type TextQuote } from "@lumen/core";
import { anchorToRange, describeRange } from "@lumen/core/dom";
import type { BarSnapshot } from "@lumen/core/bar";
import type { Paragraph, Surface } from "../content/lumen";

const READY_LAYER = ".textLayer[data-lumen-lines]";

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
    const lineEnd = document.createElement("span");
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

export class PdfSurface implements Surface {
  readonly kind = "pdf";
  /** Each page's runs, once every page's text is read. */
  runs: PdfRun[][] = [];
  private full = "";
  private starts: number[] = [];

  constructor(readonly root: HTMLElement, private file: string, private name: () => string, private saved: () => void) {}

  url() { return this.file; }
  title() { return this.name(); }
  site() { return new URL(this.file).hostname; }
  html() { return ""; }
  onSaved() { this.saved(); }

  setText(runs: PdfRun[][]) {
    this.runs = runs;
    const texts = runs.map(layerText);
    this.starts = texts.map((_text, index) => texts.slice(0, index).reduce((length, text) => length + text.length, 0));
    this.full = texts.join("");
  }

  mainText() { return this.full; }

  /** The text view's paragraphs, so a TL;DR cites the same passages there and here. */
  paragraphs(): Paragraph[] {
    return pdfParagraphs(this.runs).flatMap((paragraphs, index) => {
      const page = this.root.querySelector(`.page[data-page-number="${index + 1}"]`);
      return page ? paragraphs.map((text) => ({ text, quote: { quote: text, prefix: "", suffix: "", position: 0 }, element: page })) : [];
    });
  }

  /** One quote per page the selection touches: a highlight never crosses a page break. */
  quotesFor({ quote, range }: BarSnapshot): TextQuote[] {
    const quotes: TextQuote[] = [];
    for (const layer of this.root.querySelectorAll<HTMLElement>(READY_LAYER)) {
      if (!range.intersectsNode(layer)) continue;
      const part = document.createRange();
      part.selectNodeContents(layer);
      if (range.compareBoundaryPoints(Range.START_TO_START, part) > 0) part.setStart(range.startContainer, range.startOffset);
      if (range.compareBoundaryPoints(Range.END_TO_END, part) < 0) part.setEnd(range.endContainer, range.endOffset);
      const found = describeRange(layer, part);
      if (!found) continue;
      quotes.push({ ...found, quote: tidyQuote(found.quote), position: found.position + (this.starts[pageIndex(layer)] ?? 0) });
    }
    return quotes.length ? quotes : [quote];
  }

  /** Find the page in the whole text, then the passage in that page's layer if it is drawn. */
  rangeFor(quote: TextQuote): Range | null {
    const hit = this.full ? matchQuote(this.full, quote) : null;
    if (!hit) return null;
    const index = this.starts.findLastIndex((start) => start <= hit[0]);
    const layer = this.root.querySelector<HTMLElement>(`.page[data-page-number="${index + 1}"] ${READY_LAYER}`);
    return layer ? anchorToRange(layer, { ...quote, position: hit[0] - this.starts[index] }) : null;
  }
}

function pageIndex(layer: HTMLElement): number {
  return Number(layer.closest<HTMLElement>(".page")?.dataset.pageNumber ?? 1) - 1;
}
