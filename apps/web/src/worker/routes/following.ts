// Following: favourite blogs, their new posts, and what to notify about.
import { Hono } from "hono";
import type { AppEnv } from "../env";
import { body, fail, id, isHttpUrl, now, str } from "../lib/util";
import { discover, refreshFeed } from "../lib/feeds";
import { entitlement } from "../lib/plan";

export const following = new Hono<AppEnv>();
const FREE_LIMIT = 20;

type FeedRow = { id: string; user_id: string; site_url: string; feed_url: string; title: string; notify: number; last_checked_at: number | null; last_error: string | null; created_at: number; unseen?: number; latest?: number | null };
const toFeed = (f: FeedRow) => ({ id: f.id, title: f.title, siteUrl: f.site_url, feedUrl: f.feed_url, notify: Boolean(f.notify), unseen: f.unseen ?? 0, latestAt: f.latest ?? null, lastCheckedAt: f.last_checked_at, lastError: f.last_error, createdAt: f.created_at });

async function list(db: D1Database, userId: string) {
  const { results } = await db.prepare(`SELECT f.*, (SELECT count(*) FROM feed_items i WHERE i.feed_id = f.id AND i.seen = 0) AS unseen,
    (SELECT max(COALESCE(published_at, found_at)) FROM feed_items i WHERE i.feed_id = f.id) AS latest FROM feeds f WHERE f.user_id = ? ORDER BY latest DESC`).bind(userId).all<FeedRow>();
  return results;
}

following.get("/", async (c) => {
  const u = c.get("user");
  const rows = await list(c.env.DB, u.id);
  // keep it fresh without waiting: feeds not checked for 3 hours refresh in the background
  const stale = rows.filter((f) => !f.last_checked_at || now() - f.last_checked_at > 3 * 3600_000).slice(0, 6);
  if (stale.length) c.executionCtx.waitUntil(Promise.all(stale.map((f) => refreshFeed(c.env.DB, f, !f.last_checked_at))));
  return c.json({ feeds: rows.map(toFeed), unseenTotal: rows.reduce((n, f) => n + (f.unseen ?? 0), 0), refreshing: stale.length > 0 });
});

following.get("/lookup", async (c) => {
  const url = c.req.query("url") ?? "";
  let origin = "";
  try { origin = new URL(url).origin; } catch { fail(400, "bad_url", "Pass ?url="); }
  const f = await c.env.DB.prepare("SELECT * FROM feeds WHERE user_id = ? AND (site_url = ? OR feed_url LIKE ?) LIMIT 1").bind(c.get("user").id, origin, `${origin}%`).first<FeedRow>();
  return c.json({ feed: f ? toFeed(f) : null });
});

