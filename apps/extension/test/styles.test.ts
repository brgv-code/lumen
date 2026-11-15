import { test } from "node:test";
import assert from "node:assert/strict";
import { upgradeAskPrefs, type StyleListing } from "@lumen/core";
import { NO_STYLES, freshStyles, type StyleCache } from "../src/lib/styles.ts";

const listing = (pro: boolean): StyleListing => ({ styles: [{ key: "tpl_1", name: "Grandma", slug: "grandma", body: "x", builtin: false }], prefs: upgradeAskPrefs({ defaultStyle: "eli5" }), usage: {}, pro });

function memoryCache(start: StyleListing | null = null) {
  let stored = start;
  const cache: StyleCache = { read: async () => stored, write: async (next) => { stored = next; } };
  return { cache, stored: () => stored };
}

test("a fresh listing from Lumen replaces the cached one", async () => {
  const { cache, stored } = memoryCache(listing(false));
  assert.equal((await freshStyles(cache, async () => listing(true))).pro, true);
  assert.equal(stored()?.pro, true);
});

test("when Lumen can't be reached, the cached listing is used", async () => {
  const { cache } = memoryCache(listing(true));
  assert.deepEqual(await freshStyles(cache, async () => { throw new Error("offline"); }), listing(true));
});

test("with nothing cached and no connection, only the built ins remain, and the pills stay locked", async () => {
  const { cache } = memoryCache();
  assert.deepEqual(await freshStyles(cache, async () => { throw new Error("offline"); }), NO_STYLES);
  assert.equal(NO_STYLES.pro, false);
});
