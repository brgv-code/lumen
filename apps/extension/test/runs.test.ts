import { test } from "node:test";
import assert from "node:assert/strict";
import { rerunIfAsked, untilDone } from "../src/lib/runs.ts";

/** A task that waits until the test lets each run finish. */
function gatedTask() {
  const finishers: (() => void)[] = [];
  let runs = 0;
  const task = () => { runs++; return new Promise<void>((resolve) => finishers.push(resolve)); };
  const finishNext = async () => { finishers.shift()?.(); await new Promise((resolve) => setTimeout(resolve, 0)); };
  return { task, finishNext, runs: () => runs };
}

test("asking to rebuild while a rebuild runs gives exactly one more run, after it", async () => {
  const gate = gatedTask();
  const rebuild = rerunIfAsked(gate.task);
  const first = rebuild();
  const asked = [rebuild(), rebuild(), rebuild()];
  assert.equal(gate.runs(), 1);
  await gate.finishNext();
  assert.equal(gate.runs(), 2);
  await gate.finishNext();
  await Promise.all([first, ...asked]);
  assert.equal(gate.runs(), 2);
});

test("asking after a rebuild finished starts a fresh one", async () => {
  const gate = gatedTask();
  const rebuild = rerunIfAsked(gate.task);
  const first = rebuild();
  await gate.finishNext();
  await first;
  const second = rebuild();
  await gate.finishNext();
  await second;
  assert.equal(gate.runs(), 2);
});

test("two saves before the PDF sync finishes share one sync", async () => {
  let runs = 0;
  let finish = (_done: boolean) => {};
  const sync = untilDone(() => { runs++; return new Promise<boolean>((resolve) => { finish = resolve; }); });
  const both = Promise.all([sync(), sync()]);
  finish(true);
  assert.deepEqual(await both, [true, true]);
  assert.equal(runs, 1);
});

test("a PDF sync that failed or had nothing to work with yet runs again; one that finished never does", async () => {
  const outcomes: (boolean | Error)[] = [new Error("upload failed"), false, true];
  let runs = 0;
  const sync = untilDone(async () => {
    const outcome = outcomes[runs++];
    if (outcome instanceof Error) throw outcome;
    return outcome ?? true;
  });
  await assert.rejects(sync(), /upload failed/);
  assert.equal(await sync(), false);
  assert.equal(await sync(), true);
  assert.equal(await sync(), true);
  assert.equal(runs, 3);
});
