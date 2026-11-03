import { test } from "node:test";
import assert from "node:assert/strict";
import { RECALL_INTERVALS, fallbackRecallQuestions, parseRecallQuestions, recallPrompt, scheduleRecall } from "../src/index.ts";

const DAY = 86_400_000;
const at = Date.UTC(2026, 10, 3, 9);

test("a remembered card waits longer each time, up to the last interval", () => {
  assert.deepEqual(scheduleRecall(0, "good", at), { step: 1, dueAt: at + RECALL_INTERVALS[0] * DAY });
  assert.deepEqual(scheduleRecall(1, "good", at), { step: 2, dueAt: at + RECALL_INTERVALS[1] * DAY });
  const last = RECALL_INTERVALS.length;
  assert.deepEqual(scheduleRecall(last, "good", at), { step: last, dueAt: at + RECALL_INTERVALS[last - 1] * DAY });
  assert.deepEqual(scheduleRecall(last + 5, "good", at), { step: last, dueAt: at + RECALL_INTERVALS[last - 1] * DAY });
});

test("a forgotten card starts over and comes back tomorrow", () => {
  assert.deepEqual(scheduleRecall(4, "again", at), { step: 0, dueAt: at + DAY });
  assert.deepEqual(scheduleRecall(0, "again", at), { step: 0, dueAt: at + DAY });
});

test("the prompt numbers passages and carries the reader's notes", () => {
  const prompt = recallPrompt("Reading slowly", [{ quote: "Sorting is not reading.", note: "opening line" }, { quote: "Slow reading compounds.", note: null }]);
  assert.match(prompt, /Reading slowly/);
  assert.match(prompt, /1\. "Sorting is not reading\." \(my note: opening line\)/);
  assert.match(prompt, /2\. "Slow reading compounds\."$/m);
});

test("parses questions from a JSON object or from JSON buried in prose", () => {
  const fromObject = parseRecallQuestions({ questions: [{ q: "Why is sorting not reading?", from: 1 }] }, 2);
  assert.deepEqual(fromObject, [{ question: "Why is sorting not reading?", from: 1 }]);
  const fromText = parseRecallQuestions('Sure! {"questions":[{"q":"How does slow reading compound?","from":2}]} Hope that helps.', 2);
  assert.deepEqual(fromText, [{ question: "How does slow reading compound?", from: 2 }]);
});

test("drops empty, duplicate and out of range entries and keeps at most three", () => {
  const parsed = parseRecallQuestions({
    questions: [
      { q: "  Why one?  ", from: 1 },
      { q: "why one?", from: 1 },
      { q: "", from: 1 },
      { q: "Points nowhere?", from: 9 },
      { q: "Three?", from: 2 },
      { q: "Four?", from: 1 },
      { q: "Five?", from: 2 },
    ],
  }, 2);
  assert.deepEqual(parsed, [
    { question: "Why one?", from: 1 },
    { question: "Points nowhere?", from: null },
    { question: "Three?", from: 2 },
  ]);
  assert.deepEqual(parseRecallQuestions("no json here", 2), []);
  assert.deepEqual(parseRecallQuestions(null, 2), []);
});

test("without a model, each passage becomes a cue to explain it back", () => {
  const questions = fallbackRecallQuestions([
    { quote: "Sorting is useful. It is just not the same thing as reading.", note: null },
    { quote: "Short.", note: null },
  ]);
  assert.equal(questions.length, 2);
  assert.deepEqual(questions[0], { question: "In your own words: what is the idea behind “Sorting is useful. It is just…”?", from: 1 });
  assert.deepEqual(questions[1], { question: "In your own words: what is the idea behind “Short.”?", from: 2 });
});
