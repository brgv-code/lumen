import { test } from "node:test";
import assert from "node:assert/strict";
import { READER, signedInApi } from "./harness.ts";

type Style = { key: string; name: string; slug: string; body: string; locked?: boolean };
type Listing = { styles: Style[]; prefs: { defaultStyle: string | null; order: string[]; hidden: string[] }; usage: Record<string, { count: number }>; pro: boolean };

const FREE = { ...READER, plan: "free", created_at: 0, trial_ends_at: 0 };

test("a Pro reader creates a style; its slug never shadows a slash command or a built in", async () => {
  const { call } = signedInApi();
  const grandma = await call<Style>("POST", "/api/v1/templates", { name: "Grandma", body: "Answer like my grandma would." });
  const quiz = await call<Style>("POST", "/api/v1/templates", { name: "Quiz", body: "x" });
  const tldr = await call<Style>("POST", "/api/v1/templates", { name: "tldr", body: "x" });
  assert.deepEqual([grandma.slug, quiz.slug, tldr.slug], ["grandma", "quiz-2", "tldr-2"]);
  const listing = await call<Listing>("GET", "/api/v1/templates");
  assert.deepEqual(listing.styles.map((style) => style.name), ["Grandma", "Quiz", "tldr"]);
  assert.equal(listing.pro, true);
});

test("a style without a name, or with a body over 1000 characters, is refused", async () => {
  const { send } = signedInApi();
  assert.equal((await send("POST", "/api/v1/templates", { name: "", body: "x" })).status, 422);
  assert.equal((await send("POST", "/api/v1/templates", { name: "Long", body: "x".repeat(1001) })).status, 422);
});

test("a reader can keep 30 styles", async () => {
  const { sqlite, send } = signedInApi();
  for (let count = 0; count < 30; count++) {
    sqlite.prepare("INSERT INTO ask_templates (id, user_id, name, slug, body, created_at, updated_at) VALUES (?, ?, ?, ?, 'x', ?, ?)").run(`tpl_${count}`, READER.id, `S${count}`, `s${count}`, count, count);
  }
  assert.equal((await send("POST", "/api/v1/templates", { name: "One more", body: "x" })).status, 409);
});

test("prefs keep only keys that exist; deleting a style drops it from the default and the order", async () => {
  const { call } = signedInApi();
  const grandma = await call<Style>("POST", "/api/v1/templates", { name: "Grandma", body: "x" });
  await call("PUT", "/api/v1/templates/prefs", { defaultStyle: grandma.key, order: [grandma.key, "quiz", "nope"], hidden: ["why", grandma.key] });
  let listing = await call<Listing>("GET", "/api/v1/templates");
  assert.deepEqual(listing.prefs, { version: 1, defaultStyle: grandma.key, order: [grandma.key, "quiz"], hidden: ["why"] });
  await call("DELETE", `/api/v1/templates/${grandma.key}`);
  listing = await call<Listing>("GET", "/api/v1/templates");
  assert.deepEqual(listing.prefs, { version: 1, defaultStyle: null, order: ["quiz"], hidden: ["why"] });
});

test("an unknown default is refused", async () => {
  const { send } = signedInApi();
  assert.equal((await send("PUT", "/api/v1/templates/prefs", { defaultStyle: "tpl_other" })).status, 422);
});

test("editing renames the style and its slug", async () => {
  const { call } = signedInApi();
  const style = await call<Style>("POST", "/api/v1/templates", { name: "Grandma", body: "x" });
  const edited = await call<Style>("PATCH", `/api/v1/templates/${style.key}`, { name: "Granny", body: "Answer warmly." });
  assert.deepEqual([edited.name, edited.slug, edited.body], ["Granny", "granny", "Answer warmly."]);
});

test("after the trial, styles are kept but locked, the default reads as Standard, and only delete still works", async () => {
  const { sqlite, send } = signedInApi(FREE);
  sqlite.prepare("INSERT INTO ask_templates (id, user_id, name, slug, body, created_at, updated_at) VALUES ('tpl_1', ?, 'Grandma', 'grandma', 'x', 0, 0)").run(READER.id);
  sqlite.prepare("UPDATE users SET ask_prefs = ? WHERE id = ?").run(JSON.stringify({ defaultStyle: "tpl_1" }), READER.id);
  const listing = (await (await send("GET", "/api/v1/templates")).json()) as Listing;
  assert.deepEqual([listing.pro, listing.styles[0]?.locked, listing.prefs.defaultStyle], [false, true, null]);
  assert.equal((await send("POST", "/api/v1/templates", { name: "New", body: "x" })).status, 402);
  assert.equal((await send("PATCH", "/api/v1/templates/tpl_1", { name: "New", body: "x" })).status, 402);
  assert.equal((await send("PUT", "/api/v1/templates/prefs", { defaultStyle: null })).status, 402);
  assert.equal((await send("DELETE", "/api/v1/templates/tpl_1")).status, 200);
  assert.equal(JSON.parse(String(sqlite.prepare("SELECT ask_prefs FROM users WHERE id = ?").get(READER.id)?.ask_prefs)).defaultStyle, null);
});

test("another reader's style can't be edited or deleted", async () => {
  const { sqlite, send } = signedInApi();
  sqlite.prepare("INSERT INTO users (id, name, created_at) VALUES ('usr_other', 'Other', 0)").run();
  sqlite.prepare("INSERT INTO ask_templates (id, user_id, name, slug, body, created_at, updated_at) VALUES ('tpl_x', 'usr_other', 'Theirs', 'theirs', 'x', 0, 0)").run();
  assert.equal((await send("PATCH", "/api/v1/templates/tpl_x", { name: "Mine", body: "x" })).status, 404);
  assert.equal((await send("DELETE", "/api/v1/templates/tpl_x")).status, 404);
});

test("a styled chat puts the style in the user turn, never the system prompt, and counts its use", async () => {
  const { call, aiCalls } = signedInApi();
  const style = await call<Style>("POST", "/api/v1/templates", { name: "Grandma", body: "Answer like my grandma would." });
  await call("POST", "/api/v1/ai/chat", { question: "What is TCP?", style: style.body, template: style.key, entry: "typed" }, "text");
  await call("POST", "/api/v1/ai/chat", { question: "And UDP?", style: "Answer briefly, then quiz me.", template: "quiz", entry: "pill" }, "text");
  await call("POST", "/api/v1/ai/chat", { question: "Plain?", template: "tpl_not_mine" }, "text");
  const [first] = aiCalls;
  const system = first?.messages.find((message) => message.role === "system")?.content ?? "";
  const user = first?.messages.at(-1)?.content ?? "";
  assert.doesNotMatch(system, /grandma/);
  assert.match(user, /ANSWER STYLE[\s\S]*Answer like my grandma would\.[\s\S]*QUESTION: What is TCP\?/);
  assert.doesNotMatch(aiCalls[2]?.messages.at(-1)?.content ?? "", /ANSWER STYLE/);
  const listing = await call<Listing>("GET", "/api/v1/templates");
  assert.deepEqual(Object.fromEntries(Object.entries(listing.usage).map(([key, use]) => [key, use.count])), { [style.key]: 1, quiz: 1 });
});

test("the export carries the reader's styles", async () => {
  const { call } = signedInApi();
  await call<Style>("POST", "/api/v1/templates", { name: "Grandma", body: "x" });
  const exported = await call<{ styles: { name: string }[] }>("GET", "/api/v1/export");
  assert.deepEqual(exported.styles.map((style) => style.name), ["Grandma"]);
});
