import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { ASK_STYLE_START, REDO_TASK, SLASH_HINT, activeStyleKey, askStyle, citedSources, colorSwatch, orderedStyles, parseSlash, patchReply, slashStyle, type AskPrefs, type SlashCommand, type Style, type StyleListing } from "@lumen/core";
import type { Collection, Highlight } from "@lumen/core";
import { send } from "../../lib/msg";
import type { PageState, Settings } from "../../lib/types";
import { Picker } from "../popup/Picker";
import { asPage, readPage, type PageContext } from "../../lib/page";
import { Md } from "../../lib/md";
import { dismissOffer, dismissedOffers } from "../../lib/styles";
import { StylePills } from "./StylePills";

type Tab = "ask" | "page" | "you";
interface Source { n: number; kind: string; id: string; itemId: string; title: string; url: string; quote?: string; note?: string | null }
interface Msg { id?: string; role: "user" | "assistant"; content: string; display?: string; sources?: Source[]; error?: string; upgrade?: boolean; streaming?: boolean; kind?: "tldr" | "pro" }
type Entry = "ask" | "pill" | "slash" | "typed";
interface AskHow { entry?: Entry; style?: Style | null; history?: { role: Msg["role"]; content: string }[]; display?: string }

/** The chat's first question and its answer: what every pill explains again (ADR-005). */
function firstPair(msgs: Msg[]): { role: Msg["role"]; content: string }[] | null {
  const at = msgs.findIndex((msg) => msg.role === "user" && msg.kind !== "pro");
  const answer = msgs[at + 1];
  const question = msgs[at];
  if (at === -1 || !question || answer?.role !== "assistant" || answer.error || !answer.content) return null;
  return [{ role: "user", content: question.content }, { role: "assistant", content: answer.content }];
}

