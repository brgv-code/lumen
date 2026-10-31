import { useEffect, useRef, useState } from "react";
import type { Collection } from "@lumen/core";
import { send } from "../../lib/msg";

const EMOJI = ["📚", "✍️", "🎨", "🧠", "🌱", "🔬", "💡", "🧭"];

/** Target collection picker with inline "New collection" (and an optional new Obsidian note). */
export function Picker({ cols, value, onChange, onCreated }: { cols: Collection[]; value: string; onChange: (id: string) => void; onCreated: (c: Collection) => void }) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const cur = cols.find((c) => c.id === value);
  useEffect(() => {
    const off = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", off);
    return () => document.removeEventListener("mousedown", off);
  }, []);

  if (creating) return <NewCollection onCancel={() => setCreating(false)} onDone={(c) => { setCreating(false); onCreated(c); }} />;

  return (
    <div className="picker" ref={ref}>
      <button className="picker__btn" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="picker__emoji">{cur?.emoji ?? "∅"}</span>
        <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cur?.name ?? "No collection (library only)"}</span>
        <span className="muted">▾</span>
      </button>
      {open && (
        <div className="picker__menu" role="listbox">
          <button className="picker__opt" role="option" aria-selected={!value} onClick={() => { onChange(""); setOpen(false); }}>
            <span className="picker__emoji">∅</span>No collection (library only){!value && <span className="check">✓</span>}
          </button>
          {cols.map((c) => (
            <button key={c.id} className="picker__opt" role="option" aria-selected={c.id === value} onClick={() => { onChange(c.id); setOpen(false); }}>
              <span className="picker__emoji">{c.emoji}</span>
              <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
              {c.id === value && <span className="check">✓</span>}
            </button>
          ))}
          <div className="picker__sep" />
          <button className="picker__opt" onClick={() => { setOpen(false); setCreating(true); }}><span className="picker__emoji" style={{ background: "linear-gradient(180deg,#ffb53d,#ff6a1a)", color: "#fff" }}>+</span>New collection…</button>
        </div>
      )}
    </div>
  );
}

function NewCollection({ onCancel, onDone }: { onCancel: () => void; onDone: (c: Collection) => void }) {
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("✍️");
  const [dest, setDest] = useState<"none" | "obsidian" | string>("none");
  const [note, setNote] = useState("");
  const [dests, setDests] = useState<{ id: string; kind: string; name: string }[]>([]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { send<{ destinations: { id: string; kind: string; name: string }[] }>({ type: "GET_DESTINATIONS" }).then((r) => setDests(r.destinations ?? [])).catch(() => {}); }, []);
  const create = async () => {
    if (!name.trim()) return setErr("Give it a name.");
    setBusy(true); setErr("");
    const r = await send<{ ok: boolean; collection?: Collection; error?: string }>({
      type: "CREATE_COLLECTION", name: name.trim(), emoji,
      destinationId: dest !== "none" && dest !== "obsidian" ? dest : undefined,
      obsidianNote: dest === "obsidian" ? note.trim() || `Lumen/${name.trim()}.md` : undefined,
    });
    setBusy(false);
    if (!r.ok || !r.collection) return setErr(r.error ?? "Could not create it.");
    onDone({ ...r.collection, name: name.trim(), emoji } as Collection);
  };
  return (
    <div className="raised stack pop" style={{ gap: 10, padding: 12 }}>
      <div className="row"><b style={{ color: "var(--ink)" }}>New collection</b><span className="sp" /><button className="key ghost" style={{ height: 28, padding: "0 10px" }} onClick={onCancel}>Cancel</button></div>
      <input autoFocus placeholder="Essay on slow reading" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && create()} />
      <div className="emojis">{EMOJI.map((e) => <button key={e} aria-pressed={e === emoji} onClick={() => setEmoji(e)}>{e}</button>)}</div>
      <div className="eyebrow">Send its highlights to</div>
      <div className="stack" style={{ gap: 4 }}>
        <button className={`picker__opt`} aria-selected={dest === "none"} onClick={() => setDest("none")}><span className="picker__emoji">∅</span>Nowhere yet (Lumen only){dest === "none" && <span className="check">✓</span>}</button>
        <button className={`picker__opt`} aria-selected={dest === "obsidian"} onClick={() => setDest("obsidian")}><span className="picker__emoji">🟣</span>A new Obsidian note{dest === "obsidian" && <span className="check">✓</span>}</button>
        {dests.map((d) => <button key={d.id} className="picker__opt" aria-selected={dest === d.id} onClick={() => setDest(d.id)}><span className="picker__emoji">{d.kind === "obsidian" ? "🟣" : d.kind === "notion" ? "⬛" : d.kind === "markdown" ? "⬇" : "↗"}</span>{d.name}{dest === d.id && <span className="check">✓</span>}</button>)}
      </div>
      {dest === "obsidian" && <input placeholder={`Lumen/${name.trim() || "Essay"}.md`} value={note} onChange={(e) => setNote(e.target.value)} />}
      {err && <span className="chip peach" style={{ justifySelf: "start" }}>{err}</span>}
      <button className="key lamp" disabled={busy} onClick={create}>{busy ? "Creating…" : "Create and send here"}</button>
    </div>
  );
}
