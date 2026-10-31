import { Hono } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import type { AppEnv } from "../env";
import { authorizeUrl, configured, exchange, type Provider } from "../lib/oauth";
import { createSession, destroySession } from "../lib/session";
import { id, now } from "../lib/util";
import { seedDemo } from "../lib/seed";

export const auth = new Hono<AppEnv>();

const safeNext = (n?: string | null) => (n && n.startsWith("/") && !n.startsWith("//") ? n : "/app");

auth.get("/providers", (c) =>
  c.json({ ...configured(c.env), demo: c.env.DEMO_ENABLED !== "false" }),
);

auth.get("/:provider/start", async (c) => {
  const provider = c.req.param("provider") as Provider;
  if (!["google", "github"].includes(provider)) return c.notFound();
  if (!configured(c.env)[provider]) return c.redirect(`/login?error=${provider}_not_configured`);
  const origin = new URL(c.req.url).origin;
  const { url, state, verifier } = await authorizeUrl(c.env, provider, `${origin}/auth/${provider}/callback`);
  const opts = { httpOnly: true, secure: origin.startsWith("https"), sameSite: "Lax" as const, path: "/auth", maxAge: 600 };
  setCookie(c, "lumen_oauth", JSON.stringify({ state, verifier, next: safeNext(c.req.query("next")) }), opts);
  return c.redirect(url);
});

auth.get("/:provider/callback", async (c) => {
  const provider = c.req.param("provider") as Provider;
  if (!["google", "github"].includes(provider) || !configured(c.env)[provider]) return c.notFound();
  const raw = getCookie(c, "lumen_oauth");
  deleteCookie(c, "lumen_oauth", { path: "/auth" });
  let saved: { state: string; verifier: string; next: string } | null = null;
  try { saved = raw ? JSON.parse(raw) : null; } catch { saved = null; }
  const code = c.req.query("code");
  if (!saved || !code || c.req.query("state") !== saved.state) return c.redirect("/login?error=state_mismatch");

  const origin = new URL(c.req.url).origin;
  let profile;
  try {
    profile = await exchange(c.env, provider, code, saved.verifier, `${origin}/auth/${provider}/callback`);
  } catch (e) {
    console.error("oauth exchange failed", e);
    return c.redirect("/login?error=exchange_failed");
  }

  const db = c.env.DB;
  const linked = await db.prepare("SELECT user_id FROM accounts WHERE provider = ? AND provider_account_id = ?")
    .bind(provider, profile.providerAccountId).first<{ user_id: string }>();
  let userId = linked?.user_id;
  if (!userId && profile.email && profile.emailVerified) {
    // Same verified email from another provider: link, do not duplicate.
    const byEmail = await db.prepare("SELECT id FROM users WHERE email = ? AND is_demo = 0").bind(profile.email).first<{ id: string }>();
    userId = byEmail?.id;
  }
  if (!userId) {
    userId = id("usr_");
    await db.prepare("INSERT INTO users (id, email, name, avatar_url, created_at) VALUES (?,?,?,?,?)")
      .bind(userId, profile.emailVerified ? profile.email : null, profile.name, profile.avatarUrl, now()).run();
    await db.prepare("INSERT INTO collections (id, user_id, name, emoji, color, description, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)")
      .bind(id("col_"), userId, "Reading list", "📚", "sun", "Everything worth a second look.", now(), now()).run();
  }
  if (!linked) {
    await db.prepare("INSERT OR IGNORE INTO accounts (provider, provider_account_id, user_id, created_at) VALUES (?,?,?,?)")
      .bind(provider, profile.providerAccountId, userId, now()).run();
  }
  await createSession(c, userId);
  return c.redirect(saved.next);
});

auth.post("/demo", async (c) => {
  if (c.env.DEMO_ENABLED === "false") return c.json({ error: { code: "demo_off", message: "Demo is disabled." } }, 403);
  const origin = c.req.header("origin");
  if (origin && origin !== new URL(c.req.url).origin) return c.json({ error: { code: "bad_origin", message: "No." } }, 403);
  const userId = await seedDemo(c.env.DB);
  await createSession(c, userId, 3);
  return c.json({ ok: true, next: "/app" });
});

auth.post("/logout", async (c) => {
  await destroySession(c);
  return c.json({ ok: true });
});
