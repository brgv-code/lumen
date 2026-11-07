// What the selection bar can offer, in what order, and how old settings carry over.

export const BAR_ACTIONS = ["highlight", "note", "explain", "simplify", "expand", "summarize", "define", "counterpoint", "related", "ask", "save", "copy", "cite"] as const;
export type BarAction = (typeof BAR_ACTIONS)[number];

// Ask and Define on the bar: readers use them most and should not have to open More (BUG-2).
export const DEFAULT_BAR_ACTIONS: BarAction[] = ["highlight", "note", "ask", "define", "explain", "simplify", "copy"];

/** The default before LUM-1, when Copy still meant copy with citation. */
const PREVIOUS_DEFAULT = ["highlight", "note", "explain", "expand", "summarize", "save", "copy"];

/** The LUM-1 default (settings version 2), before Ask and Define joined the bar. */
const LUM1_DEFAULT = ["highlight", "note", "explain", "simplify", "copy"];

/** Settings that went through upgradeBarActions carry this version. */
export const BAR_SETTINGS_VERSION = 3;

/** More lists every action not on the bar, in this order. Summary waits for TL;DR (LUM-3). */
const MENU_ORDER: BarAction[] = ["ask", "define", "counterpoint", "related", "expand", "save", "cite", "explain", "simplify", "copy", "note"];

export const BAR_LABEL: Record<BarAction, string> = {
  highlight: "Highlight",
  note: "Note",
  explain: "Explain",
  simplify: "Simplify",
  expand: "Expand",
  summarize: "TL;DR",
  define: "Define",
  counterpoint: "Counterpoint",
  related: "Related in your library",
  ask: "Ask",
  save: "Save",
  copy: "Copy",
  cite: "Copy with citation",
};

/** Wording inside the More menu, where there is room for a longer line. */
export const MENU_LABEL: Partial<Record<BarAction, string>> = { ask: "Ask about this…" };

export function menuActions(onBar: readonly BarAction[]): BarAction[] {
  return MENU_ORDER.filter((action) => !onBar.includes(action));
}

export function isBarAction(value: unknown): value is BarAction {
  return (BAR_ACTIONS as readonly unknown[]).includes(value);
}

/**
 * The reader's bar after LUM-1. The old default becomes the new one; a customised list keeps its
 * choices, with Copy turned into Copy with citation (what it used to do) and Simplify added.
 */
export function upgradeBarActions(saved: unknown, version: number | undefined): BarAction[] {
  if (version === 2 && sameList(saved, LUM1_DEFAULT)) return [...DEFAULT_BAR_ACTIONS];
  if (version === 2 || version === BAR_SETTINGS_VERSION) return Array.isArray(saved) ? [...new Set(saved.filter(isBarAction))] : [...DEFAULT_BAR_ACTIONS];
  if (!Array.isArray(saved) || !saved.length) return [...DEFAULT_BAR_ACTIONS];
  if (sameList(saved, PREVIOUS_DEFAULT)) return [...DEFAULT_BAR_ACTIONS];
  const kept = saved.map((action) => (action === "copy" ? "cite" : action)).filter(isBarAction);
  if (!kept.includes("simplify")) {
    const afterExplain = kept.indexOf("explain") + 1;
    kept.splice(afterExplain || kept.length, 0, "simplify");
  }
  return [...new Set(kept)];
}

function sameList(saved: unknown, list: readonly string[]): boolean {
  return Array.isArray(saved) && saved.length === list.length && saved.every((action, index) => action === list[index]);
}
