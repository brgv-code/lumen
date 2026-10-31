import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import type { Item } from "@lumen/core";
import { Download, Library as LibIcon, Plus, Send } from "lucide-react";
import { Empty, Segmented, useToast } from "../../components/ui";
import { ItemCard } from "../../components/cards";
import { api } from "../../lib/api";
import { useApp } from "./Layout";

type Status = "active" | "inbox" | "reading" | "done" | "favorites" | "archived";

export default function LibraryPage() {
  const { id: collectionId } = useParams();
  const [params, setParams] = useSearchParams();
  const { collections, refresh, openSave } = useApp();
  const toast = useToast();
  const status = (params.get("status") as Status) || "active";
  const q = params.get("q") || "";
  const tag = params.get("tag") || "";
  const [items, setItems] = useState<Item[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const collection = collections.find((c) => c.id === collectionId);

  const load = async (more = false) => {
    const r = await api.items({
      status: status === "active" ? undefined : status === "favorites" ? undefined : status,
      favorite: status === "favorites",
      q: q || undefined,
      tag: tag || undefined,
      collection: collectionId,
      cursor: more ? cursor : undefined,
    });
    setItems((prev) => (more && prev ? [...prev, ...r.data] : r.data));
    setCursor(r.nextCursor);
  };
  useEffect(() => { setItems(null); load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [status, q, tag, collectionId]);

  const set = (k: string, v: string) => { const n = new URLSearchParams(params); if (v) n.set(k, v); else n.delete(k); setParams(n); };

  const fav = async (it: Item) => {
    setItems((l) => l?.map((x) => (x.id === it.id ? { ...x, favorite: !x.favorite } : x)) ?? null);
    await api.updateItem(it.id, { favorite: !it.favorite }).catch(() => toast("Could not update", "err"));
  };
  const del = async (it: Item) => {
    setItems((l) => l?.filter((x) => x.id !== it.id) ?? null);
    await api.deleteItem(it.id).then(() => { refresh(); toast("Removed from library"); }).catch(() => toast("Could not delete", "err"));
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          {collection ? (
            <>
              <Link to="/app/collections" className="eyebrow">Collections</Link>
              <h1 style={{ marginTop: 8 }}><span className="lead-in">{collection.emoji}</span> <span className="payoff">{collection.name}</span></h1>
              {collection.description && <p className="muted" style={{ marginTop: 6 }}>{collection.description}</p>}
            </>
          ) : (
            <>
              <span className="eyebrow">Library</span>
              <h1 style={{ marginTop: 8 }}><span className="lead-in">Everything you saved,</span> <span className="payoff">ready to read.</span></h1>
            </>
          )}
        </div>
        <span className="spacer" />
        {collection && (
          <>
            <a className="key key--ghost key--sm" href={`/api/v1/collections/${collection.id}/export.md?format=house`}><Download size={15} /> Export .md</a>
            <Link className="key key--ghost key--sm" to="/app/integrations"><Send size={15} /> {collection.destinationId ? "Destination set" : "Send to a note"}</Link>
          </>
        )}
        <button className="key key--sm" onClick={openSave}><Plus size={15} /> Save a link</button>
      </div>

      <div className="row" style={{ flexWrap: "wrap", gap: 12 }}>
        <Segmented label="Status" size="sm" value={status} onChange={(v) => set("status", v === "active" ? "" : v)} options={[
          { value: "active", label: "All" }, { value: "inbox", label: "Inbox" }, { value: "reading", label: "Reading" },
          { value: "done", label: "Done" }, { value: "favorites", label: "Favourites" }, { value: "archived", label: "Archived" },
        ]} />
        {q && <button className="chip chip--sky" onClick={() => set("q", "")}>“{q}” ✕</button>}
        {tag && <button className="chip chip--iris" onClick={() => set("tag", "")}>#{tag} ✕</button>}
      </div>

      {items === null ? (
        <div className="cards">{[0, 1, 2, 3, 4, 5].map((k) => <div key={k} className="skeleton" style={{ height: 170 }} />)}</div>
      ) : items.length === 0 ? (
        <Empty icon={<LibIcon />} title={q ? "Nothing matches" : "A quiet shelf"} action={<button className="key key--lamp" onClick={openSave}><Plus size={15} /> Save your first link</button>}>
          {q ? "Try a different word, or search inside highlights instead." : "Save a link here, or use the extension to save the page you are on."}
        </Empty>
      ) : (
        <>
          <div className="cards">{items.map((it, k) => <div key={it.id} className="pop" style={{ animationDelay: `${Math.min(k, 10) * 30}ms` }}><ItemCard item={it} onFavorite={() => fav(it)} onDelete={() => del(it)} /></div>)}</div>
          {cursor && <button className="key key--ghost" style={{ justifySelf: "center" }} onClick={() => load(true)}>Load more</button>}
        </>
      )}
    </div>
  );
}
