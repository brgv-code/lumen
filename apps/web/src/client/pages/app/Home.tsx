import { useState } from "react";
import { PageHero } from "../../components/PageHero";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, BookOpen, Bot, Clock, Flame, Highlighter, Plus, Radar, Sparkles, Trophy, Users, BellRing, ExternalLink, Heart, Share2 } from "lucide-react";
import { LEVELS } from "@lumen/core";
import { useApp } from "./Layout";
import { useAsync, hostOf } from "../../lib/hooks";
import { api, agentLabel } from "../../lib/api";
import { Empty, Segmented, useToast } from "../../components/ui";
import { SiteLetter } from "../../components/cards";

function greeting() {
  const h = new Date().getHours();
  return h < 5 ? "Up late" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export default function Home() {
  const { user, stats, openSave, refresh, agents, agentAction, share } = useApp();
  const agentName = agents[0] ? agentLabel(agents[0]) : "your agent";
  const shareProgress = () => stats && share({ title: `${stats.streak} day reading streak`, refId: "progress", data: { kind: "progress", owner: user.name.replace(/\s*\((demo|test)\)$/, ""), streak: stats.streak, best: stats.bestStreak, glowTotal: stats.glowTotal, level: stats.level.name, done: stats.counts.done, highlights: stats.counts.highlights, week: stats.week } });
  const toast = useToast();
  const nav = useNavigate();
  const [period, setPeriod] = useState<"daily" | "weekly">("daily");
  const reads = useAsync(() => api.reads(period), [period]);
  const reminders = useAsync(() => api.reminders(), []);
  const similar = useAsync(() => api.similar(), []);
  const radar = useAsync(() => (user.pro ? api.radar() : Promise.resolve(null)), [user.pro]);
  const hls = useAsync(() => api.highlights({}), []);
  const fresh = useAsync(() => api.feedPosts({ unseen: true, limit: 4 }), []);
  const first = user.name.replace(/\s*\(demo\)$/, "").split(" ")[0];
  const goal = stats ? Math.min(1, stats.glowToday / Math.max(1, stats.dailyGoal)) : 0;
  const maxWeek = stats ? Math.max(10, ...stats.week.map((d) => d.glow)) : 10;
  const isNew = stats && stats.counts.inbox + stats.counts.reading + stats.counts.done === 0;

  const saveUrl = async (url: string, title: string) => {
    try {
      const r = await api.saveItem({ url });
      toast(r.created ? <>Saved “{title.slice(0, 40)}” <span className="muted">+1 glow</span></> : "Already in your library", r.created ? "glow" : "ok");
      refresh();
      similar.reload();
      reads.reload();
    } catch (e) { toast((e as Error).message, "err"); }
  };

  return (
    <div className="page">
      <div data-tour="hero"><PageHero
        pill={<><Flame size={13} style={{ color: "var(--lamp)" }} /> {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</>}
        lead={`${greeting()}, ${first}.`}
        pay={goal >= 1 ? "Your lamp is glowing." : stats && stats.streak > 0 ? "Keep the lamp lit." : "Light the lamp today."}
        sub={<>{stats ? <>{stats.streak} day streak · {stats.glowToday} of {stats.dailyGoal} glow today · {stats.counts.inbox} waiting in your inbox</> : "\u00a0"}</>}
        mesh="mesh-lamp"
        tiles={[["tile--lamp", <Flame />], ["tile--iris", <Sparkles />], ["tile--mint", <BookOpen />], ["tile--sky", <Highlighter />]]}
        actions={<><button className="key key--lamp key--sm" onClick={openSave}><Plus size={14} /> Save a link</button><button className="key key--ghost key--sm" onClick={agentAction}><Bot size={14} /> {agents.length ? "Your agents" : "Connect agent"}</button><button className="key key--ghost key--sm" onClick={shareProgress}><Share2 size={14} /> Share progress</button></>}
      >
        <div className="eyebrow">Today</div>
        <div className="row" style={{ marginTop: 6 }}><Ring value={goal} /><div><div style={{ color: "var(--ink)", fontWeight: 600, fontSize: 22, letterSpacing: "-0.03em" }}>{stats?.glowToday ?? 0}<span className="muted" style={{ fontSize: 14 }}>/{stats?.dailyGoal ?? 20}</span></div><div className="small muted">glow</div></div></div>
      </PageHero></div>

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

      <div className="grid-3">
        <div className="panel stat">
          <span className="tile tile--lg tile--lamp" style={{ animation: stats?.glowToday ? "glow 3s ease-in-out infinite" : undefined }}><Flame /></span>
          <div><div className="big">{stats?.streak ?? "–"}</div><div className="small muted">day streak · best {stats?.bestStreak ?? 0}</div></div>
        </div>
        <Link to="/app/highlights" className="panel stat">
          <span className="tile tile--lg tile--mint"><Highlighter /></span>
          <div><div className="big">{stats?.counts.highlights ?? "–"}</div><div className="small muted">highlights · {stats?.counts.notes ?? 0} with notes</div></div>
        </Link>
        <Link to="/app/analytics" className="panel" style={{ display: "block" }}>
          <div className="row"><span className="tile tile--iris"><Trophy /></span><div><div style={{ color: "var(--ink)", fontWeight: 600 }}>{stats?.level.name ?? "Spark"}</div><div className="small muted">{stats ? `${stats.glowTotal} glow · ${Math.max(0, stats.level.next - stats.glowTotal)} to ${LEVELS[stats.level.index + 1]?.name ?? "the top"}` : "…"}</div></div></div>
          <div className="meter" style={{ marginTop: 14 }}><span style={{ width: `${(stats?.level.progress ?? 0) * 100}%`, background: "var(--key-iris)" }} /></div>
        </Link>
      </div>

      <section className="panel" data-tour="reads">
        <div className="row" style={{ marginBottom: 14, flexWrap: "wrap" }}>
          <h2>{period === "daily" ? "Today's reads" : "This week's reads"}</h2>
          {reads.data && <span className="chip chip--lamp"><Clock size={12} /> about {reads.data.minutes} of {reads.data.budgetMinutes} min</span>}
          <span className="spacer" />
          <Segmented label="Period" size="sm" value={period} onChange={setPeriod} options={[{ value: "daily", label: "Today" }, { value: "weekly", label: "This week" }]} />
        </div>
        {reads.data && reads.data.picks.length === 0 && reads.data.trending.length === 0 ? (
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
                  <span style={{ fontFamily: "var(--font-read)", color: "var(--ink)", fontSize: 15 }}><mark className={`hl-${h.color}`}>{h.quote}</mark></span>
                  <span className="small muted">{h.item?.title}</span>
                </Link>
              ))}
              {(reads.data?.trending ?? []).slice(0, 2).map((t) => (
                <div key={t.id} className="card-flat" style={{ padding: 12, display: "grid", gap: 6 }}>
                  <span className="eyebrow">Trending in {t.topic}</span>
                  <a href={t.url} target="_blank" rel="noreferrer" style={{ color: "var(--ink)", fontWeight: 500, fontSize: 14 }}>{t.title}</a>
                  <div className="row"><span className="small muted">{t.source === "hn" ? "Hacker News" : "dev.to"} · {t.score} points</span><span className="spacer" /><button className="key key--ghost key--sm" onClick={() => saveUrl(t.url, t.title)}><Plus size={13} /> Save</button></div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {fresh.data && fresh.data.data.length > 0 && (
        <section className="panel">
          <div className="row" style={{ marginBottom: 14 }}><span className="tile tile--sm tile--peach"><Heart /></span><h2>New from blogs you follow</h2><span className="spacer" /><Link to="/app/following" className="key key--quiet key--sm">All <ArrowRight size={14} /></Link></div>
          <div className="grid-2" style={{ gap: 10 }}>
            {fresh.data.data.map((p) => (
              <a key={p.id} href={p.url} target="_blank" rel="noreferrer" className="card-flat" style={{ padding: 12, display: "grid", gap: 4 }} onClick={() => api.markPostSeen(p.id).catch(() => {})}>
                <span className="small muted">{p.feedTitle}</span>
                <span style={{ color: "var(--ink)", fontWeight: 500, fontSize: 14.5 }}>{p.title}</span>
              </a>
            ))}
          </div>
        </section>
      )}

      <div className="grid-2">
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
        <section className="panel">
          <div className="row" style={{ marginBottom: 14 }}><span className="tile tile--sm tile--mint"><Users /></span><h2>Readers like you are reading</h2></div>
          {similar.data?.optedOut ? (
            <p className="small muted">Anonymous signals are off. Turn them on in Settings to see what readers with similar taste save.</p>
          ) : similar.data && similar.data.data.length === 0 ? (
            <p className="small muted">Nothing yet. As more readers save what you save, their best finds show up here (only links saved by two or more of them, never who).</p>
          ) : (
            <div className="stack" style={{ gap: 8 }}>
              {(similar.data?.data ?? []).slice(0, 4).map((s) => (
                <div key={s.url} className="card-flat row" style={{ padding: 12 }}>
                  <SiteLetter url={s.url} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ color: "var(--ink)", fontWeight: 500, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title}</div>
                    <div className="small muted">{s.readers} readers like you saved this</div>
                  </div>
                  <button className="key key--ghost key--sm" onClick={() => saveUrl(s.url, s.title)}><Plus size={13} /> Save</button>
                </div>
              ))}
              {user.isDemo && <p className="small muted">In the demo these come from sample readers.</p>}
            </div>
          )}
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
          <div className="row" style={{ marginBottom: 14 }}><span className="tile tile--sm tile--sky"><Radar /></span><h2>On your radar</h2><span className="spacer" /><Link to="/app/radar" className="key key--quiet key--sm">Open <ArrowRight size={14} /></Link></div>
          {!user.pro ? (
            <div className="card-flat" style={{ padding: 14, display: "grid", gap: 8, background: "var(--lamp-tint)" }}>
              <b style={{ color: "var(--ink)" }}>Radar is part of Pro</b>
              <span className="small muted">Trending stories in your topics, refreshed every six hours.</span>
              <Link to="/app/upgrade" className="key key--lamp key--sm" style={{ justifySelf: "start" }}>See Pro</Link>
            </div>
          ) : (<>
          <div className="row" style={{ flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
            {(radar.data?.topics ?? []).filter((t) => !t.muted).slice(0, 8).map((t) => <span key={t.name} className="chip chip--sky">#{t.name}</span>)}
          </div>
          <div className="stack" style={{ gap: 8 }}>
            {(radar.data?.trends ?? []).slice(0, 3).map((t) => (
              <a key={t.id} href={t.url} target="_blank" rel="noreferrer" className="card-flat" style={{ padding: 12, display: "grid", gap: 4 }}>
                <span style={{ color: "var(--ink)", fontWeight: 500, fontSize: 14 }}>{t.title} <ExternalLink size={12} style={{ display: "inline", verticalAlign: -1 }} /></span>
                <span className="small muted">{t.topic} · {t.source === "hn" ? "Hacker News" : "dev.to"} · {t.score} points</span>
              </a>
            ))}
            {radar.loading && <div className="skeleton" style={{ height: 70 }} />}
          </div>
          </>)}
          <div className="card-flat row" style={{ padding: 14, marginTop: 14, background: "var(--iris-tint)" }}>
            <span className="tile tile--sm tile--iris"><Bot /></span>
            {agents.length ? (<>
              <div style={{ minWidth: 0, flex: 1 }}><div style={{ color: "var(--ink)", fontWeight: 500, fontSize: 14 }}>Ask {agentName} about this</div><div className="small muted">“What is trending in my topics that connects to my highlights?”</div></div>
              <button className="key key--iris key--sm" onClick={async () => { await navigator.clipboard.writeText("Use Lumen: what is trending in my topics this week that connects to what I have been highlighting? Suggest two posts."); }}>Copy prompt</button>
            </>) : (<>
              <div style={{ minWidth: 0, flex: 1 }}><div style={{ color: "var(--ink)", fontWeight: 500, fontSize: 14 }}>Let your agent watch this for you</div><div className="small muted">Claude can review your week and suggest what to write.</div></div>
              <button className="key key--iris key--sm" onClick={agentAction}>Connect</button>
            </>)}
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
