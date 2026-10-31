import { Link } from "react-router-dom";
import { ArrowRight, BookOpen, Flame, Highlighter, Sparkles, Trophy, Inbox } from "lucide-react";
import { LEVELS } from "@lumen/core";
import { useApp } from "./Layout";
import { useAsync } from "../../lib/hooks";
import { api } from "../../lib/api";
import { ItemCard } from "../../components/cards";
import { Empty } from "../../components/ui";

function greeting() {
  const h = new Date().getHours();
  return h < 5 ? "Up late" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export default function Home() {
  const { user, stats, openSave } = useApp();
  const reading = useAsync(() => api.items({ status: "reading", limit: 3 }), []);
  const inbox = useAsync(() => api.items({ status: "inbox", limit: 3 }), []);
  const hls = useAsync(() => api.highlights({}), []);
  const ideas = useAsync(() => api.ideas(), []);
  const first = user.name.replace(/\s*\(demo\)$/, "").split(" ")[0];
  const goal = stats ? Math.min(1, stats.glowToday / Math.max(1, stats.dailyGoal)) : 0;
  const maxWeek = stats ? Math.max(10, ...stats.week.map((d) => d.glow)) : 10;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <span className="eyebrow">{new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</span>
          <h1 style={{ marginTop: 8 }}>
            <span className="lead-in">{greeting()}, {first}.</span>{" "}
            <span className="payoff">{goal >= 1 ? "Your lamp is glowing." : stats && stats.streak > 0 ? "Keep the lamp lit." : "Light the lamp today."}</span>
          </h1>
        </div>
      </div>

      <div className="grid-3">
        <div className="panel stat">
          <span className="tile tile--lg tile--lamp" style={{ animation: stats?.glowToday ? "glow 3s ease-in-out infinite" : undefined }}><Flame /></span>
          <div><div className="big">{stats?.streak ?? "–"}</div><div className="small muted">day streak · best {stats?.bestStreak ?? 0}</div></div>
        </div>
        <div className="panel stat">
          <Ring value={goal} />
          <div><div className="big">{stats?.glowToday ?? 0}<span className="muted" style={{ fontSize: 16 }}>/{stats?.dailyGoal ?? 20}</span></div><div className="small muted">glow today</div></div>
        </div>
        <div className="panel">
          <div className="row"><span className="tile tile--iris"><Trophy /></span><div><div style={{ color: "var(--ink)", fontWeight: 600 }}>{stats?.level.name ?? "Spark"}</div><div className="small muted">{stats ? `${stats.glowTotal} glow · ${Math.max(0, stats.level.next - stats.glowTotal)} to ${LEVELS[stats.level.index + 1]?.name ?? "the top"}` : "…"}</div></div></div>
          <div className="meter" style={{ marginTop: 14 }}><span style={{ width: `${(stats?.level.progress ?? 0) * 100}%`, background: "var(--key-iris)" }} /></div>
        </div>
      </div>

      <div className="grid-2" style={{ gridTemplateColumns: "1.5fr 1fr" }}>
        <section className="panel">
          <div className="row" style={{ marginBottom: 14 }}><h2>Continue reading</h2><span className="spacer" /><Link to="/app/library?status=reading" className="key key--quiet key--sm">All <ArrowRight size={14} /></Link></div>
          {reading.data && reading.data.data.length === 0 ? (
            <Empty icon={<BookOpen />} title="Nothing in progress" action={<button className="key key--sm" onClick={openSave}>Save something to read</button>}>Open anything from your inbox and Lumen remembers where you stopped.</Empty>
          ) : (
            <div className="cards" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))" }}>
              {(reading.data?.data ?? []).map((i) => <ItemCard key={i.id} item={i} />)}
              {reading.loading && [0, 1].map((k) => <div key={k} className="skeleton" style={{ height: 150 }} />)}
            </div>
          )}
        </section>
        <section className="panel">
          <div className="row" style={{ marginBottom: 18 }}><h2>This week</h2><span className="spacer" /><span className="chip chip--lamp"><Flame size={12} /> {stats?.week.reduce((a, d) => a + d.glow, 0) ?? 0} glow</span></div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 150 }}>
            {(stats?.week ?? Array.from({ length: 7 }, (_, k) => ({ day: String(k), glow: 0 }))).map((d, k, arr) => (
              <div key={d.day} style={{ flex: 1, display: "grid", gap: 8, justifyItems: "center" }}>
                <div style={{ width: "100%", height: 120, borderRadius: 9, background: "var(--well)", position: "relative", overflow: "hidden" }} title={`${d.glow} glow`}>
                  <span style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: `${(d.glow / maxWeek) * 100}%`, borderRadius: 9, background: k === arr.length - 1 ? "var(--key-lamp)" : "linear-gradient(180deg,#ffd27a,#ffab5e)", transition: "height 700ms var(--ease-out)" }} />
                </div>
                <span className="mono small muted" style={{ fontSize: 11 }}>{new Date(d.day + "T12:00:00").toLocaleDateString(undefined, { weekday: "narrow" })}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid-2">
        <section className="panel">
          <div className="row" style={{ marginBottom: 14 }}><h2>Recent highlights</h2><span className="spacer" /><Link to="/app/highlights" className="key key--quiet key--sm">All <ArrowRight size={14} /></Link></div>
          <div className="stack" style={{ gap: 10 }}>
            {(hls.data?.data ?? []).slice(0, 4).map((h) => (
              <Link key={h.id} to={`/app/read/${h.itemId}`} className="card-flat" style={{ padding: "12px 14px", display: "grid", gap: 6 }}>
                <span style={{ fontFamily: "var(--font-read)", fontSize: 15.5, color: "var(--ink)", lineHeight: 1.5 }}><mark className={`hl-${h.color}`}>{h.quote}</mark></span>
                <span className="small muted">{h.item?.title}{h.note ? ` · ✎ ${h.note}` : ""}</span>
              </Link>
            ))}
            {hls.data && hls.data.data.length === 0 && <Empty icon={<Highlighter />} title="No highlights yet">Select any passage in the reader to keep it.</Empty>}
          </div>
        </section>
        <section className="panel">
          <div className="row" style={{ marginBottom: 14 }}><h2>Inbox</h2><span className="chip">{stats?.counts.inbox ?? 0}</span><span className="spacer" /><Link to="/app/library?status=inbox" className="key key--quiet key--sm">Open <ArrowRight size={14} /></Link></div>
          <div className="stack" style={{ gap: 10 }}>
            {(inbox.data?.data ?? []).map((i) => (
              <Link key={i.id} to={`/app/read/${i.id}`} className="row card-flat" style={{ padding: 12 }}>
                <span className="tile tile--sm tile--sky"><Inbox /></span>
                <div style={{ minWidth: 0 }}><div style={{ color: "var(--ink)", fontWeight: 500, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{i.title}</div><div className="small muted">{i.siteName} · {i.readingMinutes} min</div></div>
              </Link>
            ))}
            {inbox.data && inbox.data.data.length === 0 && <p className="muted small">Inbox zero. Lovely.</p>}
          </div>
          <div className="card-flat" style={{ padding: 14, marginTop: 14, background: "var(--iris-tint)" }}>
            <div className="row"><span className="tile tile--sm tile--iris"><Sparkles /></span><div style={{ minWidth: 0 }}><div className="eyebrow">Spark</div><div style={{ color: "var(--ink)", fontWeight: 500, fontSize: 14 }}>{ideas.data?.data[0]?.title ?? "Ideas appear once you have a few highlights."}</div></div></div>
            <Link to="/app/spark" className="key key--iris key--sm" style={{ marginTop: 12 }}>See ideas</Link>
          </div>
        </section>
      </div>
    </div>
  );
}

function Ring({ value }: { value: number }) {
  const r = 22, c = 2 * Math.PI * r;
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" aria-hidden="true">
      <defs><linearGradient id="ring" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#FFB53D" /><stop offset="1" stopColor="#FF6A1A" /></linearGradient></defs>
      <circle cx="28" cy="28" r={r} fill="none" stroke="var(--well)" strokeWidth="7" />
      <circle cx="28" cy="28" r={r} fill="none" stroke="url(#ring)" strokeWidth="7" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - value)} transform="rotate(-90 28 28)" style={{ transition: "stroke-dashoffset 800ms var(--ease-out)" }} />
    </svg>
  );
}
