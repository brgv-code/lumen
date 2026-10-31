import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Download, KeyRound, LogOut, Moon, Trash2 } from "lucide-react";
import { api } from "../../lib/api";
import { getTheme, setTheme, timeAgo } from "../../lib/hooks";
import { Segmented, useToast } from "../../components/ui";
import { useApp } from "./Layout";

export default function Settings() {
  const { user, refresh } = useApp();
  const toast = useToast();
  const nav = useNavigate();
  const [name, setName] = useState(user.name);
  const [goal, setGoal] = useState(user.dailyGoal);
  const [theme, setT] = useState(getTheme());
  const [tokens, setTokens] = useState<{ id: string; name: string; prefix: string; lastUsedAt: number | null; createdAt: number }[]>([]);
  const loadTokens = () => api.tokens().then((r) => setTokens(r.data)).catch(() => {});
  useEffect(() => { loadTokens(); }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.updateMe({ name, dailyGoal: goal, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone });
    refresh(); toast("Saved");
  };

  return (
    <div className="page" style={{ maxWidth: 820 }}>
      <div className="page-head"><div><span className="eyebrow">Settings</span><h1 style={{ marginTop: 8 }}><span className="lead-in">Make it</span> <span className="payoff">yours.</span></h1></div></div>

      <form className="panel stack" onSubmit={save}>
        <h2>Profile</h2>
        <div className="grid-2">
          <label className="field"><span>Name</span><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></label>
          <label className="field"><span>Email</span><input className="input" value={user.email ?? (user.isDemo ? "demo sandbox" : "not shared")} disabled /></label>
        </div>
        <label className="field"><span>Daily glow goal: {goal}</span><input type="range" min={5} max={100} step={5} value={goal} onChange={(e) => setGoal(Number(e.target.value))} style={{ accentColor: "var(--lamp)" }} /></label>
        <div><button className="key key--sm">Save profile</button></div>
      </form>

      <section className="panel stack">
        <div className="row"><span className="tile tile--sm tile--ink"><Moon /></span><h2>Appearance</h2></div>
        <Segmented label="Theme" size="sm" value={theme} onChange={(v) => { setT(v); setTheme(v); }} options={[{ value: "system", label: "System" }, { value: "light", label: "Light" }, { value: "dark", label: "Dark" }]} />
      </section>

      <section className="panel stack">
        <div className="row"><span className="tile tile--sm tile--ink"><KeyRound /></span><h2>Access tokens</h2><span className="spacer" /><button className="key key--ghost key--sm" onClick={() => nav("/app/integrations")}>Create in Integrations</button></div>
        {tokens.length === 0 && <p className="small muted">No tokens. The extension needs one to sync.</p>}
        {tokens.map((t) => (
          <div key={t.id} className="card-flat row" style={{ padding: 12 }}>
            <code className="mono small">{t.prefix}…</code><b style={{ color: "var(--ink)", fontSize: 14 }}>{t.name}</b>
            <span className="spacer" /><span className="small muted">{t.lastUsedAt ? `used ${timeAgo(t.lastUsedAt)}` : "never used"}</span>
            <button className="icon-btn" aria-label="Revoke" onClick={async () => { await api.deleteToken(t.id); loadTokens(); toast("Token revoked"); }}><Trash2 size={15} /></button>
          </div>
        ))}
      </section>

      <section className="panel stack">
        <h2>Your data</h2>
        <p className="small muted">Everything you saved, highlighted and noted, as one JSON file. Collections also export as markdown from their page.</p>
        <div className="row" style={{ flexWrap: "wrap" }}>
          <a className="key key--ghost key--sm" href="/api/v1/export"><Download size={15} /> Export JSON</a>
          <button className="key key--ghost key--sm" onClick={async () => { await api.logout(); nav("/"); }}><LogOut size={15} /> Sign out</button>
          <span className="spacer" />
          <button className="key key--danger key--sm" onClick={async () => { if (window.confirm("Delete your account and everything in it? This cannot be undone.")) { await api.deleteMe(); nav("/"); } }}><Trash2 size={15} /> Delete account</button>
        </div>
      </section>
    </div>
  );
}
