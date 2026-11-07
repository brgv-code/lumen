import { test } from "node:test";
import assert from "node:assert/strict";
import { applyAnswerEvent, cachedAnswer, requestToCancel, startAnswer, type AnswerStream } from "../src/index.ts";

const replay = (stream: AnswerStream | null, events: Parameters<typeof applyAnswerEvent>[1][]) => events.reduce(applyAnswerEvent, stream);

test("a TL;DR still streaming when Explain starts never mixes into the Explain answer", () => {
  const tldr = replay(startAnswer(1, "tldr"), [{ type: "chunk", requestId: 1, chunk: "Summary " }]);
  assert.equal(tldr?.text, "Summary ");
  const explain = replay(startAnswer(2, "answer"), [
    { type: "chunk", requestId: 1, chunk: "more summary" },
    { type: "chunk", requestId: 2, chunk: "It means" },
    { type: "done", requestId: 1, model: "tldr-model" },
  ]);
  assert.deepEqual(explain, { requestId: 2, kind: "answer", text: "It means", model: null, status: "streaming" });
});

test("a closed card ignores whatever its stream still sends", () => {
  assert.equal(replay(null, [{ type: "chunk", requestId: 1, chunk: "late" }, { type: "done", requestId: 1, model: "m" }]), null);
});

test("done keeps the text and records the model; an error ends the stream with its message", () => {
  const done = replay(startAnswer(3, "tldr"), [{ type: "chunk", requestId: 3, chunk: "Short." }, { type: "done", requestId: 3, model: "llama" }]);
  assert.deepEqual(done, { requestId: 3, kind: "tldr", text: "Short.", model: "llama", status: "done" });
  const failed = replay(startAnswer(4, "answer"), [{ type: "error", requestId: 4, error: "Daily limit reached" }]);
  assert.deepEqual(failed, { requestId: 4, kind: "answer", text: "", model: null, status: "failed", error: "Daily limit reached" });
});

test("a TL;DR shown from this visit's cache ignores the stream it replaced", () => {
  const shown = replay(cachedAnswer(5, "tldr", { text: "Kept.", model: "llama" }), [{ type: "chunk", requestId: 4, chunk: "stray" }]);
  assert.deepEqual(shown, { requestId: 5, kind: "tldr", text: "Kept.", model: "llama", status: "done" });
});

test("closing a card while its answer streams cancels that request; a finished or cached one cancels nothing", () => {
  assert.equal(requestToCancel(startAnswer(6, "answer")), 6);
  assert.equal(requestToCancel(replay(startAnswer(7, "tldr"), [{ type: "done", requestId: 7, model: null }])), null);
  assert.equal(requestToCancel(replay(startAnswer(8, "answer"), [{ type: "error", requestId: 8, error: "no" }])), null);
  assert.equal(requestToCancel(cachedAnswer(9, "tldr", { text: "Kept.", model: null })), null);
  assert.equal(requestToCancel(null), null);
});
