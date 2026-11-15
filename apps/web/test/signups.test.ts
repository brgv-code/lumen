import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { Hono } from "hono";
import type { AppEnv, SessionUser } from "../src/worker/env.ts";
import { auth } from "../src/worker/routes/auth.ts";
import { owner } from "../src/worker/routes/owner.ts";
import { READER, migratedDatabase, sqliteD1 } from "./harness.ts";

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

// GitHub answers as one person, so the callback runs without leaving the process.
function githubAnswersAs(accountId: number, email: string | null) {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith("/login/oauth/access_token")) return Response.json({ access_token: "tok" });
    if (url.endsWith("/user")) return Response.json({ id: accountId, login: "reader", name: "New Reader", created_at: "2015-01-01T00:00:00Z" });
    if (url.endsWith("/user/emails")) return Response.json(email ? [{ email, primary: true, verified: true }] : []);
    throw new Error(`unexpected fetch ${url}`);
  }) as typeof fetch;
}

const OWNER: SessionUser = { ...READER, id: "usr_owner", email: "owner@example.com" };

function lumen(vars: Record<string, string> = {}, signedIn: SessionUser = OWNER) {
  const sqlite = migratedDatabase();
  const app = new Hono<AppEnv>();
  app.route("/auth", auth);
  app.use("/api/v1/*", async (context, next) => { context.set("user", signedIn); context.set("via", "cookie"); await next(); });
  app.route("/api/v1/owner", owner);
  const env = { DB: sqliteD1(sqlite), GITHUB_CLIENT_ID: "id", GITHUB_CLIENT_SECRET: "secret", OWNER_EMAILS: OWNER.email!, ...vars };
  const executionContext = { waitUntil: () => {}, passThroughOnException: () => {}, props: {} };
  const send = (method: string, path: string, payload?: unknown, ip = "1.2.3.4") =>
    app.request(path, {
      method,
      headers: { "content-type": "application/json", "cf-connecting-ip": ip },
      body: payload === undefined ? undefined : JSON.stringify(payload),
    }, env, executionContext);
  const returnFromGithub = () => {
    const cookie = `lumen_oauth=${encodeURIComponent(JSON.stringify({ state: "st", verifier: "ver", next: "/app" }))}`;
    return app.request("/auth/github/callback?code=c&state=st", { headers: { cookie } }, env, executionContext);
  };
  const count = (table: string) => Number((sqlite.prepare(`SELECT count(*) AS n FROM ${table}`).get() as { n: number }).n);
  return { sqlite, send, returnFromGithub, count };
}

const PAUSED = { SIGNUPS_OPEN: "false" };

test("with signups paused, a new person who signs in goes onto the waitlist, not into an account", async () => {
  const { sqlite, returnFromGithub, count } = lumen(PAUSED);
  githubAnswersAs(42, "New.Reader@Example.com");
  const response = await returnFromGithub();
  assert.equal(response.headers.get("location"), "/login?waitlist=joined");
  assert.equal(count("users"), 0);
  assert.deepEqual({ ...sqlite.prepare("SELECT email, name, source FROM waitlist").get() }, { email: "New.Reader@Example.com", name: "New Reader", source: "github" });
});

test("with signups paused, a sign in without a verified email cannot join and is told why", async () => {
  const { returnFromGithub, count } = lumen(PAUSED);
  githubAnswersAs(42, null);
  const response = await returnFromGithub();
  assert.equal(response.headers.get("location"), "/login?error=waitlist_no_email");
  assert.equal(count("waitlist"), 0);
});

test("an approved person gets an account on their next sign in", async () => {
  const { sqlite, returnFromGithub, count } = lumen(PAUSED);
  sqlite.prepare("INSERT INTO waitlist (email_canonical, email, source, approved_at, created_at) VALUES ('new@example.com', 'new@example.com', 'form', 1, 0)").run();
  githubAnswersAs(42, "new@example.com");
  const response = await returnFromGithub();
  assert.equal(response.headers.get("location"), "/app");
  assert.equal(count("users"), 1);
});

test("with signups paused, a reader who already has an account still signs in", async () => {
  const { sqlite, returnFromGithub } = lumen(PAUSED);
  sqlite.prepare("INSERT INTO users (id, email, name, created_at) VALUES ('usr_old', 'old@example.com', 'Old', 0)").run();
  sqlite.prepare("INSERT INTO accounts (provider, provider_account_id, user_id, created_at) VALUES ('github', '7', 'usr_old', 0)").run();
  githubAnswersAs(7, "old@example.com");
  const response = await returnFromGithub();
  assert.equal(response.headers.get("location"), "/app");
  assert.match(response.headers.get("set-cookie") ?? "", /lumen_session=/);
});

