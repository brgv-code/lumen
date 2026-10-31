import { createContext, useContext, useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import type { Collection, Stats, User } from "@lumen/core";
import { Home, Library, Highlighter, FolderHeart, Sparkles, Plug, Settings, Search, Plus, Flame, LogOut, Puzzle } from "lucide-react";
import { Logo, Modal, useToast } from "../../components/ui";
import { api } from "../../lib/api";
import "../../styles/app.css";

interface Ctx {
  user: User;
  stats: Stats | null;
  collections: Collection[];
  refresh: () => void;
  openSave: () => void;
}
const AppCtx = createContext<Ctx>(null as unknown as Ctx);
export const useApp = () => useContext(AppCtx);

export default function Layout() {
  const [user, setUser] = useState<User | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [saveOpen, setSaveOpen] = useState(false);
  const nav = useNavigate();
  const toast = useToast();
  const searchRef = useRef<HTMLInputElement>(null);

  const refresh = () => {
    api.stats().then(setStats).catch(() => {});
    api.collections().then((r) => setCollections(r.data)).catch(() => {});
  };

  useEffect(() => {
    api.me().then((r) => setUser(r.user)).catch(() => nav("/login", { replace: true }));
    refresh();
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); searchRef.current?.focus(); }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s" && !(e.target as HTMLElement).closest("input,textarea")) { e.preventDefault(); setSaveOpen(true); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!user) return <div style={{ minHeight: "100vh" }} />;

  const logout = async () => { await api.logout().catch(() => {}); nav("/"); };
  const goal = stats ? Math.min(1, stats.glowToday / Math.max(1, stats.dailyGoal)) : 0;

  return (
    <AppCtx.Provider value={{ user, stats, collections, refresh, openSave: () => setSaveOpen(true) }}>
      <div className="shell">
        <aside className="side">
          <NavLink to="/" style={{ padding: "4px 8px" }}><Logo size={26} /></NavLink>
          <nav className="side__nav">
            <NavLink end to="/app" className="side__link"><Home /> Home</NavLink>
            <NavLink to="/app/library" className="side__link"><Library /> Library {stats && <span className="count">{stats.counts.inbox + stats.counts.reading}</span>}</NavLink>
            <NavLink to="/app/highlights" className="side__link"><Highlighter /> Highlights {stats && <span className="count">{stats.counts.highlights}</span>}</NavLink>
            <NavLink to="/app/collections" className="side__link"><FolderHeart /> Collections</NavLink>
            <NavLink to="/app/spark" className="side__link"><Sparkles /> Spark</NavLink>
            <div className="side__section">Connect</div>
            <NavLink to="/app/integrations" className="side__link"><Plug /> Integrations</NavLink>
            <NavLink to="/app/settings" className="side__link"><Settings /> Settings</NavLink>
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
            <a className="key key--ghost key--sm hide-sm" href="https://github.com/brgv-code/lumen#quick-start" target="_blank" rel="noreferrer"><Puzzle size={15} /> Extension</a>
            <button className="key key--sm" onClick={() => setSaveOpen(true)}><Plus size={15} /> Save a link</button>
          </div>
          <Outlet />
        </div>

        <nav className="mobile-bar">
          <NavLink end to="/app"><Home size={19} />Home</NavLink>
          <NavLink to="/app/library"><Library size={19} />Library</NavLink>
          <NavLink to="/app/highlights"><Highlighter size={19} />Highlights</NavLink>
          <NavLink to="/app/spark"><Sparkles size={19} />Spark</NavLink>
          <NavLink to="/app/settings"><Settings size={19} />More</NavLink>
        </nav>
      </div>
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
