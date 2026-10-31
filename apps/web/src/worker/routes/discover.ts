// Discovery and insight: radar, daily and weekly reads, reminders, readers like you, analytics.
import { Hono } from "hono";
import { addDays } from "@lumen/core";
import type { AppEnv } from "../env";
import { body, dayIn, fail, id, now, str } from "../lib/util";
import { toHighlight, toItem } from "../lib/map";
import { refreshRadar, topicsFor } from "../lib/radar";

export const discover = new Hono<AppEnv>();

const ITEM_COLS = `i.id, i.url, i.title, i.site_name, i.author, i.excerpt, i.cover_url, i.kind, i.status, i.progress, i.favorite,
  i.word_count, i.reading_minutes, i.collection_id, i.created_at, i.updated_at, i.finished_at,
  (SELECT group_concat(t.name) FROM item_tags it JOIN tags t ON t.id = it.tag_id WHERE it.item_id = i.id) AS tags,
  (SELECT count(*) FROM highlights h WHERE h.item_id = i.id) AS highlight_count`;

/* ---------------- radar ---------------- */

discover.get("/radar", async (c) => {
  const u = c.get("user");
  const refreshed = await refreshRadar(c.env.DB, u).catch(() => false);
  const topics = await topicsFor(c.env.DB, u.id);
  const { results } = await c.env.DB.prepare(`SELECT t.*, EXISTS (SELECT 1 FROM items i WHERE i.user_id = t.user_id AND i.url = t.url) AS saved
    FROM trends t WHERE t.user_id = ? AND t.dismissed = 0 ORDER BY t.score DESC LIMIT 60`).bind(u.id).all<Record<string, any>>();
  const last = await c.env.DB.prepare("SELECT ran_at FROM radar_runs WHERE user_id = ?").bind(u.id).first<{ ran_at: number }>();
  return c.json({
    topics,
    refreshed,
    lastRunAt: last?.ran_at ?? null,
    trends: results.map((r) => ({ id: r.id, topic: r.topic, url: r.url, title: r.title, source: r.source, score: r.score, comments: r.comments, publishedAt: r.published_at, saved: Boolean(r.saved) })),
  });
});

discover.post("/radar/refresh", async (c) => {
  await refreshRadar(c.env.DB, c.get("user"), true);
  return c.json({ ok: true });
});

discover.post("/topics", async (c) => {
  const u = c.get("user");
  const b = await body<{ name?: string }>(c);
  const name = str(b.name, 40)?.toLowerCase();
  if (!name) fail(422, "name_required", "Name a topic to watch.");
  await c.env.DB.prepare("INSERT OR IGNORE INTO topics (id, user_id, name, source, created_at) VALUES (?,?,?,?,?)").bind(id("top_"), u.id, name, "manual", now()).run();
  await refreshRadar(c.env.DB, u, true).catch(() => {});
  return c.json({ ok: true }, 201);
});

discover.delete("/topics/:name", async (c) => {
  const u = c.get("user");
  const name = decodeURIComponent(c.req.param("name"));
  // auto topics come from tags: muting stores a row so it stays hidden
  await c.env.DB.batch([
    c.env.DB.prepare("INSERT INTO topics (id, user_id, name, source, muted, created_at) VALUES (?,?,?,?,1,?) ON CONFLICT(user_id, name) DO UPDATE SET muted = 1").bind(id("top_"), u.id, name, "auto", now()),
    c.env.DB.prepare("UPDATE trends SET dismissed = 1 WHERE user_id = ? AND topic = ?").bind(u.id, name),
  ]);
  return c.json({ ok: true });
});

discover.post("/trends/:id/dismiss", async (c) => {
  await c.env.DB.prepare("UPDATE trends SET dismissed = 1 WHERE user_id = ? AND id = ?").bind(c.get("user").id, c.req.param("id")).run();
  return c.json({ ok: true });
});

/* ---------------- daily and weekly reads ---------------- */

