import { test } from "node:test";
import assert from "node:assert/strict";
import { parseHTML } from "linkedom";
import { chunkParagraphs, formatSourceBlock, formatTldr, linkCitations, paragraphsWithin, parseSlash, splitCitations, tldrPrompt, type Citation } from "../src/index.ts";
import { readableParagraphs } from "../src/dom.ts";

test("tldrPrompt numbers paragraphs from the chunk's first number", () => {
  assert.equal(tldrPrompt("T", ["one", "two"], 5), 'Article: "T"\n\n[p5] one\n\n[p6] two\n\nWrite the TL;DR.');
});

test("chunkParagraphs keeps runs under the limit and the article's numbering", () => {
  assert.deepEqual(chunkParagraphs(["aaaa", "bbbb", "cc", "dddd"], 9), [{ first: 1, paragraphs: ["aaaa", "bbbb"] }, { first: 3, paragraphs: ["cc", "dddd"] }]);
  assert.deepEqual(chunkParagraphs(["x".repeat(20)], 9), [{ first: 1, paragraphs: ["x".repeat(9)] }]);
});

test("paragraphsWithin keeps the leading paragraphs that fit", () => {
  assert.deepEqual(paragraphsWithin(["aaaa", "bbbb", "cc"], 9), ["aaaa", "bbbb"]);
  assert.deepEqual(paragraphsWithin(["x".repeat(20)], 9), ["x".repeat(9)]);
});

const citations: Citation[] = [{ n: 3, quote: { quote: "short quote", prefix: "", suffix: "", position: 0 } }];

test("splitCitations finds every [pN] marker", () => {
  assert.deepEqual(splitCitations("- One [p3].\n- Two [p12]"), ["- One ", { n: 3 }, ".\n- Two ", { n: 12 }]);
});

test("linkCitations turns known markers into text fragment links and drops unknown ones", () => {
  assert.equal(linkCitations("- One [p3].\n- Two [p9].", citations, "https://x.y"), "- One ([¶3](https://x.y#:~:text=short%20quote)).\n- Two.");
});

test("a TL;DR sits on top of its block, or follows as its own block once the page was sent", () => {
  const tldr = { text: "- One [p3].", citations };
  assert.equal(formatTldr({ title: "T", url: "https://x.y" }, tldr, "callout", "top"), "> [!tldr] TL;DR\n> - One ([¶3](https://x.y#:~:text=short%20quote)).");
  assert.match(formatTldr({ title: "T", url: "https://x.y" }, tldr, "house", "own"), /^↳ TL;DR of "T" \(\[source\]\(https:\/\/x\.y\)\)\n> \[!tldr\]- TL;DR\n> - One/);
  assert.equal(formatTldr({ title: "T", url: "https://x.y" }, { text: "One.", citations: [] }, "plain", "top"), "**TL;DR:** One.");
  const block = formatSourceBlock({ title: "T", url: "https://x.y" }, [{ quote: "q", title: "T", url: "https://x.y" }], "plain", new Date("2026-11-02"), [], { ...tldr, placement: "top" });
  assert.match(block, /clipped 2026-11-02\n\n\*\*TL;DR:\*\* - One .+\n\n> q/);
});

test("parseSlash knows the four commands and leaves questions alone", () => {
  assert.deepEqual(parseSlash("/define  latency "), { command: "define", rest: "latency" });
  assert.deepEqual(parseSlash("/TLDR"), { command: "tldr", rest: "" });
  assert.equal(parseSlash("/unknown thing"), null);
  assert.equal(parseSlash("what is /define"), null);
});

test("readableParagraphs reads blocks in order, skips short and nested ones", () => {
  const { document } = parseHTML("<html><body><article><h2>Tiny</h2><p>The first paragraph is long enough to count.</p><blockquote><p>A quoted paragraph that is also long enough.</p></blockquote><ul><li>A list item that is long enough to count too.</li></ul></article></body></html>");
  const root = document.querySelector("article");
  if (!root) throw new Error("fixture has no article");
  const found = readableParagraphs(root);
  assert.deepEqual(found.map((p) => p.text), ["The first paragraph is long enough to count.", "A quoted paragraph that is also long enough.", "A list item that is long enough to count too."]);
  assert.equal(found[0]?.quote.quote, "The first paragraph is long enough to count.");
});
