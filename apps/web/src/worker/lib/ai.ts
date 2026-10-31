import { READER_SYSTEM, readerPrompt, type AIAction } from "@lumen/core";

export const DEFAULT_MODEL = "@cf/meta/llama-3.1-8b-instruct-fp8";
export const SPARK_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
/** Ask uses the larger model: it has to reason over a whole page plus library items. */
export const CHAT_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

export function promptFor(action: AIAction, text: string, opts: { question?: string; title?: string; context?: string }) {
  return [
    { role: "system", content: READER_SYSTEM },
    { role: "user", content: readerPrompt(action, text, opts) },
  ];
}

export const SPARK_SYSTEM = `You help a writer notice what their reading keeps circling.
Given their highlights and notes, propose exactly 3 content ideas (blog post, thread, or talk).
Return ONLY JSON: {"ideas":[{"title":"...","angle":"one sentence","outline":["point","point","point"],"sources":[1,2]}]}
"sources" are the numbers of the highlights each idea draws on. Each title is a specific working headline of 6 to 12 words, the way a writer would title a draft. No hype words.`;
