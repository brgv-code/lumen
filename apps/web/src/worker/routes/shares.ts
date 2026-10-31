// Share cards: the client renders the card, the server keeps a snapshot plus the link preview image,
// and /s/:id serves a public page with Open Graph tags.
import { Hono } from "hono";
import type { AppEnv } from "../env";
import { body, fail, now, randomToken, str } from "../lib/util";

export const shares = new Hono<AppEnv>();

const KINDS = ["highlight", "progress", "collection"] as const;

shares.get("/", async (c) => {
  const { results } = await c.env.DB.prepare("SELECT id, kind, ref_id, title, views, created_at FROM shares WHERE user_id = ? ORDER BY created_at DESC LIMIT 50").bind(c.get("user").id).all();
  return c.json({ data: results });
});

shares.post("/", async (c) => {
  const u = c.get("user");
  const b = await body<{ kind?: string; refId?: string; title?: string; payload?: unknown; image?: string }>(c);
  const kind = KINDS.find((k) => k === b.kind);
  if (!kind) fail(422, "bad_kind", "kind must be highlight, progress or collection.");
  const payload = JSON.stringify(b.payload ?? {});
  if (payload.length > 60_000) fail(422, "too_big", "That is too much to share in one card.");
  // reuse the same public link when sharing the same thing again
  const existing = b.refId ? await c.env.DB.prepare("SELECT id FROM shares WHERE user_id = ? AND kind = ? AND ref_id = ?").bind(u.id, kind, b.refId).first<{ id: string }>() : null;
  const sid = existing?.id ?? randomToken(7).replace(/[-_]/g, "x").slice(0, 9);
  let image: Uint8Array | null = null;
  if (b.image) {
    const m = b.image.match(/^data:image\/(jpeg|png);base64,(.+)$/);
    if (!m) fail(422, "bad_image", "Image must be a JPEG or PNG data URL.");
    const bin = atob(m[2]);
    if (bin.length > 900_000) fail(422, "image_too_big", "Preview image is too large.");
    image = Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
  }
  const title = str(b.title, 200) ?? "Shared from Lumen";
  if (existing) {
    await c.env.DB.prepare("UPDATE shares SET title = ?, payload = ?, image = COALESCE(?, image) WHERE id = ?").bind(title, payload, image, sid).run();
  } else {
    await c.env.DB.prepare("INSERT INTO shares (id, user_id, kind, ref_id, title, payload, image, created_at) VALUES (?,?,?,?,?,?,?,?)")
      .bind(sid, u.id, kind, b.refId ?? null, title, payload, image, now()).run();
  }
  return c.json({ id: sid, url: `${new URL(c.req.url).origin}/s/${sid}` }, existing ? 200 : 201);
});

shares.delete("/:id", async (c) => {
  const r = await c.env.DB.prepare("DELETE FROM shares WHERE user_id = ? AND id = ?").bind(c.get("user").id, c.req.param("id")).run();
  if (!r.meta.changes) fail(404, "not_found", "No such share.");
  return c.json({ ok: true });
});
