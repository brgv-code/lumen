import { test } from "node:test";
import assert from "node:assert/strict";
import { parseHTML } from "linkedom";
import { pageSnapshot } from "../src/lib/snapshot.ts";

const docFrom = (html: string) => parseHTML(html).document as unknown as Document;

// linkedom has no layout, so the test stands in for getComputedStyle with a class.
const hiddenByClass = (element: Element) => element.classList.contains("hidden");

const page = `<html><head><title>Structured outputs</title><meta property="og:title" content="Structured outputs"><style>.x{}</style></head><body>
  <div class="hidden"><article><h1>Task budgets</h1></article></div>
  <main><h1>Structured outputs</h1><p class="hidden">Copied!</p><p>Constrain the response.</p><script>track()</script></main>
</body></html>`;

test("the snapshot leaves out what the browser hides and keeps what it shows", () => {
  const snapshot = pageSnapshot(docFrom(page), hiddenByClass);
  assert.doesNotMatch(snapshot, /Task budgets/);
  assert.doesNotMatch(snapshot, /Copied!/);
  assert.match(snapshot, /<h1>Structured outputs<\/h1>/);
  assert.match(snapshot, /Constrain the response\./);
});

test("the snapshot keeps the head's metadata, which is never rendered", () => {
  const snapshot = pageSnapshot(docFrom(page), () => true);
  assert.match(snapshot, /<title>Structured outputs<\/title>/);
  assert.match(snapshot, /og:title/);
});

test("the snapshot drops scripts and styles and leaves the live page untouched", () => {
  const doc = docFrom(page);
  const before = doc.documentElement.outerHTML;
  const snapshot = pageSnapshot(doc, hiddenByClass);
  assert.doesNotMatch(snapshot, /track\(\)|\.x\{\}/);
  assert.ok(snapshot.startsWith("<!doctype html>"));
  assert.equal(doc.documentElement.outerHTML, before);
});
