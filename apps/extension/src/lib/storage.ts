import type { Highlight } from "@lumen/core";
import { DEFAULT_SETTINGS, type Settings } from "./types";

const SETTINGS = "lumen_settings_v2";
const LOCAL = "lumen_local_highlights"; // offline mode: { [url]: Highlight[] }

export async function getSettings(): Promise<Settings> {
  const r = await chrome.storage.local.get(SETTINGS);
  const saved = r[SETTINGS] ?? {};
  // the old default address moved to readwithlumen.app; both serve the same accounts
  if (saved.apiBase === "https://lumen.brgv95.workers.dev") saved.apiBase = DEFAULT_SETTINGS.apiBase;
  return {
    ...DEFAULT_SETTINGS,
    ...saved,
    toolbar: { ...DEFAULT_SETTINGS.toolbar, ...(saved.toolbar ?? {}) },
    helper: { ...DEFAULT_SETTINGS.helper, ...(saved.helper ?? {}) },
  };
}

export const SETTINGS_KEY = SETTINGS;

export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await getSettings()), ...patch };
  next.apiBase = next.apiBase.replace(/\/+$/, "");
  await chrome.storage.local.set({ [SETTINGS]: next });
  return next;
}

export async function localHighlights(url: string): Promise<Highlight[]> {
  const r = await chrome.storage.local.get(LOCAL);
  return (r[LOCAL] ?? {})[url] ?? [];
}

export async function setLocalHighlights(url: string, list: Highlight[]) {
  const r = await chrome.storage.local.get(LOCAL);
  const all = r[LOCAL] ?? {};
  if (list.length) all[url] = list;
  else delete all[url];
  await chrome.storage.local.set({ [LOCAL]: all });
}

export function pageKey(url: string): string {
  try {
    const u = new URL(url);
    u.hash = "";
    for (const p of [...u.searchParams.keys()]) if (/^(utm_|fbclid|gclid|mc_|ref$)/.test(p)) u.searchParams.delete(p);
    return u.toString();
  } catch {
    return url;
  }
}
