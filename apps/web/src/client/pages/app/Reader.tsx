import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import DOMPurify from "dompurify";
import type { AIAction, Citation, Highlight, HighlightAnswer, ItemTldr, ItemWithContent, TextQuote } from "@lumen/core";
import { BAR_LABEL, DEFAULT_BAR_ACTIONS, SLASH_HINT, answerLabel, citeForClipboard, HIGHLIGHT_COLORS, colorVar, modelLabel, parseSlash, splitCitations } from "@lumen/core";
import { ColorWheel, recentColors, rememberColor, lastColor, setLastColor } from "../../components/ColorPicker";
import { anchorToRange, coveringQuote, readableParagraphs, unwrapMarks, wrapRange } from "@lumen/core/dom";
import { createSelectionBar, type BarChoice, type BarSnapshot } from "@lumen/core/bar";
import { ArrowLeft, Archive, BookOpen, Check, Copy, ExternalLink, Heart, Sparkles, Wand2, X } from "lucide-react";
import { api, streamAI, streamChat, streamTldr, type ChatSource } from "../../lib/api";
import { alignMargin } from "../../lib/margin";
import { capture } from "../../lib/analytics";
import { useDebounced, hostOf } from "../../lib/hooks";
import { burst, useToast } from "../../components/ui";
import { HighlightCard } from "../../components/cards";
import { useApp } from "./Layout";

interface AIState {
  action: AIAction | "related" | "tldr";
  text: string;
  answer: string;
  streaming: boolean;
  error?: string;
  question?: string;
  model?: string | null;
  sources?: ChatSource[];
  /** The selection the card is about; Keep needs it. */
  passage?: BarSnapshot;
  /** Waiting for the reader to type a question. */
  asking?: boolean;
  /** Set once kept: later follow ups in this card are kept under it too. */
  keptOn?: string;
  lastKeptId?: string;
}
type KeptAnswer = Pick<HighlightAnswer, "action" | "question" | "answer" | "model"> & { parentId?: string };

