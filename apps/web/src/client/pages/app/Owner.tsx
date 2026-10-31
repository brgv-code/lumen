import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Gauge, ExternalLink } from "lucide-react";
import { api, type OwnerStats } from "../../lib/api";
import { timeAgo } from "../../lib/hooks";
import { PageHero } from "../../components/PageHero";
import { useApp } from "./Layout";

const NOTE: Record<string, string> = {
  ok: "Trial given",
  no_verified_email: "No verified email",
  disposable_email: "Disposable email",
  new_github_account: "New GitHub account",
  email_had_trial: "Email already had a trial",
  device_had_trial: "Device already had a trial",
  network_had_trials: "Network already had trials",
  "before guards": "Before the guards",
};

export default function Owner() {
  const { user } = useApp();
  const [s, setS] = useState<OwnerStats | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => { if (user.owner) api.ownerStats().then(setS).catch((e) => setErr((e as Error).message)); }, [user.owner]);
  if (!user.owner) return <Navigate to="/app" replace />;

  const f = s?.funnel;
  const steps: [string, number][] = f ? [["Signed up", f.signedUp], ["Saved a page", f.saved], ["Highlighted", f.highlighted], ["Connected the extension", f.extension], ["Came back after day one", f.returned]] : [];
  const maxAi = Math.max(s?.aiSoftCap ?? 1, ...(s?.ai.map((d) => d.count) ?? [1]));

  return (
    <div className="page">
      <PageHero pill={<><Gauge size={13} /> Owner</>} lead="Who is reading," pay="and how it goes."
        sub="Signups, activation and hosted AI from Lumen's own database. Funnels over time, retention, paths and replays are in PostHog."
        mesh="mesh-lamp" tiles={[["tile--lamp", <Gauge />], ["tile--ink", <ExternalLink />]]}
        actions={<a className="key key--ghost key--sm" href="https://eu.posthog.com" target="_blank" rel="noreferrer">Open PostHog <ExternalLink size={13} /></a>} />
      {err && <p className="small" style={{ color: "var(--rose, #c33)" }}>{err}</p>}
      {s && (
        <>
          {!s.posthog && <div className="card-flat" style={{ padding: 14, background: "var(--lamp-tint)" }}><span className="small">PostHog is off: set the <code>POSTHOG_KEY</code> secret to start sending events.</span></div>}
          <div className="owner-kpis">
            {([["Accounts", s.totals.users], ["New today", s.totals.today], ["New this week", s.totals.week], ["New this month", s.totals.month], ["Active today", s.active.day], ["Active this week", s.active.week], ["On trial", s.totals.trialing], ["Paying", s.totals.paying], ["Demo sandboxes this week", s.totals.demos_week]] as [string, number][]).map(([k, v]) => (
              <div key={k} className="card-flat owner-kpi"><span className="small muted">{k}</span><b>{v ?? 0}</b></div>
            ))}
          </div>

          <section className="panel stack">
            <h2>Activation</h2>
            {steps.map(([label, n]) => (
              <div key={label} className="owner-bar">
                <span className="small">{label}</span>
                <span className="owner-bar__track"><span style={{ width: `${f!.signedUp ? (n / f!.signedUp) * 100 : 0}%` }} /></span>
                <span className="small mono">{n}{f!.signedUp ? ` · ${Math.round((n / f!.signedUp) * 100)}%` : ""}</span>
              </div>
            ))}
          </section>

          <section className="panel stack">
            <h2>Hosted AI per day</h2>
            <p className="small muted">After {s.aiSoftCap} answers a day across everyone, answers move to the small model so the free Workers AI allowance lasts the day.</p>
            {s.ai.length === 0 ? <p className="small muted">No hosted answers yet.</p> : s.ai.map((d) => (
              <div key={d.day} className="owner-bar">
                <span className="small mono">{d.day}</span>
                <span className="owner-bar__track"><span style={{ width: `${(d.count / maxAi) * 100}%`, background: d.count > s.aiSoftCap ? "var(--rose, #e5737a)" : undefined }} /></span>
                <span className="small mono">{d.count}</span>
              </div>
            ))}
          </section>

          <section className="panel stack">
            <h2>Trials</h2>
            <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
              {s.trialNotes.map((t) => <span key={t.note} className={`chip ${t.note === "ok" ? "chip--mint" : ""}`}>{NOTE[t.note] ?? t.note} · {t.n}</span>)}
            </div>
          </section>

          <section className="panel stack">
            <h2>Latest signups</h2>
            <div className="owner-table">
              <table>
                <thead><tr><th>Reader</th><th>Joined</th><th>Plan</th><th>Saved</th><th>Highlights</th><th>AI</th><th>Extension</th><th>Agents</th><th>Last active</th></tr></thead>
                <tbody>
                  {s.signups.map((u) => (
                    <tr key={u.id}>
                      <td><b>{u.name}</b><br /><span className="small muted">{u.email ?? "no email"} · {u.providers ?? "?"}</span></td>
                      <td className="small">{timeAgo(u.createdAt)}</td>
                      <td><span className={`chip ${u.status !== "free" ? "chip--lamp" : ""}`}>{u.status}</span>{u.trialNote && u.trialNote !== "ok" && <><br /><span className="small muted">{NOTE[u.trialNote] ?? u.trialNote}</span></>}</td>
                      <td className="mono">{u.items}</td><td className="mono">{u.highlights}</td><td className="mono">{u.ai}</td>
                      <td>{u.extension ? "yes" : "no"}</td><td className="mono">{u.agents}</td>
                      <td className="small">{u.lastActive ? timeAgo(u.lastActive) : "never"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
