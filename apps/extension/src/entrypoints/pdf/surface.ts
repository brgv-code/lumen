// The PDF viewer as a Lumen surface: quotes come from pdf.js text layers, one page at a time.
import type { PdfRun, TextQuote } from "@lumen/core";
import { PdfText } from "@lumen/core/pdf-dom";
import type { BarSnapshot } from "@lumen/core/bar";
import type { Paragraph, Surface } from "../content/lumen";

export class PdfSurface implements Surface {
  readonly kind = "pdf";
  /** Every page's text, once all of it is read. */
  private text = new PdfText([]);

  constructor(readonly root: HTMLElement, private file: string, private name: () => string, private saved: () => void) {}

  url() { return this.file; }
  title() { return this.name(); }
  site() { return new URL(this.file).hostname; }
  html() { return ""; }
  onSaved() { this.saved(); }

  get runs(): PdfRun[][] { return this.text.runs; }
  setText(runs: PdfRun[][]) { this.text = new PdfText(runs); }

  mainText() { return this.text.full; }

  /** The text view's paragraphs, so a TL;DR cites the same passages there and here. */
  paragraphs(): Paragraph[] {
    return this.text.paragraphs().flatMap(({ text, page }) => {
      const element = this.root.querySelector(`.page[data-page-number="${page}"]`);
      return element ? [{ text, quote: { quote: text, prefix: "", suffix: "", position: 0 }, element }] : [];
    });
  }

  quotesFor({ quote, range }: BarSnapshot): TextQuote[] {
    const quotes = this.text.quotesFor(this.root, range);
    return quotes.length ? quotes : [quote];
  }

  rangeFor(quote: TextQuote): Range | null { return this.text.rangeFor(this.root, quote); }
}
