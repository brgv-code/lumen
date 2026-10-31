// HTML shell for server rendered pages: crawlable, fast, with structured data.

export const SITE = {
  name: "Lumen",
  url: "https://readwithlumen.app",
  tagline: "Read slowly. Keep what glows.",
  description: "Lumen is a reading companion: save articles, highlight and annotate them, ask a model, and send what matters to Obsidian, Notion or markdown. Free and open source.",
  github: "https://github.com/brgv-code/lumen",
};

/** Per request settings (set by the seo router from env). */
export const META = { verify: "" };

export const esc = (s: string) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const ICON = `<svg width="28" height="28" viewBox="0 0 64 64" aria-hidden="true" style="filter:drop-shadow(0 6px 10px rgba(255,106,26,.35))"><defs><linearGradient id="lg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFB53D"/><stop offset="1" stop-color="#FF6A1A"/></linearGradient></defs><rect width="64" height="64" rx="16" fill="url(#lg)"/><path d="M20 44h24" stroke="#fff" stroke-width="5" stroke-linecap="round"/><circle cx="32" cy="27" r="9" fill="#fff"/><path d="M32 10v3M47 27h-3M20 27h-3M42.6 16.4l-2.1 2.1M23.5 18.5l-2.1-2.1" stroke="#fff" stroke-width="3" stroke-linecap="round"/></svg>`;

const svg = (d: string) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
export const GLYPH = {
  highlighter: svg('<path d="m9 11-6 6v3h9l3-3"/><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/>'),
  sparkles: svg('<path d="M12 3l1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2z"/>'),
  book: svg('<path d="M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2z"/><path d="M22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z"/>'),
  note: svg('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4z"/>'),
  send: svg('<path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/>'),
  flame: svg('<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.4-.5-2-1-3-1.1-2.1-.2-4 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.2.4-2.3 1-3.3.3 1.3 1.2 2.3 2.5 2.8"/>'),
  bot: svg('<rect x="3" y="8" width="18" height="12" rx="3"/><path d="M12 8V4M8 14h.01M16 14h.01"/>'),
};

/** Decorated footer, shared by every server rendered page (the landing renders the same markup in React). */
export function footerHtml() {
  const floats = [
    ["6%", "18%", "-10deg", "0s", `<span class="tile tile--lg tile--lamp">${GLYPH.highlighter}</span>`, ""],
    ["86%", "10%", "8deg", "-2s", `<span class="tile tile--lg tile--iris">${GLYPH.sparkles}</span>`, ""],
    ["22%", "4%", "4deg", "-4s", `<span class="tile tile--mint">${GLYPH.book}</span>`, "hide-sm"],
    ["70%", "36%", "-6deg", "-1s", `<span class="tile tile--sky">${GLYPH.send}</span>`, "hide-sm"],
    ["40%", "0%", "-3deg", "-3s", `<span class="foot-pill"><mark class="hl-sun">Slow reading compounds.</mark></span>`, "hide-sm"],
    ["58%", "8%", "3deg", "-5s", `<span class="foot-pill"><mark class="hl-iris">a lamp left on in the window</mark></span>`, "hide-sm"],
    ["2%", "48%", "5deg", "-2.5s", `<span class="foot-pill"><mark class="hl-mint">Use lightness instead of lines.</mark></span>`, "hide-sm"],
    ["92%", "50%", "-8deg", "-3.5s", `<span class="tile tile--peach">${GLYPH.flame}</span>`, "hide-sm"],
  ];
  return `<footer class="s-wrap foot">
  <div class="foot__grid">
    <div style="display:grid;gap:14px;align-content:start"><a class="s-logo" href="/">${ICON}lumen</a><p class="muted" style="max-width:260px">Built for people who think reading should feel light.</p><a class="key key--lamp key--sm" href="/login" style="justify-self:start">Start free</a>
      <a href="${SITE.github}" aria-label="GitHub" style="color:var(--ink-2)">${svg('<path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.1-1.3-.3-2.5-1-3.5.3-1.2.3-2.4 0-3.5 0 0-1 0-3 1.5a10.3 10.3 0 0 0-6 0C8 2 7 2 7 2c-.3 1.1-.3 2.3 0 3.5a5.4 5.4 0 0 0-1 3.5c0 3.5 3 5.5 6 5.5-.4.4-.7 1-.8 1.6-.2.6-.2 1.2-.2 1.9v4"/><path d="M9 18c-4.5 2-5-2-7-2"/>').replace("<svg", '<svg width="18" height="18"')}</a></div>
    <div><h5>Product</h5><ul><li><a href="/#features">Features</a></li><li><a href="/changelog">Changelog</a></li><li><a href="/login">Dashboard</a></li></ul></div>
    <div><h5>Compare</h5><ul><li><a href="/compare/lumen-vs-readwise-reader">vs Readwise Reader</a></li><li><a href="/compare/lumen-vs-obsidian-web-clipper">vs Obsidian Web Clipper</a></li><li><a href="/compare/pocket-alternative">Pocket alternative</a></li><li><a href="/compare">All comparisons</a></li></ul></div>
    <div><h5>Developers</h5><ul><li><a href="/docs/api">API</a></li><li><a href="/docs/mcp">MCP for agents</a></li><li><a href="/docs/architecture">Architecture</a></li><li><a href="${SITE.github}">Source</a></li></ul></div>
    <div><h5>Resources</h5><ul><li><a href="/answers">Answers</a></li><li><a href="/docs">Docs</a></li><li><a href="/privacy">Privacy</a></li><li><a href="/terms">Terms</a></li></ul></div>
  </div>
  <p class="small muted" style="text-align:center;margin-top:40px;position:relative;z-index:2">© 2026 Lumen · Open source under AGPL-3.0</p>
  <div class="foot-stage" aria-hidden="true">
    ${floats.map(([x, y, r, d, inner, cls]) => `<div class="foot-float ${cls}" style="--x:${x};--y:${y};--r:${r};--d:${d}"><div>${inner}</div></div>`).join("")}
    <div class="wordmark">lumen</div>
  </div>
</footer>`;
}

