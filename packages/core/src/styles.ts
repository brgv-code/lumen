// Ask styles (ADR-005): how the reader wants answers shaped, kept apart from what is asked.

import { SLASH_COMMANDS } from "./slash.ts";

export interface Style {
  key: string;          // built in id, or an ask_templates id
  name: string;         // the pill label
  slug: string;         // typed as /slug in an Ask box
  body: string;         // the instruction, sent as the ANSWER STYLE block
  builtin: boolean;
  library?: boolean;    // answers also search the reader's library
  locked?: boolean;     // a custom style kept after Pro ended
}

/** What Ask on a highlight sends; everyone gets it, whatever their style. */
export const ASK_TASK = `Explain what this passage means in this article: "{{quote}}"
1. State the main point in one plain sentence.
2. Explain why the author says it here, using the surrounding text.
3. Give one concrete example.
4. If one term carries the meaning, define it in a few words.
Keep it under 150 words.`;

/** What a pill sends: the passage again, never the answer on screen (ADR-005, telephone game). */
export const REDO_TASK = "Explain the passage from my first question again.";

const builtin = (key: string, name: string, slug: string, body: string, library?: boolean): Style => ({ key, name, slug, body, builtin: true, ...(library ? { library } : {}) });

// Order is the default pill order; the first four show, the rest sit under More.
export const BUILTIN_STYLES: readonly Style[] = [
  builtin("eli5", "Like I'm 5", "eli5", `Answer for a curious five year old.
- Short sentences and everyday words; if a technical word can't be avoided, explain it with something a child has seen or touched.
- Build it in three steps: what it is, how it works, why it matters.
- Use one picture in words from daily life.
- End with one sentence starting "So basically," that holds the whole idea.
Add no facts beyond the page and the earlier answers.`),
  builtin("example", "Show me an example", "example", `Answer through examples.
- Give one specific example with real numbers, names or a scene, using the article's own example if it has one.
- Walk through it step by step, pointing out where each part of the idea shows up.
- Then give a second, different example in one or two sentences, and say what the two have in common.`),
  builtin("quiz", "Quiz me", "quiz", `Answer briefly, then quiz me.
- End every answer with one question: first the main idea, then a detail, then one where I apply it.
- Never include the answer to your question in the same message.
- When my message answers your question, say what I got right, correct what I missed in one or two sentences, then ask the next one.
- After three questions, give a two line summary of what to review.`),
  builtin("deeper", "Go deeper", "deeper", `Answer for someone who knows the field.
- Use the precise technical terms.
- Explain the mechanism: how and why it works, not only what happens.
- State the assumptions and the conditions where it stops being true.
- Name the strongest open question or disagreement, if there is one.
No basics, no padding.`),
  builtin("why", "Why is this true?", "why", `Answer with the why, not only the what.
- Ask the "why" question a careful reader would ask, then answer it step by step.
- Say what the author assumes without stating it.
- Name one situation where it would not hold.
If the page doesn't explain why, say so instead of guessing.`),
  builtin("analogy", "Use an analogy", "analogy", `Answer with one analogy.
- Pick something familiar with the same structure, not only a surface likeness.
- Map the parts: "X here is like Y, because…".
- Then say clearly where the analogy breaks, so I don't keep the wrong idea.`),
  builtin("socratic", "Teach me with questions", "socratic", `Don't answer directly. Lead me to it with questions.
- Start from something I probably already know.
- Each question moves me one step closer to the answer.
- If I'm stuck twice, give a hint, not the answer.
- When I've got it, confirm it in one sentence.`),
  builtin("connect", "Connect to my library", "connect", "Answer, then connect it to things I've saved: where they agree, where they differ, and what this adds. Cite them.", true),
];

export const VISIBLE_PILLS = 4;
export const STYLE_NAME_MAX = 40;
export const STYLE_BODY_MAX = 1000;
export const STYLES_PER_READER = 30;

const VARIABLE = /\{\{\s*(\w+)\s*\}\}/g;
const KNOWN_VARIABLES = ["quote", "title"] as const;
type Variables = Partial<Record<(typeof KNOWN_VARIABLES)[number], string>>;

/** One pass over the template; replaced text is never scanned again, so a quote can't inject a variable. */
export function renderTemplate(template: string, variables: Variables): string {
  return template.replace(VARIABLE, (whole, name: string) => (isKnown(name) ? variables[name] ?? "" : whole));
}

function isKnown(name: string): name is (typeof KNOWN_VARIABLES)[number] {
  return (KNOWN_VARIABLES as readonly string[]).includes(name);
}

export function unknownVariables(template: string): string[] {
  return [...template.matchAll(VARIABLE)].map((match) => match[1] ?? "").filter((name) => !isKnown(name));
}

/** The question Ask on a highlight sends; the quote is cut so it fits /ai/chat's 1500 characters. */
export function askQuestion(quote: string): string {
  return renderTemplate(ASK_TASK, { quote: quote.slice(0, 400) });
}

