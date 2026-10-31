import { useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ArrowRight, Highlighter, Sparkles, X } from "lucide-react";
import { AppIcon, burst } from "./ui";

export interface TourStep { target: string; title: string; body: string; place?: "right" | "bottom" | "left" | "top" }

export const APP_TOUR: TourStep[] = [
  { target: "hero", title: "This is Home", body: "Your reading day at a glance: streak, today's glow and the next thing worth reading. You will start here every day.", place: "bottom" },
  { target: "reads", title: "Today's reads", body: "A plan that fits your daily goal: what you started, plus short pieces from your inbox. Switch to This week for a longer list.", place: "top" },
  { target: "save", title: "Save anything", body: "Paste a link and Lumen makes a clean, calm reader view. Shortcut: ⌘S.", place: "bottom" },
  { target: "nav-library", title: "Library", body: "Everything you saved, by status: inbox, reading, done. Progress is remembered as you scroll.", place: "right" },
  { target: "nav-highlights", title: "Highlights and notes", body: "Every passage you marked, across everything you read. Copy one with a link that jumps back to the exact sentence.", place: "right" },
  { target: "nav-collections", title: "Collections", body: "One per project. Point a collection at a note in Obsidian or Notion and new highlights flow there, once each.", place: "right" },
  { target: "nav-following", title: "Blogs you follow", body: "Follow your favourite blogs. Lumen checks them every few hours and tells you when they publish something new.", place: "right" },
  { target: "nav-ask", title: "Ask your library", body: "Ask anything about what you have read. Answers quote your own highlights and notes, with sources.", place: "right" },
  { target: "nav-radar", title: "Radar and Spark", body: "Radar watches trending stories in your topics; Spark turns your highlights into writing ideas.", place: "right" },
  { target: "agent", title: "Connect your agent", body: "Give Claude, Cursor or any MCP agent your library: it can review your week and suggest what to write.", place: "bottom" },
  { target: "extension", title: "Stay on the page", body: "The extension adds a tiny toolbar when you select text (Explain, Expand, Summary, Note, Save), a side panel to ask your library, and an optional page helper.", place: "bottom" },
  { target: "trial", title: "Your 7 days of Pro", body: "Every feature is unlocked for your first week. After that your library and highlights stay free.", place: "right" },
];

const key = (uid: string) => `lumen-tour-${uid}`;
export const tourDone = (uid: string) => { try { return localStorage.getItem(key(uid)) === "done"; } catch { return true; } };
export const markTour = (uid: string) => { try { localStorage.setItem(key(uid), "done"); } catch { /* */ } };

/** Welcome card first, then a spotlight that walks through the app. */
export function Tour({ open, steps, onClose, name }: { open: boolean; steps: TourStep[]; onClose: () => void; name: string }) {
  const [i, setI] = useState(-1); // -1 = welcome
  const [rect, setRect] = useState<DOMRect | null>(null);
  const visible = steps.filter((s) => {
    const el = document.querySelector(`[data-tour="${s.target}"]`) as HTMLElement | null;
    return el && el.offsetParent !== null;
  });
  const step = i >= 0 ? visible[i] : null;

  useEffect(() => { if (open) setI(-1); }, [open]);
  useLayoutEffect(() => {
    if (!step) { setRect(null); return; }
    const el = document.querySelector(`[data-tour="${step.target}"]`) as HTMLElement | null;
    if (!el) return;
    el.scrollIntoView({ block: "nearest", behavior: "smooth" });
    const measure = () => setRect(el.getBoundingClientRect());
    measure();
    const t = setTimeout(measure, 350);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => { clearTimeout(t); window.removeEventListener("resize", measure); window.removeEventListener("scroll", measure, true); };
  }, [step]);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") setI((x) => Math.max(-1, x - 1));
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  });
  if (!open) return null;

  const next = (e?: React.MouseEvent) => {
    if (i >= visible.length - 1) { if (e) burst(e.clientX, e.clientY); onClose(); return; }
    setI(i + 1);
  };

  if (i === -1) {
    return createPortal(
      <div className="modal-backdrop" style={{ zIndex: 120 }}>
        <div className="modal tour-welcome" role="dialog" aria-modal="true" aria-label="Welcome to Lumen">
          <div className="halftone mesh-lamp tour-welcome__art" aria-hidden="true">
            <span className="tile tile--lg tile--lamp bob" style={{ position: "absolute", left: "16%", top: "26%" }}><Highlighter /></span>
            <span className="tile tile--iris bob" style={{ position: "absolute", right: "18%", top: "18%", ["--delay" as string]: "-2s" }}><Sparkles /></span>
            <span style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)" }} className="pop"><AppIcon size={72} /></span>
          </div>
          <h2 className="h3" style={{ marginTop: 18 }}><span className="lead-in">Welcome, {name}.</span> <span className="payoff">This is Lumen.</span></h2>
          <p className="muted" style={{ marginTop: 8 }}>A calm place for everything you read: save articles, highlight what matters, ask what a passage means, and send it to the notes you already use.</p>
          <div className="tour-who">
            <div><b>For</b> people who read to think, write or learn: researchers, writers, engineers, students.</div>
            <div><b>Not</b> another feed. Nothing to scroll; just what you chose to read.</div>
          </div>
          <div className="row" style={{ marginTop: 18 }}>
            <button className="key key--quiet" onClick={onClose}>Skip</button>
            <span className="spacer" />
            <span className="small muted">60 seconds</span>
            <button className="key key--lamp" onClick={() => setI(0)}>Show me around <ArrowRight size={15} /></button>
          </div>
        </div>
      </div>,
      document.body,
    );
  }

  if (!step || !rect) return null;
  const pad = 8;
  const card = { w: 320, h: 190 };
  let left = rect.right + 16, top = rect.top;
  if (step.place === "bottom") { left = rect.left; top = rect.bottom + 14; }
  if (step.place === "top") { left = rect.left; top = rect.top - card.h - 14; }
  if (step.place === "left") { left = rect.left - card.w - 16; }
  left = Math.max(12, Math.min(left, innerWidth - card.w - 12));
  top = Math.max(12, Math.min(top, innerHeight - card.h - 12));

  return createPortal(
    <div className="tour" role="dialog" aria-modal="true" aria-label={step.title}>
      <div className="tour__spot" style={{ left: rect.left - pad, top: rect.top - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }} />
      <div className="tour__card" style={{ left, top, width: card.w }}>
        <div className="row" style={{ marginBottom: 8 }}>
          <span className="eyebrow">Step {i + 1} of {visible.length}</span><span className="spacer" />
          <button className="icon-btn" aria-label="Close tour" onClick={onClose}><X size={15} /></button>
        </div>
        <h3 style={{ fontSize: 17, letterSpacing: "-0.02em" }}>{step.title}</h3>
        <p className="small" style={{ marginTop: 6, color: "var(--ink-2)" }}>{step.body}</p>
        <div className="row" style={{ marginTop: 14 }}>
          <div className="tour__dots">{visible.map((_, k) => <span key={k} className={k === i ? "on" : ""} />)}</div>
          <span className="spacer" />
          <button className="key key--quiet key--sm key--icon" aria-label="Back" onClick={() => setI(i - 1)}><ArrowLeft size={15} /></button>
          <button className="key key--lamp key--sm" onClick={next}>{i === visible.length - 1 ? "Start reading" : "Next"}</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
