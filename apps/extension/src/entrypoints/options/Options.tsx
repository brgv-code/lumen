import { useEffect, useState } from "react";
import { send } from "../../lib/msg";
import { TOOLBAR_ACTIONS, type Provider, type Settings, type ToolbarAction } from "../../lib/types";
import { ICON, LABEL } from "../content/icons";

const Svg = ({ a }: { a: string }) => <i className="svg" dangerouslySetInnerHTML={{ __html: ICON[a as keyof typeof ICON] }} />;

const PROVIDERS: { id: Provider; label: string; hint: string }[] = [
  { id: "lumen", label: "Lumen", hint: "Hosted on Cloudflare Workers AI. Uses your Lumen account." },
  { id: "ollama", label: "Ollama", hint: "Local. Start it with OLLAMA_ORIGINS='chrome-extension://*' ollama serve" },
  { id: "openai", label: "OpenAI compatible", hint: "OpenAI, Groq, Mistral, LM Studio: any /v1/chat/completions API." },
  { id: "claude", label: "Claude (local CLI)", hint: "Runs claude -p through the Lumen helper. Install it once with apps/native-host/install.sh" },
];

const ACTION_INFO: Record<ToolbarAction, [string, string]> = {
  highlight: ["🖍", "Highlight (hover for colours)"],
  note: ["✎", "Note on the passage"],
  explain: ["✦", "Explain in plain words"],
  expand: ["⤢", "Expand with background"],
  summarize: ["≡", "Summary"],
  define: ["📖", "Define a word or term"],
  ask: ["?", "Ask in the side panel"],
  save: ["🔖", "Save the passage to your bank"],
  copy: ["⧉", "Copy with a link back"],
};