export default function Reader() {
  const { id = "" } = useParams();
  const { hash } = useLocation();
  const { collections, refresh, labs } = useApp();
  const toast = useToast();
  const [item, setItem] = useState<ItemWithContent | null>(null);
  const [hls, setHls] = useState<Highlight[]>([]);
  const [missing, setMissing] = useState(false);
  const [alsoSaving, setAlsoSaving] = useState(0);
  const [wheelAt, setWheelAt] = useState<{ x: number; y: number; snapshot: BarSnapshot } | null>(null);
  const [threadAsk, setThreadAsk] = useState<{ highlightId: string; action: AIAction; question: string | null; answer: string; streaming: boolean } | null>(null);
  const [tldr, setTldr] = useState<ItemTldr | null>(null);
  const paragraphsRef = useRef<ReturnType<typeof readableParagraphs>>([]);
  const marginRef = useRef<HTMLDivElement>(null);
  const resizeRef = useRef<ResizeObserver | null>(null);
  const aiQuoteRef = useRef<TextQuote | null>(null);
  const [ai, setAi] = useState<AIState | null>(null);
  const [ask, setAsk] = useState("");
  const [progress, setProgress] = useState(0);
  const bodyRef = useRef<HTMLDivElement>(null);
  const articleRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setItem(null); setHls([]); setMissing(false); setAi(null);
    setTldr(null);
    api.item(id).then((r) => { setItem(r.item); setHls(r.highlights); setTldr(r.tldr); setAlsoSaving(r.alsoSaving ?? 0); }).catch(() => setMissing(true));
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
      if (r) for (const m of wrapRange(r, { "data-hl": h.id, class: "hl" })) m.style.setProperty("--hl", colorVar(h.color));
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
      setWheelAt(null);
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

  const onBodyClick = (e: React.MouseEvent) => {
    const m = (e.target as HTMLElement).closest<HTMLElement>("mark[data-hl]");
    if (!m || !window.getSelection()?.isCollapsed) return;
    document.getElementById(`card-${m.dataset.hl}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    document.getElementById(`card-${m.dataset.hl}`)?.animate([{ transform: "scale(1)" }, { transform: "scale(1.02)" }, { transform: "scale(1)" }], { duration: 400 });
  };

  const highlight = async (color: string, quote: TextQuote, withNote = false): Promise<Highlight | undefined> => {
    if (!item) return;
    setLastColor(color);
    setWheelAt(null);
    window.getSelection()?.removeAllRanges();
    try {
      const r = await api.addHighlight(item.id, { ...quote, color });
      setHls((l) => [...l, r.highlight]);
      if (item.status === "inbox") setItem({ ...item, status: "reading" });
      toast("Highlighted");
      refresh();
      if (withNote) setTimeout(() => document.querySelector<HTMLButtonElement>(`#card-${r.highlight.id} .key--quiet`)?.click(), 80);
      return r.highlight;
    } catch (e) { toast((e as Error).message, "err"); return undefined; }
  };

  const copyText = async (text: string, withCitation: boolean) => {
    if (!item) return;
    await navigator.clipboard.writeText(withCitation ? citeForClipboard({ quote: text, title: item.title, url: item.url }) : text);
    toast(withCitation ? "Copied with citation" : "Copied");
  };

  const storeAnswer = async (highlightId: string, kept: KeptAnswer) => {
    const r = await api.keepAnswer(highlightId, kept);
    setHls((l) => l.map((h) => (h.id === highlightId ? { ...h, answers: [...(h.answers ?? []), r.answer] } : h)));
    setAi((s) => (s ? { ...s, keptOn: highlightId, lastKeptId: r.answer.id } : s));
  };

  const runAI = async (action: AIAction, text: string, question?: string, carry: Pick<AIState, "passage" | "keptOn" | "lastKeptId"> = {}) => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setAi({ action, text, answer: "", streaming: true, question, ...carry });
    try {
      const { answer, model } = await streamAI({ action, text, question, title: item?.title }, (t) => setAi((s) => (s ? { ...s, answer: t } : s)), ac.signal);
      setAi((s) => (s ? { ...s, answer: answer || s.answer, model, streaming: false } : s));
      if (carry.keptOn && answer) storeAnswer(carry.keptOn, { action, question: question ?? null, answer, model, parentId: carry.lastKeptId }).catch((e) => toast((e as Error).message, "err"));
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setAi((s) => (s ? { ...s, streaming: false, error: (e as Error).message } : s));
    }
  };

  const runRelated = async (text: string, passage?: BarSnapshot) => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setAi({ action: "related", text, answer: "", streaming: true, passage });
    try {
      const answer = await streamChat({ question: `What in my library relates to this passage: “${text.slice(0, 400)}”`, selection: text }, {
        text: (t) => setAi((s) => (s ? { ...s, answer: t } : s)),
        sources: (sources) => setAi((s) => (s ? { ...s, sources } : s)),
      }, ac.signal);
      setAi((s) => (s ? { ...s, answer: answer || s.answer, streaming: false } : s));
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setAi((s) => (s ? { ...s, streaming: false, error: (e as Error).message } : s));
    }
  };

  /** Attach to the highlight already on the passage, or highlight it first in the last colour. */
  const keep = async () => {
    if (!ai || ai.action === "related" || ai.action === "tldr" || !ai.passage || ai.streaming || !ai.answer || ai.keptOn) return;
    const root = bodyRef.current;
    const owner = (root ? coveringQuote(root, ai.passage.quote, hls) : undefined) ?? (await highlight(lastColor(), ai.passage.quote));
    if (!owner) return;
    try {
      await storeAnswer(owner.id, { action: ai.action, question: ai.question ?? null, answer: ai.answer, model: ai.model ?? null });
      toast("Kept with this highlight");
    } catch (e) { toast((e as Error).message, "err"); }
  };

  const onChoose = (choice: BarChoice, snapshot: BarSnapshot) => {
    const quote = snapshot.quote.quote;
    capture("selection_bar_choice", { surface: "reader", choice: choice.kind === "action" ? choice.action : choice.kind });
    if (choice.kind === "highlight") return highlight(choice.color, snapshot.quote);
    if (choice.kind === "any-colour") {
      const box = snapshot.range.getBoundingClientRect();
      return setWheelAt({ x: box.left + box.width / 2, y: box.top, snapshot });
    }
    if (choice.kind === "extra") return;
    switch (choice.action) {
      case "note": return highlight(lastColor(), snapshot.quote, true);
      case "save": return highlight("mint", snapshot.quote);
      case "copy": return copyText(quote, false);
      case "cite": return copyText(quote, true);
      case "related": return runRelated(quote, snapshot);
      case "ask":
        abortRef.current?.abort();
        return setAi({ action: "ask", text: quote, answer: "", streaming: false, passage: snapshot, asking: true });
      default: return runAI(choice.action, quote, undefined, { passage: snapshot });
    }
  };
  /** The article's TL;DR: the kept one if there is one, otherwise streamed and cited by paragraph. */
  const runTldr = async () => {
    const root = bodyRef.current;
    if (!root || !item) return;
    paragraphsRef.current = readableParagraphs(root);
    const shown = tldr ?? (ai?.action === "tldr" && !ai.streaming && ai.answer ? { text: ai.answer, model: ai.model ?? null } : null);
    capture("tldr_opened", { surface: "reader", kept: Boolean(tldr), cached: Boolean(shown) });
    if (shown) return setAi({ action: "tldr", text: item.title, answer: shown.text, model: shown.model, streaming: false, keptOn: tldr ? tldr.id : undefined });
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setAi({ action: "tldr", text: item.title, answer: "", streaming: true });
    try {
      const { answer, model } = await streamTldr({ title: item.title, paragraphs: paragraphsRef.current.map((p) => p.text) }, (t) => setAi((s) => (s ? { ...s, answer: t } : s)), ac.signal);
      setAi((s) => (s ? { ...s, answer: answer || s.answer, model, streaming: false } : s));
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setAi((s) => (s ? { ...s, streaming: false, error: (e as Error).message } : s));
    }
  };

  const keepTldr = async () => {
    if (!item || !ai || ai.action !== "tldr" || !ai.answer) return;
    const citations: Citation[] = splitCitations(ai.answer).flatMap((part) => {
      const paragraph = typeof part === "string" ? undefined : paragraphsRef.current[part.n - 1];
      return typeof part === "string" || !paragraph ? [] : [{ n: part.n, quote: paragraph.quote }];
    });
    try {
      const r = await api.keepTldr(item.id, { text: ai.answer, model: ai.model ?? null, citations });
      setTldr(r.tldr);
      setAi((s) => (s ? { ...s, keptOn: r.tldr.id } : s));
      toast("Kept the TL;DR with this page");
    } catch (e) { toast((e as Error).message, "err"); }
  };

  const scrollToParagraph = (n: number) => {
    const element = paragraphsRef.current[n - 1]?.element;
    if (!(element instanceof HTMLElement)) return;
    element.scrollIntoView({ behavior: "smooth", block: "center" });
    element.animate([{ backgroundColor: "var(--iris-tint)" }, { backgroundColor: "transparent" }], { duration: 1200 });
  };

  /** What an Ask box does with its text: a slash command, or a question about the passage. */
  const askFrom = (input: string, about: { text: string; passage?: BarSnapshot; keptOn?: string; lastKeptId?: string }) => {
    const slash = parseSlash(input);
    if (slash) capture("slash_command", { surface: "answer_card", command: slash.command });
    if (slash?.command === "tldr") return runTldr();
    if (slash?.command === "related") return runRelated(slash.rest || about.text, about.passage);
    if (slash) return runAI(slash.command === "define" ? "define" : "counterpoint", slash.rest || about.text, undefined, { passage: about.passage });
    return runAI("ask", about.text, input, { passage: about.passage, keptOn: about.keptOn, lastKeptId: about.lastKeptId });
  };

  /** A follow up asked inside a thread card, kept under its highlight as soon as it finishes. */
  const askThread = async (h: Highlight, input: string) => {
    const slash = parseSlash(input);
    if (slash) capture("slash_command", { surface: "thread", command: slash.command });
    if (slash?.command === "tldr") return runTldr();
    if (slash?.command === "related") return runRelated(slash.rest || h.quote);
    const action: AIAction = slash ? (slash.command === "define" ? "define" : "counterpoint") : "ask";
    const question = slash ? null : input;
    setThreadAsk({ highlightId: h.id, action, question, answer: "", streaming: true });
    try {
      const { answer, model } = await streamAI({ action, text: slash?.rest || h.quote, question: question ?? undefined, title: item?.title }, (t) => setThreadAsk((s) => (s ? { ...s, answer: t } : s)));
      const r = await api.keepAnswer(h.id, { action, question, answer, model, parentId: h.answers?.at(-1)?.id });
      setHls((l) => l.map((x) => (x.id === h.id ? { ...x, answers: [...(x.answers ?? []), r.answer] } : x)));
    } catch (e) { toast((e as Error).message, "err"); }
    finally { setThreadAsk(null); }
  };

  aiQuoteRef.current = ai?.action === "tldr" ? paragraphsRef.current[0]?.quote ?? null : ai?.passage?.quote ?? null;
  useLayoutEffect(() => {
    const margin = marginRef.current;
    const body = bodyRef.current;
    if (!margin || !body) return;
    for (const card of margin.querySelectorAll(":scope > [data-anchor]")) resizeRef.current?.observe(card);
    alignMargin(margin, body, aiQuoteRef.current);
  }, [hls, ai, threadAsk, html]);

  // Cards grow while answers stream and the article reflows as fonts and images load.
  useEffect(() => {
    const margin = marginRef.current;
    const body = bodyRef.current;
    if (!margin || !body) return;
    const observer = new ResizeObserver(() => alignMargin(margin, body, aiQuoteRef.current));
    observer.observe(body);
    // Layout effects run first on mount, so the cards already rendered need observing here.
    for (const card of margin.querySelectorAll(":scope > [data-anchor]")) observer.observe(card);
    resizeRef.current = observer;
    return () => { observer.disconnect(); resizeRef.current = null; };
  }, [html]);

  // The bar lives outside React; it always calls the latest handler.
  const chooseRef = useRef(onChoose);
  chooseRef.current = onChoose;

  useEffect(() => {
    const scope = bodyRef.current;
    if (!scope) return;
    const bar = createSelectionBar({
      scope,
      // Words next to the icons only where the wider bar fits.
      config: () => ({ actions: DEFAULT_BAR_ACTIONS, labels: window.innerWidth >= 560, color: lastColor(), colors: [...HIGHLIGHT_COLORS, ...recentColors()], extras: [] }),
      onChoose: (choice, snapshot) => chooseRef.current(choice, snapshot),
    });
    return () => bar.destroy();
  }, [html]);

  const setStatus = async (status: "done" | "archived" | "reading", ev?: React.MouseEvent) => {
    if (!item) return;
    const r = await api.updateItem(item.id, { status });
    setItem({ ...item, ...r.item });
    refresh();
    if (status === "done") {
      if (ev) burst(ev.clientX, ev.clientY);
      toast("Finished. Lovely reading.");
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
        {html && <button className="key key--quiet key--sm" onClick={runTldr}>TL;DR</button>}
      </div>

      <div className="reader">
        <article className="article" ref={articleRef}>
          <header className="article__title">
            <div className="row small muted" style={{ gap: 8 }}>
              <span className="chip">{item.siteName || hostOf(item.url)}</span>
              {item.author && <span>{item.author}</span>}
              <span>· {item.readingMinutes} min read</span>
              {labs && alsoSaving > 0 && <span className="chip chip--mint">{alsoSaving} readers like you saved this</span>}
            </div>
            <h1>{item.title}</h1>
          </header>
          {html ? (
            <div ref={bodyRef} className="article__body" onClick={onBodyClick} dangerouslySetInnerHTML={{ __html: html }} />
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
          {!ai && (
            <section className="panel" style={{ padding: 16 }}>
              <div className="row"><span className="tile tile--sm tile--ink"><Wand2 /></span><div><div style={{ color: "var(--ink)", fontWeight: 600, fontSize: 14 }}>Select any passage</div><div className="small muted">Highlight it, add a note, or ask about it.</div></div></div>
            </section>
          )}

          <div className="row" style={{ padding: "0 4px" }}><h2 style={{ fontSize: 15 }}>Highlights</h2><span className="chip">{hls.length}</span><span className="spacer" />
            {hls.length > 0 && <button className="key key--quiet key--sm" onClick={async () => { await navigator.clipboard.writeText(hls.map((h) => citeForClipboard({ quote: h.quote, note: h.note, title: item.title, url: item.url })).join("\n\n")); toast(`Copied ${hls.length} highlights`); }}><Copy size={14} /> All</button>}
          </div>
          <div className="margin" ref={marginRef}>
            {ai && (
              <section className="card" data-anchor="ai" style={{ padding: 16, background: "var(--iris-tint)" }}>
                <div className="row" style={{ marginBottom: 10 }}>
                  <span className="tile tile--sm tile--iris"><Sparkles /></span>
                  <b style={{ color: "var(--ink)" }}>{ai.action === "tldr" ? "TL;DR" : ai.action === "related" ? BAR_LABEL.related : answerLabel(ai.action)}</b>
                  <span className="spacer" />
                  <button className="icon-btn" aria-label="Close" onClick={() => { abortRef.current?.abort(); setAi(null); }}><X size={15} /></button>
                </div>
                {ai.action !== "tldr" && (
                  <div className="card-flat" style={{ padding: 10, marginBottom: 8 }}>
                    <div className="eyebrow">{ai.question ? "You asked" : "Passage"}</div>
                    <div style={{ fontFamily: "var(--font-read)", fontSize: 14.5, color: "var(--ink)", maxHeight: 90, overflow: "hidden" }}>{ai.question ?? ai.text}</div>
                  </div>
                )}
                {!ai.asking && (
                  <div className="card-flat" style={{ padding: 12 }}>
                    {ai.error ? <p className="small" style={{ color: "var(--peach)" }}>{ai.error}</p> : (
                      <p className={`ai-answer ${ai.streaming ? "caret" : ""}`}>
                        {ai.action === "tldr"
                          ? splitCitations(ai.answer).map((part, index) => (typeof part === "string" ? part.replace(/^[-*] /gm, "• ") : <button key={index} className="cite" title={`Paragraph ${part.n}`} onClick={() => scrollToParagraph(part.n)}>¶{part.n}</button>))
                          : ai.answer}
                      </p>
                    )}
                    {ai.sources && ai.sources.length > 0 && (
                      <ol className="small" style={{ margin: "8px 0 0", paddingLeft: 18 }}>
                        {ai.sources.map((source) => <li key={source.n}><Link to={`/app/read/${source.itemId}`}>{source.title}</Link></li>)}
                      </ol>
                    )}
                  </div>
                )}
                {ai.action !== "tldr" && (
                  <form className="row" style={{ marginTop: 10 }} onSubmit={(e) => { e.preventDefault(); if (ask.trim()) { askFrom(ask.trim(), { text: ai.text, passage: ai.passage, keptOn: ai.keptOn, lastKeptId: ai.lastKeptId }); setAsk(""); } }}>
                    <input className="input" style={{ height: 36 }} autoFocus={ai.asking} placeholder={ai.asking ? "What do you want to know?" : "Ask a follow up…"} value={ask} onChange={(e) => setAsk(e.target.value)} />
                    <button className="key key--iris key--sm">Ask</button>
                  </form>
                )}
                {ai.action !== "tldr" && ask.startsWith("/") && <div className="small muted" style={{ marginTop: 6 }}>{SLASH_HINT}</div>}
                {!ai.streaming && ai.answer && (
                  <div className="row" style={{ marginTop: 6, gap: 4 }}>
                    <button className="key key--quiet key--sm" onClick={async () => { await navigator.clipboard.writeText(ai.answer); toast("Answer copied"); }}><Copy size={14} /> Copy answer</button>
                    {ai.passage && ai.action !== "related" && ai.action !== "tldr" && !ai.keptOn && <button className="key key--quiet key--sm" onClick={keep}>Keep</button>}
                    {ai.action === "tldr" && !ai.keptOn && <button className="key key--quiet key--sm" onClick={keepTldr}>Keep</button>}
                  </div>
                )}
                {!ai.streaming && ai.model && <div className="small muted" style={{ marginTop: 6 }}>{modelLabel(ai.model)}</div>}
              </section>
            )}
            {[...hls].sort((a, b) => a.position - b.position).map((h) => (
              <div key={h.id} id={`card-${h.id}`} data-anchor={`hl:${h.id}`}>
                <HighlightCard h={h} title={item.title} url={item.url}
                  onColor={async (color) => { const r = await api.updateHighlight(h.id, { color }); setHls((l) => l.map((x) => (x.id === h.id ? r.highlight : x))); }}
                  onNote={async (note) => { const r = await api.updateHighlight(h.id, { note }); setHls((l) => l.map((x) => (x.id === h.id ? r.highlight : x))); if (note && !h.note) toast("Note kept"); refresh(); }}
                  onDelete={async () => { await api.deleteHighlight(h.id); setHls((l) => l.filter((x) => x.id !== h.id)); refresh(); }}
                  onFollowUp={(question) => askThread(h, question)}
                  followUp={threadAsk?.highlightId === h.id ? threadAsk : undefined} />
              </div>
            ))}
            {hls.length === 0 && <p className="small muted">Nothing marked yet. Select a sentence that matters.</p>}
          </div>
        </aside>
      </div>

      {wheelAt && (
        <div className="cp-pop cp-pop--center" style={{ position: "fixed", left: wheelAt.x, top: wheelAt.y - 10, transform: "translate(-50%, -100%)" }}>
          <ColorWheel initial={lastColor().startsWith("#") ? lastColor() : "#ff7a59"} onPick={(c) => { rememberColor(c); highlight(c, wheelAt.snapshot.quote); }} />
        </div>
      )}
    </>
  );
}
