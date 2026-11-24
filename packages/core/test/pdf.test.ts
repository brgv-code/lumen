import { test } from "node:test";
import assert from "node:assert/strict";
import { PDF_MAX_BYTES, isPdfBytes, pdfArticle, pdfParagraphs, pdfRuns, pdfTitle, type PdfRun, type PdfTextItem } from "../src/pdf.ts";

const build = (pages: PdfRun[][]) => pdfArticle(pdfParagraphs(pages));

/** One line of text at baseline y, as pdf.js reports it (y grows upward). */
const line = (text: string, y: number, height = 10): PdfRun => ({ text, y, height, endsLine: true });

test("lines close together form one paragraph, a wider gap starts the next", () => {
  const article = build([[line("The dominant sequence", 700), line("models are complex.", 688), line("We propose a new one.", 660)]]);
  assert.equal(article.html, '<section data-page="1"><p>The dominant sequence models are complex.</p><p>We propose a new one.</p></section>');
  assert.equal(article.text, "The dominant sequence models are complex.\n\nWe propose a new one.");
});

test("a word split by a hyphen at the line end is joined back", () => {
  const article = build([[line("sequence transduc-", 700), line("tion models", 688)]]);
  assert.equal(article.text, "sequence transduction models");
});

test("a hyphen before a capital or a digit is kept", () => {
  const article = build([[line("the GPT-", 700), line("4 model and the self-", 688), line("Attention block", 676)]]);
  assert.equal(article.text, "the GPT-4 model and the self-Attention block");
});

test("runs on one line are joined as pdf.js gives them, spaces included", () => {
  const runs: PdfRun[] = [{ text: "Attention", y: 700, height: 10, endsLine: false }, { text: " is all", y: 700, height: 10, endsLine: false }, { text: " you need", y: 700, height: 10, endsLine: true }];
  assert.equal(build([runs]).text, "Attention is all you need");
});

test("a jump back up the page (next column) starts a new paragraph", () => {
  const article = build([[line("End of the left column", 100), line("Top of the right column", 700)]]);
  assert.equal(article.text, "End of the left column\n\nTop of the right column");
});

test("an empty line pdf.js emits between blocks starts a new paragraph", () => {
  const article = build([[line("First block", 700), line("", 688), line("Second block", 676)]]);
  assert.equal(article.text, "First block\n\nSecond block");
});

test("bare page numbers are dropped", () => {
  const article = build([[line("Real text here", 700), line("12", 40)]]);
  assert.equal(article.text, "Real text here");
});

test("each page gets its own section, empty pages are left out", () => {
  const article = build([[line("Page one", 700)], [], [line("Page three", 700)]]);
  assert.equal(article.html, '<section data-page="1"><p>Page one</p></section><section data-page="3"><p>Page three</p></section>');
  assert.equal(article.pagesWithText, 2);
});

test("the server escapes paragraphs so a client cannot store markup", () => {
  const article = pdfArticle([['<img src=x onerror="alert(1)"> & more']]);
  assert.equal(article.html, '<section data-page="1"><p>&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; more</p></section>');
});

test("word count comes from the text, the excerpt skips titles and licence lines", () => {
  const title = "BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding";
  const licence = "Provided proper attribution is provided, Google hereby grants permission to reproduce the tables and figures in this paper.";
  const abstract = Array.from({ length: 45 }, (_, index) => `word${index}`).join(" ");
  const article = build([[line(title, 760), line(licence, 720), line(abstract, 680)]]);
  assert.equal(article.wordCount, 9 + 18 + 45);
  assert.equal(article.excerpt, abstract.slice(0, 300));
});

test("a scanned PDF has no text", () => {
  const article = build([[], [{ text: "  ", y: 500, height: 10, endsLine: true }]]);
  assert.equal(article.wordCount, 0);
  assert.equal(article.html, "");
  assert.equal(article.excerpt, null);
});

test("isPdfBytes checks the %PDF- signature, not the name", () => {
  assert.equal(isPdfBytes(new TextEncoder().encode("%PDF-1.7\n...")), true);
  assert.equal(isPdfBytes(new TextEncoder().encode("<!doctype html>")), false);
  assert.equal(isPdfBytes(new Uint8Array(2)), false);
  assert.equal(PDF_MAX_BYTES, 25 * 1024 * 1024);
});

