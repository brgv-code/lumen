import { useEffect, useState } from "react";
import { HIGHLIGHT_PALETTE } from "@lumen/core";
import { PageHero } from "../../components/PageHero";
import type { Highlight } from "@lumen/core";
import { citeForClipboard } from "@lumen/core";
import { Copy, Highlighter, Search } from "lucide-react";
import { api } from "../../lib/api";
import { useDebounced } from "../../lib/hooks";
import { Empty, Segmented, useToast } from "../../components/ui";
import { HighlightCard } from "../../components/cards";
import { useApp } from "./Layout";

export default function Highlights() {
  const { refresh } = useApp();
  const toast = useToast();
  const [color, setColor] = useState("all");
  const [notes, setNotes] = useState(false);
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [list, setList] = useState<Highlight[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const debounced = useDebounced((v: string) => setQuery(v), 300);

  const load = async (more = false) => {
    const r = await api.highlights({ color: color === "all" ? undefined : color, notes, q: query || undefined, cursor: more ? cursor : undefined });
    setList((l) => (more && l ? [...l, ...r.data] : r.data));
    setCursor(r.nextCursor);
  };
  useEffect(() => { setList(null); load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [color, notes, query]);

  const copyAll = async () => {
    if (!list?.length) return;
    await navigator.clipboard.writeText(list.map((h) => citeForClipboard({ quote: h.quote, note: h.note, title: h.item?.title ?? "", url: h.item?.url ?? "" })).join("\n\n"));
    toast(`Copied ${list.length} highlights with citations`);
  };

  return (
    <div className="page">
      <PageHero
        pill={<><Highlighter size={13} /> Highlights</>}
        lead="Every passage"
        pay="that mattered."
        sub="Filter by colour or notes, copy with a link back to the exact sentence, or hand them to your agent."
        mesh="mesh-lamp"
        tiles={[["tile--sun", <Highlighter />], ["tile--iris", <Copy />], ["tile--mint", <Highlighter />], ["tile--peach", <Search />]]}
        actions={<button className="key key--ghost key--sm" onClick={copyAll}><Copy size={15} /> Copy all shown</button>}
      />
      <div className="row" style={{ flexWrap: "wrap", gap: 12 }}>
        <div className="hl-filter" role="group" aria-label="Filter by colour">
          <button aria-pressed={color === "all"} onClick={() => setColor("all")}>All</button>
          {HIGHLIGHT_PALETTE.map((c) => <button key={c.id} className="cp-sw" style={{ width: 18, height: 18, background: c.swatch }} title={c.name} aria-label={`Only ${c.name}`} aria-pressed={color === c.id} onClick={() => setColor(color === c.id ? "all" : c.id)} />)}
          <button className="cp-sw cp-wheel-btn" style={{ width: 18, height: 18 }} title="Custom colours" aria-label="Only custom colours" aria-pressed={color === "custom"} onClick={() => setColor(color === "custom" ? "all" : "custom")} />
        </div>
        <button className={`chip ${notes ? "chip--ink" : ""}`} style={{ height: 32, padding: "0 12px" }} onClick={() => setNotes(!notes)}>✎ With notes</button>
        <div className="search" style={{ maxWidth: 300, flex: 1 }}>
          <Search size={15} />
          <input className="input" placeholder="Search highlights and notes" value={q} onChange={(e) => { setQ(e.target.value); debounced(e.target.value); }} />
        </div>
      </div>
      {list === null ? (
        <div className="stack">{[0, 1, 2].map((k) => <div key={k} className="skeleton" style={{ height: 110 }} />)}</div>
      ) : list.length === 0 ? (
        <Empty icon={<Highlighter />} title="Nothing here yet">Open something in the reader and select a passage. It lands here with a link back to the exact spot.</Empty>
      ) : (
        <div className="cards" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))" }}>
          {list.map((h) => (
            <HighlightCard key={h.id} h={h} title={h.item?.title ?? ""} url={h.item?.url ?? ""}
              onColor={async (c) => { const r = await api.updateHighlight(h.id, { color: c }); setList((l) => l?.map((x) => (x.id === h.id ? r.highlight : x)) ?? null); }}
              onNote={async (note) => { const r = await api.updateHighlight(h.id, { note }); setList((l) => l?.map((x) => (x.id === h.id ? r.highlight : x)) ?? null); refresh(); }}
              onDelete={async () => { await api.deleteHighlight(h.id); setList((l) => l?.filter((x) => x.id !== h.id) ?? null); refresh(); }} />
          ))}
        </div>
      )}
      {cursor && <button className="key key--ghost" style={{ justifySelf: "center" }} onClick={() => load(true)}>Load more</button>}
    </div>
  );
}
