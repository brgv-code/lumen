import { Hono } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import type { AppEnv } from "../env";
import { authorizeUrl, configured, exchange, type Provider } from "../lib/oauth";
import { createSession, destroySession } from "../lib/session";
import { body, fail, id, now, sha256, str } from "../lib/util";
import { seedDemo } from "../lib/seed";
import { SIGNUPS_PER_IP_PER_DAY, canonicalEmail, claimTrial, ensureDevice, ipHash, isDisposable, signupsFromIp, trialDecision } from "../lib/abuse";
import { WAITLIST_PER_IP_PER_DAY, isApproved, joinWaitlist, signupsOpen, waitlistFromIp } from "../lib/waitlist";
import { analyticsHost, analyticsKey, track } from "../lib/analytics";

export const auth = new Hono<AppEnv>();

const safeNext = (n?: string | null) => (n && n.startsWith("/") && !n.startsWith("//") ? n : "/app");
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

auth.get("/providers", (c) =>
  c.json({ ...configured(c.env), demo: c.env.DEMO_ENABLED !== "false", signups: signupsOpen(c.env), analytics: analyticsKey(c.env) ? { key: analyticsKey(c.env), host: analyticsHost(c.env) } : null }),
);

auth.get("/:provider/start", async (c) => {
  const provider = c.req.param("provider") as Provider;
  if (!["google", "github"].includes(provider)) return c.notFound();
  if (!configured(c.env)[provider]) return c.redirect(`/login?error=${provider}_not_configured`);
  ensureDevice(c);
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
  const isNew = !userId;
  if (!userId) {
    if (!signupsOpen(c.env)) {
      const verified = profile.emailVerified ? profile.email : null;
      if (!verified) return c.redirect("/login?error=waitlist_no_email");
      if (!(await isApproved(db, verified))) {
        await joinWaitlist(db, { email: verified, name: profile.name, source: provider, ip: await ipHash(c) });
        return c.redirect("/login?waitlist=joined");
      }
    }
    // abuse guards: a cap on new accounts per network, and one trial per person
    const ip = await ipHash(c);
    if ((await signupsFromIp(db, ip)) >= SIGNUPS_PER_IP_PER_DAY) return c.redirect("/login?error=signup_limit");
    const input = { email: profile.email, emailVerified: profile.emailVerified, deviceId: ensureDevice(c), ip, githubCreatedAt: profile.accountCreatedAt };
    const decision = await trialDecision(db, input);
    userId = id("usr_");
    const t = now();
    const email = profile.emailVerified ? profile.email : null;
    await db.prepare("INSERT INTO users (id, email, name, avatar_url, created_at, email_canonical, signup_ip_hash, trial_ends_at, trial_note) VALUES (?,?,?,?,?,?,?,?,?)")
      .bind(userId, email, profile.name, profile.avatarUrl, t, email ? canonicalEmail(email) : null, ip, decision.trial ? null : t, decision.note).run();
    await db.prepare("INSERT INTO collections (id, user_id, name, emoji, color, description, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?)")
      .bind(id("col_"), userId, "Reading list", "📚", "sun", "Everything worth a second look.", now(), now()).run();
    if (decision.trial) await claimTrial(db, userId, input);
    track(c.env, c.executionCtx, userId, "user_signed_up", { provider, trial: decision.trial, trial_note: decision.note, $set: { plan: "free", signup_provider: provider, is_demo: false }, $set_once: { signed_up_at: new Date(t).toISOString() } });
  }
  if (!linked) {
    await db.prepare("INSERT OR IGNORE INTO accounts (provider, provider_account_id, user_id, created_at) VALUES (?,?,?,?)")
      .bind(provider, profile.providerAccountId, userId, now()).run();
  }
  await createSession(c, userId);
  if (!isNew) track(c.env, c.executionCtx, userId, "user_logged_in", { provider });
  return c.redirect(saved.next);
});

auth.post("/waitlist", async (c) => {
  const origin = c.req.header("origin");
  if (origin && origin !== new URL(c.req.url).origin) fail(403, "bad_origin", "No.");
  const input = await body<{ email?: unknown; website?: unknown }>(c);
  // Bots fill every field; people never see this one.
  if (str(input.website)) return c.json({ ok: true });
  const email = str(input.email, 254);
  if (!email || !EMAIL.test(email)) fail(422, "bad_email", "That does not look like an email address.");
  if (isDisposable(email)) fail(422, "disposable_email", "Use an inbox you keep, so we can reach you when you are in.");
  const ip = await ipHash(c);
  if ((await waitlistFromIp(c.env.DB, ip)) >= WAITLIST_PER_IP_PER_DAY) fail(429, "waitlist_limit", "Too many sign ups from this network today. Try again tomorrow.");
  await joinWaitlist(c.env.DB, { email, name: null, source: "form", ip });
  return c.json({ ok: true });
});

auth.post("/demo", async (c) => {
  if (c.env.DEMO_ENABLED === "false") return c.json({ error: { code: "demo_off", message: "Demo is disabled." } }, 403);
  const origin = c.req.header("origin");
  if (origin && origin !== new URL(c.req.url).origin) return c.json({ error: { code: "bad_origin", message: "No." } }, 403);
  // abuse guard: at most 8 sandboxes per address per hour
  const ip = c.req.header("cf-connecting-ip") ?? "local";
  const ipHash = await sha256(ip + new Date().toISOString().slice(0, 10));
  const recent = await c.env.DB.prepare("SELECT count(*) AS n FROM demo_creations WHERE ip_hash = ? AND created_at > ?").bind(ipHash, now() - 3600_000).first<{ n: number }>();
  if ((recent?.n ?? 0) >= 8) return c.json({ error: { code: "demo_limit", message: "Too many demo sandboxes from here. Try again in an hour." } }, 429);
  await c.env.DB.prepare("INSERT INTO demo_creations (ip_hash, created_at) VALUES (?,?)").bind(ipHash, now()).run();
  const userId = await seedDemo(c.env.DB);
  await createSession(c, userId, 3);
  track(c.env, c.executionCtx, userId, "demo_started", { $set: { is_demo: true, plan: "free" } });
  return c.json({ ok: true, next: "/app" });
});

/** Persistent test account for building and testing (extension included).
 *  GET /auth/dev?key=<DEV_LOGIN_KEY>. Off unless the secret is set. */
auth.get("/dev", async (c) => {
  const secret = c.env.DEV_LOGIN_KEY;
  const key = c.req.query("key") ?? "";
  if (!secret || (await sha256(key)) !== (await sha256(secret))) return c.redirect("/login?error=dev_login");
  let u = await c.env.DB.prepare("SELECT id FROM users WHERE is_demo = 3 ORDER BY created_at LIMIT 1").first<{ id: string }>();
  if (!u) u = { id: await seedDemo(c.env.DB, { isDemo: 3, name: "Bhargav (test)" }) };
  await createSession(c, u.id, 30);
  return c.redirect(safeNext(c.req.query("next")));
});

auth.post("/logout", async (c) => {
  await destroySession(c);
  return c.json({ ok: true });
});
