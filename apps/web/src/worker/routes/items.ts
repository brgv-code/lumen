import { Hono } from "hono";
import { normalizeColor, ITEM_KINDS, ITEM_STATUSES, type ItemStatus } from "@lumen/core";
import type { AppEnv } from "../env";
import { body, decodeCursor, encodeCursor, fail, id, isHttpUrl, now, oneOf, str } from "../lib/util";
import { toHighlight, toItem } from "../lib/map";
import { extractFromHtml, extractFromUrl } from "../lib/extract";
import { glowStmt } from "../lib/glow";
import { peerFilter } from "./discover";

export const items = new Hono<AppEnv>();

const ITEM_SELECT = `SELECT i.id, i.url, i.title, i.site_name, i.author, i.excerpt, i.cover_url, i.kind, i.status, i.progress, i.favorite,
  i.word_count, i.reading_minutes, i.collection_id, i.created_at, i.updated_at, i.finished_at,
  (SELECT group_concat(t.name) FROM item_tags it JOIN tags t ON t.id = it.tag_id WHERE it.item_id = i.id) AS tags,
  (SELECT count(*) FROM highlights h WHERE h.item_id = i.id) AS highlight_count
  FROM items i`;

items.get("/", async (c) => {
  const u = c.get("user");
  const q = c.req.query();
  const where = ["i.user_id = ?"];
  const args: unknown[] = [u.id];
  const status = oneOf(q.status, ITEM_STATUSES);
  if (status) { where.push("i.status = ?"); args.push(status); }
  else if (q.status !== "all") { where.push("i.status != 'archived'"); }
  const kind = oneOf(q.kind, ITEM_KINDS);
  if (kind) { where.push("i.kind = ?"); args.push(kind); }
  if (q.collection) { where.push("i.collection_id = ?"); args.push(q.collection); }
  if (q.favorite === "1") where.push("i.favorite = 1");
  if (q.tag) { where.push("EXISTS (SELECT 1 FROM item_tags it JOIN tags t ON t.id = it.tag_id WHERE it.item_id = i.id AND t.name = ?)"); args.push(q.tag); }
  if (q.q) {
    where.push("(i.title LIKE ? OR i.excerpt LIKE ? OR i.site_name LIKE ? OR i.content_text LIKE ?)");
    const like = `%${q.q.slice(0, 100)}%`;
    args.push(like, like, like, like);
  }
  const cur = decodeCursor(q.cursor);
  if (cur) { where.push("(i.created_at < ? OR (i.created_at = ? AND i.id < ?))"); args.push(cur.createdAt, cur.createdAt, cur.id); }
  const limit = Math.min(100, Math.max(1, Number(q.limit) || 30));
  const { results } = await c.env.DB.prepare(`${ITEM_SELECT} WHERE ${where.join(" AND ")} ORDER BY i.created_at DESC, i.id DESC LIMIT ?`)
    .bind(...args, limit + 1).all();
  const rows = results.slice(0, limit);
  const next = results.length > limit ? encodeCursor(rows[rows.length - 1].created_at as number, rows[rows.length - 1].id as string) : null;
  return c.json({ data: rows.map(toItem), nextCursor: next });
});

items.get("/lookup", async (c) => {
  const u = c.get("user");
  const url = c.req.query("url");
  if (!url) fail(400, "missing_url", "Pass ?url=");
  const row = await c.env.DB.prepare(`${ITEM_SELECT} WHERE i.user_id = ? AND i.url = ?`).bind(u.id, normalizeUrl(url)).first();
  if (!row) return c.json({ item: null, highlights: [] });
  const { results } = await c.env.DB.prepare("SELECT * FROM highlights WHERE item_id = ? ORDER BY position").bind(row.id).all();
  return c.json({ item: toItem(row), highlights: results.map(toHighlight) });
});

