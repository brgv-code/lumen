import { READER_SYSTEM, readerPrompt, type AIAction } from "@lumen/core";
import { safeJson } from "./map";

// Llama 3.1 8B fp8 retires on 2026-11-20; Cloudflare names Gemma 4 as the small replacement.
export const DEFAULT_MODEL = "@cf/google/gemma-4-26b-a4b-it";
export const SPARK_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
/** Ask uses the larger model: it has to reason over a whole page plus library items. */
export const CHAT_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

export function promptFor(action: AIAction, text: string, opts: { question?: string; title?: string; context?: string }) {
  return [
    { role: "system", content: READER_SYSTEM },
    { role: "user", content: readerPrompt(action, text, opts) },
  ];
}

type Completion = {
  response?: unknown;
  choices?: { message?: { content?: string | null }; delta?: { content?: string | null } }[];
};

/** The answer in either Workers AI shape: older models return `response`, newer ones OpenAI style `choices`. */
export function replyOf(out: unknown): unknown {
  if (!isCompletion(out)) return "";
  return out.response ?? out.choices?.[0]?.message?.content ?? "";
}

function isCompletion(out: unknown): out is Completion {
  return typeof out === "object" && out !== null;
}

/** Rewrites OpenAI style stream events as {"response":...}, the only field installed extensions read. */
export function asResponseEvents(stream: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let partial = "";
  const rewrite = (line: string): string | null => {
    if (!line.startsWith("data:")) return line;
    const event = safeJson<Completion>(line.slice(5).trim(), {});
    if (!event.choices) return line;
    const text = event.choices[0]?.delta?.content;
    return text ? `data: ${JSON.stringify({ response: text })}` : null;
  };
  const emit = (lines: string[], controller: TransformStreamDefaultController<Uint8Array>) => {
    const kept = lines.map(rewrite).filter((line): line is string => line !== null);
    if (kept.length) controller.enqueue(encoder.encode(kept.map((line) => `${line}\n`).join("")));
  };
  return stream.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      const lines = (partial + decoder.decode(chunk, { stream: true })).split("\n");
      partial = lines.pop() ?? "";
      emit(lines, controller);
    },
    flush(controller) {
      const rest = partial + decoder.decode();
      if (rest) controller.enqueue(encoder.encode(rewrite(rest) ?? ""));
    },
  }));
}

export const SPARK_SYSTEM =`You help a writer notice what their reading keeps circling.
Given their highlights and notes, propose exactly 3 content ideas (blog post, thread, or talk).
Return ONLY JSON: {"ideas":[{"title":"...","angle":"one sentence","outline":["point","point","point"],"sources":[1,2]}]}
"sources" are the numbers of the highlights each idea draws on. Each title is a specific working headline of 6 to 12 words, the way a writer would title a draft. No hype words.`;
