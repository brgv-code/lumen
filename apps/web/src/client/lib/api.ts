import type { AIAction, Collection, Destination, Highlight, Idea, Item, ItemWithContent, Page, Stats, User } from "@lumen/core";

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

async function req<T>(method: string, path: string, data?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    credentials: "same-origin",
    headers: { "x-lumen": "1", ...(data !== undefined ? { "content-type": "application/json" } : {}) },
    body: data !== undefined ? JSON.stringify(data) : undefined,
  });
  if (!res.ok) {
    let code = "http_" + res.status, message = res.statusText || "Request failed";
    try { const j = await res.json(); code = j.error?.code ?? code; message = j.error?.message ?? message; } catch { /* not json */ }
    if (res.status === 401 && !location.pathname.startsWith("/login") && location.pathname.startsWith("/app")) location.href = "/login";
    throw new ApiError(res.status, code, message);
  }
  return res.json() as Promise<T>;
}

const qs = (o: Record<string, string | number | undefined | null | boolean>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== null && v !== "" && v !== false) p.set(k, String(v));
  const s = p.toString();
  return s ? "?" + s : "";
};

export const api = {
  providers: () => req<{ google: boolean; github: boolean; demo: boolean }>("GET", "/auth/providers"),
  demo: () => req<{ ok: true; next: string }>("POST", "/auth/demo", {}),
  logout: () => req<{ ok: true }>("POST", "/auth/logout", {}),

  me: () => req<{ user: User }>("GET", "/api/v1/me"),
  updateMe: (d: Partial<{ name: string; dailyGoal: number; timezone: string; aiProvider: string }>) => req<{ user: User }>("PATCH", "/api/v1/me", d),
  deleteMe: () => req<{ ok: true }>("DELETE", "/api/v1/me"),
  stats: () => req<Stats>("GET", "/api/v1/stats"),
  tags: () => req<{ data: { name: string; count: number }[] }>("GET", "/api/v1/tags"),

  items: (q: { status?: string; collection?: string; tag?: string; q?: string; favorite?: boolean; cursor?: string | null; limit?: number } = {}) =>
    req<Page<Item>>("GET", "/api/v1/items" + qs({ ...q, favorite: q.favorite ? 1 : undefined })),
  item: (id: string) => req<{ item: ItemWithContent; highlights: Highlight[] }>("GET", `/api/v1/items/${id}`),
  saveItem: (d: { url: string; collectionId?: string; tags?: string[] }) => req<{ item: Item; created: boolean }>("POST", "/api/v1/items", d),
  updateItem: (id: string, d: Partial<{ status: string; progress: number; favorite: boolean; collectionId: string | null; tags: string[]; title: string }>) =>
    req<{ item: Item }>("PATCH", `/api/v1/items/${id}`, d),
  deleteItem: (id: string) => req<{ ok: true }>("DELETE", `/api/v1/items/${id}`),

  addHighlight: (itemId: string, d: { quote: string; prefix: string; suffix: string; position: number; color: string; note?: string }) =>
    req<{ highlight: Highlight }>("POST", `/api/v1/items/${itemId}/highlights`, d),
  highlights: (q: { color?: string; q?: string; collection?: string; notes?: boolean; cursor?: string | null } = {}) =>
    req<Page<Highlight>>("GET", "/api/v1/highlights" + qs({ ...q, notes: q.notes ? 1 : undefined })),
  updateHighlight: (id: string, d: { color?: string; note?: string | null }) => req<{ highlight: Highlight }>("PATCH", `/api/v1/highlights/${id}`, d),
  deleteHighlight: (id: string) => req<{ ok: true }>("DELETE", `/api/v1/highlights/${id}`),

  collections: () => req<{ data: Collection[] }>("GET", "/api/v1/collections"),
  createCollection: (d: { name: string; emoji?: string; color?: string; description?: string; destinationId?: string }) =>
    req<{ collection: Collection }>("POST", "/api/v1/collections", d),
  updateCollection: (id: string, d: Partial<{ name: string; emoji: string; color: string; description: string | null; destinationId: string | null }>) =>
    req<{ collection: Collection }>("PATCH", `/api/v1/collections/${id}`, d),
  deleteCollection: (id: string) => req<{ ok: true }>("DELETE", `/api/v1/collections/${id}`),

  destinations: () => req<{ data: Destination[] }>("GET", "/api/v1/destinations"),
  createDestination: (d: { kind: string; name: string; config: Record<string, unknown>; secret?: string }) =>
    req<{ destination: Destination }>("POST", "/api/v1/destinations", d),
  deleteDestination: (id: string) => req<{ ok: true }>("DELETE", `/api/v1/destinations/${id}`),
  pending: (id: string) => req<{ highlightIds: string[]; markdown: string; groups: unknown[] }>("GET", `/api/v1/destinations/${id}/pending`),
  ack: (id: string, highlightIds: string[], error?: string) => req<{ acked: number }>("POST", `/api/v1/destinations/${id}/ack`, { highlightIds, error }),
  push: (id: string) => req<{ delivered: number }>("POST", `/api/v1/destinations/${id}/push`, {}),

  ideas: () => req<{ data: Idea[] }>("GET", "/api/v1/ideas"),
  spark: () => req<{ data: Idea[] }>("POST", "/api/v1/ai/spark", {}),
  updateIdea: (id: string, status: string) => req<{ idea: Idea }>("PATCH", `/api/v1/ideas/${id}`, { status }),

  tokens: () => req<{ data: { id: string; name: string; prefix: string; lastUsedAt: number | null; createdAt: number }[] }>("GET", "/api/v1/tokens"),
  createToken: (name: string) => req<{ id: string; token: string }>("POST", "/api/v1/tokens", { name }),
  deleteToken: (id: string) => req<{ ok: true }>("DELETE", `/api/v1/tokens/${id}`),
};

/** Stream an AI answer; calls onText with the growing answer. */
export async function streamAI(
  d: { action: AIAction; text: string; question?: string; title?: string },
  onText: (full: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const res = await fetch("/api/v1/ai/run", {
    method: "POST",
    headers: { "content-type": "application/json", "x-lumen": "1" },
    body: JSON.stringify(d),
    signal,
  });
  if (!res.ok || !res.body) {
    let msg = "The assistant is unavailable right now.";
    try { msg = (await res.json()).error?.message ?? msg; } catch { /* */ }
    throw new ApiError(res.status, "ai", msg);
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "", full = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (data === "[DONE]") return full;
      try {
        const j = JSON.parse(data);
        const t = j.response ?? j.choices?.[0]?.delta?.content ?? "";
        if (t) { full += t; onText(full); }
      } catch { /* partial */ }
    }
  }
  return full;
}
