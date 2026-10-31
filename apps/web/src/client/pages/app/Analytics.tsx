import { BarChart3, BookOpen, CheckCircle2, Clock, Type } from "lucide-react";
import { PageHero } from "../../components/PageHero";
import { api } from "../../lib/api";
import { useAsync } from "../../lib/hooks";
import { useApp } from "./Layout";

const COLOR_HEX: Record<string, string> = { sun: "#ffd34d", mint: "#3fd39a", iris: "#8a7bff", peach: "#ff8a6b", sky: "#5b9bff" };

export default function Analytics() {
  const a = useAsync(() => api.analytics(), []);
  const { stats, share, user } = useApp();
  const d = a.data;
  const maxHeat = d ? Math.max(1, ...d.heatmap.map((x) => x.glow)) : 1;
  const maxHour = d ? Math.max(1, ...d.hours) : 1;
  const maxTopic = d ? Math.max(1, ...d.topics.map((t) => t.items)) : 1;
  const maxSite = d ? Math.max(1, ...d.sites.map((t) => t.items)) : 1;
  const colorTotal = d ? d.colors.reduce((s, c) => s + c.n, 0) || 1 : 1;
  const weeks = d ? Array.from({ length: 12 }, (_, w) => d.heatmap.slice(w * 7, w * 7 + 7)) : [];

  return (
    <div className="page">
      <PageHero
        pill={<><BarChart3 size={13} /> Analytics</>}
        lead="Your reading,"
        pay="at a glance."
        sub="Twelve weeks of attention: what you finish, what you read about, and when."
        mesh="mesh-iris"
        tiles={[["tile--iris", <BarChart3 />], ["tile--lamp", <Clock />], ["tile--mint", <CheckCircle2 />], ["tile--sky", <BookOpen />]]}
        actions={stats ? <button className="key key--ghost key--sm" onClick={() => share({ title: `${stats.streak} day reading streak`, refId: "progress", data: { kind: "progress", owner: user.name.replace(/\s*\((demo|test)\)$/, ""), streak: stats.streak, best: stats.bestStreak, glowTotal: stats.glowTotal, level: stats.level.name, done: stats.counts.done, highlights: stats.counts.highlights, week: stats.week } })}>Share my progress</button> : undefined}
      />

      <div className="grid-3" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        <Stat icon={<BookOpen />} tile="tile--lamp" big={d?.totals.saved ?? "–"} label="saved" />
        <Stat icon={<CheckCircle2 />} tile="tile--mint" big={d ? `${Math.round(d.totals.completion * 100)}%` : "–"} label={`finished (${d?.totals.done ?? 0})`} />
        <Stat icon={<Clock />} tile="tile--iris" big={d?.totals.minutes ?? "–"} label="minutes read" />
        <Stat icon={<Type />} tile="tile--sky" big={d ? d.totals.words.toLocaleString() : "–"} label="words read" />
      </div>

      <section className="panel">
        <div className="row" style={{ marginBottom: 14 }}><h2>Last 12 weeks</h2><span className="spacer" /><span className="small muted">streak {stats?.streak ?? 0} · best {stats?.bestStreak ?? 0}</span></div>
        <div style={{ display: "flex", gap: 5, overflowX: "auto", paddingBottom: 4 }}>
          {weeks.map((w, k) => (
            <div key={k} style={{ display: "grid", gap: 5 }}>
              {w.map((day) => {
                const v = day.glow / maxHeat;
                return <span key={day.day} title={`${day.day}: ${day.glow} glow`} style={{ width: 18, height: 18, borderRadius: 5, background: day.glow ? `color-mix(in srgb, #ff8a1f ${Math.round(25 + v * 75)}%, var(--well))` : "var(--well)" }} />;
              })}
            </div>
          ))}
        </div>
        <div className="row small muted" style={{ marginTop: 10, gap: 6 }}>Less {[0, 0.3, 0.6, 1].map((v) => <span key={v} style={{ width: 12, height: 12, borderRadius: 3, background: v ? `color-mix(in srgb, #ff8a1f ${Math.round(25 + v * 75)}%, var(--well))` : "var(--well)" }} />)} More</div>
      </section>

      <div className="grid-2">
        <section className="panel">
          <h2 style={{ marginBottom: 14 }}>Topics</h2>
          <div className="stack" style={{ gap: 10 }}>
            {(d?.topics ?? []).map((t) => (
              <div key={t.name}>
                <div className="row small"><span style={{ color: "var(--ink)", fontWeight: 500 }}>#{t.name}</span><span className="spacer" /><span className="muted">{t.items} {t.items === 1 ? "item" : "items"} · {t.highlights} {t.highlights === 1 ? "highlight" : "highlights"}</span></div>
                <div className="meter" style={{ marginTop: 6 }}><span style={{ width: `${(t.items / maxTopic) * 100}%` }} /></div>
              </div>
            ))}
            {d && d.topics.length === 0 && <p className="small muted">Tag what you save to see topics here.</p>}
          </div>
        </section>
        <section className="panel">
          <h2 style={{ marginBottom: 14 }}>When you read</h2>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 130 }}>
            {(d?.hours ?? Array(24).fill(0)).map((h, k) => (
              <div key={k} title={`${k}:00 · ${h} actions`} style={{ flex: 1, height: `${Math.max(4, (h / maxHour) * 100)}%`, borderRadius: 4, background: h ? "linear-gradient(180deg,#8a7bff,#5b48f5)" : "var(--well)" }} />
            ))}
          </div>
          <div className="row small muted mono" style={{ justifyContent: "space-between", marginTop: 6, fontSize: 11 }}><span>0h</span><span>6h</span><span>12h</span><span>18h</span><span>23h</span></div>
        </section>
      </div>

      <div className="grid-2">
        <section className="panel">
          <h2 style={{ marginBottom: 14 }}>Sources</h2>
          <div className="stack" style={{ gap: 10 }}>
            {(d?.sites ?? []).map((s) => (
              <div key={s.site}>
                <div className="row small"><span style={{ color: "var(--ink)", fontWeight: 500 }}>{s.site}</span><span className="spacer" /><span className="muted">{s.items}</span></div>
                <div className="meter" style={{ marginTop: 6 }}><span style={{ width: `${(s.items / maxSite) * 100}%`, background: "linear-gradient(180deg,#5b9bff,#2563eb)" }} /></div>
              </div>
            ))}
          </div>
        </section>
        <section className="panel">
          <h2 style={{ marginBottom: 14 }}>Highlight colours</h2>
          <div style={{ display: "flex", height: 18, borderRadius: 9, overflow: "hidden", background: "var(--well)" }}>
            {(d?.colors ?? []).map((c) => <span key={c.color} title={`${c.color}: ${c.n}`} style={{ width: `${(c.n / colorTotal) * 100}%`, background: COLOR_HEX[c.color] }} />)}
          </div>
          <div className="row" style={{ flexWrap: "wrap", gap: 12, marginTop: 12 }}>
            {(d?.colors ?? []).map((c) => <span key={c.color} className="row small" style={{ gap: 6 }}><span className="dot" style={{ color: COLOR_HEX[c.color] }} />{c.color} · {c.n}</span>)}
          </div>
          <div className="card-flat row" style={{ padding: 12, marginTop: 16 }}>
            <span className="tile tile--sm tile--ink"><BarChart3 /></span>
            <p className="small muted">Weekly minutes come from articles you finish. Ask your agent for the full report: “Use Lumen to summarise my reading this month.”</p>
          </div>
        </section>
      </div>
    </div>
  );
}

function Stat({ icon, tile, big, label }: { icon: React.ReactNode; tile: string; big: React.ReactNode; label: string }) {
  return <div className="panel stat"><span className={`tile ${tile}`}>{icon}</span><div><div className="big">{big}</div><div className="small muted">{label}</div></div></div>;
}
