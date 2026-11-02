import type { Highlight, HighlightAnswer } from "@lumen/core";
import { toAnswer } from "./map";

/** Kept answers for these highlights, grouped by highlight, oldest first. */
export async function listAnswers(db: D1Database, highlightIds: string[]): Promise<Map<string, HighlightAnswer[]>> {
  const grouped = new Map<string, HighlightAnswer[]>();
  // D1 caps bound parameters per statement at 100.
  for (let start = 0; start < highlightIds.length; start += 100) {
    const ids = highlightIds.slice(start, start + 100);
    const { results } = await db.prepare(`SELECT * FROM highlight_answers WHERE highlight_id IN (${ids.map(() => "?").join(",")}) ORDER BY created_at`).bind(...ids).all();
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