export interface PageOpts {
  path: string;
  title: string;
  description: string;
  body: string;
  jsonLd?: object[];
  nav?: "compare" | "answers" | "docs" | "";
  extraHead?: string;
  /** absolute URL of the link preview image; defaults to the site card */
  ogImage?: string;
  noindex?: boolean;
}

export function page(o: PageOpts) {
  const url = SITE.url + o.path;
  const ld = [
    { "@context": "https://schema.org", "@type": "Organization", name: SITE.name, url: SITE.url, logo: `${SITE.url}/icon.svg`, sameAs: [SITE.github] },
    ...(o.jsonLd ?? []),
  ];
  const cur = (k: string) => (o.nav === k ? ' aria-current="page"' : "");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(o.title)}</title>
<meta name="description" content="${esc(o.description)}">
<link rel="canonical" href="${url}">
${META.verify ? `<meta name="google-site-verification" content="${esc(META.verify)}">` : ""}
${o.noindex ? '<meta name="robots" content="noindex">' : ""}
<meta property="og:type" content="article">
<meta property="og:site_name" content="Lumen">
<meta property="og:title" content="${esc(o.title)}">
<meta property="og:description" content="${esc(o.description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${o.ogImage ?? `${SITE.url}/og.png`}"><meta name="twitter:image" content="${o.ogImage ?? `${SITE.url}/og.png`}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#EDEDEC">
<link rel="icon" href="/icon.svg" type="image/svg+xml">
<link rel="alternate" type="text/plain" href="/llms.txt" title="LLM summary">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500&family=Newsreader:opsz,wght@6..72,400;6..72,500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/site.css">
<script>try{var t=localStorage.getItem("lumen-theme");if(t==="dark"||t==="light")document.documentElement.dataset.theme=t}catch(e){}</script>
${ld.map((x) => `<script type="application/ld+json">${JSON.stringify(x).replace(/</g, "\\u003c")}</script>`).join("\n")}
${o.extraHead ?? ""}
</head>
<body>
<nav class="s-nav"><div class="s-wrap s-nav__in">
  <a class="s-logo" href="/" aria-label="Lumen home">${ICON}lumen</a>
  <div class="s-nav__links"><a href="/#features">Features</a><a href="/compare"${cur("compare")}>Compare</a><a href="/answers"${cur("answers")}>Answers</a><a href="/docs"${cur("docs")}>Docs</a><a href="/changelog">Changelog</a></div>
  <div class="row"><a class="key key--quiet key--sm" href="/login">Log in</a><a class="key key--lamp key--sm" href="/login">Start free</a></div>
</div></nav>
<main class="s-wrap">${o.body}</main>
${footerHtml()}
</body>
</html>`;
}

export function crumbs(items: [string, string][]) {
  return `<nav class="crumbs" aria-label="Breadcrumb">${items.map(([label, href], k) => (k < items.length - 1 ? `<a href="${href}">${esc(label)}</a><span>/</span>` : `<span aria-current="page">${esc(label)}</span>`)).join("")}</nav>`;
}

export function crumbsLd(items: [string, string][]) {
  return { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: items.map(([name, href], k) => ({ "@type": "ListItem", position: k + 1, name, item: SITE.url + href })) };
}

export function faqLd(faq: [string, string][]) {
  return { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) };
}

export function ctaBand(title = "Turn the lamp on.", pay = "Start reading.") {
  return `<section class="surface gridlines cta-band"><span style="position:relative">${ICON.replace('width="28" height="28"', 'width="56" height="56"')}</span><h2 class="h3" style="position:relative"><span class="lead-in">${esc(title)}</span> <span class="payoff">${esc(pay)}</span></h2><div class="row" style="position:relative;flex-wrap:wrap;justify-content:center"><a class="key key--lamp key--lg" href="/login">Light your first lamp, free</a><a class="key key--ghost key--lg" href="/login">Explore the demo</a></div></section>`;
}
