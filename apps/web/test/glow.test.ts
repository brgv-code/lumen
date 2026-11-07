import { test } from "node:test";
import assert from "node:assert/strict";
import { GLOW } from "@lumen/core";
import { signedInApi } from "./harness.ts";

function apiWithOneItem() {
  const api = signedInApi();
  api.sqlite.prepare("INSERT INTO items (id, user_id, url, title, created_at, updated_at) VALUES ('itm_1', 'usr_reader', 'https://example.com/a', 'A', 0, 0)").run();
  return api;
}

const glowToday = async (call: ReturnType<typeof signedInApi>["call"]) => (await call<{ glowToday: number }>("GET", "/api/v1/stats")).glowToday;

test("finishing an item again after reopening it gives no second finish glow", async () => {
  const { call } = apiWithOneItem();
  await call("PATCH", "/api/v1/items/itm_1", { status: "done" });
  await call("PATCH", "/api/v1/items/itm_1", { status: "reading" });
  await call("PATCH", "/api/v1/items/itm_1", { status: "done" });
  assert.equal(await glowToday(call), GLOW.finish);
});

test("two Mark as done requests at once give one finish glow", async () => {
  const { call } = apiWithOneItem();
  await Promise.all([call("PATCH", "/api/v1/items/itm_1", { status: "done" }), call("PATCH", "/api/v1/items/itm_1", { status: "done" })]);
  assert.equal(await glowToday(call), GLOW.finish);
});
