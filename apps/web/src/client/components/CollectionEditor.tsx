import { useEffect, useState } from "react";
import type { Collection } from "@lumen/core";
import { Modal, useToast } from "./ui";
import { api } from "../lib/api";

const EMOJI = ["📚", "✍️", "🎨", "🧠", "🌱", "🔬", "💡", "🧭", "🎧", "🍳", "🚀", "🧪", "📈", "🧩", "🛠️", "🌍", "🏛️", "🎬", "📷", "🎮", "⚖️", "💼", "🩺", "🧬", "🪴", "☕", "🌙", "⭐", "🔥", "🦉", "🐙", "🦋", "🍀", "🌊", "⛰️", "🎯", "📝", "🗂️", "🔖", "🕯️"];
const COLORS = ["sun", "mint", "iris", "peach", "sky"];

export function CollectionEditor({ collection, onClose, onSaved }: { collection: Collection | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({ name: "", emoji: "📚", color: "sun", description: "" });
  useEffect(() => { if (collection) setF({ name: collection.name, emoji: collection.emoji, color: collection.color, description: collection.description ?? "" }); }, [collection]);
  if (!collection) return null;
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await api.updateCollection(collection.id, { name: f.name, emoji: f.emoji, color: f.color, description: f.description || null }); toast("Collection updated"); onSaved(); onClose(); }
    catch (err) { toast((err as Error).message, "err"); }
  };
  return (
    <Modal open onClose={onClose} title="Edit collection">
      <form className="stack" onSubmit={save}>
        <div className="row" style={{ gap: 14 }}>
          <span className={`tile tile--xl tile--${f.color}`} style={{ fontSize: 40 }}><span style={{ position: "relative", zIndex: 1 }}>{f.emoji}</span></span>
          <div className="stack" style={{ flex: 1, gap: 8 }}>
            <input className="input" value={f.name} required onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Name" />
            <div className="swatches">{COLORS.map((c) => <button type="button" key={c} className={`swatch-${c}`} style={{ width: 24, height: 24 }} aria-pressed={f.color === c} aria-label={c} onClick={() => setF({ ...f, color: c })} />)}</div>
          </div>
        </div>
        <div className="field"><span>Icon</span>
          <div className="emoji-grid">{EMOJI.map((em) => <button type="button" key={em} aria-pressed={f.emoji === em} onClick={() => setF({ ...f, emoji: em })}>{em}</button>)}</div>
          <input className="input" style={{ width: 140 }} maxLength={4} placeholder="Or type any emoji" onChange={(e) => { const v = [...e.target.value.trim()].slice(0, 2).join(""); if (v) setF({ ...f, emoji: v }); }} />
        </div>
        <label className="field"><span>Description</span><input className="input" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="What this shelf is for" /></label>
        <div className="row" style={{ justifyContent: "flex-end" }}><button type="button" className="key key--quiet" onClick={onClose}>Cancel</button><button className="key key--lamp">Save</button></div>
      </form>
    </Modal>
  );
}
