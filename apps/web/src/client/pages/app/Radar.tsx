import { useState } from "react";
import { PageHero } from "../../components/PageHero";
import { ExternalLink, Plus, Radar as RadarIcon, RefreshCw, X, Check, MessageSquare } from "lucide-react";
import { api, type Trend, agentLabel } from "../../lib/api";
import { useAsync, timeAgo, hostOf } from "../../lib/hooks";
import { Empty, useToast } from "../../components/ui";
import { useApp } from "./Layout";

export default function Radar() {
  const radar = useAsync(() => api.radar(), []);
  const { refresh, agents, agentAction } = useApp();
  const toast = useToast();
  const [topic, setTopic] = useState("");
  const [filter, setFilter] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const trends = (radar.data?.trends ?? []).filter((t) => !filter || t.topic === filter);
  const topics = (radar.data?.topics ?? []).filter((t) => !t.muted);

  const save = async (t: Trend) => {
    try {
      await api.saveTrend(t.id);
      radar.setData((d) => d && { ...d, trends: d.trends.map((x) => (x.id === t.id ? { ...x, saved: true } : x)) });
      refresh();
      toast(<>Saved to your library <span className="muted">+1 glow</span></>, "glow");
    } catch (e) { toast((e as Error).message, "err"); }
  };

  return (
    <div className="page">
      <PageHero
        pill={<><RadarIcon size={13} /> Radar</>}
        lead="What is moving"
        pay="in what you read."
        sub="Your topics (tags plus anything you follow), watched on Hacker News and dev.to. Refreshed every six hours."
        mesh="mesh-sky"
        tiles={[["tile--sky", <RadarIcon />], ["tile--peach", <MessageSquare />], ["tile--mint", <Plus />], ["tile--iris", <ExternalLink />]]}
        actions={<button className="key key--ghost key--sm" disabled={busy} onClick={async () => { setBusy(true); await api.refreshRadar().catch(() => {}); await radar.reload(); setBusy(false); toast("Radar refreshed"); }}><RefreshCw size={14} className={busy ? "spin" : ""} /> Refresh</button>}
      />

      <section className="panel">
        <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
          <button className={`chip ${!filter ? "chip--ink" : ""}`} style={{ height: 30, padding: "0 12px" }} onClick={() => setFilter(null)}>All topics</button>
          {topics.map((t) => (
            <span key={t.name} className={`chip ${filter === t.name ? "chip--ink" : "chip--sky"}`} style={{ height: 30, padding: "0 4px 0 12px" }}>
              <button style={{ background: "none", border: 0, color: "inherit", cursor: "pointer", font: "inherit" }} onClick={() => setFilter(t.name)}>#{t.name}</button>
              <button aria-label={`Stop watching ${t.name}`} title="Stop watching" style={{ background: "none", border: 0, color: "inherit", cursor: "pointer", opacity: 0.6, display: "grid", placeItems: "center", width: 22, height: 22 }}
                onClick={async () => { await api.muteTopic(t.name); radar.reload(); }}><X size={12} /></button>
            </span>
          ))}
          <form className="row" style={{ gap: 6 }} onSubmit={async (e) => { e.preventDefault(); if (!topic.trim()) return; setBusy(true); await api.followTopic(topic.trim()).catch((er) => toast((er as Error).message, "err")); setTopic(""); await radar.reload(); setBusy(false); }}>
            <input className="input" style={{ height: 30, width: 170, fontSize: 13 }} placeholder="Follow a topic…" value={topic} onChange={(e) => setTopic(e.target.value)} />
            <button className="key key--sm" style={{ height: 30 }}><Plus size={13} /> Follow</button>
          </form>
        </div>
        {radar.data?.lastRunAt && <p className="small muted" style={{ marginTop: 10 }}>Last checked {timeAgo(radar.data.lastRunAt)}.</p>}
      </section>

      {radar.loading && !radar.data ? (
        <div className="cards">{[0, 1, 2, 3].map((k) => <div key={k} className="skeleton" style={{ height: 130 }} />)}</div>
      ) : trends.length === 0 ? (
        <Empty icon={<RadarIcon />} title="Quiet on the radar">Follow a topic or tag your saved articles; stories from this week appear here.</Empty>
      ) : (
        <div className="cards" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}>
          {trends.map((t, k) => (
            <article key={t.id} className="item-card pop" style={{ animationDelay: `${Math.min(k, 12) * 30}ms` }}>
              <div className="site">
                <span className={`chip ${t.source === "hn" ? "chip--peach" : "chip--ink"}`}>{t.source === "hn" ? "Hacker News" : "dev.to"}</span>
                <span className="chip chip--sky">#{t.topic}</span>
                <span className="spacer" />
                {t.publishedAt && <span>{timeAgo(t.publishedAt)}</span>}
              </div>
              <a href={t.url} target="_blank" rel="noreferrer"><h3>{t.title}</h3></a>
              <div className="row small muted" style={{ gap: 10 }}>
                <span>{hostOf(t.url)}</span><span>▲ {t.score}</span>{t.comments ? <span className="row" style={{ gap: 4 }}><MessageSquare size={12} /> {t.comments}</span> : null}
                <span className="spacer" />
                <a className="icon-btn" href={t.url} target="_blank" rel="noreferrer" aria-label="Open"><ExternalLink size={15} /></a>
                <button className="icon-btn" aria-label="Dismiss" onClick={async () => { await api.dismissTrend(t.id); radar.setData((d) => d && { ...d, trends: d.trends.filter((x) => x.id !== t.id) }); }}><X size={15} /></button>
              </div>
              {t.saved ? <span className="chip chip--mint" style={{ justifySelf: "start" }}><Check size={11} /> In your library</span> : <button className="key key--ghost key--sm" style={{ justifySelf: "start" }} onClick={() => save(t)}><Plus size={14} /> Save to read</button>}
            </article>
          ))}
        </div>
      )}

      <section className="panel row" style={{ flexWrap: "wrap", background: "var(--iris-tint)" }}>
        <span className="tile tile--iris"><RadarIcon /></span>
        <div style={{ flex: 1, minWidth: 220 }}><h2>{agents.length ? `Ask ${agentLabel(agents[0])} about this` : "Let an agent watch this for you"}</h2><p className="small muted">{agents.length ? "Copy the prompt and paste it into your agent:" : "Connect Claude and ask:"} “What is trending in my topics this week that connects to what I have been highlighting? Suggest two posts.”</p></div>
        {agents.length
          ? <button className="key key--iris" onClick={async () => { await navigator.clipboard.writeText("Use Lumen: what is trending in my topics this week that connects to what I have been highlighting? Suggest two posts."); toast("Prompt copied"); }}>Copy prompt</button>
          : <button className="key key--iris" onClick={agentAction}>Connect agent</button>}
      </section>
    </div>
  );
}
