import { test } from "node:test";
import assert from "node:assert/strict";
import type { Highlight, HighlightAnswer } from "@lumen/core";
import { uploadLocalHighlights, type LocalHighlight } from "../src/lib/offline.ts";

const PAGE = "https://example.com/post";

function local(id: string, answers: HighlightAnswer[] = []): Highlight {
  return { id, itemId: "local", quote: `quote ${id}`, prefix: "", suffix: "", position: 0, color: "sun", note: `note ${id}`, createdAt: 1, updatedAt: 1, answers };
}

function answer(id: string, highlightId: string, parentId: string | null): HighlightAnswer {
  return { id, highlightId, parentId, action: "explain", question: null, answer: `answer ${id}`, model: null, createdAt: 1 };
}

/** Local storage and the Lumen API as plain records; `failOn` makes one call throw once. */
function fakes(pages: Record<string, LocalHighlight[]>, failOn?: string) {
  const stored = structuredClone(pages);
  const sent: { highlights: { itemId: string; quote: string; color: string; note: string | null }[]; answers: { highlightId: string; parentId: string | null; answer: string }[] } = { highlights: [], answers: [] };
  let failed = false;
  const maybeFail = (what: string) => { if (what === failOn && !failed) { failed = true; throw new Error(`could not send ${what}`); } };
  const store = {
    all: async () => structuredClone(stored),
    set: async (url: string, list: LocalHighlight[]) => { if (list.length) stored[url] = structuredClone(list); else delete stored[url]; },
  };
  const api = {
    itemFor: async (url: string) => `item for ${url}`,
    addHighlight: async (itemId: string, h: { quote: string; color: string; note: string | null }) => {
      maybeFail(h.quote);
      sent.highlights.push({ itemId, quote: h.quote, color: h.color, note: h.note });
      return `cloud_${sent.highlights.length}`;
    },
    keepAnswer: async (highlightId: string, a: { parentId: string | null; answer: string }) => {
      maybeFail(a.answer);
      sent.answers.push({ highlightId, parentId: a.parentId, answer: a.answer });
      return `cloud_ans_${sent.answers.length}`;
    },
  };
  return { store, api, stored, sent };
}

test("connecting uploads each offline highlight to its page and clears the local copy", async () => {
  const f = fakes({ [PAGE]: [local("local_a"), local("local_b")] });
  await uploadLocalHighlights(f.store, f.api);
  assert.deepEqual(f.sent.highlights, [
    { itemId: `item for ${PAGE}`, quote: "quote local_a", color: "sun", note: "note local_a" },
    { itemId: `item for ${PAGE}`, quote: "quote local_b", color: "sun", note: "note local_b" },
  ]);
  assert.deepEqual(f.stored, {});
});

test("kept answers go with their highlight, and a follow up points at its parent's new id", async () => {
  const f = fakes({ [PAGE]: [local("local_a", [answer("local_ans_1", "local_a", null), answer("local_ans_2", "local_a", "local_ans_1")])] });
  await uploadLocalHighlights(f.store, f.api);
  assert.deepEqual(f.sent.answers, [
    { highlightId: "cloud_1", parentId: null, answer: "answer local_ans_1" },
    { highlightId: "cloud_1", parentId: "cloud_ans_1", answer: "answer local_ans_2" },
  ]);
});

test("an upload that fails partway sends nothing twice when it runs again", async () => {
  const f = fakes({ [PAGE]: [local("local_a", [answer("local_ans_1", "local_a", null), answer("local_ans_2", "local_a", "local_ans_1")]), local("local_b")] }, "answer local_ans_2");
  await assert.rejects(uploadLocalHighlights(f.store, f.api), /could not send answer local_ans_2/);
  await uploadLocalHighlights(f.store, f.api);
  assert.deepEqual(f.sent.highlights.map((h) => h.quote), ["quote local_a", "quote local_b"]);
  assert.deepEqual(f.sent.answers, [
    { highlightId: "cloud_1", parentId: null, answer: "answer local_ans_1" },
    { highlightId: "cloud_1", parentId: "cloud_ans_1", answer: "answer local_ans_2" },
  ]);
  assert.deepEqual(f.stored, {});
});
