import type { ReactNode } from "react";

/** Tiny, safe markdown for answers: paragraphs, "- " and "1." lists, **bold**, `code`, [n] citations. */
export function Md({ text, onCite }: { text: string; onCite?: (n: number) => void }) {
  // Group lines into runs: consecutive list lines become one list, everything else paragraphs.
  const isItem = (l: string) => /^\s*([-*•]|\d+[.)])\s+/.test(l);
  const runs: { kind: "p" | "ul" | "ol" | "q"; lines: string[] }[] = [];
  for (const raw of text.replace(/\r/g, "").split("\n")) {
    const l = raw.trimEnd();
    if (!l.trim()) { runs.push({ kind: "p", lines: [] }); continue; }
    const kind = /^\s*>/.test(l) ? "q" : isItem(l) ? (/^\s*\d/.test(l) ? "ol" : "ul") : "p";
    const last = runs[runs.length - 1];
    if (last && last.kind === kind && (kind !== "p" || last.lines.length)) last.lines.push(l);
    else runs.push({ kind, lines: [l] });
  }
  return <>{runs.filter((r) => r.lines.length).map((r, k) => {
    if (r.kind === "q") {
      const body = r.lines.map((l) => l.replace(/^\s*>\s?/, "")).filter((l) => l.trim());
      return <blockquote key={k} className="md-quote">{body.map((l, i) => <span key={i}>{i > 0 && <br />}{inline(l, onCite)}</span>)}</blockquote>;
    }
    if (r.kind === "p") return <p key={k} className="md-p">{r.lines.map((l, i) => <span key={i}>{i > 0 && <br />}{inline(l, onCite)}</span>)}</p>;
    const items = r.lines.map((l, i) => <li key={i}>{inline(l.replace(/^\s*([-*•]|\d+[.)])\s+/, ""), onCite)}</li>);
    return r.kind === "ol" ? <ol key={k} className="md-list">{items}</ol> : <ul key={k} className="md-list">{items}</ul>;
  })}</>;
}

function inline(s: string, onCite?: (n: number) => void): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\[[^\]]+\]\((https?:[^)\s]+)\)|\*\*[^*]+\*\*|`[^`]+`|\[\d+\])/g;
  let last = 0, m: RegExpExecArray | null, k = 0;
  while ((m = re.exec(s))) {
    if (m.index > last) out.push(s.slice(last, m.index));
    const t = m[0];
    if (m[2]) { const label = t.slice(1, t.indexOf("](")); out.push(<a key={k++} className="md-link" href={m[2]} target="_blank" rel="noreferrer">{label}</a>); }
    else if (t.startsWith("**")) out.push(<b key={k++}>{t.slice(2, -2)}</b>);
    else if (t.startsWith("`")) out.push(<code key={k++}>{t.slice(1, -1)}</code>);
    else { const n = Number(t.slice(1, -1)); out.push(<button key={k++} className="cite" type="button" onClick={() => onCite?.(n)}>{n}</button>); }
    last = m.index + t.length;
  }
  if (last < s.length) out.push(s.slice(last));
  return out;
}
