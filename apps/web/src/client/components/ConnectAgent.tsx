import { useEffect, useState } from "react";
import { Bot, Check, Copy, KeyRound, Terminal, Trash2 } from "lucide-react";
import { api, type Token } from "../lib/api";
import { timeAgo } from "../lib/hooks";
import { Modal, Segmented, useToast } from "./ui";

type Client = "claude-code" | "claude-desktop" | "cursor" | "other";

export function ConnectAgent({ open, onClose, pro = true }: { open: boolean; onClose: () => void; pro?: boolean }) {
  const toast = useToast();
  const [client, setClient] = useState<Client>("claude-code");
  const [key, setKey] = useState<string | null>(null);
  const [agents, setAgents] = useState<Token[]>([]);
  const endpoint = `${location.origin}/mcp`;
  const load = () => api.tokens().then((r) => setAgents(r.data.filter((t) => t.kind === "agent"))).catch(() => {});
  useEffect(() => { if (open) load(); }, [open]);

  const shown = key ?? "lum_your_key";
  const snippet = {
    "claude-code": `claude mcp add --transport http lumen ${endpoint} \\\n  --header "Authorization: Bearer ${shown}"`,
    "claude-desktop": JSON.stringify({ mcpServers: { lumen: { command: "npx", args: ["-y", "mcp-remote", endpoint, "--header", `Authorization:Bearer ${shown}`] } } }, null, 2),
    cursor: JSON.stringify({ mcpServers: { lumen: { url: endpoint, headers: { Authorization: `Bearer ${shown}` } } } }, null, 2),
    other: `Endpoint: ${endpoint}\nTransport: Streamable HTTP\nHeader: Authorization: Bearer ${shown}`,
  }[client];
  const where = { "claude-code": "Run in your terminal", "claude-desktop": "Add to claude_desktop_config.json", cursor: "Add to ~/.cursor/mcp.json", other: "Any MCP client" }[client];

  const create = async () => {
    try { const r = await api.createToken("AI agent", "agent"); setKey(r.token); load(); } catch (e) { toast((e as Error).message, "err"); }
  };

  return (
    <Modal open={open} onClose={() => { setKey(null); onClose(); }} title="Connect your agent">
      <div className="stack">
        <div className="card-flat row" style={{ padding: 14, background: "var(--iris-tint)", alignItems: "flex-start" }}>
          <span className="tile tile--iris"><Bot /></span>
          <p className="small" style={{ color: "var(--ink-2)" }}>
            Give Claude, Cursor or any MCP agent your library: it can search what you saved, read with your highlights, watch trending topics, save links and suggest what to write next.
          </p>
        </div>
        {!pro && (
          <div className="card-flat row" style={{ padding: 12, background: "var(--lamp-tint)" }}>
            <span className="small" style={{ flex: 1 }}>Agent access is part of Lumen Pro. You can connect now; tools answer again once you upgrade.</span>
            <a className="key key--lamp key--sm" href="/app/upgrade">See Pro</a>
          </div>
        )}
        <Segmented label="Client" size="sm" value={client} onChange={setClient} options={[
          { value: "claude-code", label: "Claude Code" }, { value: "claude-desktop", label: "Claude Desktop" }, { value: "cursor", label: "Cursor" }, { value: "other", label: "Other" },
        ]} />
        {!key && (
          <button className="key key--iris" onClick={create}><KeyRound size={15} /> Create a connection key</button>
        )}
        <div>
          <div className="row small muted" style={{ marginBottom: 6 }}><Terminal size={14} /> {where}{!key && " (create a key to fill it in)"}</div>
          <pre className="mono" style={{ margin: 0, padding: 14, borderRadius: 12, background: "#121215", color: "#e8e8ea", fontSize: 12.5, overflowX: "auto", whiteSpace: "pre" }}>{snippet}</pre>
          <div className="row" style={{ marginTop: 8 }}>
            <button className="key key--sm" disabled={!key} onClick={async () => { await navigator.clipboard.writeText(snippet); toast("Copied"); }}><Copy size={14} /> Copy</button>
            {key && <span className="chip chip--mint"><Check size={11} /> Key shown once; it is in the snippet</span>}
          </div>
        </div>
        <p className="small muted">Then ask: <i>“Use Lumen to do my weekly reading review.”</i> Full tool list in <a href="/docs/mcp" style={{ textDecoration: "underline" }}>the MCP docs</a>.</p>
        {agents.length > 0 && (
          <div className="stack" style={{ gap: 8 }}>
            <div className="eyebrow">Connected agents</div>
            {agents.map((t) => (
              <div key={t.id} className="card-flat row" style={{ padding: 10 }}>
                <span className="tile tile--sm tile--ink"><Bot /></span>
                <div style={{ lineHeight: 1.3 }}><div style={{ color: "var(--ink)", fontWeight: 500, fontSize: 14 }}>{t.client ?? t.name}</div><div className="small muted mono">{t.prefix}… · {t.lastUsedAt ? `used ${timeAgo(t.lastUsedAt)}` : "not used yet"}</div></div>
                <span className="spacer" />
                <button className="icon-btn" aria-label="Revoke" onClick={async () => { await api.deleteToken(t.id); load(); toast("Agent disconnected"); }}><Trash2 size={15} /></button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
