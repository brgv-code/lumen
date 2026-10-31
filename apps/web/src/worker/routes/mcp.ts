// Lumen as an MCP server (Streamable HTTP transport, JSON responses).
// Agents such as Claude Code, Claude Desktop or Cursor connect with a Lumen access
// token and can read, add to and analyse the reader's library. Every tool calls the
// same REST routes the web app uses, so permissions and glow rules stay identical.
import { Hono } from "hono";
import type { AppEnv, SelfFetch } from "../env";
import { userForBearer } from "../lib/session";

const SERVER = { name: "lumen", title: "Lumen reading library", version: "2.1.0" };
const VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];

const INSTRUCTIONS = `Lumen is the user's reading library: saved articles, highlights with margin notes, collections, reading stats, and a radar of trending stories in their topics.
Use search_library or get_daily_reads to see what they are reading, get_item for full text plus highlights, and list_highlights to quote their own words back.
Use get_trending and suggest_content to propose what to read or write next. Save things with save_url and add_highlight only when the user asks.`;

type Json = Record<string, unknown>;
interface Tool {
  name: string;
  title: string;
  description: string;
  inputSchema: Json;
  annotations?: Json;
  run: (args: Json, call: SelfFetch) => Promise<unknown>;
}

const str = { type: "string" };
const int = (min: number, max: number) => ({ type: "integer", minimum: min, maximum: max });
const qs = (o: Json) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== null && v !== "") p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : "";
};

async function api(call: SelfFetch, path: string, init?: RequestInit) {
  const res = await call(path, init);
  const data = (await res.json().catch(() => ({}))) as Json;
  if (!res.ok) throw new Error(((data.error as Json)?.message as string) ?? `HTTP ${res.status}`);
  return data;
}

const slimItem = (i: Json) => ({
  id: i.id, title: i.title, url: i.url, site: i.siteName, status: i.status, progress: i.progress,
  minutes: i.readingMinutes, tags: i.tags, highlights: i.highlightCount, saved: new Date(i.createdAt as number).toISOString().slice(0, 10),
});

