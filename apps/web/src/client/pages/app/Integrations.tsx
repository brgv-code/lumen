import { useEffect, useState } from "react";
import { PageHero } from "../../components/PageHero";
import type { Destination } from "@lumen/core";
import { Check, Cpu, Download, FileText, KeyRound, NotebookPen, Plus, Puzzle, RefreshCw, Send, Trash2, Webhook, Copy } from "lucide-react";
import { api } from "../../lib/api";
import { Modal, useToast } from "../../components/ui";
import { timeAgo } from "../../lib/hooks";
import { useApp } from "./Layout";
import { extension } from "../../lib/extension";
import { ProChip } from "../../components/Pro";

const KINDS = {
  obsidian: { label: "Obsidian", tile: "tile--iris", icon: <NotebookPen />, blurb: "Append to a note in your vault through the Local REST API plugin. Runs in your browser; the key never leaves it." },
  notion: { label: "Notion", tile: "tile--ink", icon: <FileText />, blurb: "Append quote blocks to a Notion page with an internal integration token." },
  markdown: { label: "Markdown file", tile: "tile--sky", icon: <Download />, blurb: "Download only the new highlights as a .md file, ready for any editor." },
  webhook: { label: "Webhook", tile: "tile--mint", icon: <Webhook />, blurb: "POST new highlights as JSON to your own endpoint, signed with HMAC." },
} as const;
type Kind = keyof typeof KINDS;

const keyFor = (id: string) => `lumen-obsidian-key-${id}`;
const getKey = (id: string) => { try { return localStorage.getItem(keyFor(id)) ?? ""; } catch { return ""; } };

