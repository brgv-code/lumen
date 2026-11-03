import { test } from "node:test";
import assert from "node:assert/strict";
import { PDF_MAX_BYTES, isPdfBytes, pdfArticle, pdfParagraphs, pdfRuns, type PdfRun } from "../src/pdf.ts";

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
