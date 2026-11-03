import { Hono } from "hono";
import { RECALL_SYSTEM, fallbackRecallQuestions, parseRecallQuestions, recallPrompt, scheduleRecall, type RecallQuestion } from "@lumen/core";
import type { AppEnv } from "../env";
import { body, fail, id, now, oneOf, str } from "../lib/util";
import { toRecall } from "../lib/map";
import { trackUser } from "../lib/analytics";
import { CHAT_MODEL } from "../lib/ai";
import { spend } from "./ai";

export const recall = new Hono<AppEnv>();

const SELECT = `SELECT r.*, i.title AS item_title, h.quote AS quote
  FROM recall_cards r JOIN items i ON i.id = r.item_id LEFT JOIN highlights h ON h.id = r.highlight_id`;

/** Due cards first; with ?item= every card for that article. */
recall.get("/", async (c) => {
  const user = c.get("user");
  const db = c.env.DB;
  const itemId = c.req.query("item");
  const [cards, summary] = await Promise.all([
    itemId
      ? db.prepare(`${SELECT} WHERE r.user_id = ? AND r.item_id = ? ORDER BY r.created_at, r.id`).bind(user.id, itemId).all()
      : db.prepare(`${SELECT} WHERE r.user_id = ? AND r.due_at <= ? ORDER BY r.due_at, r.id LIMIT 30`).bind(user.id, now()).all(),
    db.prepare(`SELECT count(*) AS total, sum(CASE WHEN due_at <= ? THEN 1 ELSE 0 END) AS due, min(CASE WHEN due_at > ? THEN due_at END) AS next_due
      FROM recall_cards WHERE user_id = ?`).bind(now(), now(), user.id).first<{ total: number; due: number | null; next_due: number | null }>(),
  ]);
  return c.json({ data: cards.results.map(toRecall), total: summary?.total ?? 0, due: summary?.due ?? 0, nextDueAt: summary?.next_due ?? null });
});

/** Writes the questions for an article from its highlights, once. Calling again returns the same cards. */
recall.post("/items/:itemId", async (c) => {
  const user = c.get("user");
  const db = c.env.DB;
  const item = await db.prepare("SELECT id, title FROM items WHERE user_id = ? AND id = ?").bind(user.id, c.req.param("itemId")).first<{ id: string; title: string }>();
  if (!item) fail(404, "not_found", "No such item.");
  const existing = await db.prepare(`${SELECT} WHERE r.user_id = ? AND r.item_id = ? ORDER BY r.created_at, r.id`).bind(user.id, item.id).all();
  if (existing.results.length) return c.json({ data: existing.results.map(toRecall), created: false });

  const { results: passages } = await db.prepare("SELECT id, quote, note FROM highlights WHERE user_id = ? AND item_id = ? ORDER BY position LIMIT 8")
    .bind(user.id, item.id).all<{ id: string; quote: string; note: string | null }>();
  if (!passages.length) fail(422, "no_highlights", "Highlight a passage or two first. Recall asks about what you kept.");

  const { questions, model } = await writeQuestions(c, item.title, passages);
  const t = now();
  await db.batch(questions.map((q, index) => db.prepare(`INSERT INTO recall_cards (id, user_id, item_id, highlight_id, question, due_at, model, created_at)
    VALUES (?,?,?,?,?,?,?,?)`).bind(id("rc_"), user.id, item.id, q.from ? passages[q.from - 1]!.id : null, q.question, t, model, t + index)));
  trackUser(c, "recall_created", { questions: questions.length, fallback: model === null });
  const { results } = await db.prepare(`${SELECT} WHERE r.user_id = ? AND r.item_id = ? ORDER BY r.created_at, r.id`).bind(user.id, item.id).all();
  return c.json({ data: results.map(toRecall), created: true }, 201);
});

/** The reader's answer and how well they remembered; the first answer also becomes the passage's note. */
recall.post("/:id/review", async (c) => {
  const user = c.get("user");
  const db = c.env.DB;
  const card = await db.prepare("SELECT id, step, highlight_id FROM recall_cards WHERE user_id = ? AND id = ?").bind(user.id, c.req.param("id"))
    .first<{ id: string; step: number; highlight_id: string | null }>();
  if (!card) fail(404, "not_found", "No such card.");
  const b = await body<{ answer?: string; grade?: string }>(c);
  const grade = oneOf(b.grade, ["again", "good"] as const);
  if (!grade) fail(422, "bad_request", "Pass a grade: again or good.");
  const answer = str(b.answer, 4000) ?? null;
  const t = now();
  const next = scheduleRecall(card.step, grade, t);
  await db.batch([
    db.prepare("UPDATE recall_cards SET answer = coalesce(?, answer), step = ?, due_at = ?, reviews = reviews + 1, reviewed_at = ? WHERE id = ?")
      .bind(answer, next.step, next.dueAt, t, card.id),
    ...(answer && card.highlight_id
      ? [db.prepare("UPDATE highlights SET note = ?, updated_at = ? WHERE id = ? AND user_id = ? AND (note IS NULL OR note = '')").bind(answer, t, card.highlight_id, user.id)]
      : []),
  ]);
  trackUser(c, "recall_reviewed", { grade, step: next.step, answered: Boolean(answer) });
  const row = await db.prepare(`${SELECT} WHERE r.id = ?`).bind(card.id).first();
  return c.json({ card: toRecall(row!) });
});

async function writeQuestions(c: Parameters<typeof spend>[0], title: string, passages: { quote: string; note: string | null }[]): Promise<{ questions: RecallQuestion[]; model: string | null }> {
  const fallback = { questions: fallbackRecallQuestions(passages), model: null };
  let model: string;
  try {
    model = await spend(c, "recall", CHAT_MODEL);
  } catch (e) {
    // Out of hosted answers: the cue questions still work without a model.
    console.warn("recall falls back, no model budget", e);
    return fallback;
  }
  try {
    const out = (await c.env.AI.run(model as Parameters<Ai["run"]>[0], {
      messages: [{ role: "system", content: RECALL_SYSTEM }, { role: "user", content: recallPrompt(title, passages) }],
      max_tokens: 400,
    } as never)) as { response?: unknown };
    const questions = parseRecallQuestions(out.response, passages.length);
    return questions.length ? { questions, model } : fallback;
  } catch (e) {
    console.error("recall questions failed", e);
    return fallback;
  }
}
