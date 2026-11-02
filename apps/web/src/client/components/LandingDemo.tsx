import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Sparkles, X } from "lucide-react";
import { DEFAULT_BAR_ACTIONS, HIGHLIGHT_COLORS, answerLabel, citeForClipboard, colorVar, type TextQuote } from "@lumen/core";
import { anchorToRange, wrapRange } from "@lumen/core/dom";
import { createSelectionBar, type BarChoice, type BarSnapshot } from "@lumen/core/bar";
import { capture } from "../lib/analytics";
import { STORE_URL } from "../lib/extension";
import { DEMO_ANSWERS, DEMO_ARTICLE_HTML, DEMO_BYLINE, DEMO_COPY, DEMO_TITLE, DEMO_TLDR, isDemoTerm, type DemoTerm } from "../lib/landing-demo";
import { useToast } from "./ui";

type Card =
  | { kind: "answer"; label: string; text: string; term: DemoTerm | "tldr"; passage: TextQuote | null }
  | { kind: "install"; reason: "unknown" | "library" };

const WORD_MS = 35;

/** The real selection bar on a sample article: written answers for five terms, nothing leaves the page. */
export function LandingDemo() {
  const articleRef = useRef<HTMLDivElement>(null);
  const lastColor = useRef("sun");
  const toast = useToast();
  const [card, setCard] = useState<Card | null>(null);
  const [shown, setShown] = useState(0);
  const [kept, setKept] = useState(false);

  const termFor = (snapshot: BarSnapshot): DemoTerm | null => {
    const terms = articleRef.current?.querySelectorAll<HTMLElement>("[data-term]") ?? [];
    const hit = Array.from(terms).find((element) => snapshot.range.intersectsNode(element))?.dataset.term;
    return isDemoTerm(hit) ? hit : null;
  };

  const paint = (quote: TextQuote, color: string) => {
    const scope = articleRef.current;
    const range = scope ? anchorToRange(scope, quote) : null;
    if (!range) return;
    for (const mark of wrapRange(range, { class: "hl", "data-demo-mark": "" })) mark.style.setProperty("--hl", colorVar(color));
    lastColor.current = color;
    window.getSelection()?.removeAllRanges();
  };

  const install = (reason: "unknown" | "library") => {
    setCard({ kind: "install", reason });
    capture("landing_demo_install_prompt", { reason });
  };

  const answer = (label: string, term: DemoTerm | "tldr", passage: TextQuote | null, action: string) => {
    setKept(false);
    setCard({ kind: "answer", label, text: term === "tldr" ? DEMO_TLDR : DEMO_ANSWERS[term], term, passage });
    capture("landing_demo_answer", { action, term });
  };

  const onChoose = async (choice: BarChoice, snapshot: BarSnapshot) => {
    const quote = snapshot.quote.quote;
    if (choice.kind === "highlight") return paint(snapshot.quote, choice.color);
    if (choice.kind !== "action") return;
    switch (choice.action) {
      case "save": return paint(snapshot.quote, "mint");
      case "copy":
        await navigator.clipboard.writeText(quote);
        return toast("Copied");
      case "cite":
        await navigator.clipboard.writeText(citeForClipboard({ quote, title: DEMO_TITLE, url: `${location.origin}/` }));
        return toast("Copied with citation");
      case "note":
      case "ask":
      case "related":
        return install("library");
      default: {
        const term = termFor(snapshot);
        return term ? answer(answerLabel(choice.action), term, snapshot.quote, choice.action) : install("unknown");
      }
    }
  };
  // The bar lives outside React; it always calls the latest handler.
  const chooseRef = useRef(onChoose);
  chooseRef.current = onChoose;

  useEffect(() => {
    const scope = articleRef.current;
    if (!scope) return;
    const bar = createSelectionBar({
      scope,
      // Words next to the icons only where the wider bar fits.
      config: () => ({ actions: DEFAULT_BAR_ACTIONS, labels: window.innerWidth >= 560, color: lastColor.current, colors: HIGHLIGHT_COLORS, anyColour: false, extras: [] }),
      onChoose: (choice, snapshot) => { void chooseRef.current(choice, snapshot); },
      onOpen: (snapshot) => capture("landing_demo_select", { term: termFor(snapshot) }),
    });
    return () => bar.destroy();
  }, []);

  // Types the written answer out like a streamed one; all at once under reduced motion.
  const text = card?.kind === "answer" ? card.text : "";
  useEffect(() => {
    const words = text ? text.split(" ").length : 0;
    if (!words || window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setShown(words); return; }
    setShown(0);
    const timer = window.setInterval(() => setShown((count) => {
      if (count + 1 >= words) window.clearInterval(timer);
      return Math.min(count + 1, words);
    }), WORD_MS);
    return () => window.clearInterval(timer);
  }, [text]);

  const keep = () => {
    if (card?.kind !== "answer" || !card.passage) return;
    paint(card.passage, lastColor.current);
    setKept(true);
    capture("landing_demo_keep", { term: card.term });
  };

  const words = text.split(" ");
  const done = shown >= words.length;

  return (
    <div className="demo">
      <p className="demo__hint">{DEMO_COPY.hint}</p>
      <div className="demo-paper">
        <div className="demo-paper__head">
          <div>
            <h4>{DEMO_TITLE}</h4>
            <div className="by">{DEMO_BYLINE}</div>
          </div>
          <button className="demo-tldr" onClick={() => answer("TL;DR", "tldr", null, "tldr")}>TL;DR</button>
        </div>
        <div ref={articleRef} className="demo-article" dangerouslySetInnerHTML={{ __html: DEMO_ARTICLE_HTML }} />
      </div>

      {card && (
        <div className="demo-card" role="dialog" aria-label={card.kind === "answer" ? card.label : DEMO_COPY[card.reason]}>
          <div className="row">
            {card.kind === "answer" && <span className="tile tile--sm tile--iris"><Sparkles /></span>}
            <b style={{ color: "var(--ink)" }}>{card.kind === "answer" ? card.label : DEMO_COPY[card.reason]}</b>
            <span className="spacer" />
            <button className="demo-card__close" aria-label="Close" onClick={() => setCard(null)}><X size={15} /></button>
          </div>
          {card.kind === "answer" ? (
            <>
              <p className="demo-card__answer">{words.slice(0, shown).join(" ")}</p>
              {kept ? <p className="small" style={{ margin: "0 0 6px" }}>{DEMO_COPY.kept}</p>
                : done && card.passage && <button className="key key--sm" style={{ marginBottom: 8 }} onClick={keep}>Keep</button>}
              <div className="small muted">{DEMO_COPY.footer}</div>
            </>
          ) : (
            <>
              <p className="demo-card__answer">{DEMO_COPY.install}</p>
              <div className="row" style={{ gap: 8 }}>
                <Link to="/login" className="key key--lamp key--sm" onClick={() => capture("landing_demo_install_click", { target: "start" })}>Start free</Link>
                {STORE_URL && <a className="key key--ghost key--sm" href={STORE_URL} target="_blank" rel="noreferrer" onClick={() => capture("landing_demo_install_click", { target: "store" })}>Add to Chrome</a>}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
