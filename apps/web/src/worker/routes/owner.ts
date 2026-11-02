// Owner only: signups, activation and AI spend at a glance. Reads only; product analytics
// (funnels, retention, replays) live in PostHog.
import { Hono } from "hono";
import type { AppEnv, Env, SessionUser } from "../env";
import { fail, now } from "../lib/util";
import { entitlement } from "../lib/plan";
import { analyticsKey } from "../lib/analytics";

export const owner = new Hono<AppEnv>();

export function isOwner(env: Env, u: Pick<SessionUser, "email" | "is_demo">) {
  if (u.is_demo !== 0 || !u.email) return false;
  const list = (env.OWNER_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  return list.includes(u.email.toLowerCase());
}

owner.use("*", async (c, next) => {
  if (c.get("via") !== "cookie" || !isOwner(c.env, c.get("user"))) fail(404, "not_found", "Not found.");
  await next();
});

owner.get("/stats", async (c) => {
  const db = c.env.DB;
  const t = now(), D = 864e5;
  const [totals, signups, activeRows, ai, notes] = await db.batch([
    db.prepare(`SELECT
      SUM(is_demo = 0) AS users,
      SUM(is_demo = 0 AND created_at > ?1) AS today,
      SUM(is_demo = 0 AND created_at > ?2) AS week,
      SUM(is_demo = 0 AND created_at > ?3) AS month,
      SUM(is_demo = 0 AND plan = 'pro') AS paying,
      SUM(is_demo = 0 AND plan != 'pro' AND COALESCE(trial_ends_at, created_at + 7 * 86400000) > ?4) AS trialing,
      SUM(is_demo = 1 AND created_at > ?2) AS demos_week
      FROM users`).bind(t - D, t - 7 * D, t - 30 * D, t),
    db.prepare(`SELECT u.id, u.name, u.email, u.plan, u.created_at AS createdAt, u.trial_ends_at AS trialEndsAt, u.trial_note AS trialNote,
      (SELECT group_concat(provider) FROM accounts a WHERE a.user_id = u.id) AS providers,
      (SELECT count(*) FROM items i WHERE i.user_id = u.id) AS items,
      (SELECT count(*) FROM highlights h WHERE h.user_id = u.id) AS highlights,
      (SELECT COALESCE(SUM(count), 0) FROM ai_usage x WHERE x.user_id = u.id) AS ai,
      (SELECT count(*) FROM api_tokens k WHERE k.user_id = u.id AND k.kind = 'extension') AS extension,
      (SELECT count(*) FROM api_tokens k WHERE k.user_id = u.id AND k.kind = 'agent') AS agents,
      MAX(COALESCE((SELECT MAX(created_at) FROM highlights h WHERE h.user_id = u.id), 0),
          COALESCE((SELECT MAX(created_at) FROM items i WHERE i.user_id = u.id), 0),
          COALESCE((SELECT MAX(last_used_at) FROM api_tokens k WHERE k.user_id = u.id), 0)) AS lastActive
      FROM users u WHERE u.is_demo = 0 ORDER BY u.created_at DESC LIMIT 100`),
    db.prepare(`SELECT
      (SELECT count(DISTINCT user_id) FROM (SELECT user_id, created_at FROM highlights UNION ALL SELECT user_id, created_at FROM items) a JOIN users u ON u.id = a.user_id WHERE u.is_demo = 0 AND a.created_at > ?1) AS day,
      (SELECT count(DISTINCT user_id) FROM (SELECT user_id, created_at FROM highlights UNION ALL SELECT user_id, created_at FROM items) a JOIN users u ON u.id = a.user_id WHERE u.is_demo = 0 AND a.created_at > ?2) AS week`).bind(t - D, t - 7 * D),
    db.prepare("SELECT day, count FROM ai_global ORDER BY day DESC LIMIT 14"),
    db.prepare("SELECT COALESCE(trial_note, 'before guards') AS note, count(*) AS n FROM users WHERE is_demo = 0 GROUP BY 1 ORDER BY 2 DESC"),
  ]);
  const list = signups.results as Record<string, any>[];
  const real = list.length;
  const funnel = {
    signedUp: real,
    saved: list.filter((u) => u.items > 0).length,
    highlighted: list.filter((u) => u.highlights > 0).length,
    extension: list.filter((u) => u.extension > 0).length,
    returned: list.filter((u) => u.lastActive && u.lastActive - u.createdAt > 864e5).length,
  };
  return c.json({
    totals: totals.results[0],
    active: activeRows.results[0],
    funnel,
    ai: ai.results,
    aiSoftCap: Number(c.env.AI_SOFT_CAP || 60),
    trialNotes: notes.results,
    posthog: Boolean(analyticsKey(c.env)),
    signups: list.map((u) => ({ ...u, status: entitlement({ ...(u as any), plan: u.plan, trial_ends_at: u.trialEndsAt, created_at: u.createdAt }).status })),
  });
});
