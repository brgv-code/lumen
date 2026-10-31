// Radar: watch the reader's topics across the web. Sources are public and keyless:
// Hacker News (Algolia search API) and dev.to. Refreshed by Cron and lazily on view.
import type { SessionUser } from "../env";
import { id, now } from "./util";

const STALE_MS = 6 * 3600_000;
const UA = { "user-agent": "LumenRadar/1.0 (+https://lumen.brgv95.workers.dev)" };

export interface TrendHit { url: string; title: string; source: "hn" | "devto"; score: number; comments: number; publishedAt: number | null }

/** Topics = manual topics + the reader's most used tags (auto). */
export async function topicsFor(db: D1Database, userId: string): Promise<{ name: string; source: string; muted: number; id: string | null }[]> {
  const { results: manual } = await db.prepare("SELECT id, name, source, muted FROM topics WHERE user_id = ? ORDER BY created_at").bind(userId).all<{ id: string; name: string; source: string; muted: number }>();
  const { results: tags } = await db.prepare(`SELECT t.name, count(*) AS n FROM tags t JOIN item_tags it ON it.tag_id = t.id
    WHERE t.user_id = ? GROUP BY t.id ORDER BY n DESC LIMIT 6`).bind(userId).all<{ name: string }>();
  const seen = new Set(manual.map((m) => m.name));
  return [...manual, ...tags.filter((t) => !seen.has(t.name)).map((t) => ({ id: null, name: t.name, source: "auto", muted: 0 }))];
}

async function hn(topic: string): Promise<TrendHit[]> {
  const since = Math.floor((Date.now() - 7 * 864e5) / 1000);
  const url = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(topic)}&tags=story&restrictSearchableAttributes=title&numericFilters=created_at_i>${since},points>15&hitsPerPage=8`;
  const r = await fetch(url, { headers: UA, cf: { cacheTtl: 1800 } } as RequestInit);
  if (!r.ok) return [];
  const j = await r.json<{ hits: { url?: string; title?: string; points?: number; num_comments?: number; created_at_i?: number; objectID: string }[] }>();
  return j.hits.filter((h) => h.title).map((h) => ({
    url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
    title: h.title!,
    source: "hn" as const,
    score: h.points ?? 0,
    comments: h.num_comments ?? 0,
    publishedAt: h.created_at_i ? h.created_at_i * 1000 : null,
  }));
}

async function devto(topic: string): Promise<TrendHit[]> {
  const tag = topic.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!tag) return [];
  const r = await fetch(`https://dev.to/api/articles?tag=${tag}&top=7&per_page=5`, { headers: UA, cf: { cacheTtl: 1800 } } as RequestInit);
  if (!r.ok) return [];
  const j = await r.json<{ url: string; title: string; positive_reactions_count: number; comments_count: number; published_timestamp: string }[]>();
  return j.map((a) => ({ url: a.url, title: a.title, source: "devto" as const, score: a.positive_reactions_count, comments: a.comments_count, publishedAt: Date.parse(a.published_timestamp) || null }));
}

export async function refreshRadar(db: D1Database, user: Pick<SessionUser, "id">, force = false): Promise<boolean> {
  const last = await db.prepare("SELECT ran_at FROM radar_runs WHERE user_id = ?").bind(user.id).first<{ ran_at: number }>();
  if (!force && last && now() - last.ran_at < STALE_MS) return false;
  const topics = (await topicsFor(db, user.id)).filter((t) => !t.muted).slice(0, 6);
  const t = now();
  const stmts: D1PreparedStatement[] = [db.prepare("INSERT INTO radar_runs (user_id, ran_at) VALUES (?,?) ON CONFLICT(user_id) DO UPDATE SET ran_at = excluded.ran_at").bind(user.id, t)];
  const results = await Promise.allSettled(topics.map(async (tp) => ({ topic: tp.name, hits: [...(await hn(tp.name)), ...(await devto(tp.name))] })));
  for (const r of results) {
    if (r.status !== "fulfilled") continue;
    for (const h of r.value.hits.slice(0, 10)) {
      stmts.push(db.prepare(`INSERT INTO trends (id, user_id, topic, url, title, source, score, comments, published_at, fetched_at) VALUES (?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(user_id, url) DO UPDATE SET score = excluded.score, comments = excluded.comments, fetched_at = excluded.fetched_at`)
        .bind(id("trd_"), user.id, r.value.topic, h.url.slice(0, 2000), h.title.slice(0, 300), h.source, h.score, h.comments, h.publishedAt, t));
    }
  }
  // keep the radar fresh: forget undismissed stories older than 10 days
  stmts.push(db.prepare("DELETE FROM trends WHERE user_id = ? AND fetched_at < ?").bind(user.id, t - 10 * 864e5));
  await db.batch(stmts);
  return true;
}

/** Cron: refresh radars of people active in the last 14 days (real accounts only). */
export async function refreshActiveRadars(db: D1Database) {
  const { results } = await db.prepare(`SELECT DISTINCT a.user_id AS id FROM activity a JOIN users u ON u.id = a.user_id
    WHERE u.is_demo = 0 AND a.created_at > ? LIMIT 50`).bind(now() - 14 * 864e5).all<{ id: string }>();
  for (const u of results) await refreshRadar(db, u).catch((e) => console.error("radar", u.id, e));
}
