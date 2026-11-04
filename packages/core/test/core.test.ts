import { test } from "node:test";
import assert from "node:assert/strict";
import { matchQuote, quoteFromText, textFragmentUrl, formatHighlight, streaks, levelFor, citeForClipboard } from "../src/index.ts";

const text = "The lamp was on. The lamp was off. Then the lamp was on again, and we read.";

test("matchQuote picks the occurrence whose context matches", () => {
  const i = text.lastIndexOf("the lamp was on");
  const sel = quoteFromText(text, i, i + "the lamp was on".length);
  assert.deepEqual(matchQuote(text, sel), [i, i + 15]);
  const first = quoteFromText(text, 4, 8); // "lamp" first occurrence
  assert.deepEqual(matchQuote(text, first), [4, 8]);
});

test("matchQuote survives whitespace changes", () => {
  const sel = { quote: "lamp   was\noff", prefix: "", suffix: "", position: 0 };
  const r = matchQuote(text, sel);
  assert.ok(r);
  assert.equal(text.slice(r![0], r![1]), "lamp was off");
});

// The PDF viewer's text keeps line ends and hyphens; the text view joins them. Each must find the other's quotes.
test("matchQuote finds a text view quote in PDF page text", () => {
  const page = "We propose a new simple network architecture, the Transformer, based solely on attention mechanisms, dispensing with recurrence and convolutions entirely. Experiments on two machine translation tasks show these models to be superior in quality while being more parallelizable. The dominant sequence transduc-\ntion models are based on complex recurrent networks.\nThe best performing models also connect the encoder and decoder.";
  const hit = matchQuote(page, { quote: "sequence transduction models are based", prefix: "", suffix: "", position: 0 });
  assert.ok(hit);
  assert.equal(page.slice(hit[0], hit[1]), "sequence transduc-\ntion models are based");
  const across = matchQuote(page, { quote: "recurrent networks.The best performing", prefix: "", suffix: "", position: 0 });
  assert.ok(across);
  assert.equal(page.slice(across[0], across[1]), "recurrent networks.\nThe best performing");
});

test("matchQuote finds a PDF quote in the text view, using context to pick the occurrence", () => {
  const view = "The model reads the input.Then the model writes the output.Later, the model writes the summary.";
  const second = matchQuote(view, { quote: "the model\nwrites the", prefix: "output.\nLater, ", suffix: " summary.", position: 999 });
  assert.ok(second);
  assert.equal(view.slice(second[0], second[1]), "the model writes the");
  assert.equal(second[0], view.lastIndexOf("the model writes the"));
  const joined = matchQuote(view, { quote: "input. Then the model writes", prefix: "", suffix: "", position: 0 });
  assert.ok(joined);
  assert.equal(view.slice(joined[0], joined[1]), "input.Then the model writes");
});

// The viewer saves "Query-\nBandits" as "Query-Bandits", and its own page text still has the line end.
test("matchQuote finds a quote whose line end hyphen was kept before a capital", () => {
  const page = "In this work we introduce the Query-\nBandits framework, which shapes queries before they reach the model. It in-\nline cites GPT-\n4 results.";
  const hit = matchQuote(page, { quote: "introduce the Query-Bandits framework, which shapes queries", prefix: "", suffix: "", position: 0 });
  assert.ok(hit);
  assert.equal(page.slice(hit[0], hit[1]), "introduce the Query-\nBandits framework, which shapes queries");
  const mixed = matchQuote(page, { quote: "It inline cites GPT-4 results.", prefix: "", suffix: "", position: 0 });
  assert.ok(mixed);
  assert.equal(page.slice(mixed[0], mixed[1]), "It in-\nline cites GPT-\n4 results.");
});

test("matchQuote does not match a short quote only by squeezing out spaces", () => {
  assert.equal(matchQuote("a ton of bricks", { quote: "aton", prefix: "", suffix: "", position: 0 }), null);
});

test("text fragment links", () => {
  assert.equal(textFragmentUrl("https://a.b/x#y", "short quote"), "https://a.b/x#:~:text=short%20quote");
  const long = "one two three four five six seven eight nine ten eleven twelve";
  assert.equal(textFragmentUrl("https://a.b/x", long), "https://a.b/x#:~:text=one%20two%20three%20four%20five,eight%20nine%20ten%20eleven%20twelve");
  assert.match(textFragmentUrl("https://a.b", "well-known"), /well%2Dknown/);
});

test("house format matches the vault syntax", () => {
  const out = formatHighlight({ quote: "light  reading", note: "nice", title: "T", url: "https://x.y" }, "house");
  assert.equal(out, "==light reading==^[nice] ([T](https://x.y#:~:text=light%20reading))");
});

test("clipboard citation carries the source", () => {
  const out = citeForClipboard({ quote: "a b", title: "Post", url: "https://x.y" });
  assert.match(out, /^> a b\n>\n> \[Post\]\(https:\/\/x\.y#:~:text=a%20b\)$/);
});

test("streaks count back from today or yesterday", () => {
  const days = ["2026-10-25", "2026-10-26", "2026-10-28", "2026-10-29", "2026-10-30"];
  assert.deepEqual(streaks(days, "2026-10-31"), { current: 3, best: 3 });
  assert.deepEqual(streaks(days, "2026-11-02"), { current: 0, best: 3 });
});

test("levels", () => {
  assert.equal(levelFor(0).name, "Spark");
  assert.equal(levelFor(75).name, "Candle");
  assert.equal(levelFor(99999).progress, 1);
});
