import { useRef, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight, BookOpen, Check, Copy, FileText, Flame, Github, Highlighter, Library, Link2, Lock, MessageSquareText,
  NotebookPen, Puzzle, Send, Sparkles, Webhook, Wand2, Cpu, Download, Quote, Bot, Search, KeyRound,
  Radar as RadarIcon, BellRing, Users, BarChart3, Clock,
} from "lucide-react";
import { SiteFooter } from "../components/SiteFooter";
import { AppIcon, Logo, Segmented, Sparkle, useToast } from "../components/ui";
import { useReveal } from "../lib/hooks";
import { api } from "../lib/api";
import "../styles/landing.css";

type Tab = "highlight" | "ask" | "send" | "library" | "spark" | "agents";

const TABS: { value: Tab; label: string }[] = [
  { value: "highlight", label: "Highlight" },
  { value: "ask", label: "Ask" },
  { value: "send", label: "Send anywhere" },
  { value: "library", label: "Library" },
  { value: "spark", label: "Spark" },
  { value: "agents", label: "Agents" },
];

const FEATURE: Record<Tab, { pill: string; lead: string; pay: string; body: string; mesh: string; ticks: [ReactNode, string, string][] }> = {
  highlight: {
    pill: "Highlight without a mode",
    lead: "Mark it,",
    pay: "keep copying.",
    body: "Select text and a small toolbar appears. Pick a colour, add a margin note, or copy the passage with a link that jumps straight back to it. Ctrl+C always works.",
    mesh: "mesh-lamp",
    ticks: [
      [<Highlighter />, "Five marker colours that mean something", "ink"],
      [<MessageSquareText />, "A margin note on every highlight", "ink"],
      [<Copy />, "Copy with citation and a deep link", "ink"],
      [<Lock />, "Highlights reappear when you come back", "ink"],
    ],
  },
  ask: {
    pill: "A reading companion",
    lead: "Ask the margin,",
    pay: "not a new tab.",
    body: "Explain, define, simplify or ask anything about a passage, streamed in place. Use Lumen's model, Ollama on your laptop, any OpenAI compatible API, or Claude through your own CLI.",
    mesh: "mesh-iris",
    ticks: [
      [<Wand2 />, "Explain, define, simplify, summarise", "ink"],
      [<Cpu />, "Pick the model per question", "ink"],
      [<Lock />, "Local models keep text on your machine", "ink"],
      [<Sparkles />, "Answers saved next to the highlight", "ink"],
    ],
  },
  send: {
    pill: "Platform agnostic",
    lead: "Your notes app,",
    pay: "your choice.",
    body: "Point a collection at a note in Obsidian, a Notion page, a markdown file or a webhook. New highlights flow there, and Lumen remembers what it already sent, so nothing is ever written twice.",
    mesh: "mesh-mint",
    ticks: [
      [<NotebookPen />, "Obsidian, Notion, Markdown, webhooks", "ink"],
      [<Send />, "Pick the target note while you read", "ink"],
      [<Check />, "Only new highlights are appended", "ink"],
      [<Download />, "Export everything, any time", "ink"],
    ],
  },
  library: {
    pill: "Bookmarks that get read",
    lead: "Save it today,",
    pay: "read it properly.",
    body: "Every saved link becomes a clean, distraction free page in a warm serif. Inbox, reading, done: progress is tracked as you scroll, and finishing an article feels like it should.",
    mesh: "mesh-sky",
    ticks: [
      [<BookOpen />, "Reader view in a serif made for reading", "ink"],
      [<Library />, "Collections, tags and favourites", "ink"],
      [<Link2 />, "Save by link, extension or API", "ink"],
      [<FileText />, "PDFs next (in progress)", "ink"],
    ],
  },
  spark: {
    pill: "From reading to writing",
    lead: "Notice what",
    pay: "you keep circling.",
    body: "Spark lays your own highlights side by side and suggests the posts, threads and talks they are pointing at, each linked to the sources it came from.",
    mesh: "mesh-peach",
    ticks: [
      [<Sparkles />, "Ideas built only from your highlights", "ink"],
      [<Quote />, "Every idea cites its sources", "ink"],
      [<NotebookPen />, "Outline you can paste into a draft", "ink"],
      [<Flame />, "Glow for ideas you keep", "ink"],
    ],
  },
  agents: {
    pill: "Connect your agent",
    lead: "Your library,",
    pay: "in every agent.",
    body: "Lumen is an MCP server. Connect Claude Code, Claude Desktop or Cursor in one step, then ask it to review your week, find what is trending in your topics, quote your own highlights back, or save what it finds.",
    mesh: "mesh-iris",
    ticks: [
      [<Bot />, "Claude, Cursor and any MCP client", "ink"],
      [<Search />, "Search, read, highlight and save", "ink"],
      [<RadarIcon />, "Trending topics, watched for you", "ink"],
      [<KeyRound />, "One revocable key per agent", "ink"],
    ],
  },
};

