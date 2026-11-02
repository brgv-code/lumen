// Talking to the Lumen extension from the dashboard (Chrome, Brave, Edge, Arc).

/** The unpacked build pins this id with a manifest key. */
export const DEV_EXTENSION_ID = "ffjconacpmnbadoeegamifkellcddfja";
/** The Chrome Web Store build's id (assigned by the store). VITE_EXTENSION_STORE_ID overrides it. */
export const STORE_EXTENSION_ID: string = import.meta.env.VITE_EXTENSION_STORE_ID || "hohicfgangllelfkhnbghegnbepjfkkk";
/** The public Chrome Web Store listing (approved 2026-11-02). VITE_EXTENSION_STORE_URL overrides it. */
export const STORE_URL: string = import.meta.env.VITE_EXTENSION_STORE_URL || "https://chromewebstore.google.com/detail/lumen/hohicfgangllelfkhnbghegnbepjfkkk";
const IDS = [STORE_EXTENSION_ID, DEV_EXTENSION_ID].filter(Boolean);

type Runtime = { sendMessage: (id: string, msg: unknown, cb: (r: any) => void) => void; lastError?: unknown };
const rt = (): Runtime | null => ((window as any).chrome?.runtime?.sendMessage ? (window as any).chrome.runtime : null);

function sendTo<T>(id: string, msg: unknown, timeout: number): Promise<T | null> {
  const r = rt();
  if (!r) return Promise.resolve(null);
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(null), timeout);
    try {
      r.sendMessage(id, msg, (res) => { clearTimeout(t); void r.lastError; resolve(res ?? null); });
    } catch { clearTimeout(t); resolve(null); }
  });
}

// whichever id answered first; the store build wins when both are installed
let found: string | null = null;
async function send<T>(msg: unknown, timeout = 1500): Promise<T | null> {
  if (found) return sendTo<T>(found, msg, timeout);
  for (const id of IDS) {
    const res = await sendTo<T>(id, msg, timeout);
    if (res) { found = id; return res; }
  }
  return null;
}

export const extension = {
  ping: () => send<{ ok: boolean; version: string; connected: boolean; apiBase: string }>({ type: "LUMEN_PING" }),
  connect: (token: string) => send<{ ok: boolean }>({ type: "LUMEN_CONNECT", token }),
  openOptions: () => send<{ ok: boolean }>({ type: "LUMEN_OPEN_OPTIONS" }),
};