/** Answer text as it should sound: no markdown marks, no [n] citations. */
const speakable = (text: string) => text.replace(/\[\d+\]/g, "").replace(/[*_`#>]/g, "");

async function activeTab() {
  const [t] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return t && asPage(t);
}

const params = new URLSearchParams(location.search);
const FLOAT = params.get("mode") === "float";
const START_PROMPT = params.get("prompt") ?? "";

async function closeFloat() {
  const t = await activeTab();
  if (t?.id !== undefined) chrome.tabs.sendMessage(t.id, { type: "PANEL_CLOSE" }).catch(() => {});
}

/** Hides the floating panel but keeps it alive behind the Lumi lamp, so the chat survives. */
async function minimizeFloat() {
  const t = await activeTab();
  if (t?.id !== undefined) chrome.tabs.sendMessage(t.id, { type: "PANEL_MINIMIZE" }).catch(() => {});
}

export default function Panel() {
  const [tab, setTab] = useState<Tab>("ask");
  const [s, setS] = useState<Settings | null>(null);
  const [cur, setCur] = useState<chrome.tabs.Tab | null>(null);
  const [page, setPage] = useState<PageState | null>(null);
  const [cols, setCols] = useState<Collection[]>([]);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [usePage, setUsePage] = useState(true);
  const [ctxInfo, setCtxInfo] = useState<PageContext | null | "none">(null);
  const [listing, setListing] = useState<StyleListing | null>(null); // null until known: no pills, no default
  const [styleState, dispatchStyle] = useReducer(askStyle, ASK_STYLE_START);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [speaking, setSpeaking] = useState<number | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const styles = listing ? orderedStyles(listing.styles.filter((style) => !style.locked), listing.prefs) : [];
  const defaultStyle = listing?.pro ? listing.prefs.defaultStyle : null;
  const activeKey = activeStyleKey(styleState, defaultStyle);
  const activeStyle = styles.find((style) => style.key === activeKey) ?? null;
  const streaming = msgs.some((msg) => msg.streaming);

  const refreshTab = useCallback(async () => {
    const t = await activeTab();
    setCur(t ?? null);
    readPage(t).then((c) => setCtxInfo(c ?? "none")).catch(() => setCtxInfo("none"));
    if (t?.url?.startsWith("http")) setPage(await send<PageState>({ type: "PAGE_STATE", url: t.url }).catch(() => null));
    else setPage(null);
  }, []);

  useEffect(() => {
    send<{ settings: Settings }>({ type: "GET_SETTINGS" }).then((r) => {
      setS(r.settings);
      if (r.settings.token) send<{ collections: Collection[] }>({ type: "GET_COLLECTIONS" }).then((c) => setCols(c.collections ?? [])).catch(() => {});
    });
    refreshTab();
    const onAct = () => refreshTab();
    const onUpd = (_id: number, info: chrome.tabs.TabChangeInfo) => { if (info.status === "complete") refreshTab(); };
    chrome.tabs.onActivated.addListener(onAct);
    chrome.tabs.onUpdated.addListener(onUpd);
    const onMsg = (m: { type?: string; prompt?: string }) => { if (m?.type === "PANEL_PROMPT" && m.prompt) { setTab("ask"); askRef.current(m.prompt, { entry: "ask" }); } };
    chrome.runtime.onMessage.addListener(onMsg);
    dismissedOffers().then(setDismissed).catch((error) => console.warn("offer dismissals unreadable", error));
    // The cached styles first, so a highlight's Ask already carries the reader's default style.
    send<{ listing: StyleListing | null }>({ type: "GET_STYLES", fresh: false })
      .then((cached) => { setListing(cached.listing); return send<{ listing: StyleListing | null }>({ type: "GET_STYLES", fresh: true }); })
      .then((fresh) => setListing(fresh.listing))
      .catch((error) => console.warn("styles unavailable", error))
      .finally(() => { if (START_PROMPT) setTimeout(() => askRef.current(START_PROMPT, { entry: "ask" }), 300); });
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape" && FLOAT) closeFloat(); };
    window.addEventListener("keydown", esc);
    return () => { chrome.tabs.onActivated.removeListener(onAct); chrome.tabs.onUpdated.removeListener(onUpd); chrome.runtime.onMessage.removeListener(onMsg); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  /** Streams one reply from a port into a new assistant message. */
  const streamInto = (question: string, port: chrome.runtime.Port, kind?: Msg["kind"]) => {
    const replyId = crypto.randomUUID();
    setMsgs((l) => [...l, { role: "user", content: question }, { id: replyId, role: "assistant", content: "", streaming: true, kind }]);
    setInput("");
    const patch = (fn: (m: Msg) => Msg) => setMsgs((l) => patchReply(l, replyId, fn));
    port.onMessage.addListener((m: { chunk?: string; done?: boolean; error?: string }) => {
      if (m.chunk) patch((x) => ({ ...x, content: x.content + m.chunk }));
      if (m.done) { patch((x) => ({ ...x, streaming: false })); port.disconnect(); }
      if (m.error) { patch((x) => ({ ...x, streaming: false, error: m.error })); port.disconnect(); }
    });
  };

  const slash = async (question: string, command: SlashCommand, rest: string): Promise<boolean> => {
    const t = await activeTab();
    if (command === "related") return false;
    if (command === "tldr") {
      const page = t?.id !== undefined ? await chrome.tabs.sendMessage(t.id, { type: "GET_PARAGRAPHS" }).catch(() => null) as { title: string; paragraphs: string[] } | null : null;
      if (!page?.paragraphs.length) { setMsgs((l) => [...l, { role: "user", content: question }, { role: "assistant", content: "", error: "Can't read this page (browser pages and built in PDFs)." }]); setInput(""); return true; }
      const port = chrome.runtime.connect({ name: "lumen-tldr" });
      streamInto(question, port, "tldr");
      port.postMessage({ title: page.title, paragraphs: page.paragraphs });
      return true;
    }
    const text = rest || (await readPage(t))?.selection || "";
    if (!text) return false;
    const port = chrome.runtime.connect({ name: "lumen-ai" });
    streamInto(question, port);
    port.postMessage({ action: command === "define" ? "define" : "counterpoint", text, title: t?.title ?? "" });
    return true;
  };

  const ask = async (input: string, how: AskHow = {}): Promise<void> => {
    if (!input.trim()) return;
    const command = parseSlash(input);
    if (command && (await slash(input, command.command, command.rest))) return;
    const typedStyle = command ? null : slashStyle(input, styles);
    if (typedStyle) return pickStyle(typedStyle.style, "slash", typedStyle.rest);
    const style = how.style === undefined ? activeStyle : how.style;
    const question = command?.command === "related" ? `What in my library relates to this passage: “${(command.rest || input).slice(0, 400)}”` : input;
    const t = await activeTab();
    const ctx = usePage ? await readPage(t) : null;
    if (usePage) setCtxInfo(ctx ?? "none");
    const history = how.history ?? msgs.filter((m) => !m.error && m.kind !== "pro").map((m) => ({ role: m.role, content: m.content }));
    const replyId = crypto.randomUUID();
    // A highlight's Ask shows its first line, the quote, not the whole Explain instruction.
    const display = how.display ?? (how.entry === "ask" ? input.split("\n1. ")[0] : undefined);
    setMsgs((l) => [...l, { role: "user", content: input, display }, { id: replyId, role: "assistant", content: "", streaming: true }]);
    setInput("");
    const port = chrome.runtime.connect({ name: "lumen-chat" });
    const patch = (fn: (m: Msg) => Msg) => setMsgs((l) => patchReply(l, replyId, fn));
    port.onMessage.addListener((m: { chunk?: string; sources?: Source[]; done?: boolean; error?: string; upgrade?: boolean }) => {
      if (m.sources) patch((x) => ({ ...x, sources: m.sources }));
      if (m.chunk) patch((x) => ({ ...x, content: x.content + m.chunk }));
      if (m.done) { patch((x) => ({ ...x, streaming: false })); port.disconnect(); dispatchStyle({ type: "DONE", defaultStyle, dismissed }); }
      if (m.error) { patch((x) => ({ ...x, streaming: false, error: m.error, upgrade: m.upgrade })); port.disconnect(); }
    });
    port.postMessage({
      question, history, selection: ctx?.selection || undefined, page: ctx ? { title: ctx.title, url: t?.url ?? "", text: ctx.text } : undefined,
      style: style?.body, template: style?.key, entry: how.entry ?? "typed", library: style?.library || undefined,
    });
  };

  /** A pill or /slug: free readers learn the feature exists; Pro switches the chat's style and explains the passage again. */
  const pickStyle = (style: Style, entry: Entry, rest = ""): Promise<void> | undefined => {
    if (!listing) return;
    if (!listing.pro) {
      setMsgs((l) => [...l, { role: "assistant", content: "Ask styles are part of Lumen Pro: set how Lumen explains things to you, and switch styles under any answer.", kind: "pro" }]);
      return;
    }
    dispatchStyle({ type: "PICK", key: style.key });
    if (rest) return ask(rest, { entry, style });
    const first = firstPair(msgs);
    if (first) return ask(REDO_TASK, { entry, style, history: first, display: `✦ ${style.name}` });
  };

  const makeDefault = async (key: string) => {
    if (!listing) return;
    const prefs: AskPrefs = { ...listing.prefs, defaultStyle: key };
    try {
      const saved = await send<{ prefs: AskPrefs }>({ type: "SAVE_STYLE_PREFS", prefs });
      setListing((current) => current && { ...current, prefs: saved.prefs });
      dispatchStyle({ type: "MADE_DEFAULT" });
    } catch (error) {
      console.warn("default style not saved", error);
    }
  };

  const readAloud = (index: number, text: string) => {
    speechSynthesis.cancel();
    if (speaking === index) return setSpeaking(null);
    const utterance = new SpeechSynthesisUtterance(speakable(text));
    utterance.onend = () => setSpeaking(null);
    setSpeaking(index);
    speechSynthesis.speak(utterance);
  };

  // The message listener is added once on mount; through this it asks with the chat as it is now.
  const askRef = useRef(ask);
  askRef.current = ask;

  const openInLumen = (path: string) => send({ type: "OPEN_DASHBOARD", path });
  const host = cur?.url?.startsWith("http") ? new URL(cur.url).hostname.replace(/^www\./, "") : "";

  if (!s) return null;
  if (!s.token) {
    return (
      <div className="stack" style={{ padding: 16, gap: 14 }}>
        <Header />
        <div className="mesh" style={{ padding: 18, minHeight: 120 }}><div className="raised" style={{ maxWidth: 230 }}><b style={{ color: "var(--ink)" }}>Connect Lumen</b><div className="small muted" style={{ marginTop: 4 }}>Ask your whole library, save pages and see what is trending for you.</div></div></div>
        <button className="key lamp" onClick={() => chrome.runtime.openOptionsPage()}>Connect with Lumen</button>
      </div>
    );
  }

  return (
    <div className="panel-root" style={{ display: "grid", gridTemplateRows: "auto auto minmax(0, 1fr) auto", gridTemplateColumns: "minmax(0, 1fr)", height: "100vh" }}>
      <div style={{ padding: "12px 12px 8px", display: "grid", gap: 8 }}><Header /><UpdateNote /></div>
      <div style={{ padding: "0 12px 8px" }}>
        <div className="tabs" role="tablist">
          {([["ask", "Ask"], ["page", "This page"], ["you", "For you"]] as [Tab, string][]).map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l}</button>)}
        </div>
      </div>

      <div className="panel-scroll" style={{ padding: "4px 12px 12px" }}>
        {tab === "ask" && (
          <div className="stack" style={{ gap: 10 }}>
            {msgs.length === 0 && (
              <div className="stack" style={{ gap: 10 }}>
                <div className="mesh pop" style={{ padding: 16, minHeight: 110 }}>
                  <span className="float tile" style={{ right: 16, top: 14, ["--r" as string]: "8deg" }}>✦</span>
                  <div className="raised" style={{ maxWidth: 240 }}>
                    <b style={{ color: "var(--ink)" }}>Ask anything, stay on the page.</b>
                    <div className="small muted" style={{ marginTop: 4 }}>Answers use this page and everything you have saved, highlighted and noted in Lumen, with sources.</div>
                  </div>
                </div>
                <div className="eyebrow">Try</div>
                {["Summarise this page in 3 points", "What have I saved about this topic?", "Explain the part I selected", "How does this connect to my notes?"].map((p) => (
                  <button key={p} className="pick" onClick={() => ask(p)}><span className="tile sm iris">✦</span><span style={{ color: "var(--ink)", fontSize: 13.5 }}>{p}</span></button>
                ))}
              </div>
            )}
            {msgs.map((m, k) => m.role === "user" ? (
              <div key={k} className="bubble me"><Md text={m.display ?? m.content} /></div>
            ) : m.kind === "pro" ? (
              <div key={k} className="stack" style={{ gap: 6 }}>
                <div className="bubble ai">{m.content}</div>
                <button className="key lamp" style={{ height: 32 }} onClick={() => openInLumen("/app/upgrade?from=ask-templates")}>See Pro</button>
              </div>
            ) : (
              <div key={k} className="stack" style={{ gap: 6 }}>
                <div className="bubble ai" style={m.error ? { color: "var(--peach)" } : undefined}>
                  {m.error ? m.error : <Md text={m.content} onCite={(n) => { const src = m.sources?.find((x) => x.n === n); if (src) openInLumen(`/app/read/${src.itemId}${src.kind === "highlight" ? `#${src.id}` : ""}`); }}
                    onParagraph={m.kind === "tldr" ? async (n) => { const t = await activeTab(); if (t?.id !== undefined) chrome.tabs.sendMessage(t.id, { type: "SCROLL_TO_PARAGRAPH", n }).catch(() => {}); } : undefined} />}
                  {m.streaming && <span className="caret-i">▍</span>}
                </div>
                {m.upgrade && <button className="key lamp" style={{ height: 32 }} onClick={() => openInLumen("/app/upgrade")}>See Pro</button>}
                {!m.streaming && !m.error && m.content && (
                  <div className="row"><button type="button" className="key ghost" style={{ height: 26, fontSize: 12 }} aria-pressed={speaking === k} onClick={() => readAloud(k, m.content)}>{speaking === k ? "■ Stop" : "🔊 Read aloud"}</button></div>
                )}
                {!m.streaming && m.sources && citedSources(m.sources, m.content).length > 0 && (
                  <div className="stack" style={{ gap: 4 }}>
                    <div className="eyebrow">From your library</div>
                    {citedSources(m.sources, m.content).map((src) => (
                      <button key={src.n} className="src" onClick={() => openInLumen(`/app/read/${src.itemId}${src.kind === "highlight" ? `#${src.id}` : ""}`)}>
                        <span className="n">{src.n}</span>
                        <span style={{ minWidth: 0 }}><b style={{ color: "var(--ink)", fontWeight: 500 }}>{src.title}</b>{src.quote && <span style={{ display: "block", fontFamily: "Newsreader, Georgia, serif", fontSize: 13 }}>“{src.quote.slice(0, 120)}{src.quote.length > 120 ? "…" : ""}”</span>}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {styleState.offering && (
              <div className="row small" style={{ gap: 6, flexWrap: "wrap" }}>
                <span>Use <b style={{ color: "var(--ink)" }}>{styles.find((style) => style.key === styleState.offering)?.name}</b> for every chat?</span>
                <button type="button" className="key" style={{ height: 26 }} onClick={() => styleState.offering && makeDefault(styleState.offering)}>Make default</button>
                <button type="button" className="key ghost" style={{ height: 26 }} onClick={() => { const key = styleState.offering; dispatchStyle({ type: "NOT_NOW" }); if (key) dismissOffer(key).then(setDismissed).catch((error) => console.warn("offer dismissal not saved", error)); }}>Not now</button>
              </div>
            )}
            <div ref={endRef} />
          </div>
        )}

        {tab === "page" && (
          <div className="stack" style={{ gap: 10 }}>
            {!host ? <div className="surface small muted">Open an article to save it and see its highlights here.</div> : (
              <>
                <div className="surface stack" style={{ gap: 8, padding: 12 }}>
                  <div style={{ color: "var(--ink)", fontWeight: 600, lineHeight: 1.3 }}>{cur?.title}</div>
                  <div className="row small muted" style={{ gap: 6 }}><span>{host}</span><span className="sp" /><span className={`chip ${page?.item ? "mint" : ""}`}>{page?.item ? "Saved" : "Not saved"}</span></div>
                  <Picker cols={cols} value={page?.item?.collectionId ?? s.targetCollectionId}
                    onChange={async (id) => {
                      if (page?.item && cur?.id) { await send({ type: "SAVE_PAGE_TO", url: cur.url!, title: cur.title ?? "", html: "", collectionId: id || undefined }); refreshTab(); }
                      await send({ type: "SET_TARGET", collectionId: id }); setS({ ...s, targetCollectionId: id });
                    }}
                    onCreated={(c) => { setCols((l) => [c, ...l]); setS({ ...s, targetCollectionId: c.id }); }} />
                  {!page?.item && <button className="key lamp" onClick={async () => { if (cur?.id) { await chrome.tabs.sendMessage(cur.id, { type: "CMD", cmd: "save", collectionId: s.targetCollectionId || undefined }).catch(() => {}); setTimeout(refreshTab, 900); } }}>Save page</button>}
                  {page?.item && <button className="key ghost" onClick={() => openInLumen(`/app/read/${page.item!.id}`)}>Open in Lumen</button>}
                </div>
                {(page?.highlights ?? []).some((h) => h.answers?.length) && (
                  <>
                    <div className="eyebrow">Threads</div>
                    {(page?.highlights ?? []).filter((h) => h.answers?.length).map((h: Highlight) => (
                      <button key={h.id} className="pick" style={{ alignItems: "flex-start" }} onClick={() => cur?.id && chrome.tabs.sendMessage(cur.id, { type: "OPEN_THREAD", id: h.id }).catch(() => {})}>
                        <span style={{ width: 4, alignSelf: "stretch", borderRadius: 4, background: colorSwatch(h.color), flex: "none" }} />
                        <span style={{ minWidth: 0 }}>
                          <span style={{ display: "block", fontFamily: "Newsreader, Georgia, serif", fontSize: 14, color: "var(--ink)" }}>{h.quote.slice(0, 120)}{h.quote.length > 120 ? "…" : ""}</span>
                          <span className="small muted">{keptCount(h.answers?.length ?? 0)}</span>
                        </span>
                      </button>
                    ))}
                  </>
                )}
                <div className="eyebrow">Highlights here · {page?.highlights.length ?? 0}</div>
                {(page?.highlights ?? []).map((h: Highlight) => (
                  <button key={h.id} className="pick" style={{ alignItems: "flex-start" }} onClick={() => cur?.id && chrome.tabs.sendMessage(cur.id, { type: "SCROLL_TO", id: h.id }).catch(() => {})}>
                    <span style={{ width: 4, alignSelf: "stretch", borderRadius: 4, background: colorSwatch(h.color), flex: "none" }} />
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: "block", fontFamily: "Newsreader, Georgia, serif", fontSize: 14, color: "var(--ink)" }}>{h.quote.slice(0, 180)}{h.quote.length > 180 ? "…" : ""}</span>
                      {h.note && <span className="small muted">✎ {h.note.slice(0, 140)}</span>}
                    </span>
                  </button>
                ))}
                {page && page.highlights.length === 0 && <div className="small muted">Select text on the page to highlight it. It lands here and in your library.</div>}
                <SiteToggles host={host} s={s} onChange={setS} />
              </>
            )}
          </div>
        )}

        {tab === "you" && <ForYou openInLumen={openInLumen} />}
      </div>

      {tab === "ask" && (
        <form style={{ padding: 12, borderTop: "1px solid var(--hair)", display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 8 }} onSubmit={(e) => { e.preventDefault(); ask(input); }}>
          {msgs.length > 0 && listing && (
            <StylePills styles={styles} active={activeStyle} isDefault={styleState.active.source === "default" && activeKey !== null} disabled={streaming}
              onPick={(style) => pickStyle(style, "pill")} onClear={() => dispatchStyle({ type: "CLEAR" })} onNew={() => openInLumen("/app/settings")} />
          )}
          {usePage && ctxInfo && (
            <div className={`ctx ${ctxInfo === "none" ? "off" : ""}`}>
              <span className="dot" />
              {ctxInfo === "none"
                ? <span>Can't read this page (browser pages and built in PDFs). Answers use your library only.</span>
                : <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Reading: <b style={{ color: "var(--ink)", fontWeight: 500 }}>{ctxInfo.title}</b>{ctxInfo.selection ? " · your selection" : ""}</span>}
            </div>
          )}
          {input.startsWith("/") && <div className="small muted">{SLASH_HINT}{styles.length > 0 && <><br />Styles: {styles.map((style) => `/${style.slug}`).join(" · ")}</>}</div>}
          <textarea rows={2} placeholder="Ask about this page or anything you have saved…" value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(input); } }} />
          <div className="row small muted">
            <label className="row" style={{ display: "flex", gap: 6, fontWeight: 400 }}><input type="checkbox" checked={usePage} onChange={(e) => setUsePage(e.target.checked)} style={{ width: 14, height: 14 }} /> Include this page</label>
            <span className="sp" />
            {msgs.length > 0 && <button type="button" className="key ghost" style={{ height: 30 }} onClick={() => { setMsgs([]); dispatchStyle({ type: "NEW_CHAT" }); speechSynthesis.cancel(); setSpeaking(null); }}>New chat</button>}
            <button className="key" style={{ height: 30 }}>Ask</button>
          </div>
        </form>
      )}
    </div>
  );
}

const keptCount = (count: number) => (count === 1 ? "1 kept answer" : `${count} kept answers`);

function UpdateNote() {
  const [latest, setLatest] = useState<string | null>(null);
  useEffect(() => {
    send<{ settings: Settings }>({ type: "GET_SETTINGS" }).then((r) => fetch(`${r.settings.apiBase}/api/health`)).then((r) => r.json()).then((j: { extension?: string }) => setLatest(j.extension ?? null)).catch(() => {});
  }, []);
  const mine = chrome.runtime.getManifest().version;
  const older = latest && latest.split(".").map(Number).some((n, i, a) => { const m = mine.split(".").map(Number); for (let k = 0; k < a.length; k++) { if ((m[k] ?? 0) !== a[k]) return (m[k] ?? 0) < a[k]; } return false; });
  if (!older) return null;
  return <div className="update-note" title="brave://extensions or chrome://extensions → reload Lumen, from apps/extension/.output/chrome-mv3">⬆ You are on v{mine}; v{latest} is out. Reload Lumen in your extensions page.</div>;
}

function Header() {
  return (
    <div className="row">
      <img src="/icons/icon48.png" width={24} height={24} alt="" style={{ borderRadius: 7 }} />
      <b style={{ color: "var(--ink)", fontSize: 16, letterSpacing: "-0.03em" }}>lumen</b>
      <span className="mono muted" style={{ fontSize: 10.5 }}>v{chrome.runtime.getManifest().version}</span>
      <span className="sp" />
      <button className="icon-btn" title="Settings" onClick={() => chrome.runtime.openOptionsPage()}>⚙</button>
      {FLOAT && (
        <button className="icon-btn" title="Minimise" aria-label="Minimise" onClick={minimizeFloat}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M5 12h14" /></svg>
        </button>
      )}
      {FLOAT && <button className="icon-btn" title="Close (Esc)" onClick={closeFloat}>✕</button>}
    </div>
  );
}

function SiteToggles({ host, s, onChange }: { host: string; s: Settings; onChange: (s: Settings) => void }) {
  const helperOn = s.helper.mode === "everywhere" ? !s.helper.hiddenOn.includes(host) : s.helper.mode === "chosen" && s.helper.sites.includes(host);
  const toolbarOn = s.toolbar.enabled && !s.toolbar.disabledSites.includes(host);
  const reload = async () => onChange((await send<{ settings: Settings }>({ type: "GET_SETTINGS" })).settings);
  return (
    <div className="surface stack" style={{ gap: 8, padding: 12 }}>
      <div className="eyebrow">On {host}</div>
      <div className="row"><span style={{ flex: 1, fontSize: 13.5 }}>Show {s.helper.name}</span><button className="switch" role="switch" aria-checked={helperOn} onClick={async () => { await send({ type: "SET_HELPER_SITE", host, on: !helperOn }); reload(); }}><span /></button></div>
      <div className="row"><span style={{ flex: 1, fontSize: 13.5 }}>Selection toolbar</span><button className="switch" role="switch" aria-checked={toolbarOn} onClick={async () => { await send({ type: "SET_TOOLBAR_SITE", host, on: !toolbarOn }); reload(); }}><span /></button></div>
    </div>
  );
}

function ForYou({ openInLumen }: { openInLumen: (p: string) => void }) {
  const [home, setHome] = useState<{ picks: { id: string; title: string; readingMinutes: number; status: string; progress: number }[] } | null>(null);
  const [radar, setRadar] = useState<{ ok: boolean; pro?: boolean; trends?: { id: string; title: string; url: string; topic: string; score: number; source: string }[] } | null>(null);
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  useEffect(() => {
    send<typeof home>({ type: "GET_HOME" }).then(setHome).catch(() => {});
    send<typeof radar>({ type: "GET_RADAR" }).then(setRadar).catch(() => {});
  }, []);
  return (
    <div className="stack" style={{ gap: 10 }}>
      <div className="eyebrow">Today's reads</div>
      {(home?.picks ?? []).map((p) => (
        <button key={p.id} className="pick" onClick={() => openInLumen(`/app/read/${p.id}`)}>
          <span className="tile sm mint">{p.status === "reading" ? "▶" : "☾"}</span>
          <span style={{ minWidth: 0, flex: 1 }}><span style={{ display: "block", color: "var(--ink)", fontWeight: 500, fontSize: 13.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}</span><span className="small muted">{p.status === "reading" ? `${Math.round(p.progress * 100)}% read` : `${p.readingMinutes} min`}</span></span>
        </button>
      ))}
      {home && home.picks.length === 0 && <div className="small muted">Nothing planned. Save a few pages and Lumen builds today's list.</div>}
      <div className="eyebrow" style={{ marginTop: 6 }}>Trending in your topics</div>
      {radar?.ok === false && radar.pro && (
        <div className="surface stack" style={{ gap: 8 }}><span className="small">Radar is part of Lumen Pro: trending stories in what you read.</span><button className="key lamp" style={{ height: 32 }} onClick={() => openInLumen("/app/upgrade")}>See Pro</button></div>
      )}
      {(radar?.trends ?? []).map((t) => (
        <div key={t.id} className="list-row" style={{ alignItems: "flex-start" }}>
          <span style={{ minWidth: 0, flex: 1 }}>
            <a href={t.url} target="_blank" rel="noreferrer" style={{ display: "block", color: "var(--ink)", fontWeight: 500, fontSize: 13.5, textDecoration: "none" }}>{t.title}</a>
            <span className="small muted">#{t.topic} · {t.source === "hn" ? "Hacker News" : "dev.to"} · ▲ {t.score}</span>
          </span>
          <button className="key ghost" style={{ height: 28, padding: "0 10px", flex: "none" }} disabled={saved[t.id]} onClick={async () => { await send({ type: "SAVE_URL", url: t.url, title: t.title }); setSaved((x) => ({ ...x, [t.id]: true })); }}>{saved[t.id] ? "Saved" : "Save"}</button>
        </div>
      ))}
    </div>
  );
}
