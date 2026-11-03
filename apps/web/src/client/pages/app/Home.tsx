import { useState } from "react";
import { PageHero } from "../../components/PageHero";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, BookCheck, BookOpen, Clock, Flame, Highlighter, Plus, Sparkles, BellRing } from "lucide-react";
import { useApp } from "./Layout";
import { useAsync, hostOf } from "../../lib/hooks";
import { api, agentLabel } from "../../lib/api";
import { hlStyle } from "../../lib/hl";
import { Empty, Segmented, useToast } from "../../components/ui";
import { SiteLetter } from "../../components/cards";

function greeting() {
  const h = new Date().getHours();
  return h < 5 ? "Up late" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export default function Home() {
  const { user, stats, openSave, agents, agentAction, recallDue } = useApp();
  const agentName = agents[0] ? agentLabel(agents[0]) : "your agent";
  const toast = useToast();
  const nav = useNavigate();
  const [period, setPeriod] = useState<"daily" | "weekly">("daily");
  const reads = useAsync(() => api.reads(period), [period]);
  const reminders = useAsync(() => api.reminders(), []);
  const hls = useAsync(() => api.highlights({}), []);
  const first = user.name.replace(/\s*\(demo\)$/, "").split(" ")[0];
  const goal = stats ? Math.min(1, stats.glowToday / Math.max(1, stats.dailyGoal)) : 0;
  const isNew = stats && stats.counts.inbox + stats.counts.reading + stats.counts.done === 0;

  return (
    <div className="page">
      <div data-tour="hero"><PageHero
        pill={<><Flame size={13} style={{ color: "var(--lamp)" }} /> {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</>}
        lead={`${greeting()}, ${first}.`}
        pay={goal >= 1 ? "Your lamp is glowing." : stats && stats.streak > 0 ? "Keep the lamp lit." : "Light the lamp today."}
        sub={<>{stats ? <>{stats.streak} day streak · {stats.counts.inbox} waiting in your inbox</> : " "}</>}
      /></div>

      {isNew && (
        <section className="panel gridlines">
          <div className="row" style={{ position: "relative", marginBottom: 14 }}><span className="tile tile--lamp"><Sparkles /></span><h2>Three steps to a lit lamp</h2></div>
          <div className="grid-3" style={{ position: "relative" }}>
            <button className="item-card" style={{ border: 0, textAlign: "left", font: "inherit", cursor: "pointer" }} onClick={openSave}><span className="chip">1</span><h3>Save something to read</h3><p className="excerpt">Paste a link, or use the extension on any page.</p></button>
            <Link className="item-card" to="/app/integrations"><span className="chip">2</span><h3>Point a collection at a note</h3><p className="excerpt">Obsidian, Notion, markdown or a webhook.</p></Link>
            <button className="item-card" style={{ border: 0, textAlign: "left", font: "inherit", cursor: "pointer" }} onClick={agentAction}><span className={`chip ${agents.length ? "chip--mint" : ""}`}>{agents.length ? "✓" : "3"}</span><h3>{agents.length ? "Agent connected" : "Connect your agent"}</h3><p className="excerpt">{agents.length ? `${agentName} can read your library.` : "Let Claude read your library with you."}</p></button>
          </div>
        </section>
      )}

      {recallDue > 0 && (
        <Link to="/app/recall" className="card row pop" style={{ padding: "14px 16px" }}>
          <span className="tile tile--sm tile--mint"><BookCheck /></span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ color: "var(--ink)", fontWeight: 600, fontSize: 14.5 }}>{recallDue} {recallDue === 1 ? "question" : "questions"} to recall</div>
            <div className="small muted">Say back what you read, in your own words. A minute or two.</div>
          </div>
          <span className="key key--sm">Start <ArrowRight size={14} /></span>
        </Link>
      )}

      {reminders.data && reminders.data.data.length > 0 && (
        <section className="stack" style={{ gap: 8 }}>
          {reminders.data.data.slice(0, 2).map((r) => (
            <div key={r.item.id} className="card row pop" style={{ padding: "12px 14px", flexWrap: "wrap", background: "var(--lamp-tint)" }}>
              <span className="tile tile--sm tile--lamp"><BellRing /></span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ color: "var(--ink)", fontWeight: 600, fontSize: 14.5 }}>You were {Math.round(r.item.progress * 100)}% through “{r.item.title}”</div>
                <div className="small muted">Left {r.idleDays} {r.idleDays === 1 ? "day" : "days"} ago · about {r.minutesLeft} min to finish</div>
              </div>
              <button className="key key--lamp key--sm" onClick={() => nav(`/app/read/${r.item.id}`)}>Continue</button>
              <button className="key key--quiet key--sm" onClick={async () => { await api.snooze(r.item.id, 2); reminders.reload(); toast("Snoozed for 2 days"); }}>Snooze</button>
            </div>
          ))}
        </section>
      )}

      <section className="panel" data-tour="reads">
        <div className="row" style={{ marginBottom: 14, flexWrap: "wrap" }}>
          <h2>{period === "daily" ? "Today's reads" : "This week's reads"}</h2>
          {reads.data && <span className="chip chip--lamp"><Clock size={12} /> about {reads.data.minutes} of {reads.data.budgetMinutes} min</span>}
          <span className="spacer" />
          <Segmented label="Period" size="sm" value={period} onChange={setPeriod} options={[{ value: "daily", label: "Today" }, { value: "weekly", label: "This week" }]} />
        </div>
        {reads.data && reads.data.picks.length === 0 && reads.data.resurface.length === 0 ? (
          <Empty icon={<BookOpen />} title="Nothing planned yet" action={<button className="key key--sm" onClick={openSave}><Plus size={14} /> Save a link</button>}>Save a few articles and Lumen builds a plan that fits your daily goal.</Empty>
        ) : (
          <div className="grid-2" style={{ gridTemplateColumns: "1.3fr 1fr", alignItems: "start" }}>
            <div className="stack" style={{ gap: 8 }}>
              {(reads.data?.picks ?? []).map((i, k) => (
                <Link key={i.id} to={`/app/read/${i.id}`} className="card-flat row pop" style={{ padding: 12, animationDelay: `${k * 40}ms` }}>
                  <span className="mono muted" style={{ width: 18, textAlign: "center" }}>{k + 1}</span>
                  <SiteLetter url={i.url} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ color: "var(--ink)", fontWeight: 500, fontSize: 14.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{i.title}</div>
                    <div className="small muted">{i.status === "reading" ? `Continue · ${Math.round(i.progress * 100)}% read` : `${i.readingMinutes} min`} · {i.siteName ?? hostOf(i.url)}</div>
                  </div>
                  {i.status === "reading" && <span className="chip chip--lamp">In progress</span>}
                </Link>
              ))}
              {reads.loading && [0, 1, 2].map((k) => <div key={k} className="skeleton" style={{ height: 56 }} />)}
            </div>
            <div className="stack" style={{ gap: 10 }}>
              {(reads.data?.resurface ?? []).map((h) => (
                <Link key={h.id} to={`/app/read/${h.itemId}#${h.id}`} className="card-flat" style={{ padding: 12, display: "grid", gap: 4 }}>
                  <span className="eyebrow">Worth revisiting</span>
                  <span style={{ fontFamily: "var(--font-read)", color: "var(--ink)", fontSize: 15 }}><mark className="hl" style={hlStyle(h.color)}>{h.quote}</mark></span>
                  <span className="small muted">{h.item?.title}</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="panel">
        <div className="row" style={{ marginBottom: 14 }}><h2>Recent highlights</h2><span className="spacer" /><Link to="/app/highlights" className="key key--quiet key--sm">All <ArrowRight size={14} /></Link></div>
        <div className="grid-2" style={{ gap: 10 }}>
          {(hls.data?.data ?? []).slice(0, 4).map((h) => (
            <Link key={h.id} to={`/app/read/${h.itemId}`} className="card-flat" style={{ padding: "12px 14px", display: "grid", gap: 6 }}>
              <span style={{ fontFamily: "var(--font-read)", fontSize: 15.5, color: "var(--ink)", lineHeight: 1.5 }}><mark className="hl" style={hlStyle(h.color)}>{h.quote}</mark></span>
              <span className="small muted">{h.item?.title}{h.note ? ` · ✎ ${h.note}` : ""}</span>
            </Link>
          ))}
        </div>
        {hls.data && hls.data.data.length === 0 && <Empty icon={<Highlighter />} title="No highlights yet">Select any passage in the reader to keep it.</Empty>}
      </section>
    </div>
  );
}
