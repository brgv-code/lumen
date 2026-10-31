// Talks to the Lumen API with the personal access token.
import type { Collection, Highlight, Item } from "@lumen/core";
import { getSettings } from "./storage";

export class CloudError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function cloud<T>(method: string, path: string, body?: unknown): Promise<T> {
  const s = await getSettings();
  if (!s.token) throw new CloudError(401, "Not connected. Add your token in Lumen settings.");
  const res = await fetch(`${s.apiBase}/api/v1${path}`, {
    method,
    headers: { authorization: `Bearer ${s.token}`, ...(body !== undefined ? { "content-type": "application/json" } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let msg = `Lumen answered ${res.status}`;
    try { msg = (await res.json()).error?.message ?? msg; } catch { /* */ }
    throw new CloudError(res.status, msg);
  }
  return res.json() as Promise<T>;
}

export const cloudApi = {
  me: () => cloud<{ user: { name: string; isDemo: boolean } }>("GET", "/me"),
  lookup: (url: string) => cloud<{ item: Item | null; highlights: Highlight[] }>("GET", `/items/lookup?url=${encodeURIComponent(url)}`),
  save: (d: { url: string; html?: string; title?: string; collectionId?: string; tags?: string[] }) => cloud<{ item: Item; created: boolean }>("POST", "/items", d),
  addHighlight: (itemId: string, d: Record<string, unknown>) => cloud<{ highlight: Highlight }>("POST", `/items/${itemId}/highlights`, d),
  updateHighlight: (id: string, d: Record<string, unknown>) => cloud<{ highlight: Highlight }>("PATCH", `/highlights/${id}`, d),
  deleteHighlight: (id: string) => cloud<{ ok: true }>("DELETE", `/highlights/${id}`),
  collections: () => cloud<{ data: Collection[] }>("GET", "/collections"),
  destinations: () => cloud<{ data: { id: string; kind: string; name: string; config: Record<string, string> }[] }>("GET", "/destinations"),
  pending: (id: string) => cloud<{ highlightIds: string[]; markdown: string }>("GET", `/destinations/${id}/pending`),
  ack: (id: string, highlightIds: string[], error?: string) => cloud<{ acked: number }>("POST", `/destinations/${id}/ack`, { highlightIds, error }),
  push: (id: string) => cloud<{ delivered: number }>("POST", `/destinations/${id}/push`, {}),
};

/**
 * Deliver the target collection's new highlights to its destination.
 * Obsidian is written from here (the vault is on this machine); Notion and
 * webhooks are pushed by the server. The ledger means this is safe to call often.
 */
export async function syncTarget(): Promise<{ sent: number; to?: string }> {
  const s = await getSettings();
  if (!s.targetCollectionId) return { sent: 0 };
  const cols = await cloudApi.collections();
  const col = cols.data.find((c) => c.id === s.targetCollectionId);
  if (!col?.destinationId) return { sent: 0 };
  const dest = (await cloudApi.destinations()).data.find((d) => d.id === col.destinationId);
  if (!dest) return { sent: 0 };
  if (dest.kind === "notion" || dest.kind === "webhook") {
    const r = await cloudApi.push(dest.id);
    return { sent: r.delivered, to: dest.name };
  }
  if (dest.kind !== "obsidian") return { sent: 0 };
  if (!s.obsidianKey) throw new CloudError(400, "Add your Obsidian Local REST API key in Lumen settings.");
  const p = await cloudApi.pending(dest.id);
  if (!p.highlightIds.length) return { sent: 0, to: dest.name };
  const base = (dest.config.baseUrl || "https://127.0.0.1:27124").replace(/\/$/, "");
  const path = String(dest.config.notePath).split("/").map(encodeURIComponent).join("/");
  const res = await fetch(`${base}/vault/${path}`, {
    method: "POST",
    headers: { authorization: `Bearer ${s.obsidianKey}`, "content-type": "text/markdown" },
    body: p.markdown,
  });
  if (!res.ok) {
    await cloudApi.ack(dest.id, p.highlightIds, `Obsidian ${res.status}`).catch(() => {});
    throw new CloudError(res.status, `Obsidian answered ${res.status}`);
  }
  await cloudApi.ack(dest.id, p.highlightIds);
  return { sent: p.highlightIds.length, to: dest.name };
}
