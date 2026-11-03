/** Recall: after reading, the reader answers a few questions in their own words, then meets them
 *  again on a widening schedule. */

/** Days until the next review after each remembered answer in a row. */
export const RECALL_INTERVALS = [1, 3, 7, 16, 35, 90];
export const RECALL_MAX_QUESTIONS = 3;

export type RecallGrade = "again" | "good";

export interface RecallPassage { quote: string; note: string | null }
export interface RecallQuestion { question: string; from: number | null }

const DAY = 86_400_000;

export function scheduleRecall(step: number, grade: RecallGrade, at: number): { step: number; dueAt: number } {
  if (grade === "again") return { step: 0, dueAt: at + DAY };
  const next = Math.min(step + 1, RECALL_INTERVALS.length);
  return { step: next, dueAt: at + RECALL_INTERVALS[next - 1]! * DAY };
}

export const RECALL_SYSTEM = `You help a reader remember what they just read by asking them to explain it back.
Given the passages they highlighted, write 2 or 3 short questions that make them recall the idea, not trivia.
Prefer why and how. Each question must be answerable from one passage, under 20 words, with no answer in it.
Return ONLY JSON: {"questions":[{"q":"...","from":1}]} where "from" is the passage number.`;

export function recallPrompt(title: string, passages: RecallPassage[]): string {
  const lines = passages.map((passage, index) => `${index + 1}. "${passage.quote.slice(0, 400)}"${passage.note ? ` (my note: ${passage.note.slice(0, 200)})` : ""}`);
  return `Article: ${title}\n\nPassages I highlighted:\n${lines.join("\n")}`;
}

export function parseRecallQuestions(raw: unknown, passageCount: number): RecallQuestion[] {
  const list = questionList(raw);
  const seen = new Set<string>();
  const out: RecallQuestion[] = [];
  for (const entry of list) {
    if (!entry || typeof entry !== "object") continue;
    const { q, from } = entry as { q?: unknown; from?: unknown };
    const question = typeof q === "string" ? q.trim().slice(0, 240) : "";
    const key = question.toLowerCase();
    if (!question || seen.has(key)) continue;
    seen.add(key);
    const index = Number(from);
    out.push({ question, from: Number.isInteger(index) && index >= 1 && index <= passageCount ? index : null });
    if (out.length === RECALL_MAX_QUESTIONS) break;
  }
  return out;
}

function questionList(raw: unknown): unknown[] {
  if (raw && typeof raw === "object") {
    const questions = (raw as { questions?: unknown }).questions;
    return Array.isArray(questions) ? questions : [];
  }
  if (typeof raw !== "string") return [];
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return [];
  try {
    return questionList(JSON.parse(raw.slice(start, end + 1)));
  } catch {
    return [];
  }
}

/** Used when the model is unavailable or returns nothing usable. */
export function fallbackRecallQuestions(passages: RecallPassage[]): RecallQuestion[] {
  return passages.slice(0, RECALL_MAX_QUESTIONS).map((passage, index) => {
    const words = passage.quote.trim().split(/\s+/);
    const cue = words.length > 6 ? `${words.slice(0, 6).join(" ")}…` : words.join(" ");
    return { question: `In your own words: what is the idea behind “${cue}”?`, from: index + 1 };
  });
}