following.post("/", async (c) => {
  const u = c.get("user");
  const b = await body<{ url?: string }>(c);
  let raw = str(b.url, 2000) ?? "";
  if (raw && !/^https?:\/\//.test(raw)) raw = `https://${raw}`;
  if (!isHttpUrl(raw)) fail(422, "bad_url", "Paste a blog address or its RSS feed.");
  const count = await c.env.DB.prepare("SELECT count(*) AS n FROM feeds WHERE user_id = ?").bind(u.id).first<{ n: number }>();
  if (!entitlement(u).pro && (count?.n ?? 0) >= FREE_LIMIT) fail(402, "upgrade_required", `The free plan follows up to ${FREE_LIMIT} blogs. Pro follows as many as you like.`);
  let feed;
  try { feed = await discover(raw); } catch (e) { fail(422, "no_feed", (e as Error).message); }
  const existing = await c.env.DB.prepare("SELECT * FROM feeds WHERE user_id = ? AND feed_url = ?").bind(u.id, feed.feedUrl).first<FeedRow>();
  if (existing) return c.json({ feed: toFeed(existing), created: false });
  const fid = id("feed_");
  await c.env.DB.prepare("INSERT INTO feeds (id, user_id, site_url, feed_url, title, created_at) VALUES (?,?,?,?,?,?)").bind(fid, u.id, feed.siteUrl, feed.feedUrl, feed.title, now()).run();
  await refreshFeed(c.env.DB, { id: fid, user_id: u.id, feed_url: feed.feedUrl, site_url: feed.siteUrl }, true);
  const row = (await list(c.env.DB, u.id)).find((f) => f.id === fid)!;
  return c.json({ feed: toFeed(row), created: true }, 201);
});

following.patch("/:id", async (c) => {
  const b = await body<{ notify?: boolean; title?: string }>(c);
  const r = await c.env.DB.prepare("UPDATE feeds SET notify = COALESCE(?, notify), title = COALESCE(?, title) WHERE user_id = ? AND id = ?")
    .bind(typeof b.notify === "boolean" ? (b.notify ? 1 : 0) : null, str(b.title, 120) ?? null, c.get("user").id, c.req.param("id")).run();
  if (!r.meta.changes) fail(404, "not_found", "Not following that.");
  return c.json({ ok: true });
});

following.delete("/:id", async (c) => {
  const r = await c.env.DB.prepare("DELETE FROM feeds WHERE user_id = ? AND id = ?").bind(c.get("user").id, c.req.param("id")).run();
  if (!r.meta.changes) fail(404, "not_found", "Not following that.");
  return c.json({ ok: true });
});

following.get("/posts", async (c) => {
  const q = c.req.query();
  const where = ["i.user_id = ?"];
  const args: unknown[] = [c.get("user").id];
  if (q.unseen === "1") where.push("i.seen = 0");
  if (q.feed) { where.push("i.feed_id = ?"); args.push(q.feed); }
  const limit = Math.min(100, Math.max(1, Number(q.limit) || 40));
  const { results } = await c.env.DB.prepare(`SELECT i.*, f.title AS feed_title, f.site_url, EXISTS (SELECT 1 FROM items x WHERE x.user_id = i.user_id AND x.url = i.url) AS saved
    FROM feed_items i JOIN feeds f ON f.id = i.feed_id WHERE ${where.join(" AND ")} ORDER BY COALESCE(i.published_at, i.found_at) DESC LIMIT ?`).bind(...args, limit).all<Record<string, any>>();
  return c.json({ data: results.map((r) => ({ id: r.id, feedId: r.feed_id, feedTitle: r.feed_title, siteUrl: r.site_url, url: r.url, title: r.title, summary: r.summary, publishedAt: r.published_at ?? r.found_at, seen: Boolean(r.seen), saved: Boolean(r.saved) })) });
});

following.post("/posts/:id/seen", async (c) => {
  await c.env.DB.prepare("UPDATE feed_items SET seen = 1, notified = 1 WHERE user_id = ? AND id = ?").bind(c.get("user").id, c.req.param("id")).run();
  return c.json({ ok: true });
});

following.post("/seen", async (c) => {
  const b = await body<{ feedId?: string }>(c);
  await c.env.DB.prepare(`UPDATE feed_items SET seen = 1, notified = 1 WHERE user_id = ? ${b.feedId ? "AND feed_id = ?" : ""}`).bind(...[c.get("user").id, ...(b.feedId ? [b.feedId] : [])]).run();
  return c.json({ ok: true });
});

following.post("/refresh", async (c) => {
  const rows = await list(c.env.DB, c.get("user").id);
  let fresh = 0;
  for (const f of rows.slice(0, 25)) fresh += await refreshFeed(c.env.DB, f, !f.last_checked_at);
  return c.json({ new: fresh });
});

/** For notifications (extension, later email): new posts not announced yet. Marks them announced. */
following.post("/notify", async (c) => {
  const u = c.get("user");
  const { results } = await c.env.DB.prepare(`SELECT i.id, i.url, i.title, f.title AS feed_title FROM feed_items i JOIN feeds f ON f.id = i.feed_id
    WHERE i.user_id = ? AND i.notified = 0 AND i.seen = 0 AND f.notify = 1 ORDER BY COALESCE(i.published_at, i.found_at) DESC LIMIT 10`).bind(u.id).all<{ id: string; url: string; title: string; feed_title: string }>();
  if (results.length) await c.env.DB.batch(results.map((r) => c.env.DB.prepare("UPDATE feed_items SET notified = 1 WHERE id = ?").bind(r.id)));
  return c.json({ data: results.map((r) => ({ id: r.id, url: r.url, title: r.title, feedTitle: r.feed_title })) });
});
