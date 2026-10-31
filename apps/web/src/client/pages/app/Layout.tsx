import { createContext, useContext, useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import type { Collection, Stats, User } from "@lumen/core";
import { Home, Library, Highlighter, FolderHeart, Sparkles, Plug, Settings, Search, Plus, Flame, LogOut, Puzzle, Radar, BarChart3, Bot } from "lucide-react";
import { ConnectAgent } from "../../components/ConnectAgent";
import { PaywallModal, ProChip } from "../../components/Pro";
import { Tour, APP_TOUR, tourDone, markTour } from "../../components/Tour";
import { Crown, MessageCircle, Heart } from "lucide-react";
import { ShareModal } from "../../components/ShareModal";
import type { CardData } from "../../lib/cards";
import type { Token } from "../../lib/api";
import { Logo, Modal, useToast } from "../../components/ui";
import { api, agentLabel } from "../../lib/api";
import "../../styles/app.css";

interface Ctx {
  user: User;
  stats: Stats | null;
  collections: Collection[];
  refresh: () => void;
  openSave: () => void;
  openAgent: () => void;
  setUser: (u: User) => void;
  startTour: () => void;
  agents: Token[];
  /** Opens the agents page when one is connected, otherwise the connect flow. */
  agentAction: () => void;
  share: (s: { data: CardData; refId?: string; title: string }) => void;
}
const AppCtx = createContext<Ctx>(null as unknown as Ctx);
export const useApp = () => useContext(AppCtx);

export default function Layout() {
  const [user, setUser] = useState<User | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [saveOpen, setSaveOpen] = useState(false);
  const [agentOpen, setAgentOpen] = useState(false);
  const [paywall, setPaywall] = useState<string | null>(null);
  const [tourOpen, setTourOpen] = useState(false);
  const [follows, setFollows] = useState(0);
  const [agents, setAgents] = useState<Token[]>([]);
  const [shareState, setShareState] = useState<{ data: CardData; refId?: string; title: string } | null>(null);
  const nav = useNavigate();
  const toast = useToast();
  const searchRef = useRef<HTMLInputElement>(null);

  const refresh = () => {
    api.stats().then(setStats).catch(() => {});
    api.following().then((r) => setFollows(r.unseenTotal)).catch(() => {});
    api.tokens().then((r) => setAgents(r.data.filter((t) => t.kind === "agent"))).catch(() => {});
    api.collections().then((r) => setCollections(r.data)).catch(() => {});
  };

  useEffect(() => {
    api.me().then((r) => { setUser(r.user); if (!tourDone(r.user.id)) setTimeout(() => setTourOpen(true), 700); }).catch(() => nav("/login", { replace: true }));
    const onPay = (e: Event) => setPaywall((e as CustomEvent<string>).detail || "This is part of Lumen Pro.");
    window.addEventListener("lumen:paywall", onPay);
    refresh();
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); searchRef.current?.focus(); }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s" && !(e.target as HTMLElement).closest("input,textarea")) { e.preventDefault(); setSaveOpen(true); }
    };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("lumen:paywall", onPay); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!user) return <div style={{ minHeight: "100vh" }} />;

  const logout = async () => { await api.logout().catch(() => {}); nav("/"); };
  const goal = stats ? Math.min(1, stats.glowToday / Math.max(1, stats.dailyGoal)) : 0;

  return (
    <AppCtx.Provider value={{ user, stats, collections, refresh, openSave: () => setSaveOpen(true), openAgent: () => setAgentOpen(true), setUser, startTour: () => setTourOpen(true),
      agents, agentAction: () => (agents.length ? nav("/app/agents") : setAgentOpen(true)), share: setShareState }}>
      <div className="shell">
        <aside className="side">
          <NavLink to="/" style={{ padding: "4px 8px" }}><Logo size={26} /></NavLink>
          <nav className="side__nav">
            <NavLink end to="/app" className="side__link"><span className="ico"><Home /></span> Home</NavLink>
            <NavLink to="/app/library" className="side__link" data-tour="nav-library"><span className="ico"><Library /></span> Library {stats && <span className="count">{stats.counts.inbox + stats.counts.reading}</span>}</NavLink>
            <NavLink to="/app/highlights" className="side__link" data-tour="nav-highlights"><span className="ico"><Highlighter /></span> Highlights {stats && <span className="count">{stats.counts.highlights}</span>}</NavLink>
            <NavLink to="/app/collections" className="side__link" data-tour="nav-collections"><span className="ico"><FolderHeart /></span> Collections</NavLink>
            <NavLink to="/app/following" className="side__link" data-tour="nav-following"><span className="ico"><Heart /></span> Following {follows > 0 && <span className="count" style={{ color: "var(--lamp)", fontWeight: 600 }}>{follows}</span>}</NavLink>
            <NavLink to="/app/ask" className="side__link" data-tour="nav-ask"><span className="ico"><MessageCircle /></span> Ask</NavLink>
            <NavLink to="/app/radar" className="side__link" data-tour="nav-radar"><span className="ico"><Radar /></span> Radar {!user.pro && <span className="count"><ProChip small /></span>}</NavLink>
            <NavLink to="/app/spark" className="side__link"><span className="ico"><Sparkles /></span> Spark {!user.pro && <span className="count"><ProChip small /></span>}</NavLink>
            <NavLink to="/app/analytics" className="side__link"><span className="ico"><BarChart3 /></span> Analytics {!user.pro && <span className="count"><ProChip small /></span>}</NavLink>
            <div className="side__section">Connect</div>
            <NavLink to="/app/integrations" className="side__link"><span className="ico"><Plug /></span> Integrations</NavLink>
            <NavLink to="/app/settings" className="side__link"><span className="ico"><Settings /></span> Settings</NavLink>
          </nav>
          {collections.length > 0 && (
            <nav className="side__nav">
              <div className="side__section">Collections</div>
              {collections.slice(0, 5).map((c) => (
                <NavLink key={c.id} to={`/app/collections/${c.id}`} className="side__link" style={{ height: 34, fontSize: 13.5 }}>
                  <span style={{ width: 17, textAlign: "center" }}>{c.emoji}</span>
                  <span className="name">{c.name}</span>
                  <span className="count">{c.itemCount}</span>
                </NavLink>
              ))}
            </nav>
          )}
          <div className="side__foot">
            <NavLink to="/app/upgrade" className="trial-card" data-tour="trial" style={{ textDecoration: "none" }}>
              <div className="row" style={{ gap: 8 }}>
                <span className="tile tile--xs tile--lamp"><Crown /></span>
                <b style={{ color: "var(--ink)", fontSize: 13.5 }}>{user.planStatus === "pro" ? "Lumen Pro" : user.planStatus === "trial" ? `Pro trial · ${user.trialDaysLeft}d left` : "Free plan"}</b>
              </div>
              <span className="small muted">{user.planStatus === "pro" ? "Thank you for keeping the lamp lit." : user.planStatus === "trial" ? "Every feature unlocked. See what stays free." : "Unlock Spark, Radar, agents and analytics."}</span>
            </NavLink>
            {stats && (
              <div className="glowcard">
                <div className="row">
                  <span className="tile tile--sm tile--lamp" style={stats.glowToday > 0 ? { animation: "glow 3s ease-in-out infinite" } : undefined}><Flame /></span>
                  <div style={{ lineHeight: 1.25 }}>
                    <div style={{ color: "var(--ink)", fontWeight: 600, fontSize: 14 }}>{stats.streak} day streak</div>
                    <div className="small muted">{stats.level.name} · {stats.glowTotal} glow</div>
                  </div>
                </div>
                <div className="row small muted" style={{ marginTop: 12, marginBottom: 6 }}>Today<span className="spacer" />{stats.glowToday}/{stats.dailyGoal}</div>
                <div className="meter"><span style={{ width: `${goal * 100}%` }} /></div>
              </div>
            )}
            <div className="row" style={{ padding: "0 6px" }}>
              <span className="avatar">{user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : user.name.slice(0, 1).toUpperCase()}</span>
              <div style={{ minWidth: 0, lineHeight: 1.25 }}>
                <div style={{ color: "var(--ink)", fontWeight: 500, fontSize: 13.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.name}</div>
                <div className="small muted">{user.isDemo ? "Demo sandbox" : user.plan === "pro" ? "Pro" : "Reader plan"}</div>
              </div>
              <span className="spacer" />
              <button className="icon-btn" onClick={logout} aria-label="Sign out" title="Sign out"><LogOut size={16} /></button>
            </div>
          </div>
        </aside>

        <div className="main">
          <div className="topbar">
            <form className="search" onSubmit={(e) => { e.preventDefault(); const q = searchRef.current?.value.trim(); nav(`/app/library${q ? `?q=${encodeURIComponent(q)}` : ""}`); }}>
              <Search size={16} />
              <input ref={searchRef} className="input" placeholder="Search your reading" aria-label="Search" />
            </form>
            <span className="kbd" style={{ marginLeft: -4 }}>⌘K</span>
            <span className="spacer" />
            {user.isDemo && <span className="chip chip--iris hide-sm">Demo sandbox</span>}
            <button className="icon-btn hide-sm" title="Take the tour" aria-label="Take the tour" onClick={() => setTourOpen(true)}>?</button>
            <NavLink className="key key--ghost key--sm hide-sm" data-tour="extension" to="/app/extension"><Puzzle size={15} /> Extension</NavLink>
            {agents.length ? (
              <button className="key key--ghost key--sm" data-tour="agent" onClick={() => nav("/app/agents")} title="Your connected agents">
                <span className="dot" style={{ color: agents.some((a) => a.lastUsedAt && Date.now() - a.lastUsedAt < 864e5) ? "var(--mint)" : "var(--ink-4)" }} />
                <Bot size={15} /> <span className="hide-sm">{agents.length === 1 ? agentLabel(agents[0]) : `${agents.length} agents`}</span>
              </button>
            ) : (
              <button className="key key--iris key--sm" data-tour="agent" onClick={() => setAgentOpen(true)}><Bot size={15} /> <span className="hide-sm">Connect agent</span></button>
            )}
            <button className="key key--sm" data-tour="save" onClick={() => setSaveOpen(true)}><Plus size={15} /> Save a link</button>
          </div>
          <Outlet />
        </div>

        <nav className="mobile-bar">
          <NavLink end to="/app"><Home size={19} />Home</NavLink>
          <NavLink to="/app/library"><Library size={19} />Library</NavLink>
          <NavLink to="/app/highlights"><Highlighter size={19} />Highlights</NavLink>
          <NavLink to="/app/radar"><Radar size={19} />Radar</NavLink>
          <NavLink to="/app/settings"><Settings size={19} />More</NavLink>
        </nav>
      </div>
      <ConnectAgent open={agentOpen} pro={user.pro} onClose={() => { setAgentOpen(false); refresh(); }} />
      {shareState && <ShareModal data={shareState.data} refId={shareState.refId} title={shareState.title} onClose={() => setShareState(null)} />}
      <PaywallModal message={paywall} onClose={() => setPaywall(null)} />
      <Tour open={tourOpen} steps={APP_TOUR} name={user.name.replace(/\s*\((demo|test)\)$/, "").split(" ")[0]} onClose={() => { setTourOpen(false); markTour(user.id); }} />
      <SaveModal open={saveOpen} onClose={() => setSaveOpen(false)} collections={collections} onSaved={(id) => { refresh(); toast(<>Saved. <span className="muted">+1 glow</span></>, "glow"); nav(`/app/read/${id}`); }} />
    </AppCtx.Provider>
  );
}

