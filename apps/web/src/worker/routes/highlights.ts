import { Hono } from "hono";
import { HIGHLIGHT_COLORS } from "@lumen/core";
import type { AppEnv } from "../env";
import { body, decodeCursor, encodeCursor, fail, now, oneOf } from "../lib/util";
import { toHighlight } from "../lib/map";
import { glowStmt } from "../lib/glow";

export const highlights = new Hono<AppEnv>();

const SELECT = `SELECT h.*, i.title AS item_title, i.url AS item_url, i.site_name AS item_site
  FROM highlights h JOIN items i ON i.id = h.item_id`;

highlights.get("/", async (c) => {
  const u = c.get("user");
  const q = c.req.query();
  const where = ["h.user_id = ?"];
  const args: unknown[] = [u.id];
  const color = oneOf(q.color, HIGHLIGHT_COLORS);
  if (color) { where.push("h.color = ?"); args.push(color); }
  if (q.item) { where.push("h.item_id = ?"); args.push(q.item); }
  if (q.collection) { where.push("i.collection_id = ?"); args.push(q.collection); }
  if (q.notes === "1") where.push("h.note IS NOT NULL");
  if (q.q) { where.push("(h.quote LIKE ? OR h.note LIKE ? OR i.title LIKE ?)"); const l = `%${q.q.slice(0, 100)}%`; args.push(l, l, l); }
  const cur = decodeCursor(q.cursor);
  if (cur) { where.push("(h.created_at < ? OR (h.created_at = ? AND h.id < ?))"); args.push(cur.createdAt, cur.createdAt, cur.id); }
  const limit = Math.min(200, Math.max(1, Number(q.limit) || 50));
  const { results } = await c.env.DB.prepare(`${SELECT} WHERE ${where.join(" AND ")} ORDER BY h.created_at DESC, h.id DESC LIMIT ?`).bind(...args, limit + 1).all();
  const rows = results.slice(0, limit);
  const next = results.length > limit ? encodeCursor(rows[rows.length - 1].created_at as number, rows[rows.length - 1].id as string) : null;
  return c.json({ data: rows.map(toHighlight), nextCursor: next });
});

highlights.patch("/:id", async (c) => {
  const u = c.get("user");
  const db = c.env.DB;
  const row = await db.prepare("SELECT id, item_id, note FROM highlights WHERE user_id = ? AND id = ?").bind(u.id, c.req.param("id")).first<{ id: string; item_id: string; note: string | null }>();
  if (!row) fail(404, "not_found", "No such highlight.");
  const b = await body<{ color?: string; note?: string | null }>(c);
  const sets: string[] = [];
  const args: unknown[] = [];
  const stmts: D1PreparedStatement[] = [];
  const color = oneOf(b.color, HIGHLIGHT_COLORS);
  if (color) { sets.push("color = ?"); args.push(color); }
  if (b.note !== undefined) {
    const note = typeof b.note === "string" && b.note.trim() ? b.note.trim().slice(0, 4000) : null;
    sets.push("note = ?"); args.push(note);
    if (note && !row.note) stmts.push(glowStmt(db, u, "note", row.item_id));
  }
  if (!sets.length) fail(422, "nothing_to_update", "Pass color or note.");
  sets.push("updated_at = ?"); args.push(now());
  stmts.unshift(db.prepare(`UPDATE highlights SET ${sets.join(", ")} WHERE id = ?`).bind(...args, row.id));
  await db.batch(stmts);
  const updated = await db.prepare(`${SELECT} WHERE h.id = ?`).bind(row.id).first();
  return c.json({ highlight: toHighlight(updated!) });
});

highlights.delete("/:id", async (c) => {
  const u = c.get("user");
  const r = await c.env.DB.prepare("DELETE FROM highlights WHERE user_id = ? AND id = ?").bind(u.id, c.req.param("id")).run();
  if (!r.meta.changes) fail(404, "not_found", "No such highlight.");
  return c.json({ ok: true });
});