export default function Integrations() {
  const toast = useToast();
  const { openAgent, user } = useApp();
  const [dests, setDests] = useState<Destination[] | null>(null);
  const [adding, setAdding] = useState<Kind | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const load = () => api.destinations().then((r) => setDests(r.data)).catch(() => setDests([]));
  useEffect(() => { load(); }, []);

  const sync = async (d: Destination) => {
    setBusy(d.id);
    try {
      if (d.kind === "notion" || d.kind === "webhook") {
        const r = await api.push(d.id);
        toast(r.delivered ? `Sent ${r.delivered} highlights to ${d.name}` : "Nothing new to send");
      } else {
        const p = await api.pending(d.id);
        if (!p.highlightIds.length) { toast("Nothing new: every highlight was already sent"); return; }
        if (d.kind === "markdown") {
          const blob = new Blob([p.markdown], { type: "text/markdown" });
          const a = document.createElement("a");
          a.href = URL.createObjectURL(blob);
          a.download = String(d.config.fileName || "lumen-highlights.md");
          a.click();
          URL.revokeObjectURL(a.href);
        } else {
          const cfg = d.config as { baseUrl: string; notePath: string };
          const key = getKey(d.id);
          if (!key) throw new Error("Add your Obsidian Local REST API key first.");
          const res = await fetch(`${cfg.baseUrl.replace(/\/$/, "")}/vault/${cfg.notePath.split("/").map(encodeURIComponent).join("/")}`, {
            method: "POST",
            headers: { authorization: `Bearer ${key}`, "content-type": "text/markdown" },
            body: p.markdown,
          }).catch(() => { throw new Error("Could not reach Obsidian. Is it open with the Local REST API plugin, and is its certificate trusted?"); });
          if (!res.ok) throw new Error(`Obsidian answered ${res.status}`);
        }
        await api.ack(d.id, p.highlightIds);
        toast(`Sent ${p.highlightIds.length} new highlights to ${d.name}`);
      }
      load();
    } catch (e) { toast((e as Error).message, "err"); } finally { setBusy(null); }
  };

  return (
    <div className="page">
      <PageHero
        pill={<><Send size={13} /> Integrations</>}
        lead="Send highlights"
        pay="where you think."
        sub="A destination is a note. Point collections at it and Lumen appends only highlights it has not received yet. Clip a page ten times; each passage lands once."
        mesh="mesh-mint"
        tiles={[["tile--iris", <NotebookPen />], ["tile--ink", <FileText />], ["tile--sky", <Download />], ["tile--mint", <Webhook />]]}
        actions={<button className="key key--iris key--sm" onClick={openAgent}>Connect agent</button>}
      />

      <section className="grid-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
        {(Object.keys(KINDS) as Kind[]).map((k) => (
          <button key={k} className="item-card" style={{ border: 0, textAlign: "left", cursor: "pointer", font: "inherit" }} onClick={() => ((k === "notion" || k === "webhook") && !user.pro ? window.dispatchEvent(new CustomEvent("lumen:paywall", { detail: `${KINDS[k].label} destinations are part of Lumen Pro.` })) : setAdding(k))}>
            <div className="row"><span className={`tile ${KINDS[k].tile}`}>{KINDS[k].icon}</span><span className="spacer" />{(k === "notion" || k === "webhook") && !user.pro && <ProChip />}<span className="chip"><Plus size={12} /> Add</span></div>
            <h3>{KINDS[k].label}</h3>
            <p className="excerpt" style={{ WebkitLineClamp: 3 }}>{KINDS[k].blurb}</p>
          </button>
        ))}
      </section>

      <section className="panel">
        <div className="row" style={{ marginBottom: 14 }}><h2>Your destinations</h2><span className="chip">{dests?.length ?? 0}</span></div>
        <div className="stack">
          {dests?.length === 0 && <p className="muted small">No destinations yet. Add one above.</p>}
          {dests?.map((d) => {
            const meta = KINDS[d.kind as Kind];
            const target = d.kind === "obsidian" ? String(d.config.notePath) : d.kind === "markdown" ? String(d.config.fileName) : d.kind === "notion" ? `page ${String(d.config.pageId).slice(0, 8)}…` : String(d.config.url);
            return (
              <div key={d.id} className="card-flat row" style={{ padding: 14, flexWrap: "wrap" }}>
                <span className={`tile ${meta.tile}`}>{meta.icon}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: "var(--ink)", fontWeight: 600 }}>{d.name}</div>
                  <div className="small muted mono" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 360 }}>{target}</div>
                </div>
                <span className="spacer" />
                <span className={`chip ${d.pendingCount ? "chip--lamp" : "chip--mint"}`}>{d.pendingCount ? `${d.pendingCount} new` : <><Check size={11} /> up to date</>}</span>
                <span className="small muted">{d.deliveredCount} sent{d.lastDeliveredAt ? ` · ${timeAgo(d.lastDeliveredAt)}` : ""}</span>
                {d.kind === "obsidian" && <ObsidianKey id={d.id} />}
                <button className="key key--sm" disabled={busy === d.id} onClick={() => sync(d)}>
                  {busy === d.id ? <RefreshCw size={14} className="spin" /> : d.kind === "markdown" ? <Download size={14} /> : <Send size={14} />}
                  {d.kind === "markdown" ? "Download new" : "Send new"}
                </button>
                <button className="icon-btn" aria-label="Delete destination" onClick={async () => { if (window.confirm(`Remove ${d.name}? Collections pointing at it stop sending.`)) { await api.deleteDestination(d.id); load(); } }}><Trash2 size={15} /></button>
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid-2">
        <ExtensionPanel />
        <section className="panel">
          <div className="row" style={{ marginBottom: 12 }}><span className="tile tile--lamp"><Cpu /></span><h2>Models and agents</h2><span className="spacer" /><button className="key key--iris key--sm" onClick={openAgent}>Connect agent</button></div>
          <div className="stack small">
            <Model name="Lumen (Workers AI)" chip="default" text="Hosted on Cloudflare. 100 answers a day on Reader, more on Pro." />
            <Model name="Ollama" chip="local" text="Runs on your machine. Set it in the extension; start Ollama with OLLAMA_ORIGINS='chrome-extension://*'." />
            <Model name="OpenAI compatible" chip="your key" text="OpenAI, Groq, Mistral, LM Studio: any /v1/chat/completions endpoint." />
            <Model name="Claude (local CLI)" chip="claude -p" text="The Lumen helper runs claude -p with the model you pick, through Chrome native messaging." />
            <Model name="Your agent (MCP)" chip="/mcp" text="Claude Code, Claude Desktop, Cursor or any MCP client can search, read, save and analyse your library." />
          </div>
        </section>
      </div>

      <AddDestination kind={adding} onClose={() => setAdding(null)} onAdded={() => { setAdding(null); load(); toast("Destination added"); }} />
    </div>
  );
}