discover.get("/reads", async (c) => {
  const u = c.get("user");
  const db = c.env.DB;
  const period = c.req.query("period") === "weekly" ? "weekly" : "daily";
  const budget = period === "daily" ? Math.max(10, Math.round(u.daily_goal * 1.2)) : 90; // minutes
  const today = dayIn(u.timezone);
  const seed = [...(today + period)].reduce((a, ch) => a + ch.charCodeAt(0), 0);

  // 1. finish what you started, 2. inbox that fits the time budget, oldest first with a daily shuffle
  const { results: reading } = await db.prepare(`SELECT ${ITEM_COLS} FROM items i WHERE i.user_id = ? AND i.status = 'reading' ORDER BY i.updated_at DESC LIMIT 3`).bind(u.id).all();
  const { results: inbox } = await db.prepare(`SELECT ${ITEM_COLS} FROM items i WHERE i.user_id = ? AND i.status = 'inbox' ORDER BY i.created_at ASC LIMIT 40`).bind(u.id).all();
  const shuffled = inbox.map((r, k) => ({ r, w: ((k + 1) * 9301 + seed * 49297) % 233280 })).sort((a, b) => a.w - b.w).map((x) => x.r);
  const picks: Record<string, unknown>[] = [];
  let minutes = 0;
  for (const r of [...reading, ...shuffled]) {
    const m = Number(r.reading_minutes) || 3;
    if (picks.length && minutes + m * (1 - Number(r.progress || 0)) > budget) continue;
    picks.push(r);
    minutes += Math.round(m * (1 - Number(r.progress || 0)));
    if (picks.length >= (period === "daily" ? 4 : 10)) break;
  }

  // resurface: older highlights you have not seen in a while (spaced repetition, light)
  const { results: resurface } = await db.prepare(`SELECT h.*, i.title AS item_title, i.url AS item_url, i.site_name AS item_site FROM highlights h JOIN items i ON i.id = h.item_id
    WHERE h.user_id = ? AND h.created_at < ? ORDER BY (h.rowid * 7 + ?) % 97 LIMIT ?`).bind(u.id, now() - 2 * 864e5, seed, period === "daily" ? 2 : 5).all();

  const { results: trending } = await db.prepare(`SELECT id, topic, url, title, source, score FROM trends WHERE user_id = ? AND dismissed = 0
    AND url NOT IN (SELECT url FROM items WHERE user_id = ?) ORDER BY score DESC LIMIT ?`).bind(u.id, u.id, period === "daily" ? 3 : 8).all();

  return c.json({ period, budgetMinutes: budget, minutes, picks: picks.map(toItem), resurface: resurface.map(toHighlight), trending, date: today });
});

/* ---------------- reminders ---------------- */

discover.get("/reminders", async (c) => {
  const u = c.get("user");
  if (!u.reminders) return c.json({ data: [] });
  const t = now();
  const { results } = await c.env.DB.prepare(`SELECT ${ITEM_COLS}, COALESCE(i.last_opened_at, i.updated_at) AS touched FROM items i
    WHERE i.user_id = ? AND i.status = 'reading' AND i.progress < 0.97 AND COALESCE(i.last_opened_at, i.updated_at) < ?
      AND (i.remind_after IS NULL OR i.remind_after < ?)
    ORDER BY i.progress DESC LIMIT 5`).bind(u.id, t - 20 * 3600_000, t).all();
  return c.json({
    data: results.map((r) => ({
      item: toItem(r),
      minutesLeft: Math.max(1, Math.round(Number(r.reading_minutes) * (1 - Number(r.progress)))),
      idleDays: Math.max(1, Math.round((t - Number(r.touched)) / 864e5)),
    })),
  });
});

discover.post("/items/:id/snooze", async (c) => {
  const b = await body<{ days?: number }>(c);
  const days = Math.min(30, Math.max(1, Number(b.days) || 2));
  const r = await c.env.DB.prepare("UPDATE items SET remind_after = ? WHERE user_id = ? AND id = ?").bind(now() + days * 864e5, c.get("user").id, c.req.param("id")).run();
  if (!r.meta.changes) fail(404, "not_found", "No such item.");
  return c.json({ ok: true, days });
});

/* ---------------- readers like you ---------------- */

/** Peers = readers who saved at least one of the same URLs and share anonymous signals.
 *  Only URLs saved by 2+ peers are shown (no single person can be identified). */
export function peerFilter(isDemo: number) {
  return isDemo ? "(u.is_demo = 0 OR u.is_demo = 2)" : "u.is_demo = 0";
}

