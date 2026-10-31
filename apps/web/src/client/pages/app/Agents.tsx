import { useEffect, useState } from "react";
import { Bot, Copy, Plus, Sparkles, Terminal, Trash2, Wrench, Activity } from "lucide-react";
import { api, type Token, agentLabel } from "../../lib/api";
import { timeAgo } from "../../lib/hooks";
import { Empty, useToast } from "../../components/ui";
import { PageHero } from "../../components/PageHero";
import { useApp } from "./Layout";

const PROMPTS = [
  "Use Lumen to do my weekly reading review.",
  "What is trending in my topics this week that connects to what I have been highlighting?",
  "Find everything I saved about evals and summarise the three strongest arguments, quoting my highlights.",
  "Save https://example.com/an-article to Lumen in my Reading list.",
  "Based on my notes, suggest two posts I could write next.",
];
const TOOLS = ["search_library", "get_item", "list_highlights", "get_daily_reads", "get_trending", "suggest_content", "get_reading_stats", "list_collections", "readers_like_you", "save_url", "add_highlight", "add_note", "set_status", "follow_topic"];

export default function Agents() {
  const toast = useToast();
  const { openAgent, refresh, user } = useApp();
  const [list, setList] = useState<Token[] | null>(null);
  const load = () => api.tokens().then((r) => setList(r.data.filter((t) => t.kind === "agent"))).catch(() => setList([]));
  useEffect(() => { load(); }, []);

  const status = (t: Token) => !t.lastUsedAt ? { label: "Waiting for first connection", cls: "" }
    : Date.now() - t.lastUsedAt < 864e5 ? { label: `Active · ${timeAgo(t.lastUsedAt)}`, cls: "chip--mint" }
    : { label: `Last used ${timeAgo(t.lastUsedAt)}`, cls: "" };

  return (
    <div className="page">
      <PageHero pill={<><Bot size={13} /> Agents</>} lead="Your agents," pay="reading with you."
        sub="Every agent connected to your Lumen library over MCP: what it is, when it last worked, and what it can do."
        mesh="mesh-iris" tiles={[["tile--iris", <Bot />], ["tile--lamp", <Sparkles />], ["tile--ink", <Terminal />], ["tile--mint", <Activity />]]}
        actions={<button className="key key--iris key--sm" onClick={openAgent}><Plus size={14} /> Connect another agent</button>} />

      {!user.pro && <div className="card-flat row" style={{ padding: 14, background: "var(--lamp-tint)" }}><span className="small" style={{ flex: 1 }}>Agent tools are part of Lumen Pro. Your agents stay connected and answer again once you upgrade.</span><a className="key key--lamp key--sm" href="/app/upgrade">See Pro</a></div>}

      {list && list.length === 0 ? (
        <Empty icon={<Bot />} title="No agents connected yet" action={<button className="key key--iris" onClick={openAgent}><Plus size={14} /> Connect an agent</button>}>
          Claude Code, Claude Desktop, Cursor or any MCP client can search your library, read with your highlights, and save what it finds.
        </Empty>
      ) : (
        <div className="cards" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}>
          {(list ?? []).map((t) => {
            const st = status(t);
            return (
              <article key={t.id} className="item-card" style={{ padding: 18 }}>
                <div className="row"><span className="tile tile--iris"><Bot /></span>
                  <div style={{ minWidth: 0 }}><h3 style={{ fontSize: 17 }}>{agentLabel(t)}</h3><span className="small muted mono">{t.prefix}… · added {timeAgo(t.createdAt)}</span></div>
                  <span className="spacer" />
                  <button className="icon-btn" aria-label="Disconnect" title="Disconnect (revokes the key)" onClick={async () => { if (window.confirm(`Disconnect ${agentLabel(t)}? Its key stops working immediately.`)) { await api.deleteToken(t.id); load(); refresh(); toast("Agent disconnected"); } }}><Trash2 size={15} /></button>
                </div>
                <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                  <span className={`chip ${st.cls}`}>{st.label}</span>
                  <span className="chip">{t.calls ?? 0} tool {(t.calls ?? 0) === 1 ? "call" : "calls"}</span>
                  {t.lastTool && <span className="chip chip--iris"><Wrench size={11} /> {t.lastTool}</span>}
                </div>
                {!t.lastUsedAt && <p className="small muted">Run the command from Connect agent in your terminal or client, then ask it anything about your library. This card turns green on the first call.</p>}
              </article>
            );
          })}
        </div>
      )}

      <div className="grid-2">
        <section className="panel stack" style={{ gap: 8 }}>
          <h2>Try asking</h2>
          {PROMPTS.map((p) => (
            <button key={p} className="card-flat row" style={{ padding: 12, border: 0, textAlign: "left", font: "inherit", cursor: "pointer" }} onClick={async () => { await navigator.clipboard.writeText(p); toast("Prompt copied"); }}>
              <span className="tile tile--xs tile--iris"><Sparkles /></span><span style={{ flex: 1, color: "var(--ink)", fontSize: 14 }}>{p}</span><Copy size={14} className="muted" />
            </button>
          ))}
        </section>
        <section className="panel">
          <h2 style={{ marginBottom: 12 }}>What your agent can do</h2>
          <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>{TOOLS.map((t) => <span key={t} className="chip mono" style={{ fontSize: 11.5 }}>{t}</span>)}</div>
          <p className="small muted" style={{ marginTop: 12 }}>Agents act with your permissions and nothing more. Prompts: <span className="mono">weekly_review</span>, <span className="mono">what_to_read</span>. Full reference in <a href="/docs/mcp" style={{ textDecoration: "underline" }}>the MCP docs</a>.</p>
        </section>
      </div>
    </div>
  );
}