const TOOLS: Tool[] = [
  {
    name: "search_library",
    title: "Search library",
    description: "Search the user's saved articles and bookmarks by text, status, tag or collection. Returns titles, URLs, status and progress.",
    inputSchema: { type: "object", properties: { query: str, status: { type: "string", enum: ["inbox", "reading", "done", "archived", "all"] }, tag: str, collection_id: str, limit: int(1, 50) } },
    annotations: { readOnlyHint: true },
    run: async (a, call) => {
      const r = await api(call, `/api/v1/items${qs({ q: a.query, status: a.status, tag: a.tag, collection: a.collection_id, limit: a.limit ?? 15 })}`);
      return (r.data as Json[]).map(slimItem);
    },
  },
  {
    name: "get_item",
    title: "Read an item",
    description: "Get one saved article: metadata, its readable text (trimmed to max_chars) and all of the user's highlights and notes on it.",
    inputSchema: { type: "object", properties: { id: str, max_chars: int(500, 40000) }, required: ["id"] },
    annotations: { readOnlyHint: true },
    run: async (a, call) => {
      const r = await api(call, `/api/v1/items/${encodeURIComponent(String(a.id))}`);
      const item = r.item as Json;
      const html = String(item.contentHtml ?? "");
      const text = html.replace(/<\/(p|h\d|li|blockquote)>/g, "\n\n").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\n{3,}/g, "\n\n").trim();
      return {
        ...slimItem(item),
        author: item.author,
        text: text.slice(0, Number(a.max_chars) || 12000),
        highlights: (r.highlights as Json[]).map((h) => ({ id: h.id, quote: h.quote, note: h.note, color: h.color })),
        readersLikeYouSavedThis: r.alsoSaving,
      };
    },
  },
  {
    name: "list_highlights",
    title: "List highlights",
    description: "The user's highlights and margin notes across everything they read, newest first. Filter by text, colour, or only those with notes.",
    inputSchema: { type: "object", properties: { query: str, color: { type: "string", enum: ["sun", "mint", "iris", "peach", "sky"] }, with_notes: { type: "boolean" }, limit: int(1, 100) } },
    annotations: { readOnlyHint: true },
    run: async (a, call) => {
      const r = await api(call, `/api/v1/highlights${qs({ q: a.query, color: a.color, notes: a.with_notes ? 1 : undefined, limit: a.limit ?? 30 })}`);
      return (r.data as Json[]).map((h) => ({ id: h.id, quote: h.quote, note: h.note, color: h.color, source: (h.item as Json)?.title, url: (h.item as Json)?.url, itemId: h.itemId }));
    },
  },
  {
    name: "get_daily_reads",
    title: "Daily or weekly reads",
    description: "Today's (or this week's) reading plan: what to finish, what fits the time budget from the inbox, highlights worth revisiting, and trending stories in the user's topics.",
    inputSchema: { type: "object", properties: { period: { type: "string", enum: ["daily", "weekly"] } } },
    annotations: { readOnlyHint: true },
    run: async (a, call) => {
      const r = await api(call, `/api/v1/reads${qs({ period: a.period ?? "daily" })}`);
      return { ...r, picks: (r.picks as Json[]).map(slimItem), resurface: (r.resurface as Json[]).map((h) => ({ quote: h.quote, note: h.note, source: (h.item as Json)?.title })) };
    },
  },
  {
    name: "get_trending",
    title: "Trending in my topics",
    description: "Stories trending this week (Hacker News, dev.to) in the topics the user reads about. Topics come from their tags plus topics they follow.",
    inputSchema: { type: "object", properties: { topic: str, limit: int(1, 40) } },
    annotations: { readOnlyHint: true, openWorldHint: true },
    run: async (a, call) => {
      const r = await api(call, "/api/v1/radar");
      let t = r.trends as Json[];
      if (a.topic) t = t.filter((x) => String(x.topic).toLowerCase() === String(a.topic).toLowerCase());
      return { topics: (r.topics as Json[]).filter((x) => !x.muted).map((x) => x.name), trends: t.slice(0, Number(a.limit) || 15) };
    },
  },
  {
    name: "suggest_content",
    title: "Suggest content to write",
    description: "Generate writing ideas (posts, threads, talks) from the user's own highlights and notes, each citing the sources it draws on. Saves them to Spark.",
    inputSchema: { type: "object", properties: {} },
    run: async (_a, call) => (await api(call, "/api/v1/ai/spark", { method: "POST", body: "{}" })).data,
  },
  {
    name: "get_reading_stats",
    title: "Reading stats and analytics",
    description: "Streak, glow, level, counts, completion rate, words read, top topics and sources, highlight colours and the hours they read most.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true },
    run: async (_a, call) => {
      const [s, a] = await Promise.all([api(call, "/api/v1/stats"), api(call, "/api/v1/analytics")]);
      return { ...s, totals: a.totals, topics: a.topics, sites: a.sites, colors: a.colors, hours: a.hours, weeks: a.weeks };
    },
  },
  {
    name: "list_collections",
    title: "List collections",
    description: "The user's collections (one per project or piece of writing) with counts and whether they send highlights to a destination.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true },
    run: async (_a, call) => (await api(call, "/api/v1/collections")).data,
  },
  {
    name: "readers_like_you",
    title: "What similar readers save",
    description: "Articles saved by at least two readers whose libraries overlap with the user's (anonymous, aggregate only).",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true },
    run: async (_a, call) => (await api(call, "/api/v1/similar")).data,
  },
  {
    name: "save_url",
    title: "Save a link",
    description: "Save a URL to the user's library (Lumen fetches a clean reader view). Optional collection and tags. Saving the same URL twice returns the existing item.",
    inputSchema: { type: "object", properties: { url: str, collection_id: str, tags: { type: "array", items: str } }, required: ["url"] },
    annotations: { idempotentHint: true, openWorldHint: true },
    run: async (a, call) => {
      const r = await api(call, "/api/v1/items", { method: "POST", body: JSON.stringify({ url: a.url, collectionId: a.collection_id, tags: a.tags }) });
      return { created: r.created, item: slimItem(r.item as Json) };
    },
  },
  {
    name: "add_highlight",
    title: "Highlight a passage",
    description: "Highlight an exact passage from a saved item's text, optionally with a margin note. The quote must appear in the item text (use get_item first).",
    inputSchema: { type: "object", properties: { item_id: str, quote: str, note: str, color: { type: "string", enum: ["sun", "mint", "iris", "peach", "sky"] } }, required: ["item_id", "quote"] },
    run: async (a, call) => {
      const r = await api(call, `/api/v1/items/${encodeURIComponent(String(a.item_id))}`);
      const item = r.item as Json;
      const text = String(item.contentHtml ?? "").replace(/<[^>]+>/g, "");
      const q = String(a.quote);
      const at = text.indexOf(q);
      const sel = at >= 0 ? { prefix: text.slice(Math.max(0, at - 32), at), suffix: text.slice(at + q.length, at + q.length + 32), position: at } : { prefix: "", suffix: "", position: 0 };
      const h = await api(call, `/api/v1/items/${encodeURIComponent(String(a.item_id))}/highlights`, { method: "POST", body: JSON.stringify({ quote: q, note: a.note, color: a.color ?? "iris", ...sel }) });
      return { highlight: h.highlight, anchored: at >= 0 };
    },
  },
  {
    name: "add_note",
    title: "Add a margin note",
    description: "Add or replace the margin note on an existing highlight.",
    inputSchema: { type: "object", properties: { highlight_id: str, note: str }, required: ["highlight_id", "note"] },
    annotations: { idempotentHint: true },
    run: async (a, call) => (await api(call, `/api/v1/highlights/${encodeURIComponent(String(a.highlight_id))}`, { method: "PATCH", body: JSON.stringify({ note: a.note }) })).highlight,
  },
  {
    name: "set_status",
    title: "Move an item",
    description: "Set an item's status: inbox, reading, done (finishing awards glow) or archived.",
    inputSchema: { type: "object", properties: { item_id: str, status: { type: "string", enum: ["inbox", "reading", "done", "archived"] } }, required: ["item_id", "status"] },
    annotations: { idempotentHint: true },
    run: async (a, call) => slimItem((await api(call, `/api/v1/items/${encodeURIComponent(String(a.item_id))}`, { method: "PATCH", body: JSON.stringify({ status: a.status }) })).item as Json),
  },
  {
    name: "follow_topic",
    title: "Follow a topic",
    description: "Add a topic to the user's radar so Lumen watches it for trending stories.",
    inputSchema: { type: "object", properties: { topic: str }, required: ["topic"] },
    run: async (a, call) => api(call, "/api/v1/topics", { method: "POST", body: JSON.stringify({ name: a.topic }) }),
  },
];

