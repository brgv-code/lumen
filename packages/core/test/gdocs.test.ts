import { test } from "node:test";
import assert from "node:assert/strict";
import { googleDocId, googleDocUrl, googleDocExportUrl, googleDocTitle } from "../src/index.ts";

const ID = "1bCDuq9H1ih9iNjgzyAL0gpwNFiEP4TZS-YLRp_RuMlc";

test("googleDocId reads the id from every way a doc link is shared", () => {
  for (const url of [
    `https://docs.google.com/document/d/${ID}/edit?tab=t.0`,
    `https://docs.google.com/document/d/${ID}/edit#heading=h.abc`,
    `https://docs.google.com/document/d/${ID}/view`,
    `https://docs.google.com/document/d/${ID}/preview`,
    `https://docs.google.com/document/d/${ID}/mobilebasic`,
    `https://docs.google.com/document/d/${ID}`,
    `https://docs.google.com/document/u/1/d/${ID}/edit?usp=sharing`,
  ]) assert.equal(googleDocId(url), ID, url);
});

test("googleDocId ignores what is not a doc it can export", () => {
  for (const url of [
    "https://docs.google.com/document/d/e/2PACX-1vQabcdefghijklmnopqrstuvwxyz/pub",
    `https://docs.google.com/spreadsheets/d/${ID}/edit`,
    `https://example.com/document/d/${ID}/edit`,
    "https://docs.google.com/document/",
    "not a url",
  ]) assert.equal(googleDocId(url), null, url);
});

test("googleDocUrl gives one address per doc, so every link variant is one item", () => {
  assert.equal(googleDocUrl(`https://docs.google.com/document/u/1/d/${ID}/view#x`), `https://docs.google.com/document/d/${ID}/edit`);
  assert.equal(googleDocUrl("https://example.com/a"), null);
});

test("googleDocExportUrl keeps the signed in account so a private doc exports", () => {
  assert.equal(googleDocExportUrl(`https://docs.google.com/document/d/${ID}/edit?tab=t.0`), `https://docs.google.com/document/d/${ID}/export?format=md`);
  assert.equal(googleDocExportUrl(`https://docs.google.com/document/u/2/d/${ID}/edit`), `https://docs.google.com/document/u/2/d/${ID}/export?format=md`);
  assert.equal(googleDocExportUrl("https://example.com/a"), null);
});

test("googleDocTitle reads the doc name from the export's download header", () => {
  const header = `attachment; filename="ChromeResourcePrioritiesandScheduling.md"; filename*=UTF-8''Chrome%20Resource%20Priorities%20and%20Scheduling.md`;
  assert.equal(googleDocTitle(header), "Chrome Resource Priorities and Scheduling");
  assert.equal(googleDocTitle(`attachment; filename="Notes.md"`), "Notes");
  assert.equal(googleDocTitle(null), null);
  assert.equal(googleDocTitle("attachment"), null);
});
