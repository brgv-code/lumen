import { useEffect, useState } from "react";
import { Bell, Download, Heart, Highlighter, Keyboard, MousePointerClick, PanelRight, Puzzle, Sparkles, Settings as Gear } from "lucide-react";
import { extension, STORE_URL } from "../../lib/extension";
import { PageHero } from "../../components/PageHero";
import { ExtensionPanel } from "./Integrations";

const FEATURES: [JSX.Element, string, string, string][] = [
  [<Highlighter />, "tile--lamp", "Selection toolbar", "Select text: highlight, note, explain, expand, summary, save, copy with link."],
  [<PanelRight />, "tile--iris", "Floating panel", "Ask about the page and your library without leaving it. Alt+Shift+L."],
  [<Sparkles />, "tile--peach", "Lumi, the page helper", "An optional lamp on the sites you choose: save, summarise, ask."],
  [<Heart />, "tile--mint", "Follow blogs", "One click on any blog; hear when it publishes."],
  [<MousePointerClick />, "tile--sky", "Right click", "Save page or link, Send to Lumen ▸ any collection."],
  [<Bell />, "tile--ink", "Reminders", "A gentle nudge for articles you started and left."],
];
const KEYS: [string, string][] = [["Alt+Shift+H", "Highlight the selection"], ["Alt+Shift+S", "Save this page"], ["Alt+Shift+L", "Open or close the panel"], ["Esc", "Close the toolbar, card or panel"]];

export default function ExtensionPage() {
  const [ext, setExt] = useState<{ ok: boolean; version: string; connected: boolean } | null | undefined>(undefined);
  const [latest, setLatest] = useState<string | null>(null);
  useEffect(() => {
    extension.ping().then(setExt);
    fetch("/api/health").then((r) => r.json()).then((j) => setLatest(j.extension ?? null)).catch(() => {});
  }, []);
  const outdated = ext && latest && ext.version !== latest;

  return (
    <div className="page">
      <PageHero pill={<><Puzzle size={13} /> Extension</>} lead="Lumen on" pay="every page."
        sub={ext ? `Installed${ext.connected ? " and connected" : ""} · v${ext.version}${outdated ? ` · v${latest} is available` : ""}` : "Highlight, ask and save on any site, without leaving it."}
        mesh="mesh-sky" tiles={[["tile--sky", <Puzzle />], ["tile--lamp", <Highlighter />], ["tile--iris", <PanelRight />], ["tile--mint", <Heart />]]}
        actions={<>
          {ext && <button className="key key--ghost key--sm" onClick={() => extension.openOptions()}><Gear size={14} /> Extension settings</button>}
          {STORE_URL
            ? <a className="key key--lamp key--sm" href={STORE_URL} target="_blank" rel="noreferrer"><Download size={14} /> {ext ? "Chrome Web Store" : "Add to Chrome"}</a>
            : <a className="key key--lamp key--sm" href="/downloads/lumen-extension.zip" download><Download size={14} /> Download{latest ? ` v${latest}` : ""}</a>}
        </>} />

      {outdated && (
        <section className="card-flat row" style={{ padding: 14, background: "var(--lamp-tint)", flexWrap: "wrap" }}>
          <span style={{ flex: 1, minWidth: 240 }} className="small"><b style={{ color: "var(--ink)" }}>Update available.</b> You have v{ext!.version}; v{latest} is out. {STORE_URL ? "Chrome updates store extensions on its own within a few hours; to update now, press Update on your extensions page with Developer mode on." : "If you installed from a zip, remove Lumen and load the new folder unpacked; if you load it from a folder, press reload on your extensions page."}</span>
        </section>
      )}

      <ExtensionPanel />

      <section className="panel">
        <h2 style={{ marginBottom: 14 }}>What it does</h2>
        <div className="cards" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
          {FEATURES.map(([icon, tile, t, d]) => (
            <div key={t} className="card-flat stack" style={{ padding: 16, gap: 8 }}><span className={`tile ${tile}`}>{icon}</span><b style={{ color: "var(--ink)" }}>{t}</b><span className="small muted">{d}</span></div>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="row" style={{ marginBottom: 12 }}><span className="tile tile--sm tile--ink"><Keyboard /></span><h2>Shortcuts</h2></div>
        <div className="stack" style={{ gap: 6 }}>{KEYS.map(([k, d]) => <div key={k} className="row small"><span className="kbd" style={{ minWidth: 92, textAlign: "center" }}>{k}</span><span>{d}</span></div>)}</div>
        <p className="small muted" style={{ marginTop: 10 }}>Change them at chrome://extensions/shortcuts (or brave://extensions/shortcuts).</p>
      </section>
    </div>
  );
}