export default function Landing() {
  const ref = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<Tab>("highlight");
  const nav = useNavigate();
  const toast = useToast();
  useReveal(ref);

  const tryDemo = async () => {
    try {
      await api.demo();
      nav("/app");
    } catch (e) {
      toast((e as Error).message, "err");
    }
  };

  const f = FEATURE[tab];

  return (
    <div className="lp" ref={ref}>
      <nav className="lp-nav">
        <div className="lp-wrap lp-nav__in">
          <Link to="/" aria-label="Lumen home"><Logo /></Link>
          <div className="lp-nav__links">
            <a href="#features">Features</a>
            <a href="#agents">Agents</a>
            <a href="/compare">Compare</a>
            <a href="/docs">Docs</a>
            <a href="/changelog">Changelog</a>
          </div>
          <div className="row">
            <Link to="/login" className="key key--quiet key--sm">Log in</Link>
            <Link to="/login" className="key key--lamp key--sm">Start free</Link>
          </div>
        </div>
      </nav>

      <main className="lp-wrap">
        {/* HERO */}
        <section className="surface lp-hero">
          <div className="reveal" style={{ ["--i" as string]: 0 }}>
            <span className="label-pill"><Sparkle width={12} height={12} style={{ color: "var(--lamp)" }} /> Reading, but joyful</span>
            <h1 className="display">
              <span className="lead-in">Read slowly.</span>{" "}
              <span className="tile tile--inline tile--lamp" aria-hidden="true"><Highlighter /></span>
              <br />
              <span className="payoff">Keep what glows.</span>
            </h1>
            <p className="sub">
              Highlight, ask, and keep notes on anything you read, then send it to Obsidian, Notion or plain markdown. One calm place for everything you bookmark and read.
            </p>
            <div className="ctas">
              <Link to="/login" className="key key--lamp key--lg">Light your first lamp, free <ArrowRight size={16} /></Link>
              <button className="key key--ghost key--lg" onClick={tryDemo}>Explore the demo</button>
            </div>
            <p className="small muted" style={{ marginTop: 16 }}>Free plan forever · every Pro feature for your first 7 days · no card</p>
          </div>

          <div className="paper-stage reveal" style={{ ["--i" as string]: 2 }} aria-hidden="true">
            <div className="paper">
              <h4>Reading slowly on purpose</h4>
              <div className="by">Lumen sample library · 4 min</div>
              <p>
                Most of what we call reading online is really sorting. <mark className="hl-sun">Sorting is useful. It is just not the same thing as reading.</mark>
              </p>
              <p>
                Reading slowly is about letting a sentence finish its work. <mark className="hl-iris">A margin note is a conversation you can have with yourself a year later.</mark>
              </p>
              <p>
                <mark className="hl-mint">Slow reading compounds.</mark> The notes from ten good articles have already turned into two drafts.
              </p>
            </div>
            <div className="mini-toolbar bob" style={{ left: "16%", top: "26%", ["--delay" as string]: "-1s" }}>
              <span className="sw swatch-sun" /><span className="sw swatch-mint" /><span className="sw swatch-iris" /><span className="sw swatch-peach" />
              <span className="sep" />
              <span className="act on">Explain</span><span className="act">Note</span><span className="act">Copy</span>
            </div>
            <span className="tag bob" style={{ ["--c" as string]: "#c45100", ["--t" as string]: "#fff3dd", right: "4%", top: "8%", ["--delay" as string]: "-2s" }}>→ Obsidian</span>
            <span className="tag bob" style={{ ["--c" as string]: "#6d5bff", ["--t" as string]: "#f1efff", left: "0%", top: "62%", ["--delay" as string]: "-3.5s" }}>Explain ✦</span>
            <span className="tag bob" style={{ ["--c" as string]: "#14a86f", ["--t" as string]: "#e2f7ec", right: "10%", bottom: "6%", ["--delay" as string]: "-0.5s" }}>Sent once</span>
          </div>
        </section>

        <div className="lp-strip reveal">
          <span>Sends to</span>
          <span className="row"><span className="tile tile--xs tile--iris"><NotebookPen /></span><b>Obsidian</b></span>
          <span className="row"><span className="tile tile--xs tile--ink"><FileText /></span><b>Notion</b></span>
          <span className="row"><span className="tile tile--xs tile--sky"><Download /></span><b>Markdown</b></span>
          <span className="row"><span className="tile tile--xs tile--mint"><Webhook /></span><b>Webhooks</b></span>
          <span>· thinks with</span>
          <span className="row"><span className="tile tile--xs tile--lamp"><Cpu /></span><b>Ollama, OpenAI, Claude</b></span>
        </div>

        {/* FEATURES */}
        <section className="lp-sec" id="features">
          <div className="lp-head reveal">
            <div>
              <span className="label-pill">Everything a reader needs</span>
              <h2 className="h2">
                <span className="lead-in">One reading tool.</span> <span className="payoff">Every place you think.</span>
              </h2>
            </div>
            <Link to="/login" className="key key--lg">Start free, 7 days of Pro <ArrowRight size={16} /></Link>
          </div>

          <div className="lp-tabs reveal">
            <Segmented label="Features" options={TABS} value={tab} onChange={setTab} />
          </div>

          <div className="lp-feature" key={tab}>
            <div className={`halftone lp-panel ${f.mesh}`}>
              <FeatureCard tab={tab} />
            </div>
            <div className="lp-feature__copy fade-in">
              <span className="label-pill">{f.pill}</span>
              <h3 className="h3"><span className="lead-in">{f.lead}</span> <span className="payoff">{f.pay}</span></h3>
              <p>{f.body}</p>
              <ul className="ticks">
                {f.ticks.map(([icon, text]) => (
                  <li key={text}><span className="tile tile--sm tile--ink">{icon}</span>{text}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* BENTO */}
        <section className="lp-sec" id="how">
          <div className="reveal" style={{ textAlign: "center" }}>
            <span className="label-pill">How it works</span>
            <h2 className="h2" style={{ marginTop: 16 }}>
              <span className="lead-in">Capture, understand,</span> <span className="payoff">send.</span>
            </h2>
          </div>
          <div className="bento">
            <div className="cell reveal" style={{ ["--i" as string]: 0 }}>
              <div className="cell__head"><h3>Capture</h3><p>Highlight anything, in five colours.</p></div>
              <div className="cell__body edge-fade" style={{ padding: "20px 0" }}>
                <div className="marquee">
                  {[0, 1, 2].map((r) => (
                    <div className="marquee__row" key={r}>
                      {[...QUOTES.slice(r * 4, r * 4 + 4), ...QUOTES.slice(r * 4, r * 4 + 4)].map((q, k) => (
                        <span className="qpill" key={k}><i className={`swatch-${q[1]}`} />{q[0]}</span>
                      ))}
                    </div>
                  ))}
                </div>
                <span className="tile tile--xl tile--lamp bob" style={{ position: "absolute", left: "50%", top: "50%", marginLeft: -42, marginTop: -42, animation: "glow 3s ease-in-out infinite" }}>
                  <Highlighter />
                </span>
              </div>
            </div>
            <div className="cell gridlines reveal" style={{ ["--i" as string]: 1 }}>
              <div className="cell__head"><h3>Understand</h3><p>Ask the margin, in your own model.</p></div>
              <div className="cell__body">
                <div className="card" style={{ width: "min(300px, 100%)", padding: 14, background: "var(--iris-tint)", position: "relative" }}>
                  <div className="row" style={{ marginBottom: 12 }}>
                    <span className="tile tile--sm tile--iris"><Sparkles /></span>
                    <b style={{ color: "var(--ink)" }}>Explain</b>
                    <span className="spacer" />
                    <span className="chip">Ollama · llama3</span>
                  </div>
                  <div className="card-flat" style={{ padding: 12 }}>
                    <div className="eyebrow">Key idea</div>
                    <div style={{ color: "var(--ink)", fontWeight: 500, marginTop: 2 }}>Notes record why it mattered</div>
                  </div>
                  <div className="row" style={{ marginTop: 10, flexWrap: "wrap", gap: 6 }}>
                    <span className="chip" style={{ background: "var(--raised)" }}>Reading habit</span>
                    <span className="chip" style={{ background: "var(--raised)" }}>Memory</span>
                  </div>
                  <div className="row small" style={{ marginTop: 14 }}><span className="muted">Clarity</span><span className="spacer" /><b style={{ color: "var(--iris)" }}>92%</b></div>
                  <div style={{ height: 6, borderRadius: 6, background: "var(--raised)", marginTop: 6, overflow: "hidden" }}>
                    <div style={{ width: "92%", height: "100%", background: "var(--key-iris)", borderRadius: 6 }} />
                  </div>
                </div>
              </div>
            </div>
            <div className="cell cell--wide gridlines reveal" style={{ ["--i" as string]: 2 }}>
              <div className="cell__body" style={{ paddingTop: 10 }}>
                <Orbit />
              </div>
              <div className="cell__head" style={{ paddingBottom: 30 }}><h3>Send</h3><p>Each collection points at a note. New highlights go there once, never twice.</p></div>
            </div>
          </div>
        </section>

        {/* DAY */}
        <section className="lp-sec" id="agents">
          <div className="lp-head reveal">
            <div>
              <span className="label-pill">One place for everything you read</span>
              <h2 className="h2"><span className="lead-in">Your reading day,</span> <span className="payoff">already planned.</span></h2>
            </div>
            <p className="muted" style={{ maxWidth: 400 }}>A plan that fits the time you have, nudges for what you left half read, what is trending in your topics, what readers like you save, and the numbers behind it all. Your agent can see all of it too.</p>
          </div>
          <div className="day-grid">
            <div className="cell reveal" style={{ ["--i" as string]: 0 }}>
              <div className="row"><span className="tile tile--sm tile--lamp"><Clock /></span><b>Today's reads</b><span className="spacer" /><span className="chip chip--lamp">18 of 24 min</span></div>
              {["Reading slowly on purpose · continue, 42%", "Designing for calm · 3 min", "Small models, sharp tools · 4 min"].map((t, k) => <div key={t} className="day-row"><span className="mono muted">{k + 1}</span>{t}</div>)}
            </div>
            <div className="cell reveal" style={{ ["--i" as string]: 1 }}>
              <div className="row"><span className="tile tile--sm tile--lamp"><BellRing /></span><b>Reminders</b></div>
              <div className="day-row" style={{ background: "var(--lamp-tint)" }}>You were 42% through “Reading slowly on purpose”. 3 min to finish.</div>
              <div className="row" style={{ gap: 6 }}><span className="chip chip--lamp">Continue</span><span className="chip">Snooze 2 days</span></div>
            </div>
            <div className="cell reveal" style={{ ["--i" as string]: 2 }}>
              <div className="row"><span className="tile tile--sm tile--sky"><RadarIcon /></span><b>Radar</b><span className="spacer" /><span className="chip chip--sky">#obsidian</span></div>
              <div className="day-row">Trending this week in the topics you read, from Hacker News and dev.to.</div>
              <div className="row" style={{ gap: 6, flexWrap: "wrap" }}><span className="chip chip--sky">#llm</span><span className="chip chip--sky">#design systems</span><span className="chip chip--sky">#reading</span></div>
            </div>
            <div className="cell reveal" style={{ ["--i" as string]: 3 }}>
              <div className="row"><span className="tile tile--sm tile--mint"><Users /></span><b>Readers like you</b></div>
              <div className="day-row" style={{ display: "block" }}>“One note per project”<br /><span className="small muted">4 readers like you saved this</span></div>
              <p className="small muted">Anonymous and aggregate: never who, never your notes.</p>
            </div>
            <div className="cell cell--wide reveal" style={{ ["--i" as string]: 4 }}>
              <div className="row"><span className="tile tile--sm tile--iris"><BarChart3 /></span><b>Analytics</b><span className="spacer" /><span className="small muted">12 weeks</span></div>
              <div className="heat">{Array.from({ length: 84 }, (_, k) => { const v = ((k * 37) % 11) / 10; return <span key={k} style={{ background: v > 0.25 ? `color-mix(in srgb, #ff8a1f ${Math.round(20 + v * 80)}%, var(--well))` : "var(--well)" }} />; })}</div>
            </div>
            <div className="cell cell--wide reveal" style={{ ["--i" as string]: 5, background: "var(--iris-tint)" }}>
              <div className="row"><span className="tile tile--sm tile--iris"><Bot /></span><b>Connect your agent</b></div>
              <pre className="mono day-code">{`claude mcp add --transport http lumen \
  ${typeof location !== "undefined" ? location.origin : "https://lumen.app"}/mcp \
  --header "Authorization: Bearer lum_…"`}</pre>
              <a className="key key--iris key--sm" href="/docs/mcp" style={{ justifySelf: "start" }}>MCP docs</a>
            </div>
          </div>
        </section>

        {/* GLOW */}
        <section className="lp-sec" id="glow">
          <div className="lp-head reveal">
            <div>
              <span className="label-pill"><Flame size={13} style={{ color: "var(--lamp)" }} /> Glow</span>
              <h2 className="h2"><span className="lead-in">A lamp,</span> <span className="payoff">not a treadmill.</span></h2>
            </div>
            <p className="muted" style={{ maxWidth: 380 }}>Reading earns a little light. Finish an article, leave a note, keep an idea. A streak is a lamp left on in the window, never a guilt trip.</p>
          </div>
          <div className="glow-grid">
            <div className="surface reveal" style={{ padding: 28, ["--i" as string]: 0 }}>
              <div className="row"><span className="eyebrow">This week</span><span className="spacer" /><span className="chip chip--lamp"><Flame size={12} /> 6 day streak</span></div>
              <div className="bars" style={{ marginTop: 22 }}>
                {[12, 26, 8, 30, 18, 24, 21].map((v, k) => (
                  <div key={k}>
                    <div className="bar" style={{ height: 120 }}><span style={{ height: `${(v / 30) * 100}%` }} /></div>
                    {"MTWTFSS"[k]}
                  </div>
                ))}
              </div>
            </div>
            <div className="surface reveal" style={{ padding: 28, display: "grid", gap: 18, ["--i" as string]: 1 }}>
              <div className="eyebrow">Levels</div>
              <div className="row" style={{ flexWrap: "wrap", gap: 10 }}>
                {["Spark", "Candle", "Lantern", "Lighthouse", "Aurora", "Sun"].map((l, k) => (
                  <span key={l} className={`chip ${k < 3 ? "chip--lamp" : ""}`} style={{ height: 30, padding: "0 12px" }}>{k < 3 ? "●" : "○"} {l}</span>
                ))}
              </div>
              <div className="card" style={{ padding: 16 }}>
                <div className="row">
                  <span className="tile tile--lamp" style={{ animation: "glow 3s ease-in-out infinite" }}><Flame /></span>
                  <div><div style={{ color: "var(--ink)", fontWeight: 600 }}>Lantern</div><div className="small muted">412 glow · 188 to Lighthouse</div></div>
                </div>
                <div style={{ height: 8, borderRadius: 8, background: "var(--well)", marginTop: 14, overflow: "hidden" }}>
                  <div style={{ width: "53%", height: "100%", background: "var(--key-lamp)", borderRadius: 8 }} />
                </div>
              </div>
              <div className="row small muted" style={{ flexWrap: "wrap", gap: 14 }}>
                <span>+1 save</span><span>+2 highlight</span><span>+3 note</span><span>+10 finish</span><span>+2 idea kept</span>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="lp-sec" id="faq">
          <div className="reveal"><h2 className="h2"><span className="lead-in">Questions,</span> <span className="payoff">answered.</span></h2></div>
          <div className="faq">
            {FAQ.map(([q, a]) => (
              <details key={q} className="reveal"><summary>{q}</summary><p>{a}</p></details>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="lp-sec">
          <div className="surface gridlines reveal" style={{ padding: "64px 24px", textAlign: "center", display: "grid", justifyItems: "center", gap: 18 }}>
            <span className="bob" style={{ position: "relative" }}><AppIcon size={72} /></span>
            <h2 className="h2" style={{ position: "relative" }}><span className="lead-in">Turn the lamp on.</span> <span className="payoff">It is free.</span></h2>
            <p className="muted" style={{ position: "relative", maxWidth: 460 }}>Sign in with Google or GitHub and your library is ready in seconds. Every Pro feature is yours for the first 7 days.</p>
            <div className="row" style={{ position: "relative", flexWrap: "wrap", justifyContent: "center" }}>
              <Link to="/login" className="key key--lamp key--lg">Light your first lamp <ArrowRight size={16} /></Link>
              <a className="key key--ghost key--lg" href="https://github.com/brgv-code/lumen" target="_blank" rel="noreferrer"><Puzzle size={16} /> Get the extension</a>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

const QUOTES: [string, string][] = [
  ["Sorting is not reading.", "sun"], ["Slow reading compounds.", "mint"], ["Use lightness instead of lines.", "sky"], ["A lamp left on in the window", "sun"],
  ["The overlap is a draft.", "mint"], ["Pick the model per question.", "iris"], ["Remember what was sent.", "peach"], ["Notes record why.", "iris"],
  ["Attention is a garden.", "mint"], ["Keep a link to the passage.", "sky"], ["Calm is not empty.", "peach"], ["Let the objects be friendly.", "sun"],
];

const FAQ: [string, string][] = [
  ["Is Lumen free?", "Yes. The free plan keeps saving, reading, highlighting, notes, collections, the extension and Obsidian or markdown sync, with no time limit. Every new account also gets all of Pro (Spark, Radar, agents, analytics, Notion) free for 7 days, no card needed."],
  ["Does highlighting stop me from copying text?", "No. Lumen never takes over your selection. Select text and a small toolbar appears next to it; your normal copy and paste keeps working, and Copy with citation is one click away."],
  ["Can I choose which note my highlights go to?", "Yes. Every collection points at a destination: a note in your Obsidian vault, a Notion page, a markdown file or a webhook. You pick the collection while you read, from the extension or the dashboard."],
  ["Will clipping the same page twice duplicate my highlights?", "Never. Lumen keeps a delivery ledger per destination and only ever appends highlights that destination has not received yet."],
  ["Which AI models can I use?", "Lumen's hosted model (on Cloudflare Workers AI), Ollama on your own machine, any OpenAI compatible API, or Claude through your local Claude Code CLI via the Lumen helper."],
  ["Can Claude or other AI agents use my library?", "Yes. Lumen is an MCP server: press Connect agent in the dashboard, paste one command into Claude Code (or a config into Claude Desktop or Cursor), and your agent can search, read, highlight, save and review your reading."],
  ["What are readers like you?", "Links saved by at least two readers whose libraries overlap with yours. It is anonymous and aggregate: nobody sees who saved what, and highlights and notes are never shared. You can turn it off."],
  ["Is my data mine?", "Yes. Export everything as JSON or markdown at any time, and delete your account from settings. Your Obsidian API key never leaves your browser."],
  ["Does it work on PDFs?", "PDF highlighting is in progress: PDFs open in Lumen's own viewer, because no extension can reach inside Chrome's built in PDF viewer."],
];

function Orbit() {
  const nodes = [
    { x: 12, y: 62, label: "Obsidian", sub: "Research/joyful-reading.md", tile: "tile--iris", icon: <NotebookPen /> },
    { x: 36, y: 78, label: "Notion", sub: "Essay drafts", tile: "tile--ink", icon: <FileText /> },
    { x: 64, y: 78, label: "Markdown", sub: "highlights.md", tile: "tile--sky", icon: <Download /> },
    { x: 88, y: 62, label: "Webhook", sub: "your server", tile: "tile--mint", icon: <Webhook /> },
  ];
  return (
    <div className="orbit">
      <svg className="lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {nodes.map((n) => <path key={n.label} d={`M50 22 C 50 ${(22 + n.y) / 2}, ${n.x} ${(22 + n.y) / 2}, ${n.x} ${n.y - 12}`} fill="none" stroke="currentColor" strokeWidth="0.35" strokeDasharray="1 1.2" vectorEffect="non-scaling-stroke" />)}
      </svg>
      <div className="card node" style={{ left: "50%", top: "16%", padding: "10px 14px", display: "flex", gap: 10, alignItems: "center", fontSize: 14, whiteSpace: "nowrap", zIndex: 2 }}>
        <span className="tile tile--sm tile--lamp"><Library /></span>
        <div style={{ textAlign: "left" }}><div style={{ color: "var(--ink)", fontWeight: 600 }}>Essay: reading should feel joyful</div><div className="small muted">3 new highlights · 12 already sent</div></div>
        <span className="chip chip--iris" style={{ marginLeft: 6 }}>Collection</span>
      </div>
      {nodes.map((n, k) => (
        <div key={n.label} className="node" style={{ left: `${n.x}%`, top: `${n.y}%` }}>
          <div className="bob" style={{ display: "grid", justifyItems: "center", gap: 6, ["--delay" as string]: `${-k * 1.3}s` }}>
            <span className={`tile ${n.tile}`}>{n.icon}</span>
            <span>{n.label}</span>
            <span className="chip" style={{ height: 20, fontSize: 11 }}>{n.sub}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function FeatureCard({ tab }: { tab: Tab }) {
  if (tab === "highlight")
    return (
      <div className="card">
        <div className="row" style={{ marginBottom: 12 }}><span className="tile tile--sm tile--ink"><Highlighter /></span><b style={{ color: "var(--ink)" }}>New highlight</b><span className="spacer" /><span className="chip chip--mint">Saved</span></div>
        <p style={{ fontFamily: "var(--font-read)", fontSize: 16, lineHeight: 1.6, color: "var(--ink)" }}><mark className="hl-sun">Send the highlight to the note you are already writing, not to a new inbox.</mark></p>
        <div className="row" style={{ margin: "14px 0", gap: 8 }}>
          {["sun", "mint", "iris", "peach", "sky"].map((c, k) => <span key={c} className={`swatch-${c}`} style={{ width: 20, height: 20, borderRadius: 99, boxShadow: k === 0 ? "0 0 0 2px var(--raised), 0 0 0 4px var(--ink)" : "none" }} />)}
        </div>
        <div className="well" style={{ padding: 10, fontSize: 13 }}>✎ Exactly the Web Clipper problem.</div>
        <div className="row" style={{ marginTop: 14 }}><button className="key key--sm"><Copy size={14} /> Copy with citation</button><span className="small muted">Ctrl+C still works</span></div>
      </div>
    );
  if (tab === "ask")
    return (
      <div className="card" style={{ background: "var(--iris-tint)" }}>
        <div className="row" style={{ marginBottom: 12 }}><span className="tile tile--sm tile--iris"><Sparkles /></span><b style={{ color: "var(--ink)" }}>Explain</b><span className="spacer" /><span className="chip" style={{ background: "var(--raised)" }}>Claude · local</span></div>
        <div className="card-flat" style={{ padding: 12 }}>
          <div className="eyebrow">Selected</div>
          <div style={{ fontFamily: "var(--font-read)", color: "var(--ink)" }}>"Choosing the model per task matters more than choosing the best model."</div>
        </div>
        <div className="card-flat" style={{ padding: 12, marginTop: 8 }}>
          <div className="eyebrow">Answer</div>
          <div className="small" style={{ color: "var(--ink-2)" }}>A small local model answers margin questions instantly; a bigger hosted one is worth the wait only when the question needs depth. Make switching cheap.</div>
        </div>
        <div className="row" style={{ marginTop: 10, gap: 6, flexWrap: "wrap" }}>{["Explain", "Define", "Simplify", "Ask…"].map((x) => <span key={x} className="chip" style={{ background: "var(--raised)" }}>{x}</span>)}</div>
      </div>
    );
  if (tab === "send")
    return (
      <div className="card">
        <div className="eyebrow" style={{ marginBottom: 10 }}>Sending to</div>
        {[["Research/joyful-reading.md", "Obsidian", "tile--iris", true], ["Essay drafts", "Notion", "tile--ink", false], ["lumen-highlights.md", "Markdown", "tile--sky", false]].map(([n, k, t, on]) => (
          <div key={n as string} className="row" style={{ padding: 10, borderRadius: 12, background: on ? "var(--surface)" : "transparent", boxShadow: on ? "inset 0 0 0 1px var(--hairline-strong)" : "none", marginBottom: 6 }}>
            <span className={`tile tile--sm ${t}`}>{k === "Obsidian" ? <NotebookPen /> : k === "Notion" ? <FileText /> : <Download />}</span>
            <div><div style={{ color: "var(--ink)", fontWeight: 500, fontSize: 14 }}>{n}</div><div className="small muted">{k}</div></div>
            <span className="spacer" />{on && <Check size={18} style={{ color: "var(--mint)" }} />}
          </div>
        ))}
        <div className="row small" style={{ marginTop: 10 }}><span className="chip chip--mint">3 new</span><span className="muted">12 already sent, skipped</span></div>
      </div>
    );
  if (tab === "library")
    return (
      <div className="card">
        <div className="eyebrow" style={{ marginBottom: 10 }}>Continue reading</div>
        {[["Reading slowly on purpose", 42, "sun"], ["Designing for calm", 10, "sky"], ["Small models, sharp tools", 100, "mint"]].map(([t, p, c]) => (
          <div key={t as string} style={{ padding: "10px 0", borderTop: "1px solid var(--hairline)" }}>
            <div className="row"><span className={`tile tile--xs tile--${c}`}><BookOpen /></span><span style={{ color: "var(--ink)", fontWeight: 500, fontSize: 14 }}>{t}</span><span className="spacer" /><span className="small muted">{p === 100 ? "Done" : `${p}%`}</span></div>
            <div style={{ height: 5, borderRadius: 5, background: "var(--well)", marginTop: 8 }}><div style={{ width: `${p}%`, height: "100%", borderRadius: 5, background: p === 100 ? "var(--mint)" : "var(--key-lamp)" }} /></div>
          </div>
        ))}
      </div>
    );
  if (tab === "agents")
    return (
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div className="row" style={{ padding: "12px 14px" }}><span className="tile tile--sm tile--iris"><Bot /></span><b style={{ color: "var(--ink)" }}>Claude Code</b><span className="spacer" /><span className="chip chip--mint">Connected</span></div>
        <pre className="mono" style={{ margin: 0, padding: 14, background: "#121215", color: "#e8e8ea", fontSize: 11.5, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{`> Use Lumen to do my weekly review

● lumen · get_reading_stats
● lumen · list_highlights (40)
● lumen · get_trending

You finished 6 pieces and kept circling
one idea: highlights rot without a home.
"Send the highlight to the note you are
already writing" (Why highlights rot).
Trending in #obsidian this week: 3 posts
on local first notes. Draft idea:
"Where should a highlight live?"`}</pre>
      </div>
    );
  return (
    <div className="card">
      <div className="row" style={{ marginBottom: 10 }}><span className="tile tile--sm tile--peach"><Sparkles /></span><b style={{ color: "var(--ink)" }}>Spark</b><span className="spacer" /><span className="chip chip--peach">3 sources</span></div>
      <div style={{ color: "var(--ink)", fontWeight: 600, fontSize: 17, letterSpacing: "-0.02em" }}>Reading should feel like a lamp, not a treadmill</div>
      <p className="small" style={{ marginTop: 6 }}>Streaks and highlights work when they reward attention, not volume.</p>
      <ol className="small" style={{ margin: "10px 0 0", paddingLeft: 18, color: "var(--ink-2)" }}><li>Sorting versus reading</li><li>Why highlights rot</li><li>A lamp in the window</li></ol>
      <div className="row" style={{ marginTop: 12 }}><button className="key key--sm key--lamp">Keep idea</button><button className="key key--sm key--quiet">Dismiss</button></div>
    </div>
  );
}