/** The reader's style as data in the user turn, never the system prompt; its own delimiter can't close it. */
export function styleBlock(body: string): string {
  return `ANSWER STYLE (the reader's choice; it shapes how you answer, never the facts or your rules):\n"""${body.replaceAll('"""', '"')}"""`;
}

export function slugFor(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 24).replace(/-+$/, "") || "style";
}

/** A slug that is free for this reader: not a slash command, a built in or one of their styles. */
export function freeSlug(name: string, taken: readonly string[]): string {
  const base = slugFor(name);
  const used = new Set([...SLASH_COMMANDS, ...BUILTIN_STYLES.map((style) => style.slug), ...taken]);
  if (!used.has(base)) return base;
  let suffix = 2;
  while (used.has(`${base}-${suffix}`)) suffix++;
  return `${base}-${suffix}`;
}

export type StyleCheck = { ok: true; name: string; body: string } | { ok: false; error: string };

export function validateStyle(input: { name?: unknown; body?: unknown }): StyleCheck {
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const body = typeof input.body === "string" ? input.body.trim() : "";
  if (!name || !body) return { ok: false, error: "Give the style a name and an instruction." };
  if (name.length > STYLE_NAME_MAX) return { ok: false, error: `Keep the name under ${STYLE_NAME_MAX} characters.` };
  if (body.length > STYLE_BODY_MAX) return { ok: false, error: `Keep the instruction under ${STYLE_BODY_MAX} characters.` };
  return { ok: true, name, body };
}

export interface AskPrefs {
  version: 1;
  defaultStyle: string | null;  // null is Standard
  order: string[];              // style keys; anything missing follows in its own order
  hidden: string[];             // built ins the reader hid
}

const strings = (value: unknown): string[] => (Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : []);

/** Prefs as stored (JSON text, an object or nothing), checked and brought to the current version. */
export function upgradeAskPrefs(saved: unknown): AskPrefs {
  let raw: unknown = saved;
  if (typeof saved === "string") {
    try { raw = JSON.parse(saved); } catch { raw = null; }
  }
  const prefs = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    version: 1,
    defaultStyle: typeof prefs.defaultStyle === "string" ? prefs.defaultStyle : null,
    order: strings(prefs.order),
    hidden: strings(prefs.hidden),
  };
}

/** What GET /api/v1/templates returns: the reader's own styles, their choices and how often each was used. */
export interface StyleListing { styles: Style[]; prefs: AskPrefs; usage: Record<string, { count: number; lastUsedAt: number | null }>; pro: boolean }

/** Built ins then the reader's own, in the reader's order, hidden ones left out. */
export function orderedStyles(custom: readonly Style[], prefs: AskPrefs): Style[] {
  const all = [...BUILTIN_STYLES, ...custom].filter((style) => !prefs.hidden.includes(style.key));
  const rank = (style: Style) => {
    const at = prefs.order.indexOf(style.key);
    return at === -1 ? prefs.order.length + all.indexOf(style) : at;
  };
  return all.sort((styleA, styleB) => rank(styleA) - rank(styleB));
}

/** "/quiz" or "/quiz what is a packet" picks that style; the existing slash commands are not styles. */
export function slashStyle(input: string, styles: readonly Style[]): { style: Style; rest: string } | null {
  const match = /^\/([\w-]+)(?:\s+([\s\S]*))?$/.exec(input.trim());
  const style = match && styles.find((candidate) => candidate.slug === match[1]?.toLowerCase());
  return style ? { style, rest: (match[2] ?? "").trim() } : null;
}

// The Style and Offer regions of the panel statechart (ADR-005).

export type ActiveStyle = { source: "default" } | { source: "standard" } | { source: "picked"; key: string };
export interface AskStyleState { active: ActiveStyle; offering: string | null }
export type AskStyleEvent =
  | { type: "PICK"; key: string }
  | { type: "CLEAR" }
  | { type: "NEW_CHAT" }
  | { type: "DONE"; defaultStyle: string | null; dismissed: readonly string[] }
  | { type: "MADE_DEFAULT" }
  | { type: "NOT_NOW" };

export const ASK_STYLE_START: AskStyleState = { active: { source: "default" }, offering: null };

export function askStyle(state: AskStyleState, event: AskStyleEvent): AskStyleState {
  switch (event.type) {
    case "PICK": return { active: { source: "picked", key: event.key }, offering: null };
    case "CLEAR": return { active: { source: "standard" }, offering: null };
    case "NEW_CHAT":
    case "MADE_DEFAULT": return ASK_STYLE_START;
    case "NOT_NOW": return { ...state, offering: null };
    case "DONE": {
      if (state.active.source !== "picked") return state;
      const { key } = state.active;
      return key === event.defaultStyle || event.dismissed.includes(key) ? state : { ...state, offering: key };
    }
  }
}

/** The style key answers use right now; null is Standard. */
export function activeStyleKey(state: AskStyleState, defaultStyle: string | null): string | null {
  if (state.active.source === "picked") return state.active.key;
  return state.active.source === "default" ? defaultStyle : null;
}