function SaveModal({ open, onClose, collections, onSaved }: { open: boolean; onClose: () => void; collections: Collection[]; onSaved: (id: string) => void }) {
  const [url, setUrl] = useState("");
  const [col, setCol] = useState("");
  const [tags, setTags] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr("");
    try {
      const r = await api.saveItem({ url: url.trim(), collectionId: col || undefined, tags: tags.split(",").map((t) => t.trim()).filter(Boolean) });
      setUrl(""); setTags(""); onClose(); onSaved(r.item.id);
    } catch (e2) { setErr((e2 as Error).message); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Save a link">
      <form className="stack" onSubmit={submit}>
        <label className="field"><span>Link</span><input className="input" autoFocus required type="url" placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} /></label>
        <div className="grid-2">
          <label className="field"><span>Collection</span>
            <select className="select" value={col} onChange={(e) => setCol(e.target.value)}>
              <option value="">None</option>
              {collections.map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
            </select>
          </label>
          <label className="field"><span>Tags</span><input className="input" placeholder="ai, essay" value={tags} onChange={(e) => setTags(e.target.value)} /></label>
        </div>
        {err && <div className="chip chip--peach" style={{ height: "auto", padding: "6px 10px", whiteSpace: "normal" }}>{err}</div>}
        <div className="row" style={{ justifyContent: "flex-end", marginTop: 6 }}>
          <button type="button" className="key key--quiet" onClick={onClose}>Cancel</button>
          <button className="key key--lamp" disabled={busy}>{busy ? "Fetching the page…" : "Save to library"}</button>
        </div>
        <p className="small muted">Lumen fetches the page and makes a clean reader view. For pages behind a login, use the extension.</p>
      </form>
    </Modal>
  );
}
