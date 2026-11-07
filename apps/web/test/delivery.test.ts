import { test } from "node:test";
import assert from "node:assert/strict";
import { signedInApi } from "./harness.ts";

type Pending = { highlightIds: string[]; answerIds: string[]; tldrIds: string[] };

/** A collection that sends to one destination, with one saved page in it. */
function apiWithDestination(kind: "obsidian" | "webhook") {
  const api = signedInApi();
  const config = kind === "obsidian" ? { notePath: "Lumen.md", format: "plain" } : { url: "https://hooks.example.com/lumen" };
  api.sqlite.prepare("INSERT INTO destinations (id, user_id, kind, name, config, created_at) VALUES ('dst_1', 'usr_reader', ?, 'Notes', ?, 0)").run(kind, JSON.stringify(config));
  api.sqlite.prepare("INSERT INTO collections (id, user_id, name, destination_id, created_at, updated_at) VALUES ('col_1', 'usr_reader', 'Reading', 'dst_1', 0, 0)").run();
  api.sqlite.prepare("INSERT INTO items (id, user_id, url, title, collection_id, created_at, updated_at) VALUES ('itm_1', 'usr_reader', 'https://example.com/a', 'A', 'col_1', 0, 0)").run();
  const highlight = (highlightId: string, position: number) =>
    api.sqlite.prepare("INSERT INTO highlights (id, user_id, item_id, quote, position, created_at, updated_at) VALUES (?, 'usr_reader', 'itm_1', ?, ?, 0, 0)").run(highlightId, `quote ${highlightId}`, position);
  const keep = (answerId: string, highlightId: string) =>
    api.sqlite.prepare("INSERT INTO highlight_answers (id, highlight_id, action, answer, created_at) VALUES (?, ?, 'explain', 'Because.', 0)").run(answerId, highlightId);
  const keepTldr = () => api.sqlite.prepare("INSERT INTO item_tldrs (id, item_id, text, created_at) VALUES ('tldr_1', 'itm_1', 'Short.', 0)").run();
  const pending = () => api.call<Pending>("GET", "/api/v1/destinations/dst_1/pending");
  const ack = (batch: Pending, error?: string) => api.call("POST", "/api/v1/destinations/dst_1/ack", { ...batch, error });
  return { ...api, highlight, keep, keepTldr, pending, ack };
}

test("an error ack for a highlight already delivered leaves it delivered", async () => {
  const { highlight, pending, ack } = apiWithDestination("obsidian");
  highlight("hl_1", 1);
  const batch = await pending();
  await ack(batch);
  await ack(batch, "Obsidian 500");
  assert.deepEqual((await pending()).highlightIds, []);
});

test("a sync that starts before the last one acked gets only what that one did not take", async () => {
  const { highlight, pending } = apiWithDestination("obsidian");
  highlight("hl_1", 1);
  assert.deepEqual((await pending()).highlightIds, ["hl_1"]);
  assert.deepEqual((await pending()).highlightIds, []);
  highlight("hl_2", 2);
  assert.deepEqual((await pending()).highlightIds, ["hl_2"]);
});

test("highlights taken by a sync that never acked are offered again a minute later", async (context) => {
  context.mock.timers.enable({ apis: ["Date"], now: 1_000_000 });
  const { highlight, pending } = apiWithDestination("obsidian");
  highlight("hl_1", 1);
  await pending();
  context.mock.timers.tick(61_000);
  assert.deepEqual((await pending()).highlightIds, ["hl_1"]);
});

test("an error ack offers the highlights again on the next sync", async () => {
  const { highlight, pending, ack } = apiWithDestination("obsidian");
  highlight("hl_1", 1);
  await ack(await pending(), "Obsidian 500");
  assert.deepEqual((await pending()).highlightIds, ["hl_1"]);
});

test("answers and the TL;DR go out once: with their highlight, then late answers on their own", async () => {
  const { highlight, keep, keepTldr, pending, ack } = apiWithDestination("obsidian");
  highlight("hl_1", 1);
  keep("ans_1", "hl_1");
  keepTldr();
  const first = await pending();
  assert.deepEqual([first.highlightIds, first.answerIds, first.tldrIds], [["hl_1"], ["ans_1"], ["tldr_1"]]);
  const overlapping = await pending();
  assert.deepEqual([overlapping.highlightIds, overlapping.answerIds, overlapping.tldrIds], [[], [], []]);
  await ack(first);
  keep("ans_2", "hl_1");
  const late = await pending();
  assert.deepEqual([late.highlightIds, late.answerIds, late.tldrIds], [["hl_1"], ["ans_2"], []]);
});

test("two pushes at once send each highlight to the webhook once", async (context) => {
  const { highlight, call } = apiWithDestination("webhook");
  highlight("hl_1", 1);
  const sent: string[][] = [];
  let release = () => {};
  const firstPushWaits = new Promise<void>((resolve) => { release = resolve; });
  context.mock.method(globalThis, "fetch", async (_url: string, init: { body: string }) => {
    const payload = JSON.parse(init.body) as { highlights: { id: string }[] };
    sent.push(payload.highlights.map((entry) => entry.id));
    if (sent.length === 1) await firstPushWaits;
    return new Response("ok");
  });
  const first = call("POST", "/api/v1/destinations/dst_1/push");
  await new Promise((resolve) => setTimeout(resolve, 20));
  const second = call("POST", "/api/v1/destinations/dst_1/push");
  await new Promise((resolve) => setTimeout(resolve, 20));
  release();
  await Promise.all([first, second]);
  assert.deepEqual(sent, [["hl_1"]]);
});
