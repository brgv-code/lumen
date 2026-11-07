import { Hono } from "hono";
import { PDF_MAX_BYTES, PDF_MAX_PAGES, isPdfBytes, pdfArticle, readingMinutes } from "@lumen/core";
import type { AppEnv, Env } from "../env";
import { body, fail, id, isHttpUrl, now, str } from "../lib/util";
import { toItem } from "../lib/map";
import { requirePro } from "../lib/plan";
import { pdfInfo, pdfKey } from "../lib/files";
import { glowStmt } from "../lib/glow";
import { ITEM_SELECT } from "./items";

/** PDFs: the browser parses, the worker stores bytes and text. Pro only, and never parsed here (Free plan CPU). */
export const pdf = new Hono<AppEnv>();

const SHA256 = /^[0-9a-f]{64}$/;
// The text of 500 dense pages is well under this; anything bigger is not from our parser.
const MAX_TEXT_CHARS = 3_000_000;

function requirePdfAccess(c: Parameters<typeof requirePro>[0]) {
  requirePro(c, "pdf");
  if (c.get("user").is_demo === 1) fail(403, "demo_no_files", "The demo cannot store files. Sign in to add PDFs.");
}

async function ownPdf(db: D1Database, userId: string, itemId: string) {
  const row = await db.prepare("SELECT id, url, title FROM items WHERE user_id = ? AND id = ? AND kind = 'pdf'").bind(userId, itemId).first<{ id: string; url: string; title: string }>();
  if (!row) fail(404, "not_found", "No such PDF.");
  return row;
}

/** Paragraphs per page from the browser, checked for shape and size before anything is stored. */
function pagesFrom(value: unknown): string[][] {
  if (!Array.isArray(value) || value.length > PDF_MAX_PAGES) fail(422, "bad_pages", `Pass up to ${PDF_MAX_PAGES} pages of paragraphs.`);
  let chars = 0;
  const pages = value.map((page) => {
    if (!Array.isArray(page)) fail(422, "bad_pages", "Each page is a list of paragraphs.");
    return page.filter((paragraph): paragraph is string => typeof paragraph === "string").map((paragraph) => { chars += paragraph.length; return paragraph; });
  });
  if (chars > MAX_TEXT_CHARS) fail(422, "too_much_text", "That PDF has more text than Lumen can keep.");
  return pages;
}

/** Store the file streaming, so the worker never holds it; waiting on R2 is not CPU time. */
async function storeFile(env: Env, userId: string, itemId: string, stream: ReadableStream | ArrayBuffer, bytes: number) {
  const key = pdfKey(userId, itemId);
  await env.FILES.put(key, stream, { httpMetadata: { contentType: "application/pdf" } });
  const t = now();
  await env.DB.prepare(`INSERT INTO item_files (item_id, user_id, r2_key, bytes, created_at, updated_at) VALUES (?,?,?,?,?,?)
    ON CONFLICT(item_id) DO UPDATE SET r2_key = excluded.r2_key, bytes = excluded.bytes, updated_at = excluded.updated_at`).bind(itemId, userId, key, bytes, t, t).run();
}

/** The bytes R2 returned for a Range request, so pdf.js can fetch only what page 1 needs. */
function servedRange(object: R2ObjectBody): { start: number; end: number } | null {
  const range = object.range;
  if (!range) return null;
  if ("suffix" in range) return { start: object.size - range.suffix, end: object.size - 1 };
  const start = range.offset ?? 0;
  return { start, end: start + (range.length ?? object.size - start) - 1 };
}

async function markFailed(db: D1Database, userId: string, itemId: string) {
  const t = now();
  await db.prepare(`INSERT INTO item_files (item_id, user_id, text_status, created_at, updated_at) VALUES (?,?,'failed',?,?)
    ON CONFLICT(item_id) DO UPDATE SET text_status = 'failed', updated_at = excluded.updated_at`).bind(itemId, userId, t, t).run();
}

