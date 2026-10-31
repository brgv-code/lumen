import { useEffect, useState } from "react";
import { PageHero } from "../../components/PageHero";
import { Link } from "react-router-dom";
import type { Destination } from "@lumen/core";
import { FolderHeart, Plus, Send, Trash2 } from "lucide-react";
import { api } from "../../lib/api";
import { Empty, Modal, useToast } from "../../components/ui";
import { useApp } from "./Layout";

const EMOJI = ["📚", "✍️", "🎨", "🧠", "🌱", "🔬", "💡", "🧭", "🎧", "🍳"];
const COLORS = ["sun", "mint", "iris", "peach", "sky"];

export default function Collections() {
  const { collections, refresh } = useApp();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [dests, setDests] = useState<Destination[]>([]);
  const [form, setForm] = useState({ name: "", emoji: "📚", color: "sun", description: "", destinationId: "" });
  useEffect(() => { api.destinations().then((r) => setDests(r.data)).catch(() => {}); }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createCollection({ ...form, destinationId: form.destinationId || undefined });
      setOpen(false); setForm({ name: "", emoji: "📚", color: "sun", description: "", destinationId: "" }); refresh(); toast("Collection created");
    } catch (e2) { toast((e2 as Error).message, "err"); }
  };

  return (
    <div className="page">
      <PageHero
        pill={<><FolderHeart size={13} /> Collections</>}
        lead="Shelves for"
        pay="what you are working on."
        sub="Point a collection at a note and every new highlight in it flows there, once each. One collection per piece you are writing works beautifully."
        mesh="mesh-peach"
        tiles={[["tile--peach", <FolderHeart />], ["tile--lamp", <Send />], ["tile--iris", <Plus />], ["tile--mint", <FolderHeart />]]}
        actions={<button className="key key--lamp key--sm" onClick={() => setOpen(true)}><Plus size={15} /> New collection</button>}
      />
      {collections.length === 0 ? (
        <Empty icon={<FolderHeart />} title="No collections yet" action={<button className="key" onClick={() => setOpen(true)}>Create one</button>}>A collection groups reading for one project and decides where its highlights go.</Empty>
      ) : (
        <div className="cards">
          {collections.map((c, k) => {
            const d = dests.find((x) => x.id === c.destinationId);
            return (
              <div key={c.id} className="item-card pop" style={{ animationDelay: `${k * 40}ms`, padding: 20 }}>
                <div className="row">
                  <span className={`tile tile--lg tile--${c.color}`} style={{ fontSize: 24 }}><span style={{ position: "relative", zIndex: 1 }}>{c.emoji}</span></span>
                  <span className="spacer" />
                  <button className="icon-btn" aria-label="Delete collection" onClick={async () => { if (confirmDelete(c.name)) { await api.deleteCollection(c.id); refresh(); toast("Collection deleted"); } }}><Trash2 size={15} /></button>
                </div>
                <Link to={`/app/collections/${c.id}`} style={{ display: "grid", gap: 4 }}>
                  <h3 style={{ fontSize: 18 }}>{c.name}</h3>
                  {c.description && <p className="excerpt">{c.description}</p>}
                </Link>
                <div className="row small muted" style={{ gap: 8, flexWrap: "wrap" }}>
                  <span>{c.itemCount} saved</span><span>· {c.highlightCount} highlights</span>
                </div>
                <div className="row" style={{ gap: 8 }}>
                  {d ? <span className="chip chip--mint"><Send size={11} /> {d.name}</span> : <Link to="/app/integrations" className="chip">No destination</Link>}
                  <span className="spacer" />
                  <select className="select" style={{ height: 30, width: 150, fontSize: 12.5 }} aria-label="Destination" value={c.destinationId ?? ""}
                    onChange={async (e) => { await api.updateCollection(c.id, { destinationId: e.target.value || null }); refresh(); toast("Destination updated"); }}>
                    <option value="">Send nowhere</option>
                    {dests.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                  </select>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title="New collection">
        <form className="stack" onSubmit={create}>
          <label className="field"><span>Name</span><input className="input" required autoFocus placeholder="Essay: reading should feel joyful" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          <div className="field"><span>Emoji</span><div className="row" style={{ flexWrap: "wrap", gap: 6 }}>{EMOJI.map((em) => <button type="button" key={em} className={`chip ${form.emoji === em ? "chip--ink" : ""}`} style={{ height: 34, fontSize: 16 }} onClick={() => setForm({ ...form, emoji: em })}>{em}</button>)}</div></div>
          <div className="field"><span>Colour</span><div className="swatches">{COLORS.map((c) => <button type="button" key={c} className={`swatch-${c}`} style={{ width: 24, height: 24 }} aria-pressed={form.color === c} aria-label={c} onClick={() => setForm({ ...form, color: c })} />)}</div></div>
          <label className="field"><span>Description</span><input className="input" placeholder="Optional" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
          <label className="field"><span>Send highlights to</span>
            <select className="select" value={form.destinationId} onChange={(e) => setForm({ ...form, destinationId: e.target.value })}>
              <option value="">Nowhere yet</option>
              {dests.map((d) => <option key={d.id} value={d.id}>{d.name} ({d.kind})</option>)}
            </select>
          </label>
          <div className="row" style={{ justifyContent: "flex-end" }}><button type="button" className="key key--quiet" onClick={() => setOpen(false)}>Cancel</button><button className="key key--lamp">Create</button></div>
        </form>
      </Modal>
    </div>
  );
}

function confirmDelete(name: string) {
  return window.confirm(`Delete "${name}"? Items stay in your library.`);
}
