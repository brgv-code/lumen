import { useEffect, useState } from "react";
import { send } from "../../lib/msg";
import type { Provider, Settings } from "../../lib/types";

const PROVIDERS: { id: Provider; label: string; hint: string }[] = [
  { id: "lumen", label: "Lumen", hint: "Hosted on Cloudflare Workers AI. Needs your Lumen token." },
  { id: "ollama", label: "Ollama", hint: "Local. Start it with OLLAMA_ORIGINS='chrome-extension://*' ollama serve" },
  { id: "openai", label: "OpenAI compatible", hint: "OpenAI, Groq, Mistral, LM Studio: any /v1/chat/completions API." },
  { id: "claude", label: "Claude (local CLI)", hint: "Runs claude -p through the Lumen helper. Install it once with apps/native-host/install.sh" },
];

export default function Options() {
  const [s, setS] = useState<Settings | null>(null);
  const [test, setTest] = useState<{ ok: boolean; message: string } | null>(null);
  const [saved, setSaved] = useState(false);
  useEffect(() => { send<{ settings: Settings }>({ type: "GET_SETTINGS" }).then((r) => setS(r.settings)); }, []);
  if (!s) return null;

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => { setS({ ...s, [k]: v }); setSaved(false); setTest(null); };
  const save = async () => { const r = await send<{ settings: Settings }>({ type: "SAVE_SETTINGS", settings: s }); setS(r.settings); setSaved(true); };
  const run = async () => { await save(); setTest(await send({ type: "TEST_CONNECTION" })); };

  return (
    <div style={{ maxWidth: 680, margin: "40px auto", padding: "0 16px" }} className="stack">
      <div className="row"><img src="/icons/icon48.png" width={36} height={36} alt="" style={{ borderRadius: 10 }} /><h1 style={{ fontSize: 30 }}><span className="lead">Lumen</span> settings</h1></div>

      <section className="surface stack" style={{ padding: 22 }}>
        <h2 style={{ fontSize: 17 }}>Account</h2>
        <div className="row" style={{ flexWrap: "wrap" }}>
          <button className="key lamp" onClick={async () => { await save(); chrome.tabs.create({ url: `${s.apiBase.replace(/\/$/, "")}/app/integrations?connect=extension` }); }}>Connect with Lumen</button>
          <span className="small muted">Opens the dashboard and connects in one click. Or paste a token below.</span>
        </div>
        {s.token && <span className="chip mint" style={{ justifySelf: "start" }}>Connected · {s.apiBase.replace(/^https?:\/\//, "")}</span>}
        <label>Lumen address<input value={s.apiBase} onChange={(e) => set("apiBase", e.target.value)} placeholder="https://lumen.brgv95.workers.dev" /></label>
        <label>Access token<input type="password" value={s.token} onChange={(e) => set("token", e.target.value)} placeholder="lum_…" /></label>
        <label className="row" style={{ display: "flex", gap: 10 }}>
          <input type="checkbox" checked={s.autoSend} onChange={(e) => set("autoSend", e.target.checked)} style={{ width: 18, height: 18 }} />
          Send new highlights to the target collection's destination right away
        </label>
        <label className="row" style={{ display: "flex", gap: 10 }}>
          <input type="checkbox" checked={s.reminders} onChange={(e) => set("reminders", e.target.checked)} style={{ width: 18, height: 18 }} />
          Remind me about articles I started and left (a notification, at most once a day per article)
        </label>
      </section>

      <section className="surface stack" style={{ padding: 22 }}>
        <h2 style={{ fontSize: 17 }}>Model</h2>
        <div className="seg">{PROVIDERS.map((p) => <button key={p.id} aria-pressed={s.provider === p.id} onClick={() => set("provider", p.id)}>{p.label}</button>)}</div>
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
          <div className="stack" style={{ gap: 6 }}><span style={{ fontSize: 13, fontWeight: 500 }}>Claude model</span>
            <div className="seg">{[["haiku", "Haiku · fastest"], ["sonnet", "Sonnet"], ["opus", "Opus · deepest"]].map(([v, l]) => <button key={v} aria-pressed={s.claudeModel === v} onClick={() => set("claudeModel", v)}>{l}</button>)}</div>
          </div>
        )}
      </section>

      <section className="surface stack" style={{ padding: 22 }}>
        <h2 style={{ fontSize: 17 }}>Obsidian</h2>
        <p className="small muted" style={{ margin: 0 }}>Install the Local REST API community plugin in Obsidian and paste its key. The key never leaves this browser. Which note to write to is set per collection in the dashboard.</p>
        <label>Local REST API key<input type="password" value={s.obsidianKey} onChange={(e) => set("obsidianKey", e.target.value)} /></label>
      </section>

      <div className="row">
        <button className="key lamp" onClick={save}>{saved ? "Saved ✓" : "Save settings"}</button>
        <button className="key ghost" onClick={run}>Test connection</button>
        {test && <span className={`chip ${test.ok ? "mint" : "peach"}`}>{test.message}</span>}
      </div>
    </div>
  );
}
