import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Bot, Check, Crown, Lock, Radar, Sparkles, BarChart3, FileText } from "lucide-react";
import { Modal } from "./ui";

export const PRO_FEATURES: [ReactNode, string, string][] = [
  [<Sparkles />, "Spark", "Writing ideas from your highlights"],
  [<Radar />, "Radar", "Trending stories in your topics"],
  [<Bot />, "Agents", "Claude, Cursor and any MCP client"],
  [<BarChart3 />, "Analytics", "Twelve weeks of your reading"],
  [<FileText />, "Notion and webhooks", "Send highlights anywhere"],
];

export function ProChip({ small }: { small?: boolean }) {
  return <span className="chip chip--lamp" style={small ? { height: 18, fontSize: 10.5, padding: "0 6px" } : undefined}><Crown size={small ? 10 : 11} /> Pro</span>;
}

/** Full page lock for a Pro page once the trial is over. */
export function ProLock({ feature, blurb, icon, mesh = "mesh-lamp" }: { feature: string; blurb: string; icon: ReactNode; mesh?: string }) {
  return (
    <section className={`halftone ${mesh} pro-lock`}>
      <div className="card pop" style={{ padding: 26, maxWidth: 440, textAlign: "center", display: "grid", gap: 12, justifyItems: "center" }}>
        <span className="tile tile--lg tile--lamp">{icon}</span>
        <ProChip />
        <h2 style={{ fontSize: 24, letterSpacing: "-0.03em" }}><span className="lead-in">{feature}</span> <span className="payoff">is part of Pro.</span></h2>
        <p className="muted">{blurb} Your 7 day trial has ended; everything you saved and highlighted stays free.</p>
        <Link className="key key--lamp" to="/app/upgrade"><Crown size={15} /> See Pro</Link>
      </div>
    </section>
  );
}

/** Opened by any 402 from the API. */
export function PaywallModal({ message, onClose }: { message: string | null; onClose: () => void }) {
  return (
    <Modal open={Boolean(message)} onClose={onClose} title="Keep the lamp bright">
      <div className="stack">
        <div className="card-flat row" style={{ padding: 14, background: "var(--lamp-tint)", alignItems: "flex-start" }}>
          <span className="tile tile--lamp"><Lock /></span>
          <p className="small" style={{ color: "var(--ink-2)" }}>{message}</p>
        </div>
        <div className="stack" style={{ gap: 8 }}>
          {PRO_FEATURES.map(([icon, t, d]) => (
            <div key={t} className="row small"><span className="tile tile--xs tile--ink">{icon}</span><b style={{ color: "var(--ink)", fontWeight: 500 }}>{t}</b><span className="muted">{d}</span></div>
          ))}
        </div>
        <div className="row" style={{ justifyContent: "flex-end" }}>
          <button className="key key--quiet" onClick={onClose}>Not now</button>
          <Link className="key key--lamp" to="/app/upgrade" onClick={onClose}><Crown size={15} /> See Pro</Link>
        </div>
      </div>
    </Modal>
  );
}

export function useFeatureList() {
  const [open, setOpen] = useState(false);
  return { open, setOpen };
}

export const FREE_LIST = ["Unlimited saves, highlights and notes", "Reader view, collections, tags", "The browser extension", "Obsidian and markdown destinations", "Daily reads, reminders, readers like you", "15 hosted AI answers a day; your own models unlimited", "Export everything, any time"];
export const PRO_LIST = ["Everything in Free", "Spark: writing ideas from your highlights", "Radar: trending stories in your topics", "Agents over MCP: Claude, Cursor and more", "Analytics: twelve weeks of reading", "Notion and webhook destinations", "500 hosted AI answers a day"];
export function Tick() { return <Check size={16} style={{ color: "var(--mint)", flex: "none", marginTop: 2 }} />; }
