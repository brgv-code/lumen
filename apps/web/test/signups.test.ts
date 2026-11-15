import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { Hono } from "hono";
import type { AppEnv } from "../src/worker/env.ts";
import { auth } from "../src/worker/routes/auth.ts";
import { migratedDatabase, sqliteD1 } from "./harness.ts";

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

// GitHub answers as one person, so the callback runs without leaving the process.
function githubAnswersAs(accountId: number, email: string) {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.endsWith("/login/oauth/access_token")) return Response.json({ access_token: "tok" });
    if (url.endsWith("/user")) return Response.json({ id: accountId, login: "reader", created_at: "2015-01-01T00:00:00Z" });
    if (url.endsWith("/user/emails")) return Response.json([{ email, primary: true, verified: true }]);
    throw new Error(`unexpected fetch ${url}`);
  }) as typeof fetch;
}

function callbackApi(vars: Record<string, string> = {}) {
  const sqlite = migratedDatabase();
  const app = new Hono<AppEnv>();
  app.route("/auth", auth);
  const env = { DB: sqliteD1(sqlite), GITHUB_CLIENT_ID: "id", GITHUB_CLIENT_SECRET: "secret", ...vars };
  const executionContext = { waitUntil: () => {}, passThroughOnException: () => {}, props: {} };
  const returnFromGithub = () => {
    const cookie = `lumen_oauth=${encodeURIComponent(JSON.stringify({ state: "st", verifier: "ver", next: "/app" }))}`;
    return app.request("/auth/github/callback?code=c&state=st", { headers: { cookie } }, env, executionContext);
  };
  const userCount = () => Number((sqlite.prepare("SELECT count(*) AS n FROM users").get() as { n: number }).n);
  return { sqlite, returnFromGithub, userCount };
}

test("with signups paused, a new person is sent back to login and gets no account", async () => {
  const { returnFromGithub, userCount } = callbackApi({ SIGNUPS_OPEN: "false" });
  githubAnswersAs(42, "new@example.com");
  const response = await returnFromGithub();
  assert.equal(response.status, 302);
  assert.equal(response.headers.get("location"), "/login?error=signups_paused");
  assert.equal(userCount(), 0);
});

test("with signups paused, a reader who already has an account still signs in", async () => {
  const { sqlite, returnFromGithub } = callbackApi({ SIGNUPS_OPEN: "false" });
  sqlite.prepare("INSERT INTO users (id, email, name, created_at) VALUES ('usr_old', 'old@example.com', 'Old', 0)").run();
  sqlite.prepare("INSERT INTO accounts (provider, provider_account_id, user_id, created_at) VALUES ('github', '7', 'usr_old', 0)").run();
  githubAnswersAs(7, "old@example.com");
  const response = await returnFromGithub();
  assert.equal(response.headers.get("location"), "/app");
  assert.match(response.headers.get("set-cookie") ?? "", /lumen_session=/);
});

test("with signups paused, an existing reader's verified email links a second provider", async () => {
  const { sqlite, returnFromGithub, userCount } = callbackApi({ SIGNUPS_OPEN: "false" });
  sqlite.prepare("INSERT INTO users (id, email, name, created_at) VALUES ('usr_old', 'old@example.com', 'Old', 0)").run();
  githubAnswersAs(8, "old@example.com");
  const response = await returnFromGithub();
  assert.equal(response.headers.get("location"), "/app");
  assert.equal(userCount(), 1);
});

test("with signups open (the default), a new person gets an account", async () => {
  const { returnFromGithub, userCount } = callbackApi();
  githubAnswersAs(42, "new@example.com");
  const response = await returnFromGithub();
  assert.equal(response.headers.get("location"), "/app");
  assert.equal(userCount(), 1);
});
