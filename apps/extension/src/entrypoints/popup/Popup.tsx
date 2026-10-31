import { useEffect, useState } from "react";
import type { Collection, Highlight } from "@lumen/core";
import { send } from "../../lib/msg";
import type { PageState, Settings } from "../../lib/types";

export default function Popup() {
  const [s, setS] = useState<Settings | null>(null);
  const [tab, setTab] = useState<chrome.tabs.Tab | null>(null);
  const [page, setPage] = useState<PageState | null>(null);
  const [cols, setCols] = useState<Collection[]>([]);
  const [status, setStatus] = useState("");

  useEffect(() => {
    (async () => {
      const r = await send<{ settings: Settings }>({ type: "GET_SETTINGS" });
      setS(r.settings);
      const [t] = await chrome.tabs.query({ active: true, currentWindow: true });
      setTab(t ?? null);
      if (t?.url?.startsWith("http")) setPage(await send<PageState>({ type: "PAGE_STATE", url: t.url }));
      if (r.settings.token) send<{ collections: Collection[] }>({ type: "GET_COLLECTIONS" }).then((c) => setCols(c.collections ?? [])).catch(() => {});
    })();
  }, []);

  if (!s) return null;
  const connected = Boolean(s.token);
  const target = cols.find((c) => c.id === s.targetCollectionId);

  const save = async () => {
    if (!tab?.id) return;
    setStatus("Saving…");
    await chrome.tabs.sendMessage(tab.id, { type: "CMD", cmd: "save" }).catch(() => setStatus("Reload the page first, then try again."));
    setTimeout(async () => { if (tab.url) setPage(await send<PageState>({ type: "PAGE_STATE", url: tab.url })); setStatus("Saved"); }, 900);
  };
  const sync = async () => {
    setStatus("Sending…");
    const r = await send<{ ok: boolean; sent?: number; to?: string; error?: string }>({ type: "SYNC_TARGET" });
    setStatus(r.ok ? (r.sent ? `Sent ${r.sent} new to ${r.to}` : "Nothing new to send") : r.error ?? "Could not send");
  };

  return (
    <div className="stack" style={{ padding: 14 }}>
      <div className="row">
        <img src="/icons/icon48.png" width={28} height={28} alt="" style={{ borderRadius: 8 }} />
        <h2 style={{ fontSize: 17 }}>lumen</h2>
        <span className="sp" />
        <span className={`chip ${connected ? "mint" : "lamp"}`}>{connected ? "Synced" : "Local only"}</span>
      </div>

      <div className="surface stack">
        <div className="eyebrow">This page</div>
        <div style={{ color: "var(--ink)", fontWeight: 600, lineHeight: 1.3 }}>{tab?.title ?? "No page"}</div>
        <div className="row small muted">
          <span>{page?.highlights.length ?? 0} highlights</span>
          <span>·</span>
          <span>{page?.item ? (page.item.status === "done" ? "Finished" : "In your library") : "Not saved yet"}</span>
        </div>
        <div className="row">
          <button className="key lamp" onClick={save} disabled={!connected || !tab?.url?.startsWith("http")}>{page?.item ? "Saved ✓" : "Save page"}</button>
          {connected && <button className="key ghost" onClick={() => send({ type: "OPEN_DASHBOARD", path: page?.item ? `/app/read/${page.item.id}` : "/app" })}>Open in Lumen</button>}
        </div>
      </div>

      {connected ? (
        <div className="surface stack">
          <div className="eyebrow">Sending highlights to</div>
          <select value={s.targetCollectionId} onChange={async (e) => { await send({ type: "SET_TARGET", collectionId: e.target.value }); setS({ ...s, targetCollectionId: e.target.value }); setStatus(""); }}>
            <option value="">No collection (library only)</option>
            {cols.map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
          </select>
          <div className="row small muted">
            <span>{target ? (target.destinationId ? "New highlights flow to its destination, once each." : "This collection has no destination yet.") : "Pick the piece you are working on."}</span>
          </div>
          {target?.destinationId && <button className="key ghost" onClick={sync}>Send new highlights now</button>}
        </div>
      ) : (
        <div className="surface stack">
          <div style={{ color: "var(--ink)", fontWeight: 600 }}>Highlights stay in this browser.</div>
          <div className="small muted">Connect a Lumen account to sync, pick a target note, and send to Obsidian or Notion.</div>
          <button className="key" onClick={() => chrome.runtime.openOptionsPage()}>Connect Lumen</button>
        </div>
      )}

      {page && page.highlights.length > 0 && (
        <div className="stack">
          <div className="eyebrow">Recent on this page</div>
          {page.highlights.slice(-3).reverse().map((h: Highlight) => (
            <div key={h.id} className="raised small" style={{ fontFamily: "Newsreader, Georgia, serif", fontSize: 14, color: "var(--ink)" }}>{h.quote.slice(0, 140)}{h.quote.length > 140 ? "…" : ""}</div>
          ))}
        </div>
      )}

      <div className="row small muted">
        <span>{status || "Select text on any page to start."}</span>
        <span className="sp" />
        <a href="#" onClick={(e) => { e.preventDefault(); chrome.runtime.openOptionsPage(); }} style={{ color: "var(--ink-2)" }}>Settings</a>
      </div>
    </div>
  );
}
