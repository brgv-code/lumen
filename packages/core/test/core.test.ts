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
