// Following: discover a site's RSS or Atom feed, then pull new posts. Plain string parsing keeps
// it small and tolerant of the many ways feeds are written.
import { id, now } from "./util";

const UA = { "user-agent": "LumenFollow/1.0 (+https://readwithlumen.app)", accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, text/html;q=0.8" };
const COMMON = ["/feed", "/feed.xml", "/rss.xml", "/atom.xml", "/index.xml", "/rss", "/feed/", "/blog/rss.xml", "/blog/feed", "/blog/atom.xml"];

const decode = (s: string) => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&#x27;/g, "'").replace(/&amp;/g, "&").trim();
const strip = (s: string) => decode(s).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const tag = (block: string, name: string) => { const m = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i")); return m ? m[1] : ""; };
const isFeed = (body: string) => /<(rss|feed|rdf:RDF)[\s>]/i.test(body.slice(0, 2000));

export interface FeedPost { url: string; title: string; summary: string | null; publishedAt: number | null }
export interface Feed { feedUrl: string; title: string; siteUrl: string; posts: FeedPost[] }

export function parseFeed(xml: string, base: string): { title: string; posts: FeedPost[] } {
  const atom = /<feed[\s>]/i.test(xml.slice(0, 2000));
  const chan = atom ? xml : tag(xml, "channel") || xml;
  const title = strip(tag(chan.split(/<(item|entry)[\s>]/i)[0], "title")) || new URL(base).hostname;
  const blocks = xml.match(atom ? /<entry[\s>][\s\S]*?<\/entry>/gi : /<item[\s>][\s\S]*?<\/item>/gi) ?? [];
  const posts = blocks.slice(0, 30).map((b) => {
    let link = "";
    if (atom) {
      const alt = b.match(/<link[^>]*rel=["']alternate["'][^>]*>/i)?.[0] ?? b.match(/<link[^>]*>/i)?.[0] ?? "";
      link = alt.match(/href=["']([^"']+)["']/i)?.[1] ?? "";
    } else {
      link = strip(tag(b, "link")) || strip(tag(b, "guid"));
    }
    try { link = new URL(decode(link), base).toString(); } catch { link = ""; }
    const date = strip(tag(b, "pubDate") || tag(b, "published") || tag(b, "updated") || tag(b, "dc:date"));
    const t = Date.parse(date);
    const summary = strip(tag(b, "description") || tag(b, "summary") || tag(b, "content")).slice(0, 280) || null;
    return { url: link, title: strip(tag(b, "title")).slice(0, 300) || link, summary, publishedAt: Number.isFinite(t) ? t : null };
  }).filter((p) => p.url.startsWith("http"));
  return { title: title.slice(0, 120), posts };
}

async function get(url: string) {
  const r = await fetch(url, { headers: UA, redirect: "follow", cf: { cacheTtl: 600 } } as RequestInit);
  return { ok: r.ok, url: r.url || url, type: r.headers.get("content-type") ?? "", body: r.ok ? (await r.text()).slice(0, 2_000_000) : "" };
}

/** Accepts a blog URL or a feed URL. */
export async function discover(input: string): Promise<Feed> {
  const first = await get(input);
  if (first.ok && (isFeed(first.body) || /xml|rss|atom/.test(first.type) && isFeed(first.body))) {
    const p = parseFeed(first.body, first.url);
    return { feedUrl: first.url, title: p.title, siteUrl: new URL(first.url).origin, posts: p.posts };
  }
  const site = new URL(first.url || input);
  const candidates: string[] = [];
  if (first.ok) {
    for (const m of first.body.matchAll(/<link\b[^>]*>/gi)) {
      const t = m[0];
      if (/rel=["'][^"']*alternate/i.test(t) && /type=["']application\/(rss|atom)\+xml/i.test(t)) {
        const href = t.match(/href=["']([^"']+)["']/i)?.[1];
        if (href) candidates.push(new URL(decode(href), site).toString());
      }
    }
  }
  const pathBase = site.pathname.replace(/\/[^/]*$/, "");
  for (const c of COMMON) { candidates.push(new URL(c, site.origin).toString()); if (pathBase && pathBase !== "/") candidates.push(new URL(pathBase + c, site.origin).toString()); }
  const title = first.ok ? strip(tag(first.body, "title")).split(/[|·—-]\s/)[0].slice(0, 120) : site.hostname;
  for (const c of [...new Set(candidates)].slice(0, 14)) {
    const r = await get(c).catch(() => null);
    if (r?.ok && isFeed(r.body)) {
      const p = parseFeed(r.body, r.url);
      return { feedUrl: r.url, title: p.title || title || site.hostname, siteUrl: site.origin, posts: p.posts };
    }
  }
  throw new Error("No RSS or Atom feed found on that site.");
}

/** Pull one feed and store posts we have not seen. Returns how many are new. */
export async function refreshFeed(db: D1Database, f: { id: string; user_id: string; feed_url: string; site_url: string }, firstRun = false) {
  const t = now();
  try {
    const r = await get(f.feed_url);
    if (!r.ok || !isFeed(r.body)) throw new Error(`Feed answered ${r.ok ? "with something that is not a feed" : "with an error"}`);
    const { posts } = parseFeed(r.body, r.url);
    const stmts = posts.map((p) => db.prepare(`INSERT OR IGNORE INTO feed_items (id, feed_id, user_id, url, title, summary, published_at, seen, notified, found_at) VALUES (?,?,?,?,?,?,?,?,?,?)`)
      .bind(id("fi_"), f.id, f.user_id, p.url, p.title, p.summary, p.publishedAt, firstRun ? 1 : 0, firstRun ? 1 : 0, t));
    stmts.push(db.prepare("UPDATE feeds SET last_checked_at = ?, last_error = NULL WHERE id = ?").bind(t, f.id));
    const res = await db.batch(stmts);
    // on the first run the latest 3 stay unseen so the feed is not empty on day one
    if (firstRun) await db.prepare(`UPDATE feed_items SET seen = 0 WHERE id IN (SELECT id FROM feed_items WHERE feed_id = ? ORDER BY COALESCE(published_at, found_at) DESC LIMIT 3)`).bind(f.id).run();
    return res.slice(0, posts.length).reduce((n, x) => n + (x.meta.changes ?? 0), 0);
  } catch (e) {
    await db.prepare("UPDATE feeds SET last_checked_at = ?, last_error = ? WHERE id = ?").bind(t, (e as Error).message.slice(0, 200), f.id).run();
    return 0;
  }
}

/** Cron: refresh the feeds checked longest ago. */
export async function refreshDueFeeds(db: D1Database, limit = 40) {
  const { results } = await db.prepare("SELECT id, user_id, feed_url, site_url FROM feeds WHERE last_checked_at IS NULL OR last_checked_at < ? ORDER BY COALESCE(last_checked_at, 0) LIMIT ?")
    .bind(now() - 3 * 3600_000, limit).all<{ id: string; user_id: string; feed_url: string; site_url: string }>();
  for (const f of results) await refreshFeed(db, f).catch(() => {});
}
