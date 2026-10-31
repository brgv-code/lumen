import { useEffect, useState } from "react";
import { Bell, BellOff, Check, ExternalLink, Heart, Plus, RefreshCw, Rss, Trash2, BookmarkPlus } from "lucide-react";
import { api, type FeedPost, type FollowedFeed } from "../../lib/api";
import { useAsync, timeAgo, hostOf } from "../../lib/hooks";
import { Empty, useToast } from "../../components/ui";
import { PageHero } from "../../components/PageHero";
import { SiteLetter } from "../../components/cards";
import { useApp } from "./Layout";

export default function Following() {
  const toast = useToast();
  const { refresh } = useApp();
  const feeds = useAsync(() => api.following(), []);
  const [filter, setFilter] = useState<string | null>(null);
  const [onlyNew, setOnlyNew] = useState(false);
  const posts = useAsync(() => api.feedPosts({ feed: filter ?? undefined, unseen: onlyNew, limit: 60 }), [filter, onlyNew]);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);

  // feeds refresh in the background on first view; pick up the result shortly after
  useEffect(() => {
    if (feeds.data?.refreshing) { const t = setTimeout(() => { feeds.reload(); posts.reload(); }, 6000); return () => clearTimeout(t); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feeds.data?.refreshing]);

  const follow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    setBusy(true);
    try {
      const r = await api.follow(url.trim());
      toast(r.created ? `Following ${r.feed.title}` : `Already following ${r.feed.title}`, r.created ? "glow" : "ok");
      setUrl(""); feeds.reload(); posts.reload();
    } catch (err) { toast((err as Error).message, "err"); } finally { setBusy(false); }
  };

  const open = async (p: FeedPost) => {
    if (!p.seen) { api.markPostSeen(p.id).catch(() => {}); posts.setData((d) => d && { data: d.data.map((x) => (x.id === p.id ? { ...x, seen: true } : x)) }); }
  };
  const save = async (p: FeedPost) => {
    try {
      await api.saveItem({ url: p.url });
      posts.setData((d) => d && { data: d.data.map((x) => (x.id === p.id ? { ...x, saved: true, seen: true } : x)) });
      api.markPostSeen(p.id).catch(() => {});
      refresh();
      toast(<>Saved to your library <span className="muted">+1 glow</span></>, "glow");
    } catch (err) { toast((err as Error).message, "err"); }
  };

  const list = feeds.data?.feeds ?? [];
  return (
    <div className="page">
      <PageHero pill={<><Heart size={13} /> Following</>} lead="Blogs you love," pay="never missed."
        sub="Follow any blog and Lumen checks it every few hours. New posts land here, on Home, and as a notification from the extension."
        mesh="mesh-peach" tiles={[["tile--peach", <Heart />], ["tile--lamp", <Bell />], ["tile--sky", <Rss />], ["tile--mint", <BookmarkPlus />]]}
        actions={<form className="row" style={{ flexWrap: "wrap" }} onSubmit={follow}>
          <input className="input" style={{ width: 300, height: 36 }} placeholder="Blog address or RSS feed" value={url} onChange={(e) => setUrl(e.target.value)} />
          <button className="key key--lamp key--sm" disabled={busy}>{busy ? "Finding the feed…" : <><Plus size={14} /> Follow</>}</button>
        </form>} />

      {list.length === 0 && !feeds.loading ? (
        <Empty icon={<Heart />} title="Follow your first blog">Paste a blog address above, or press the heart in the extension on any blog you are reading.</Empty>
      ) : (
        <div className="grid-2" style={{ gridTemplateColumns: "300px minmax(0, 1fr)", alignItems: "start" }}>
          <section className="panel stack" style={{ gap: 6, padding: 14 }}>
            <div className="row" style={{ marginBottom: 6 }}><h2 style={{ fontSize: 15 }}>Blogs</h2><span className="chip">{list.length}</span><span className="spacer" />
              <button className="icon-btn" title="Check now" onClick={async () => { const r = await api.refreshFollowing(); toast(r.new ? `${r.new} new posts` : "Nothing new yet"); feeds.reload(); posts.reload(); }}><RefreshCw size={15} /></button>
            </div>
            <button className={`feed-row ${!filter ? "on" : ""}`} onClick={() => setFilter(null)}><span className="tile tile--xs tile--peach"><Rss /></span><span style={{ flex: 1 }}>All posts</span>{feeds.data?.unseenTotal ? <span className="chip chip--lamp">{feeds.data.unseenTotal}</span> : null}</button>
            {list.map((f: FollowedFeed) => (
              <div key={f.id} className={`feed-row ${filter === f.id ? "on" : ""}`} role="button" tabIndex={0} onClick={() => setFilter(f.id)}>
                <SiteLetter url={f.siteUrl} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.title}</span>
                  <span className="small muted">{f.lastError ? "Feed unreachable" : f.latestAt ? `last post ${timeAgo(f.latestAt)}` : "checking…"}</span>
                </span>
                {f.unseen > 0 && <span className="chip chip--lamp">{f.unseen}</span>}
                <button className="icon-btn" title={f.notify ? "Notifications on" : "Notifications off"} onClick={async (e) => { e.stopPropagation(); await api.setFeedNotify(f.id, !f.notify); feeds.reload(); }}>{f.notify ? <Bell size={14} /> : <BellOff size={14} />}</button>
                <button className="icon-btn" title="Unfollow" onClick={async (e) => { e.stopPropagation(); await api.unfollow(f.id); if (filter === f.id) setFilter(null); feeds.reload(); posts.reload(); }}><Trash2 size={14} /></button>
              </div>
            ))}
          </section>
          <section className="panel stack" style={{ gap: 10 }}>
            <div className="row" style={{ flexWrap: "wrap" }}>
              <h2>{filter ? list.find((f) => f.id === filter)?.title : "Latest from everyone"}</h2>
              <span className="spacer" />
              <button className={`chip ${onlyNew ? "chip--ink" : ""}`} style={{ height: 30, padding: "0 12px" }} onClick={() => setOnlyNew(!onlyNew)}>Only new</button>
              <button className="key key--quiet key--sm" onClick={async () => { await api.markAllSeen(filter ?? undefined); posts.reload(); feeds.reload(); }}><Check size={14} /> Mark all read</button>
            </div>
            {(posts.data?.data ?? []).map((p, k) => (
              <article key={p.id} className="card-flat pop" style={{ padding: 14, display: "grid", gap: 6, animationDelay: `${Math.min(k, 10) * 25}ms`, opacity: p.seen ? 0.78 : 1 }}>
                <div className="row small muted" style={{ gap: 8 }}>
                  {!p.seen && <span className="dot" style={{ color: "var(--lamp)" }} />}
                  <b style={{ color: "var(--ink-2)", fontWeight: 500 }}>{p.feedTitle}</b><span>· {timeAgo(p.publishedAt)}</span><span className="spacer" /><span>{hostOf(p.url)}</span>
                </div>
                <a href={p.url} target="_blank" rel="noreferrer" onClick={() => open(p)} style={{ color: "var(--ink)", fontWeight: 600, fontSize: 16, letterSpacing: "-0.015em" }}>{p.title}</a>
                {p.summary && <p className="small muted" style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{p.summary}</p>}
                <div className="row" style={{ gap: 6 }}>
                  {p.saved ? <span className="chip chip--mint"><Check size={11} /> In your library</span> : <button className="key key--ghost key--sm" onClick={() => save(p)}><Plus size={13} /> Save to read</button>}
                  <a className="key key--quiet key--sm" href={p.url} target="_blank" rel="noreferrer" onClick={() => open(p)}><ExternalLink size={13} /> Open</a>
                </div>
              </article>
            ))}
            {posts.data && posts.data.data.length === 0 && <p className="muted small">{onlyNew ? "You are all caught up." : feeds.data?.refreshing ? "Fetching posts…" : "No posts yet."}</p>}
          </section>
        </div>
      )}
    </div>
  );
}
