import { Hono } from "hono";
import { AI_ACTIONS } from "@lumen/core";
import type { AppEnv, SessionUser } from "../env";
import { aiDailyCap, entitlement, requirePro } from "../lib/plan";
import { body, dayIn, fail, id, now, oneOf, str } from "../lib/util";
import { CHAT_MODEL, DEFAULT_MODEL, SPARK_MODEL, SPARK_SYSTEM, promptFor } from "../lib/ai";
import { retrieve, sourcesBlock } from "../lib/retrieve";
import { LIBRARY_SYSTEM } from "@lumen/core";
import { safeJson, toIdea } from "../lib/map";
import { glowStmt } from "../lib/glow";

export const ai = new Hono<AppEnv>();

async function spend(db: D1Database, user: SessionUser) {
  const day = dayIn(user.timezone);
  const row = await db.prepare(`INSERT INTO ai_usage (user_id, day, count) VALUES (?,?,1)
    ON CONFLICT(user_id, day) DO UPDATE SET count = count + 1 RETURNING count`).bind(user.id, day).first<{ count: number }>();
  const cap = aiDailyCap(user);
  if ((row?.count ?? 0) > cap) fail(entitlement(user).pro ? 429 : 402, entitlement(user).pro ? "ai_quota" : "upgrade_required", `Daily limit of ${cap} hosted answers reached. Pro raises it to 500, or use Ollama or Claude on your machine for unlimited answers.`);
}

/** Streams Server Sent Events: data: {"response":"..."} ... data: [DONE] */
ai.post("/run", async (c) => {
  const u = c.get("user");
  const b = await body<{ action?: string; text?: string; question?: string; title?: string; context?: string }>(c);
  const action = oneOf(b.action, AI_ACTIONS);
  const text = str(b.text, 8000);
  if (!action || !text) fail(422, "bad_request", "Pass an action and the selected text.");
  await spend(c.env.DB, u);
  let stream: ReadableStream;
  try {
    stream = (await c.env.AI.run((c.env.AI_MODEL || DEFAULT_MODEL) as Parameters<Ai["run"]>[0], {
      messages: promptFor(action, text, { question: b.question, title: b.title, context: b.context }),
      stream: true,
      max_tokens: 400,
    } as never)) as unknown as ReadableStream;
  } catch (e) {
    console.error("ai run failed", e);
    fail(502, "ai_unavailable", "The assistant is resting. Try again in a moment, or switch to a local model in the extension.");
  }
  return new Response(stream, { headers: { "content-type": "text/event-stream", "cache-control": "no-store" } });
});

/** Ask Lumen: chat grounded in the page (optional) and the reader's own library.
 *  SSE: first event {"sources":[...]}, then {"response":"..."} chunks, then [DONE]. */
ai.post("/chat", async (c) => {
  const u = c.get("user");
  const b = await body<{ question?: string; page?: { title?: string; url?: string; text?: string }; selection?: string; history?: { role: string; content: string }[] }>(c);
  const question = str(b.question, 1500);
  if (!question) fail(422, "bad_request", "Ask a question.");
  await spend(c.env.DB, u);
  const sources = await retrieve(c.env.DB, u.id, `${question} ${b.selection ?? ""} ${b.page?.title ?? ""}`, 5);
  const pageText = (b.page?.text ?? "").replace(/\s+\n/g, "\n").replace(/[ \t]{2,}/g, " ").trim();
  const page = pageText ? `PAGE: "${b.page?.title ?? "Untitled"}" (${b.page?.url ?? ""})\n"""${pageText.slice(0, 12000)}"""` : "";
  const sel = b.selection ? `SELECTION: """${b.selection.slice(0, 2000)}"""` : "";
  const history = (b.history ?? []).slice(-6).filter((m) => m && (m.role === "user" || m.role === "assistant")).map((m) => ({ role: m.role, content: String(m.content).slice(0, 2000) }));
  let stream: ReadableStream;
  try {
    stream = (await c.env.AI.run(CHAT_MODEL as Parameters<Ai["run"]>[0], {
      messages: [
        { role: "system", content: LIBRARY_SYSTEM },
        ...history,
        { role: "user", content: [page, sel, `LIBRARY:\n${sourcesBlock(sources)}`, `QUESTION: ${question}`].filter(Boolean).join("\n\n") },
      ],
      stream: true,
      max_tokens: 700,
    } as never)) as unknown as ReadableStream;
  } catch (e) {
    console.error("chat failed", e);
    fail(502, "ai_unavailable", "The assistant is resting. Try again in a moment.");
  }
  const head = new TextEncoder().encode(`data: ${JSON.stringify({ sources })}\n\n`);
  const out = new ReadableStream({
    async start(ctrl) {
      ctrl.enqueue(head);
      const r = stream.getReader();
      while (true) { const { done, value } = await r.read(); if (done) break; ctrl.enqueue(value); }
      ctrl.close();
    },
  });
  return new Response(out, { headers: { "content-type": "text/event-stream", "cache-control": "no-store" } });
});

