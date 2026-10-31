// Talking to the Lumen extension from the dashboard (Chrome, Brave, Edge, Arc).
export const EXTENSION_ID = "ffjconacpmnbadoeegamifkellcddfja";

type Runtime = { sendMessage: (id: string, msg: unknown, cb: (r: any) => void) => void; lastError?: unknown };
const rt = (): Runtime | null => ((window as any).chrome?.runtime?.sendMessage ? (window as any).chrome.runtime : null);

function send<T>(msg: unknown, timeout = 1500): Promise<T | null> {
  const r = rt();
  if (!r) return Promise.resolve(null);
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(null), timeout);
    try {
      r.sendMessage(EXTENSION_ID, msg, (res) => { clearTimeout(t); void r.lastError; resolve(res ?? null); });
    } catch { clearTimeout(t); resolve(null); }
  });
}

export const extension = {
  ping: () => send<{ ok: boolean; version: string; connected: boolean; apiBase: string }>({ type: "LUMEN_PING" }),
  connect: (token: string) => send<{ ok: boolean }>({ type: "LUMEN_CONNECT", token }),
};
