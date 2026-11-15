import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowDown, ArrowUp, Copy, Crown, EyeOff, Pencil, Sparkles, Trash2 } from "lucide-react";
import { BUILTIN_STYLES, STYLE_BODY_MAX, orderedStyles, unknownVariables, type AskPrefs, type Style, type StyleListing } from "@lumen/core";
import { api } from "../lib/api";
import { timeAgo } from "../lib/hooks";
import { Segmented, useToast } from "./ui";

const MONTH = 30 * 24 * 60 * 60 * 1000;
type Draft = { id?: string; name: string; body: string };

/** Settings section for Ask styles (ADR-005): the default, the pill order, and the reader's own. */
export function AskStyles() {
  const toast = useToast();
  const [listing, setListing] = useState<StyleListing | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [view, setView] = useState<"order" | "used">("order");
  const [confirming, setConfirming] = useState<string | null>(null);
  const load = () => api.styles().then(setListing).catch((error: Error) => toast(error.message, "err"));
  useEffect(() => { load(); }, []);

  if (!listing) return null;
  const { prefs, usage, pro } = listing;
  const ordered = orderedStyles(listing.styles, prefs);
  const shown = view === "used" ? [...ordered].sort((styleA, styleB) => (usage[styleB.key]?.count ?? 0) - (usage[styleA.key]?.count ?? 0)) : ordered;
  const hidden = BUILTIN_STYLES.filter((style) => prefs.hidden.includes(style.key));

  const savePrefs = async (next: AskPrefs) => {
    try { setListing({ ...listing, prefs: (await api.saveStylePrefs(next)).prefs }); } catch (error) { toast((error as Error).message, "err"); }
  };
  const move = (key: string, step: -1 | 1) => {
    const keys = ordered.map((style) => style.key);
    const from = keys.indexOf(key);
    const to = from + step;
    if (to < 0 || to >= keys.length) return;
    [keys[from], keys[to]] = [keys[to] ?? key, key];
    savePrefs({ ...prefs, order: keys });
  };
  const hide = (key: string) => savePrefs({ ...prefs, hidden: [...prefs.hidden, key], defaultStyle: prefs.defaultStyle === key ? null : prefs.defaultStyle });
  const remove = async (style: Style) => {
    if (confirming !== style.key) return setConfirming(style.key);
    setConfirming(null);
    try { await api.deleteStyle(style.key); toast("Style deleted"); load(); } catch (error) { toast((error as Error).message, "err"); }
  };
  const saveDraft = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft) return;
    try {
      if (draft.id) await api.updateStyle(draft.id, draft); else await api.createStyle(draft);
      setDraft(null); toast("Style saved"); load();
    } catch (error) { toast((error as Error).message, "err"); }
  };
  const unknown = draft ? unknownVariables(draft.body) : [];

  return (
    <section className="panel stack">
      <div className="row"><span className="tile tile--sm tile--iris"><Sparkles /></span><h2>Ask styles</h2><span className="spacer" />{!pro && <span className="chip chip--lamp">Pro</span>}</div>
      <p className="small muted">How Lumen explains things when you ask. Your default shapes every chat; the pills under an answer switch the style for that chat.</p>
      {!pro && <div className="row small" style={{ flexWrap: "wrap" }}><span className="muted">Ask styles are part of Lumen Pro.</span><Link to="/app/upgrade?from=ask-templates" className="key key--lamp key--sm"><Crown size={14} /> See Pro</Link></div>}

      <label className="field"><span>Default style</span>
        <select className="input" disabled={!pro} value={prefs.defaultStyle ?? ""} onChange={(event) => savePrefs({ ...prefs, defaultStyle: event.target.value || null })}>
          <option value="">Standard</option>
          {ordered.filter((style) => !style.locked).map((style) => <option key={style.key} value={style.key}>{style.name}</option>)}
        </select>
      </label>

      <div className="row"><Segmented label="Show" size="sm" value={view} onChange={setView} options={[{ value: "order", label: "Pill order" }, { value: "used", label: "Most used" }]} /><span className="spacer" />{pro && !draft && <button className="key key--sm" onClick={() => setDraft({ name: "", body: "" })}>New style</button>}</div>
      <p className="small muted">The first four show as pills; the rest sit under More.</p>

      {draft && (
        <form className="card-flat stack" style={{ padding: 12 }} onSubmit={saveDraft}>
          <label className="field"><span>Name</span><input className="input" maxLength={40} placeholder="Like my grandma would" value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
          <label className="field"><span>How should Lumen answer? {draft.body.length}/{STYLE_BODY_MAX}</span>
            <textarea className="input" rows={5} maxLength={STYLE_BODY_MAX} placeholder="Answer warmly and simply, the way a grandmother explains things over tea. One small story from everyday life, no jargon." value={draft.body} onChange={(event) => setDraft({ ...draft, body: event.target.value })} />
          </label>
          {unknown.length > 0 && <p className="small" style={{ color: "var(--peach)" }}>Lumen fills only {"{{quote}}"} and {"{{title}}"}; {unknown.map((name) => `{{${name}}}`).join(", ")} will be sent as written.</p>}
          <div className="row"><button className="key key--sm">Save style</button><button type="button" className="key key--ghost key--sm" onClick={() => setDraft(null)}>Cancel</button></div>
        </form>
      )}

      {shown.map((style) => {
        const use = usage[style.key];
        const at = ordered.indexOf(style);
        return (
          <div key={style.key} className="card-flat row" style={{ padding: 12, alignItems: "flex-start", opacity: style.locked ? 0.6 : 1 }}>
            <span style={{ minWidth: 0, flex: 1 }}>
              <b style={{ color: "var(--ink)", fontSize: 14 }}>{style.name}</b> <code className="mono small muted">/{style.slug}</code>
              {style.builtin ? <span className="chip" style={{ marginLeft: 6 }}>Built in</span> : null}
              {view === "order" && at < 4 ? <span className="chip chip--iris" style={{ marginLeft: 6 }}>Pill</span> : null}
              {use?.lastUsedAt && Date.now() - use.lastUsedAt > MONTH ? <span className="chip" style={{ marginLeft: 6 }}>Not used in 30 days</span> : null}
              <span className="small muted" style={{ display: "block" }}>{use ? `Used ${use.count} ${use.count === 1 ? "time" : "times"} · last ${use.lastUsedAt ? timeAgo(use.lastUsedAt) : "never"}` : "Not used yet"}</span>
              <details className="small muted"><summary>Instruction</summary><span style={{ whiteSpace: "pre-wrap" }}>{style.body}</span></details>
            </span>
            {pro && view === "order" && <><button className="icon-btn" title="Move up" onClick={() => move(style.key, -1)}><ArrowUp size={14} /></button><button className="icon-btn" title="Move down" onClick={() => move(style.key, 1)}><ArrowDown size={14} /></button></>}
            {pro && style.builtin && <><button className="icon-btn" title="Duplicate and edit" onClick={() => setDraft({ name: `${style.name} (mine)`, body: style.body })}><Copy size={14} /></button><button className="icon-btn" title="Hide" onClick={() => hide(style.key)}><EyeOff size={14} /></button></>}
            {pro && !style.builtin && <button className="icon-btn" title="Edit" onClick={() => setDraft({ id: style.key, name: style.name, body: style.body })}><Pencil size={14} /></button>}
            {!style.builtin && <button className="icon-btn" title={confirming === style.key ? "Click again to delete" : "Delete"} onClick={() => remove(style)} style={confirming === style.key ? { color: "var(--peach)" } : undefined}><Trash2 size={14} /></button>}
          </div>
        );
      })}
      {pro && hidden.length > 0 && <div className="row small"><span className="muted">{hidden.length} built in {hidden.length === 1 ? "style" : "styles"} hidden.</span><button className="key key--ghost key--sm" onClick={() => savePrefs({ ...prefs, hidden: [] })}>Restore built ins</button></div>}
    </section>
  );
}
