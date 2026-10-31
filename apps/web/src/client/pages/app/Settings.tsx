import { useEffect, useState } from "react";
import { PageHero } from "../../components/PageHero";
import { Link, useNavigate } from "react-router-dom";
import { Crown, Download, KeyRound, LogOut, Moon, Trash2 } from "lucide-react";
import { api, type Token } from "../../lib/api";
import { getTheme, setTheme, timeAgo } from "../../lib/hooks";
import { Segmented, useToast } from "../../components/ui";
import { useApp } from "./Layout";

export default function Settings() {
  const { user, refresh, startTour } = useApp();
  const toast = useToast();
  const nav = useNavigate();
  const [name, setName] = useState(user.name);
  const [goal, setGoal] = useState(user.dailyGoal);
  const [theme, setT] = useState(getTheme());
  const [tokens, setTokens] = useState<Token[]>([]);
  const [share, setShare] = useState(user.shareSignals);
  const [remind, setRemind] = useState(user.reminders);
  const loadTokens = () => api.tokens().then((r) => setTokens(r.data)).catch(() => {});
  useEffect(() => { loadTokens(); }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    await api.updateMe({ name, dailyGoal: goal, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone });
    refresh(); toast("Saved");
  };

  return (
    <div className="page" style={{ maxWidth: 820 }}>
      <PageHero
        pill="Settings"
        lead="Make it"
        pay="yours."
        sub="Profile, reminders, privacy, theme, tokens and your data."
        mesh="mesh-lamp"
        tiles={[["tile--ink", <Moon />], ["tile--lamp", <KeyRound />], ["tile--mint", <Download />], ["tile--iris", <LogOut />]]}
      />

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
        <div className="row"><span className="tile tile--sm tile--lamp"><Crown /></span><h2>Plan</h2><span className="spacer" /><span className={`chip ${user.planStatus === "free" ? "" : "chip--lamp"}`}>{user.planStatus === "pro" ? "Pro" : user.planStatus === "trial" ? `Pro trial · ${user.trialDaysLeft}d left` : "Free"}</span></div>
        <p className="small muted">{user.planStatus === "trial" ? `Every Pro feature is on until ${new Date(user.trialEndsAt).toLocaleDateString(undefined, { month: "long", day: "numeric" })}. Your library, highlights and Obsidian sync stay free after that.` : user.planStatus === "free" ? "Your library, highlights, notes and Obsidian sync are free forever." : "Thank you for supporting Lumen."}</p>
        <div className="row" style={{ flexWrap: "wrap" }}><Link to="/app/upgrade" className="key key--lamp key--sm"><Crown size={14} /> {user.planStatus === "pro" ? "Manage plan" : "See Pro"}</Link><button className="key key--ghost key--sm" onClick={startTour}>Replay the tour</button></div>
      </section>

      <section className="panel stack">
        <h2>Reading and privacy</h2>
        <Toggle on={remind} label="Reminders" hint="Nudge me about articles I started and left for a day or more (dashboard and extension)." onChange={async (v) => { setRemind(v); await api.updateMe({ reminders: v }); refresh(); }} />
        <Toggle on={share} label="Anonymous reading signals" hint="Count my saved public links toward “readers like you” suggestions. Only links saved by two or more readers are ever shown, never who saved them, never highlights or notes." onChange={async (v) => { setShare(v); await api.updateMe({ shareSignals: v }); refresh(); }} />
      </section>

      <section className="panel stack">
        <div className="row"><span className="tile tile--sm tile--ink"><Moon /></span><h2>Appearance</h2></div>
        <Segmented label="Theme" size="sm" value={theme} onChange={(v) => { setT(v); setTheme(v); }} options={[{ value: "system", label: "System" }, { value: "light", label: "Light" }, { value: "dark", label: "Dark" }]} />
      </section>

      <section className="panel stack">
        <div className="row"><span className="tile tile--sm tile--ink"><KeyRound /></span><h2>Access tokens</h2><span className="spacer" /><button className="key key--ghost key--sm" onClick={() => nav("/app/integrations")}>Create in Integrations</button></div>
        {tokens.length === 0 && <p className="small muted">No tokens. The extension needs one to sync.</p>}
        {tokens.map((t) => (
          <div key={t.id} className="card-flat row" style={{ padding: 12 }}>
            <code className="mono small">{t.prefix}…</code><b style={{ color: "var(--ink)", fontSize: 14 }}>{t.client ?? t.name}</b><span className={`chip ${t.kind === "agent" ? "chip--iris" : ""}`}>{t.kind === "agent" ? "Agent" : "Extension"}</span>
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

function Toggle({ on, label, hint, onChange }: { on: boolean; label: string; hint: string; onChange: (v: boolean) => void }) {
  return (
    <label className="row" style={{ alignItems: "flex-start", gap: 14, cursor: "pointer" }}>
      <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)}
        style={{ flex: "none", width: 44, height: 26, borderRadius: 99, border: 0, padding: 3, cursor: "pointer", background: on ? "var(--key-lamp)" : "var(--well)", transition: "background 200ms ease", boxShadow: "inset 0 1px 2px rgba(0,0,0,.12)" }}>
        <span style={{ display: "block", width: 20, height: 20, borderRadius: 99, background: "#fff", boxShadow: "0 2px 4px rgba(0,0,0,.2)", transform: on ? "translateX(18px)" : "none", transition: "transform 220ms var(--ease-spring)" }} />
      </button>
      <span><b style={{ color: "var(--ink)", fontWeight: 500 }}>{label}</b><br /><span className="small muted">{hint}</span></span>
    </label>
  );
}
