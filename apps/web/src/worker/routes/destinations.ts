// Destinations + the delivery ledger.
//
// Obsidian and Markdown are delivered by the client (extension or browser), because
// the vault lives on the reader's machine: the client asks for /pending, writes the
// rendered markdown, then calls /ack. Notion and webhooks are pushed by the server
// with /push. Either way the (highlight, destination) ledger guarantees a highlight
// is written once, so clipping a page again never duplicates.
import { Hono } from "hono";
import { DESTINATION_KINDS, formatHighlight, formatSourceBlock, textFragmentUrl, type HighlightFormat } from "@lumen/core";
import type { AppEnv } from "../env";
import { body, fail, id, isHttpUrl, now, oneOf, str } from "../lib/util";
import { safeJson, toDestination } from "../lib/map";

export const destinations = new Hono<AppEnv>();

const SELECT = `SELECT d.*,
  (SELECT count(*) FROM deliveries x WHERE x.destination_id = d.id AND x.status = 'delivered') AS delivered_count,
  (SELECT max(delivered_at) FROM deliveries x WHERE x.destination_id = d.id) AS last_delivered_at,
  (SELECT count(*) FROM highlights h JOIN items i ON i.id = h.item_id JOIN collections c ON c.id = i.collection_id
     WHERE c.destination_id = d.id AND NOT EXISTS (SELECT 1 FROM deliveries x WHERE x.highlight_id = h.id AND x.destination_id = d.id AND x.status = 'delivered')) AS pending_count
  FROM destinations d`;

const FORMATS = ["house", "callout", "plain"] as const;

function cleanConfig(kind: string, raw: Record<string, unknown>) {
  switch (kind) {
    case "obsidian": {
      const baseUrl = str(raw.baseUrl, 200) ?? "https://127.0.0.1:27124";
      const notePath = str(raw.notePath, 300);
      if (!notePath) fail(422, "note_path", "Which note should highlights go to?");
      // the Local REST API key never reaches the server: it stays in the browser/extension
      return { baseUrl, notePath: notePath.replace(/^\/+/, ""), format: oneOf(raw.format, FORMATS) ?? "house" };
    }
    case "notion": {
      const pageId = str(raw.pageId, 100)?.replace(/.*([0-9a-f]{32})$/i, "$1");
      if (!pageId) fail(422, "page_id", "Paste the Notion page link or id.");
      return { pageId };
    }
    case "markdown":
      return { fileName: str(raw.fileName, 120) ?? "lumen-highlights.md", format: oneOf(raw.format, FORMATS) ?? "plain" };
    case "webhook": {
      const url = str(raw.url, 1000);
      if (!url || !isHttpUrl(url) || !url.startsWith("https://")) fail(422, "webhook_url", "Webhook URL must be https.");
      return { url };
    }
  }
  fail(422, "bad_kind", "Unknown destination kind.");
}

destinations.get("/", async (c) => {
  const { results } = await c.env.DB.prepare(`${SELECT} WHERE d.user_id = ? ORDER BY d.created_at`).bind(c.get("user").id).all();
  return c.json({ data: results.map(toDestination) });
});

destinations.post("/", async (c) => {
  const u = c.get("user");
  const b = await body<{ kind?: string; name?: string; config?: Record<string, unknown>; secret?: string }>(c);
  const kind = oneOf(b.kind, DESTINATION_KINDS);
  if (!kind) fail(422, "bad_kind", "kind must be obsidian, notion, markdown or webhook.");
  const config = cleanConfig(kind, b.config ?? {});
  const did = id("dst_");
  await c.env.DB.prepare("INSERT INTO destinations (id, user_id, kind, name, config, secret, created_at) VALUES (?,?,?,?,?,?,?)")
    .bind(did, u.id, kind, str(b.name, 80) ?? kind, JSON.stringify(config), str(b.secret, 500) ?? null, now()).run();
  const row = await c.env.DB.prepare(`${SELECT} WHERE d.id = ?`).bind(did).first();
  return c.json({ destination: toDestination(row!) }, 201);
});

