import { test } from "node:test";
import assert from "node:assert/strict";
import { OpenStreams } from "../src/lib/streams.ts";

test("closing a card stops its stream and leaves another tab's stream with the same request id running", () => {
  const streams = new OpenStreams();
  const here = streams.start(1, 5);
  const otherTab = streams.start(2, 5);
  streams.cancel(1, 5);
  assert.equal(here.signal.aborted, true);
  assert.equal(otherTab.signal.aborted, false);
});

test("a finished stream is forgotten, so cancelling it later does nothing", () => {
  const streams = new OpenStreams();
  const stream = streams.start(1, 5);
  stream.finish();
  streams.cancel(1, 5);
  assert.equal(stream.signal.aborted, false);
  assert.equal(streams.size, 0);
});

test("a stream that finishes after a newer one took its id does not forget the newer one", () => {
  const streams = new OpenStreams();
  const old = streams.start(1, 5);
  const fresh = streams.start(1, 5);
  old.finish();
  streams.cancel(1, 5);
  assert.equal(fresh.signal.aborted, true);
});