export default function Options() {
  const [s, setS] = useState<Settings | null>(null);
  const [test, setTest] = useState<{ ok: boolean; message: string } | null>(null);
  const [saved, setSaved] = useState(false);
  const [section, setSection] = useState("appearance");
  useEffect(() => { send<{ settings: Settings }>({ type: "GET_SETTINGS" }).then((r) => setS(r.settings)); }, []);
  if (!s) return null;

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => { setS({ ...s, [k]: v }); setSaved(false); setTest(null); };
  const save = async (next = s) => { const r = await send<{ settings: Settings }>({ type: "SAVE_SETTINGS", settings: next }); setS(r.settings); setSaved(true); };
  const run = async () => { await save(); setTest(await send({ type: "TEST_CONNECTION" })); };
  const tb = s.toolbar;
  const hp = s.helper;
  const setTb = (patch: Partial<typeof tb>) => { const next = { ...s, toolbar: { ...tb, ...patch } }; setS(next); save(next); };
  const setHp = (patch: Partial<typeof hp>) => { const next = { ...s, helper: { ...hp, ...patch } }; setS(next); save(next); };
  const move = (a: ToolbarAction, dir: -1 | 1) => {
    const list = [...tb.actions]; const i = list.indexOf(a); const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]]; setTb({ actions: list });
  };
  const toggle = (a: ToolbarAction) => setTb({ actions: tb.actions.includes(a) ? tb.actions.filter((x) => x !== a) : [...tb.actions, a] });
  const ordered = [...tb.actions, ...TOOLBAR_ACTIONS.filter((a) => !tb.actions.includes(a))];

  const NAV: [string, string][] = [["appearance", "Appearance"], ["toolbar", "Selection toolbar"], ["helper", `Page helper (${hp.name})`], ["account", "Account"], ["model", "Model"], ["obsidian", "Obsidian"], ["more", "Reminders"]];

  return (
    <div className="opt">
      <aside className="opt__nav">
        <div className="row" style={{ marginBottom: 16 }}><img src="/icons/icon48.png" width={30} height={30} alt="" style={{ borderRadius: 9 }} /><b style={{ color: "var(--ink)", fontSize: 19, letterSpacing: "-0.04em" }}>lumen</b></div>
        {NAV.map(([k, l]) => <button key={k} aria-current={section === k} onClick={() => setSection(k)}>{l}</button>)}
        <div className="small muted" style={{ marginTop: "auto" }}>v{chrome.runtime.getManifest().version} · {s.token ? <span style={{ color: "var(--mint)" }}>connected</span> : "not connected"}</div>
      </aside>

      <main className="opt__main stack" style={{ gap: 16 }}>
        {section === "appearance" && (
          <>
            <h1 style={{ fontSize: 28 }}><span className="lead">How Lumen</span> looks</h1>
            <p className="muted" style={{ margin: 0 }}>One setting for every surface: the toolbar, answer cards, {hp.name}, the panel, the popup and this page.</p>
            <div className="surface stack">
              <span style={{ fontSize: 13, fontWeight: 500 }}>Theme</span>
              <div className="seg">{([["system", "Match my system"], ["light", "Light"], ["dark", "Dark"]] as const).map(([v, l]) => <button key={v} aria-pressed={(s.theme ?? "system") === v} onClick={() => { const n = { ...s, theme: v }; setS(n); save(n); }}>{l}</button>)}</div>
            </div>
            <div className="surface stack">
              <span style={{ fontSize: 13, fontWeight: 500 }}>Panel</span>
              <div className="seg">{([["floating", "Float over the page"], ["docked", "Dock to the side"]] as const).map(([v, l]) => <button key={v} aria-pressed={(s.panel ?? "floating") === v} onClick={() => { const n = { ...s, panel: v }; setS(n); save(n); }}>{l}</button>)}</div>
              <span className="small muted">{(s.panel ?? "floating") === "floating" ? "The panel floats on the right and the page keeps its full width. Esc closes it." : "Uses the browser's side panel, which makes the page narrower."}</span>
            </div>
            <div className="surface stack">
              <span style={{ fontSize: 13, fontWeight: 500 }}>Highlights</span>
              <div className="seg">{([["auto", "Adapt to the page"], ["fill", "Marker fill"], ["underline", "Underline"]] as const).map(([v, l]) => <button key={v} aria-pressed={(s.markStyle ?? "auto") === v} onClick={() => { const n = { ...s, markStyle: v }; setS(n); save(n); }}>{l}</button>)}</div>
              <span style={{ fontSize: 13, fontWeight: 500, marginTop: 4 }}>Strength</span>
              <div className="seg">{([["soft", "Soft"], ["medium", "Medium"], ["strong", "Strong"]] as const).map(([v, l]) => <button key={v} aria-pressed={(s.markStrength ?? "soft") === v} onClick={() => { const n = { ...s, markStrength: v }; setS(n); save(n); }}>{l}</button>)}</div>
              <div className="grid2" style={{ ["--lumen-a" as string]: ({ soft: ".26", medium: ".38", strong: ".55" })[s.markStrength ?? "soft"], ["--lumen-da" as string]: ({ soft: ".15", medium: ".24", strong: ".34" })[s.markStrength ?? "soft"] }}>
                <div className="mark-demo light"><span className="eyebrow">Light page</span><p>Most reading is sorting. <mark className={`m-${s.markStyle === "underline" ? "ul" : "fill"} m-iris`}>A margin note is a conversation</mark> with yourself.</p></div>
                <div className="mark-demo dark"><span className="eyebrow" style={{ color: "#8b8b93" }}>Dark page</span><p>Most reading is sorting. <mark className={`m-${s.markStyle === "underline" ? "ul" : s.markStyle === "fill" ? "fill" : "tint"} m-iris`}>A margin note is a conversation</mark> with yourself.</p></div>
              </div>
            </div>
          </>
        )}

        {section === "toolbar" && (
          <>
            <h1 style={{ fontSize: 28 }}><span className="lead">Selection</span> toolbar</h1>
            <p className="muted" style={{ margin: 0 }}>A tiny bar that appears when you select text. Pick what it shows and in which order.</p>
            <div className="surface stack">
              <div className="row"><b style={{ flex: 1, color: "var(--ink)" }}>Show the toolbar when I select text</b><button className="switch" role="switch" aria-checked={tb.enabled} onClick={() => setTb({ enabled: !tb.enabled })}><span /></button></div>
              <div className="row"><span style={{ flex: 1 }}>Show words next to icons</span><button className="switch" role="switch" aria-checked={tb.labels} onClick={() => setTb({ labels: !tb.labels })}><span /></button></div>
              <div className="eyebrow">Preview</div>
              <div className="preview-stage">
                <p style={{ fontFamily: "Newsreader, Georgia, serif", fontSize: 16, margin: 0, color: "var(--ink-2)" }}>Most reading online is sorting. <span style={{ background: "#cfe2ff", borderRadius: 3 }}>Sorting is useful.</span> It is not the same thing as reading.</p>
                <div className={`preview-bar${tb.labels ? " labels" : ""}`} style={{ opacity: tb.enabled ? 1 : 0.35 }}>
                  {tb.actions.map((a) => <span key={a} className={`pa${a === "highlight" ? " hl" : ""}`}><Svg a={a} />{tb.labels && <span>{LABEL[a]}</span>}</span>)}
                  <span className="psep" /><span className="pa" style={{ opacity: 0.55 }}><Svg a="more" /></span>
                </div>
              </div>
            </div>
            <div className="surface stack" style={{ gap: 6 }}>
              <div className="eyebrow">Actions</div>
              {ordered.map((a) => {
                const on = tb.actions.includes(a);
                return (
                  <div key={a} className="list-row" style={{ opacity: on ? 1 : 0.6 }}>
                    <span className="tile sm" style={{ background: on ? "linear-gradient(180deg,#2b2b30,#0e0e10)" : "var(--well)", color: on ? "#fff" : "var(--ink-3)", boxShadow: on ? undefined : "none" }}><Svg a={a} /></span>
                    <span style={{ flex: 1, fontSize: 14 }}>{ACTION_INFO[a][1]}</span>
                    {on && <><button className="icon-btn" title="Move up" onClick={() => move(a, -1)}>↑</button><button className="icon-btn" title="Move down" onClick={() => move(a, 1)}>↓</button></>}
                    <button className="switch" role="switch" aria-checked={on} onClick={() => toggle(a)}><span /></button>
                  </div>
                );
              })}
            </div>
            <div className="surface stack">
              <div className="eyebrow">Turned off on</div>
              {tb.disabledSites.length === 0 ? <span className="small muted">Nowhere. Use ⋯ on the toolbar to turn it off for a site.</span> : (
                <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>{tb.disabledSites.map((h) => <button key={h} className="chip" style={{ border: 0, cursor: "pointer" }} onClick={() => setTb({ disabledSites: tb.disabledSites.filter((x) => x !== h) })}>{h} ✕</button>)}</div>
              )}
            </div>
          </>
        )}

        {section === "helper" && (
          <>
            <h1 style={{ fontSize: 28 }}><span className="lead">Page</span> helper</h1>
            <p className="muted" style={{ margin: 0 }}>A small lamp at the edge of the page: save the page, summarise it, or ask about it without leaving. Name it whatever you like.</p>
            <div className="surface stack">
              <label>Name<input value={hp.name} maxLength={16} onChange={(e) => setS({ ...s, helper: { ...hp, name: e.target.value } })} onBlur={() => save()} /></label>
              <div className="stack" style={{ gap: 6 }}><span style={{ fontSize: 13, fontWeight: 500 }}>Where it appears</span>
                <div className="seg">{([["off", "Never"], ["chosen", "Sites I choose"], ["everywhere", "Everywhere"]] as const).map(([v, l]) => <button key={v} aria-pressed={hp.mode === v} onClick={() => setHp({ mode: v })}>{l}</button>)}</div>
              </div>
              <div className="stack" style={{ gap: 6 }}><span style={{ fontSize: 13, fontWeight: 500 }}>Side</span>
                <div className="seg">{([["right", "Right"], ["left", "Left"]] as const).map(([v, l]) => <button key={v} aria-pressed={hp.side === v} onClick={() => setHp({ side: v })}>{l}</button>)}</div>
              </div>
              {hp.mode === "chosen" && (
                <div className="stack" style={{ gap: 6 }}>
                  <span className="eyebrow">Sites</span>
                  {hp.sites.length === 0 ? <span className="small muted">None yet. Turn it on from the popup, the panel, or right click → Show {hp.name} on this site.</span> :
                    <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>{hp.sites.map((h) => <button key={h} className="chip" style={{ border: 0, cursor: "pointer" }} onClick={() => setHp({ sites: hp.sites.filter((x) => x !== h) })}>{h} ✕</button>)}</div>}
                </div>
              )}
              {hp.mode === "everywhere" && hp.hiddenOn.length > 0 && (
                <div className="stack" style={{ gap: 6 }}><span className="eyebrow">Hidden on</span><div className="row" style={{ flexWrap: "wrap", gap: 6 }}>{hp.hiddenOn.map((h) => <button key={h} className="chip" style={{ border: 0, cursor: "pointer" }} onClick={() => setHp({ hiddenOn: hp.hiddenOn.filter((x) => x !== h) })}>{h} ✕</button>)}</div></div>
              )}
            </div>
          </>
        )}

        {section === "account" && (
          <>
            <h1 style={{ fontSize: 28 }}><span className="lead">Your</span> account</h1>
            <div className="surface stack">
              <div className="row" style={{ flexWrap: "wrap" }}>
                <button className="key lamp" onClick={async () => { await save(); chrome.tabs.create({ url: `${s.apiBase.replace(/\/$/, "")}/app/integrations?connect=extension` }); }}>Connect with Lumen</button>
                <span className="small muted">Opens the dashboard and connects in one click.</span>
              </div>
              {s.token && <span className="chip mint" style={{ justifySelf: "start" }}>Connected · {s.apiBase.replace(/^https?:\/\//, "")}</span>}
              <label>Lumen address<input value={s.apiBase} onChange={(e) => set("apiBase", e.target.value)} /></label>
              <label>Access token<input type="password" value={s.token} onChange={(e) => set("token", e.target.value)} placeholder="lum_…" /></label>
              <div className="row"><span style={{ flex: 1 }}>Send new highlights to the target collection's note right away</span><button className="switch" role="switch" aria-checked={s.autoSend} onClick={() => { const n = { ...s, autoSend: !s.autoSend }; setS(n); save(n); }}><span /></button></div>
              <div className="row"><button className="key" onClick={() => save()}>{saved ? "Saved ✓" : "Save"}</button><button className="key ghost" onClick={run}>Test connection</button>{test && <span className={`chip ${test.ok ? "mint" : "peach"}`}>{test.message}</span>}</div>
            </div>
          </>
        )}

        {section === "model" && (
          <>
            <h1 style={{ fontSize: 28 }}><span className="lead">Which</span> model answers</h1>
            <p className="muted" style={{ margin: 0 }}>Used by Explain, Expand, Summary and Define on the page. Asking your library in the side panel always goes through Lumen, because that is where your bank lives.</p>
            <div className="surface stack">
              <div className="seg">{PROVIDERS.map((p) => <button key={p.id} aria-pressed={s.provider === p.id} onClick={async () => {
                if (p.id === "claude") {
                  // ask for native messaging only when someone actually wants the local Claude helper
                  const ok = await chrome.permissions.request({ permissions: ["nativeMessaging"] }).catch(() => false);
                  if (!ok) return;
                }
                set("provider", p.id);
              }}>{p.label}</button>)}</div>
              <p className="small muted" style={{ margin: 0 }}>{PROVIDERS.find((p) => p.id === s.provider)?.hint}</p>
              {s.provider === "ollama" && (<>
                <label>Ollama address<input value={s.ollamaBaseUrl} onChange={(e) => set("ollamaBaseUrl", e.target.value)} /></label>
                <label>Model<input value={s.model} onChange={(e) => set("model", e.target.value)} placeholder="llama3" /></label>
              </>)}
              {s.provider === "openai" && (<>
                <label>Base URL<input value={s.openaiBaseUrl} onChange={(e) => set("openaiBaseUrl", e.target.value)} /></label>
                <label>API key<input type="password" value={s.openaiKey} onChange={(e) => set("openaiKey", e.target.value)} /></label>
                <label>Model<input value={s.model} onChange={(e) => set("model", e.target.value)} placeholder="gpt-4o-mini" /></label>
              </>)}
              {s.provider === "claude" && (
                <div className="seg">{[["haiku", "Haiku · fastest"], ["sonnet", "Sonnet"], ["opus", "Opus · deepest"]].map(([v, l]) => <button key={v} aria-pressed={s.claudeModel === v} onClick={() => set("claudeModel", v)}>{l}</button>)}</div>
              )}
              <div className="row"><button className="key" onClick={() => save()}>{saved ? "Saved ✓" : "Save"}</button><button className="key ghost" onClick={run}>Test</button>{test && <span className={`chip ${test.ok ? "mint" : "peach"}`}>{test.message}</span>}</div>
            </div>
          </>
        )}

        {section === "obsidian" && (
          <>
            <h1 style={{ fontSize: 28 }}><span className="lead">Obsidian</span> sync</h1>
            <div className="surface stack">
              <p className="small muted" style={{ margin: 0 }}>Install the Local REST API community plugin in Obsidian and paste its key. It never leaves this browser. Which note to write to is set per collection.</p>
              <label>Local REST API key<input type="password" value={s.obsidianKey} onChange={(e) => set("obsidianKey", e.target.value)} onBlur={() => save()} /></label>
            </div>
          </>
        )}

        {section === "more" && (
          <>
            <h1 style={{ fontSize: 28 }}><span className="lead">Gentle</span> reminders</h1>
            <div className="surface stack">
              <div className="row"><span style={{ flex: 1 }}>Remind me about articles I started and left (at most once a day per article)</span><button className="switch" role="switch" aria-checked={s.reminders} onClick={() => { const n = { ...s, reminders: !s.reminders }; setS(n); save(n); }}><span /></button></div>
              <div className="small muted">Shortcuts: Alt+Shift+H highlight · Alt+Shift+S save page · Alt+Shift+L open the panel. Change them at chrome://extensions/shortcuts.</div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