destinations.patch("/:id", async (c) => {
  const u = c.get("user");
  const row = await own(c.env.DB, u.id, c.req.param("id"));
  const b = await body<{ name?: string; config?: Record<string, unknown>; secret?: string }>(c);
  const config = b.config ? cleanConfig(row.kind, { ...safeJson(row.config, {}), ...b.config }) : safeJson(row.config, {});
  await c.env.DB.prepare("UPDATE destinations SET name = ?, config = ?, secret = COALESCE(?, secret) WHERE id = ?")
    .bind(str(b.name, 80) ?? row.name, JSON.stringify(config), str(b.secret, 500) ?? null, row.id).run();
  const updated = await c.env.DB.prepare(`${SELECT} WHERE d.id = ?`).bind(row.id).first();
  return c.json({ destination: toDestination(updated!) });
});

destinations.delete("/:id", async (c) => {
  const r = await c.env.DB.prepare("DELETE FROM destinations WHERE user_id = ? AND id = ?").bind(c.get("user").id, c.req.param("id")).run();
  if (!r.meta.changes) fail(404, "not_found", "No such destination.");
  return c.json({ ok: true });
});

/** Highlights not yet delivered to this destination, grouped by source and rendered. */
destinations.get("/:id/pending", async (c) => {
  const u = c.get("user");
  const d = await own(c.env.DB, u.id, c.req.param("id"));
  const cfg = safeJson<Record<string, string>>(d.config, {});
  const format = (cfg.format as HighlightFormat) || "plain";
  const pending = await pendingFor(c.env.DB, d.id);
  const groups = groupBySource(pending);
  const markdown = groups.map((g) => formatSourceBlock(g.source, g.highlights, format)).join("");
  return c.json({
    destination: toDestination(d),
    highlightIds: pending.map((p) => p.id),
    markdown,
    groups: groups.map((g) => ({ source: g.source, highlights: g.highlights.map((h) => ({ id: h.id, quote: h.quote, note: h.note, markdown: formatHighlight(h, format) })) })),
  });
});

/** Client confirms it wrote these highlights. Idempotent. */
destinations.post("/:id/ack", async (c) => {
  const u = c.get("user");
  const d = await own(c.env.DB, u.id, c.req.param("id"));
  const b = await body<{ highlightIds?: string[]; error?: string }>(c);
  const ids = (b.highlightIds ?? []).filter((x) => typeof x === "string").slice(0, 500);
  if (!ids.length) return c.json({ acked: 0 });
  const status = b.error ? "failed" : "delivered";
  const t = now();
  await c.env.DB.batch(ids.map((hid) =>
    c.env.DB.prepare(`INSERT INTO deliveries (highlight_id, destination_id, status, attempts, error, delivered_at)
      SELECT h.id, ?, ?, 1, ?, ? FROM highlights h WHERE h.id = ? AND h.user_id = ?
      ON CONFLICT(highlight_id, destination_id) DO UPDATE SET status = excluded.status, attempts = attempts + 1, error = excluded.error, delivered_at = excluded.delivered_at`)
      .bind(d.id, status, b.error ?? null, t, hid, u.id)));
  return c.json({ acked: ids.length, status });
});

/** Server side delivery for Notion and webhooks. */
destinations.post("/:id/push", async (c) => {
  const u = c.get("user");
  const d = await own(c.env.DB, u.id, c.req.param("id"));
  if (d.kind !== "notion" && d.kind !== "webhook") fail(422, "client_delivered", `${d.kind} is delivered by the extension or the browser. Use /pending and /ack.`);
  if (u.is_demo) fail(403, "demo", "Pushing to external services is off in the demo.");
  const pending = await pendingFor(c.env.DB, d.id);
  if (!pending.length) return c.json({ delivered: 0 });
  const cfg = safeJson<Record<string, string>>(d.config, {});
  let error: string | null = null;
  try {
    if (d.kind === "notion") await pushNotion(cfg.pageId, d.secret, pending);
    else await pushWebhook(cfg.url, d.secret, pending);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }
  const t = now();
  await c.env.DB.batch(pending.map((p) => c.env.DB.prepare(`INSERT INTO deliveries (highlight_id, destination_id, status, attempts, error, delivered_at) VALUES (?,?,?,1,?,?)
    ON CONFLICT(highlight_id, destination_id) DO UPDATE SET status = excluded.status, attempts = attempts + 1, error = excluded.error, delivered_at = excluded.delivered_at`)
    .bind(p.id, d.id, error ? "failed" : "delivered", error, t)));
  if (error) fail(502, "push_failed", error);
  return c.json({ delivered: pending.length });
});