/** Spark: turn recent highlights into writing ideas. */
ai.post("/spark", async (c) => {
  requirePro(c, "spark");
  const u = c.get("user");
  const db = c.env.DB;
  const { results } = await db.prepare(`SELECT h.quote, h.note, i.id AS item_id, i.title FROM highlights h JOIN items i ON i.id = h.item_id
    WHERE h.user_id = ? ORDER BY h.created_at DESC LIMIT 30`).bind(u.id).all<{ quote: string; note: string | null; item_id: string; title: string }>();
  if (results.length < 3) fail(422, "not_enough", "Highlight at least 3 passages first: Spark needs something to notice.");
  await spend(db, u);
  const list = results.map((r, k) => `${k + 1}. "${r.quote.slice(0, 300)}"${r.note ? ` (my note: ${r.note.slice(0, 200)})` : ""} [from: ${r.title}]`).join("\n");
  let out: { response?: unknown };
  try {
    out = (await c.env.AI.run(SPARK_MODEL as Parameters<Ai["run"]>[0], {
      messages: [{ role: "system", content: SPARK_SYSTEM }, { role: "user", content: list }],
      max_tokens: 900,
    } as never)) as { response?: unknown };
  } catch (e) {
    console.error("spark failed", e);
    fail(502, "ai_unavailable", "Spark could not reach the model. Try again in a moment.");
  }
  const parsed = typeof out.response === "object" && out.response ? ideasFrom(out.response) : parseIdeas(String(out.response ?? ""));
  if (!parsed.length) fail(502, "spark_unparsed", "The model did not return ideas this time. Try again.");
  const t = now();
  const rows = parsed.slice(0, 3).map((p) => ({
    id: id("idea_"),
    title: p.title.slice(0, 120),
    angle: (p.angle || "").slice(0, 400),
    outline: (p.outline || []).slice(0, 6).map((x) => String(x).slice(0, 200)),
    src: [...new Set((p.sources || []).map((n) => results[Number(n) - 1]?.item_id).filter(Boolean))],
  }));
  await db.batch(rows.map((r) => db.prepare("INSERT INTO ideas (id, user_id, title, angle, outline, source_item_ids, status, created_at) VALUES (?,?,?,?,?,?,?,?)")
    .bind(r.id, u.id, r.title, r.angle, JSON.stringify(r.outline), JSON.stringify(r.src), "new", t)));
  const { results: saved } = await db.prepare("SELECT * FROM ideas WHERE user_id = ? AND created_at = ?").bind(u.id, t).all();
  return c.json({ data: saved.map(toIdea) });
});

function ideasFrom(o: unknown) {
  const j = o as { ideas?: unknown };
  return Array.isArray(j.ideas) ? (j.ideas as { title: string; angle?: string; outline?: string[]; sources?: number[] }[]).filter((x) => x && typeof x.title === "string") : [];
}

function parseIdeas(s: string): { title: string; angle?: string; outline?: string[]; sources?: number[] }[] {
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start < 0 || end < start) return [];
  const j = safeJson<{ ideas?: unknown }>(s.slice(start, end + 1), {});
  return Array.isArray(j.ideas) ? (j.ideas as { title: string }[]).filter((x) => x && typeof x.title === "string") : [];
}

export const ideas = new Hono<AppEnv>();

ideas.get("/", async (c) => {
  const { results } = await c.env.DB.prepare("SELECT * FROM ideas WHERE user_id = ? AND status != 'dismissed' ORDER BY created_at DESC LIMIT 60").bind(c.get("user").id).all();
  return c.json({ data: results.map(toIdea) });
});

ideas.patch("/:id", async (c) => {
  const u = c.get("user");
  const b = await body<{ status?: string }>(c);
  const status = oneOf(b.status, ["new", "saved", "dismissed"] as const);
  if (!status) fail(422, "bad_status", "status must be new, saved or dismissed.");
  const prev = await c.env.DB.prepare("SELECT status FROM ideas WHERE user_id = ? AND id = ?").bind(u.id, c.req.param("id")).first<{ status: string }>();
  if (!prev) fail(404, "not_found", "No such idea.");
  const stmts = [c.env.DB.prepare("UPDATE ideas SET status = ? WHERE id = ?").bind(status, c.req.param("id"))];
  if (status === "saved" && prev.status !== "saved") stmts.push(glowStmt(c.env.DB, u, "idea"));
  await c.env.DB.batch(stmts);
  const row = await c.env.DB.prepare("SELECT * FROM ideas WHERE id = ?").bind(c.req.param("id")).first();
  return c.json({ idea: toIdea(row!) });
});