function Model({ name, chip, text }: { name: string; chip: string; text: string }) {
  return <div className="card-flat" style={{ padding: 12 }}><div className="row"><b style={{ color: "var(--ink)" }}>{name}</b><span className="chip">{chip}</span></div><p className="muted" style={{ marginTop: 4 }}>{text}</p></div>;
}

function ObsidianKey({ id }: { id: string }) {
  const [v, setV] = useState(getKey(id));
  const [open, setOpen] = useState(false);
  return open ? (
    <form className="row" onSubmit={(e) => { e.preventDefault(); try { localStorage.setItem(keyFor(id), v.trim()); } catch { /* */ } setOpen(false); }}>
      <input className="input" style={{ height: 34, width: 200 }} type="password" placeholder="Local REST API key" value={v} onChange={(e) => setV(e.target.value)} autoFocus />
      <button className="key key--sm key--ghost">Save</button>
    </form>
  ) : (
    <button className="key key--ghost key--sm" onClick={() => setOpen(true)}><KeyRound size={14} /> {v ? "Key saved" : "Add key"}</button>
  );
}

function ExtensionPanel() {
  const toast = useToast();
  const [token, setToken] = useState<string | null>(null);
  const [ext, setExt] = useState<{ ok: boolean; version: string; connected: boolean; apiBase: string } | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const ping = () => extension.ping().then(setExt);
  const connect = async () => {
    setBusy(true);
    try {
      const r = await api.createToken("Lumen extension");
      const ok = await extension.connect(r.token);
      if (ok?.ok) { toast("Extension connected"); await ping(); }
      else { setToken(r.token); toast("Could not reach the extension; paste the token instead", "err"); }
    } catch (e) { toast((e as Error).message, "err"); } finally { setBusy(false); }
  };
  useEffect(() => {
    ping().then(() => {
      if (new URLSearchParams(location.search).get("connect") === "extension") {
        history.replaceState(null, "", location.pathname);
        connect();
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const here = ext?.connected && ext.apiBase === location.origin;
  return (
    <section className="panel">
      <div className="row" style={{ marginBottom: 12, flexWrap: "wrap" }}>
        <span className="tile tile--ink"><Puzzle /></span><h2>Browser extension</h2><span className="spacer" />
        {ext === undefined ? null : ext ? <span className={`chip ${here ? "chip--mint" : "chip--lamp"}`}>{here ? <><Check size={11} /> Connected · v{ext.version}</> : `Installed · v${ext.version}`}</span> : <span className="chip">Not detected</span>}
      </div>
      {ext ? (
        here ? <p className="small muted">This browser's extension syncs with your account. Select text on any page to start.</p>
             : <button className="key key--lamp key--sm" disabled={busy} onClick={connect}><Puzzle size={14} /> {busy ? "Connecting…" : "Connect this browser's extension"}</button>
      ) : (
        <ol className="small" style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6 }}>
          <li>Build it: <code className="mono">npm run build -w @lumen/extension</code>, open <code className="mono">chrome://extensions</code> (or brave://extensions), turn on Developer mode, Load unpacked: <code className="mono">apps/extension/.output/chrome-mv3</code>.</li>
          <li>Reload this page: a Connect button appears and links it in one click.</li>
          <li>Select text on any page: highlight, note, ask, copy. Pick the collection from the popup.</li>
        </ol>
      )}
      {token ? (
        <div className="card-flat" style={{ padding: 12, marginTop: 14 }}>
          <div className="eyebrow">Your token (shown once)</div>
          <div className="row" style={{ marginTop: 6 }}>
            <code className="mono" style={{ fontSize: 12.5, overflow: "hidden", textOverflow: "ellipsis", color: "var(--ink)" }}>{token}</code>
            <span className="spacer" />
            <button className="key key--sm" onClick={async () => { await navigator.clipboard.writeText(token); toast("Token copied"); }}><Copy size={14} /> Copy</button>
          </div>
        </div>
      ) : (
        <button className="key key--quiet key--sm" style={{ marginTop: 10, marginLeft: -8 }} onClick={async () => { try { const r = await api.createToken("Lumen extension"); setToken(r.token); } catch (e) { toast((e as Error).message, "err"); } }}><KeyRound size={14} /> Or create a token to paste</button>
      )}
    </section>
  );
}

function AddDestination({ kind, onClose, onAdded }: { kind: Kind | null; onClose: () => void; onAdded: () => void }) {
  const toast = useToast();
  const [f, setF] = useState<Record<string, string>>({});
  useEffect(() => { setF({}); }, [kind]);
  if (!kind) return null;
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const config: Record<string, unknown> =
        kind === "obsidian" ? { baseUrl: f.baseUrl || "https://127.0.0.1:27124", notePath: f.notePath, format: f.format || "house" }
        : kind === "notion" ? { pageId: f.pageId }
        : kind === "markdown" ? { fileName: f.fileName || "lumen-highlights.md", format: f.format || "plain" }
        : { url: f.url };
      const r = await api.createDestination({ kind, name: f.name || KINDS[kind].label, config, secret: f.secret || undefined });
      if (kind === "obsidian" && f.apiKey) { try { localStorage.setItem(keyFor(r.destination.id), f.apiKey); } catch { /* */ } }
      onAdded();
    } catch (e2) { toast((e2 as Error).message, "err"); }
  };
  return (
    <Modal open onClose={onClose} title={`Add ${KINDS[kind].label}`}>
      <form className="stack" onSubmit={submit}>
        <p className="small muted">{KINDS[kind].blurb}</p>
        <label className="field"><span>Name</span><input className="input" placeholder={KINDS[kind].label} value={f.name ?? ""} onChange={set("name")} /></label>
        {kind === "obsidian" && (<>
          <label className="field"><span>Note path in your vault</span><input className="input" required placeholder="Research/joyful-reading.md" value={f.notePath ?? ""} onChange={set("notePath")} /></label>
          <label className="field"><span>Local REST API address</span><input className="input" placeholder="https://127.0.0.1:27124" value={f.baseUrl ?? ""} onChange={set("baseUrl")} /></label>
          <label className="field"><span>API key (stays in this browser)</span><input className="input" type="password" value={f.apiKey ?? ""} onChange={set("apiKey")} /></label>
        </>)}
        {kind === "notion" && (<>
          <label className="field"><span>Page link or id</span><input className="input" required placeholder="https://www.notion.so/…" value={f.pageId ?? ""} onChange={set("pageId")} /></label>
          <label className="field"><span>Integration token</span><input className="input" type="password" placeholder="secret_…" value={f.secret ?? ""} onChange={set("secret")} /></label>
          <p className="small muted">Share the page with your integration in Notion first.</p>
        </>)}
        {kind === "markdown" && <label className="field"><span>File name</span><input className="input" placeholder="lumen-highlights.md" value={f.fileName ?? ""} onChange={set("fileName")} /></label>}
        {kind === "webhook" && (<>
          <label className="field"><span>URL (https)</span><input className="input" required type="url" placeholder="https://example.com/hooks/lumen" value={f.url ?? ""} onChange={set("url")} /></label>
          <label className="field"><span>Signing secret (optional)</span><input className="input" type="password" value={f.secret ?? ""} onChange={set("secret")} /></label>
        </>)}
        {(kind === "obsidian" || kind === "markdown") && (
          <label className="field"><span>Format</span>
            <select className="select" value={f.format ?? (kind === "obsidian" ? "house" : "plain")} onChange={set("format")}>
              <option value="house">==highlight==^[note] (Sidebar Highlights)</option>
              <option value="callout">Obsidian quote callout</option>
              <option value="plain">Plain blockquote</option>
            </select>
          </label>
        )}
        <div className="row" style={{ justifyContent: "flex-end" }}><button type="button" className="key key--quiet" onClick={onClose}>Cancel</button><button className="key key--lamp">Add destination</button></div>
      </form>
    </Modal>
  );
}
