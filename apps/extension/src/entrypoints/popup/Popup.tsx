import { useEffect, useState } from "react";
import type { Collection } from "@lumen/core";
import { send } from "../../lib/msg";
import type { PageState, Settings } from "../../lib/types";
import { Picker } from "./Picker";

/** One job: save this page to the right place. Everything else lives in the side panel. */
export default function Popup() {
  const [s, setS] = useState<Settings | null>(null);
  const [tab, setTab] = useState<chrome.tabs.Tab | null>(null);
  const [page, setPage] = useState<PageState | null>(null);
  const [cols, setCols] = useState<Collection[]>([]);
  const [tags, setTags] = useState("");
  const [streak, setStreak] = useState<number | null>(null);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      const r = await send<{ settings: Settings }>({ type: "GET_SETTINGS" });
      setS(r.settings);
      const [t] = await chrome.tabs.query({ active: true, currentWindow: true });
      setTab(t ?? null);
      if (t?.url?.startsWith("http")) {
        const p = await send<PageState>({ type: "PAGE_STATE", url: t.url });
        setPage(p);
        if (p.item) { setState("saved"); setTags(p.item.tags.join(", ")); }
      }
      if (r.settings.token) {
        send<{ collections: Collection[] }>({ type: "GET_COLLECTIONS" }).then((c) => setCols(c.collections ?? [])).catch(() => {});
        send<{ stats: { streak: number } | null }>({ type: "GET_HOME" }).then((h) => setStreak(h?.stats?.streak ?? null)).catch(() => {});
      }
    })();
  }, []);

  if (!s) return null;
  const connected = Boolean(s.token);
  const onPage = Boolean(tab?.url?.startsWith("http"));
  const host = onPage ? new URL(tab!.url!).hostname.replace(/^www\./, "") : "";
  const helperOn = s.helper.mode === "everywhere" ? !s.helper.hiddenOn.includes(host) : s.helper.mode === "chosen" && s.helper.sites.includes(host);
  const collectionId = page?.item ? page.item.collectionId ?? "" : s.targetCollectionId;

  const save = async () => {
    if (!tab?.id || !tab.url) return;
    setState("saving");
    const html = await chrome.tabs.sendMessage(tab.id, { type: "GET_HTML" }).catch(() => "") as string;
    const r = await send<{ ok: boolean; error?: string; existed?: boolean }>({
      type: "SAVE_PAGE_TO", url: tab.url, title: tab.title ?? "", html: html || "", collectionId: collectionId || undefined,
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
    });
    if (!r.ok) { setState("error"); setMsg(r.error ?? "Could not save"); return; }
    setState("saved");
    setMsg(r.existed ? "Updated" : "Saved · +1 glow");
    setPage(await send<PageState>({ type: "PAGE_STATE", url: tab.url }));
  };

  return (
    <div className="stack" style={{ padding: 12, gap: 10, width: 340 }}>
      <div className="row">
        <img src="/icons/icon48.png" width={26} height={26} alt="" style={{ borderRadius: 8, filter: "drop-shadow(0 4px 8px rgba(255,106,26,.35))" }} />
        <b style={{ color: "var(--ink)", fontSize: 17, letterSpacing: "-0.04em" }}>lumen</b>
        <span className="sp" />
        {streak !== null && <span className="chip lamp">🔥 {streak}</span>}
        <button className="icon-btn" title="Settings" onClick={() => chrome.runtime.openOptionsPage()}>⚙</button>
      </div>

      {!connected ? (
        <div className="mesh" style={{ padding: 14 }}>
          <div className="raised stack" style={{ gap: 8 }}>
            <b style={{ color: "var(--ink)" }}>Save anything you read.</b>
            <span className="small muted">Connect your Lumen account to keep pages, highlights and notes in one bank.</span>
            <button className="key lamp" onClick={() => chrome.runtime.openOptionsPage()}>Connect Lumen</button>
          </div>
        </div>
      ) : !onPage ? (
        <div className="surface small muted">Open an article, then save it here.</div>
      ) : (
        <div className="surface stack" style={{ gap: 10, padding: 12 }}>
          <div className="row" style={{ alignItems: "flex-start" }}>
            <span className="tile sm" style={{ background: "linear-gradient(180deg,#5b9bff,#2563eb)", marginTop: 2 }}>{host[0]?.toUpperCase()}</span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ color: "var(--ink)", fontWeight: 600, lineHeight: 1.3, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{tab?.title}</div>
              <div className="small muted">{host}{page?.highlights.length ? ` · ${page.highlights.length} highlights` : ""}</div>
            </div>
          </div>
          <Picker cols={cols} value={collectionId}
            onChange={async (id) => { await send({ type: "SET_TARGET", collectionId: id }); setS({ ...s, targetCollectionId: id }); if (page?.item) setPage({ ...page, item: { ...page.item, collectionId: id || null } }); if (state === "saved") setState("idle"); }}
            onCreated={(c) => { setCols((l) => [c, ...l]); setS({ ...s, targetCollectionId: c.id }); if (state === "saved") setState("idle"); }} />
          <input placeholder="Tags, comma separated" value={tags} onChange={(e) => { setTags(e.target.value); if (state === "saved") setState("idle"); }} onKeyDown={(e) => e.key === "Enter" && save()} />
          <button className="key lamp" style={{ height: 42 }} disabled={state === "saving"} onClick={save}>
            {state === "saving" ? "Saving…" : state === "saved" ? (page?.item ? "Saved ✓  ·  update" : "Saved ✓") : page?.item ? "Update" : "Save to Lumen"}
          </button>
          {msg && <div className="small muted" style={{ textAlign: "center" }}>{msg}</div>}
        </div>
      )}

      {connected && (
        <div className="row" style={{ gap: 8 }}>
          <button className="key ghost" style={{ flex: 1 }} onClick={async () => { const w = await chrome.windows.getCurrent(); await chrome.sidePanel.open({ windowId: w.id! }); window.close(); }}>Ask &amp; explore ▸</button>
          {onPage && (
            <label className="row" style={{ display: "flex", gap: 8, fontWeight: 400, fontSize: 13 }} title={`Show ${s.helper.name} on ${host}`}>
              {s.helper.name}
              <button className="switch" role="switch" aria-checked={helperOn} onClick={async () => {
                await send({ type: "SET_HELPER_SITE", host: new URL(tab!.url!).hostname, on: !helperOn });
                setS((await send<{ settings: Settings }>({ type: "GET_SETTINGS" })).settings);
              }}><span /></button>
            </label>
          )}
        </div>
      )}

      <div className="row small muted" style={{ fontSize: 11.5 }}>
        <span>Select text on a page for the toolbar · Alt+Shift+L opens the panel</span>
        <span className="sp" />
        <span className="mono">v{chrome.runtime.getManifest().version}</span>
      </div>
    </div>
  );
}
