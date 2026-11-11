import { test } from "node:test";
import assert from "node:assert/strict";
import { parseHTML } from "linkedom";
import { previewFromDocument, previewTarget } from "../src/lib/preview.ts";

const docFrom = (html: string) => parseHTML(html).document as unknown as Document;

test("a page with Open Graph tags previews its title, description, site and image", () => {
  const doc = docFrom(`<html><head><title>Fallback</title>
    <meta property="og:title" content="How we cut cold starts">
    <meta property="og:description" content="Three changes &amp; one measurement.">
    <meta property="og:site_name" content="The Blog">
    <meta property="og:image" content="/cover.png">
  </head><body></body></html>`);
  assert.deepEqual(previewFromDocument(doc, "https://www.example.com/post"), {
    url: "https://www.example.com/post",
    title: "How we cut cold starts",
    summary: "Three changes & one measurement.",
    site: "The Blog",
    image: "https://www.example.com/cover.png",
  });
});

test("without Open Graph it falls back to the title, meta description and hostname", () => {
  const doc = docFrom(`<html><head><title> Plain page </title><meta name="description" content="Short   and plain."></head></html>`);
  const preview = previewFromDocument(doc, "https://www.example.com/a");
  assert.equal(preview.title, "Plain page");
  assert.equal(preview.summary, "Short and plain.");
  assert.equal(preview.site, "example.com");
  assert.equal(preview.image, null);
});

test("with no description the summary is the first real paragraph", () => {
  const doc = docFrom(`<html><head><title>T</title></head><body><p>Menu</p><article><p>${"Long enough paragraph text. ".repeat(4)}</p></article></body></html>`);
  assert.equal(previewFromDocument(doc, "https://example.com/").summary, "Long enough paragraph text. ".repeat(4).trim());
});

test("a page with nothing to say has no summary and is titled by its hostname", () => {
  const preview = previewFromDocument(docFrom("<html><head></head><body><p>Hi</p></body></html>"), "https://example.com/x");
  assert.equal(preview.title, "example.com");
  assert.equal(preview.summary, null);
});

test("a long description is cut at a word with an ellipsis", () => {
  const doc = docFrom(`<html><head><meta name="description" content="${"word ".repeat(100)}"></head></html>`);
  const summary = previewFromDocument(doc, "https://example.com/").summary ?? "";
  assert.ok(summary.length <= 301);
  assert.ok(summary.endsWith("word…"));
});

test("an image that is not http(s) is dropped", () => {
  const doc = docFrom(`<html><head><meta property="og:image" content="javascript:alert(1)"></head></html>`);
  assert.equal(previewFromDocument(doc, "https://example.com/").image, null);
});

test("links to other pages get a preview, without their fragment", () => {
  assert.equal(previewTarget("https://other.com/post#part", "https://example.com/"), "https://other.com/post");
  assert.equal(previewTarget("/docs?page=2", "https://example.com/docs"), "https://example.com/docs?page=2");
});

test("same page anchors, mail, script and file links get no preview", () => {
  assert.equal(previewTarget("#section", "https://example.com/post"), null);
  assert.equal(previewTarget("https://example.com/post#top", "https://example.com/post"), null);
  assert.equal(previewTarget("mailto:a@b.c", "https://example.com/"), null);
  assert.equal(previewTarget("javascript:void(0)", "https://example.com/"), null);
  assert.equal(previewTarget("ftp://example.com/file", "https://example.com/"), null);
});
