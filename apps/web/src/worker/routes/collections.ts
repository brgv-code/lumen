import { Hono } from "hono";
import { HIGHLIGHT_COLORS, formatSourceBlock } from "@lumen/core";
import type { AppEnv } from "../env";
import { body, fail, id, now, oneOf, str } from "../lib/util";
import { toCollection } from "../lib/map";

export const collections = new Hono<AppEnv>();

const SELECT = `SELECT c.*,
  (SELECT count(*) FROM items i WHERE i.collection_id = c.id) AS item_count,
  (SELECT count(*) FROM highlights h JOIN items i ON i.id = h.item_id WHERE i.collection_id = c.id) AS highlight_count
  FROM collections c`;

collections.get("/", async (c) => {
  const { results } = await c.env.DB.prepare(`${SELECT} WHERE c.user_id = ? ORDER BY c.updated_at DESC`).bind(c.get("user").id).all();
  return c.json({ data: results.map(toCollection) });
});

collections.post("/", async (c) => {
  const u = c.get("user");
  const b = await body<{ name?: string; emoji?: string; color?: string; description?: string; destinationId?: string }>(c);
  const name = str(b.name, 80);
  if (!name) fail(422, "name_required", "Give the collection a name.");
  if (b.destinationId) await ownDestination(c.env.DB, u.id, b.destinationId);
  const cid = id("col_");
  const t = now();
  await c.env.DB.prepare("INSERT INTO collections (id, user_id, name, emoji, color, description, destination_id, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)")
    .bind(cid, u.id, name, str(b.emoji, 8) ?? "📚", oneOf(b.color, HIGHLIGHT_COLORS) ?? "sun", str(b.description, 280) ?? null, b.destinationId ?? null, t, t).run();
  const row = await c.env.DB.prepare(`${SELECT} WHERE c.id = ?`).bind(cid).first();
  return c.json({ collection: toCollection(row!) }, 201);
});

collections.patch("/:id", async (c) => {
  const u = c.get("user");
  const b = await body<{ name?: string; emoji?: string; color?: string; description?: string | null; destinationId?: string | null }>(c);
  const sets: string[] = [];
  const args: unknown[] = [];
  const name = str(b.name, 80);
  if (name) { sets.push("name = ?"); args.push(name); }
  const emoji = str(b.emoji, 8);
  if (emoji) { sets.push("emoji = ?"); args.push(emoji); }
  const color = oneOf(b.color, HIGHLIGHT_COLORS);
  if (color) { sets.push("color = ?"); args.push(color); }
  if (b.description !== undefined) { sets.push("description = ?"); args.push(str(b.description, 280) ?? null); }
  if (b.destinationId !== undefined) {
    if (b.destinationId) await ownDestination(c.env.DB, u.id, b.destinationId);
    sets.push("destination_id = ?"); args.push(b.destinationId || null);
  }
  if (!sets.length) fail(422, "nothing_to_update", "Nothing to change.");
  sets.push("updated_at = ?"); args.push(now());
  const r = await c.env.DB.prepare(`UPDATE collections SET ${sets.join(", ")} WHERE user_id = ? AND id = ?`).bind(...args, u.id, c.req.param("id")).run();
  if (!r.meta.changes) fail(404, "not_found", "No such collection.");
  const row = await c.env.DB.prepare(`${SELECT} WHERE c.id = ?`).bind(c.req.param("id")).first();
  return c.json({ collection: toCollection(row!) });
});

collections.delete("/:id", async (c) => {
  const r = await c.env.DB.prepare("DELETE FROM collections WHERE user_id = ? AND id = ?").bind(c.get("user").id, c.req.param("id")).run();
  if (!r.meta.changes) fail(404, "not_found", "No such collection.");
  return c.json({ ok: true });
});

/** Whole collection as one markdown note: every source, every highlight. */
collections.get("/:id/export.md", async (c) => {
  const u = c.get("user");
  const col = await c.env.DB.prepare("SELECT * FROM collections WHERE user_id = ? AND id = ?").bind(u.id, c.req.param("id")).first<{ name: string; description: string | null }>();
  if (!col) fail(404, "not_found", "No such collection.");
  const format = oneOf(c.req.query("format"), ["house", "callout", "plain"] as const) ?? "plain";
  const { results } = await c.env.DB.prepare(`SELECT i.id, i.title, i.url, i.site_name, h.quote, h.note FROM items i
    LEFT JOIN highlights h ON h.item_id = i.id WHERE i.collection_id = ? ORDER BY i.created_at, h.position`).bind(c.req.param("id")).all<Record<string, string>>();
  const bySource = new Map<string, { title: string; url: string; siteName: string; hs: { quote: string; note: string | null; title: string; url: string }[] }>();
  for (const r of results) {
    if (!bySource.has(r.id)) bySource.set(r.id, { title: r.title, url: r.url, siteName: r.site_name, hs: [] });
    if (r.quote) bySource.get(r.id)!.hs.push({ quote: r.quote, note: r.note, title: r.title, url: r.url });
  }
  let md = `# ${col.name}\n${col.description ? `\n${col.description}\n` : ""}`;
  for (const s of bySource.values()) md += formatSourceBlock(s, s.hs, format);
  return new Response(md, {
    headers: { "content-type": "text/markdown; charset=utf-8", "content-disposition": `attachment; filename="${slug(col.name)}.md"` },
  });
});

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "collection";

async function ownDestination(db: D1Database, userId: string, destinationId: string) {
  const ok = await db.prepare("SELECT 1 FROM destinations WHERE user_id = ? AND id = ?").bind(userId, destinationId).first();
  if (!ok) fail(404, "no_destination", "No such destination.");
}
