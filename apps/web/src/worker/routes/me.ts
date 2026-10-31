import { Hono } from "hono";
import { addDays, levelFor, streaks } from "@lumen/core";
import type { AppEnv } from "../env";
import { body, dayIn, fail, now, oneOf, str } from "../lib/util";
import { toUser } from "../lib/map";
import { newApiToken, destroySession } from "../lib/session";

export const me = new Hono<AppEnv>();

me.get("/me", (c) => c.json({ user: toUser(c.get("user")), via: c.get("via") }));

me.patch("/me", async (c) => {
  const u = c.get("user");
  const b = await body<{ name?: string; dailyGoal?: number; timezone?: string; aiProvider?: string }>(c);
  const name = str(b.name, 80) ?? u.name;
  const goal = typeof b.dailyGoal === "number" ? Math.min(200, Math.max(5, Math.round(b.dailyGoal))) : u.daily_goal;
  let tz = u.timezone;
  if (b.timezone) { try { new Intl.DateTimeFormat("en", { timeZone: b.timezone }); tz = b.timezone; } catch { fail(422, "bad_tz", "Unknown time zone."); } }
  const provider = oneOf(b.aiProvider, ["lumen", "ollama", "openai", "claude"] as const) ?? u.ai_provider;
  await c.env.DB.prepare("UPDATE users SET name = ?, daily_goal = ?, timezone = ?, ai_provider = ? WHERE id = ?").bind(name, goal, tz, provider, u.id).run();
  const row = await c.env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(u.id).first();
  return c.json({ user: toUser(row as never) });
});

me.get("/stats", async (c) => {
  const u = c.get("user");
  const db = c.env.DB;
  const today = dayIn(u.timezone);
  const [days, total, week, counts] = await db.batch([
    db.prepare("SELECT DISTINCT day FROM activity WHERE user_id = ? ORDER BY day").bind(u.id),
    db.prepare("SELECT COALESCE(sum(glow),0) AS total FROM activity WHERE user_id = ?").bind(u.id),
    db.prepare("SELECT day, sum(glow) AS glow FROM activity WHERE user_id = ? AND day >= ? GROUP BY day").bind(u.id, addDays(today, -6)),
    db.prepare(`SELECT
      (SELECT count(*) FROM items WHERE user_id = ?1 AND status = 'inbox') AS inbox,
      (SELECT count(*) FROM items WHERE user_id = ?1 AND status = 'reading') AS reading,
      (SELECT count(*) FROM items WHERE user_id = ?1 AND status = 'done') AS done,
      (SELECT count(*) FROM highlights WHERE user_id = ?1) AS highlights,
      (SELECT count(*) FROM highlights WHERE user_id = ?1 AND note IS NOT NULL) AS notes`).bind(u.id),
  ]);
  const s = streaks((days.results as { day: string }[]).map((r) => r.day), today);
  const byDay = new Map((week.results as { day: string; glow: number }[]).map((r) => [r.day, r.glow]));
  const glowTotal = (total.results[0] as { total: number }).total;
  return c.json({
    streak: s.current,
    bestStreak: s.best,
    glowToday: byDay.get(today) ?? 0,
    dailyGoal: u.daily_goal,
    glowTotal,
    week: Array.from({ length: 7 }, (_, k) => { const d = addDays(today, k - 6); return { day: d, glow: byDay.get(d) ?? 0 }; }),
    counts: counts.results[0],
    level: levelFor(glowTotal),
  });
});

me.get("/tags", async (c) => {
  const { results } = await c.env.DB.prepare(`SELECT t.name, count(it.item_id) AS count FROM tags t LEFT JOIN item_tags it ON it.tag_id = t.id
    WHERE t.user_id = ? GROUP BY t.id ORDER BY count DESC, t.name`).bind(c.get("user").id).all();
  return c.json({ data: results });
});

me.get("/tokens", async (c) => {
  const { results } = await c.env.DB.prepare("SELECT id, name, prefix, last_used_at AS lastUsedAt, created_at AS createdAt FROM api_tokens WHERE user_id = ? ORDER BY created_at DESC").bind(c.get("user").id).all();
  return c.json({ data: results });
});

me.post("/tokens", async (c) => {
  if (c.get("via") !== "cookie") fail(403, "cookie_only", "Create tokens from the dashboard.");
  const b = await body<{ name?: string }>(c);
  const t = await newApiToken(c.env, c.get("user").id, str(b.name, 60) ?? "Lumen extension");
  return c.json({ ...t, note: "Shown once. Paste it into the extension settings." }, 201);
});

me.delete("/tokens/:id", async (c) => {
  const r = await c.env.DB.prepare("DELETE FROM api_tokens WHERE user_id = ? AND id = ?").bind(c.get("user").id, c.req.param("id")).run();
  if (!r.meta.changes) fail(404, "not_found", "No such token.");
  return c.json({ ok: true });
});

/** Everything, as JSON. Your data is yours. */
me.get("/export", async (c) => {
  const u = c.get("user");
  const db = c.env.DB;
  const q = (sql: string) => db.prepare(sql).bind(u.id);
  const [items, highlights, collections, ideas, tags] = await db.batch([
    q("SELECT id, url, title, site_name, author, excerpt, kind, status, progress, favorite, word_count, collection_id, created_at, finished_at FROM items WHERE user_id = ?"),
    q("SELECT id, item_id, quote, prefix, suffix, position, color, note, created_at FROM highlights WHERE user_id = ?"),
    q("SELECT id, name, emoji, color, description, created_at FROM collections WHERE user_id = ?"),
    q("SELECT id, title, angle, outline, status, created_at FROM ideas WHERE user_id = ?"),
    q("SELECT t.name, it.item_id FROM tags t JOIN item_tags it ON it.tag_id = t.id WHERE t.user_id = ?"),
  ]);
  return new Response(JSON.stringify({ exportedAt: new Date().toISOString(), user: toUser(u), items: items.results, highlights: highlights.results, collections: collections.results, ideas: ideas.results, tags: tags.results }, null, 2), {
    headers: { "content-type": "application/json", "content-disposition": `attachment; filename="lumen-export-${now()}.json"` },
  });
});

me.delete("/me", async (c) => {
  if (c.get("via") !== "cookie") fail(403, "cookie_only", "Delete your account from the dashboard.");
  await c.env.DB.prepare("DELETE FROM users WHERE id = ?").bind(c.get("user").id).run();
  await destroySession(c);
  return c.json({ ok: true });
});