const PROMPTS = [
  { name: "weekly_review", title: "Weekly reading review", description: "Review this week's reading: what I finished, what I highlighted, what is trending in my topics, and what to write next." },
  { name: "what_to_read", title: "What should I read now?", description: "Pick the best next read for the time I have." },
];

function rpcResult(id: unknown, result: unknown) { return { jsonrpc: "2.0", id, result }; }
function rpcError(id: unknown, code: number, message: string) { return { jsonrpc: "2.0", id, error: { code, message } }; }

export function mcpApp(fetchApp: (req: Request) => Promise<Response>) {
  const mcp = new Hono<AppEnv>();

  mcp.get("/", (c) => c.json({ error: "Use POST with JSON-RPC. This server does not open SSE streams." }, 405, { allow: "POST" }));
  mcp.delete("/", (c) => c.body(null, 405));

  mcp.post("/", async (c) => {
    const auth = c.req.header("authorization");
    const token = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : "";
    const user = token ? await userForBearer(c.env, token) : null;
    if (!user) {
      return c.json(rpcError(null, -32001, "Unauthorized: create a key with Connect agent in Lumen and send it as a Bearer token."), 401, {
        "www-authenticate": 'Bearer realm="lumen", error="invalid_token"',
      });
    }
    const origin = new URL(c.req.url).origin;
    const call: SelfFetch = (path, init) =>
      fetchApp(new Request(origin + path, { ...init, headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...(init?.headers ?? {}) } }));

    let payload: unknown;
    try { payload = await c.req.json(); } catch { return c.json(rpcError(null, -32700, "Parse error"), 400); }
    const batch = Array.isArray(payload);
    const messages = (batch ? payload : [payload]) as Json[];
    const out: unknown[] = [];

    for (const m of messages) {
      const hasId = m.id !== undefined && m.id !== null;
      const method = String(m.method ?? "");
      const params = (m.params ?? {}) as Json;
      try {
        if (!hasId) {
          // notifications (initialized, cancelled, …) need no answer
          continue;
        }
        switch (method) {
          case "initialize": {
            const asked = String(params.protocolVersion ?? "");
            const clientName = String(((params.clientInfo as Json) ?? {}).name ?? "").slice(0, 60);
            if (clientName) await c.env.DB.prepare("UPDATE api_tokens SET client = ?, kind = 'agent' WHERE id = ?").bind(clientName, user.token_id).run();
            out.push(rpcResult(m.id, {
              protocolVersion: VERSIONS.includes(asked) ? asked : VERSIONS[0],
              capabilities: { tools: { listChanged: false }, prompts: { listChanged: false } },
              serverInfo: SERVER,
              instructions: INSTRUCTIONS,
            }));
            break;
          }
          case "ping":
            out.push(rpcResult(m.id, {}));
            break;
          case "tools/list":
            out.push(rpcResult(m.id, { tools: TOOLS.map(({ run: _r, ...t }) => t) }));
            break;
          case "tools/call": {
            const tool = TOOLS.find((t) => t.name === params.name);
            if (!tool) { out.push(rpcError(m.id, -32602, `Unknown tool: ${String(params.name)}`)); break; }
            try {
              const data = await tool.run((params.arguments ?? {}) as Json, call);
              out.push(rpcResult(m.id, {
                content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
                ...(data && typeof data === "object" && !Array.isArray(data) ? { structuredContent: data } : {}),
              }));
            } catch (e) {
              out.push(rpcResult(m.id, { content: [{ type: "text", text: e instanceof Error ? e.message : String(e) }], isError: true }));
            }
            break;
          }
          case "prompts/list":
            out.push(rpcResult(m.id, { prompts: PROMPTS }));
            break;
          case "prompts/get": {
            const p = PROMPTS.find((x) => x.name === params.name);
            if (!p) { out.push(rpcError(m.id, -32602, "Unknown prompt")); break; }
            const text = p.name === "weekly_review"
              ? "Use Lumen to review my week of reading. Call get_reading_stats, get_daily_reads with period weekly, list_highlights (limit 40) and get_trending. Then give me: what I finished, the three ideas I keep circling (quote my highlights), what is trending in my topics that connects to them, and two pieces I could write next. Offer to save any trending story I pick."
              : "Use Lumen to pick what I should read now. Call get_daily_reads and ask me how many minutes I have if it is not obvious. Recommend one item and say why in two sentences.";
            out.push(rpcResult(m.id, { description: p.description, messages: [{ role: "user", content: { type: "text", text } }] }));
            break;
          }
          case "resources/list":
            out.push(rpcResult(m.id, { resources: [] }));
            break;
          default:
            out.push(rpcError(m.id, -32601, `Method not found: ${method}`));
        }
      } catch (e) {
        out.push(rpcError(m.id, -32603, e instanceof Error ? e.message : "Internal error"));
      }
    }

    if (!out.length) return c.body(null, 202);
    return c.json(batch ? out : out[0]);
  });

  return mcp;
}

export const MCP_TOOL_NAMES = TOOLS.map((t) => ({ name: t.name, title: t.title, description: t.description, readOnly: Boolean(t.annotations?.readOnlyHint) }));
