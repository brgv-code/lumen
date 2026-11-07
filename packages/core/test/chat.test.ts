import { test } from "node:test";
import assert from "node:assert/strict";
import { endLive, patchLive, patchReply, startLive } from "../src/index.ts";

type Turn = { id?: string; role: "user" | "assistant"; content: string; streaming?: boolean };

const append = (chunk: string) => (turn: Turn): Turn => ({ ...turn, content: turn.content + chunk });

test("a reply still streaming after a newer question lands in its own turn", () => {
  const chat: Turn[] = [
    { role: "user", content: "first?" }, { id: "r1", role: "assistant", content: "", streaming: true },
    { role: "user", content: "second?" }, { id: "r2", role: "assistant", content: "", streaming: true },
  ];
  const next = patchReply(patchReply(chat, "r1", append("one")), "r2", append("two"));
  assert.deepEqual(next.map((turn) => turn.content), ["first?", "one", "second?", "two"]);
});

test("a reply arriving after New chat writes nowhere", () => {
  const newChat: Turn[] = [{ role: "user", content: "fresh?" }, { id: "r3", role: "assistant", content: "", streaming: true }];
  assert.deepEqual(patchReply(newChat, "r1", append("late")), newChat);
  assert.deepEqual(patchReply([], "r1", append("late")), []);
});

type Live = { answer: string };

test("follow ups streaming in two threads each stay in their own thread", () => {
  let live = startLive(startLive({}, "thread A", "a1", { answer: "" }), "thread B", "b1", { answer: "" });
  live = patchLive(live, "thread A", "a1", () => ({ answer: "about A" }));
  live = patchLive(live, "thread B", "b1", () => ({ answer: "about B" }));
  live = endLive(live, "thread A", "a1");
  assert.deepEqual(live, { "thread B": { requestId: "b1", answer: "about B" } });
});

test("an older follow up in the same thread cannot write over or clear the newer one", () => {
  let live = startLive<Live>({}, "thread A", "a1", { answer: "" });
  live = startLive(live, "thread A", "a2", { answer: "" });
  live = patchLive(live, "thread A", "a1", () => ({ answer: "late" }));
  live = endLive(live, "thread A", "a1");
  assert.deepEqual(live, { "thread A": { requestId: "a2", answer: "" } });
});