items.post("/", async (c) => {
  const u = c.get("user");
  const b = await body<{ url?: string; html?: string; title?: string; collectionId?: string; tags?: string[]; status?: string; kind?: string }>(c);
  const raw = str(b.url, 4000);
  if (!raw || !isHttpUrl(raw)) fail(422, "bad_url", "A valid http(s) URL is required.");
  const url = normalizeUrl(raw);
  const db = c.env.DB;

  const existing = await db.prepare(`${ITEM_SELECT} WHERE i.user_id = ? AND i.url = ?`).bind(u.id, url).first();
  if (existing) return c.json({ item: toItem(existing), created: false });

  if (b.collectionId) await ownCollection(db, u.id, b.collectionId);

  let ex;
  try {
    ex = b.html ? extractFromHtml(b.html.slice(0, 3_000_000), url) : await extractFromUrl(url);
  } catch {
    const host = new URL(url).hostname;
    ex = { title: host, siteName: host, author: null, excerpt: null, contentHtml: null, contentText: null, coverUrl: null, wordCount: 0, readingMinutes: 1, kind: "bookmark" as const };
  }
  const kind = oneOf(b.kind, ITEM_KINDS) ?? ex.kind;
  const t = now();
  const itemId = id("itm_");
  const stmts = [
    db.prepare(`INSERT INTO items (id, user_id, url, title, site_name, author, excerpt, content_html, content_text, cover_url, kind, status, word_count, reading_minutes, collection_id, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(
      itemId, u.id, url, str(b.title, 300) ?? ex.title, ex.siteName, ex.author, ex.excerpt, ex.contentHtml, ex.contentText, ex.coverUrl, kind,
      oneOf(b.status, ITEM_STATUSES) ?? "inbox", ex.wordCount, ex.readingMinutes, b.collectionId ?? null, t, t,
    ),
    glowStmt(db, u, "save", itemId),
    ...(await tagStmts(db, u.id, itemId, b.tags)),
  ];
  await db.batch(stmts);
  const row = await db.prepare(`${ITEM_SELECT} WHERE i.id = ?`).bind(itemId).first();
  return c.json({ item: toItem(row!), created: true }, 201);
});

items.get("/:id", async (c) => {
  const u = c.get("user");
  const row = await c.env.DB.prepare(`${ITEM_SELECT.replace("FROM items i", ", i.content_html FROM items i")} WHERE i.user_id = ? AND i.id = ?`)
    .bind(u.id, c.req.param("id")).first();
  if (!row) fail(404, "not_found", "No such item.");
  const u2 = c.get("user");
  const [hl, peers] = await c.env.DB.batch([
    c.env.DB.prepare("SELECT * FROM highlights WHERE item_id = ? ORDER BY position").bind(row.id),
    c.env.DB.prepare(`SELECT count(DISTINCT i.user_id) AS n FROM items i JOIN users u ON u.id = i.user_id
      WHERE i.url = ? AND i.user_id != ? AND u.share_signals = 1 AND ${peerFilter(u2.is_demo)}`).bind(row.url, u2.id),
    c.env.DB.prepare("UPDATE items SET last_opened_at = ? WHERE id = ?").bind(now(), row.id),
  ]);
  const n = (peers.results[0] as { n: number }).n;
  return c.json({ item: { ...toItem(row), contentHtml: row.content_html ?? null }, highlights: hl.results.map((r) => toHighlight(r as Record<string, unknown>)), alsoSaving: n >= 2 ? n : 0 });
});

items.patch("/:id", async (c) => {
  const u = c.get("user");
  const db = c.env.DB;
  const row = await db.prepare("SELECT id, status FROM items WHERE user_id = ? AND id = ?").bind(u.id, c.req.param("id")).first<{ id: string; status: ItemStatus }>();
  if (!row) fail(404, "not_found", "No such item.");
  const b = await body<{ status?: string; progress?: number; favorite?: boolean; collectionId?: string | null; tags?: string[]; title?: string }>(c);
  const sets: string[] = [];
  const args: unknown[] = [];
  const stmts: D1PreparedStatement[] = [];
  const status = oneOf(b.status, ITEM_STATUSES);
  if (status) {
    sets.push("status = ?"); args.push(status);
    if (status === "done" && row.status !== "done") {
      sets.push("finished_at = ?", "progress = 1"); args.push(now());
      stmts.push(glowStmt(db, u, "finish", row.id));
    }
    if (status === "reading" && row.status === "inbox") { /* started */ }
  }
  if (typeof b.progress === "number" && !(status === "done")) { sets.push("progress = ?"); args.push(Math.min(1, Math.max(0, b.progress))); }
  if (typeof b.favorite === "boolean") { sets.push("favorite = ?"); args.push(b.favorite ? 1 : 0); }
  if (b.collectionId !== undefined) {
    if (b.collectionId) await ownCollection(db, u.id, b.collectionId);
    sets.push("collection_id = ?"); args.push(b.collectionId || null);
  }
  const title = str(b.title, 300);
  if (title) { sets.push("title = ?"); args.push(title); }
  if (sets.length) {
    sets.push("updated_at = ?"); args.push(now());
    stmts.unshift(db.prepare(`UPDATE items SET ${sets.join(", ")} WHERE id = ?`).bind(...args, row.id));
  }
  if (Array.isArray(b.tags)) {
    stmts.push(db.prepare("DELETE FROM item_tags WHERE item_id = ?").bind(row.id));
    stmts.push(...(await tagStmts(db, u.id, row.id, b.tags)));
  }
  if (stmts.length) await db.batch(stmts);
  const updated = await db.prepare(`${ITEM_SELECT} WHERE i.id = ?`).bind(row.id).first();
  return c.json({ item: toItem(updated!) });
});

items.delete("/:id", async (c) => {
  const u = c.get("user");
  const r = await c.env.DB.prepare("DELETE FROM items WHERE user_id = ? AND id = ?").bind(u.id, c.req.param("id")).run();
  if (!r.meta.changes) fail(404, "not_found", "No such item.");
  return c.json({ ok: true });
});

items.post("/:id/highlights", async (c) => {
  const u = c.get("user");
  const db = c.env.DB;
  const item = await db.prepare("SELECT id, status FROM items WHERE user_id = ? AND id = ?").bind(u.id, c.req.param("id")).first<{ id: string; status: string }>();
  if (!item) fail(404, "not_found", "No such item.");
  const b = await body<{ quote?: string; prefix?: string; suffix?: string; position?: number; color?: string; note?: string }>(c);
  const quote = typeof b.quote === "string" ? b.quote.slice(0, 5000) : "";
  if (!quote.trim()) fail(422, "empty_quote", "Highlight text is required.");
  const t = now();
  const hid = id("hl_");
  const note = str(b.note, 4000) ?? null;
  const stmts = [
    db.prepare("INSERT INTO highlights (id, user_id, item_id, quote, prefix, suffix, position, color, note, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)")
      .bind(hid, u.id, item.id, quote, String(b.prefix ?? "").slice(0, 64), String(b.suffix ?? "").slice(0, 64), Math.max(0, Number(b.position) || 0),
        normalizeColor(b.color) ?? "sun", note, t, t),
    glowStmt(db, u, "highlight", item.id),
    ...(note ? [glowStmt(db, u, "note", item.id)] : []),
    ...(item.status === "inbox" ? [db.prepare("UPDATE items SET status = 'reading', updated_at = ? WHERE id = ?").bind(t, item.id)] : []),
  ];
  await db.batch(stmts);
  const row = await db.prepare("SELECT * FROM highlights WHERE id = ?").bind(hid).first();
  return c.json({ highlight: toHighlight(row!) }, 201);
});

export function normalizeUrl(u: string): string {
  try {
    const x = new URL(u);
    x.hash = "";
    for (const p of [...x.searchParams.keys()]) if (/^(utm_|fbclid|gclid|mc_|ref$)/.test(p)) x.searchParams.delete(p);
    return x.toString();
  } catch {
    return u;
  }
}

async function ownCollection(db: D1Database, userId: string, collectionId: string) {
  const ok = await db.prepare("SELECT 1 FROM collections WHERE user_id = ? AND id = ?").bind(userId, collectionId).first();
  if (!ok) fail(404, "no_collection", "No such collection.");
}

async function tagStmts(db: D1Database, userId: string, itemId: string, tags?: unknown) {
  if (!Array.isArray(tags)) return [];
  const clean = [...new Set(tags.map((t) => String(t).trim().toLowerCase().replace(/^#/, "").slice(0, 40)).filter(Boolean))].slice(0, 20);
  const out: D1PreparedStatement[] = [];
  for (const name of clean) {
    out.push(db.prepare("INSERT OR IGNORE INTO tags (id, user_id, name) VALUES (?,?,?)").bind(id("tag_"), userId, name));
    out.push(db.prepare("INSERT OR IGNORE INTO item_tags (item_id, tag_id) SELECT ?, id FROM tags WHERE user_id = ? AND name = ?").bind(itemId, userId, name));
  }
  return out;
}
