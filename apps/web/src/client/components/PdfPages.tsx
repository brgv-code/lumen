import { useEffect, useRef, useState, type RefObject } from "react";
import { colorVar, type Highlight, type PdfInfo } from "@lumen/core";
import { unwrapMarks, wrapRange } from "@lumen/core/dom";
import type { PdfText } from "@lumen/core/pdf-dom";
import { ApiError, api } from "../lib/api";
import { PROBLEM_TEXT, savePdfPagesText } from "../lib/pdf";
import { showPdfPages } from "../lib/pdf-pages";
import { Notice } from "./PdfBody";

/** A PDF item as its real pages, with the reader's highlights painted into whichever pages are drawn. */
export function PdfPages({ itemId, firstOpen, highlights, pagesRef, onText, onSaved, onPainted, onFail }: {
  itemId: string;
  /** A saved link with no stored file or text yet: the pages download it once and save its text. */
  firstOpen: boolean;
  highlights: Highlight[];
  pagesRef: RefObject<HTMLDivElement>;
  onText: (text: PdfText) => void;
  onSaved: (result: { contentHtml: string | null; pdf: PdfInfo }) => void;
  onPainted: () => void;
  onFail: () => void;
}) {
  const [shown, setShown] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  // pdf.js calls back outside React: these always hold the latest highlights and handlers.
  const latest = useRef({ firstOpen, highlights, onText, onSaved, onPainted, onFail });
  latest.current = { firstOpen, highlights, onText, onSaved, onPainted, onFail };
  const textRef = useRef<PdfText | null>(null);

  const paint = () => {
    const root = pagesRef.current;
    const text = textRef.current;
    if (!root || !text) return;
    unwrapMarks(root, "mark[data-hl]");
    for (const h of [...latest.current.highlights].sort((a, b) => b.position - a.position)) {
      const range = text.rangeFor(root, h);
      if (range) for (const mark of wrapRange(range, { "data-hl": h.id, class: "hl" })) mark.style.setProperty("--hl", colorVar(h.color));
    }
    latest.current.onPainted();
  };
  const paintRef = useRef(paint);
  paintRef.current = paint;

  // Opening the file is a side effect of showing the item; StrictMode's second mount gets a fresh document.
  useEffect(() => {
    const root = pagesRef.current;
    if (!root) return;
    let cancelled = false;
    let destroy = () => {};
    setProblem(null);
    // A first open downloads the file once, through the worker that stores it, while pdf.js loads.
    const bytes = latest.current.firstOpen ? api.pdfFile(itemId) : null;
    let fileArrived = false;
    bytes?.then(() => { fileArrived = true; }, () => {});
    showPdfPages(bytes ?? `/api/v1/items/${itemId}/file`, root, () => paintRef.current())
      .then((pdf) => {
        if (cancelled) return pdf.destroy();
        destroy = pdf.destroy;
        setShown(true);
        return pdf.text.then((text) => {
          if (cancelled) return;
          textRef.current = text;
          latest.current.onText(text);
          paintRef.current();
          if (!bytes) return;
          bytes.then((file) => savePdfPagesText(itemId, file, text.runs))
            .then((result) => { if (!cancelled) latest.current.onSaved(result); })
            .catch((error: Error) => console.warn("Lumen could not save this PDF's text", error));
        });
      })
      .catch((error: Error) => {
        console.warn("Lumen could not show the PDF's pages", error);
        if (cancelled) return;
        if (!bytes) return latest.current.onFail();
        // A first open has no text view to fall back to, so it says why and offers a retry.
        const unreadable = fileArrived && !(error instanceof ApiError);
        if (unreadable) api.savePdfText(itemId, { failed: true }).catch(() => {});
        setProblem(unreadable ? PROBLEM_TEXT.unreadable : error.message);
      });
    return () => {
      cancelled = true;
      destroy();
      textRef.current = null;
      root.replaceChildren();
    };
  }, [itemId, pagesRef, attempt]);

  useEffect(() => { paintRef.current(); }, [highlights]);

  return (
    <>
      {problem ? <Notice title={problem} body="Nothing was lost; try again in a moment." retry={() => setAttempt((count) => count + 1)} />
        : !shown && <Notice title="Reading the PDF…" body="Pulling the text out of each page, right here in your browser." />}
      <div ref={pagesRef} className="pdfViewer" />
    </>
  );
}
