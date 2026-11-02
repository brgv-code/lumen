// Margin answers the reader kept, and the notes that held them before LUM-1.
import type { AIAction } from "./types.ts";

/** Before LUM-1, keeping an answer wrote "Explain: …" into the highlight note. */
const NOTE_PREFIXES: Record<string, AIAction> = { "Explain: ": "explain", "Define: ": "define", "Summarize: ": "summarize", "Expand: ": "expand", "Ask: ": "ask" };

/** The answer hiding in an old note, or null when the note is the reader's own words. */
export function answerFromNote(note: string | null | undefined): { action: AIAction; answer: string } | null {
  if (!note) return null;
  for (const [prefix, action] of Object.entries(NOTE_PREFIXES)) {
    if (note.startsWith(prefix)) return { action, answer: note.slice(prefix.length) };
  }
  return null;
}

/** The heading an answer shows under, matching the answer card. */
export function answerLabel(action: AIAction): string {
  return action === "ask" ? "Answer" : action[0].toUpperCase() + action.slice(1);
}

/** Short model name for the card footer: "@cf/meta/llama-3.3-70b-instruct-fp8-fast" reads "llama-3.3-70b". */
export function modelLabel(model: string): string {
  const name = model.split("/").pop() ?? model;
  return name.replace(/-(instruct|chat)(-.*)?$/, "");
}