test("with signups paused, an existing reader's verified email links a second provider", async () => {
  const { sqlite, returnFromGithub, count } = lumen(PAUSED);
  sqlite.prepare("INSERT INTO users (id, email, name, created_at) VALUES ('usr_old', 'old@example.com', 'Old', 0)").run();
  githubAnswersAs(8, "old@example.com");
  const response = await returnFromGithub();
  assert.equal(response.headers.get("location"), "/app");
  assert.equal(count("users"), 1);
});

test("with signups open (the default), a new person gets an account", async () => {
  const { returnFromGithub, count } = lumen();
  githubAnswersAs(42, "new@example.com");
  const response = await returnFromGithub();
  assert.equal(response.headers.get("location"), "/app");
  assert.equal(count("users"), 1);
});

test("the providers answer says whether signups are open", async () => {
  assert.equal((await (await lumen(PAUSED).send("GET", "/auth/providers")).json() as { signups: boolean }).signups, false);
  assert.equal((await (await lumen().send("GET", "/auth/providers")).json() as { signups: boolean }).signups, true);
});

test("the email form adds a person once, counting Gmail dots and +tags as the same inbox", async () => {
  const { send, sqlite } = lumen(PAUSED);
  assert.equal((await send("POST", "/auth/waitlist", { email: "jane.doe@gmail.com" })).status, 200);
  assert.equal((await send("POST", "/auth/waitlist", { email: "janedoe+lumen@gmail.com" })).status, 200);
  assert.deepEqual(sqlite.prepare("SELECT email, source FROM waitlist").all().map((row) => ({ ...row })), [{ email: "jane.doe@gmail.com", source: "form" }]);
});

test("the email form quietly drops a filled honeypot", async () => {
  const { send, count } = lumen(PAUSED);
  assert.equal((await send("POST", "/auth/waitlist", { email: "bot@example.com", website: "http://spam" })).status, 200);
  assert.equal(count("waitlist"), 0);
});

test("the email form refuses a malformed or disposable email", async () => {
  const { send, count } = lumen(PAUSED);
  assert.equal((await send("POST", "/auth/waitlist", { email: "not an email" })).status, 422);
  assert.equal((await send("POST", "/auth/waitlist", { email: "x@mailinator.com" })).status, 422);
  assert.equal(count("waitlist"), 0);
});

test("one network can add 10 people a day to the waitlist", async () => {
  const { send } = lumen(PAUSED);
  for (let entry = 0; entry < 10; entry++) assert.equal((await send("POST", "/auth/waitlist", { email: `p${entry}@example.com` })).status, 200);
  assert.equal((await send("POST", "/auth/waitlist", { email: "p10@example.com" })).status, 429);
  assert.equal((await send("POST", "/auth/waitlist", { email: "p10@example.com" }, "5.6.7.8")).status, 200);
});

test("the owner sees the waitlist, approves a person, and sees who already signed up", async () => {
  const { send, sqlite } = lumen(PAUSED);
  await send("POST", "/auth/waitlist", { email: "first@example.com" });
  await send("POST", "/auth/waitlist", { email: "second@example.com" });
  sqlite.prepare("INSERT INTO users (id, email, email_canonical, name, created_at) VALUES ('usr_2', 'second@example.com', 'second@example.com', 'Second', 0)").run();
  assert.equal((await send("POST", "/api/v1/owner/waitlist/approve", { email: "first@example.com" })).status, 200);
  const listing = await (await send("GET", "/api/v1/owner/waitlist")).json() as { entries: { email: string; status: string }[] };
  assert.deepEqual(listing.entries.map(({ email, status }) => ({ email, status })).sort((left, right) => left.email.localeCompare(right.email)), [
    { email: "first@example.com", status: "approved" },
    { email: "second@example.com", status: "joined" },
  ]);
  assert.equal((await send("POST", "/api/v1/owner/waitlist/approve", { email: "nobody@example.com" })).status, 404);
});

test("only the owner can see or approve the waitlist", async () => {
  const { send } = lumen(PAUSED, READER);
  assert.equal((await send("GET", "/api/v1/owner/waitlist")).status, 404);
  assert.equal((await send("POST", "/api/v1/owner/waitlist/approve", { email: "a@example.com" })).status, 404);
});