/** A local PDF, parsed in the browser: the item and its text first, the bytes follow with PUT /:id/file. */
pdf.post("/pdf", async (c) => {
  requirePdfAccess(c);
  const u = c.get("user");
  const db = c.env.DB;
  const b = await body<{ title?: string; sha256?: string; bytes?: number; pageCount?: number; pages?: unknown }>(c);
  const sha256 = typeof b.sha256 === "string" && SHA256.test(b.sha256) ? b.sha256 : fail(422, "bad_sha256", "Pass the file's sha256.");
  const bytes = Number(b.bytes);
  if (!(bytes > 0 && bytes <= PDF_MAX_BYTES)) fail(422, "too_large", "PDFs can be up to 25 MB.");
  const pageCount = Number(b.pageCount);
  if (!(pageCount > 0 && pageCount <= PDF_MAX_PAGES)) fail(422, "too_many_pages", `PDFs can have up to ${PDF_MAX_PAGES} pages.`);

  const same = await db.prepare(`${ITEM_SELECT} JOIN item_files f ON f.item_id = i.id WHERE f.user_id = ? AND f.sha256 = ?`).bind(u.id, sha256).first();
  if (same) return c.json({ item: toItem(same), created: false });

  const article = pdfArticle(pagesFrom(b.pages));
  const itemId = id("itm_");
  const t = now();
  // A local file has no address of its own; the reader is where it lives.
  const url = `${new URL(c.req.url).origin}/app/read/${itemId}`;
  await db.batch([
    db.prepare(`INSERT INTO items (id, user_id, url, title, site_name, excerpt, content_html, content_text, kind, status, word_count, reading_minutes, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,'pdf','inbox',?,?,?,?)`).bind(
      itemId, u.id, url, str(b.title, 300) ?? "Untitled PDF", "PDF", article.excerpt, article.html || null, article.text || null,
      article.wordCount, readingMinutes(article.wordCount), t, t,
    ),
    db.prepare("INSERT INTO item_files (item_id, user_id, sha256, pages, text_status, created_at, updated_at) VALUES (?,?,?,?,?,?,?)")
      .bind(itemId, u.id, sha256, pageCount, article.wordCount ? "ready" : "no_text", t, t),
    glowStmt(db, u, "save", itemId),
  ]);
  const row = await db.prepare(`${ITEM_SELECT} WHERE i.id = ?`).bind(itemId).first();
  return c.json({ item: toItem(row!), created: true }, 201);
});

pdf.put("/:id/file", async (c) => {
  requirePdfAccess(c);
  const u = c.get("user");
  const item = await ownPdf(c.env.DB, u.id, c.req.param("id"));
  const bytes = Number(c.req.header("content-length"));
  if (!(bytes > 0 && bytes <= PDF_MAX_BYTES)) fail(422, "too_large", "PDFs can be up to 25 MB.");
  const stream = c.req.raw.body;
  if (!stream) fail(422, "empty_file", "Send the PDF as the request body.");
  await storeFile(c.env, u.id, item.id, stream, bytes);
  return c.json({ ok: true });
});

