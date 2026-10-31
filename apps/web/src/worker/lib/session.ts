import type { Context, Next } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import type { AppEnv, Env, SessionUser } from "../env";
import { id, now, randomToken, sha256, fail } from "./util";

export const SESSION_COOKIE = "lumen_session";
const SESSION_DAYS = 30;

export async function createSession(c: Context<AppEnv>, userId: string, days = SESSION_DAYS) {
  const token = randomToken();
  const expires = now() + days * 864e5;
  await c.env.DB.prepare("INSERT INTO sessions (id, user_id, expires_at, user_agent, created_at) VALUES (?,?,?,?,?)")
    .bind(await sha256(token), userId, expires, c.req.header("user-agent")?.slice(0, 200) ?? null, now())
    .run();
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: new URL(c.req.url).protocol === "https:",
    sameSite: "Lax",
    path: "/",
    expires: new Date(expires),
  });
}

export async function destroySession(c: Context<AppEnv>) {
  const token = getCookie(c, SESSION_COOKIE);
  if (token) await c.env.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(await sha256(token)).run();
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
}

async function userFromCookie(env: Env, token: string): Promise<SessionUser | null> {
  const row = await env.DB.prepare(
    "SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ? AND s.expires_at > ?",
  )
    .bind(await sha256(token), now())
    .first<SessionUser>();
  return row ?? null;
}

async function userFromToken(env: Env, token: string): Promise<SessionUser | null> {
  const hash = await sha256(token);
  const row = await env.DB.prepare("SELECT u.*, t.id AS token_id FROM api_tokens t JOIN users u ON u.id = t.user_id WHERE t.token_hash = ?")
    .bind(hash)
    .first<SessionUser & { token_id: string }>();
  if (!row) return null;
  await env.DB.prepare("UPDATE api_tokens SET last_used_at = ? WHERE id = ?").bind(now(), row.token_id).run();
  return row;
}

export async function userForBearer(env: Env, token: string) {
  return userFromToken(env, token) as Promise<(SessionUser & { token_id: string }) | null>;
}

/** Resolve the caller from a Bearer token (extension) or the session cookie (web). */
export async function requireUser(c: Context<AppEnv>, next: Next) {
  const auth = c.req.header("authorization");
  let user: SessionUser | null = null;
  if (auth?.startsWith("Bearer ")) {
    user = await userFromToken(c.env, auth.slice(7).trim());
    c.set("via", "token");
  } else {
    const token = getCookie(c, SESSION_COOKIE);
    if (token) user = await userFromCookie(c.env, token);
    c.set("via", "cookie");
    // CSRF: cookie authenticated writes must come from our own origin.
    if (user && !["GET", "HEAD", "OPTIONS"].includes(c.req.method)) {
      const origin = c.req.header("origin");
      const self = new URL(c.req.url).origin;
      if (origin && origin !== self) fail(403, "bad_origin", "Cross site request refused.");
      if (!origin && c.req.header("x-lumen") !== "1") fail(403, "csrf", "Missing X-Lumen header.");
    }
  }
  if (!user) fail(401, "unauthorized", "Sign in first.");
  c.set("user", user);
  await next();
}

export async function newApiToken(env: Env, userId: string, name: string, kind = "extension") {
  const raw = "lum_" + randomToken(24);
  const tokenId = id("tok_");
  await env.DB.prepare("INSERT INTO api_tokens (id, user_id, name, token_hash, prefix, kind, created_at) VALUES (?,?,?,?,?,?,?)")
    .bind(tokenId, userId, name, await sha256(raw), raw.slice(0, 8), kind, now())
    .run();
  return { id: tokenId, token: raw };
}
