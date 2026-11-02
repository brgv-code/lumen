// The landing demo's sample article and its answers, written ahead of time (LUM-4).

export const DEMO_TERMS = ["backpressure", "bounded queue", "load shedding", "exponential backoff", "idempotent"] as const;
export type DemoTerm = (typeof DEMO_TERMS)[number];

export function isDemoTerm(value: unknown): value is DemoTerm {
  return (DEMO_TERMS as readonly unknown[]).includes(value);
}

export const DEMO_TITLE = "Backpressure, briefly";
export const DEMO_BYLINE = "Lumen sample article · 2 min";

type Segment = string | { term: DemoTerm; text: string };

const PARAGRAPHS: Segment[][] = [
  ["Every fast system eventually meets a slower one. A web server accepts requests faster than its database can answer them, and the gap has to go somewhere. ", { term: "backpressure", text: "Backpressure" }, " is the decision about where."],
  ["The simplest answer is a ", { term: "bounded queue", text: "bounded queue" }, ": hold a fixed number of waiting requests and refuse the rest. Refusing sounds rude, but an unbounded queue only hides the problem until memory runs out."],
  ["When the queue is full, a system can practise ", { term: "load shedding", text: "load shedding" }, ", dropping the least important work first, so the requests that matter still finish on time."],
  ["Callers have to cooperate too. A client that retries instantly turns one slow moment into a flood; ", { term: "exponential backoff", text: "exponential backoff" }, " spaces the retries out, and making each request ", { term: "idempotent", text: "idempotent" }, " means a retry can never do the work twice."],
];

const escape = (text: string) => text.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] ?? c);

/** Plain HTML so React never touches the text nodes the demo paints marks into. */
export const DEMO_ARTICLE_HTML = PARAGRAPHS.map((segments) => `<p>${segments
  .map((segment) => (typeof segment === "string" ? escape(segment) : `<span class="demo-term" data-term="${segment.term}">${escape(segment.text)}</span>`))
  .join("")}</p>`).join("");

export const DEMO_ANSWERS: Record<DemoTerm, string> = {
  backpressure: "A slower part of a system pushing back on a faster one, so it slows down instead of piling up work it cannot finish. Here the web server has to wait, queue or refuse requests because the database cannot keep up.",
  "bounded queue": "A waiting line with a fixed size; when it is full, new work is turned away at once. Saying no early beats a queue that accepts work until the machine runs out of memory.",
  "load shedding": "Dropping some work on purpose when overloaded. Low priority requests go first, so important ones still finish on time instead of everything getting slow together.",
  "exponential backoff": "Wait a little after a failure, then double the wait each time (1, 2, 4, 8 seconds), so many clients do not hammer a struggling service at once.",
  idempotent: "Same effect whether it runs once or five times, like setting a value instead of adding to it. If a reply is lost and the client asks again, nothing happens twice.",
};

export const DEMO_TLDR = "When one part is slower than another, decide where the extra work goes: cap the queue, drop the least important work first, and retry slowly with requests that are safe to repeat.";

export const DEMO_COPY = {
  hint: "Try it here. Select a sentence, or an underlined term.",
  footer: "Written ahead of time for this demo",
  kept: "Kept on the passage. In Lumen it also lands in your notes.",
  unknown: "This demo knows five terms",
  library: "That one needs your library",
  install: "Install Lumen to ask, note and keep answers on anything you read.",
};
