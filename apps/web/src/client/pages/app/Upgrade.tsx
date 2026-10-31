import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Crown, Sparkles, Check, Clock } from "lucide-react";
import { api } from "../../lib/api";
import { burst, useToast } from "../../components/ui";
import { PageHero } from "../../components/PageHero";
import { FREE_LIST, PRO_LIST, Tick } from "../../components/Pro";
import { useApp } from "./Layout";

export default function Upgrade() {
  const { user, refresh, setUser } = useApp();
  const toast = useToast();
  const [params] = useSearchParams();
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api.billing().then((r) => { setConfigured(r.configured); setUser(r.user); }).catch(() => setConfigured(false));
    if (params.get("status") === "success") toast("Welcome to Pro. Thank you!", "glow");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const upgrade = async (e: React.MouseEvent) => {
    const { clientX, clientY } = e;
    setBusy(true);
    try {
      if (configured) { const r = await api.checkout(); location.href = r.url; return; }
      await api.billingInterest();
      setUser({ ...user, billingInterest: true });
      burst(clientX, clientY);
      toast("You are on the early access list", "glow");
    } catch (err) { toast((err as Error).message, "err"); } finally { setBusy(false); }
  };

  const status = user.planStatus;
  return (
    <div className="page">
      <PageHero
        pill={<><Crown size={13} style={{ color: "var(--lamp)" }} /> {status === "pro" ? "You are on Pro" : status === "trial" ? `Pro trial · ${user.trialDaysLeft} ${user.trialDaysLeft === 1 ? "day" : "days"} left` : "Free plan"}</>}
        lead={status === "pro" ? "Thank you for" : "Keep the lamp"}
        pay={status === "pro" ? "keeping the lamp lit." : "bright."}
        sub={status === "trial" ? "You have every Pro feature right now. When the trial ends, everything you saved stays free; Spark, Radar, agents, analytics and Notion move to Pro." : status === "free" ? "Your library, highlights, notes and Obsidian sync are free forever. Pro adds the parts that think with you." : "Everything is unlocked."}
        mesh="mesh-lamp"
        tiles={[["tile--lamp", <Crown />], ["tile--iris", <Sparkles />], ["tile--mint", <Check />], ["tile--sky", <Clock />]]}
      />

      <div className="grid-2">
        <section className="panel stack">
          <div className="row"><h2>Free</h2><span className="spacer" />{status === "free" && <span className="chip">Your plan</span>}</div>
          <div><span style={{ fontSize: 40, fontWeight: 600, letterSpacing: "-0.04em", color: "var(--ink)" }}>€0</span> <span className="small muted">forever</span></div>
          <ul className="stack" style={{ listStyle: "none", padding: 0, margin: 0, gap: 8 }}>{FREE_LIST.map((i) => <li key={i} className="row small" style={{ alignItems: "flex-start" }}><Tick />{i}</li>)}</ul>
        </section>
        <section className="panel stack" style={{ background: "var(--ink)", color: "color-mix(in srgb, var(--on-ink) 78%, transparent)" }}>
          <div className="row"><h2 style={{ color: "var(--on-ink)" }}>Pro</h2><span className="spacer" />{status !== "free" && <span className="chip chip--lamp">{status === "pro" ? "Your plan" : "Trial"}</span>}</div>
          <div><span style={{ fontSize: 40, fontWeight: 600, letterSpacing: "-0.04em", color: "var(--on-ink)" }}>€6</span> <span className="small">per month, billed yearly</span></div>
          <ul className="stack" style={{ listStyle: "none", padding: 0, margin: 0, gap: 8 }}>{PRO_LIST.map((i) => <li key={i} className="row small" style={{ alignItems: "flex-start" }}><Check size={16} style={{ color: "var(--lamp-hi)", flex: "none", marginTop: 2 }} />{i}</li>)}</ul>
          {status === "pro" ? (
            <button className="key key--ghost" onClick={async () => { try { const r = await api.portal(); location.href = r.url; } catch (e) { toast((e as Error).message, "err"); } }}>Manage billing</button>
          ) : user.billingInterest && !configured ? (
            <span className="chip chip--mint" style={{ height: 40, justifyContent: "center", borderRadius: 12 }}><Check size={14} /> You are on the early access list</span>
          ) : (
            <button className="key key--lamp key--lg" disabled={busy || configured === null} onClick={upgrade}><Crown size={16} /> {configured ? "Upgrade to Pro" : "Get early access to Pro"}</button>
          )}
          {configured === false && status !== "pro" && <p className="small" style={{ opacity: 0.75 }}>Billing opens soon. Join early access and Pro stays on for you when it does.</p>}
        </section>
      </div>

      {(user.isDemo || user.name.endsWith("(test)")) && (
        <section className="panel row" style={{ flexWrap: "wrap", background: "var(--iris-tint)" }}>
          <div style={{ flex: 1, minWidth: 240 }}><h2>Preview the paywall</h2><p className="small muted">Demo and test accounts can end the trial to see what free readers see, then restart it.</p></div>
          <button className="key key--ghost key--sm" onClick={async () => { const r = await api.previewTrial("end"); setUser(r.user); refresh(); toast("Trial ended (preview)"); }}>End my trial</button>
          <button className="key key--iris key--sm" onClick={async () => { const r = await api.previewTrial("restart"); setUser(r.user); refresh(); toast("Trial restarted", "glow"); }}>Restart trial</button>
        </section>
      )}
    </div>
  );
}
