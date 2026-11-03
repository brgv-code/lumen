import { useEffect, useRef, useState } from "react";
import { PageHero } from "../../components/PageHero";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import type { Item } from "@lumen/core";
import { Download, FileUp, Library as LibIcon, Plus, Send, Pencil, Share2 } from "lucide-react";
import { CollectionEditor } from "../../components/CollectionEditor";
import { Empty, Segmented, useToast } from "../../components/ui";
import { ItemCard } from "../../components/cards";
import { api } from "../../lib/api";
import { addLocalPdf } from "../../lib/pdf";
import { useApp } from "./Layout";

type Status = "active" | "inbox" | "reading" | "done" | "favorites" | "archived";

export default function LibraryPage() {
  const { id: collectionId } = useParams();
  const [params, setParams] = useSearchParams();
  const { collections, refresh, openSave, share, user } = useApp();
  const [editing, setEditing] = useState(false);
  const toast = useToast();
  const status = (params.get("status") as Status) || "active";
  const q = params.get("q") || "";
  const tag = params.get("tag") || "";
  const [items, setItems] = useState<Item[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const collection = collections.find((c) => c.id === collectionId);
  const nav = useNavigate();
  const pdfInput = useRef<HTMLInputElement>(null);
  const [addingPdf, setAddingPdf] = useState(false);

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

  const pickPdf = () => {
    if (!user.pro) return window.dispatchEvent(new CustomEvent("lumen:paywall", { detail: "Reading PDFs is part of Lumen Pro. Your 7 day trial has ended." }));
    pdfInput.current?.click();
  };
  const addPdf = async (file: File | undefined) => {
    if (!file) return;
    setAddingPdf(true);
    try {
      const { item, fileStored } = await addLocalPdf(file);
      refresh();
      if (!fileStored) toast("Saved the text. The original file did not upload.", "err");
      nav(`/app/read/${item.id}`);
    } catch (e) { toast((e as Error).message, "err"); }
    finally { setAddingPdf(false); if (pdfInput.current) pdfInput.current.value = ""; }
  };

  return (
    <div className="page">
      <PageHero
        pill={collection ? <Link to="/app/collections">← Collections</Link> : <><LibIcon size={13} /> Library</>}
        lead={collection ? collection.emoji : "Everything you saved,"}
        pay={collection ? collection.name : "ready to read."}
        sub={collection?.description ?? "Inbox, reading, done: progress is tracked as you scroll, and every page opens in a calm reader."}
        actions={<>
          <button className="key key--lamp key--sm" onClick={openSave}><Plus size={15} /> Save a link</button>
          <button className="key key--ghost key--sm" onClick={pickPdf} disabled={addingPdf}><FileUp size={15} /> {addingPdf ? "Reading PDF…" : "Add a PDF"}</button>
          <input ref={pdfInput} type="file" accept="application/pdf,.pdf" hidden onChange={(e) => addPdf(e.target.files?.[0])} />
          {collection && <a className="key key--ghost key--sm" href={`/api/v1/collections/${collection.id}/export.md?format=house`}><Download size={15} /> Export .md</a>}
          {collection && <Link className="key key--ghost key--sm" to="/app/integrations"><Send size={15} /> {collection.destinationId ? "Destination set" : "Send to a note"}</Link>}
          {collection && <button className="key key--ghost key--sm" onClick={() => setEditing(true)}><Pencil size={14} /> Edit</button>}
          {collection && <button className="key key--ghost key--sm" onClick={() => share({ title: `${collection.emoji} ${collection.name}`, refId: collection.id, data: { kind: "collection", owner: user.name.replace(/\s*\((demo|test)\)$/, ""), name: collection.name, emoji: collection.emoji, description: collection.description, total: items?.length ?? collection.itemCount, items: (items ?? []).map((i) => ({ title: i.title, site: i.siteName, url: i.url })) } as never })}><Share2 size={14} /> Share list</button>}
        </>}
      />

      <div className="row" style={{ flexWrap: "wrap", gap: 12 }}>
        <Segmented label="Status" size="sm" value={status} onChange={(v) => set("status", v === "active" ? "" : v)} options={[
          { value: "active", label: "All" }, { value: "inbox", label: "Inbox" }, { value: "reading", label: "Reading" },
          { value: "done", label: "Done" }, { value: "favorites", label: "Favourites" }, { value: "archived", label: "Archived" },
        ]} />
        {q && <button className="chip chip--sky" onClick={() => set("q", "")}>“{q}” ✕</button>}
        {tag && <button className="chip chip--iris" onClick={() => set("tag", "")}>#{tag} ✕</button>}
      </div>

      {editing && <CollectionEditor collection={collection ?? null} onClose={() => setEditing(false)} onSaved={refresh} />}
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
