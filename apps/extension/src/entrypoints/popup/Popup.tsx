import { useEffect, useState } from "react";
import type { Collection, Highlight } from "@lumen/core";
import { send } from "../../lib/msg";
import type { PageState, Settings } from "../../lib/types";
import { Picker } from "./Picker";
import { Ask } from "./Ask";

type Home = { ok: boolean; stats: { streak: number; glowToday: number; dailyGoal: number; level: { name: string } } | null; picks: { id: string; title: string; readingMinutes: number; status: string; progress: number }[] };
const SWATCH: Record<string, string> = { sun: "#ffe58a", mint: "#bdefd5", iris: "#dcd6ff", peach: "#ffd5c6", sky: "#cfe2ff" };

export default function Popup() {
  const [s, setS] = useState<Settings | null>(null);
  const [tab, setTab] = useState<chrome.tabs.Tab | null>(null);
  const [page, setPage] = useState<PageState | null>(null);
  const [cols, setCols] = useState<Collection[]>([]);
  const [home, setHome] = useState<Home | null>(null);
  const [status, setStatus] = useState("");

  useEffect(() => {
    (async () => {
      const r = await send<{ settings: Settings }>({ type: "GET_SETTINGS" });
      setS(r.settings);
      const [t] = await chrome.tabs.query({ active: true, currentWindow: true });
      setTab(t ?? null);
      if (t?.url?.startsWith("http")) setPage(await send<PageState>({ type: "PAGE_STATE", url: t.url }));
      if (r.settings.token) {
        send<{ collections: Collection[] }>({ type: "GET_COLLECTIONS" }).then((c) => setCols(c.collections ?? [])).catch(() => {});
        send<Home>({ type: "GET_HOME" }).then(setHome).catch(() => {});
      }
    })();
  }, []);

  if (!s) return null;
  const connected = Boolean(s.token);
  const target = cols.find((c) => c.id === s.targetCollectionId);
  const st = home?.stats;
  const goal = st ? Math.min(1, st.glowToday / Math.max(1, st.dailyGoal)) : 0;
  const onPage = Boolean(tab?.url?.startsWith("http"));
  const host = onPage ? new URL(tab!.url!).hostname.replace(/^www\./, "") : "";

  const save = async () => {
    if (!tab?.id) return;
    setStatus("Saving…");
    await chrome.tabs.sendMessage(tab.id, { type: "CMD", cmd: "save" }).catch(() => setStatus("Reload the page first, then try again."));
    setTimeout(async () => { if (tab.url) setPage(await send<PageState>({ type: "PAGE_STATE", url: tab.url })); setStatus("Saved · +1 glow"); }, 900);
  };
  const sync = async () => {
    setStatus("Sending…");
    const r = await send<{ ok: boolean; sent?: number; to?: string; error?: string }>({ type: "SYNC_TARGET" });
    setStatus(r.ok ? (r.sent ? `Sent ${r.sent} new to ${r.to}` : "Nothing new to send") : r.error ?? "Could not send");
  };

  return (
    <div className="stack" style={{ padding: 12, gap: 10 }}>
      <div className="row">
        <img src="/icons/icon48.png" width={28} height={28} alt="" style={{ borderRadius: 8, filter: "drop-shadow(0 4px 8px rgba(255,106,26,.35))" }} />
        <h2 style={{ fontSize: 18, letterSpacing: "-0.04em" }}>lumen</h2>
        <span className="sp" />
        {connected ? (st ? <span className="chip lamp">🔥 {st.streak} day streak</span> : <span className="chip mint">Synced</span>) : <span className="chip lamp">Local only</span>}
      </div>

      {connected && st && (
        <div className="mesh pop" style={{ padding: 14, minHeight: 92 }}>
          <span className="float tile" style={{ right: 16, top: 12, ["--r" as string]: "8deg" }}>✦</span>
          <span className="float tile iris sm" style={{ right: 58, top: 50, animationDelay: "-2s", ["--r" as string]: "-6deg" }}>✎</span>
          <div className="raised" style={{ width: 190, padding: 10 }}>
            <div className="row" style={{ gap: 8 }}><span className="eyebrow">Today</span><span className="sp" /><b style={{ color: "var(--ink)" }}>{st.glowToday}<span className="muted small">/{st.dailyGoal}</span></b></div>
            <div className="meter" style={{ marginTop: 8 }}><span style={{ width: `${goal * 100}%` }} /></div>
            <div className="small muted" style={{ marginTop: 6 }}>{st.level.name} · {goal >= 1 ? "lamp glowing" : "keep reading"}</div>
          </div>
        </div>
      )}

      <div className="surface stack" style={{ gap: 8, padding: 12 }}>
        <div className="row" style={{ gap: 8 }}>
          <span className="tile sm" style={{ background: "linear-gradient(180deg,#5b9bff,#2563eb)" }}>{(host[0] ?? "·").toUpperCase()}</span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ color: "var(--ink)", fontWeight: 600, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tab?.title ?? "No page"}</div>
            <div className="small muted">{host || "Open an article to save and highlight it"}</div>
          </div>
        </div>
        <div className="row small muted" style={{ gap: 6 }}>
          <span className="chip">{page?.highlights.length ?? 0} highlights</span>
          <span className={`chip ${page?.item ? "mint" : ""}`}>{page?.item ? (page.item.status === "done" ? "Finished" : "In your library") : "Not saved"}</span>
        </div>
        <div className="row">
          <button className="key lamp" onClick={save} disabled={!connected || !onPage || Boolean(page?.item)}>{page?.item ? "Saved ✓" : "Save page"}</button>
          {connected && <button className="key ghost" onClick={() => send({ type: "OPEN_DASHBOARD", path: page?.item ? `/app/read/${page.item.id}` : "/app" })}>Open in Lumen</button>}
        </div>
        {page && page.highlights.length > 0 && (
          <div className="stack" style={{ gap: 6 }}>
            {page.highlights.slice(-2).reverse().map((h: Highlight) => (
              <div key={h.id} className="raised small" style={{ padding: 8, fontFamily: "Newsreader, Georgia, serif", fontSize: 13.5, color: "var(--ink)" }}>
                <span style={{ background: SWATCH[h.color], borderRadius: 3, padding: "0 2px" }}>{h.quote.slice(0, 110)}{h.quote.length > 110 ? "…" : ""}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {connected ? (
        <div className="surface stack" style={{ gap: 8, padding: 12 }}>
          <div className="eyebrow">Sending highlights to</div>
          <Picker cols={cols} value={s.targetCollectionId}
            onChange={async (id) => { await send({ type: "SET_TARGET", collectionId: id }); setS({ ...s, targetCollectionId: id }); setStatus(""); }}
            onCreated={(c) => { setCols((l) => [c, ...l]); setS({ ...s, targetCollectionId: c.id }); setStatus(`Created ${c.name}`); }} />
          <div className="small muted">{target ? (target.destinationId ? "New highlights flow to its note, once each." : "This collection has no destination yet.") : "Pick the piece you are working on."}</div>
          {target?.destinationId && <button className="key ghost" onClick={sync}>Send new highlights now</button>}
        </div>
      ) : (
        <div className="surface stack" style={{ padding: 12 }}>
          <div style={{ color: "var(--ink)", fontWeight: 600 }}>Highlights stay in this browser.</div>
          <div className="small muted">Connect Lumen to sync, pick a target note, and send to Obsidian or Notion.</div>
          <button className="key lamp" onClick={() => chrome.runtime.openOptionsPage()}>Connect Lumen</button>
        </div>
      )}

      {onPage && <Ask tabId={tab?.id} />}

      {connected && home && home.picks.length > 0 && (
        <div className="stack" style={{ gap: 6 }}>
          <div className="eyebrow">Up next</div>
          {home.picks.map((p) => (
            <button key={p.id} className="pick" onClick={() => send({ type: "OPEN_DASHBOARD", path: `/app/read/${p.id}` })}>
              <span className="tile sm mint">{p.status === "reading" ? "▶" : "☾"}</span>
              <span style={{ minWidth: 0, flex: 1 }}>
                <span style={{ display: "block", color: "var(--ink)", fontWeight: 500, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}</span>
                <span className="small muted">{p.status === "reading" ? `${Math.round(p.progress * 100)}% read` : `${p.readingMinutes} min`}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="row small muted">
        <span>{status || "Select text on any page to start."}</span>
        <span className="sp" />
        <span className="mono" style={{ fontSize: 11 }}>v{chrome.runtime.getManifest().version}</span>
        <a href="#" onClick={(e) => { e.preventDefault(); chrome.runtime.openOptionsPage(); }} style={{ color: "var(--ink-2)" }}>Settings</a>
      </div>
    </div>
  );
}
