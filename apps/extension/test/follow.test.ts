import { test } from "node:test";
import assert from "node:assert/strict";
import { followOutcome } from "../src/lib/follow.ts";

const blog = { id: "feed_1", title: "Overreacted" };

test("a failed unfollow keeps the blog followed and says why", () => {
  assert.deepEqual(followOutcome(blog, { ok: false, error: "Lumen answered 500" }), { follow: blog, message: "Lumen answered 500" });
});

test("an unfollow that worked clears the follow", () => {
  assert.deepEqual(followOutcome(blog, { ok: true }), { follow: null, message: "Unfollowed" });
});

test("a follow that worked names the blog; one that found no feed stays unfollowed", () => {
  assert.deepEqual(followOutcome(null, { ok: true, feed: blog }), { follow: blog, message: "Following Overreacted. You'll hear when it publishes." });
  assert.deepEqual(followOutcome(null, { ok: false, error: "No feed found" }), { follow: null, message: "No feed found" });
});
