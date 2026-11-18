import { test } from "node:test";
import assert from "node:assert/strict";
import { asResponseEvents, replyOf } from "../src/worker/lib/ai.ts";

/** A stream that hands over the given pieces one chunk at a time, like the AI binding does. */
function streamOf(pieces: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const piece of pieces) controller.enqueue(encoder.encode(piece));
      controller.close();
    },
  });
}

async function readAll(stream: ReadableStream<Uint8Array>): Promise<string> {
  return new Response(stream).text();
}

/** The `response` texts a reader would see, in order, plus whether [DONE] arrived. */
function responses(body: string) {
  const events = body.split("\n").filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trim());
  return { texts: events.filter((event) => event !== "[DONE]").map((event) => JSON.parse(event).response), done: events.at(-1) === "[DONE]" };
}

test("an OpenAI style stream reaches the reader as response events", async () => {
  const chunk = (content: string | null) => `data: ${JSON.stringify({ id: "c1", object: "chat.completion.chunk", choices: [{ index: 0, delta: { content } }] })}\n\n`;
  const body = await readAll(asResponseEvents(streamOf([chunk("Hel"), chunk("lo"), chunk(null), "data: [DONE]\n\n"])));
  assert.deepEqual(responses(body), { texts: ["Hel", "lo"], done: true });
});

test("an event split across chunks still arrives whole", async () => {
  const event = `data: ${JSON.stringify({ choices: [{ delta: { content: "whole" } }] })}\n\n`;
  const body = await readAll(asResponseEvents(streamOf([event.slice(0, 15), event.slice(15), "data: [DONE]\n\n"])));
  assert.deepEqual(responses(body), { texts: ["whole"], done: true });
});

test("a usage event with no choices left adds nothing", async () => {
  const usage = `data: ${JSON.stringify({ choices: [], usage: { prompt_tokens: 3 } })}\n\n`;
  const body = await readAll(asResponseEvents(streamOf([usage, "data: [DONE]\n\n"])));
  assert.deepEqual(responses(body), { texts: [], done: true });
});

test("a response style stream passes through unchanged", async () => {
  const original = `data: {"response":"Hi","p":"abc"}\n\ndata: {"response":" there"}\n\ndata: [DONE]\n\n`;
  assert.equal(await readAll(asResponseEvents(streamOf([original]))), original);
});

test("the reply comes out of either answer shape", () => {
  assert.equal(replyOf({ response: "old shape" }), "old shape");
  assert.equal(replyOf({ choices: [{ message: { role: "assistant", content: "new shape" } }] }), "new shape");
  assert.deepEqual(replyOf({ response: { ideas: [] } }), { ideas: [] });
  assert.equal(replyOf({ choices: [] }), "");
});
