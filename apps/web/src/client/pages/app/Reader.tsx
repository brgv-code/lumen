import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import DOMPurify from "dompurify";
import type { AIAction, Highlight, ItemWithContent, TextQuote } from "@lumen/core";
import { citeForClipboard, HIGHLIGHT_COLORS } from "@lumen/core";
import { anchorToRange, describeRange, unwrapMarks, wrapRange } from "@lumen/core/dom";
import { ArrowLeft, Archive, BookOpen, Check, Copy, ExternalLink, Heart, MessageSquareText, Sparkles, Wand2, HelpCircle, X } from "lucide-react";
import { api, streamAI } from "../../lib/api";
import { useDebounced, hostOf } from "../../lib/hooks";
import { burst, useToast } from "../../components/ui";
import { HighlightCard } from "../../components/cards";
import { useApp } from "./Layout";

interface Sel { quote: TextQuote; x: number; y: number }
interface AIState { action: AIAction; text: string; answer: string; streaming: boolean; error?: string; question?: string }

export default function Reader() {
  const { id = "" } = useParams();
  const { hash } = useLocation();
  const { collections, refresh } = useApp();
  const toast = useToast();
  const [item, setItem] = useState<ItemWithContent | null>(null);
  const [hls, setHls] = useState<Highlight[]>([]);
  const [missing, setMissing] = useState(false);
  const [sel, setSel] = useState<Sel | null>(null);
  const [ai, setAi] = useState<AIState | null>(null);
  const [ask, setAsk] = useState("");
  const [progress, setProgress] = useState(0);
  const bodyRef = useRef<HTMLDivElement>(null);
  const articleRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setItem(null); setHls([]); setMissing(false); setAi(null);
    api.item(id).then((r) => { setItem(r.item); setHls(r.highlights); }).catch(() => setMissing(true));
    window.scrollTo(0, 0);
  }, [id]);

  const html = item?.contentHtml ? DOMPurify.sanitize(item.contentHtml, { FORBID_TAGS: ["style", "form", "iframe"], FORBID_ATTR: ["style"] }) : "";

  // paint highlights into the article after render
  useLayoutEffect(() => {
    const root = bodyRef.current;
    if (!root || !html) return;
    unwrapMarks(root, "mark[data-hl]");
    for (const h of [...hls].sort((a, b) => b.position - a.position)) {
      const r = anchorToRange(root, h);
      if (r) wrapRange(r, { "data-hl": h.id, class: `hl-${h.color}` });
    }
  }, [html, hls]);

  useEffect(() => {
    if (!hash || !hls.length) return;
    const m = bodyRef.current?.querySelector<HTMLElement>(`mark[data-hl="${hash.slice(1)}"]`);
    if (m) { m.scrollIntoView({ behavior: "smooth", block: "center" }); m.classList.add("flash"); }
  }, [hash, hls.length]);

  const saveProgress = useDebounced((p: number) => {
    if (!item) return;
    const patch: { progress: number; status?: string } = { progress: p };
    if (item.status === "inbox" && p > 0.05) { patch.status = "reading"; setItem({ ...item, status: "reading" }); }
    if (item.status !== "done") api.updateItem(item.id, patch).catch(() => {});
  }, 1200);

  useEffect(() => {
    const onScroll = () => {
      setSel(null);
      const el = articleRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, (window.innerHeight - r.top) / r.height));
      setProgress(p);
      if (item && item.status !== "done" && p > (item.progress ?? 0) + 0.04) saveProgress(p);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [item, saveProgress]);

  const onMouseUp = useCallback(() => {
    setTimeout(() => {
      const s = window.getSelection();
      const root = bodyRef.current;
      if (!s || s.isCollapsed || !root || !s.rangeCount) return setSel(null);
      const range = s.getRangeAt(0);
      if (!root.contains(range.commonAncestorContainer)) return setSel(null);
      const quote = describeRange(root, range);
      if (!quote || quote.quote.trim().length < 2) return setSel(null);
      const rect = range.getBoundingClientRect();
      setSel({ quote, x: rect.left + rect.width / 2, y: rect.top });
    }, 0);
  }, []);

  const onBodyClick = (e: React.MouseEvent) => {
    const m = (e.target as HTMLElement).closest<HTMLElement>("mark[data-hl]");
    if (!m || !window.getSelection()?.isCollapsed) return;
    document.getElementById(`card-${m.dataset.hl}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    document.getElementById(`card-${m.dataset.hl}`)?.animate([{ transform: "scale(1)" }, { transform: "scale(1.02)" }, { transform: "scale(1)" }], { duration: 400 });
  };

  const highlight = async (color: string, withNote = false) => {
    if (!sel || !item) return;
    const q = sel.quote;
    setSel(null);
    window.getSelection()?.removeAllRanges();
    try {
      const r = await api.addHighlight(item.id, { ...q, color });
      setHls((l) => [...l, r.highlight]);
      if (item.status === "inbox") setItem({ ...item, status: "reading" });
      toast(<>Highlighted <span className="muted">+2 glow</span></>, "glow");
      refresh();
      if (withNote) setTimeout(() => document.querySelector<HTMLButtonElement>(`#card-${r.highlight.id} .key--quiet`)?.click(), 80);
    } catch (e) { toast((e as Error).message, "err"); }
  };

  const copySel = async () => {
    if (!sel || !item) return;
    await navigator.clipboard.writeText(citeForClipboard({ quote: sel.quote.quote, title: item.title, url: item.url }));
    toast("Copied with citation");
    setSel(null);
  };

  const runAI = async (action: AIAction, text: string, question?: string) => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setSel(null);
    setAi({ action, text, answer: "", streaming: true, question });
    try {
      const full = await streamAI({ action, text, question, title: item?.title }, (t) => setAi((s) => (s ? { ...s, answer: t } : s)), ac.signal);
      setAi((s) => (s ? { ...s, answer: full || s.answer, streaming: false } : s));
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setAi((s) => (s ? { ...s, streaming: false, error: (e as Error).message } : s));
    }
  };

  const setStatus = async (status: "done" | "archived" | "reading", ev?: React.MouseEvent) => {
    if (!item) return;
    const r = await api.updateItem(item.id, { status });
    setItem({ ...item, ...r.item });
    refresh();
    if (status === "done") {
      if (ev) burst(ev.clientX, ev.clientY);
      toast(<>Finished. Lovely reading. <span className="muted">+10 glow</span></>, "glow");
    } else if (status === "archived") toast("Archived");
  };

  if (missing) return <div className="panel"><h2>That page is not in your library.</h2><Link to="/app/library" className="key key--sm" style={{ marginTop: 12 }}>Back to library</Link></div>;
  if (!item) return <div className="reader"><div className="article"><div className="skeleton" style={{ height: 40, maxWidth: 520, margin: "0 auto 20px" }} />{[0, 1, 2, 3, 4].map((k) => <div key={k} className="skeleton" style={{ height: 18, maxWidth: 680, margin: "12px auto" }} />)}</div></div>;

  return (
    <>
      <div className="progress-top" style={{ width: `${progress * 100}%` }} />
      <div className="row" style={{ marginBottom: 14, flexWrap: "wrap" }}>
        <Link to="/app/library" className="key key--quiet key--sm"><ArrowLeft size={15} /> Library</Link>
        <span className="spacer" />
        <select className="select" style={{ width: 220, height: 34 }} value={item.collectionId ?? ""} aria-label="Collection"
          onChange={async (e) => { const r = await api.updateItem(item.id, { collectionId: e.target.value || null }); setItem({ ...item, ...r.item }); refresh(); toast("Moved"); }}>
          <option value="">No collection</option>
          {collections.map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
        </select>
        <button className={`icon-btn ${item.favorite ? "on" : ""}`} aria-label="Favourite" aria-pressed={item.favorite}
          onClick={async () => { const r = await api.updateItem(item.id, { favorite: !item.favorite }); setItem({ ...item, ...r.item }); }}>
          <Heart size={17} fill={item.favorite ? "currentColor" : "none"} />
        </button>
        <button className="icon-btn" aria-label="Archive" onClick={() => setStatus("archived")}><Archive size={17} /></button>
        <a className="icon-btn" href={item.url} target="_blank" rel="noreferrer" aria-label="Open original"><ExternalLink size={17} /></a>
        {item.status === "done" ? (
          <span className="chip chip--mint" style={{ height: 34, padding: "0 14px" }}><Check size={14} /> Finished</span>
        ) : (
          <button className="key key--lamp key--sm" onClick={(e) => setStatus("done", e)}><Check size={15} /> Mark as done</button>
        )}
      </div>

      <div className="reader">
        <article className="article" ref={articleRef}>
          <header className="article__title">
            <div className="row small muted" style={{ gap: 8 }}>
              <span className="chip">{item.siteName || hostOf(item.url)}</span>
              {item.author && <span>{item.author}</span>}
              <span>· {item.readingMinutes} min read</span>
            </div>
            <h1>{item.title}</h1>
          </header>
          {html ? (
            <div ref={bodyRef} className="article__body" onMouseUp={onMouseUp} onKeyUp={onMouseUp} onClick={onBodyClick} dangerouslySetInnerHTML={{ __html: html }} />
          ) : (
            <div className="article__body">
              <div className="surface gridlines" style={{ padding: 32, textAlign: "center", fontFamily: "var(--font-ui)", fontSize: 15 }}>
                <span className="tile tile--lg tile--sky" style={{ position: "relative" }}><BookOpen /></span>
                <p style={{ position: "relative", marginTop: 14 }}>This one is saved as a bookmark: the page did not offer a readable article to the server.</p>
                <p className="muted" style={{ position: "relative" }}>Open it with the Lumen extension to capture the full text and highlight it in place.</p>
                <a className="key key--sm" href={item.url} target="_blank" rel="noreferrer" style={{ position: "relative", marginTop: 14 }}><ExternalLink size={14} /> Open original</a>
              </div>
            </div>
          )}
        </article>

        <aside className="rail">
          {ai ? (
            <section className="card" style={{ padding: 16, background: "var(--iris-tint)" }}>
              <div className="row" style={{ marginBottom: 10 }}>
                <span className="tile tile--sm tile--iris"><Sparkles /></span>
                <b style={{ color: "var(--ink)", textTransform: "capitalize" }}>{ai.action === "ask" ? "Answer" : ai.action}</b>
                <span className="spacer" />
                <span className="chip" style={{ background: "var(--raised)" }}>Workers AI</span>
                <button className="icon-btn" aria-label="Close" onClick={() => { abortRef.current?.abort(); setAi(null); }}><X size={15} /></button>
              </div>
              <div className="card-flat" style={{ padding: 10, marginBottom: 8 }}>
                <div className="eyebrow">{ai.question ? "You asked" : "Passage"}</div>
                <div style={{ fontFamily: "var(--font-read)", fontSize: 14.5, color: "var(--ink)", maxHeight: 90, overflow: "hidden" }}>{ai.question ?? ai.text}</div>
              </div>
              <div className="card-flat" style={{ padding: 12 }}>
                {ai.error ? <p className="small" style={{ color: "var(--peach)" }}>{ai.error}</p> : <p className={`ai-answer ${ai.streaming ? "caret" : ""}`}>{ai.answer}</p>}
              </div>
              <form className="row" style={{ marginTop: 10 }} onSubmit={(e) => { e.preventDefault(); if (ask.trim()) { runAI("ask", ai.text, ask.trim()); setAsk(""); } }}>
                <input className="input" style={{ height: 36 }} placeholder="Ask a follow up…" value={ask} onChange={(e) => setAsk(e.target.value)} />
                <button className="key key--iris key--sm">Ask</button>
              </form>
              {!ai.streaming && ai.answer && (
                <button className="key key--quiet key--sm" style={{ marginTop: 6 }} onClick={async () => { await navigator.clipboard.writeText(ai.answer); toast("Answer copied"); }}><Copy size={14} /> Copy answer</button>
              )}
            </section>
          ) : (
            <section className="panel" style={{ padding: 16 }}>
              <div className="row"><span className="tile tile--sm tile--ink"><Wand2 /></span><div><div style={{ color: "var(--ink)", fontWeight: 600, fontSize: 14 }}>Select any passage</div><div className="small muted">Highlight it, add a note, or ask about it.</div></div></div>
            </section>
          )}

          <section className="panel" style={{ padding: 16 }}>
            <div className="row" style={{ marginBottom: 12 }}><h2 style={{ fontSize: 15 }}>Highlights</h2><span className="chip">{hls.length}</span><span className="spacer" />
              {hls.length > 0 && <button className="key key--quiet key--sm" onClick={async () => { await navigator.clipboard.writeText(hls.map((h) => citeForClipboard({ quote: h.quote, note: h.note, title: item.title, url: item.url })).join("\n\n")); toast(`Copied ${hls.length} highlights`); }}><Copy size={14} /> All</button>}
            </div>
            <div className="stack" style={{ gap: 10 }}>
              {[...hls].sort((a, b) => a.position - b.position).map((h) => (
                <div key={h.id} id={`card-${h.id}`}>
                  <HighlightCard h={h} title={item.title} url={item.url}
                    onColor={async (color) => { const r = await api.updateHighlight(h.id, { color }); setHls((l) => l.map((x) => (x.id === h.id ? r.highlight : x))); }}
                    onNote={async (note) => { const r = await api.updateHighlight(h.id, { note }); setHls((l) => l.map((x) => (x.id === h.id ? r.highlight : x))); if (note && !h.note) toast(<>Note kept <span className="muted">+3 glow</span></>, "glow"); refresh(); }}
                    onDelete={async () => { await api.deleteHighlight(h.id); setHls((l) => l.filter((x) => x.id !== h.id)); refresh(); }} />
                </div>
              ))}
              {hls.length === 0 && <p className="small muted">Nothing marked yet. Select a sentence that matters.</p>}
            </div>
          </section>
        </aside>
      </div>

      {sel && (
        <div className="toolbar" data-lumen-ui style={{ position: "fixed", left: Math.min(Math.max(sel.x, 190), window.innerWidth - 190), top: Math.max(8, sel.y - 50) }} onMouseDown={(e) => e.preventDefault()}>
          {HIGHLIGHT_COLORS.map((c) => <button key={c} className={`sw swatch-${c}`} aria-label={`Highlight ${c}`} title={`Highlight (${c})`} onClick={() => highlight(c)} />)}
          <span className="sep" />
          <button onClick={() => highlight("sun", true)}><MessageSquareText size={14} /> Note</button>
          <button onClick={() => runAI("explain", sel.quote.quote)}><Sparkles size={14} /> Explain</button>
          <button onClick={() => runAI("define", sel.quote.quote)}><HelpCircle size={14} /> Define</button>
          <button onClick={copySel}><Copy size={14} /> Copy</button>
        </div>
      )}
    </>
  );
}
