import { test } from "node:test";
import assert from "node:assert/strict";
import { answerFromNote, blockIdFor, formatHighlight, formatLateAnswer, formatSourceBlock, menuActions, modelLabel, upgradeBarActions, BAR_SETTINGS_VERSION, DEFAULT_BAR_ACTIONS } from "../src/index.ts";

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

test("the LUM-1 default bar gains Ask and Define, a customised one keeps its choices", () => {
  assert.deepEqual(upgradeBarActions(["highlight", "note", "explain", "simplify", "copy"], 2), DEFAULT_BAR_ACTIONS);
  assert.deepEqual(DEFAULT_BAR_ACTIONS, ["highlight", "note", "ask", "define", "explain", "simplify", "copy"]);
  assert.deepEqual(upgradeBarActions(["highlight", "explain"], 2), ["highlight", "explain"]);
});

test("More holds everything off the bar, never Summary", () => {
  assert.deepEqual(menuActions(DEFAULT_BAR_ACTIONS), ["counterpoint", "related", "expand", "save", "cite"]);
  assert.ok(!menuActions(["highlight"]).includes("summarize"));
});

test("block ids follow the passage in every format and never touch older output", () => {
  const base = { quote: "the lamp", title: "T", url: "https://x.y", note: "mine", blockId: blockIdFor("hl_abc123def456ghi") };
  assert.equal(base.blockId, "lumen-abc123def4");
  assert.match(formatHighlight(base, "house"), /\) \^lumen-abc123def4$/);
  assert.match(formatHighlight(base, "callout"), /> \*\*Note:\*\* mine\n\n\^lumen-abc123def4$/);
  assert.match(formatHighlight(base, "plain"), /\n\n\^lumen-abc123def4\n\nmine$/);
});

test("an answer kept late gets its own block pointing back at the passage", () => {
  const out = formatLateAnswer({ quote: "Sorting is useful. It is just not the same thing", url: "https://x.y" }, { action: "explain", question: null, answer: "It means sorting." }, "callout");
  assert.match(out, /^↳ Explain on "Sorting is useful\. It is just…" \(\[source\]\(https:\/\/x\.y#:~:text=[^)]+\)\)\n> \[!explain\]- Explain\n> It means sorting\.$/);
  assert.match(formatLateAnswer({ quote: "short", url: "https://x.y" }, { action: "define", question: null, answer: "A." }, "plain"), /^↳ Define on "short" .+\n\n\*\*Define:\*\* A\.$/);
});

test("late answers follow the new highlights in their source block", () => {
  const out = formatSourceBlock({ title: "T", url: "https://x.y" }, [], "plain", new Date("2026-11-02"), [{ highlight: { quote: "q", url: "https://x.y" }, answer: { action: "expand", question: null, answer: "More." } }]);
  assert.match(out, /^\n## T\n\[source\]\(https:\/\/x\.y\) · clipped 2026-11-02\n\n↳ Expand on "q"/);
});
