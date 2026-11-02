// Destinations + the delivery ledger.
//
// Obsidian and Markdown are delivered by the client (extension or browser), because
// the vault lives on the reader's machine: the client asks for /pending, writes the
// rendered markdown, then calls /ack. Notion and webhooks are pushed by the server
// with /push. Either way the (highlight, destination) ledger guarantees a highlight
// is written once, so clipping a page again never duplicates. Kept answers have their own
// ledger, answer_deliveries: they ride along with a pending highlight, or follow later as
// their own block. Kept TL;DRs have tldr_deliveries.
import { Hono } from "hono";
import { DESTINATION_KINDS, answerLabel, blockIdFor, formatHighlight, formatLateAnswer, formatSourceBlock, formatTldr, lateAnswerHeading, textFragmentUrl, type HighlightAnswer, type HighlightFormat, type ItemTldr } from "@lumen/core";
import type { AppEnv } from "../env";
import { body, fail, id, isHttpUrl, now, oneOf, str } from "../lib/util";
import { safeJson, toAnswer, toDestination, toTldr } from "../lib/map";
import { listAnswers } from "../lib/answers";
import { requirePro } from "../lib/plan";
import { trackUser } from "../lib/analytics";

export const destinations = new Hono<AppEnv>();

const SELECT = `SELECT d.*,
  (SELECT count(*) FROM deliveries x WHERE x.destination_id = d.id AND x.status = 'delivered') AS delivered_count,
  (SELECT max(delivered_at) FROM deliveries x WHERE x.destination_id = d.id) AS last_delivered_at,
  (SELECT count(*) FROM highlights h JOIN items i ON i.id = h.item_id JOIN collections c ON c.id = i.collection_id
     WHERE c.destination_id = d.id AND NOT EXISTS (SELECT 1 FROM deliveries x WHERE x.highlight_id = h.id AND x.destination_id = d.id AND x.status = 'delivered'))
  + (SELECT count(*) FROM highlight_answers a JOIN highlights h ON h.id = a.highlight_id JOIN items i ON i.id = h.item_id JOIN collections c ON c.id = i.collection_id
     WHERE c.destination_id = d.id AND NOT EXISTS (SELECT 1 FROM answer_deliveries y WHERE y.answer_id = a.id AND y.destination_id = d.id AND y.status = 'delivered'))
  + (SELECT count(*) FROM item_tldrs t JOIN items i ON i.id = t.item_id JOIN collections c ON c.id = i.collection_id
     WHERE c.destination_id = d.id AND NOT EXISTS (SELECT 1 FROM tldr_deliveries z WHERE z.tldr_id = t.id AND z.destination_id = d.id AND z.status = 'delivered')) AS pending_count
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
  if (kind === "notion" || kind === "webhook") requirePro(c, kind);
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

/** Highlights and kept answers not yet delivered to this destination, grouped by source and rendered. */
destinations.get("/:id/pending", async (c) => {
  const u = c.get("user");
  const d = await own(c.env.DB, u.id, c.req.param("id"));
  const cfg = safeJson<Record<string, string>>(d.config, {});
  const format = (cfg.format as HighlightFormat) || "plain";
  const { highlights: pending, late, tldrs } = await pendingFor(c.env.DB, d.id);
  const groups = groupBySource(pending, late, tldrs);
  const withId = (h: PendingRow) => ({ ...h, blockId: blockIdFor(h.id) });
  const markdown = groups.map((g) => formatSourceBlock(g.source, g.highlights.map(withId), format, undefined, g.late.map((l) => ({ highlight: l, answer: l.answer })),
    g.tldr ? { ...g.tldr.tldr, placement: g.tldr.placement } : undefined)).join("");
  const answerIds = [...pending.flatMap((h) => h.answers.map((a) => a.id)), ...late.map((l) => l.answer.id)];
  return c.json({
    destination: toDestination(d),
    // Late answers' highlights are listed too, so clients that only ack highlight ids still deliver them.
    highlightIds: [...new Set([...pending.map((p) => p.id), ...late.map((l) => l.highlightId)])],
    answerIds,
    tldrIds: tldrs.map((t) => t.tldr.id),
    counts: { highlights: pending.length, answers: answerIds.length, tldrs: tldrs.length },
    markdown,
    groups: groups.map((g) => ({
      source: g.source,
      highlights: g.highlights.map((h) => ({ id: h.id, quote: h.quote, note: h.note, answers: h.answers, markdown: formatHighlight(withId(h), format) })),
      late: g.late.map((l) => ({ highlightId: l.highlightId, answer: l.answer, markdown: formatLateAnswer(l, l.answer, format) })),
      tldr: g.tldr ? { ...g.tldr.tldr, markdown: formatTldr(g.source, g.tldr.tldr, format, g.tldr.placement) } : null,
    })),
  });
});

/** Client confirms it wrote these highlights and answers. Idempotent. */
destinations.post("/:id/ack", async (c) => {
  const u = c.get("user");
  const d = await own(c.env.DB, u.id, c.req.param("id"));
  const b = await body<{ highlightIds?: string[]; answerIds?: string[]; tldrIds?: string[]; error?: string }>(c);
  const ids = (b.highlightIds ?? []).filter((x) => typeof x === "string").slice(0, 500);
  const answerIds = Array.isArray(b.answerIds) ? b.answerIds.filter((x) => typeof x === "string").slice(0, 500) : null;
  const tldrIds = Array.isArray(b.tldrIds) ? b.tldrIds.filter((x) => typeof x === "string").slice(0, 200) : null;
  if (!ids.length && !answerIds?.length && !tldrIds?.length) return c.json({ acked: 0, answers: 0, tldrs: 0 });
  const status = b.error ? "failed" : "delivered";
  const t = now();
  const db = c.env.DB;
  await db.batch([
    ...ids.map((hid) =>
      db.prepare(`INSERT INTO deliveries (highlight_id, destination_id, status, attempts, error, delivered_at)
        SELECT h.id, ?, ?, 1, ?, ? FROM highlights h WHERE h.id = ? AND h.user_id = ?
        ON CONFLICT(highlight_id, destination_id) DO UPDATE SET status = excluded.status, attempts = attempts + 1, error = excluded.error, delivered_at = excluded.delivered_at`)
        .bind(d.id, status, b.error ?? null, t, hid, u.id)),
    // Clients from before LUM-2 ack only highlights: their answers kept up to now went out with them.
    ...(answerIds ?? ids).map((key) =>
      db.prepare(`INSERT INTO answer_deliveries (answer_id, destination_id, status, attempts, error, delivered_at)
        SELECT a.id, ?, ?, 1, ?, ? FROM highlight_answers a JOIN highlights h ON h.id = a.highlight_id
        WHERE ${answerIds ? "a.id = ?" : "h.id = ? AND a.created_at <= ?"} AND h.user_id = ?
        ON CONFLICT(answer_id, destination_id) DO UPDATE SET status = excluded.status, attempts = attempts + 1, error = excluded.error, delivered_at = excluded.delivered_at`)
        .bind(d.id, status, b.error ?? null, t, key, ...(answerIds ? [] : [t]), u.id)),
    // Clients from before LUM-3 do not know TL;DRs: one kept for a page they wrote went out with it.
    ...(tldrIds ?? ids).map((key) =>
      db.prepare(`INSERT INTO tldr_deliveries (tldr_id, destination_id, status, attempts, error, delivered_at)
        SELECT tl.id, ?, ?, 1, ?, ? FROM item_tldrs tl JOIN items i ON i.id = tl.item_id
        WHERE ${tldrIds ? "tl.id = ?" : "i.id = (SELECT item_id FROM highlights WHERE id = ?) AND tl.created_at <= ?"} AND i.user_id = ?
        ON CONFLICT(tldr_id, destination_id) DO UPDATE SET status = excluded.status, attempts = attempts + 1, error = excluded.error, delivered_at = excluded.delivered_at`)
        .bind(d.id, status, b.error ?? null, t, key, ...(tldrIds ? [] : [t]), u.id)),
  ]);
  if (status === "delivered") trackUser(c, "notes_synced", { kind: d.kind, highlights: ids.length, answers: answerIds?.length ?? null, tldrs: tldrIds?.length ?? null });
  return c.json({ acked: ids.length, answers: answerIds?.length ?? 0, tldrs: tldrIds?.length ?? 0, status });
});

/** Server side delivery for Notion and webhooks. */
destinations.post("/:id/push", async (c) => {
  const u = c.get("user");
  const d = await own(c.env.DB, u.id, c.req.param("id"));
  if (d.kind !== "notion" && d.kind !== "webhook") fail(422, "client_delivered", `${d.kind} is delivered by the extension or the browser. Use /pending and /ack.`);
  requirePro(c, d.kind as "notion" | "webhook");
  if (u.is_demo === 1) fail(403, "demo", "Pushing to external services is off in the demo.");
  const { highlights: pending, late, tldrs } = await pendingFor(c.env.DB, d.id);
  const answerIds = [...pending.flatMap((h) => h.answers.map((a) => a.id)), ...late.map((l) => l.answer.id)];
  if (!pending.length && !late.length && !tldrs.length) return c.json({ delivered: 0, answers: 0, tldrs: 0 });
  const cfg = safeJson<Record<string, string>>(d.config, {});
  let error: string | null = null;
  try {
    if (d.kind === "notion") await pushNotion(cfg.pageId, d.secret, pending, late, tldrs);
    else await pushWebhook(cfg.url, d.secret, pending, late, tldrs);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }
  const t = now();
  const db = c.env.DB;
  await db.batch([
    ...pending.map((p) => db.prepare(`INSERT INTO deliveries (highlight_id, destination_id, status, attempts, error, delivered_at) VALUES (?,?,?,1,?,?)
      ON CONFLICT(highlight_id, destination_id) DO UPDATE SET status = excluded.status, attempts = attempts + 1, error = excluded.error, delivered_at = excluded.delivered_at`)
      .bind(p.id, d.id, error ? "failed" : "delivered", error, t)),
    ...answerIds.map((answerId) => db.prepare(`INSERT INTO answer_deliveries (answer_id, destination_id, status, attempts, error, delivered_at) VALUES (?,?,?,1,?,?)
      ON CONFLICT(answer_id, destination_id) DO UPDATE SET status = excluded.status, attempts = attempts + 1, error = excluded.error, delivered_at = excluded.delivered_at`)
      .bind(answerId, d.id, error ? "failed" : "delivered", error, t)),
    ...tldrs.map((entry) => db.prepare(`INSERT INTO tldr_deliveries (tldr_id, destination_id, status, attempts, error, delivered_at) VALUES (?,?,?,1,?,?)
      ON CONFLICT(tldr_id, destination_id) DO UPDATE SET status = excluded.status, attempts = attempts + 1, error = excluded.error, delivered_at = excluded.delivered_at`)
      .bind(entry.tldr.id, d.id, error ? "failed" : "delivered", error, t)),
  ]);
  if (error) fail(502, "push_failed", error);
  return c.json({ delivered: pending.length, answers: answerIds.length, tldrs: tldrs.length });
});

interface PendingRow { id: string; quote: string; note: string | null; title: string; url: string; site_name: string | null; item_id: string; answers: HighlightAnswer[] }
/** An answer kept after its highlight reached this destination. */
interface LateRow { highlightId: string; quote: string; title: string; url: string; site_name: string | null; item_id: string; answer: HighlightAnswer }

/** A kept TL;DR this destination has not received; "own" once something from its page was sent there. */
interface TldrRow { tldr: ItemTldr; item_id: string; title: string; url: string; site_name: string | null; placement: "top" | "own" }

async function pendingFor(db: D1Database, destinationId: string): Promise<{ highlights: PendingRow[]; late: LateRow[]; tldrs: TldrRow[] }> {
  return { highlights: await pendingHighlights(db, destinationId), late: await lateAnswers(db, destinationId), tldrs: await pendingTldrs(db, destinationId) };
}

async function pendingTldrs(db: D1Database, destinationId: string): Promise<TldrRow[]> {
  const { results } = await db.prepare(`SELECT tl.*, i.title, i.url, i.site_name,
      EXISTS (SELECT 1 FROM highlights h JOIN deliveries x ON x.highlight_id = h.id WHERE h.item_id = i.id AND x.destination_id = ? AND x.status = 'delivered') AS sent_before
    FROM item_tldrs tl JOIN items i ON i.id = tl.item_id JOIN collections c ON c.id = i.collection_id
    WHERE c.destination_id = ? AND NOT EXISTS (SELECT 1 FROM tldr_deliveries z WHERE z.tldr_id = tl.id AND z.destination_id = ? AND z.status = 'delivered')
    ORDER BY i.created_at LIMIT 200`).bind(destinationId, destinationId, destinationId).all<Record<string, string>>();
  return results.map((row) => ({ tldr: toTldr(row), item_id: row.item_id, title: row.title, url: row.url, site_name: row.site_name, placement: Number(row.sent_before) ? "own" : "top" }));
}

/** Highlights this destination has not received, with the answers that ride along with them. */
async function pendingHighlights(db: D1Database, destinationId: string): Promise<PendingRow[]> {
  const { results } = await db.prepare(`SELECT h.id, h.quote, h.note, i.title, i.url, i.site_name, i.id AS item_id
    FROM highlights h JOIN items i ON i.id = h.item_id JOIN collections c ON c.id = i.collection_id
    WHERE c.destination_id = ? AND NOT EXISTS (SELECT 1 FROM deliveries x WHERE x.highlight_id = h.id AND x.destination_id = ? AND x.status = 'delivered')
    ORDER BY i.created_at, h.position LIMIT 500`).bind(destinationId, destinationId).all<Omit<PendingRow, "answers">>();
  const answers = await listAnswers(db, results.map((row) => row.id), destinationId);
  return results.map((row) => ({ ...row, answers: answers.get(row.id) ?? [] }));
}

async function lateAnswers(db: D1Database, destinationId: string): Promise<LateRow[]> {
  const { results } = await db.prepare(`SELECT a.*, h.quote, h.item_id, i.title, i.url, i.site_name
    FROM highlight_answers a JOIN highlights h ON h.id = a.highlight_id JOIN items i ON i.id = h.item_id JOIN collections c ON c.id = i.collection_id
    WHERE c.destination_id = ?
      AND EXISTS (SELECT 1 FROM deliveries x WHERE x.highlight_id = h.id AND x.destination_id = ? AND x.status = 'delivered')
      AND NOT EXISTS (SELECT 1 FROM answer_deliveries y WHERE y.answer_id = a.id AND y.destination_id = ? AND y.status = 'delivered')
    ORDER BY i.created_at, h.position, a.created_at LIMIT 500`).bind(destinationId, destinationId, destinationId).all<Record<string, string>>();
  return results.map((row) => ({ highlightId: row.highlight_id, quote: row.quote, title: row.title, url: row.url, site_name: row.site_name, item_id: row.item_id, answer: toAnswer(row) }));
}

type Source = { title: string; url: string; siteName: string | null };

function groupBySource(rows: PendingRow[], late: LateRow[], tldrs: TldrRow[]) {
  const map = new Map<string, { source: Source; highlights: PendingRow[]; late: LateRow[]; tldr: TldrRow | null }>();
  const groupFor = (r: { item_id: string; title: string; url: string; site_name: string | null }) => {
    if (!map.has(r.item_id)) map.set(r.item_id, { source: { title: r.title, url: r.url, siteName: r.site_name }, highlights: [], late: [], tldr: null });
    return map.get(r.item_id)!;
  };
  for (const r of rows) groupFor(r).highlights.push(r);
  for (const l of late) groupFor(l).late.push(l);
  for (const tl of tldrs) groupFor(tl).tldr = tl;
  return [...map.values()];
}

async function own(db: D1Database, userId: string, destinationId: string) {
  const row = await db.prepare("SELECT d.*, 0 AS pending_count FROM destinations d WHERE d.user_id = ? AND d.id = ?").bind(userId, destinationId)
    .first<{ id: string; kind: string; name: string; config: string; secret: string | null; created_at: number }>();
  if (!row) fail(404, "not_found", "No such destination.");
  return row;
}

async function pushNotion(pageId: string, token: string | null, rows: PendingRow[], late: LateRow[], tldrs: TldrRow[]) {
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
    ...r.answers.map((kept) => ({
      object: "block", type: "toggle",
      toggle: {
        rich_text: [{ type: "text", text: { content: (kept.question ? `${answerLabel(kept.action)}: ${kept.question}` : answerLabel(kept.action)).slice(0, 200) } }],
        children: [{ object: "block", type: "paragraph", paragraph: { rich_text: [{ type: "text", text: { content: kept.answer.slice(0, 1900) } }] } }],
      },
    })),
  ]).concat(late.map((l) => ({
    object: "block", type: "toggle",
    toggle: {
      rich_text: [
        { type: "text", text: { content: lateAnswerHeading(l.quote, l.answer.action).slice(0, 200) + " " } },
        { type: "text", text: { content: "source", link: { url: textFragmentUrl(l.url, l.quote) } }, annotations: { color: "gray" } },
      ],
      children: [{ object: "block", type: "paragraph", paragraph: { rich_text: [{ type: "text", text: { content: l.answer.answer.slice(0, 1900) } }] } }],
    },
  }))).concat(tldrs.map((entry) => ({
    object: "block", type: "toggle",
    toggle: {
      rich_text: [{ type: "text", text: { content: (entry.placement === "own" ? `↳ TL;DR of "${entry.title}"` : "TL;DR").slice(0, 200) } }],
      children: [{ object: "block", type: "paragraph", paragraph: { rich_text: [{ type: "text", text: { content: entry.tldr.text.replace(/\s*\[p\d+\]/g, "").slice(0, 1900) } }] } }],
    },
  })));
  for (let i = 0; i < children.length; i += 90) {
    const res = await fetch(`https://api.notion.com/v1/blocks/${pageId}/children`, {
      method: "PATCH",
      headers: { authorization: `Bearer ${token}`, "notion-version": "2022-06-28", "content-type": "application/json" },
      body: JSON.stringify({ children: children.slice(i, i + 90) }),
    });
    if (!res.ok) throw new Error(`Notion ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
}

async function pushWebhook(url: string, secret: string | null, rows: PendingRow[], late: LateRow[], tldrs: TldrRow[]) {
  const tldrPayload = tldrs.map((entry) => ({ id: entry.tldr.id, itemId: entry.item_id, text: entry.tldr.text, citations: entry.tldr.citations, model: entry.tldr.model, source: { title: entry.title, url: entry.url } }));
  const lateAnswersPayload = late.map((l) => ({ id: l.answer.id, highlightId: l.highlightId, action: l.answer.action, question: l.answer.question, answer: l.answer.answer, model: l.answer.model, source: { title: l.title, url: l.url, link: textFragmentUrl(l.url, l.quote) } }));
  const payload = JSON.stringify({ type: "highlights.created", answers: lateAnswersPayload, tldrs: tldrPayload, highlights: rows.map((r) => ({ id: r.id, quote: r.quote, note: r.note, answers: r.answers.map((kept) => ({ action: kept.action, question: kept.question, answer: kept.answer, model: kept.model })), source: { title: r.title, url: r.url, link: textFragmentUrl(r.url, r.quote) } })) });
  const headers: Record<string, string> = { "content-type": "application/json", "user-agent": "Lumen-Webhook/1" };
  if (secret) {
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
    headers["x-lumen-signature"] = "sha256=" + [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  const res = await fetch(url, { method: "POST", headers, body: payload });
  if (!res.ok) throw new Error(`Webhook answered ${res.status}`);
}
