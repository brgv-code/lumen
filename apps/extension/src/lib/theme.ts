import type { Settings } from "./types";

export function resolveTheme(t: Settings["theme"]): "light" | "dark" {
  if (t === "light" || t === "dark") return t;
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** For extension pages (popup, panel, settings): set data-theme on <html> and keep it in sync. */
export function applyPageTheme(t: Settings["theme"]) {
  const set = () => { document.documentElement.dataset.theme = resolveTheme(t); };
  set();
  matchMedia("(prefers-color-scheme: dark)").onchange = set;
}
