import type { Highlight, HighlightAnswer } from "@lumen/core";
import { toAnswer } from "./map";

/** Kept answers for these highlights, grouped by highlight, oldest first; optionally only those a destination has not received. */
export async function listAnswers(db: D1Database, highlightIds: string[], undeliveredTo?: string): Promise<Map<string, HighlightAnswer[]>> {
  const grouped = new Map<string, HighlightAnswer[]>();
  const undelivered = undeliveredTo
    ? " AND NOT EXISTS (SELECT 1 FROM answer_deliveries y WHERE y.answer_id = highlight_answers.id AND y.destination_id = ? AND y.status = 'delivered')"
    : "";
  // D1 caps bound parameters per statement at 100.
  for (let start = 0; start < highlightIds.length; start += 99) {
    const ids = highlightIds.slice(start, start + 99);
    const { results } = await db.prepare(`SELECT * FROM highlight_answers WHERE highlight_id IN (${ids.map(() => "?").join(",")})${undelivered} ORDER BY created_at`)
      .bind(...ids, ...(undeliveredTo ? [undeliveredTo] : [])).all();
    for (const row of results) {
      const answer = toAnswer(row);
      grouped.set(answer.highlightId, [...(grouped.get(answer.highlightId) ?? []), answer]);
    }
  }
  return grouped;
}

export async function withAnswers(db: D1Database, highlights: Highlight[]): Promise<Highlight[]> {
  const answers = await listAnswers(db, highlights.map((highlight) => highlight.id));
  return highlights.map((highlight) => ({ ...highlight, answers: answers.get(highlight.id) ?? [] }));
}