discover.get("/similar", async (c) => {
  const u = c.get("user");
  if (!u.share_signals) return c.json({ data: [], optedOut: true });
  const { results } = await c.env.DB.prepare(`
    WITH mine AS (SELECT url FROM items WHERE user_id = ?1),
    peers AS (
      SELECT i.user_id, count(*) AS overlap FROM items i JOIN mine m ON m.url = i.url JOIN users u ON u.id = i.user_id
      WHERE i.user_id != ?1 AND u.share_signals = 1 AND ${peerFilter(u.is_demo)} GROUP BY i.user_id
    )
    SELECT i.url, max(i.title) AS title, max(i.site_name) AS site_name, max(i.excerpt) AS excerpt, max(i.reading_minutes) AS reading_minutes,
      count(DISTINCT i.user_id) AS readers, sum(p.overlap) AS affinity
    FROM items i JOIN peers p ON p.user_id = i.user_id
    WHERE i.url NOT IN (SELECT url FROM mine)
    GROUP BY i.url HAVING readers >= 2 ORDER BY affinity DESC, readers DESC LIMIT 6`).bind(u.id).all();
  return c.json({ data: results, optedOut: false });
});

/* ---------------- analytics ---------------- */

discover.get("/analytics", async (c) => {
  const u = c.get("user");
  const db = c.env.DB;
  const since = now() - 84 * 864e5;
  const [days, weeks, topics, sites, colors, totals, acts] = await db.batch([
    db.prepare("SELECT day, sum(glow) AS glow, count(*) AS actions FROM activity WHERE user_id = ? AND created_at > ? GROUP BY day").bind(u.id, since),
    db.prepare(`SELECT strftime('%Y-%W', finished_at / 1000, 'unixepoch') AS week, sum(reading_minutes) AS minutes, sum(word_count) AS words, count(*) AS items
      FROM items WHERE user_id = ? AND finished_at > ? GROUP BY week ORDER BY week`).bind(u.id, since),
    db.prepare(`SELECT t.name, count(DISTINCT it.item_id) AS items, (SELECT count(*) FROM highlights h JOIN item_tags x ON x.item_id = h.item_id WHERE x.tag_id = t.id) AS highlights
      FROM tags t JOIN item_tags it ON it.tag_id = t.id WHERE t.user_id = ? GROUP BY t.id ORDER BY items DESC LIMIT 8`).bind(u.id),
    db.prepare("SELECT COALESCE(site_name, 'unknown') AS site, count(*) AS items FROM items WHERE user_id = ? GROUP BY site ORDER BY items DESC LIMIT 6").bind(u.id),
    db.prepare("SELECT color, count(*) AS n FROM highlights WHERE user_id = ? GROUP BY color").bind(u.id),
    db.prepare(`SELECT count(*) AS saved, sum(status = 'done') AS done, sum(CASE WHEN status = 'done' THEN word_count ELSE 0 END) AS words,
      sum(CASE WHEN status = 'done' THEN reading_minutes ELSE 0 END) AS minutes FROM items WHERE user_id = ?`).bind(u.id),
    db.prepare("SELECT created_at FROM activity WHERE user_id = ? AND created_at > ?").bind(u.id, since),
  ]);
  const hours = Array.from({ length: 24 }, () => 0);
  const fmt = new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: safeTz(u.timezone) });
  for (const a of acts.results as { created_at: number }[]) hours[Number(fmt.format(new Date(a.created_at))) % 24]++;
  const t = totals.results[0] as { saved: number; done: number; words: number; minutes: number };
  const today = dayIn(u.timezone);
  const byDay = new Map((days.results as { day: string; glow: number }[]).map((d) => [d.day, d.glow]));
  return c.json({
    heatmap: Array.from({ length: 84 }, (_, k) => { const d = addDays(today, k - 83); return { day: d, glow: byDay.get(d) ?? 0 }; }),
    weeks: weeks.results,
    topics: topics.results,
    sites: sites.results,
    colors: colors.results,
    hours,
    totals: { saved: t.saved ?? 0, done: t.done ?? 0, words: t.words ?? 0, minutes: t.minutes ?? 0, completion: t.saved ? (t.done ?? 0) / t.saved : 0 },
  });
});

function safeTz(tz: string) { try { new Intl.DateTimeFormat("en", { timeZone: tz }); return tz; } catch { return "UTC"; } }

/* ---------------- save a trend into the library ---------------- */
discover.post("/trends/:id/save", async (c) => {
  const u = c.get("user");
  const tr = await c.env.DB.prepare("SELECT url, title FROM trends WHERE user_id = ? AND id = ?").bind(u.id, c.req.param("id")).first<{ url: string; title: string }>();
  if (!tr) fail(404, "not_found", "No such story.");
  // reuse the items endpoint so extraction and glow stay in one place
  const res = await c.get("selfFetch")("/api/v1/items", { method: "POST", body: JSON.stringify({ url: tr.url, title: tr.title }) });
  return new Response(res.body, res);
});

