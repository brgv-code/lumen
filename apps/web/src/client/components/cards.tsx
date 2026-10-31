import { Link } from "react-router-dom";
import type { Highlight, Item } from "@lumen/core";
import { citeForClipboard } from "@lumen/core";
import { Copy, ExternalLink, Heart, Trash2, Highlighter } from "lucide-react";
import { hostOf, timeAgo } from "../lib/hooks";
import { useToast } from "./ui";

const LETTER_BG = ["var(--key-lamp)", "var(--key-iris)", "linear-gradient(180deg,#3fd39a,#0f9a63)", "linear-gradient(180deg,#5b9bff,#2563eb)", "linear-gradient(180deg,#ff8a6b,#e24c2b)"];
export function SiteLetter({ url }: { url: string }) {
  const h = hostOf(url);
  const n = [...h].reduce((a, c) => a + c.charCodeAt(0), 0);
  return <span className="letter" style={{ background: LETTER_BG[n % LETTER_BG.length] }}>{h.slice(0, 1).toUpperCase()}</span>;
}

const STATUS_CHIP: Record<string, [string, string]> = {
  inbox: ["Inbox", ""],
  reading: ["Reading", "chip--lamp"],
  done: ["Done", "chip--mint"],
  archived: ["Archived", ""],
};

export function ItemCard({ item, onFavorite, onDelete }: { item: Item; onFavorite?: () => void; onDelete?: () => void }) {
  const [label, cls] = STATUS_CHIP[item.status] ?? ["", ""];
  return (
    <article className="item-card">
      <div className="site">
        <SiteLetter url={item.url} />
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.siteName || hostOf(item.url)}</span>
        <span className="spacer" />
        <span className={`chip ${cls}`}>{label}</span>
      </div>
      <Link to={`/app/read/${item.id}`} style={{ display: "grid", gap: 6 }}>
        <h3>{item.title}</h3>
        {item.excerpt && <p className="excerpt">{item.excerpt}</p>}
      </Link>
      {item.status === "reading" && (
        <div className="meter" style={{ height: 5 }}><span style={{ width: `${Math.round(item.progress * 100)}%` }} /></div>
      )}
      <div className="row small muted" style={{ gap: 6 }}>
        <span>{item.kind === "bookmark" ? "Bookmark" : `${item.readingMinutes} min`}</span>
        {item.highlightCount > 0 && <span className="row" style={{ gap: 4 }}>· <Highlighter size={12} /> {item.highlightCount}</span>}
        <span>· {timeAgo(item.createdAt)}</span>
        <span className="spacer" />
        {onFavorite && (
          <button className={`icon-btn ${item.favorite ? "on" : ""}`} onClick={onFavorite} aria-label={item.favorite ? "Unfavourite" : "Favourite"} aria-pressed={item.favorite}>
            <Heart size={15} fill={item.favorite ? "currentColor" : "none"} />
          </button>
        )}
        {onDelete && <button className="icon-btn" onClick={onDelete} aria-label="Delete"><Trash2 size={15} /></button>}
      </div>
      {item.tags.length > 0 && (
        <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>{item.tags.map((t) => <Link key={t} to={`/app/library?tag=${encodeURIComponent(t)}`} className="chip">#{t}</Link>)}</div>
      )}
    </article>
  );
}

export function HighlightCard({ h, title, url, onDelete, onNote, onColor }: {
  h: Highlight; title: string; url: string;
  onDelete?: () => void; onNote?: (note: string | null) => void; onColor?: (c: string) => void;
}) {
  const toast = useToast();
  const copy = async () => {
    await navigator.clipboard.writeText(citeForClipboard({ quote: h.quote, note: h.note, title, url }));
    toast("Copied with citation");
  };
  return (
    <article className="hl-card">
      <blockquote><mark className={`hl-${h.color}`}>{h.quote}</mark></blockquote>
      {onNote ? (
        <NoteEditor value={h.note} onSave={onNote} />
      ) : h.note ? <div className="note">✎ {h.note}</div> : null}
      <div className="row small muted" style={{ gap: 6 }}>
        <Link to={`/app/read/${h.itemId}#${h.id}`} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "50%", color: "var(--ink-2)", fontWeight: 500 }}>{title}</Link>
        <span style={{ whiteSpace: "nowrap" }}>· {timeAgo(h.createdAt)}</span>
        <span className="spacer" />
        {onColor && (
          <div className="swatches" style={{ marginRight: 6 }}>
            {["sun", "mint", "iris", "peach", "sky"].map((c) => <button key={c} className={`swatch-${c}`} aria-label={`Colour ${c}`} aria-pressed={h.color === c} onClick={() => onColor(c)} />)}
          </div>
        )}
        <button className="icon-btn" onClick={copy} aria-label="Copy with citation" title="Copy with citation"><Copy size={15} /></button>
        <a className="icon-btn" href={url} target="_blank" rel="noreferrer" aria-label="Open source"><ExternalLink size={15} /></a>
        {onDelete && <button className="icon-btn" onClick={onDelete} aria-label="Delete highlight"><Trash2 size={15} /></button>}
      </div>
    </article>
  );
}

import { useState } from "react";
function NoteEditor({ value, onSave }: { value: string | null; onSave: (v: string | null) => void }) {
  const [editing, setEditing] = useState(false);
  const [v, setV] = useState(value ?? "");
  if (!editing)
    return value ? (
      <button className="note" style={{ border: 0, textAlign: "left", cursor: "text", font: "inherit", fontSize: 13.5 }} onClick={() => setEditing(true)}>✎ {value}</button>
    ) : (
      <button className="key key--quiet key--sm" style={{ justifySelf: "start", marginLeft: -8 }} onClick={() => setEditing(true)}>✎ Add a margin note</button>
    );
  return (
    <form className="stack" style={{ gap: 8 }} onSubmit={(e) => { e.preventDefault(); onSave(v.trim() || null); setEditing(false); }}>
      <textarea className="textarea" autoFocus value={v} onChange={(e) => setV(e.target.value)} placeholder="Why does this matter to you?" style={{ minHeight: 64 }}
        onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) (e.currentTarget.form as HTMLFormElement).requestSubmit(); if (e.key === "Escape") setEditing(false); }} />
      <div className="row"><button className="key key--sm">Save note</button><button type="button" className="key key--quiet key--sm" onClick={() => setEditing(false)}>Cancel</button><span className="small muted">⌘↵ to save</span></div>
    </form>
  );
}
