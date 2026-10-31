import { Github, Highlighter, Sparkles, BookOpen, Send, Flame } from "lucide-react";
import { Logo } from "./ui";
import "../styles/footer.css";

const FLOATS: { x: string; y: string; r: string; d: string; el: React.ReactNode; sm?: boolean }[] = [
  { x: "6%", y: "18%", r: "-10deg", d: "0s", el: <span className="tile tile--lg tile--lamp"><Highlighter /></span> },
  { x: "86%", y: "10%", r: "8deg", d: "-2s", el: <span className="tile tile--lg tile--iris"><Sparkles /></span> },
  { x: "22%", y: "4%", r: "4deg", d: "-4s", el: <span className="tile tile--mint"><BookOpen /></span>, sm: true },
  { x: "70%", y: "36%", r: "-6deg", d: "-1s", el: <span className="tile tile--sky"><Send /></span>, sm: true },
  { x: "40%", y: "0%", r: "-3deg", d: "-3s", el: <span className="foot-pill"><mark className="hl-sun">Slow reading compounds.</mark></span>, sm: true },
  { x: "58%", y: "8%", r: "3deg", d: "-5s", el: <span className="foot-pill"><mark className="hl-iris">a lamp left on in the window</mark></span>, sm: true },
  { x: "2%", y: "48%", r: "5deg", d: "-2.5s", el: <span className="foot-pill"><mark className="hl-mint">Use lightness instead of lines.</mark></span>, sm: true },
  { x: "92%", y: "50%", r: "-8deg", d: "-3.5s", el: <span className="tile tile--peach"><Flame /></span>, sm: true },
];

export function SiteFooter() {
  return (
    <footer className="lp-wrap foot">
      <div className="foot__grid">
        <div style={{ display: "grid", gap: 14, alignContent: "start" }}>
          <Logo />
          <p className="muted" style={{ maxWidth: 260 }}>Built for people who think reading should feel light.</p>
          <div className="row" style={{ gap: 14, color: "var(--ink-2)" }}><a href="https://github.com/brgv-code/lumen" aria-label="GitHub"><Github size={17} /></a></div>
        </div>
        <div><h5>Product</h5><ul><li><a href="#features">Features</a></li><li><a href="#pricing">Pricing</a></li><li><a href="/changelog">Changelog</a></li><li><a href="/login">Dashboard</a></li></ul></div>
        <div><h5>Compare</h5><ul><li><a href="/compare/lumen-vs-readwise-reader">vs Readwise Reader</a></li><li><a href="/compare/lumen-vs-obsidian-web-clipper">vs Obsidian Web Clipper</a></li><li><a href="/compare/pocket-alternative">Pocket alternative</a></li><li><a href="/compare">All comparisons</a></li></ul></div>
        <div><h5>Developers</h5><ul><li><a href="/docs/api">API</a></li><li><a href="/docs/mcp">MCP for agents</a></li><li><a href="/docs/architecture">Architecture</a></li><li><a href="https://github.com/brgv-code/lumen">Source</a></li></ul></div>
        <div><h5>Resources</h5><ul><li><a href="/answers">Answers</a></li><li><a href="/docs">Docs</a></li><li><a href="/privacy">Privacy</a></li><li><a href="/terms">Terms</a></li></ul></div>
      </div>
      <p className="small muted" style={{ textAlign: "center", marginTop: 40, position: "relative", zIndex: 2 }}>© 2026 Lumen · Open source</p>
      <div className="foot-stage" aria-hidden="true">
        {FLOATS.map((f, k) => (
          <div key={k} className={`foot-float ${f.sm ? "hide-sm" : ""}`} style={{ ["--x" as string]: f.x, ["--y" as string]: f.y, ["--r" as string]: f.r, ["--d" as string]: f.d }}><div>{f.el}</div></div>
        ))}
        <div className="wordmark">lumen</div>
      </div>
    </footer>
  );
}