test("pdf.js text items become runs, marked content tags are skipped", () => {
  const runs = pdfRuns([
    { type: "beginMarkedContent" },
    { str: "Attention", transform: [12, 0, 0, 12, 72, 700], height: 0, hasEOL: true },
    { str: "is all", transform: [10, 0, 0, 10, 72, 686], height: 10, hasEOL: false },
  ]);
  assert.deepEqual(runs, [
    { text: "Attention", y: 700, height: 12, endsLine: true },
    { text: "is all", y: 686, height: 10, endsLine: false },
  ]);
});

// The page view and the extension viewer share PdfText: these parts need no DOM.
test("PdfText finds the page a quote sits on, from a text view quote too", async () => {
  const { PdfText } = await import("../src/pdf-dom.ts");
  const text = new PdfText([[line("QueryBandits shapes queries", 700)], [line("before they reach the transduc-", 700), line("tion model.", 688)], []]);
  assert.equal(text.pageOf({ quote: "QueryBandits shapes", prefix: "", suffix: "", position: 0 }), 1);
  assert.equal(text.pageOf({ quote: "the transduction model.", prefix: "", suffix: "", position: 0 }), 2);
  assert.equal(text.pageOf({ quote: "not in this paper at all", prefix: "", suffix: "", position: 0 }), null);
});

test("PdfText.covering picks the highlight that overlaps a passage", async () => {
  const { PdfText } = await import("../src/pdf-dom.ts");
  const text = new PdfText([[line("One idea here.", 700), line("Another idea there.", 688)]]);
  const first = { id: "a", quote: "One idea", prefix: "", suffix: "", position: 0 };
  const second = { id: "b", quote: "Another idea", prefix: "", suffix: "", position: 15 };
  assert.equal(text.covering({ quote: "idea there", prefix: "", suffix: "", position: 0 }, [first, second])?.id, "b");
  assert.equal(text.covering({ quote: "here.", prefix: "", suffix: "", position: 0 }, [second]), undefined);
});

/** A pdf.js text item at (x, y) and font size `size`; `rotated` turns it 90 degrees like arXiv's side stamp. */
const run = (str: string, x: number, y: number, size: number, rotated = false): PdfTextItem => ({ str, transform: rotated ? [0, size, -size, 0, x, y] : [size, 0, 0, size, x, y], height: size, hasEOL: false });
const body = [run("Ashish Vaswani", 133, 549, 10), run("The dominant sequence transduction models are based on", 125, 380, 10)];

test("the PDF's own Title wins over the page", () => {
  assert.equal(pdfTitle({ Title: "Attention Is All You Need" }, [run("Something else", 200, 630, 17)]), "Attention Is All You Need");
});

test("with no Title, the biggest upright text on page one is the title", () => {
  const page = [run("arXiv:1706.03762v7 [cs.CL] 2 Aug 2023", 32, 237, 20, true), run("Attention Is All You Need", 211, 630, 17.2), ...body];
  assert.equal(pdfTitle({ Title: "" }, page), "Attention Is All You Need");
});

test("a title set over two lines is joined", () => {
  const page = [run("Chain-of-Thought Prompting Elicits Reasoning", 132, 679, 17.2), run("in Large Language Models", 207, 659, 17.2), ...body];
  assert.equal(pdfTitle({}, page), "Chain-of-Thought Prompting Elicits Reasoning in Large Language Models");
});

test("small capitals come back as lower case", () => {
  const page = [run("T", 108, 699, 17.2), run("REE OF", 120, 699, 13.8), run(" ", 160, 699, 0), run("T", 170, 699, 17.2), run("HOUGHTS", 180, 699, 13.8), ...body];
  assert.equal(pdfTitle({}, page), "Tree of Thoughts");
});

test("a file name in Title is ignored for the page heading", () => {
  assert.equal(pdfTitle({ Title: "paper-final.pdf" }, [run("Tree of Thoughts", 136, 679, 17.2), ...body]), "Tree of Thoughts");
});

test("a page whose text is all one size has no title", () => {
  assert.equal(pdfTitle({}, body), null);
  assert.equal(pdfTitle(null), null);
});
