import { useState } from "react";
import { PageHero } from "../../components/PageHero";
import { Link } from "react-router-dom";
import { Copy, Sparkles, Bookmark, X } from "lucide-react";
import { api } from "../../lib/api";
import { useAsync, timeAgo } from "../../lib/hooks";
import { burst, Empty, useToast } from "../../components/ui";
import { useApp } from "./Layout";

export default function Spark() {
  const ideas = useAsync(() => api.ideas(), []);
  const { refresh, stats } = useApp();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const run = async (e: React.MouseEvent) => {
    const { clientX, clientY } = e;
    setBusy(true);
    try {
      const r = await api.spark();
      ideas.setData((d) => ({ data: [...r.data, ...(d?.data ?? [])] }));
      burst(clientX, clientY);
      toast(`${r.data.length} new ideas from your reading`, "glow");
    } catch (err) { toast((err as Error).message, "err"); } finally { setBusy(false); }
  };

  return (
    <div className="page">
      <PageHero
        pill={<><Sparkles size={13} /> Spark</>}
        lead="What your reading"
        pay="keeps circling."
        sub="Spark reads only your own highlights and notes, then suggests the posts, threads and talks they point at."
        mesh="mesh-peach"
        tiles={[["tile--peach", <Sparkles />], ["tile--iris", <Sparkles />], ["tile--lamp", <Bookmark />], ["tile--sun", <Copy />]]}
        actions={<button className="key key--iris key--sm" onClick={run} disabled={busy}><Sparkles size={15} /> {busy ? "Noticing…" : "Find new ideas"}</button>}
      />
      {ideas.data && ideas.data.data.length === 0 ? (
        <Empty icon={<Sparkles />} title="No sparks yet">{(stats?.counts.highlights ?? 0) < 3 ? "Highlight at least three passages, then come back." : "Press Find new ideas."}</Empty>
      ) : (
        <div className="cards" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}>
          {(ideas.data?.data ?? []).map((i, k) => (
            <article key={i.id} className="item-card pop" style={{ animationDelay: `${k * 50}ms`, padding: 20, background: i.status === "saved" ? "var(--lamp-tint)" : undefined }}>
              <div className="row"><span className="tile tile--sm tile--peach"><Sparkles /></span><span className="chip chip--peach">{i.sourceItemIds.length} sources</span><span className="spacer" /><span className="small muted">{timeAgo(i.createdAt)}</span></div>
              <h3 style={{ fontSize: 18 }}>{i.title}</h3>
              <p className="small">{i.angle}</p>
              {i.outline.length > 0 && <ol className="small" style={{ margin: 0, paddingLeft: 18, color: "var(--ink-2)", display: "grid", gap: 4 }}>{i.outline.map((o) => <li key={o}>{o}</li>)}</ol>}
              <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>{i.sourceItemIds.slice(0, 3).map((s) => <Link key={s} to={`/app/read/${s}`} className="chip">source ↗</Link>)}</div>
              <div className="row" style={{ marginTop: 4 }}>
                {i.status === "saved" ? <span className="chip chip--lamp"><Bookmark size={11} /> Kept</span> : (
                  <button className="key key--lamp key--sm" onClick={async () => { const r = await api.updateIdea(i.id, "saved"); ideas.setData((d) => ({ data: d!.data.map((x) => (x.id === i.id ? r.idea : x)) })); refresh(); toast(<>Idea kept <span className="muted">+2 glow</span></>, "glow"); }}><Bookmark size={14} /> Keep</button>
                )}
                <button className="key key--quiet key--sm" onClick={async () => { await navigator.clipboard.writeText(`# ${i.title}\n\n${i.angle}\n\n${i.outline.map((o) => `- ${o}`).join("\n")}\n`); toast("Outline copied as markdown"); }}><Copy size={14} /> Copy</button>
                <span className="spacer" />
                <button className="icon-btn" aria-label="Dismiss" onClick={async () => { await api.updateIdea(i.id, "dismissed"); ideas.setData((d) => ({ data: d!.data.filter((x) => x.id !== i.id) })); }}><X size={15} /></button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
