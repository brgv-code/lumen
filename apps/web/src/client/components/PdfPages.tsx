import { useEffect, useRef, useState, type RefObject } from "react";
import { colorVar, type Highlight } from "@lumen/core";
import { unwrapMarks, wrapRange } from "@lumen/core/dom";
import type { PdfText } from "@lumen/core/pdf-dom";
import { api } from "../lib/api";
import { showPdfPages } from "../lib/pdf-pages";
import { Notice } from "./PdfBody";

/** A PDF item as its real pages, with the reader's highlights painted into whichever pages are drawn. */
export function PdfPages({ itemId, highlights, pagesRef, onText, onPainted, onFail }: {
  itemId: string;
  highlights: Highlight[];
  pagesRef: RefObject<HTMLDivElement>;
  onText: (text: PdfText) => void;
  onPainted: () => void;
  onFail: () => void;
}) {
  const [shown, setShown] = useState(false);
  // pdf.js calls back outside React: these always hold the latest highlights and handlers.
  const latest = useRef({ highlights, onText, onPainted, onFail });
  latest.current = { highlights, onText, onPainted, onFail };
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
    api.pdfFile(itemId)
      .then((bytes) => showPdfPages(bytes, root, () => paintRef.current()))
      .then((pdf) => {
        if (cancelled) return pdf.destroy();
        destroy = pdf.destroy;
        textRef.current = pdf.text;
        setShown(true);
        latest.current.onText(pdf.text);
        paintRef.current();
      })
      .catch((error: Error) => {
        console.warn("Lumen could not show the PDF's pages", error);
        if (!cancelled) latest.current.onFail();
      });
    return () => {
      cancelled = true;
      destroy();
      textRef.current = null;
      root.replaceChildren();
    };
  }, [itemId, pagesRef]);

  useEffect(() => { paintRef.current(); }, [highlights]);

  return (
    <>
      {!shown && <Notice title="Reading the PDF…" body="Pulling the text out of each page, right here in your browser." />}
      <div ref={pagesRef} className="pdfViewer" />
    </>
  );
}
