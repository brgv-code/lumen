import { test } from "node:test";
import assert from "node:assert/strict";
import { answerFromNote, formatHighlight, menuActions, modelLabel, upgradeBarActions, BAR_SETTINGS_VERSION, DEFAULT_BAR_ACTIONS } from "../src/index.ts";

test("answerFromNote finds the five old prefixes and leaves the reader's words alone", () => {
  assert.deepEqual(answerFromNote("Explain: It means the lamp."), { action: "explain", answer: "It means the lamp." });
  assert.deepEqual(answerFromNote("Ask: Because it was late."), { action: "ask", answer: "Because it was late." });
  assert.equal(answerFromNote("explain: lower case is the reader writing"), null);
  assert.equal(answerFromNote("Why this matters to me"), null);
  assert.equal(answerFromNote(null), null);
});

test("modelLabel shortens Workers AI names and keeps local ones", () => {
  assert.equal(modelLabel("@cf/meta/llama-3.3-70b-instruct-fp8-fast"), "llama-3.3-70b");
  assert.equal(modelLabel("@cf/meta/llama-3.1-8b-instruct-fp8"), "llama-3.1-8b");
  assert.equal(modelLabel("llama3"), "llama3");
});

const kept = { quote: "the lamp", title: "T", url: "https://x.y", answers: [{ action: "explain" as const, question: null, answer: "Line one.\n\nLine two." }] };

test("kept answers ride under the highlight as collapsed callouts", () => {
  const out = formatHighlight(kept, "callout");
  assert.match(out, /\n\n> \[!explain\]- Explain\n> Line one\.\n>\n> Line two\.$/);
});

test("plain format writes answers as bold paragraphs, with the question when asked", () => {
  const out = formatHighlight({ ...kept, answers: [{ action: "ask", question: "Why?", answer: "Because." }] }, "plain");
  assert.match(out, /\n\n\*\*Answer: Why\?:\*\* Because\.$/);
});

test("highlights without answers render exactly as before", () => {
  assert.equal(formatHighlight({ ...kept, answers: [] }, "house"), formatHighlight({ quote: "the lamp", title: "T", url: "https://x.y" }, "house"));
});

test("the old default bar becomes the new one", () => {
  assert.deepEqual(upgradeBarActions(["highlight", "note", "explain", "expand", "summarize", "save", "copy"], undefined), DEFAULT_BAR_ACTIONS);
  assert.deepEqual(upgradeBarActions(undefined, undefined), DEFAULT_BAR_ACTIONS);
});

test("a customised bar keeps its choices: Copy meant citation, Simplify joins after Explain", () => {
  assert.deepEqual(upgradeBarActions(["copy", "explain", "define"], undefined), ["cite", "explain", "simplify", "define"]);
  assert.deepEqual(upgradeBarActions(["highlight", "bogus"], undefined), ["highlight", "simplify"]);
});

test("an upgraded bar is never upgraded twice", () => {
  assert.deepEqual(upgradeBarActions(["copy", "explain"], BAR_SETTINGS_VERSION), ["copy", "explain"]);
});

test("More holds everything off the bar, never Summary", () => {
  assert.deepEqual(menuActions(DEFAULT_BAR_ACTIONS), ["ask", "define", "counterpoint", "related", "expand", "save", "cite"]);
  assert.ok(!menuActions(["highlight"]).includes("summarize"));
});