interface PendingRow { id: string; quote: string; note: string | null; title: string; url: string; site_name: string | null; item_id: string }

async function pendingFor(db: D1Database, destinationId: string): Promise<PendingRow[]> {
  const { results } = await db.prepare(`SELECT h.id, h.quote, h.note, i.title, i.url, i.site_name, i.id AS item_id
    FROM highlights h JOIN items i ON i.id = h.item_id JOIN collections c ON c.id = i.collection_id
    WHERE c.destination_id = ? AND NOT EXISTS (SELECT 1 FROM deliveries x WHERE x.highlight_id = h.id AND x.destination_id = ? AND x.status = 'delivered')
    ORDER BY i.created_at, h.position LIMIT 500`).bind(destinationId, destinationId).all<PendingRow>();
  return results;
}

function groupBySource(rows: PendingRow[]) {
  const map = new Map<string, { source: { title: string; url: string; siteName: string | null }; highlights: (PendingRow & { title: string; url: string })[] }>();
  for (const r of rows) {
    if (!map.has(r.item_id)) map.set(r.item_id, { source: { title: r.title, url: r.url, siteName: r.site_name }, highlights: [] });
    map.get(r.item_id)!.highlights.push(r);
  }
  return [...map.values()];
}

async function own(db: D1Database, userId: string, destinationId: string) {
  const row = await db.prepare("SELECT d.*, 0 AS pending_count FROM destinations d WHERE d.user_id = ? AND d.id = ?").bind(userId, destinationId)
    .first<{ id: string; kind: string; name: string; config: string; secret: string | null; created_at: number }>();
  if (!row) fail(404, "not_found", "No such destination.");
  return row;
}

async function pushNotion(pageId: string, token: string | null, rows: PendingRow[]) {
  if (!token) throw new Error("Add a Notion integration token first.");
  const children = rows.flatMap((r) => [
    { object: "block", type: "quote", quote: { rich_text: [{ type: "text", text: { content: r.quote.slice(0, 1900) } }] } },
    {
      object: "block", type: "paragraph",
      paragraph: { rich_text: [
        ...(r.note ? [{ type: "text", text: { content: r.note.slice(0, 1500) + "  " } }] : []),
        { type: "text", text: { content: r.title.slice(0, 200), link: { url: textFragmentUrl(r.url, r.quote) } }, annotations: { color: "gray" } },
      ] },
    },
  ]);
  for (let i = 0; i < children.length; i += 90) {
    const res = await fetch(`https://api.notion.com/v1/blocks/${pageId}/children`, {
      method: "PATCH",
      headers: { authorization: `Bearer ${token}`, "notion-version": "2022-06-28", "content-type": "application/json" },
      body: JSON.stringify({ children: children.slice(i, i + 90) }),
    });
    if (!res.ok) throw new Error(`Notion ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
}

async function pushWebhook(url: string, secret: string | null, rows: PendingRow[]) {
  const payload = JSON.stringify({ type: "highlights.created", highlights: rows.map((r) => ({ id: r.id, quote: r.quote, note: r.note, source: { title: r.title, url: r.url, link: textFragmentUrl(r.url, r.quote) } })) });
  const headers: Record<string, string> = { "content-type": "application/json", "user-agent": "Lumen-Webhook/1" };
  if (secret) {
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
    headers["x-lumen-signature"] = "sha256=" + [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  const res = await fetch(url, { method: "POST", headers, body: payload });
  if (!res.ok) throw new Error(`Webhook answered ${res.status}`);
}
