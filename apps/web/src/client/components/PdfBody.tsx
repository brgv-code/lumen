import { useEffect, useRef, useState } from "react";
import type { PdfInfo } from "@lumen/core";
import { FileText, RotateCcw } from "lucide-react";
import { ProLock } from "./Pro";
import { parseSavedPdf } from "../lib/pdf";

type Step = { kind: "working" } | { kind: "problem"; message: string };

/** What the reader shows for a PDF item without text yet: locked, being read, scanned, or a problem. */
export function PdfBody({ itemId, pdf, onText }: { itemId: string; pdf: PdfInfo; onText: (result: { contentHtml: string | null; pdf: PdfInfo }) => void }) {
  const [step, setStep] = useState<Step>({ kind: "working" });
  const [attempt, setAttempt] = useState(0);
  const shouldParse = !pdf.locked && (pdf.text === "pending" || attempt > 0);
  // Always the latest handler, so a new callback from the reader does not start a second parse.
  const onTextRef = useRef(onText);
  onTextRef.current = onText;

  // Reading the file is a side effect of opening the item, so it lives in an effect.
  useEffect(() => {
    if (!shouldParse) return;
    let cancelled = false;
    setStep({ kind: "working" });
    parseSavedPdf(itemId)
      .then((result) => { if (!cancelled) onTextRef.current(result); })
      .catch((error: Error) => { if (!cancelled) setStep({ kind: "problem", message: error.message }); });
    return () => { cancelled = true; };
  }, [itemId, shouldParse, attempt]);

  if (pdf.locked) return <ProLock feature="Reading PDFs" blurb="Your highlights, notes and answers on this PDF stay here." icon={<FileText />} />;
  if (pdf.text === "no_text") return <Notice title="This PDF has no text layer." body="It is probably a scan, so there is nothing to highlight or ask about yet." />;
  if (pdf.text === "failed" && attempt === 0) return <Notice title="This PDF could not be read." body="The link may be gone, or the file is not a PDF." retry={() => setAttempt(1)} />;
  if (step.kind === "problem") return <Notice title={step.message} body="Nothing was lost; try again in a moment." retry={() => setAttempt((count) => count + 1)} />;
  return <Notice title="Reading the PDF…" body="Pulling the text out of each page, right here in your browser." />;
}

export function Notice({ title, body, retry }: { title: string; body: string; retry?: () => void }) {
  return (
    <div className="surface gridlines" style={{ padding: 32, textAlign: "center", fontFamily: "var(--font-ui)", fontSize: 15 }}>
      <span className="tile tile--lg tile--sky" style={{ position: "relative" }}><FileText /></span>
      <p style={{ position: "relative", marginTop: 14 }}>{title}</p>
      <p className="muted" style={{ position: "relative" }}>{body}</p>
      {retry && <button className="key key--sm" onClick={retry} style={{ position: "relative", marginTop: 14 }}><RotateCcw size={14} /> Try again</button>}
    </div>
  );
}
