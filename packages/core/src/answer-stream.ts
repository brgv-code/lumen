/** What a margin answer card shows. Every event names its request, so a card only ever shows one stream. */
export type AnswerStream = { requestId: number; kind: "answer" | "tldr"; text: string; model: string | null }
  & ({ status: "streaming" } | { status: "done" } | { status: "failed"; error: string });

export type AnswerEvent =
  | { type: "chunk"; requestId: number; chunk: string }
  | { type: "done"; requestId: number; model: string | null }
  | { type: "error"; requestId: number; error: string };

export function startAnswer(requestId: number, kind: AnswerStream["kind"]): AnswerStream {
  return { requestId, kind, text: "", model: null, status: "streaming" };
}

export function cachedAnswer(requestId: number, kind: AnswerStream["kind"], cached: { text: string; model: string | null }): AnswerStream {
  return { requestId, kind, text: cached.text, model: cached.model, status: "done" };
}

/** The card after one event; the same card back when the event belongs to another request or the card has finished. */
export function applyAnswerEvent(stream: AnswerStream | null, event: AnswerEvent): AnswerStream | null {
  if (!stream || stream.requestId !== event.requestId || stream.status !== "streaming") return stream;
  if (event.type === "chunk") return { ...stream, text: stream.text + event.chunk };
  if (event.type === "done") return { ...stream, model: event.model, status: "done" };
  return { ...stream, status: "failed", error: event.error };
}

/** The request a card should cancel when it closes or is replaced: only one still streaming. */
export function requestToCancel(stream: AnswerStream | null): number | null {
  return stream?.status === "streaming" ? stream.requestId : null;
}