/** The original file. A saved link is fetched once on first open, then served from R2. */
pdf.get("/:id/file", async (c) => {
  requirePdfAccess(c);
  const u = c.get("user");
  const fileHeaders = { "content-type": "application/pdf", "x-content-type-options": "nosniff", "cache-control": "private, max-age=3600", "accept-ranges": "bytes" };
  // The key holds the user's id and goes when the item does, so a stored range skips the database.
  if (c.req.header("range")) {
    const stored = await c.env.FILES.get(pdfKey(u.id, c.req.param("id")), { range: c.req.raw.headers });
    const part = stored && servedRange(stored);
    if (stored && part) return new Response(stored.body, { status: 206, headers: { ...fileHeaders, "content-range": `bytes ${part.start}-${part.end}/${stored.size}`, "content-length": String(part.end - part.start + 1) } });
  }
  const item = await ownPdf(c.env.DB, u.id, c.req.param("id"));
  const headers = { ...fileHeaders, "content-disposition": `inline; filename="${item.title.replace(/[^\w .-]+/g, "_").slice(0, 80)}.pdf"` };
  const stored = await c.env.FILES.get(pdfKey(u.id, item.id));
  if (stored) return new Response(stored.body, { headers: { ...headers, "content-length": String(stored.size) } });

  if (!isHttpUrl(item.url) || item.url.startsWith(new URL(c.req.url).origin)) fail(404, "no_file", "This PDF's file was not stored.");
  const upstream = await fetch(item.url, { headers: { "user-agent": "Mozilla/5.0 (compatible; LumenReader/1.0; +https://github.com/brgv-code/lumen)", accept: "application/pdf" }, redirect: "follow" }).catch(() => null);
  const declared = Number(upstream?.headers.get("content-length") ?? 0);
  if (!upstream?.ok || declared > PDF_MAX_BYTES) {
    await markFailed(c.env.DB, u.id, item.id);
    fail(422, declared > PDF_MAX_BYTES ? "too_large" : "unreachable", declared > PDF_MAX_BYTES ? "PDFs can be up to 25 MB." : "The PDF could not be downloaded from its link.");
  }
  const file = await upstream.arrayBuffer();
  if (file.byteLength > PDF_MAX_BYTES || !isPdfBytes(new Uint8Array(file, 0, Math.min(5, file.byteLength)))) {
    await markFailed(c.env.DB, u.id, item.id);
    fail(422, file.byteLength > PDF_MAX_BYTES ? "too_large" : "not_pdf", file.byteLength > PDF_MAX_BYTES ? "PDFs can be up to 25 MB." : "That link did not return a PDF.");
  }
  await storeFile(c.env, u.id, item.id, file, file.byteLength);
  return new Response(file, { headers });
});

/** Text for a saved link, parsed in the browser on first open; or `failed` when the browser could not parse it. */
pdf.put("/:id/text", async (c) => {
  requirePdfAccess(c);
  const u = c.get("user");
  const db = c.env.DB;
  const item = await ownPdf(db, u.id, c.req.param("id"));
  const b = await body<{ failed?: boolean; sha256?: string; pageCount?: number; pages?: unknown }>(c);
  if (b.failed === true) {
    await markFailed(db, u.id, item.id);
    return c.json({ pdf: await pdfInfo(db, u, item.id) });
  }
  const pageCount = Number(b.pageCount);
  if (!(pageCount > 0 && pageCount <= PDF_MAX_PAGES)) fail(422, "too_many_pages", `PDFs can have up to ${PDF_MAX_PAGES} pages.`);
  const sha256 = typeof b.sha256 === "string" && SHA256.test(b.sha256) ? b.sha256 : null;
  const article = pdfArticle(pagesFrom(b.pages));
  const t = now();
  await db.batch([
    db.prepare("UPDATE items SET content_html = ?, content_text = ?, excerpt = coalesce(excerpt, ?), word_count = ?, reading_minutes = ?, updated_at = ? WHERE id = ?")
      .bind(article.html || null, article.text || null, article.excerpt, article.wordCount, readingMinutes(article.wordCount), t, item.id),
    db.prepare(`INSERT INTO item_files (item_id, user_id, sha256, pages, text_status, created_at, updated_at) VALUES (?,?,?,?,?,?,?)
      ON CONFLICT(item_id) DO UPDATE SET sha256 = excluded.sha256, pages = excluded.pages, text_status = excluded.text_status, updated_at = excluded.updated_at`)
      .bind(item.id, u.id, sha256, pageCount, article.wordCount ? "ready" : "no_text", t, t),
  ]);
  return c.json({ contentHtml: article.html || null, pdf: await pdfInfo(db, u, item.id) });
});
